#!/usr/bin/env node

/**
 * @fileoverview Execute v0.7 reasoning with rule reference
 * @module scripts/v07/reason
 *
 * Full v0.7 reasoning flow:
 * 1. Resolve rule (ruleId → ruleUri → RuleDef)
 * 2. Build inputs/outputs JSON
 * 3. Compute hashes (inputsHash, outputsHash, bindingHash)
 * 4. Call prepareReasoning (optional)
 * 5. Call reasonWithMint (or reason for log-only)
 * 6. Submit MorphemeProof to PROOF_TOPIC
 *
 * Usage:
 *   node scripts/v07/reason.js <bundlePath> [--rule <ruleRef>] [--sphere <name>]
 *
 * Options:
 *   --rule <ref>     Rule reference (ruleId or ruleUri). If not provided, read from bundle.
 *   --sphere <name>  Sphere name (default: "demo")
 *   --no-mint        Skip minting (log-only mode)
 *   --no-prepare     Skip prepareReasoning step
 *   --dry-run        Print what would be done without executing
 */

import {
  Client,
  PrivateKey,
  ContractExecuteTransaction,
  ContractId,
  TopicMessageSubmitTransaction
} from "@hashgraph/sdk";
import { Interface } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ethers } from "ethers";
import { getOperatorConfig } from "../v0.6.3/lib/config.js";
import { canonicalizeJSON, hashCanonicalJSON } from "../v0.6.3/lib/canonicalize.js";
import { loadSphereConfig, requireContract } from "./lib/sphere-config.js";
import { resolveRule, computeRuleUriHash } from "./lib/resolve.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Contract ABI fragments for v0.7 functions
const V07_ABI = [
  "function prepareReasoning(string ruleUri, bytes32 ruleUriHash, bytes32 inputsHash)",
  "function reason(string ruleUri, bytes32 ruleUriHash, bytes32 inputsHash, bytes32 outputsHash, bytes32 bindingHash) returns (bool)",
  "function reasonWithMint(string ruleUri, bytes32 ruleUriHash, bytes32 inputsHash, bytes32 outputsHash, bytes32 bindingHash, address outputToken, uint64 amount) returns (bool)"
];

/**
 * Build MorphemeProof v0.7 structure
 * @param {Object} params - Proof parameters
 * @returns {Object} MorphemeProof object
 */
function buildMorphemeProof(params) {
  return {
    schema: "hcs.ontologic.morphemeProof",
    schemaVersion: "0.7",
    ruleId: params.ruleId,
    ruleUri: params.ruleUri,
    ruleUriHash: params.ruleUriHash,
    ruleSchemaRef: params.ruleSchemaRef || null,
    inputsHash: params.inputsHash,
    outputsHash: params.outputsHash,
    bindingHash: params.bindingHash,
    reasoningContractId: params.contractId,
    callerAccountId: params.callerAccountId,
    network: params.network || "hedera-testnet",
    transactionId: params.transactionId || null,
    createdAt: new Date().toISOString()
  };
}

/**
 * Call prepareReasoning on contract
 */
async function callPrepareReasoning(client, contractId, ruleUri, ruleUriHash, inputsHash) {
  const iface = new Interface(V07_ABI);
  const data = iface.encodeFunctionData("prepareReasoning", [ruleUri, ruleUriHash, inputsHash]);

  const tx = await new ContractExecuteTransaction()
    .setContractId(ContractId.fromString(contractId))
    .setGas(150000)
    .setFunctionParameters(Buffer.from(data.slice(2), "hex"))
    .execute(client);

  const receipt = await tx.getReceipt(client);
  return { transactionId: tx.transactionId.toString(), status: receipt.status.toString() };
}

/**
 * Call reason (log-only) on contract
 */
async function callReason(client, contractId, params) {
  const iface = new Interface(V07_ABI);
  const data = iface.encodeFunctionData("reason", [
    params.ruleUri,
    params.ruleUriHash,
    params.inputsHash,
    params.outputsHash,
    params.bindingHash
  ]);

  const tx = await new ContractExecuteTransaction()
    .setContractId(ContractId.fromString(contractId))
    .setGas(200000)
    .setFunctionParameters(Buffer.from(data.slice(2), "hex"))
    .execute(client);

  const receipt = await tx.getReceipt(client);
  return { transactionId: tx.transactionId.toString(), status: receipt.status.toString() };
}

/**
 * Call reasonWithMint on contract
 */
async function callReasonWithMint(client, contractId, params) {
  const iface = new Interface(V07_ABI);
  const data = iface.encodeFunctionData("reasonWithMint", [
    params.ruleUri,
    params.ruleUriHash,
    params.inputsHash,
    params.outputsHash,
    params.bindingHash,
    params.outputToken,
    BigInt(params.amount)
  ]);

  const tx = await new ContractExecuteTransaction()
    .setContractId(ContractId.fromString(contractId))
    .setGas(300000)
    .setFunctionParameters(Buffer.from(data.slice(2), "hex"))
    .execute(client);

  const receipt = await tx.getReceipt(client);
  return { transactionId: tx.transactionId.toString(), status: receipt.status.toString() };
}

/**
 * Submit MorphemeProof to HCS
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
    proofHash: hashCanonicalJSON(proof)
  };
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  const getArgValue = (flag) => {
    const idx = args.indexOf(flag);
    return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
  };

  const ruleArgValue = getArgValue("--rule");
  const sphereArgValue = getArgValue("--sphere");

  const bundlePath = args.find((a) =>
    !a.startsWith("--") &&
    a !== ruleArgValue &&
    a !== sphereArgValue
  );

  const ruleRef = ruleArgValue;
  const sphereName = sphereArgValue || "demo";
  const noMint = args.includes("--no-mint");
  const noPrepare = args.includes("--no-prepare");
  const dryRun = args.includes("--dry-run");

  if (!bundlePath) {
    console.error("Usage: node reason.js <bundlePath> [--rule <ruleRef>] [--sphere <name>]");
    process.exit(1);
  }

  console.log("=".repeat(60));
  console.log("Ontologic v0.7 Reasoning");
  console.log("=".repeat(60));
  console.log(`Bundle Path: ${bundlePath}`);
  console.log(`Sphere: ${sphereName}`);
  console.log(`No Mint: ${noMint}`);
  console.log(`No Prepare: ${noPrepare}`);
  console.log(`Dry Run: ${dryRun}`);

  // Load bundle
  const bundleFullPath = path.isAbsolute(bundlePath) ? bundlePath : path.join(process.cwd(), bundlePath);
  if (!fs.existsSync(bundleFullPath)) {
    console.error(`Bundle file not found: ${bundleFullPath}`);
    process.exit(1);
  }

  const bundle = JSON.parse(fs.readFileSync(bundleFullPath, "utf8"));
  console.log("\nBundle loaded:");
  console.log(`  inputs: ${bundle.inputs?.length || 0} items`);
  console.log(`  output: ${bundle.output?.tokenSymbol || "(none)"}`);

  // Load sphere config
  const config = loadSphereConfig(sphereName);
  requireContract(config);
  console.log(`\nContract: ${config.contractId}`);

  // Resolve rule
  const effectiveRuleRef = ruleRef || bundle.ruleRef || bundle.ruleId;
  if (!effectiveRuleRef) {
    console.error("Error: No rule reference provided (use --rule or include ruleRef in bundle)");
    process.exit(1);
  }

  console.log(`\nResolving rule: ${effectiveRuleRef}`);
  const { ruleDef, ruleUri, ruleUriHash } = await resolveRule(effectiveRuleRef, config);
  console.log(`  Resolved to: ${ruleUri}`);
  console.log(`  ruleUriHash: ${ruleUriHash}`);

  // Compute inputsHash
  const inputsCanonical = canonicalizeJSON(bundle.inputs);
  const inputsHash = ethers.keccak256(ethers.toUtf8Bytes(inputsCanonical));
  console.log(`\ninputsHash: ${inputsHash}`);

  // Compute outputsHash
  const outputsCanonical = canonicalizeJSON(bundle.output);
  const outputsHash = ethers.keccak256(ethers.toUtf8Bytes(outputsCanonical));
  console.log(`outputsHash: ${outputsHash}`);

  // Compute bindingHash
  const bindingPayload = { ruleUri, inputsHash, outputsHash };
  const bindingCanonical = canonicalizeJSON(bindingPayload);
  const bindingHash = ethers.keccak256(ethers.toUtf8Bytes(bindingCanonical));
  console.log(`bindingHash: ${bindingHash}`);

  if (dryRun) {
    console.log("\n[DRY RUN] Would execute:");
    if (!noPrepare) {
      console.log("  1. prepareReasoning(ruleUri, ruleUriHash, inputsHash)");
    }
    if (noMint) {
      console.log("  2. reason(ruleUri, ruleUriHash, inputsHash, outputsHash, bindingHash)");
    } else {
      console.log(`  2. reasonWithMint(..., ${bundle.output?.tokenAddr}, ${bundle.output?.amount || 1})`);
    }
    console.log("  3. Submit MorphemeProof to PROOF_TOPIC");

    // Show proof preview
    const proofPreview = buildMorphemeProof({
      ruleId: ruleDef.ruleId,
      ruleUri,
      ruleUriHash,
      inputsHash,
      outputsHash,
      bindingHash,
      contractId: config.contractId,
      callerAccountId: "0.0.OPERATOR"
    });
    console.log("\nMorphemeProof preview:");
    console.log(JSON.stringify(proofPreview, null, 2));
    return;
  }

  // Initialize client
  const operatorConfig = getOperatorConfig();
  const privateKey = PrivateKey.fromStringDer(operatorConfig.derKey);
  const client = Client.forTestnet().setOperator(operatorConfig.id, privateKey);

  try {
    let transactionId;

    // Step 1: prepareReasoning (optional)
    if (!noPrepare) {
      console.log("\n1. Calling prepareReasoning...");
      const prepareResult = await callPrepareReasoning(
        client,
        config.contractId,
        ruleUri,
        ruleUriHash,
        inputsHash
      );
      console.log(`   Status: ${prepareResult.status}`);
      console.log(`   TX: ${prepareResult.transactionId}`);
    }

    // Step 2: reason or reasonWithMint
    if (noMint) {
      console.log("\n2. Calling reason (log-only)...");
      const reasonResult = await callReason(client, config.contractId, {
        ruleUri,
        ruleUriHash,
        inputsHash,
        outputsHash,
        bindingHash
      });
      console.log(`   Status: ${reasonResult.status}`);
      console.log(`   TX: ${reasonResult.transactionId}`);
      transactionId = reasonResult.transactionId;
    } else {
      console.log("\n2. Calling reasonWithMint...");
      const mintResult = await callReasonWithMint(client, config.contractId, {
        ruleUri,
        ruleUriHash,
        inputsHash,
        outputsHash,
        bindingHash,
        outputToken: bundle.output.tokenAddr,
        amount: bundle.output.amount || 1
      });
      console.log(`   Status: ${mintResult.status}`);
      console.log(`   TX: ${mintResult.transactionId}`);
      transactionId = mintResult.transactionId;
    }

    // Step 3: Submit MorphemeProof to HCS
    console.log("\n3. Submitting MorphemeProof to HCS...");
    const proof = buildMorphemeProof({
      ruleId: ruleDef.ruleId,
      ruleUri,
      ruleUriHash,
      inputsHash,
      outputsHash,
      bindingHash,
      contractId: config.contractId,
      callerAccountId: operatorConfig.id,
      transactionId
    });

    const proofResult = await submitProof(client, config.proofTopicId, proof, privateKey);
    console.log(`   HCS Sequence: ${proofResult.sequenceNumber}`);
    console.log(`   Consensus Timestamp: ${proofResult.consensusTimestamp}`);
    console.log(`   Proof Hash: ${proofResult.proofHash}`);

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("Reasoning Complete");
    console.log("=".repeat(60));
    console.log(`Rule: ${ruleDef.ruleId}`);
    console.log(`ruleUri: ${ruleUri}`);
    console.log(`bindingHash: ${bindingHash}`);
    console.log(`Contract TX: ${transactionId}`);
    console.log(`Proof HCS Seq: ${proofResult.sequenceNumber}`);
    if (!noMint) {
      console.log(`Minted: ${bundle.output.amount || 1} ${bundle.output.tokenSymbol}`);
    }

  } finally {
    client.close();
  }
}

main().catch((err) => {
  console.error("\nError:", err.message);
  process.exit(1);
});
