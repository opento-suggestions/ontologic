/**
 * @fileoverview Batch mint tokens to operator treasury using Hedera SDK
 * @module scripts/batch-mint-tokens
 *
 * Usage: node scripts/batch-mint-tokens.js [--amount 1000] [--tokens RED,GREEN,BLUE]
 *
 * Mints additional supply for tokens that have operator as supply key.
 * Does NOT work for tokens with contract as supply key (use contract minting instead).
 *
 * Aligned with Ontologic v0.4.5 token architecture.
 */

import {
  Client,
  PrivateKey,
  TokenMintTransaction,
  TokenId,
} from "@hashgraph/sdk";
import { getOperatorConfig } from "./lib/config.js";
import * as logger from "./lib/logger.js";
import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.example
config({ path: path.join(__dirname, "..", ".env.example") });

/**
 * Token definitions with their env var keys
 * Only include tokens where operator has supply key (NOT contract-minted tokens)
 */
const TOKEN_DEFINITIONS = {
  RED: { tokenIdKey: "RED_TOKEN_ID", addrKey: "RED_ADDR" },
  GREEN: { tokenIdKey: "GREEN_TOKEN_ID", addrKey: "GREEN_ADDR" },
  BLUE: { tokenIdKey: "BLUE_TOKEN_ID", addrKey: "BLUE_ADDR" },
  PURPLE: { tokenIdKey: "PURPLE_TOKEN_ID", addrKey: "PURPLE_ADDR" },
  ORANGE: { tokenIdKey: "ORANGE_TOKEN_ID", addrKey: "ORANGE_ADDR" },
  // Note: YELLOW, CYAN, MAGENTA, WHITE, BLACK have contract as supply key
  // Use contract's reason() function to mint those tokens
};

/**
 * Parse command line arguments
 * @returns {{amount: number, tokens: string[]}}
 */
function parseArgs() {
  const args = process.argv.slice(2);
  let amount = 1000; // Default amount
  let tokens = Object.keys(TOKEN_DEFINITIONS); // Default: all tokens

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--amount" && args[i + 1]) {
      amount = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--tokens" && args[i + 1]) {
      tokens = args[i + 1].split(",").map(t => t.trim().toUpperCase());
      i++;
    }
  }

  // Validate tokens
  const invalid = tokens.filter(t => !TOKEN_DEFINITIONS[t]);
  if (invalid.length > 0) {
    throw new Error(`Invalid token symbols: ${invalid.join(", ")}`);
  }

  return { amount, tokens };
}

/**
 * Mint tokens for a specific token ID
 * @param {Client} client - Hedera client
 * @param {PrivateKey} operatorKey - Operator private key
 * @param {string} tokenId - Token ID (e.g., "0.0.7238644")
 * @param {string} symbol - Token symbol for logging
 * @param {number} amount - Amount to mint
 * @returns {Promise<{success: boolean, txId?: string, error?: string}>}
 */
async function mintToken(client, operatorKey, tokenId, symbol, amount) {
  try {
    logger.info(`Minting ${amount} units of $${symbol}`, { tokenId });

    const mintTx = await new TokenMintTransaction()
      .setTokenId(TokenId.fromString(tokenId))
      .setAmount(amount)
      .freezeWith(client);

    const signedTx = await mintTx.sign(operatorKey);
    const response = await signedTx.execute(client);
    const receipt = await response.getReceipt(client);

    logger.success(`✅ Minted ${amount} $${symbol}`, {
      tokenId,
      status: receipt.status.toString(),
      txId: response.transactionId.toString(),
      newTotalSupply: receipt.totalSupply?.toString() || "unknown"
    });

    return {
      success: true,
      txId: response.transactionId.toString(),
      newTotalSupply: receipt.totalSupply?.toString()
    };
  } catch (error) {
    logger.error(`❌ Failed to mint $${symbol}`, {
      tokenId,
      error: error.message
    });

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Main execution function
 * @returns {Promise<void>}
 */
async function main() {
  try {
    logger.section("Batch Mint Tokens (v0.4.5)");

    const { amount, tokens } = parseArgs();

    logger.info("Batch mint configuration", {
      amount,
      tokens,
      note: "Only minting tokens with operator supply key"
    });

    const operatorConfig = getOperatorConfig();
    const operatorKey = PrivateKey.fromString(operatorConfig.derKey);
    const client = Client.forTestnet().setOperator(operatorConfig.id, operatorKey);

    logger.subsection("Minting Tokens");

    const results = [];

    for (const symbol of tokens) {
      const tokenIdKey = TOKEN_DEFINITIONS[symbol].tokenIdKey;
      const tokenId = process.env[tokenIdKey];

      if (!tokenId) {
        logger.warning(`⚠️  Skipping $${symbol} - ${tokenIdKey} not found in .env`);
        results.push({ symbol, success: false, error: "Token ID not configured" });
        continue;
      }

      const result = await mintToken(client, operatorKey, tokenId, symbol, amount);
      results.push({ symbol, ...result });

      // Small delay between transactions to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    client.close();

    logger.subsection("Summary");

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    logger.info(`✅ Successfully minted: ${successful.length}/${results.length} tokens`);

    if (successful.length > 0) {
      console.log("\n✅ Success:");
      successful.forEach(r => {
        console.log(`   $${r.symbol}: ${amount} units minted (Total: ${r.newTotalSupply || "unknown"})`);
      });
    }

    if (failed.length > 0) {
      console.log("\n❌ Failed:");
      failed.forEach(r => {
        console.log(`   $${r.symbol}: ${r.error}`);
      });
      process.exit(1);
    }

  } catch (err) {
    logger.error("Batch mint failed", err);
    process.exit(1);
  }
}

// Run directly if executed as standalone script
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` ||
    import.meta.url.endsWith('batch-mint-tokens.js')) {
  main();
}

// Export for programmatic use
export { mintToken };
