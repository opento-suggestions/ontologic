/**
 * @fileoverview Create the $RED fungible token on Hedera testnet
 * @module scripts/mint_red
 *
 * This script creates a $RED token with the following properties:
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
 * Create the $RED token on Hedera
 * @returns {Promise<{tokenId: string, evmAddress: string}>} Token ID and EVM address
 * @throws {Error} If token creation fails
 */
async function createRedToken() {
  const operatorConfig = getOperatorConfig();
  const operatorKey = PrivateKey.fromString(operatorConfig.derKey);
  const client = Client.forTestnet().setOperator(operatorConfig.id, operatorKey);

  // Define metadata with RGB hex color for self-describing proofs
  const metadata = { name: "Red", symbol: "RED", color: "#FF0000" };

  logger.info("Creating $RED token with operator control...", {
    treasury: operatorConfig.id,
    initialSupply: 1000000,
    adminKey: "operator",
    supplyKey: "operator",
    metadata,
  });

  const transaction = await new TokenCreateTransaction()
    .setTokenName("$RED")
    .setTokenSymbol("RED")
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

  logger.success("$RED token created", {
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
    logger.section("Mint $RED Token");

    const result = await createRedToken();

    logger.subsection("Next Steps");
    logger.info("Add the following to your .env file:");
    console.log(`RED_TOKEN_ID=${result.tokenId}`);
    console.log(`RED_ADDR=${result.evmAddress}`);

  } catch (err) {
    logger.error("Failed to create $RED token", err);
    process.exit(1);
  }
}

// Export for programmatic use
export { createRedToken };

// Run if executed directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` ||
    import.meta.url.endsWith('mint_red.js')) {
  main();
}
