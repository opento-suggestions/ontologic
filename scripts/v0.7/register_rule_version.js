#!/usr/bin/env node

/**
 * @fileoverview Register a rule version in the registry
 * @module scripts/v07/register_rule_version
 *
 * Creates a RuleRegistryEntry pointing to an existing RuleDef.
 * Used for version management and "latest" resolution.
 *
 * Usage:
 *   node scripts/v07/register_rule_version.js <ruleUri> --rule-id <ruleId> --version <version> [--sphere <name>]
 *
 * Options:
 *   --rule-id <id>      Rule identifier (e.g., "sphere://demo/light/red-green-yellow")
 *   --version <ver>     Semantic version (e.g., "1.0.0")
 *   --version-num <n>   Version number for ordering (default: auto from version)
 *   --sphere <name>     Sphere name (default: "demo")
 *   --is-latest         Mark this as the latest version (default: true)
 *   --supersedes <uri>  Previous version's ruleUri this supersedes
 *   --dry-run           Print what would be done without executing
 */

import {
  Client,
  PrivateKey,
  TopicMessageSubmitTransaction
} from "@hashgraph/sdk";
import { getOperatorConfig } from "../v0.6.3/lib/config.js";
import { canonicalizeJSON } from "../v0.6.3/lib/canonicalize.js";
import { loadSphereConfig } from "./lib/sphere-config.js";
import { computeRuleUriHash, resolveRuleDef } from "./lib/resolve.js";

/**
 * Parse semantic version to version number
 * @param {string} version - Semantic version (e.g., "1.2.3")
 * @returns {number} Version number (e.g., 10203)
 */
function parseVersionNumber(version) {
  const parts = version.split(".").map((p) => parseInt(p, 10) || 0);
  const [major = 0, minor = 0, patch = 0] = parts;
  return major * 10000 + minor * 100 + patch;
}

/**
 * Create and submit RuleRegistryEntry
 * @param {Client} client - Hedera SDK client
 * @param {Object} config - Sphere configuration
 * @param {Object} params - Entry parameters
 * @param {PrivateKey} submitKey - Key for topic submission
 * @returns {Promise<{sequenceNumber: string, consensusTimestamp: string}>}
 */
async function submitRegistryEntry(client, config, params, submitKey) {
  const entry = {
    schema: "hcs.ontologic.ruleRegistryEntry",
    schemaVersion: "1",
    ruleId: params.ruleId,
    version: params.version,
    versionNumber: params.versionNumber,
    ruleUri: params.ruleUri,
    ruleUriHash: params.ruleUriHash,
    status: "active",
    isLatest: params.isLatest,
    supersededBy: params.supersededBy || null,
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
  const record = await txResponse.getRecord(client);

  const consensusTimestamp = `${record.consensusTimestamp.seconds}.${record.consensusTimestamp.nanos.toString().padStart(9, "0")}`;

  return {
    sequenceNumber: receipt.topicSequenceNumber.toString(),
    consensusTimestamp
  };
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);

  // Parse positional argument (ruleUri)
  const ruleUri = args.find((a) => a.startsWith("hcs://"));

  // Parse named arguments
  const getArg = (flag) => {
    const idx = args.indexOf(flag);
    return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
  };

  const ruleId = getArg("--rule-id");
  const version = getArg("--version");
  const versionNumArg = getArg("--version-num");
  const sphereName = getArg("--sphere") || "demo";
  const supersedes = getArg("--supersedes");
  const isLatest = !args.includes("--not-latest");
  const dryRun = args.includes("--dry-run");

  // Validate required arguments
  if (!ruleUri) {
    console.error("Error: ruleUri is required (e.g., hcs://0.0.12345/1763200000.000000000)");
    console.error("\nUsage: node register_rule_version.js <ruleUri> --rule-id <id> --version <ver>");
    process.exit(1);
  }

  if (!ruleId || !version) {
    console.error("Error: --rule-id and --version are required");
    console.error("\nUsage: node register_rule_version.js <ruleUri> --rule-id <id> --version <ver>");
    process.exit(1);
  }

  const versionNumber = versionNumArg ? parseInt(versionNumArg, 10) : parseVersionNumber(version);

  console.log("=".repeat(60));
  console.log("Ontologic v0.7 Register Rule Version");
  console.log("=".repeat(60));
  console.log(`ruleUri: ${ruleUri}`);
  console.log(`ruleId: ${ruleId}`);
  console.log(`version: ${version}`);
  console.log(`versionNumber: ${versionNumber}`);
  console.log(`sphere: ${sphereName}`);
  console.log(`isLatest: ${isLatest}`);
  console.log(`supersedes: ${supersedes || "(none)"}`);
  console.log(`dryRun: ${dryRun}`);

  // Load sphere config
  const config = loadSphereConfig(sphereName);
  console.log(`\nRegistry Topic: ${config.ruleRegistryTopicId}`);

  // Compute hashes
  const ruleUriHash = computeRuleUriHash(ruleUri);
  console.log(`ruleUriHash: ${ruleUriHash}`);

  // Optionally verify the RuleDef exists
  console.log("\nVerifying RuleDef exists...");
  try {
    const ruleDef = await resolveRuleDef(ruleUri, { skipVerification: true });
    console.log(`  Found: ${ruleDef.ruleId} @ ${ruleDef.version || "(no version)"}`);

    // Warn if ruleId doesn't match
    if (ruleDef.ruleId && ruleDef.ruleId !== ruleId) {
      console.warn(`  WARNING: RuleDef ruleId (${ruleDef.ruleId}) differs from provided (${ruleId})`);
    }
  } catch (err) {
    console.warn(`  Warning: Could not verify RuleDef: ${err.message}`);
    console.warn("  Proceeding anyway (registry entry will be created)");
  }

  if (dryRun) {
    console.log("\n[DRY RUN] Would create RuleRegistryEntry:");
    const entry = {
      schema: "hcs.ontologic.ruleRegistryEntry",
      schemaVersion: "1",
      ruleId,
      version,
      versionNumber,
      ruleUri,
      ruleUriHash,
      status: "active",
      isLatest,
      supersededBy: supersedes || null
    };
    console.log(JSON.stringify(entry, null, 2));
    return;
  }

  // Initialize client
  const operatorConfig = getOperatorConfig();
  const privateKey = PrivateKey.fromStringDer(operatorConfig.derKey);
  const client = Client.forTestnet().setOperator(operatorConfig.id, privateKey);

  try {
    console.log("\nSubmitting RuleRegistryEntry...");
    const result = await submitRegistryEntry(
      client,
      config,
      {
        ruleId,
        version,
        versionNumber,
        ruleUri,
        ruleUriHash,
        isLatest,
        supersededBy: supersedes
      },
      privateKey
    );

    console.log("\n" + "=".repeat(60));
    console.log("RuleRegistryEntry Created");
    console.log("=".repeat(60));
    console.log(`HCS Sequence: ${result.sequenceNumber}`);
    console.log(`Consensus Timestamp: ${result.consensusTimestamp}`);
    console.log(`ruleId: ${ruleId}`);
    console.log(`version: ${version}`);
    console.log(`ruleUri: ${ruleUri}`);

  } finally {
    client.close();
  }
}

main().catch((err) => {
  console.error("\nError:", err.message);
  process.exit(1);
});
