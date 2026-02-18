/**
 * @fileoverview Create the $BLACK fungible token on Hedera testnet
 * @module scripts/mint_black
 *
 * This script creates a $BLACK token with the following properties:
 * - Initial supply: 0 (contract mints on demand)
 * - Decimals: 0
 * - Supply type: Infinite
 * - Supply key: Contract address (enables autonomous minting)
 * - Treasury: Operator account
 *
 * Aligned with Ontologic v0.4.5 provenance layer design.
 */

import {
  Client,
  PrivateKey,
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
  ContractId,
} from "@hashgraph/sdk";
import { getOperatorConfig, DEPLOYED_CONTRACT_ADDRESS } from "./lib/config.js";
import * as logger from "./lib/logger.js";

/**
 * Create the $BLACK token (CMYK 'K') with the contract as supply key.
 * @param {string} contractAddress - EVM address of the ReasoningContract.
 * @returns {Promise<{tokenId: string, evmAddress: string}>}
 * @throws {Error} If token creation fails.
 */
async function createBlackToken(contractAddress) {
  const operatorConfig = getOperatorConfig();
  const operatorKey = PrivateKey.fromString(operatorConfig.derKey);
  const client = Client.forTestnet().setOperator(operatorConfig.id, operatorKey);

  // Self-describing metadata for Ontologic compositional proofs
  const metadata = { name: "Black", symbol: "BLACK", color: "#000000" };

  logger.info("Creating $BLACK token with contract supply key...", {
    treasury: operatorConfig.id,
    supplyKey: contractAddress,
    initialSupply: 0,
    metadata,
  });

  // Convert EVM address to Hedera ContractId for the supply key
  const contractId = ContractId.fromEvmAddress(0, 0, contractAddress);

  const transaction = await new TokenCreateTransaction()
    .setTokenName("$BLACK")
    .setTokenSymbol("BLACK")
    .setTokenMemo(JSON.stringify(metadata))
    .setTokenType(TokenType.FungibleCommon)
    .setDecimals(0)
    .setInitialSupply(0)
    .setTreasuryAccountId(operatorConfig.id)
    .setSupplyType(TokenSupplyType.Infinite)
    .setSupplyKey(contractId)
    .freezeWith(client)
    .sign(operatorKey);

  const response = await transaction.execute(client);
  const receipt = await response.getReceipt(client);
  const tokenId = receipt.tokenId;

  if (!tokenId) {
    throw new Error("Token creation failed: no token ID returned");
  }

  const evmAddress = "0x" + tokenId.toSolidityAddress();

  logger.success("$BLACK token created", {
    tokenId: tokenId.toString(),
    evmAddress,
    supplyKey: contractAddress,
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
    logger.section("Mint $BLACK Token");

    if (!DEPLOYED_CONTRACT_ADDRESS) {
      throw new Error("DEPLOYED_CONTRACT_ADDRESS not found in config.js");
    }

    logger.info("Using contract address:", { contract: DEPLOYED_CONTRACT_ADDRESS });

    const result = await createBlackToken(DEPLOYED_CONTRACT_ADDRESS);

    logger.subsection("Next Steps");
    logger.info("Add the following to your .env file:");
    console.log(`BLACK_TOKEN_ID=${result.tokenId}`);
    console.log(`BLACK_ADDR=${result.evmAddress}`);

  } catch (err) {
    logger.error("Failed to create $BLACK token", err);
    process.exit(1);
  }
}

// Export for programmatic use
export { createBlackToken };

// Run directly if executed as standalone script
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` ||
    import.meta.url.endsWith('mint_black.js')) {
  main();
}
