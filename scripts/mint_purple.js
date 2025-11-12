/**
 * @fileoverview Create the $PURPLE fungible token with contract supply key
 * @module scripts/mint_purple
 *
 * This script creates a $PURPLE token with the following properties:
 * - Initial supply: 0 (contract mints on demand)
 * - Decimals: 0
 * - Supply type: Infinite
 * - Supply key: ReasoningContract address (enables autonomous minting)
 * - Treasury: Operator account
 *
 * The contract address must have supply key permissions to mint $PURPLE tokens
 * during reasoning operations (Layer 2: TOKENMINT in the three-layer architecture).
 */

import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import {
  Client,
  PrivateKey,
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
  ContractId,
} from "@hashgraph/sdk";
import * as logger from "./lib/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.example
config({ path: path.join(__dirname, "..", ".env.example") });

/**
 * Create the $PURPLE token with contract as supply key
 * @param {string} contractAddress - EVM address of ReasoningContract
 * @returns {Promise<{tokenId: string, evmAddress: string}>} Token ID and EVM address
 * @throws {Error} If token creation fails
 */
async function createPurpleToken(contractAddress) {
  const operatorId = process.env.OPERATOR_ID;
  const operatorKey = PrivateKey.fromStringDer(process.env.OPERATOR_DER_KEY);
  const client = Client.forTestnet().setOperator(operatorId, operatorKey);

  // Define metadata with RGB hex color for self-describing proofs
  const metadata = { name: "Purple", symbol: "PURPLE", color: "#800080" };

  logger.info("Creating $PURPLE token with contract supply key...", {
    treasury: operatorId,
    supplyKey: contractAddress,
    initialSupply: 0,
    metadata,
  });

  // Convert EVM address to ContractId for supply key
  const contractId = ContractId.fromEvmAddress(0, 0, contractAddress);

  const transaction = await new TokenCreateTransaction()
    .setTokenName("$PURPLE")
    .setTokenSymbol("PURPLE")
    .setTokenMemo(JSON.stringify(metadata))
    .setTokenType(TokenType.FungibleCommon)
    .setDecimals(0)
    .setInitialSupply(0) // Contract mints on demand
    .setTreasuryAccountId(operatorId)
    .setSupplyType(TokenSupplyType.Infinite)
    .setSupplyKey(contractId) // Contract can mint
    .freezeWith(client)
    .sign(operatorKey);

  const response = await transaction.execute(client);
  const receipt = await response.getReceipt(client);
  const tokenId = receipt.tokenId;

  if (!tokenId) {
    throw new Error("Token creation failed: no token ID returned");
  }

  const evmAddress = "0x" + tokenId.toSolidityAddress();

  logger.success("$PURPLE token created", {
    tokenId: tokenId.toString(),
    evmAddress,
    supplyKeyContract: contractAddress,
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
    logger.section("Mint $PURPLE Token");

    const contractAddress = process.env.CONTRACT_ADDR;
    if (!contractAddress) {
      logger.error("CONTRACT_ADDR not found in .env.example");
      process.exit(1);
    }
    logger.info("Using contract address from .env.example", { contractAddress });

    const result = await createPurpleToken(contractAddress);

    logger.subsection("Next Steps");
    logger.info("Add the following to your .env file:");
    console.log(`PURPLE_TOKEN_ID=${result.tokenId}`);
    console.log(`PURPLE_ADDR=${result.evmAddress}`);

    logger.subsection("Important");
    logger.info(
      `The ReasoningContract (${contractAddress}) now has supply key ` +
      `permissions and can autonomously mint $PURPLE tokens during reasoning operations.`
    );

  } catch (err) {
    logger.error("Failed to create $PURPLE token", err);
    process.exit(1);
  }
}

// Export for programmatic use
export { createPurpleToken };

// Run if executed directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` ||
    import.meta.url.endsWith('mint_purple.js')) {
  main();
}
