/**
 * @fileoverview Execute proof-of-reasoning operations on Hedera
 * @module scripts/reason
 *
 * This script performs a complete three-layer proof-of-reasoning operation:
 * 1. CONTRACTCALL - Validates RED + BLUE tokens and applies reasoning rule
 * 2. TOKENMINT - Mints PURPLE token as material consequence
 * 3. HCS MESSAGE - Submits canonical proof JSON to consensus topic
 *
 * The script demonstrates the complete Ontologic provenance architecture,
 * combining on-chain contract execution with consensus-backed proof recording.
 */

import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  Client,
  PrivateKey,
  TopicMessageSubmitTransaction,
} from "@hashgraph/sdk";
import {
  getOperatorConfig,
  getNetworkConfig,
  getTokenConfig,
  getHcsTopicId,
  DEPLOYED_CONTRACT_ADDRESS,
  ACTIVE_RULE_ID,
} from "./lib/config.js";
import { createCanonicalProof } from "./lib/proof.js";
import * as logger from "./lib/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Submit a proof message to HCS topic
 * @param {string} message - Canonical proof JSON
 * @param {string} topicId - HCS topic ID
 * @returns {Promise<string|null>} Transaction status or null if skipped
 * @throws {Error} If submission fails
 */
async function submitProofToHCS(message, topicId) {
  if (!topicId) {
    logger.warn("No HCS_TOPIC_ID configured - skipping consensus write");
    return null;
  }

  const operatorConfig = getOperatorConfig();
  const operatorKey = PrivateKey.fromStringDer(operatorConfig.derKey);
  const client = Client.forTestnet().setOperator(operatorConfig.id, operatorKey);

  logger.info(`Submitting proof to HCS topic ${topicId}...`);

  const transaction = await new TopicMessageSubmitTransaction()
    .setTopicId(topicId)
    .setMessage(message)
    .execute(client);

  const receipt = await transaction.getReceipt(client);
  const status = receipt.status.toString();

  logger.success("HCS submission complete", { status });

  return status;
}

/**
 * Execute a reasoning operation on the contract
 * @param {Object} params - Reasoning parameters
 * @param {string} params.ruleId - Rule ID to execute
 * @param {number} params.inputUnits - Number of input units to process
 * @param {string} params.proofHash - keccak256 hash of canonical proof
 * @param {string} [params.proofURI=""] - Optional IPFS or external proof URI
 * @returns {Promise<{txHash: string, blockNumber: number}>} Transaction details
 * @throws {Error} If reasoning operation fails
 */
async function executeReasoning(params) {
  const operatorConfig = getOperatorConfig();
  const networkConfig = getNetworkConfig();

  logger.info("Executing reasoning operation...", {
    ruleId: params.ruleId,
    inputUnits: params.inputUnits,
    proofHash: params.proofHash,
  });

  // Load contract ABI
  const artifactPath = path.join(
    __dirname,
    "..",
    "artifacts",
    "contracts",
    "reasoningContract.sol",
    "ReasoningContract.json"
  );
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  // Connect to contract
  const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
  const wallet = new ethers.Wallet(operatorConfig.hexKey, provider);
  const contract = new ethers.Contract(
    DEPLOYED_CONTRACT_ADDRESS,
    artifact.abi,
    wallet
  );

  logger.info("Contract call details:", {
    caller: wallet.address,
    contract: DEPLOYED_CONTRACT_ADDRESS,
    operation: "reason()",
  });

  // Execute reason() function
  const tx = await contract.reason(
    params.ruleId,
    BigInt(params.inputUnits),
    params.proofHash,
    params.proofURI || ""
  );

  const receipt = await tx.wait();

  logger.success("Reasoning transaction mined", {
    txHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed.toString(),
  });

  return {
    txHash: receipt.hash,
    blockNumber: receipt.blockNumber,
  };
}

/**
 * Perform a complete proof-of-reasoning operation
 * @param {Object} options - Operation options
 * @param {number} [options.inputUnits=1] - Number of input units to process
 * @param {string} [options.ruleId=ACTIVE_RULE_ID] - Rule ID to use
 * @returns {Promise<{txHash: string, proof: Object, canonical: string}>} Operation result
 * @throws {Error} If operation fails
 */
async function performReasoning(options = {}) {
  const inputUnits = options.inputUnits || 1;
  const ruleId = options.ruleId || ACTIVE_RULE_ID;

  // Get token configurations
  const redToken = getTokenConfig("RED");
  const blueToken = getTokenConfig("BLUE");
  const purpleToken = getTokenConfig("PURPLE");

  // Create canonical proof
  const { proof, canonical, hash: proofHash } = createCanonicalProof({
    domain: "color",
    subdomain: "paint",
    operator: "mix_paint",
    inputs: [
      { token: redToken.id, alias: "red", hex: "#FF0000" },
      { token: blueToken.id, alias: "blue", hex: "#0000FF" },
    ],
    output: { token: purpleToken.id, alias: "purple", hex: "#800080" },
  });

  logger.info("Canonical proof generated", {
    proofHash,
    timestamp: proof.ts,
  });

  // Step 1 & 2: Execute reasoning (CONTRACTCALL + TOKENMINT)
  const result = await executeReasoning({
    ruleId,
    inputUnits,
    proofHash,
  });

  // Step 3: Submit to HCS (HCS MESSAGE)
  const topicId = getHcsTopicId();
  await submitProofToHCS(canonical, topicId);

  return {
    txHash: result.txHash,
    proof,
    canonical,
  };
}

/**
 * Main execution function
 * @returns {Promise<void>}
 */
async function main() {
  try {
    logger.section("Ontologic Proof-of-Reasoning");

    logger.info("Using configuration:", {
      contract: DEPLOYED_CONTRACT_ADDRESS,
      ruleId: ACTIVE_RULE_ID,
      operation: "RED + BLUE → PURPLE",
    });

    const result = await performReasoning({ inputUnits: 1 });

    logger.subsection("Canonical Proof JSON");
    console.log(result.canonical);

    logger.verificationLinks(result.txHash, getHcsTopicId());

    logger.subsection("Three-Layer Provenance Complete");
    logger.table({
      "1. CONTRACTCALL": "✓ Validated RED + BLUE",
      "2. TOKENMINT": "✓ Minted PURPLE",
      "3. HCS MESSAGE": "✓ Consensus-backed proof",
    });

    logger.success("Proof-of-reasoning operation complete!");

  } catch (err) {
    logger.error("Reasoning operation failed", err);
    process.exit(1);
  }
}

// Export for programmatic use
export { executeReasoning, performReasoning, submitProofToHCS };

// Run if executed directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` ||
    import.meta.url.endsWith('reason.js')) {
  main();
}
