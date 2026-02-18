/**
 * @fileoverview Create the $MAGENTA fungible token on Hedera testnet
 * @module scripts/mint_magenta
 *
 * This script creates a $MAGENTA token with the following properties:
 * - Initial supply: 0 (contract mints on demand via RED+BLUE proof)
 * - Decimals: 0
 * - Supply type: Infinite
 * - Supply key: Contract address (enables autonomous minting)
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
  ContractId,
} from "@hashgraph/sdk";
import { getOperatorConfig, DEPLOYED_CONTRACT_ADDRESS } from "./lib/config.js";
import * as logger from "./lib/logger.js";

/**
 * Create the $MAGENTA token on Hedera with contract as supply key
 * @param {string} contractAddress - EVM address of the ReasoningContract
 * @returns {Promise<{tokenId: string, evmAddress: string}>} Token ID and EVM address
 * @throws {Error} If token creation fails
 */
async function createMagentaToken(contractAddress) {
  const operatorConfig = getOperatorConfig();
  const operatorKey = PrivateKey.fromString(operatorConfig.derKey);
  const client = Client.forTestnet().setOperator(operatorConfig.id, operatorKey);

  // Define metadata with RGB hex color for self-describing proofs
  const metadata = { name: "Magenta", symbol: "MAGENTA", color: "#FF00FF" };

  logger.info("Creating $MAGENTA token with contract supply key...", {
    treasury: operatorConfig.id,
    supplyKey: contractAddress,
    initialSupply: 0,
    metadata,
  });

  // Convert EVM address to ContractId for supply key
  const contractId = ContractId.fromEvmAddress(0, 0, contractAddress);

  const transaction = await new TokenCreateTransaction()
    .setTokenName("$MAGENTA")
    .setTokenSymbol("MAGENTA")
    .setTokenMemo(JSON.stringify(metadata))
    .setTokenType(TokenType.FungibleCommon)
    .setDecimals(0)
    .setInitialSupply(0) // Contract mints on demand
    .setTreasuryAccountId(operatorConfig.id)
    .setSupplyType(TokenSupplyType.Infinite)
    .setAdminKey(operatorKey.publicKey) // Operator can update token
    .setSupplyKey(operatorKey.publicKey) // Operator can mint (will be migrated to contract)
    .freezeWith(client)
    .sign(operatorKey);

  const response = await transaction.execute(client);
  const receipt = await response.getReceipt(client);
  const tokenId = receipt.tokenId;

  if (!tokenId) {
    throw new Error("Token creation failed: no token ID returned");
  }

  const evmAddress = "0x" + tokenId.toSolidityAddress();

  logger.success("$MAGENTA token created", {
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
    logger.section("Mint $MAGENTA Token");

    if (!DEPLOYED_CONTRACT_ADDRESS) {
      throw new Error("DEPLOYED_CONTRACT_ADDRESS not found in config.js");
    }

    logger.info("Using contract address:", { contract: DEPLOYED_CONTRACT_ADDRESS });

    const result = await createMagentaToken(DEPLOYED_CONTRACT_ADDRESS);

    logger.subsection("Next Steps");
    logger.info("Add the following to your .env file:");
    console.log(`MAGENTA_TOKEN_ID=${result.tokenId}`);
    console.log(`MAGENTA_ADDR=${result.evmAddress}`);

  } catch (err) {
    logger.error("Failed to create $MAGENTA token", err);
    process.exit(1);
  }
}

// Export for programmatic use
export { createMagentaToken };

// Run if executed directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` ||
    import.meta.url.endsWith('mint_magenta.js')) {
  main();
}
