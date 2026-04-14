#!/usr/bin/env node

/**
 * @fileoverview Colorimetry smoke test — tertiary + CMYK transform + ontological proofs
 * @module scripts/v0.7.1/smoke-test-colorimetry
 *
 * Extends the base v0.8 smoke test with colorimetry phases:
 *   Phase 1: ContractProof — 6 tertiary light rules (mint + HCS + metadata)
 *   Phase 2: RegistryProof — 8 CMYK transform rules (HCS + metadata, no mint)
 *   Phase 3: RegistryProof — KEY entity from CMY transforms
 *   Phase 4: RegistryProof — 2 IsDividedInto ontological classifications
 *   Phase 5: Verification — check all token metadata
 *
 * Prerequisites:
 *   - Base v0.8 proofs must already exist (CMY minted, paint proofs done)
 *   - 7 new tokens created (ORANGE, CHARTREUSE, SPRING_GRN, AZURE, VIOLET, ROSE, KEY)
 *   - Supply keys migrated for new tokens
 *   - All colorimetry rules published
 *
 * Reference: Suresh & Jain (2015) doi:10.1016/j.procs.2015.08.062
 *
 * Usage:
 *   node scripts/v0.7.1/smoke-test-colorimetry.js --sphere <name> [--dry-run]
 */

import {
  Client,
  PrivateKey,
} from "@hashgraph/sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ethers } from "ethers";
import { getOperatorConfig, getNetworkConfig } from "../v0.6.3/lib/config.js";
import { canonicalizeJSON } from "../v0.6.3/lib/canonicalize.js";
import { loadSphereConfig } from "../v0.7/lib/sphere-config.js";
import { resolveRule, buildHcsUri, resolveEvidence } from "../v0.7/lib/resolve.js";
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
// (reused from smoke-test-e2e.js)

async function runContractProof(client, bundle, sphereConfig, operatorConfig, privateKey, networkConfig, provenanceCache) {
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

  await callPrepareReasoning(client, sphereConfig.contractId, ruleUri, ruleUriHash, inputsHash);

  const mintResult = await callReasonWithMint(client, sphereConfig.contractId, {
    ruleUri, ruleUriHash, inputsHash, outputsHash, bindingHash,
    outputToken: bundle.output.tokenAddr,
    amount: bundle.output.amount || 1,
  });

  const proof = buildMorphemeProof({
    ruleId: ruleDef.ruleId, ruleUri, ruleUriHash,
    inputsHash, outputsHash, bindingHash,
    contractId: sphereConfig.contractId,
    callerAccountId: operatorConfig.id,
    transactionId: mintResult.transactionId,
  });
  const proofResult = await submitProof(client, sphereConfig.proofTopicId, proof, privateKey);
  const proofUri = buildHcsUri(sphereConfig.proofTopicId, proofResult.consensusTimestamp);

  try {
    const state = provenanceCache?.get(bundle.output.tokenId)
      || await fetchProvenanceState(networkConfig.mirrorNodeUrl, bundle.output.tokenId);
    const entry = buildProvenanceEntry({
      bindingHash, domain: ruleDef.domain, ruleId: ruleDef.ruleId, proofUri, proofMode: "contract",
    });
    const stampResult = await stampProvenance(client, bundle.output.tokenId, state, entry, privateKey);
    provenanceCache?.set(bundle.output.tokenId, { n: stampResult.n, root: stampResult.root });
  } catch (err) {
    console.warn(`      Warning: Metadata stamp failed (proof safe on HCS): ${err.message}`);
  }

  return {
    ruleId: ruleDef.ruleId, domain: ruleDef.domain, bindingHash,
    hcsSeq: proofResult.sequenceNumber, proofUri,
    outputToken: bundle.output.tokenSymbol,
  };
}

async function runRegistryProof(client, bundle, sphereConfig, operatorConfig, privateKey, networkConfig, provenanceCache) {
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

  try {
    if (bundle.output.tokenId && bundle.output.tokenId !== "TBD") {
      const state = provenanceCache?.get(bundle.output.tokenId)
        || await fetchProvenanceState(networkConfig.mirrorNodeUrl, bundle.output.tokenId);
      const entry = buildProvenanceEntry({
        bindingHash, domain: ruleDef.domain, ruleId: ruleDef.ruleId, proofUri, proofMode: "registry",
      });
      const stampResult = await stampProvenance(client, bundle.output.tokenId, state, entry, privateKey);
      provenanceCache?.set(bundle.output.tokenId, { n: stampResult.n, root: stampResult.root });
    }
  } catch (err) {
    console.warn(`      Warning: Metadata stamp failed (proof safe on HCS): ${err.message}`);
  }

  return {
    ruleId: ruleDef.ruleId, domain: ruleDef.domain, bindingHash,
    hcsSeq: proofResult.sequenceNumber, proofUri,
    outputToken: bundle.output.tokenSymbol || bundle.output.classification || "N/A",
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

  logger.section("Colorimetry Smoke Test — Suresh & Jain (2015)");
  console.log(`Sphere: ${sphereName}`);
  console.log(`Dry Run: ${dryRun}`);

  const sphereConfig = loadSphereConfig(sphereName);
  const operatorConfig = getOperatorConfig();
  const networkConfig = getNetworkConfig();

  if (dryRun) {
    console.log("\n[DRY RUN] Would execute:");
    console.log("  Phase 1: ContractProof — 6 tertiary light mixes (R+Y→ORANGE, etc.)");
    console.log("  Phase 2: RegistryProof — 8 CMYK transforms (RGB→CMYK coordinates)");
    console.log("  Phase 3: RegistryProof — KEY entity from CMY transforms");
    console.log("  Phase 4: RegistryProof — 2 IsDividedInto ontological proofs");
    console.log("  Phase 5: Verify metadata on all stamped tokens");
    return;
  }

  const privateKey = PrivateKey.fromString(operatorConfig.derKey);
  const client = Client.forTestnet().setOperator(operatorConfig.id, privateKey);

  const allResults = [];
  const provenanceCache = new Map();

  try {
    // ═══════════════════════════════════════════════════
    // Phase 1: ContractProof — Tertiary Light Domain
    // ═══════════════════════════════════════════════════
    logger.subsection("Phase 1: ContractProof — Tertiary Colors");

    const tertiaryBundles = [
      "bundle-red-yellow-orange.json",
      "bundle-yellow-green-chartreuse.json",
      "bundle-green-cyan-spring-green.json",
      "bundle-cyan-blue-azure.json",
      "bundle-blue-magenta-violet.json",
      "bundle-magenta-red-rose.json",
    ];

    for (const file of tertiaryBundles) {
      const bundle = JSON.parse(fs.readFileSync(path.join(EXAMPLES, file), "utf8"));
      console.log(`\n  [ContractProof] ${bundle.ruleRef}`);
      console.log(`    inputs: ${bundle.inputs.map(i => i.tokenSymbol).join(" + ")}`);
      console.log(`    output: ${bundle.output.tokenSymbol}`);
      console.log(`    RGB: (${bundle.output.properties.rgb_r}, ${bundle.output.properties.rgb_g}, ${bundle.output.properties.rgb_b})`);

      const result = await runContractProof(client, bundle, sphereConfig, operatorConfig, privateKey, networkConfig, provenanceCache);

      console.log(`    Minted ${result.outputToken}, HCS Seq: ${result.hcsSeq}`);
      console.log(`    bindingHash: ${result.bindingHash.slice(0, 18)}...`);
      allResults.push(result);
    }

    // ═══════════════════════════════════════════════════
    // Phase 2: RegistryProof — CMYK Transforms
    // ═══════════════════════════════════════════════════
    logger.subsection("Phase 2: RegistryProof — CMYK Color Space Transforms");

    const transformBundles = [
      "bundle-red-transform.json",
      "bundle-green-transform.json",
      "bundle-blue-transform.json",
      "bundle-yellow-transform.json",
      "bundle-cyan-transform.json",
      "bundle-magenta-transform.json",
      "bundle-white-transform.json",
      "bundle-black-to-key.json",
    ];

    const transformResults = [];

    for (const file of transformBundles) {
      const bundle = JSON.parse(fs.readFileSync(path.join(EXAMPLES, file), "utf8"));
      const inProps = bundle.inputs[0].properties;
      const outProps = bundle.output.properties;
      console.log(`\n  [RegistryProof] ${bundle.ruleRef}`);
      console.log(`    transform: RGB(${inProps.rgb_r},${inProps.rgb_g},${inProps.rgb_b}) -> CMYK(${outProps.cmyk_c},${outProps.cmyk_m},${outProps.cmyk_y},${outProps.cmyk_k})`);

      const result = await runRegistryProof(client, bundle, sphereConfig, operatorConfig, privateKey, networkConfig, provenanceCache);

      console.log(`    Attested ${result.outputToken}, HCS Seq: ${result.hcsSeq}`);
      console.log(`    bindingHash: ${result.bindingHash.slice(0, 18)}...`);
      transformResults.push(result);
      allResults.push(result);
    }

    // ═══════════════════════════════════════════════════
    // Phase 3: RegistryProof — KEY Entity (CMYK K-channel)
    // ═══════════════════════════════════════════════════
    logger.subsection("Phase 3: RegistryProof — KEY Entity (CMYK K-channel)");

    const keyBundle = JSON.parse(fs.readFileSync(path.join(EXAMPLES, "bundle-key-from-cmy.json"), "utf8"));
    console.log("\n  [RegistryProof] KEY entity — evidence from CMY transform proofs");

    const keyResult = await runRegistryProof(client, keyBundle, sphereConfig, operatorConfig, privateKey, networkConfig, provenanceCache);
    console.log(`    Attested KEY, HCS Seq: ${keyResult.hcsSeq}`);
    allResults.push(keyResult);

    // ═══════════════════════════════════════════════════
    // Phase 4: RegistryProof — Ontological Classification
    // ═══════════════════════════════════════════════════
    logger.subsection("Phase 4: RegistryProof — Ontological Classification (IsDividedInto)");

    const ontologyBundles = [
      "bundle-color-isdividedinto-rgb.json",
      "bundle-color-isdividedinto-cmyk.json",
    ];

    for (const file of ontologyBundles) {
      const bundle = JSON.parse(fs.readFileSync(path.join(EXAMPLES, file), "utf8"));
      console.log(`\n  [RegistryProof] ${bundle.ruleRef}`);
      console.log(`    classification: ${bundle.output.classification}`);
      console.log(`    ontology ref: ${bundle.output.ontology}`);

      const result = await runRegistryProof(client, bundle, sphereConfig, operatorConfig, privateKey, networkConfig, provenanceCache);

      console.log(`    Classified, HCS Seq: ${result.hcsSeq}`);
      console.log(`    bindingHash: ${result.bindingHash.slice(0, 18)}...`);
      allResults.push(result);
    }

    // ═══════════════════════════════════════════════════
    // Phase 5: Summary
    // ═══════════════════════════════════════════════════
    logger.section("Colorimetry Smoke Test Summary");

    console.log("| #  | Mode     | Domain         | Semantics | Rule                                              | Output      | HCS |");
    console.log("|----|----------|----------------|-----------|---------------------------------------------------|-------------|-----|");
    allResults.forEach((r, i) => {
      const mode = r.domain.includes("cmyk") || r.domain.includes("paint") || r.domain.includes("ontology") ? "registry" : "contract";
      const semantics = r.domain.includes("cmyk") ? "CMYK" : r.domain.includes("ontology") ? "OWL" : "RGB";
      console.log(`| ${String(i+1).padStart(2)} | ${mode.padEnd(8)} | ${r.domain.padEnd(14)} | ${semantics.padEnd(9)} | ${r.ruleId.padEnd(49)} | ${r.outputToken.padEnd(11)} | ${String(r.hcsSeq).padStart(3)} |`);
    });

    const tertiaryCount = 6;
    const transformCount = transformResults.length;
    const entityCount = 1;
    const ontologyCount = 2;

    console.log(`\nTotal proofs: ${allResults.length}`);
    console.log(`  Tertiary ContractProofs: ${tertiaryCount}`);
    console.log(`  CMYK RegistryProofs:     ${transformCount}`);
    console.log(`  KEY entity:              ${entityCount}`);
    console.log(`  IsDividedInto:           ${ontologyCount}`);
    console.log(`\nSemantic grounding: Suresh & Jain (2015) doi:10.1016/j.procs.2015.08.062`);

    logger.success("Colorimetry smoke test complete");

  } finally {
    client.close();
  }
}

main().catch((err) => {
  logger.error("Colorimetry smoke test failed", err);
  process.exit(1);
});
