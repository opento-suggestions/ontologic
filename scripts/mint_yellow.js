/**
 * @fileoverview Create the $YELLOW fungible token on Hedera testnet
 * @module scripts/mint_yellow
 *
 * This script creates a $YELLOW token with the following properties:
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
 * Create the $YELLOW token on Hedera
 * @returns {Promise<{tokenId: string, evmAddress: string}>} Token ID and EVM address
 * @throws {Error} If token creation fails
 */
async function createYellowToken() {
  const operatorConfig = getOperatorConfig();
  const operatorKey = PrivateKey.fromString(operatorConfig.derKey);
  const client = Client.forTestnet().setOperator(operatorConfig.id, operatorKey);

  // Define metadata with RGB hex color for self-describing proofs
  const metadata = { name: "Yellow", symbol: "YELLOW", color: "#FFFF00" };

  logger.info("Creating $YELLOW token...", {
    treasury: operatorConfig.id,
    initialSupply: 10,
    metadata,
  });

  const transaction = await new TokenCreateTransaction()
    .setTokenName("$YELLOW")
    .setTokenSymbol("YELLOW")
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

  logger.success("$YELLOW token created", {
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
    logger.section("Mint $YELLOW Token");

    const result = await createYellowToken();

    logger.subsection("Next Steps");
    logger.info("Add the following to your .env file:");
    console.log(`YELLOW_TOKEN_ID=${result.tokenId}`);
    console.log(`YELLOW_ADDR=${result.evmAddress}`);

  } catch (err) {
    logger.error("Failed to create $YELLOW token", err);
    process.exit(1);
  }
}

// Export for programmatic use
export { createYellowToken };

// Run if executed directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` ||
    import.meta.url.endsWith('mint_yellow.js')) {
  main();
}
