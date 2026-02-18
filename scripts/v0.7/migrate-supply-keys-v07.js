#!/usr/bin/env node

/**
 * @fileoverview Migrate token supply keys to v0.7 contract
 * @module scripts/v07/migrate-supply-keys-v07
 *
 * Usage: node scripts/v0.7/migrate-supply-keys-v07.js [--sphere <name>] [--dry-run]
 *
 * Migrates supply keys for proof-output tokens (CMY + WHITE + BLACK + PURPLE)
 * from the v0.6.3 contract to the v0.7 contract.
 *
 * WARNING: This breaks v0.6.3 minting capability for these tokens!
 *
 * Architecture:
 * - RGB primaries: Treasury-controlled (operator), never minted by contract
 * - CMY + WHITE + BLACK + PURPLE: Contract-minted proof outputs
 */

import {
  Client,
  PrivateKey,
  TokenUpdateTransaction,
  ContractId
} from "@hashgraph/sdk";
import { getOperatorConfig } from "../v0.6.3/lib/config.js";
import { loadSphereConfig } from "./lib/sphere-config.js";

// Tokens that need supply key migration (proof outputs)
const TOKENS_TO_MIGRATE = [
  { symbol: "YELLOW", idEnv: "YELLOW_TOKEN_ID" },
  { symbol: "CYAN", idEnv: "CYAN_TOKEN_ID" },
  { symbol: "MAGENTA", idEnv: "MAGENTA_TOKEN_ID" },
  { symbol: "WHITE", idEnv: "WHITE_TOKEN_ID" },
  { symbol: "BLACK", idEnv: "BLACK_TOKEN_ID" },
  { symbol: "PURPLE", idEnv: "PURPLE_TOKEN_ID" }
];

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  const getArg = (flag) => {
    const idx = args.indexOf(flag);
    return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
  };

  const sphereName = getArg("--sphere") || "demo";
  const dryRun = args.includes("--dry-run");

  console.log("=".repeat(60));
  console.log("Ontologic v0.7 Supply Key Migration");
  console.log("=".repeat(60));
  console.log(`Sphere: ${sphereName}`);
  console.log(`Dry Run: ${dryRun}`);

  // Load configs
  const operatorConfig = getOperatorConfig();
  const sphereConfig = loadSphereConfig(sphereName);

  if (!sphereConfig.contractId) {
    console.error("Error: Sphere config missing contractId");
    process.exit(1);
  }

  console.log(`\nOperator: ${operatorConfig.id}`);
  console.log(`Target Contract: ${sphereConfig.contractId}`);

  // Build token list with IDs from environment
  const tokens = TOKENS_TO_MIGRATE.map(t => ({
    symbol: t.symbol,
    id: process.env[t.idEnv]
  })).filter(t => t.id);

  console.log(`\nTokens to migrate (${tokens.length}):`);
  tokens.forEach(t => console.log(`  - ${t.symbol}: ${t.id}`));

  if (dryRun) {
    console.log("\n[DRY RUN] Would migrate supply keys:");
    tokens.forEach(t => {
      console.log(`  ${t.symbol} (${t.id}) → ContractId(${sphereConfig.contractId})`);
    });
    console.log("\nWARNING: This will break v0.6.3 minting for these tokens!");
    return;
  }

  // Confirm action
  console.log("\n" + "!".repeat(60));
  console.log("WARNING: This will migrate supply keys to the v0.7 contract!");
  console.log("         The v0.6.3 contract will NO LONGER be able to mint.");
  console.log("!".repeat(60));

  // Initialize client
  const privateKey = PrivateKey.fromStringDer(operatorConfig.derKey);
  const client = Client.forTestnet().setOperator(operatorConfig.id, privateKey);

  const contractId = ContractId.fromString(sphereConfig.contractId);

  try {
    console.log("\nMigrating supply keys...\n");

    for (const token of tokens) {
      console.log(`Migrating ${token.symbol} (${token.id})...`);

      try {
        const updateTx = await new TokenUpdateTransaction()
          .setTokenId(token.id)
          .setSupplyKey(contractId)
          .freezeWith(client);

        const signedTx = await updateTx.sign(privateKey);
        const response = await signedTx.execute(client);
        const receipt = await response.getReceipt(client);

        console.log(`  ✓ ${token.symbol}: ${receipt.status.toString()}`);
      } catch (error) {
        console.error(`  ✗ ${token.symbol}: ${error.message}`);
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("Migration Complete");
    console.log("=".repeat(60));
    console.log(`Contract ${sphereConfig.contractId} now controls supply keys for:`);
    tokens.forEach(t => console.log(`  - ${t.symbol}`));

  } finally {
    client.close();
  }
}

main().catch((err) => {
  console.error("\nError:", err.message);
  process.exit(1);
});
