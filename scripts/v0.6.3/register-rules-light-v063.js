/**
 * @fileoverview Register canonical LIGHT domain rules in contract storage (v0.6.3)
 * @module scripts/register-rules-light-v063
 *
 * Registers all 4 canonical LIGHT rules for introspection and verification:
 * - Rule 1: RED + GREEN → YELLOW (color.light, mix_add@v1)
 * - Rule 2: GREEN + BLUE → CYAN (color.light, mix_add@v1)
 * - Rule 3: RED + BLUE → MAGENTA (color.light, mix_add@v1)
 * - Rule 4: YELLOW + CYAN + MAGENTA → WHITE (color.entity.light, attest_palette@v1)
 *
 * Purpose:
 * - Make rules explicitly queryable from contract state
 * - Enable deterministic rule ID computation
 * - Prepare for v0.7.0 registry-driven execution
 *
 * Execution Strategy (v0.6.3):
 * - Registry is READ-ONLY (not used by reasonAdd execution path)
 * - Rules registered via setRule() owner function
 * - Emits RuleSet events for on-chain verification
 */

import { ethers } from "ethers";
import {
  Client,
  ContractExecuteTransaction,
  ContractId,
  ContractFunctionParameters,
  PrivateKey,
} from "@hashgraph/sdk";
import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import * as logger from "./lib/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env (canonical configuration)
config({ path: path.join(__dirname, "..", ".env") });

/**
 * Canonical LIGHT rules definition
 */
const LIGHT_RULES = [
  {
    name: "Rule 1: RED + GREEN → YELLOW",
    domain: "color.light",
    operator: "mix_add@v1",
    inputs: [
      process.env.RED_ADDR,
      process.env.GREEN_ADDR,
    ],
    output: process.env.YELLOW_ADDR,
    ratio: 1,
  },
  {
    name: "Rule 2: GREEN + BLUE → CYAN",
    domain: "color.light",
    operator: "mix_add@v1",
    inputs: [
      process.env.GREEN_ADDR,
      process.env.BLUE_ADDR,
    ],
    output: process.env.CYAN_ADDR,
    ratio: 1,
  },
  {
    name: "Rule 3: RED + BLUE → MAGENTA",
    domain: "color.light",
    operator: "mix_add@v1",
    inputs: [
      process.env.RED_ADDR,
      process.env.BLUE_ADDR,
    ],
    output: process.env.MAGENTA_ADDR,
    ratio: 1,
  },
  {
    name: "Rule 4: YELLOW + CYAN + MAGENTA → WHITE",
    domain: "color.entity.light",
    operator: "attest_palette@v1",
    inputs: [
      process.env.YELLOW_ADDR,
      process.env.CYAN_ADDR,
      process.env.MAGENTA_ADDR,
    ],
    output: process.env.WHITE_ADDR,
    ratio: 1,
  },
];

/**
 * Compute domain hash (matches contract constant)
 */
function domainHash(domain) {
  return ethers.keccak256(ethers.toUtf8Bytes(domain));
}

/**
 * Compute operator hash (matches contract constant)
 */
function operatorHash(operator) {
  return ethers.keccak256(ethers.toUtf8Bytes(operator));
}

/**
 * Compute rule ID (matches contract setRule logic)
 * v0.6.3: Includes outputToken for uniqueness
 */
function computeRuleId(domain, operator, inputs, output) {
  const domainH = domainHash(domain);
  const operatorH = operatorHash(operator);

  // Sort inputs for deterministic encoding (order-invariant)
  const sortedInputs = [...inputs].sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );

  // Match contract: keccak256(abi.encode(domain, operator, inputs, outputToken))
  const ruleId = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "bytes32", "address[]", "address"],
      [domainH, operatorH, sortedInputs, output]
    )
  );

  return ruleId;
}

/**
 * Register a single rule via setRule() function
 */
async function registerRule(client, contractId, rule) {
  logger.subsection(`Registering: ${rule.name}`);

  const domainH = domainHash(rule.domain);
  const operatorH = operatorHash(rule.operator);

  // Sort inputs for deterministic submission
  const sortedInputs = [...rule.inputs].sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );

  const ruleId = computeRuleId(rule.domain, rule.operator, rule.inputs, rule.output);

  logger.info("Rule parameters:", {
    domain: rule.domain,
    domainHash: domainH.slice(0, 16) + "...",
    operator: rule.operator,
    operatorHash: operatorH.slice(0, 16) + "...",
    inputs: sortedInputs,
    output: rule.output,
    ratio: rule.ratio,
  });

  logger.info("Computed Rule ID:", ruleId);

  // Sanity check: verify inputs and output are distinct
  logger.subsection("Sanity Check - Address Validation");
  logger.info("Inputs:", sortedInputs);
  logger.info("Output:", rule.output);

  // Check for duplicates within inputs
  for (let i = 0; i < sortedInputs.length; i++) {
    for (let j = i + 1; j < sortedInputs.length; j++) {
      if (sortedInputs[i].toLowerCase() === sortedInputs[j].toLowerCase()) {
        logger.error(`❌ DUPLICATE INPUT: inputs[${i}] == inputs[${j}] = ${sortedInputs[i]}`);
      }
    }
  }

  // Check if output appears in inputs
  for (let i = 0; i < sortedInputs.length; i++) {
    if (sortedInputs[i].toLowerCase() === rule.output.toLowerCase()) {
      logger.error(`❌ OUTPUT IN INPUTS: inputs[${i}] == output = ${sortedInputs[i]}`);
    }
  }

  // Build function parameters for setRule
  // setRule(bytes32 domain, bytes32 operator, address[] inputs, address output, uint64 ratio)
  const functionParams = new ContractFunctionParameters()
    .addBytes32(Buffer.from(domainH.replace("0x", ""), "hex"))
    .addBytes32(Buffer.from(operatorH.replace("0x", ""), "hex"))
    .addAddressArray(sortedInputs)
    .addAddress(rule.output)
    .addUint64(rule.ratio);

  try {
    const tx = await new ContractExecuteTransaction()
      .setContractId(contractId)
      .setGas(500000)
      .setFunction("setRule", functionParams)
      .execute(client);

    logger.line({
      stage: "set_rule",
      ok: true,
      action: "submitted",
      txId: tx.transactionId.toString(),
    });

    const receipt = await tx.getReceipt(client);

    logger.line({
      stage: "set_rule",
      ok: true,
      action: "confirmed",
      status: receipt.status.toString(),
      txId: tx.transactionId.toString(),
    });

    logger.success(`Rule registered: ${rule.name}`);
    logger.info(`Transaction: https://hashscan.io/testnet/transaction/${tx.transactionId.toString()}`);

    return { ruleId, txId: tx.transactionId.toString() };
  } catch (err) {
    logger.error(`Failed to register rule: ${rule.name}`, err);
    throw err;
  }
}

/**
 * Main registration flow
 */
async function main() {
  logger.section("LIGHT Domain Rule Registration (v0.6.3)");

  // Validate environment
  const operatorId = process.env.OPERATOR_ID;
  const operatorKey = process.env.OPERATOR_DER_KEY;
  const contractIdStr = process.env.CONTRACT_ID;
  const contractAddr = process.env.CONTRACT_ADDR;

  if (!operatorId || !operatorKey || !contractIdStr || !contractAddr) {
    logger.error("Missing required environment variables");
    logger.error("Required: OPERATOR_ID, OPERATOR_DER_KEY, CONTRACT_ID, CONTRACT_ADDR");
    process.exit(1);
  }

  // Validate token addresses
  const tokenAddrs = [
    process.env.RED_ADDR,
    process.env.GREEN_ADDR,
    process.env.BLUE_ADDR,
    process.env.YELLOW_ADDR,
    process.env.CYAN_ADDR,
    process.env.MAGENTA_ADDR,
    process.env.WHITE_ADDR,
  ];

  if (tokenAddrs.some(addr => !addr || addr === "")) {
    logger.error("Missing token addresses in .env");
    process.exit(1);
  }

  // Sanity check: verify all token addresses are distinct
  logger.subsection("Global Address Sanity Check");

  const addrMap = [
    ["RED", process.env.RED_ADDR],
    ["GREEN", process.env.GREEN_ADDR],
    ["BLUE", process.env.BLUE_ADDR],
    ["YELLOW", process.env.YELLOW_ADDR],
    ["CYAN", process.env.CYAN_ADDR],
    ["MAGENTA", process.env.MAGENTA_ADDR],
    ["WHITE", process.env.WHITE_ADDR],
  ];

  logger.info("Token addresses from .env:");
  addrMap.forEach(([name, addr]) => {
    logger.info(`  ${name.padEnd(8)}: ${addr}`);
  });

  let collisionFound = false;
  for (let i = 0; i < addrMap.length; i++) {
    for (let j = i + 1; j < addrMap.length; j++) {
      if (addrMap[i][1].toLowerCase() === addrMap[j][1].toLowerCase()) {
        logger.error(`❌ ADDRESS COLLISION: ${addrMap[i][0]} == ${addrMap[j][0]} (${addrMap[i][1]})`);
        collisionFound = true;
      }
    }
  }

  if (collisionFound) {
    logger.error("FATAL: Address collisions detected in .env. Fix token addresses before proceeding.");
    process.exit(1);
  }

  logger.success("✅ All token addresses are distinct");
  logger.info("");

  logger.info("Configuration loaded:", {
    operator: operatorId,
    contract: contractIdStr,
    contractAddr: contractAddr,
    rulesCount: LIGHT_RULES.length,
  });

  // Create Hedera SDK client
  const client = Client.forTestnet();
  const operatorPrivateKey = PrivateKey.fromStringDer(operatorKey);
  client.setOperator(operatorId, operatorPrivateKey);

  const contractId = ContractId.fromString(contractIdStr);

  logger.subsection("Rule Registration Plan");
  logger.info("Strategy: Conservative (v0.6.3)");
  logger.info("- Registry populated for introspection");
  logger.info("- Execution path unchanged (hardcoded logic active)");
  logger.info("- Prepares for v0.7.0 registry-driven execution");
  logger.info("");

  // Display rules to be registered
  logger.subsection("Rules to Register");
  LIGHT_RULES.forEach((rule, idx) => {
    logger.info(`[${idx + 1}] ${rule.name}`);
  });
  logger.info("");

  // Register each rule
  const results = [];

  for (const rule of LIGHT_RULES) {
    try {
      const result = await registerRule(client, contractId, rule);
      results.push({ ...rule, ...result, success: true });
      logger.info(""); // spacing
    } catch (err) {
      results.push({ ...rule, success: false, error: String(err) });
      logger.warn(`Skipping rule due to error: ${rule.name}`);
      logger.info(""); // spacing
    }
  }

  // Summary
  logger.subsection("Registration Summary");

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  logger.table({
    "Total Rules": LIGHT_RULES.length,
    "Registered": successful.length,
    "Failed": failed.length,
    "Contract": contractIdStr,
    "Version": "v0.6.3",
  });

  if (successful.length > 0) {
    logger.subsection("Registered Rule IDs");
    successful.forEach((result, idx) => {
      logger.info(`[${idx + 1}] ${result.name}`);
      logger.info(`    Rule ID: ${result.ruleId}`);
      logger.info(`    TX: ${result.txId}`);
    });
  }

  if (failed.length > 0) {
    logger.subsection("Failed Registrations");
    failed.forEach((result) => {
      logger.error(`${result.name}: ${result.error}`);
    });
  }

  logger.subsection("Next Steps");
  logger.info("1. Verify registrations on-chain:");
  console.log("     node scripts/validate-light-e2e-v063.js");
  logger.info("\n2. View events on HashScan:");
  console.log(`     https://hashscan.io/testnet/contract/${contractIdStr}`);
  logger.info("\n3. Ready for v0.7.0 upgrade (registry-driven execution)");

  client.close();

  if (failed.length > 0) {
    process.exit(1);
  }

  process.exit(0);
}

main();
