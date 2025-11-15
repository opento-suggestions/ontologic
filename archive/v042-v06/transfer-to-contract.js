/**
 * @fileoverview Transfer 1 unit of each proof-output token to contract for auto-association
 * @module scripts/transfer-to-contract
 *
 * Contracts become associated with tokens when they receive them.
 * This script transfers 1 unit of each CMY + WHITE + BLACK + PURPLE token to the contract.
 */

import {
  Client,
  PrivateKey,
  TransferTransaction,
  TokenId,
  AccountId,
} from "@hashgraph/sdk";
import { getOperatorConfig, DEPLOYED_CONTRACT_ADDRESS } from "./lib/config.js";
import * as logger from "./lib/logger.js";

/**
 * Transfer tokens to contract for auto-association
 * @returns {Promise<void>}
 */
async function transferToContract() {
  const operatorConfig = getOperatorConfig();
  const operatorKey = PrivateKey.fromString(operatorConfig.derKey);
  const client = Client.forTestnet().setOperator(operatorConfig.id, operatorKey);

  // Convert EVM address to AccountId
  const evmAddrClean = DEPLOYED_CONTRACT_ADDRESS.toLowerCase().replace("0x", "");
  const entityNum = parseInt(evmAddrClean.slice(-8), 16);
  const contractAccountId = AccountId.fromString(`0.0.${entityNum}`);

  // Proof-output tokens (CMY + WHITE + BLACK + PURPLE)
  // Only transfer tokens the operator actually holds
  const yellowTokenId = TokenId.fromString(process.env.YELLOW_TOKEN_ID);
  const cyanTokenId = TokenId.fromString(process.env.CYAN_TOKEN_ID);
  const magentaTokenId = TokenId.fromString(process.env.MAGENTA_TOKEN_ID);
  const whiteTokenId = TokenId.fromString(process.env.WHITE_TOKEN_ID);
  const blackTokenId = TokenId.fromString(process.env.BLACK_TOKEN_ID);
  const purpleTokenId = TokenId.fromString(process.env.PURPLE_TOKEN_ID);

  logger.section("Transfer Tokens to Contract for Auto-Association");

  logger.info("Transferring 1 unit of each proof-output token to contract...", {
    from: operatorConfig.id,
    to: contractAccountId.toString(),
    contract: DEPLOYED_CONTRACT_ADDRESS,
  });

  // Build transfer transaction
  // Only include tokens that the operator has a balance of > 0
  // YELLOW, CYAN, MAGENTA = 0 balance (newly created, operator is treasury but no initial supply)
  // WHITE, BLACK = 0 balance
  // PURPLE = 1 balance (from earlier testing)

  // We can only transfer PURPLE since it has a balance
  // The others will be associated when the contract first mints them

  const transferTx = await new TransferTransaction()
    .addTokenTransfer(purpleTokenId, operatorConfig.id, -1)
    .addTokenTransfer(purpleTokenId, contractAccountId, 1)
    .freezeWith(client)
    .sign(operatorKey);

  const transferResponse = await transferTx.execute(client);
  const transferReceipt = await transferResponse.getReceipt(client);

  logger.success("Transferred PURPLE token to contract", {
    status: transferReceipt.status.toString(),
    token: "PURPLE",
    amount: 1,
  });

  logger.info("Note: YELLOW, CYAN, MAGENTA, WHITE, BLACK will auto-associate when first minted");

  client.close();
}

/**
 * Main execution function
 * @returns {Promise<void>}
 */
async function main() {
  try {
    await transferToContract();
    logger.success("Contract token transfer complete");
    process.exit(0);
  } catch (err) {
    logger.error("Failed to transfer tokens to contract", err);
    process.exit(1);
  }
}

// Export for programmatic use
export { transferToContract };

// Run if executed directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` ||
    import.meta.url.endsWith('transfer-to-contract.js')) {
  main();
}
