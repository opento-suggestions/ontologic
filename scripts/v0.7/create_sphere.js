#!/usr/bin/env node

/**
 * @fileoverview Create a v0.7 sphere (topics + contract)
 * @module scripts/v07/create_sphere
 *
 * Creates:
 * - RULE_DEFS_TOPIC: HCS topic for RuleDef messages
 * - RULE_REGISTRY_TOPIC: HCS topic for RuleRegistryEntry messages
 * - PROOF_TOPIC: HCS topic for MorphemeProof messages
 * - ReasoningContractV07: Deployed contract instance
 *
 * Usage:
 *   node scripts/v07/create_sphere.js <sphereName> [--topics-only] [--contract-only]
 *
 * Options:
 *   --topics-only    Only create HCS topics, skip contract deployment
 *   --contract-only  Only deploy contract (requires existing topics)
 *   --dry-run        Print what would be done without executing
 */

import {
  Client,
  PrivateKey,
  TopicCreateTransaction,
  ContractCreateFlow,
  ContractFunctionParameters,
  ContractInfoQuery,
  ContractExecuteTransaction,
  ContractId,
  Hbar
} from "@hashgraph/sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getOperatorConfig, getNetworkConfig } from "../v0.6.3/lib/config.js";
import { createSphereConfig, loadSphereConfig, updateSphereConfig } from "./lib/sphere-config.js";
import { ethers } from "ethers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Create HCS topics for a sphere
 * @param {Client} client - Hedera SDK client
 * @param {string} sphereName - Name of the sphere
 * @param {PrivateKey} submitKey - Key for topic submission
 * @returns {Promise<{ruleDefsTopicId: string, ruleRegistryTopicId: string, proofTopicId: string}>}
 */
async function createTopics(client, sphereName, submitKey) {
  console.log(`\nCreating HCS topics for sphere: ${sphereName}`);

  // 1. Create RULE_DEFS_TOPIC
  console.log("  Creating RULE_DEFS_TOPIC...");
  const ruleDefsTx = await new TopicCreateTransaction()
    .setTopicMemo(`ontologic:v0.7:ruleDefs:${sphereName}`)
    .setSubmitKey(submitKey.publicKey)
    .execute(client);
  const ruleDefsReceipt = await ruleDefsTx.getReceipt(client);
  const ruleDefsTopicId = ruleDefsReceipt.topicId.toString();
  console.log(`    RULE_DEFS_TOPIC: ${ruleDefsTopicId}`);

  // 2. Create RULE_REGISTRY_TOPIC
  console.log("  Creating RULE_REGISTRY_TOPIC...");
  const registryTx = await new TopicCreateTransaction()
    .setTopicMemo(`ontologic:v0.7:ruleRegistry:${sphereName}`)
    .setSubmitKey(submitKey.publicKey)
    .execute(client);
  const registryReceipt = await registryTx.getReceipt(client);
  const ruleRegistryTopicId = registryReceipt.topicId.toString();
  console.log(`    RULE_REGISTRY_TOPIC: ${ruleRegistryTopicId}`);

  // 3. Create PROOF_TOPIC
  console.log("  Creating PROOF_TOPIC...");
  const proofTx = await new TopicCreateTransaction()
    .setTopicMemo(`ontologic:v0.7:proofs:${sphereName}`)
    .setSubmitKey(submitKey.publicKey)
    .execute(client);
  const proofReceipt = await proofTx.getReceipt(client);
  const proofTopicId = proofReceipt.topicId.toString();
  console.log(`    PROOF_TOPIC: ${proofTopicId}`);

  return { ruleDefsTopicId, ruleRegistryTopicId, proofTopicId };
}

/**
 * Deploy ReasoningContractV07
 * @param {Client} client - Hedera SDK client
 * @param {string} sphereName - Name of the sphere
 * @returns {Promise<{contractId: string, contractAddr: string, codeHash: string}>}
 */
async function deployContract(client, sphereName) {
  console.log(`\nDeploying ReasoningContractV07 for sphere: ${sphereName}`);

  // Load compiled contract
  const artifactPath = path.join(
    __dirname,
    "..",
    "..",
    "artifacts",
    "contracts",
    "ReasoningContractV07.sol",
    "ReasoningContractV07.json"
  );

  if (!fs.existsSync(artifactPath)) {
    throw new Error(
      `Contract artifact not found at: ${artifactPath}\n` +
      `Run 'npm run build' to compile contracts first.`
    );
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const bytecode = artifact.bytecode;

  // Compute code hash
  const codeHash = ethers.keccak256(bytecode);
  console.log(`  Code hash: ${codeHash}`);

  // Schema hash for v0.7
  const schemaHash = ethers.keccak256(ethers.toUtf8Bytes("ontologic:v0.7:reasoning"));

  console.log("  Deploying contract...");

  // Build the flow instance first (setConstructorParameters is not chainable)
  const contractCreateFlow = new ContractCreateFlow()
    .setBytecode(bytecode)
    .setGas(4_000_000);

  // Add constructor parameter (schema hash as bytes32)
  contractCreateFlow.setConstructorParameters(
    new ContractFunctionParameters().addBytes32(
      Buffer.from(schemaHash.slice(2), "hex")
    )
  );

  // Set max tx fee if supported
  if (typeof contractCreateFlow.setMaxTransactionFee === "function") {
    contractCreateFlow.setMaxTransactionFee(new Hbar(20));
  }

  const contractTx = await contractCreateFlow.execute(client);
  const contractReceipt = await contractTx.getReceipt(client);
  const contractId = contractReceipt.contractId.toString();

// Get EVM address
const contractInfo = await new ContractInfoQuery()
  .setContractId(contractReceipt.contractId)
  .execute(client);

// In @hashgraph/sdk v2.x, this is already an EVM-compatible address string
const contractAddr = contractInfo.contractAccountId;

console.log(`  Contract ID:      ${contractId}`);
console.log(`  Contract Address: ${contractAddr}`);

return { contractId, contractAddr, codeHash };
}

/**
 * Configure contract with sphere topic IDs
 * @param {Client} client - Hedera SDK client
 * @param {string} contractId - Contract ID
 * @param {Object} config - Sphere configuration
 */
async function configureContract(client, contractIdStr, config) {
  console.log("\nConfiguring contract with sphere topics...");

  const tx = await new ContractExecuteTransaction()
    .setContractId(ContractId.fromString(contractIdStr))
    .setGas(500_000)
    .setFunction(
      "configureSphere",
      new ContractFunctionParameters()
        .addString(config.sphereName)
        .addString(config.ruleDefsTopicId)
        .addString(config.ruleRegistryTopicId)
        .addString(config.proofTopicId)
    )
    .execute(client);

  await tx.getReceipt(client);
  console.log("  Sphere configuration set on contract");
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  const sphereName = args.find((a) => !a.startsWith("--")) || "demo";
  const topicsOnly = args.includes("--topics-only");
  const contractOnly = args.includes("--contract-only");
  const dryRun = args.includes("--dry-run");

  console.log("=".repeat(60));
  console.log("Ontologic v0.7 Sphere Creation");
  console.log("=".repeat(60));
  console.log(`Sphere Name: ${sphereName}`);
  console.log(`Topics Only: ${topicsOnly}`);
  console.log(`Contract Only: ${contractOnly}`);
  console.log(`Dry Run: ${dryRun}`);

  if (dryRun) {
    console.log("\n[DRY RUN] Would create:");
    if (!contractOnly) {
      console.log("  - RULE_DEFS_TOPIC");
      console.log("  - RULE_REGISTRY_TOPIC");
      console.log("  - PROOF_TOPIC");
    }
    if (!topicsOnly) {
      console.log("  - ReasoningContractV07 deployment");
    }
    return;
  }

  // Initialize client
  const operatorConfig = getOperatorConfig();
  const privateKey = PrivateKey.fromStringDer(operatorConfig.derKey);
  const client = Client.forTestnet().setOperator(operatorConfig.id, privateKey);

  try {
    let config;

    if (contractOnly) {
      // Load existing config and just deploy contract
      config = loadSphereConfig(sphereName);
      console.log("\nLoaded existing sphere config:");
      console.log(`  RULE_DEFS_TOPIC: ${config.ruleDefsTopicId}`);
      console.log(`  RULE_REGISTRY_TOPIC: ${config.ruleRegistryTopicId}`);
      console.log(`  PROOF_TOPIC: ${config.proofTopicId}`);
    } else {
      // Create topics
      const topics = await createTopics(client, sphereName, privateKey);

      if (topicsOnly) {
        // Save config without contract
        config = createSphereConfig({
          sphereName,
          ...topics,
          network: "hedera-testnet"
        });
        console.log(`\nSphere config saved to: config.sphere-${sphereName}.json`);
        console.log("Run with --contract-only to deploy contract later.");
        return;
      }

      // Create initial config
      config = createSphereConfig({
        sphereName,
        ...topics,
        network: "hedera-testnet"
      });
    }

    // Deploy contract
    const contractInfo = await deployContract(client, sphereName);

    // Update config with contract info
    config = updateSphereConfig(sphereName, {
      contractId: contractInfo.contractId,
      contractAddr: contractInfo.contractAddr,
      codeHash: contractInfo.codeHash
    });

    // Configure contract with sphere topics
    await configureContract(client, contractInfo.contractId, config);

    // Print summary
    console.log("\n" + "=".repeat(60));
    console.log("Sphere Created Successfully!");
    console.log("=".repeat(60));
    console.log(`Sphere Name:        ${config.sphereName}`);
    console.log(`RULE_DEFS_TOPIC:    ${config.ruleDefsTopicId}`);
    console.log(`RULE_REGISTRY_TOPIC: ${config.ruleRegistryTopicId}`);
    console.log(`PROOF_TOPIC:        ${config.proofTopicId}`);
    console.log(`Contract ID:        ${config.contractId}`);
    console.log(`Contract Address:   ${config.contractAddr}`);
    console.log(`Code Hash:          ${config.codeHash}`);
    console.log(`\nConfig saved to: config.sphere-${sphereName}.json`);

  } finally {
    client.close();
  }
}

main().catch((err) => {
  console.error("\nError:", err.message);
  process.exit(1);
});
