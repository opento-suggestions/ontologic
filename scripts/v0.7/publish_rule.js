#!/usr/bin/env node

/**
 * @fileoverview Publish a RuleDef to HCS
 * @module scripts/v07/publish_rule
 *
 * Submits a RuleDef JSON to the RULE_DEFS_TOPIC and optionally
 * creates a RuleRegistryEntry in the RULE_REGISTRY_TOPIC.
 *
 * Usage:
 *   node scripts/v07/publish_rule.js <ruleDefPath> [--sphere <name>] [--register]
 *
 * Options:
 *   --sphere <name>  Sphere name (default: "demo")
 *   --register       Also create a RuleRegistryEntry
 *   --dry-run        Print what would be done without executing
 */

import {
  Client,
  PrivateKey,
  TopicMessageSubmitTransaction
} from "@hashgraph/sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ethers } from "ethers";
import { getOperatorConfig } from "../v0.6.3/lib/config.js";
import { canonicalizeJSON } from "../v0.6.3/lib/canonicalize.js";
import { loadSphereConfig } from "./lib/sphere-config.js";
import { buildHcsUri, computeRuleUriHash } from "./lib/resolve.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Submit RuleDef to HCS topic
 * @param {Client} client - Hedera SDK client
 * @param {string} topicId - HCS topic ID
 * @param {Object} ruleDef - RuleDef object
 * @param {PrivateKey} submitKey - Key for topic submission
 * @returns {Promise<{ruleUri: string, consensusTimestamp: string, sequenceNumber: string}>}
 */
async function submitRuleDef(client, topicId, ruleDef, submitKey) {
  // Canonicalize the RuleDef (without ruleUri/hashes which we don't know yet)
  const preSubmit = { ...ruleDef };
  delete preSubmit.ruleUri;
  delete preSubmit.ruleUriHash;
  delete preSubmit.contentHash;

  const canonical = canonicalizeJSON(preSubmit);

  // Submit to HCS
  const submitTx = await new TopicMessageSubmitTransaction()
    .setTopicId(topicId)
    .setMessage(Buffer.from(canonical, "utf8"))
    .freezeWith(client);

  const signedTx = await submitTx.sign(submitKey);
  const txResponse = await signedTx.execute(client);
  const receipt = await txResponse.getReceipt(client);
  const record = await txResponse.getRecord(client);

  const consensusTimestamp = `${record.consensusTimestamp.seconds}.${record.consensusTimestamp.nanos.toString().padStart(9, "0")}`;
  const sequenceNumber = receipt.topicSequenceNumber.toString();

  // Build the ruleUri from the consensus timestamp
  const ruleUri = buildHcsUri(topicId, consensusTimestamp);

  return { ruleUri, consensusTimestamp, sequenceNumber };
}

/**
 * Create RuleRegistryEntry and submit to registry topic
 * @param {Client} client - Hedera SDK client
 * @param {Object} config - Sphere configuration
 * @param {Object} ruleDef - Original RuleDef
 * @param {string} ruleUri - Published ruleUri
 * @param {PrivateKey} submitKey - Key for topic submission
 * @returns {Promise<{sequenceNumber: string}>}
 */
async function createRegistryEntry(client, config, ruleDef, ruleUri, submitKey) {
  const ruleUriHash = computeRuleUriHash(ruleUri);

  const entry = {
    schema: "hcs.ontologic.ruleRegistryEntry",
    schemaVersion: "1",
    ruleId: ruleDef.ruleId,
    version: ruleDef.version,
    versionNumber: ruleDef.versionNumber,
    ruleUri: ruleUri,
    ruleUriHash: ruleUriHash,
    status: "active",
    isLatest: true,
    supersededBy: null,
    createdAt: new Date().toISOString()
  };

  const canonical = canonicalizeJSON(entry);

  const submitTx = await new TopicMessageSubmitTransaction()
    .setTopicId(config.ruleRegistryTopicId)
    .setMessage(Buffer.from(canonical, "utf8"))
    .freezeWith(client);

  const signedTx = await submitTx.sign(submitKey);
  const txResponse = await signedTx.execute(client);
  const receipt = await txResponse.getReceipt(client);

  return { sequenceNumber: receipt.topicSequenceNumber.toString() };
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  const ruleDefPath = args.find((a) => !a.startsWith("--") && a !== args[args.indexOf("--sphere") + 1]);
  const sphereIndex = args.indexOf("--sphere");
  const sphereName = sphereIndex !== -1 ? args[sphereIndex + 1] : "demo";
  const doRegister = args.includes("--register");
  const dryRun = args.includes("--dry-run");

  if (!ruleDefPath) {
    console.error("Usage: node publish_rule.js <ruleDefPath> [--sphere <name>] [--register]");
    process.exit(1);
  }

  console.log("=".repeat(60));
  console.log("Ontologic v0.7 Publish Rule");
  console.log("=".repeat(60));
  console.log(`RuleDef Path: ${ruleDefPath}`);
  console.log(`Sphere: ${sphereName}`);
  console.log(`Register: ${doRegister}`);
  console.log(`Dry Run: ${dryRun}`);

  // Load RuleDef
  const ruleDefFullPath = path.isAbsolute(ruleDefPath) ? ruleDefPath : path.join(process.cwd(), ruleDefPath);
  if (!fs.existsSync(ruleDefFullPath)) {
    console.error(`RuleDef file not found: ${ruleDefFullPath}`);
    process.exit(1);
  }

  const ruleDef = JSON.parse(fs.readFileSync(ruleDefFullPath, "utf8"));
  console.log(`\nRuleDef loaded:`);
  console.log(`  ruleId: ${ruleDef.ruleId}`);
  console.log(`  version: ${ruleDef.version}`);
  console.log(`  domain: ${ruleDef.domain}`);
  console.log(`  operator: ${ruleDef.operator}`);

  // Load sphere config
  const config = loadSphereConfig(sphereName);
  console.log(`\nSphere config loaded:`);
  console.log(`  RULE_DEFS_TOPIC: ${config.ruleDefsTopicId}`);
  console.log(`  RULE_REGISTRY_TOPIC: ${config.ruleRegistryTopicId}`);

  if (dryRun) {
    console.log("\n[DRY RUN] Would submit:");
    console.log(`  - RuleDef to topic ${config.ruleDefsTopicId}`);
    if (doRegister) {
      console.log(`  - RuleRegistryEntry to topic ${config.ruleRegistryTopicId}`);
    }

    // Show canonical form
    const preSubmit = { ...ruleDef };
    delete preSubmit.ruleUri;
    delete preSubmit.ruleUriHash;
    delete preSubmit.contentHash;
    console.log("\nCanonical RuleDef:");
    console.log(canonicalizeJSON(preSubmit));
    return;
  }

  // Initialize client
  const operatorConfig = getOperatorConfig();
  const privateKey = PrivateKey.fromStringDer(operatorConfig.derKey);
  const client = Client.forTestnet().setOperator(operatorConfig.id, privateKey);

  try {
    // Enhance RuleDef with metadata
    const enhancedRuleDef = {
      ...ruleDef,
      createdAt: new Date().toISOString(),
      author: operatorConfig.id,
      status: "active"
    };

    // Submit RuleDef
    console.log("\nSubmitting RuleDef to HCS...");
    const { ruleUri, consensusTimestamp, sequenceNumber } = await submitRuleDef(
      client,
      config.ruleDefsTopicId,
      enhancedRuleDef,
      privateKey
    );

    // Compute hashes
    const ruleUriHash = computeRuleUriHash(ruleUri);

    // Compute contentHash (of pre-submission canonical form)
    const preSubmit = { ...enhancedRuleDef };
    delete preSubmit.ruleUri;
    delete preSubmit.ruleUriHash;
    delete preSubmit.contentHash;
    const contentHash = ethers.keccak256(ethers.toUtf8Bytes(canonicalizeJSON(preSubmit)));

    console.log("\nRuleDef Published:");
    console.log(`  ruleUri: ${ruleUri}`);
    console.log(`  ruleUriHash: ${ruleUriHash}`);
    console.log(`  contentHash: ${contentHash}`);
    console.log(`  HCS Sequence: ${sequenceNumber}`);
    console.log(`  Consensus Timestamp: ${consensusTimestamp}`);

    // Create registry entry if requested
    if (doRegister) {
      console.log("\nCreating RuleRegistryEntry...");
      const { sequenceNumber: registrySeq } = await createRegistryEntry(
        client,
        config,
        enhancedRuleDef,
        ruleUri,
        privateKey
      );
      console.log(`  Registry Sequence: ${registrySeq}`);
    }

    // Print summary for copy/paste
    console.log("\n" + "=".repeat(60));
    console.log("Summary (copy/paste values):");
    console.log("=".repeat(60));
    console.log(`RULE_URI="${ruleUri}"`);
    console.log(`RULE_URI_HASH="${ruleUriHash}"`);
    console.log(`CONTENT_HASH="${contentHash}"`);

  } finally {
    client.close();
  }
}

main().catch((err) => {
  console.error("\nError:", err.message);
  process.exit(1);
});
