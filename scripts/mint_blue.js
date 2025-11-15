/**
 * @fileoverview Create the $BLUE fungible token on Hedera testnet
 * @module scripts/mint_blue
 *
 * This script creates a $BLUE token with the following properties:
 * - Initial supply: 1,000,000 units (replenishable operator-controlled axiom)
 * - Decimals: 0
 * - Supply type: Infinite
 * - Admin key: Operator (allows future updates)
 * - Supply key: Operator (allows minting more units)
 * - Treasury: Operator account
 *
 * Part of the Ontologic RGB primitive layer (human-minted base morphemes)
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
 * Create the $BLUE token on Hedera
 * @returns {Promise<{tokenId: string, evmAddress: string}>} Token ID and EVM address
 * @throws {Error} If token creation fails
 */
async function createBlueToken() {
  const operatorConfig = getOperatorConfig();
  const operatorKey = PrivateKey.fromString(operatorConfig.derKey);
  const client = Client.forTestnet().setOperator(operatorConfig.id, operatorKey);

  // Define metadata with RGB hex color for self-describing proofs
  const metadata = { name: "Blue", symbol: "BLUE", color: "#0000FF" };

  logger.info("Creating $BLUE token with operator control...", {
    treasury: operatorConfig.id,
    initialSupply: 1000000,
    adminKey: "operator",
    supplyKey: "operator",
    metadata,
  });

  const transaction = await new TokenCreateTransaction()
    .setTokenName("$BLUE")
    .setTokenSymbol("BLUE")
    .setTokenMemo(JSON.stringify(metadata))
    .setTokenType(TokenType.FungibleCommon)
    .setDecimals(0)
    .setInitialSupply(1000000) // 1M units for resilient testing
    .setTreasuryAccountId(operatorConfig.id)
    .setSupplyType(TokenSupplyType.Infinite)
    .setAdminKey(operatorKey.publicKey) // Operator can update token
    .setSupplyKey(operatorKey.publicKey) // Operator can mint more
    .freezeWith(client)
    .sign(operatorKey);

  const response = await transaction.execute(client);
  const receipt = await response.getReceipt(client);
  const tokenId = receipt.tokenId;

  if (!tokenId) {
    throw new Error("Token creation failed: no token ID returned");
  }

  const evmAddress = "0x" + tokenId.toSolidityAddress();

  logger.success("$BLUE token created", {
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
    logger.section("Mint $BLUE Token");

    const result = await createBlueToken();

    logger.subsection("Next Steps");
    logger.info("Add the following to your .env file:");
    console.log(`BLUE_TOKEN_ID=${result.tokenId}`);
    console.log(`BLUE_ADDR=${result.evmAddress}`);

  } catch (err) {
    logger.error("Failed to create $BLUE token", err);
    process.exit(1);
  }
}

// Export for programmatic use
export { createBlueToken };

// Run if executed directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` ||
    import.meta.url.endsWith('mint_blue.js')) {
  main();
}
