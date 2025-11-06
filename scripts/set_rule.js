/**
 * @fileoverview Configure reasoning rules on the ReasoningContract
 * @module scripts/set_rule
 *
 * This script sets up reasoning rules that map input tokens to output tokens.
 * For the MVP, it configures the RED + BLUE → PURPLE rule.
 *
 * Rule configuration:
 * - Domain: "color.paint"
 * - Operator: "mix_paint"
 * - Inputs: $RED and $BLUE tokens
 * - Output: $PURPLE token
 * - Ratio: 1:1 (1 input unit produces 1 output unit)
 *
 * Part of Layer 1 (CONTRACTCALL) in the three-layer provenance architecture.
 */

import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  getOperatorConfig,
  getNetworkConfig,
  getTokenConfig,
  DEPLOYED_CONTRACT_ADDRESS,
} from "./lib/config.js";
import * as logger from "./lib/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Rule configuration parameters
 * @typedef {Object} RuleParams
 * @property {string} domain - Domain identifier (e.g., "color")
 * @property {string} subdomain - Subdomain identifier (e.g., "paint")
 * @property {string} operator - Operation identifier (e.g., "mix_paint")
 * @property {string[]} inputAddresses - Array of input token EVM addresses
 * @property {string} outputAddress - Output token EVM address
 * @property {number} ratioNumerator - Mint ratio (1 = 1:1)
 */

/**
 * Set a reasoning rule on the contract
 * @param {string} contractAddress - ReasoningContract EVM address
 * @param {RuleParams} params - Rule parameters
 * @returns {Promise<{ruleId: string, txHash: string}>} Rule ID and transaction hash
 * @throws {Error} If rule setting fails
 */
async function setReasoningRule(contractAddress, params) {
  const operatorConfig = getOperatorConfig();
  const networkConfig = getNetworkConfig();

  logger.info("Setting reasoning rule on contract...", {
    contract: contractAddress,
    domain: `${params.domain}.${params.subdomain}`,
    operator: params.operator,
    inputs: params.inputAddresses,
    output: params.outputAddress,
    ratio: `${params.ratioNumerator}:1`,
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
  const contract = new ethers.Contract(contractAddress, artifact.abi, wallet);

  // Compute domain and operator hashes
  const domainHash = ethers.keccak256(
    ethers.toUtf8Bytes(`${params.domain}.${params.subdomain}`)
  );
  const operatorHash = ethers.keccak256(ethers.toUtf8Bytes(params.operator));

  // Call setRule
  const tx = await contract.setRule(
    domainHash,
    operatorHash,
    params.inputAddresses,
    params.outputAddress,
    params.ratioNumerator
  );

  const receipt = await tx.wait();

  // Compute rule ID (same as contract does)
  const ruleId = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "bytes32", "address[]"],
      [domainHash, operatorHash, params.inputAddresses]
    )
  );

  logger.success("Reasoning rule configured", {
    ruleId,
    txHash: receipt.hash,
    blockNumber: receipt.blockNumber,
  });

  return { ruleId, txHash: receipt.hash };
}

/**
 * Main execution function
 * @returns {Promise<void>}
 */
async function main() {
  try {
    logger.section("Set Reasoning Rule");

    // Get token configurations
    const redToken = getTokenConfig("RED");
    const blueToken = getTokenConfig("BLUE");
    const purpleToken = getTokenConfig("PURPLE");

    logger.info("Using token addresses:", {
      RED: redToken.addr,
      BLUE: blueToken.addr,
      PURPLE: purpleToken.addr,
    });

    // Configure RED + BLUE → PURPLE rule
    const result = await setReasoningRule(DEPLOYED_CONTRACT_ADDRESS, {
      domain: "color",
      subdomain: "paint",
      operator: "mix_paint",
      inputAddresses: [redToken.addr, blueToken.addr],
      outputAddress: purpleToken.addr,
      ratioNumerator: 1,
    });

    logger.subsection("Rule Details");
    logger.table({
      "Rule ID": result.ruleId,
      "Transaction": result.txHash,
      "Contract": DEPLOYED_CONTRACT_ADDRESS,
    });

    logger.verificationLinks(result.txHash);

    logger.subsection("Next Steps");
    logger.info("The reasoning rule is now active. You can execute reasoning operations with:");
    console.log("  node scripts/reason.js");

  } catch (err) {
    logger.error("Failed to set reasoning rule", err);
    process.exit(1);
  }
}

// Export for programmatic use
export { setReasoningRule };

// Run if executed directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` ||
    import.meta.url.endsWith('set_rule.js')) {
  main();
}
