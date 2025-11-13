#!/usr/bin/env node
/**
 * Batch rule registration script for complete RGB ↔ CMY(K) closure
 * Registers all 25 rules from rgb_cmyk_complete.json
 *
 * Usage:
 *   node scripts/admin/register_all_rules.js                    # Register all rules
 *   node scripts/admin/register_all_rules.js --domain light     # Only light domain (12 rules)
 *   node scripts/admin/register_all_rules.js --domain paint     # Only paint domain (13 rules)
 *   node scripts/admin/register_all_rules.js --phase 1          # Register specific phase
 *   node scripts/admin/register_all_rules.js --ids 1,2,3        # Register specific rule IDs
 *   node scripts/admin/register_all_rules.js --dry-run          # Preview without executing
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  Client,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  ContractId,
  PrivateKey,
} from "@hashgraph/sdk";
import { ethers } from "ethers";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env.example") });

// ────────────────────────────────────────────────────────────
// Configuration
// ────────────────────────────────────────────────────────────

const DEPLOYED_CONTRACT_ADDRESS = process.env.CONTRACT_ADDR;
const CONTRACT_ID = process.env.CONTRACT_ID;
const RULE_SET_PATH = path.resolve(__dirname, "../../rules/rgb_cmyk_complete.json");
const TOKENS_PATH = path.resolve(__dirname, "../lib/tokens.json");

function getOperatorConfig() {
  return {
    id: process.env.OPERATOR_ID,
    derKey: process.env.OPERATOR_DER_KEY,
    evmAddr: process.env.OPERATOR_EVM_ADDR,
  };
}

function getTokenConfig(symbol) {
  const tokens = JSON.parse(fs.readFileSync(TOKENS_PATH, "utf8"));
  const addr = tokens[symbol];
  if (!addr) throw new Error(`Token ${symbol} not found in tokens.json`);
  return { symbol, addr };
}

// ────────────────────────────────────────────────────────────
// Rule Registration (SDK-based)
// ────────────────────────────────────────────────────────────

async function setReasoningRule(client, contractId, params) {
  // Compute domain and operator hashes
  const domainHash = ethers.keccak256(
    ethers.toUtf8Bytes(`${params.domain}.${params.subdomain}`)
  );
  const operatorHash = ethers.keccak256(ethers.toUtf8Bytes(params.operator));

  // Compute ruleId (order-invariant for commutative operations)
  const sortedInputs = [...params.inputAddresses].sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );
  const ruleId = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "bytes32", "address[]"],
      [domainHash, operatorHash, sortedInputs]
    )
  );

  // Build function parameters
  const functionParams = new ContractFunctionParameters()
    .addBytes32(Buffer.from(domainHash.replace("0x", ""), "hex"))
    .addBytes32(Buffer.from(operatorHash.replace("0x", ""), "hex"))
    .addAddressArray(params.inputAddresses)
    .addAddress(params.outputAddress)
    .addUint64(params.ratioNumerator);

  // Execute transaction
  const tx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(500000)
    .setFunction("setRule", functionParams)
    .execute(client);

  const receipt = await tx.getReceipt(client);
  const txHash = tx.transactionId.toString();

  return {
    ruleId,
    domainHash,
    operatorHash,
    txHash,
    status: receipt.status.toString(),
  };
}

// ────────────────────────────────────────────────────────────
// CLI Argument Parser
// ────────────────────────────────────────────────────────────

function arg(name) {
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && process.argv[idx + 1]) {
    return process.argv[idx + 1];
  }
  return null;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

// ────────────────────────────────────────────────────────────
// Rule Filtering
// ────────────────────────────────────────────────────────────

function filterRules(ruleSet, options) {
  let filtered = [...ruleSet.rules];

  // Filter by domain
  if (options.domain) {
    const targetDomain = `color.${options.domain}`;
    filtered = filtered.filter((r) => r.domain === targetDomain);
  }

  // Filter by phase
  if (options.phase) {
    const phaseMap = {
      1: [1, 2, 3], // Additive rules (RGB→CMY)
      2: [4, 5, 6, 7, 8, 9], // Light subtractive (secondary-primary)
      3: [10, 11, 12], // White complement
      4: [13, 14, 15], // Paint pairwise (CMY→RGB)
      5: [16], // Triple saturation (CMY→K)
      6: [17, 18, 19, 20, 21, 22], // Paint secondary-primary
      7: [23, 24, 25], // Black complement
    };
    const phaseIds = phaseMap[options.phase];
    if (!phaseIds) throw new Error(`Invalid phase: ${options.phase}`);
    filtered = filtered.filter((r) => phaseIds.includes(r.id));
  }

  // Filter by specific IDs
  if (options.ids) {
    const targetIds = options.ids.split(",").map((id) => parseInt(id.trim()));
    filtered = filtered.filter((r) => targetIds.includes(r.id));
  }

  // Filter by category
  if (options.category) {
    filtered = filtered.filter((r) => r.category === options.category);
  }

  return filtered;
}

// ────────────────────────────────────────────────────────────
// Main Registration Loop
// ────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  Ontologic – Batch Rule Registration (RGB↔CMYK)");
  console.log("═══════════════════════════════════════════════════════\n");

  // Load rule set
  const ruleSet = JSON.parse(fs.readFileSync(RULE_SET_PATH, "utf8"));
  console.log(`📋 Rule Set: ${ruleSet.nsid}`);
  console.log(`📝 Description: ${ruleSet.description}\n`);

  // Parse CLI options
  const options = {
    domain: arg("--domain"),
    phase: arg("--phase") ? parseInt(arg("--phase")) : null,
    ids: arg("--ids"),
    category: arg("--category"),
    dryRun: hasFlag("--dry-run"),
  };

  // Filter rules based on options
  const rulesToRegister = filterRules(ruleSet, options);

  console.log(`🎯 Rules to register: ${rulesToRegister.length}`);
  if (options.dryRun) {
    console.log("🔍 DRY RUN MODE - No transactions will be executed\n");
  }

  // Display summary
  const lightCount = rulesToRegister.filter((r) =>
    r.domain.includes("light")
  ).length;
  const paintCount = rulesToRegister.filter((r) =>
    r.domain.includes("paint")
  ).length;
  console.log(`   Light domain: ${lightCount} rules`);
  console.log(`   Paint domain: ${paintCount} rules\n`);

  if (rulesToRegister.length === 0) {
    console.log("⚠️  No rules matched the filter criteria.");
    return;
  }

  // Initialize SDK client once (reused for all rules)
  let client = null;
  let contractId = null;

  if (!options.dryRun) {
    const operatorConfig = getOperatorConfig();
    client = Client.forTestnet().setOperator(
      operatorConfig.id,
      PrivateKey.fromStringDer(operatorConfig.derKey)
    );

    // Use CONTRACT_ID from env if available, otherwise derive from EVM address
    if (CONTRACT_ID) {
      contractId = ContractId.fromString(CONTRACT_ID);
    } else {
      contractId = ContractId.fromEvmAddress(0, 0, DEPLOYED_CONTRACT_ADDRESS);
    }

    console.log("───────────────────────────────────────────────────────");
    console.log("⚡ Starting rule registration...\n");
  }

  const results = [];
  let successCount = 0;
  let failCount = 0;

  // Register each rule
  for (const rule of rulesToRegister) {
    console.log(
      `[${rule.id}/${ruleSet.rules.length}] ${rule.normalized_multiset} → ${rule.output}`
    );
    console.log(`   Domain: ${rule.domain}`);
    console.log(`   Category: ${rule.category}`);
    console.log(`   Operator: ${rule.operator}`);

    if (options.dryRun) {
      console.log(`   ✓ DRY RUN - Would register rule\n`);
      continue;
    }

    try {
      // Resolve token addresses
      const inputAddrs = rule.inputs.map((sym) => getTokenConfig(sym).addr);
      const outputAddr = getTokenConfig(rule.output).addr;

      // Parse domain
      const [domain, subdomain] = rule.domain.split(".");

      // Register rule
      const result = await setReasoningRule(client, contractId, {
        domain,
        subdomain,
        operator: rule.operator,
        inputAddresses: inputAddrs,
        outputAddress: outputAddr,
        ratioNumerator: rule.ratio || 1,
      });

      console.log(`   ✅ Success`);
      console.log(`      Rule ID: ${result.ruleId}`);
      console.log(`      Tx: ${result.txHash}`);

      results.push({
        ruleNumber: rule.id,
        ruleId: result.ruleId,
        inputs: rule.inputs,
        output: rule.output,
        domain: rule.domain,
        txHash: result.txHash,
        status: "success",
      });

      successCount++;
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);

      results.push({
        ruleNumber: rule.id,
        inputs: rule.inputs,
        output: rule.output,
        domain: rule.domain,
        status: "failed",
        error: error.message,
      });

      failCount++;
    }

    console.log("");

    // Rate limiting (avoid overwhelming the network)
    if (!options.dryRun) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // Close client
  if (client) {
    client.close();
  }

  // Final summary
  console.log("═══════════════════════════════════════════════════════");
  console.log("  Registration Complete");
  console.log("═══════════════════════════════════════════════════════\n");

  if (!options.dryRun) {
    console.log(`✅ Success: ${successCount} rules`);
    console.log(`❌ Failed:  ${failCount} rules`);
    console.log(`📊 Total:   ${rulesToRegister.length} rules\n`);

    // Write results to file
    const outputPath = path.resolve(
      __dirname,
      `../../proofs/rule_registration_${Date.now()}.json`
    );
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(
      outputPath,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          contract: DEPLOYED_CONTRACT_ADDRESS,
          contractId: contractId.toString(),
          ruleSet: ruleSet.nsid,
          totalRules: rulesToRegister.length,
          successCount,
          failCount,
          results,
        },
        null,
        2
      )
    );

    console.log(`📁 Results saved to: ${outputPath}\n`);
  }
}

// ────────────────────────────────────────────────────────────
// Execute
// ────────────────────────────────────────────────────────────

main().catch((error) => {
  console.error("\n❌ Fatal error:", error.message);
  console.error(error.stack);
  process.exit(1);
});
