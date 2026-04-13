#!/usr/bin/env node

/**
 * @fileoverview Create all nine color tokens with metadata keys for v0.7.1
 * @module scripts/v0.7.1/create-tokens
 *
 * Creates 9 fungible tokens on Hedera testnet:
 * - RGB axioms (1M initial supply, operator supply key)
 * - CMY + WHITE + BLACK + PURPLE reasoned tokens (0 initial supply)
 * - ALL tokens get metadataKey = operator (HIP-646/657 support)
 *
 * Usage:
 *   node scripts/v0.7.1/create-tokens.js [--dry-run]
 *
 * Prerequisites:
 *   .env must contain the NEW operator credentials (from create-operator.js)
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
 * Token definitions for all nine color tokens.
 * RGB axioms get 1M initial supply; all others start at 0.
 */
const TOKEN_DEFS = [
  // RGB Axioms (primary colors — operator-controlled supply)
  { name: "Red",     symbol: "RED",     color: "#FF0000", initialSupply: 1_000_000 },
  { name: "Green",   symbol: "GREEN",   color: "#00FF00", initialSupply: 1_000_000 },
  { name: "Blue",    symbol: "BLUE",    color: "#0000FF", initialSupply: 1_000_000 },

  // CMY Reasoned tokens (contract-minted proof outputs)
  { name: "Yellow",  symbol: "YELLOW",  color: "#FFFF00", initialSupply: 0 },
  { name: "Cyan",    symbol: "CYAN",    color: "#00FFFF", initialSupply: 0 },
  { name: "Magenta", symbol: "MAGENTA", color: "#FF00FF", initialSupply: 0 },

  // Entity verdict tokens (contract-minted)
  { name: "White",   symbol: "WHITE",   color: "#FFFFFF", initialSupply: 0 },
  { name: "Black",   symbol: "BLACK",   color: "#000000", initialSupply: 0 },
  { name: "Purple",  symbol: "PURPLE",  color: "#800080", initialSupply: 0 },
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

  logger.section("v0.7.1 Reformation — Phase 2: Create Nine Tokens");

  const operatorConfig = getOperatorConfig();
  logger.info("Operator loaded", { id: operatorConfig.id });

  if (dryRun) {
    logger.subsection("DRY RUN — Would create 9 tokens:");
    for (const def of TOKEN_DEFS) {
      const type = def.initialSupply > 0 ? "axiom" : "reasoned";
      console.log(`  $${def.symbol} (${def.color}) — ${type}, supply: ${def.initialSupply.toLocaleString()}`);
    }
    console.log("\nAll tokens will have:");
    console.log("  - adminKey: operator");
    console.log("  - supplyKey: operator (6 migrated to contract in Phase 4)");
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
    logger.info("2. Compile contracts: npm run build");
    logger.info("3. Create sphere: node scripts/v0.7/create_sphere.js v08");

  } finally {
    client.close();
  }
}

main().catch((err) => {
  logger.error("Failed to create tokens", err);
  process.exit(1);
});
