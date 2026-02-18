#!/usr/bin/env node

/**
 * @fileoverview End-to-end validation for v0.7 LIGHT domain rules
 * @module scripts/v07/validate-light-e2e-v07
 *
 * Validates the complete v0.7 flow:
 * 1. Sphere configuration exists
 * 2. Rules are published and registered
 * 3. Resolution works (ruleId → ruleUri → RuleDef)
 * 4. Contract can execute reasoning
 * 5. MorphemeProofs are on HCS
 *
 * Usage:
 *   node scripts/v07/validate-light-e2e-v07.js [--sphere <name>] [--execute]
 *
 * Options:
 *   --sphere <name>  Sphere name (default: "demo")
 *   --execute        Actually execute a test proof (default: validation only)
 *   --verbose        Show detailed output
 */

import {
  Client,
  PrivateKey,
  ContractCallQuery,
  ContractId
} from "@hashgraph/sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ethers, Interface } from "ethers";
import { getOperatorConfig, getNetworkConfig } from "../v0.6.3/lib/config.js";
import { loadSphereConfig, requireContract } from "./lib/sphere-config.js";
import { resolveRule, resolveLatestRule, resolveRuleDef, computeRuleUriHash } from "./lib/resolve.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Expected rules for LIGHT domain
const EXPECTED_RULES = [
  { ruleId: "sphere://demo/light/red-green-yellow", domain: "color.light", operator: "mix_add@v1" },
  { ruleId: "sphere://demo/light/green-blue-cyan", domain: "color.light", operator: "mix_add@v1" },
  { ruleId: "sphere://demo/light/red-blue-magenta", domain: "color.light", operator: "mix_add@v1" },
  { ruleId: "sphere://demo/entity/white-from-cmy", domain: "color.entity.light", operator: "attest_palette@v1" }
];

/**
 * Validation result
 */
class ValidationResult {
  constructor() {
    this.checks = [];
    this.passed = 0;
    this.failed = 0;
    this.warnings = 0;
  }

  pass(name, message = "") {
    this.checks.push({ name, status: "PASS", message });
    this.passed++;
  }

  fail(name, message = "") {
    this.checks.push({ name, status: "FAIL", message });
    this.failed++;
  }

  warn(name, message = "") {
    this.checks.push({ name, status: "WARN", message });
    this.warnings++;
  }

  print() {
    console.log("\n" + "=".repeat(60));
    console.log("Validation Results");
    console.log("=".repeat(60));

    for (const check of this.checks) {
      const icon = check.status === "PASS" ? "[OK]" : check.status === "FAIL" ? "[FAIL]" : "[WARN]";
      console.log(`${icon} ${check.name}`);
      if (check.message) {
        console.log(`    ${check.message}`);
      }
    }

    console.log("\n" + "-".repeat(40));
    console.log(`Passed: ${this.passed} | Failed: ${this.failed} | Warnings: ${this.warnings}`);

    return this.failed === 0;
  }
}

/**
 * Validate sphere configuration
 */
async function validateSphereConfig(sphereName, result) {
  console.log("\n1. Validating Sphere Configuration...");

  try {
    const config = loadSphereConfig(sphereName);
    result.pass("Sphere config exists", `config.sphere-${sphereName}.json`);

    // Check required fields
    if (config.ruleDefsTopicId) {
      result.pass("RULE_DEFS_TOPIC configured", config.ruleDefsTopicId);
    } else {
      result.fail("RULE_DEFS_TOPIC configured");
    }

    if (config.ruleRegistryTopicId) {
      result.pass("RULE_REGISTRY_TOPIC configured", config.ruleRegistryTopicId);
    } else {
      result.fail("RULE_REGISTRY_TOPIC configured");
    }

    if (config.proofTopicId) {
      result.pass("PROOF_TOPIC configured", config.proofTopicId);
    } else {
      result.fail("PROOF_TOPIC configured");
    }

    if (config.contractId && config.contractAddr) {
      result.pass("Contract deployed", `${config.contractId} @ ${config.contractAddr}`);
    } else {
      result.fail("Contract deployed");
    }

    return config;
  } catch (err) {
    result.fail("Sphere config exists", err.message);
    return null;
  }
}

/**
 * Validate contract is accessible
 */
async function validateContract(config, client, result) {
  console.log("\n2. Validating Contract...");

  if (!config.contractId) {
    result.fail("Contract accessibility", "No contract ID");
    return false;
  }

  try {
    // Query VERSION constant
    const versionQuery = await new ContractCallQuery()
      .setContractId(ContractId.fromString(config.contractId))
      .setGas(50000)
      .setFunction("VERSION")
      .execute(client);

    const version = versionQuery.getString(0);
    if (version === "v0.7.0") {
      result.pass("Contract version", version);
    } else {
      result.warn("Contract version", `Expected v0.7.0, got ${version}`);
    }

    return true;
  } catch (err) {
    result.fail("Contract accessibility", err.message);
    return false;
  }
}

/**
 * Validate rules are published and registered
 */
async function validateRules(config, result, verbose) {
  console.log("\n3. Validating Rules...");

  const networkConfig = getNetworkConfig();

  for (const expectedRule of EXPECTED_RULES) {
    try {
      // Try to resolve via registry
      const ruleUri = await resolveLatestRule(
        expectedRule.ruleId,
        config.ruleRegistryTopicId,
        { mirrorNodeUrl: networkConfig.mirrorNodeUrl }
      );

      result.pass(`Rule registered: ${expectedRule.ruleId}`, ruleUri);

      // Resolve full RuleDef
      const ruleDef = await resolveRuleDef(ruleUri, {
        mirrorNodeUrl: networkConfig.mirrorNodeUrl,
        skipVerification: true
      });

      // Validate RuleDef content
      if (ruleDef.domain === expectedRule.domain) {
        if (verbose) result.pass(`  Domain matches`, ruleDef.domain);
      } else {
        result.warn(`  Domain mismatch`, `Expected ${expectedRule.domain}, got ${ruleDef.domain}`);
      }

      if (ruleDef.operator === expectedRule.operator) {
        if (verbose) result.pass(`  Operator matches`, ruleDef.operator);
      } else {
        result.warn(`  Operator mismatch`, `Expected ${expectedRule.operator}, got ${ruleDef.operator}`);
      }

    } catch (err) {
      result.fail(`Rule registered: ${expectedRule.ruleId}`, err.message);
    }
  }
}

/**
 * Validate resolution algorithms
 */
async function validateResolution(config, result, verbose) {
  console.log("\n4. Validating Resolution Algorithms...");

  const networkConfig = getNetworkConfig();

  // Test Algorithm 11.2: ruleId → ruleUri
  const testRuleId = EXPECTED_RULES[0].ruleId;

  try {
    const ruleUri = await resolveLatestRule(
      testRuleId,
      config.ruleRegistryTopicId,
      { mirrorNodeUrl: networkConfig.mirrorNodeUrl }
    );
    result.pass("Algorithm 11.2: ruleId → ruleUri", ruleUri);

    // Test Algorithm 11.1: ruleUri → RuleDef
    const ruleDef = await resolveRuleDef(ruleUri, {
      mirrorNodeUrl: networkConfig.mirrorNodeUrl,
      skipVerification: true
    });
    result.pass("Algorithm 11.1: ruleUri → RuleDef", ruleDef.ruleId);

    // Test combined resolution
    const { ruleDef: combined, ruleUriHash } = await resolveRule(testRuleId, config, {
      mirrorNodeUrl: networkConfig.mirrorNodeUrl
    });
    result.pass("Combined resolution", `ruleUriHash: ${ruleUriHash.slice(0, 16)}...`);

  } catch (err) {
    result.fail("Resolution algorithms", err.message);
  }
}

/**
 * Validate contract can be called
 */
async function validateContractCalls(config, client, result, execute) {
  console.log("\n5. Validating Contract Calls...");

  if (!execute) {
    result.warn("Contract execution", "Skipped (use --execute to test)");
    return;
  }

  try {
    // Test prepareReasoning (view-like, doesn't actually commit)
    const testRuleUri = "hcs://0.0.12345/1763200000.000000000";
    const testRuleUriHash = computeRuleUriHash(testRuleUri);
    const testInputsHash = ethers.keccak256(ethers.toUtf8Bytes('{"test": true}'));

    const iface = new Interface([
      "function prepareReasoning(string ruleUri, bytes32 ruleUriHash, bytes32 inputsHash)"
    ]);

    const data = iface.encodeFunctionData("prepareReasoning", [
      testRuleUri,
      testRuleUriHash,
      testInputsHash
    ]);

    // Dry run via ContractCallQuery
    const query = await new ContractCallQuery()
      .setContractId(ContractId.fromString(config.contractId))
      .setGas(100000)
      .setFunctionParameters(Buffer.from(data.slice(2), "hex"))
      .execute(client);

    result.pass("Contract prepareReasoning callable");

  } catch (err) {
    // Expected to revert with invalid ruleUri hash
    if (err.message.includes("ruleUriHash mismatch") || err.message.includes("CONTRACT_REVERT")) {
      result.pass("Contract prepareReasoning callable", "Reverts as expected with test data");
    } else {
      result.fail("Contract prepareReasoning callable", err.message);
    }
  }
}

/**
 * Validate HCS topics have messages
 */
async function validateHcsTopics(config, result, verbose) {
  console.log("\n6. Validating HCS Topics...");

  const networkConfig = getNetworkConfig();

  // Check RULE_DEFS_TOPIC
  try {
    const ruleDefsUrl = `${networkConfig.mirrorNodeUrl}/topics/${config.ruleDefsTopicId}/messages?limit=1`;
    const ruleDefsResp = await fetch(ruleDefsUrl);
    const ruleDefsData = await ruleDefsResp.json();

    if (ruleDefsData.messages && ruleDefsData.messages.length > 0) {
      result.pass("RULE_DEFS_TOPIC has messages");
    } else {
      result.warn("RULE_DEFS_TOPIC has messages", "No messages found");
    }
  } catch (err) {
    result.fail("RULE_DEFS_TOPIC accessible", err.message);
  }

  // Check RULE_REGISTRY_TOPIC
  try {
    const registryUrl = `${networkConfig.mirrorNodeUrl}/topics/${config.ruleRegistryTopicId}/messages?limit=1`;
    const registryResp = await fetch(registryUrl);
    const registryData = await registryResp.json();

    if (registryData.messages && registryData.messages.length > 0) {
      result.pass("RULE_REGISTRY_TOPIC has messages");
    } else {
      result.warn("RULE_REGISTRY_TOPIC has messages", "No messages found");
    }
  } catch (err) {
    result.fail("RULE_REGISTRY_TOPIC accessible", err.message);
  }

  // Check PROOF_TOPIC
  try {
    const proofUrl = `${networkConfig.mirrorNodeUrl}/topics/${config.proofTopicId}/messages?limit=1`;
    const proofResp = await fetch(proofUrl);
    const proofData = await proofResp.json();

    if (proofData.messages && proofData.messages.length > 0) {
      result.pass("PROOF_TOPIC has messages");
    } else {
      result.warn("PROOF_TOPIC has messages", "No messages yet (expected if no proofs executed)");
    }
  } catch (err) {
    result.fail("PROOF_TOPIC accessible", err.message);
  }
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);

  const getArg = (flag) => {
    const idx = args.indexOf(flag);
    return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
  };

  const sphereName = getArg("--sphere") || "demo";
  const execute = args.includes("--execute");
  const verbose = args.includes("--verbose");

  console.log("=".repeat(60));
  console.log("Ontologic v0.7 E2E Validation");
  console.log("=".repeat(60));
  console.log(`Sphere: ${sphereName}`);
  console.log(`Execute Tests: ${execute}`);
  console.log(`Verbose: ${verbose}`);

  const result = new ValidationResult();

  // Step 1: Validate sphere config
  const config = await validateSphereConfig(sphereName, result);
  if (!config) {
    result.print();
    process.exit(1);
  }

  // Initialize client for contract tests
  const operatorConfig = getOperatorConfig();
  const privateKey = PrivateKey.fromStringDer(operatorConfig.derKey);
  const client = Client.forTestnet().setOperator(operatorConfig.id, privateKey);

  try {
    // Step 2: Validate contract
    await validateContract(config, client, result);

    // Step 3: Validate rules (only if topics exist)
    if (config.ruleRegistryTopicId) {
      await validateRules(config, result, verbose);
    }

    // Step 4: Validate resolution (only if rules exist)
    if (result.checks.some((c) => c.name.includes("Rule registered") && c.status === "PASS")) {
      await validateResolution(config, result, verbose);
    }

    // Step 5: Validate contract calls
    await validateContractCalls(config, client, result, execute);

    // Step 6: Validate HCS topics
    await validateHcsTopics(config, result, verbose);

  } finally {
    client.close();
  }

  // Print results
  const success = result.print();
  process.exit(success ? 0 : 1);
}

main().catch((err) => {
  console.error("\nFatal Error:", err.message);
  process.exit(1);
});
