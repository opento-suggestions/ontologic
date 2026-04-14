#!/usr/bin/env node

/**
 * @fileoverview End-to-end smoke test for dual proof mode
 * @module scripts/v0.7.1/smoke-test-e2e
 *
 * Executes the full v0.8 dual-mode proof sequence:
 *   Phase 1: ContractProof — 3 additive light rules (mint + HCS + metadata)
 *   Phase 2: RegistryProof — 3 subtractive paint rules (HCS + metadata, no mint)
 *   Phase 3: Entity attestations — WHITE (ContractProof) + BLACK (RegistryProof)
 *   Phase 4: Verification — check token metadata via mirror node
 *
 * Usage:
 *   node scripts/v0.7.1/smoke-test-e2e.js --sphere <name> [--dry-run]
 */

import {
  Client,
  PrivateKey,
  TopicMessageSubmitTransaction,
} from "@hashgraph/sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ethers } from "ethers";
import { getOperatorConfig, getNetworkConfig } from "../v0.6.3/lib/config.js";
import { canonicalizeJSON, hashCanonicalJSON } from "../v0.6.3/lib/canonicalize.js";
import { loadSphereConfig } from "../v0.7/lib/sphere-config.js";
import { resolveRule, computeRuleUriHash, buildHcsUri, resolveEvidence } from "../v0.7/lib/resolve.js";
import {
  buildMorphemeProof,
  callPrepareReasoning,
  callReasonWithMint,
  submitProof,
} from "../v0.7/reason.js";
import { fetchProvenanceState, buildProvenanceEntry, stampProvenance } from "./lib/metadata.js";
import * as logger from "../v0.6.3/lib/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXAMPLES = path.join(__dirname, "..", "..", "examples", "v07");

// ─── Proof Execution Helpers ───

/**
 * Execute a ContractProof (light domain): contract call + mint + HCS + metadata stamp
 * @returns {Object} { bindingHash, hcsSeq, proofUri, consensusTimestamp }
 */
async function runContractProof(client, bundle, sphereConfig, operatorConfig, privateKey, networkConfig, provenanceCache) {
  // Auto-resolve evidence if needed (entity bundles loaded from disk)
  if (bundle.inputs?.[0]?.proofs?.some(p => p.bindingHash === null)) {
    await resolveEvidence(bundle, sphereConfig.proofTopicId, { mirrorNodeUrl: networkConfig.mirrorNodeUrl });
  }

  const { ruleDef, ruleUri, ruleUriHash } = await resolveRule(
    bundle.ruleRef, sphereConfig, { mirrorNodeUrl: networkConfig.mirrorNodeUrl }
  );

  const inputsHash = ethers.keccak256(ethers.toUtf8Bytes(canonicalizeJSON(bundle.inputs)));
  const outputsHash = ethers.keccak256(ethers.toUtf8Bytes(canonicalizeJSON(bundle.output)));
  const bindingHash = ethers.keccak256(
    ethers.toUtf8Bytes(canonicalizeJSON({ ruleUri, inputsHash, outputsHash }))
  );

  // 1. Peirce: prepareReasoning
  await callPrepareReasoning(client, sphereConfig.contractId, ruleUri, ruleUriHash, inputsHash);

  // 2. Tarski (creation): reasonWithMint
  const mintResult = await callReasonWithMint(client, sphereConfig.contractId, {
    ruleUri, ruleUriHash, inputsHash, outputsHash, bindingHash,
    outputToken: bundle.output.tokenAddr,
    amount: bundle.output.amount || 1,
  });

  // 3. Floridi: HCS anchor
  const proof = buildMorphemeProof({
    ruleId: ruleDef.ruleId, ruleUri, ruleUriHash,
    inputsHash, outputsHash, bindingHash,
    contractId: sphereConfig.contractId,
    callerAccountId: operatorConfig.id,
    transactionId: mintResult.transactionId,
  });
  const proofResult = await submitProof(client, sphereConfig.proofTopicId, proof, privateKey);
  const proofUri = buildHcsUri(sphereConfig.proofTopicId, proofResult.consensusTimestamp);

  // 4. Tarski (alteration): metadata stamp
  try {
    const state = provenanceCache?.get(bundle.output.tokenId)
      || await fetchProvenanceState(networkConfig.mirrorNodeUrl, bundle.output.tokenId);
    const entry = buildProvenanceEntry({
      bindingHash, domain: ruleDef.domain, ruleId: ruleDef.ruleId, proofUri, proofMode: "contract",
    });
    const stampResult = await stampProvenance(client, bundle.output.tokenId, state, entry, privateKey);
    provenanceCache?.set(bundle.output.tokenId, { n: stampResult.n, root: stampResult.root });
  } catch (err) {
    console.warn(`      ⚠️  Metadata stamp failed (proof safe on HCS): ${err.message}`);
  }

  return {
    ruleId: ruleDef.ruleId,
    domain: ruleDef.domain,
    bindingHash,
    hcsSeq: proofResult.sequenceNumber,
    proofUri,
    outputToken: bundle.output.tokenSymbol,
  };
}

/**
 * Execute a RegistryProof (paint domain): HCS anchor + metadata stamp (no contract)
 * @returns {Object} { bindingHash, hcsSeq, proofUri, consensusTimestamp }
 */
async function runRegistryProof(client, bundle, sphereConfig, operatorConfig, privateKey, networkConfig, provenanceCache) {
  // Auto-resolve evidence if needed (entity bundles loaded from disk)
  if (bundle.inputs?.[0]?.proofs?.some(p => p.bindingHash === null)) {
    await resolveEvidence(bundle, sphereConfig.proofTopicId, { mirrorNodeUrl: networkConfig.mirrorNodeUrl });
  }

  const { ruleDef, ruleUri, ruleUriHash } = await resolveRule(
    bundle.ruleRef, sphereConfig, { mirrorNodeUrl: networkConfig.mirrorNodeUrl }
  );

  const inputsHash = ethers.keccak256(ethers.toUtf8Bytes(canonicalizeJSON(bundle.inputs)));
  const outputsHash = ethers.keccak256(ethers.toUtf8Bytes(canonicalizeJSON(bundle.output)));
  const bindingHash = ethers.keccak256(
    ethers.toUtf8Bytes(canonicalizeJSON({ ruleUri, inputsHash, outputsHash }))
  );

  // 1. Floridi: HCS anchor (no contract call)
  const proof = {
    schema: "hcs.ontologic.morphemeProof",
    schemaVersion: "0.8",
    proofMode: "registry",
    ruleId: ruleDef.ruleId, ruleUri, ruleUriHash,
    inputsHash, outputsHash, bindingHash,
    reasoningContractId: null,
    callerAccountId: operatorConfig.id,
    transactionId: null,
    network: "hedera-testnet",
    createdAt: new Date().toISOString(),
  };
  const proofResult = await submitProof(client, sphereConfig.proofTopicId, proof, privateKey);
  const proofUri = buildHcsUri(sphereConfig.proofTopicId, proofResult.consensusTimestamp);

  // 2. Tarski (alteration): metadata stamp
  try {
    const state = provenanceCache?.get(bundle.output.tokenId)
      || await fetchProvenanceState(networkConfig.mirrorNodeUrl, bundle.output.tokenId);
    const entry = buildProvenanceEntry({
      bindingHash, domain: ruleDef.domain, ruleId: ruleDef.ruleId, proofUri, proofMode: "registry",
    });
    const stampResult = await stampProvenance(client, bundle.output.tokenId, state, entry, privateKey);
    provenanceCache?.set(bundle.output.tokenId, { n: stampResult.n, root: stampResult.root });
  } catch (err) {
    console.warn(`      ⚠️  Metadata stamp failed (proof safe on HCS): ${err.message}`);
  }

  return {
    ruleId: ruleDef.ruleId,
    domain: ruleDef.domain,
    bindingHash,
    hcsSeq: proofResult.sequenceNumber,
    proofUri,
    outputToken: bundle.output.tokenSymbol,
  };
}

// ─── Main ───

async function main() {
  const args = process.argv.slice(2);
  const getArg = (flag) => {
    const idx = args.indexOf(flag);
    return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
  };

  const sphereName = getArg("--sphere") || "v08";
  const dryRun = args.includes("--dry-run");

  logger.section("v0.8 End-to-End Smoke Test");
  console.log(`Sphere: ${sphereName}`);
  console.log(`Dry Run: ${dryRun}`);

  const sphereConfig = loadSphereConfig(sphereName);
  const operatorConfig = getOperatorConfig();
  const networkConfig = getNetworkConfig();

  if (dryRun) {
    console.log("\n[DRY RUN] Would execute:");
    console.log("  Phase 1: ContractProof — R+G→Y, G+B→C, R+B→M (mint + HCS + metadata)");
    console.log("  Phase 2: RegistryProof — C+M→B, C+Y→G, M+Y→R (HCS + metadata, no mint)");
    console.log("  Phase 3: Entities — WHITE (ContractProof), BLACK (RegistryProof)");
    console.log("  Phase 4: Verify metadata on all stamped tokens");
    return;
  }

  const privateKey = PrivateKey.fromString(operatorConfig.derKey);
  const client = Client.forTestnet().setOperator(operatorConfig.id, privateKey);

  const allResults = [];
  const provenanceCache = new Map(); // tokenId -> {n, root} — avoids mirror node sync lag

  try {
    // ═══════════════════════════════════════════════════
    // Phase 1: ContractProof — Light Domain (3 pairwise)
    // ═══════════════════════════════════════════════════
    logger.subsection("Phase 1: ContractProof — Light Domain");

    const lightBundles = [
      "bundle-red-green-yellow.json",
      "bundle-green-blue-cyan.json",
      "bundle-red-blue-magenta.json",
    ];

    const lightResults = [];

    for (const file of lightBundles) {
      const bundle = JSON.parse(fs.readFileSync(path.join(EXAMPLES, file), "utf8"));
      console.log(`\n  [ContractProof] ${bundle.ruleRef}`);
      console.log(`    inputs: ${bundle.inputs.map(i => i.tokenSymbol).join(" + ")}`);
      console.log(`    output: ${bundle.output.tokenSymbol}`);

      const result = await runContractProof(client, bundle, sphereConfig, operatorConfig, privateKey, networkConfig, provenanceCache);

      console.log(`    ✓ Minted ${result.outputToken}, HCS Seq: ${result.hcsSeq}`);
      console.log(`    ✓ bindingHash: ${result.bindingHash.slice(0, 18)}...`);
      lightResults.push(result);
      allResults.push(result);
    }

    // ═══════════════════════════════════════════════════
    // Phase 2: RegistryProof — Paint Domain (3 pairwise)
    // ═══════════════════════════════════════════════════
    logger.subsection("Phase 2: RegistryProof — Paint Domain");

    const paintBundles = [
      "bundle-cyan-magenta-blue.json",
      "bundle-cyan-yellow-green.json",
      "bundle-magenta-yellow-red.json",
    ];

    const paintResults = [];

    for (const file of paintBundles) {
      const bundle = JSON.parse(fs.readFileSync(path.join(EXAMPLES, file), "utf8"));
      console.log(`\n  [RegistryProof] ${bundle.ruleRef}`);
      console.log(`    inputs: ${bundle.inputs.map(i => i.tokenSymbol).join(" + ")}`);
      console.log(`    output: ${bundle.output.tokenSymbol}`);

      const result = await runRegistryProof(client, bundle, sphereConfig, operatorConfig, privateKey, networkConfig, provenanceCache);

      console.log(`    ✓ Stamped ${result.outputToken} (no mint), HCS Seq: ${result.hcsSeq}`);
      console.log(`    ✓ bindingHash: ${result.bindingHash.slice(0, 18)}...`);
      paintResults.push(result);
      allResults.push(result);
    }

    // ═══════════════════════════════════════════════════
    // Phase 3: Entity Attestations
    // ═══════════════════════════════════════════════════
    logger.subsection("Phase 3: Entity Attestations");

    // WHITE entity — ContractProof, evidence from Phase 1
    const whiteBundle = JSON.parse(fs.readFileSync(path.join(EXAMPLES, "bundle-white-entity.json"), "utf8"));
    // Patch evidence with real proof references from Phase 1
    whiteBundle.inputs[0].proofs = lightResults.map(r => ({
      ruleId: r.ruleId,
      bindingHash: r.bindingHash,
      outputToken: r.outputToken,
      hcsSeq: parseInt(r.hcsSeq),
    }));

    console.log("\n  [ContractProof] WHITE entity — evidence from 3 light proofs");
    const whiteResult = await runContractProof(client, whiteBundle, sphereConfig, operatorConfig, privateKey, networkConfig, provenanceCache);
    console.log(`    ✓ Minted WHITE, HCS Seq: ${whiteResult.hcsSeq}`);
    allResults.push(whiteResult);

    // BLACK entity — RegistryProof, evidence from Phase 2
    const blackBundle = JSON.parse(fs.readFileSync(path.join(EXAMPLES, "bundle-black-entity.json"), "utf8"));
    // Patch evidence with real proof references from Phase 2
    blackBundle.inputs[0].proofs = paintResults.map(r => ({
      ruleId: r.ruleId,
      bindingHash: r.bindingHash,
      outputToken: r.outputToken,
      hcsSeq: parseInt(r.hcsSeq),
    }));

    console.log("\n  [RegistryProof] BLACK entity — evidence from 3 paint proofs");
    const blackResult = await runRegistryProof(client, blackBundle, sphereConfig, operatorConfig, privateKey, networkConfig, provenanceCache);
    console.log(`    ✓ Stamped BLACK (no mint), HCS Seq: ${blackResult.hcsSeq}`);
    allResults.push(blackResult);

    // ═══════════════════════════════════════════════════
    // Phase 4: Verification
    // ═══════════════════════════════════════════════════
    logger.subsection("Phase 4: Metadata Verification");

    // Check tokens that received metadata stamps
    const tokensToCheck = [
      { symbol: "YELLOW", id: process.env.YELLOW_TOKEN_ID },
      { symbol: "CYAN", id: process.env.CYAN_TOKEN_ID },
      { symbol: "MAGENTA", id: process.env.MAGENTA_TOKEN_ID },
      { symbol: "BLUE", id: process.env.BLUE_TOKEN_ID },
      { symbol: "GREEN", id: process.env.GREEN_TOKEN_ID },
      { symbol: "RED", id: process.env.RED_TOKEN_ID },
      { symbol: "WHITE", id: process.env.WHITE_TOKEN_ID },
      { symbol: "BLACK", id: process.env.BLACK_TOKEN_ID },
    ];

    let verified = 0;
    for (const token of tokensToCheck) {
      if (!token.id) continue;
      const state = await fetchProvenanceState(networkConfig.mirrorNodeUrl, token.id);
      if (state.n > 0) {
        console.log(`  ✅ ${token.symbol}: n=${state.n}, root=${state.root.slice(0, 18)}...`);
        verified++;
      } else {
        console.log(`  ❌ ${token.symbol}: no provenance commitment`);
      }
    }

    // ═══════════════════════════════════════════════════
    // Summary
    // ═══════════════════════════════════════════════════
    logger.section("Smoke Test Summary");

    console.log("| # | Mode     | Domain             | Rule                                      | Output  | HCS |");
    console.log("|---|----------|--------------------|-------------------------------------------|---------|-----|");
    allResults.forEach((r, i) => {
      const mode = r.domain.includes("paint") || r.domain.includes("entity.paint") ? "registry" : "contract";
      console.log(`| ${(i+1).toString().padStart(1)} | ${mode.padEnd(8)} | ${r.domain.padEnd(18)} | ${r.ruleId.padEnd(41)} | ${r.outputToken.padEnd(7)} | ${r.hcsSeq.padStart(3)} |`);
    });

    console.log(`\nProofs: ${allResults.length} (${lightResults.length + 1} ContractProof, ${paintResults.length + 1} RegistryProof)`);
    console.log(`Tokens verified: ${verified}/${tokensToCheck.length}`);

    if (verified === tokensToCheck.length) {
      logger.success("All tokens stamped — dual proof mode verified");
    } else {
      logger.warn(`${tokensToCheck.length - verified} token(s) missing provenance`);
    }

  } finally {
    client.close();
  }
}

main().catch((err) => {
  logger.error("Smoke test failed", err);
  process.exit(1);
});
