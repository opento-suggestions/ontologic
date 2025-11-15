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
  Client,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  PrivateKey,
  ContractId,
} from "@hashgraph/sdk";
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

  logger.info("Setting reasoning rule on contract...", {
    contract: contractAddress,
    domain: `${params.domain}.${params.subdomain}`,
    operator: params.operator,
    inputs: params.inputAddresses,
    output: params.outputAddress,
    ratio: `${params.ratioNumerator}:1`,
  });

  // Compute domain and operator hashes
  const domainHash = ethers.keccak256(
    ethers.toUtf8Bytes(`${params.domain}.${params.subdomain}`)
  );
  const operatorHash = ethers.keccak256(ethers.toUtf8Bytes(params.operator));

  // Use Hedera SDK for transaction execution
  const client = Client.forTestnet().setOperator(
    operatorConfig.id,
    PrivateKey.fromStringDer(operatorConfig.derKey)
  );

  // Convert contract address to ContractId
  const evmAddrClean = contractAddress.toLowerCase().replace("0x", "");
  const entityNum = parseInt(evmAddrClean.slice(-8), 16);
  const contractId = new ContractId(0, 0, entityNum);

  // Build function parameters
  const functionParams = new ContractFunctionParameters()
    .addBytes32(Buffer.from(domainHash.replace("0x", ""), "hex"))
    .addBytes32(Buffer.from(operatorHash.replace("0x", ""), "hex"))
    .addAddressArray(params.inputAddresses)
    .addAddress(params.outputAddress)
    .addUint64(params.ratioNumerator);

  // Execute via SDK
  const tx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(500000)
    .setFunction("setRule", functionParams)
    .execute(client);

  const receipt = await tx.getReceipt(client);
  client.close();

  // Compute rule ID (same as contract does)
  const ruleId = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "bytes32", "address[]"],
      [domainHash, operatorHash, params.inputAddresses]
    )
  );

  logger.success("Reasoning rule configured", {
    ruleId,
    txHash: tx.transactionId.toString(),
    status: receipt.status.toString(),
  });

  return { ruleId, txHash: tx.transactionId.toString() };
}

/**
 * Main execution function
 * @returns {Promise<void>}
 */
async function main() {
  try {
    // Check for --rule-file flag (data-driven rule registration)
    const ruleFileIndex = process.argv.indexOf("--rule-file");
    if (ruleFileIndex >= 0 && process.argv[ruleFileIndex + 1]) {
      const rulePath = process.argv[ruleFileIndex + 1];
      const ruleDef = JSON.parse(fs.readFileSync(rulePath, "utf8"));
      const inputAddrs = ruleDef.inputs.map(sym => getTokenConfig(sym).addr);
      const outputAddr = getTokenConfig(ruleDef.output).addr;

      const [domain, subdomain] = ruleDef.domain.split(".");
      const result = await setReasoningRule(DEPLOYED_CONTRACT_ADDRESS, {
        domain, subdomain, operator: ruleDef.operator,
        inputAddresses: inputAddrs, outputAddress: outputAddr,
        ratioNumerator: ruleDef.ratio || 1,
      });

      console.log(JSON.stringify({ rule: ruleDef.operator, inputs: ruleDef.inputs, output: ruleDef.output, ruleId: result.ruleId, tx: result.txHash }));
      return;
    }

    logger.section("Set Reasoning Rules (Alpha v0.3 - Dual-Domain)");

    // Get token configurations
    const redToken = getTokenConfig("RED");
    const greenToken = getTokenConfig("GREEN");
    const blueToken = getTokenConfig("BLUE");
    const whiteToken = getTokenConfig("WHITE");
    const greyToken = getTokenConfig("GREY");

    logger.info("Using token addresses:", {
      RED: redToken.addr,
      GREEN: greenToken.addr,
      BLUE: blueToken.addr,
      WHITE: whiteToken.addr,
      GREY: greyToken.addr,
    });

    // Configure LIGHT domain rule: RED + GREEN + BLUE → WHITE
    logger.subsection("Setting LIGHT Domain Rule");
    const lightResult = await setReasoningRule(DEPLOYED_CONTRACT_ADDRESS, {
      domain: "color",
      subdomain: "additive",
      operator: "mix_light",
      inputAddresses: [redToken.addr, greenToken.addr, blueToken.addr],
      outputAddress: whiteToken.addr,
      ratioNumerator: 1,
    });

    logger.table({
      "Domain": "LIGHT (color.additive)",
      "Operation": "RED + GREEN + BLUE → WHITE",
      "Rule ID": lightResult.ruleId,
      "Transaction": lightResult.txHash,
    });

    // Configure PAINT domain rule: RED + GREEN + BLUE → GREY
    logger.subsection("Setting PAINT Domain Rule");
    const paintResult = await setReasoningRule(DEPLOYED_CONTRACT_ADDRESS, {
      domain: "color",
      subdomain: "subtractive",
      operator: "mix_paint",
      inputAddresses: [redToken.addr, greenToken.addr, blueToken.addr],
      outputAddress: greyToken.addr,
      ratioNumerator: 1,
    });

    logger.table({
      "Domain": "PAINT (color.subtractive)",
      "Operation": "RED + GREEN + BLUE → GREY",
      "Rule ID": paintResult.ruleId,
      "Transaction": paintResult.txHash,
    });

    logger.subsection("Rules Summary");
    logger.table({
      "Contract": DEPLOYED_CONTRACT_ADDRESS,
      "LIGHT Rule ID": lightResult.ruleId,
      "PAINT Rule ID": paintResult.ruleId,
    });

    logger.subsection("Next Steps");
    logger.info("Update ACTIVE_RULE_IDS in scripts/lib/config.js with:");
    console.log(`  LIGHT: "${lightResult.ruleId}",`);
    console.log(`  PAINT: "${paintResult.ruleId}",`);
    logger.info("");
    logger.info("Execute reasoning operations with:");
    console.log("  node scripts/reason.js --domain light");
    console.log("  node scripts/reason.js --domain paint");

  } catch (err) {
    logger.error("Failed to set reasoning rules", err);
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
