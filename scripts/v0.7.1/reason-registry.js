#!/usr/bin/env node

/**
 * @fileoverview RegistryProof execution — three-layer triune proof via alteration
 * @module scripts/v0.7.1/reason-registry
 *
 * Three layers (all fire):
 *   1. Peirce (logic)    — resolve rule + compute hashes
 *   2. Floridi (meaning) — submit MorphemeProof to HCS PROOF_TOPIC
 *   3. Tarski (material) — stamp output token metadata with provenance
 *
 * Hard invariant: HCS anchor BEFORE metadata stamp. Always.
 *
 * Usage:
 *   node scripts/v0.7.1/reason-registry.js <bundlePath> [--sphere <name>] [--dry-run]
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
import { fetchProvenanceState, buildProvenanceEntry, stampProvenance } from "./lib/metadata.js";
import * as logger from "../v0.6.3/lib/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Build MorphemeProof for RegistryProof mode
 */
function buildMorphemeProof(params) {
  return {
    schema: "hcs.ontologic.morphemeProof",
    schemaVersion: "0.8",
    proofMode: "registry",
    ruleId: params.ruleId,
    ruleUri: params.ruleUri,
    ruleUriHash: params.ruleUriHash,
    inputsHash: params.inputsHash,
    outputsHash: params.outputsHash,
    bindingHash: params.bindingHash,
    reasoningContractId: null,
    callerAccountId: params.callerAccountId,
    transactionId: null,
    network: params.network || "hedera-testnet",
    createdAt: new Date().toISOString(),
  };
}

/**
 * Submit MorphemeProof to HCS PROOF_TOPIC
 */
async function submitProof(client, topicId, proof, submitKey) {
  const canonical = canonicalizeJSON(proof);

  const submitTx = await new TopicMessageSubmitTransaction()
    .setTopicId(topicId)
    .setMessage(Buffer.from(canonical, "utf8"))
    .freezeWith(client);

  const signedTx = await submitTx.sign(submitKey);
  const txResponse = await signedTx.execute(client);
  const receipt = await txResponse.getReceipt(client);
  const record = await txResponse.getRecord(client);

  const consensusTimestamp = `${record.consensusTimestamp.seconds}.${record.consensusTimestamp.nanos.toString().padStart(9, "0")}`;

  return {
    sequenceNumber: receipt.topicSequenceNumber.toString(),
    consensusTimestamp,
    proofHash: hashCanonicalJSON(proof),
  };
}

async function main() {
  const args = process.argv.slice(2);

  const getArgValue = (flag) => {
    const idx = args.indexOf(flag);
    return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
  };

  const bundlePath = args.find((a) => !a.startsWith("--") && a !== getArgValue("--sphere"));
  const sphereName = getArgValue("--sphere") || "v08";
  const dryRun = args.includes("--dry-run");

  if (!bundlePath) {
    console.error("Usage: node reason-registry.js <bundlePath> [--sphere <name>] [--dry-run]");
    process.exit(1);
  }

  logger.section("v0.8 RegistryProof Reasoning");
  console.log(`Bundle Path: ${bundlePath}`);
  console.log(`Sphere: ${sphereName}`);
  console.log(`Dry Run: ${dryRun}`);

  // Load bundle
  const fullPath = path.isAbsolute(bundlePath) ? bundlePath : path.join(process.cwd(), bundlePath);
  const bundle = JSON.parse(fs.readFileSync(fullPath, "utf8"));

  console.log(`\nBundle loaded:`);
  console.log(`  inputs: ${bundle.inputs.length} items`);
  console.log(`  output: ${bundle.output.tokenSymbol}`);

  // Load configs
  const sphereConfig = loadSphereConfig(sphereName);
  const operatorConfig = getOperatorConfig();
  const networkConfig = getNetworkConfig();

  console.log(`\nContract: ${sphereConfig.contractId} (not called — RegistryProof mode)`);

  // Auto-resolve evidence if bundle has null bindingHash fields (entity bundles)
  if (bundle.inputs?.[0]?.proofs?.some(p => p.bindingHash === null)) {
    console.log("\nAuto-resolving evidence from PROOF_TOPIC...");
    await resolveEvidence(bundle, sphereConfig.proofTopicId, { mirrorNodeUrl: networkConfig.mirrorNodeUrl });
    for (const p of bundle.inputs[0].proofs) {
      console.log(`  ${p.ruleId} → bindingHash=${p.bindingHash.slice(0, 18)}..., hcsSeq=${p.hcsSeq}`);
    }
  }

  // ─── Layer 1: Peirce (Logic) ───
  // Resolve rule and compute hashes

  const ruleRef = bundle.ruleRef;
  console.log(`\nResolving rule: ${ruleRef}`);

  const { ruleDef, ruleUri, ruleUriHash } = await resolveRule(
    ruleRef,
    sphereConfig,
    { mirrorNodeUrl: networkConfig.mirrorNodeUrl }
  );

  console.log(`  Resolved to: ${ruleUri}`);
  console.log(`  ruleUriHash: ${ruleUriHash}`);
  console.log(`  domain: ${ruleDef.domain}`);

  // Compute hashes (identical to ContractProof — critical invariant)
  const inputsHash = ethers.keccak256(ethers.toUtf8Bytes(canonicalizeJSON(bundle.inputs)));
  const outputsHash = ethers.keccak256(ethers.toUtf8Bytes(canonicalizeJSON(bundle.output)));
  const bindingHash = ethers.keccak256(
    ethers.toUtf8Bytes(canonicalizeJSON({ ruleUri, inputsHash, outputsHash }))
  );

  console.log(`\ninputsHash: ${inputsHash}`);
  console.log(`outputsHash: ${outputsHash}`);
  console.log(`bindingHash: ${bindingHash}`);

  if (dryRun) {
    logger.subsection("DRY RUN — Would execute:");
    console.log("  1. [Peirce]  Rule resolved, hashes computed ✓");
    console.log(`  2. [Floridi] Submit MorphemeProof to PROOF_TOPIC (${sphereConfig.proofTopicId})`);
    console.log(`  3. [Tarski]  Stamp ${bundle.output.tokenSymbol} (${bundle.output.tokenId}) metadata`);
    console.log(`\n  proofMode: registry`);
    console.log(`  No contract call. No minting.`);
    return;
  }

  // Initialize client
  const privateKey = PrivateKey.fromString(operatorConfig.derKey);
  const client = Client.forTestnet().setOperator(operatorConfig.id, privateKey);

  try {
    // ─── Layer 2: Floridi (Meaning) ───
    // Submit MorphemeProof to HCS — MUST happen BEFORE metadata stamp

    console.log("\n1. [Floridi] Submitting MorphemeProof to HCS...");

    const proof = buildMorphemeProof({
      ruleId: ruleDef.ruleId,
      ruleUri,
      ruleUriHash,
      inputsHash,
      outputsHash,
      bindingHash,
      callerAccountId: operatorConfig.id,
    });

    const proofResult = await submitProof(
      client,
      sphereConfig.proofTopicId,
      proof,
      privateKey
    );

    const proofUri = buildHcsUri(sphereConfig.proofTopicId, proofResult.consensusTimestamp);

    console.log(`   HCS Seq: ${proofResult.sequenceNumber}`);
    console.log(`   proofUri: ${proofUri}`);
    console.log(`   proofHash: ${proofResult.proofHash}`);

    // ─── Layer 3: Tarski (Material) ───
    // Stamp output token metadata — alteration, not creation

    console.log(`\n2. [Tarski] Stamping ${bundle.output.tokenSymbol} metadata...`);

    const state = await fetchProvenanceState(
      networkConfig.mirrorNodeUrl,
      bundle.output.tokenId
    );

    const entry = buildProvenanceEntry({
      bindingHash,
      domain: ruleDef.domain,
      ruleId: ruleDef.ruleId,
      proofUri,
      proofMode: "registry",
    });

    const stampResult = await stampProvenance(
      client, bundle.output.tokenId, state, entry, privateKey
    );

    console.log(`   Metadata stamp: ${stampResult.status}`);
    console.log(`   Provenance: n=${stampResult.n}, root=${stampResult.root.slice(0, 18)}...`);

    // ─── Summary ───

    logger.section("RegistryProof Complete");
    logger.table({
      "Rule": ruleDef.ruleId,
      "Domain": ruleDef.domain,
      "proofMode": "registry",
      "bindingHash": bindingHash,
      "proofUri": proofUri,
      "HCS Seq": proofResult.sequenceNumber,
      "Token Stamped": `${bundle.output.tokenSymbol} (${bundle.output.tokenId})`,
      "Provenance Count": stampResult.n.toString(),
    });

  } finally {
    client.close();
  }
}

main().catch((err) => {
  logger.error("RegistryProof reasoning failed", err);
  process.exit(1);
});
