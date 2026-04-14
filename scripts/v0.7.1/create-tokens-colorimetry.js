#!/usr/bin/env node

/**
 * @fileoverview Create 7 colorimetry tokens for RGB tertiaries + CMYK KEY channel
 * @module scripts/v0.7.1/create-tokens-colorimetry
 *
 * Creates 7 fungible tokens on Hedera testnet:
 * - 6 RGB tertiary colors (0 initial supply, contract-minted)
 * - 1 KEY token for CMYK K-channel (0 initial supply, contract-minted)
 *
 * Reference: Suresh, M. & Jain, K. (2015). doi:10.1016/j.procs.2015.08.062
 *
 * Usage:
 *   node scripts/v0.7.1/create-tokens-colorimetry.js [--dry-run]
 *
 * Prerequisites:
 *   .env must contain operator credentials
 */

import {
  Client,
  PrivateKey,
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
} from "@hashgraph/sdk";
import { getOperatorConfig } from "../v0.6.3/lib/config.js";
import * as logger from "../v0.6.3/lib/logger.js";

/**
 * Token definitions for colorimetry expansion.
 * 6 RGB tertiaries (primary + adjacent secondary on the color wheel)
 * + 1 KEY (CMYK K-channel — ink density, distinct from entity BLACK)
 */
const TOKEN_DEFS = [
  // RGB Tertiaries (contract-minted via ContractProof)
  { name: "Orange",       symbol: "ORANGE",     color: "#FF8000", initialSupply: 0 },
  { name: "Chartreuse",   symbol: "CHARTREUSE", color: "#80FF00", initialSupply: 0 },
  { name: "Spring Green", symbol: "SPRING_GRN", color: "#00FF80", initialSupply: 0 },
  { name: "Azure",        symbol: "AZURE",      color: "#0080FF", initialSupply: 0 },
  { name: "Violet",       symbol: "VIOLET",     color: "#8000FF", initialSupply: 0 },
  { name: "Rose",         symbol: "ROSE",       color: "#FF0080", initialSupply: 0 },

  // CMYK K-channel (distinct from entity BLACK — ink density vs void/absence)
  { name: "Key",          symbol: "KEY",        color: "#000000", initialSupply: 0 },
];

/**
 * Create a single token with metadata key
 * @param {Client} client - Hedera SDK client
 * @param {Object} def - Token definition
 * @param {string} operatorId - Operator account ID
 * @param {PrivateKey} operatorKey - Operator private key
 * @returns {Promise<{tokenId: string, evmAddress: string}>}
 */
async function createToken(client, def, operatorId, operatorKey) {
  const memo = JSON.stringify({
    name: def.name,
    symbol: def.symbol,
    color: def.color,
  });

  const transaction = await new TokenCreateTransaction()
    .setTokenName(`$${def.symbol}`)
    .setTokenSymbol(def.symbol)
    .setTokenMemo(memo)
    .setTokenType(TokenType.FungibleCommon)
    .setDecimals(0)
    .setInitialSupply(def.initialSupply)
    .setTreasuryAccountId(operatorId)
    .setSupplyType(TokenSupplyType.Infinite)
    .setAdminKey(operatorKey.publicKey)
    .setSupplyKey(operatorKey.publicKey)
    .setMetadataKey(operatorKey.publicKey)
    .freezeWith(client)
    .sign(operatorKey);

  const response = await transaction.execute(client);
  const receipt = await response.getReceipt(client);
  const tokenId = receipt.tokenId;

  if (!tokenId) {
    throw new Error(`Token creation failed for ${def.symbol}: no token ID returned`);
  }

  const evmAddress = "0x" + tokenId.toSolidityAddress();
  return { tokenId: tokenId.toString(), evmAddress };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  logger.section("Colorimetry Expansion — Create 7 New Tokens");
  logger.info("Reference: Suresh & Jain (2015) doi:10.1016/j.procs.2015.08.062");

  const operatorConfig = getOperatorConfig();
  logger.info("Operator loaded", { id: operatorConfig.id });

  if (dryRun) {
    logger.subsection("DRY RUN — Would create 7 tokens:");
    for (const def of TOKEN_DEFS) {
      console.log(`  $${def.symbol} (${def.color}) — reasoned, supply: 0`);
    }
    console.log("\nAll tokens will have:");
    console.log("  - adminKey: operator");
    console.log("  - supplyKey: operator (migrate to contract after creation)");
    console.log("  - metadataKey: operator (HIP-646/657)");
    return;
  }

  const operatorKey = PrivateKey.fromString(operatorConfig.derKey);
  const client = Client.forTestnet().setOperator(operatorConfig.id, operatorKey);

  try {
    const results = [];

    for (const def of TOKEN_DEFS) {
      logger.info(`Creating $${def.symbol} (${def.color})...`);

      try {
        const result = await createToken(client, def, operatorConfig.id, operatorKey);
        results.push({ ...def, ...result });
        logger.success(`$${def.symbol} created`, {
          tokenId: result.tokenId,
          evmAddress: result.evmAddress,
        });
      } catch (error) {
        logger.error(`Failed to create $${def.symbol}`, error);
        throw error;
      }
    }

    // Print .env update block
    logger.subsection("Update .env with these values");
    for (const r of results) {
      console.log(`${r.symbol}_TOKEN_ID=${r.tokenId}`);
      console.log(`${r.symbol}_ADDR=${r.evmAddress}`);
    }

    // Print summary table
    logger.subsection("Token Summary");
    logger.table(
      Object.fromEntries(results.map(r => [
        `$${r.symbol}`,
        `${r.tokenId}  ${r.evmAddress}`
      ]))
    );

    logger.subsection("Next Steps");
    logger.info("1. Update .env with the token IDs and addresses above");
    logger.info("2. Migrate supply keys: node scripts/v0.7/migrate-supply-keys-v07.js --sphere v08");
    logger.info("3. Publish rules: node scripts/v0.7.1/publish-all-rules-colorimetry.js --sphere v08");

  } finally {
    client.close();
  }
}

main().catch((err) => {
  logger.error("Failed to create tokens", err);
  process.exit(1);
});
