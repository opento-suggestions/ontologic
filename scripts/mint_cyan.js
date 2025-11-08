/**
 * @fileoverview Create the $CYAN fungible token on Hedera testnet
 * @module scripts/mint_cyan
 *
 * This script creates a $CYAN token with the following properties:
 * - Initial supply: 10 units
 * - Decimals: 0
 * - Supply type: Infinite
 * - Treasury: Operator account
 *
 * Part of the Ontologic three-layer provenance architecture (Layer 2: TOKENMINT)
 */

import {
  Client,
  PrivateKey,
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
} from "@hashgraph/sdk";
import { getOperatorConfig } from "./lib/config.js";
import * as logger from "./lib/logger.js";

/**
 * Create the $CYAN token on Hedera
 * @returns {Promise<{tokenId: string, evmAddress: string}>} Token ID and EVM address
 * @throws {Error} If token creation fails
 */
async function createCyanToken() {
  const operatorConfig = getOperatorConfig();
  const operatorKey = PrivateKey.fromString(operatorConfig.derKey);
  const client = Client.forTestnet().setOperator(operatorConfig.id, operatorKey);

  // Define metadata with RGB hex color for self-describing proofs
  const metadata = { name: "Cyan", symbol: "CYAN", color: "#00FFFF" };

  logger.info("Creating $CYAN token...", {
    treasury: operatorConfig.id,
    initialSupply: 10,
    metadata,
  });

  const transaction = await new TokenCreateTransaction()
    .setTokenName("$CYAN")
    .setTokenSymbol("CYAN")
    .setTokenMemo(JSON.stringify(metadata))
    .setTokenType(TokenType.FungibleCommon)
    .setDecimals(0)
    .setInitialSupply(10)
    .setTreasuryAccountId(operatorConfig.id)
    .setSupplyType(TokenSupplyType.Infinite)
    .freezeWith(client)
    .sign(operatorKey);

  const response = await transaction.execute(client);
  const receipt = await response.getReceipt(client);
  const tokenId = receipt.tokenId;

  if (!tokenId) {
    throw new Error("Token creation failed: no token ID returned");
  }

  const evmAddress = "0x" + tokenId.toSolidityAddress();

  logger.success("$CYAN token created", {
    tokenId: tokenId.toString(),
    evmAddress,
  });

  return {
    tokenId: tokenId.toString(),
    evmAddress,
  };
}

/**
 * Main execution function
 * @returns {Promise<void>}
 */
async function main() {
  try {
    logger.section("Mint $CYAN Token");

    const result = await createCyanToken();

    logger.subsection("Next Steps");
    logger.info("Add the following to your .env file:");
    console.log(`CYAN_TOKEN_ID=${result.tokenId}`);
    console.log(`CYAN_ADDR=${result.evmAddress}`);

  } catch (err) {
    logger.error("Failed to create $CYAN token", err);
    process.exit(1);
  }
}

// Export for programmatic use
export { createCyanToken };

// Run if executed directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` ||
    import.meta.url.endsWith('mint_cyan.js')) {
  main();
}
