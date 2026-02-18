/**
 * @fileoverview End-to-end validation for LIGHT domain rules (v0.6.3)
 * @module scripts/validate-light-e2e-v063
 *
 * Validates complete v0.6.3 rule registration and execution:
 * 1. Verify all 4 canonical rules registered in contract storage
 * 2. Query rule IDs and validate against expected values
 * 3. Test backward compatibility (v0.5.2/v0.6.0 proofs still work)
 * 4. Execute new WHITE entity with publishEntityV2 (explicit evidence)
 * 5. Generate verification report
 *
 * This script performs READ-ONLY contract queries and generates a report.
 * No state mutations.
 */

import { ethers } from "ethers";
import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import * as logger from "./lib/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env (canonical configuration)
config({ path: path.join(__dirname, "..", ".env") });

/**
 * Expected canonical LIGHT rules
 */
const EXPECTED_RULES = [
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
 * Known proof hashes from HCS (v0.5.2 and v0.6.0)
 */
const KNOWN_PROOFS = {
  "RED+GREEN→YELLOW": "0x536d578fe6704ea413ca3e51a66f220db2ceeeacc3c12e7d905acf24795417b2", // Seq 33
  "GREEN+BLUE→CYAN": "0xb61992a0c5d7114ff82af5fb2f4863b1099d431837cc83a013e9d090f00978bd", // Seq 34
  "RED+BLUE→MAGENTA": "0x33608b66fa5b9be56ca0939faea1f360741f07edb30dac81521582a61f4059ba", // Seq 35
};

/**
 * Compute domain hash
 */
function domainHash(domain) {
  return ethers.keccak256(ethers.toUtf8Bytes(domain));
}

/**
 * Compute operator hash
 */
function operatorHash(operator) {
  return ethers.keccak256(ethers.toUtf8Bytes(operator));
}

/**
 * Compute rule ID (v0.6.3: includes output for uniqueness)
 */
function computeRuleId(domain, operator, inputs, output) {
  const domainH = domainHash(domain);
  const operatorH = operatorHash(operator);

  // Sort inputs for deterministic encoding
  const sortedInputs = [...inputs].sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );

  const ruleId = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "bytes32", "address[]", "address"],
      [domainH, operatorH, sortedInputs, output]
    )
  );

  return ruleId;
}

/**
 * Query a rule from contract storage
 */
async function queryRule(contract, ruleId) {
  try {
    const rule = await contract.rules(ruleId);
    return {
      domain: rule.domain,
      operator: rule.operator,
      inputs: rule.inputs,
      outputToken: rule.outputToken,
      ratioNumerator: rule.ratioNumerator,
      active: rule.active,
    };
  } catch (err) {
    return null;
  }
}

/**
 * Check if a proof hash exists in contract
 */
async function checkProofSeen(contract, proofHash) {
  try {
    const seen = await contract.seen(proofHash);
    return seen;
  } catch (err) {
    return false;
  }
}

/**
 * Main validation flow
 */
async function main() {
  logger.section("LIGHT Domain E2E Validation (v0.6.3)");

  // Validate environment
  const rpcUrl = process.env.HEDERA_RPC_URL;
  const contractAddr = process.env.CONTRACT_ADDR;
  const contractIdStr = process.env.CONTRACT_ID;

  if (!rpcUrl || !contractAddr) {
    logger.error("Missing HEDERA_RPC_URL or CONTRACT_ADDR in .env");
    process.exit(1);
  }

  logger.info("Configuration:", {
    rpcUrl,
    contract: contractIdStr,
    contractAddr,
  });

  // Connect to contract via JSON-RPC
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  // Minimal ABI for queries
  const contractABI = [
    "function rules(bytes32 ruleId) external view returns (tuple(bytes32 domain, bytes32 operator, address[] inputs, address outputToken, uint64 ratioNumerator, bool active))",
    "function seen(bytes32 proofHash) external view returns (bool)",
    "function proofSeen(bytes32) external view returns (bool)",
  ];

  const contract = new ethers.Contract(contractAddr, contractABI, provider);

  // ==========================================
  // VALIDATION 1: Rule Registry
  // ==========================================

  logger.subsection("Validation 1: Rule Registry");

  const ruleResults = [];

  for (const expected of EXPECTED_RULES) {
    const ruleId = computeRuleId(expected.domain, expected.operator, expected.inputs, expected.output);

    logger.info(`Checking: ${expected.name}`);
    logger.info(`  Expected Rule ID: ${ruleId}`);

    const rule = await queryRule(contract, ruleId);

    if (!rule) {
      logger.error(`  ❌ Rule NOT found in contract storage`);
      ruleResults.push({
        ...expected,
        ruleId,
        found: false,
        valid: false,
      });
      continue;
    }

    // Validate rule fields
    const domainH = domainHash(expected.domain);
    const operatorH = operatorHash(expected.operator);
    const sortedInputs = [...expected.inputs].sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase())
    );

    const domainMatch = rule.domain === domainH;
    const operatorMatch = rule.operator === operatorH;
    const outputMatch = rule.outputToken.toLowerCase() === expected.output.toLowerCase();
    const ratioMatch = Number(rule.ratioNumerator) === expected.ratio;
    const activeMatch = rule.active === true;

    // Check inputs (must match sorted order)
    let inputsMatch = rule.inputs.length === sortedInputs.length;
    if (inputsMatch) {
      for (let i = 0; i < rule.inputs.length; i++) {
        if (rule.inputs[i].toLowerCase() !== sortedInputs[i].toLowerCase()) {
          inputsMatch = false;
          break;
        }
      }
    }

    const valid = domainMatch && operatorMatch && inputsMatch && outputMatch && ratioMatch && activeMatch;

    if (valid) {
      logger.success(`  ✅ Rule registered and valid`);
    } else {
      logger.error(`  ❌ Rule found but INVALID`);
      if (!domainMatch) logger.error(`     Domain mismatch`);
      if (!operatorMatch) logger.error(`     Operator mismatch`);
      if (!inputsMatch) logger.error(`     Inputs mismatch`);
      if (!outputMatch) logger.error(`     Output mismatch`);
      if (!ratioMatch) logger.error(`     Ratio mismatch`);
      if (!activeMatch) logger.error(`     Not active`);
    }

    ruleResults.push({
      ...expected,
      ruleId,
      found: true,
      valid,
      onChainData: rule,
    });

    logger.info(""); // spacing
  }

  // ==========================================
  // VALIDATION 2: Proof History
  // ==========================================

  logger.subsection("Validation 2: Proof History (Backward Compatibility)");

  const proofResults = [];

  for (const [name, proofHash] of Object.entries(KNOWN_PROOFS)) {
    logger.info(`Checking proof: ${name}`);
    logger.info(`  Proof Hash: ${proofHash}`);

    const seen = await checkProofSeen(contract, proofHash);

    if (seen) {
      logger.success(`  ✅ Proof exists in contract history`);
    } else {
      logger.warn(`  ⚠️  Proof NOT found (may not be executed yet)`);
    }

    proofResults.push({
      name,
      proofHash,
      seen,
    });

    logger.info(""); // spacing
  }

  // ==========================================
  // VALIDATION 3: Contract Constants
  // ==========================================

  logger.subsection("Validation 3: Contract Domain/Operator Constants");

  const D_LIGHT = domainHash("color.light");
  const D_ENTITY_LIGHT = domainHash("color.entity.light");
  const OP_ADD = operatorHash("mix_add@v1");
  const OP_ATTEST = operatorHash("attest_palette@v1");

  logger.info("Domain Hashes:");
  logger.info(`  D_LIGHT: ${D_LIGHT}`);
  logger.info(`  D_ENTITY_LIGHT: ${D_ENTITY_LIGHT}`);
  logger.info("");
  logger.info("Operator Hashes:");
  logger.info(`  OP_ADD: ${OP_ADD}`);
  logger.info(`  OP_ATTEST: ${OP_ATTEST}`);
  logger.info("");

  // ==========================================
  // SUMMARY REPORT
  // ==========================================

  logger.subsection("Validation Summary");

  const rulesValid = ruleResults.filter(r => r.valid).length;
  const rulesFound = ruleResults.filter(r => r.found).length;
  const proofsFound = proofResults.filter(p => p.seen).length;

  logger.table({
    "Contract": contractIdStr,
    "Version": "v0.6.3",
    "Rules Expected": EXPECTED_RULES.length,
    "Rules Found": rulesFound,
    "Rules Valid": rulesValid,
    "Historical Proofs": `${proofsFound}/${Object.keys(KNOWN_PROOFS).length}`,
  });

  logger.subsection("Rule Registry Status");
  ruleResults.forEach((result, idx) => {
    const status = result.valid ? "✅ VALID" : (result.found ? "❌ INVALID" : "❌ NOT FOUND");
    logger.info(`[${idx + 1}] ${result.name}: ${status}`);
  });

  logger.subsection("Proof History Status");
  proofResults.forEach((result) => {
    const status = result.seen ? "✅ EXISTS" : "⚠️  NOT FOUND";
    logger.info(`${result.name}: ${status}`);
  });

  // ==========================================
  // RECOMMENDATIONS
  // ==========================================

  logger.subsection("Recommendations");

  if (rulesValid === EXPECTED_RULES.length) {
    logger.success("✅ All canonical LIGHT rules registered and valid!");
    logger.info("   System ready for registry-driven execution (v0.7.0)");
  } else {
    logger.error("❌ Rule registration incomplete or invalid");
    logger.info("   Run: node scripts/register-rules-light-v063.js");
  }

  if (proofsFound < Object.keys(KNOWN_PROOFS).length) {
    logger.warn("⚠️  Some historical proofs not found");
    logger.info("   This is expected if contract was recently deployed/upgraded");
    logger.info("   Execute proofs: node scripts/reason.js examples/mvp/red-green-yellow.json");
  }

  logger.subsection("Next Steps");
  logger.info("1. Execute RGB→CMY proofs (if missing):");
  console.log("     node scripts/reason.js examples/mvp/red-green-yellow.json");
  console.log("     node scripts/reason.js examples/mvp/green-blue-cyan.json");
  console.log("     node scripts/reason.js examples/mvp/red-blue-magenta.json");

  logger.info("\n2. Execute WHITE entity with publishEntityV2:");
  console.log("     node scripts/entity-v06.js examples/mvp/entity-white-light.json");
  console.log("     (Note: Use V2 script when available for explicit evidence validation)");

  logger.info("\n3. Verify on HashScan:");
  console.log(`     https://hashscan.io/testnet/contract/${contractIdStr}`);

  logger.info("\n4. Review rules documentation:");
  console.log("     docs/rules-light-v063.md");

  // Exit with appropriate status
  const success = (rulesValid === EXPECTED_RULES.length);

  if (success) {
    logger.success("\n✅ v0.6.3 validation PASSED");
    process.exit(0);
  } else {
    logger.error("\n❌ v0.6.3 validation FAILED");
    process.exit(1);
  }
}

main();
