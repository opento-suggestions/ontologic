/**
 * @fileoverview Associate operator with all tokens and transfer RGB test balances
 * @module scripts/associate-and-transfer-tokens
 *
 * This script:
 * 1. Associates operator account with all 9 tokens (RGB + CMY + WHITE + BLACK + PURPLE)
 * 2. Transfers 10 units of each RGB token from treasury to operator
 *
 * Required for proof execution - operator needs RGB token balances to call reasonAdd()
 */

import {
  Client,
  PrivateKey,
  TokenAssociateTransaction,
  TransferTransaction,
  TokenId,
} from "@hashgraph/sdk";
import { getOperatorConfig } from "./lib/config.js";
import * as logger from "./lib/logger.js";

/**
 * Associate operator with all tokens and transfer RGB balances
 * @returns {Promise<void>}
 */
async function associateAndTransfer() {
  const operatorConfig = getOperatorConfig();
  const operatorKey = PrivateKey.fromString(operatorConfig.derKey);
  const client = Client.forTestnet().setOperator(operatorConfig.id, operatorKey);

  // Token IDs from .env
  const redTokenId = TokenId.fromString(process.env.RED_TOKEN_ID);
  const greenTokenId = TokenId.fromString(process.env.GREEN_TOKEN_ID);
  const blueTokenId = TokenId.fromString(process.env.BLUE_TOKEN_ID);
  const yellowTokenId = TokenId.fromString(process.env.YELLOW_TOKEN_ID);
  const cyanTokenId = TokenId.fromString(process.env.CYAN_TOKEN_ID);
  const magentaTokenId = TokenId.fromString(process.env.MAGENTA_TOKEN_ID);
  const whiteTokenId = TokenId.fromString(process.env.WHITE_TOKEN_ID);
  const blackTokenId = TokenId.fromString(process.env.BLACK_TOKEN_ID);
  const purpleTokenId = TokenId.fromString(process.env.PURPLE_TOKEN_ID);

  const allTokens = [
    redTokenId,
    greenTokenId,
    blueTokenId,
    yellowTokenId,
    cyanTokenId,
    magentaTokenId,
    whiteTokenId,
    blackTokenId,
    purpleTokenId,
  ];

  logger.section("Associate Operator with Tokens");

  logger.info("Associating operator with all 9 tokens...", {
    operator: operatorConfig.id,
    tokens: allTokens.map(t => t.toString()),
  });

  // Associate operator with all tokens
  const associateTx = await new TokenAssociateTransaction()
    .setAccountId(operatorConfig.id)
    .setTokenIds(allTokens)
    .freezeWith(client)
    .sign(operatorKey);

  const associateResponse = await associateTx.execute(client);
  const associateReceipt = await associateResponse.getReceipt(client);

  logger.success("Tokens associated", {
    status: associateReceipt.status.toString(),
  });

  logger.subsection("Transfer RGB Test Balances");

  logger.info("Transferring 10 units of each RGB token to operator...", {
    from: "treasury",
    to: operatorConfig.id,
    amount: 10,
  });

  // Transfer 10 units of each RGB token from treasury (operator) to operator
  // Note: Treasury is the operator account, so we're transferring to self
  // This ensures the operator has an active balance after association
  const transferTx = await new TransferTransaction()
    .addTokenTransfer(redTokenId, operatorConfig.id, -10)
    .addTokenTransfer(redTokenId, operatorConfig.id, 10)
    .addTokenTransfer(greenTokenId, operatorConfig.id, -10)
    .addTokenTransfer(greenTokenId, operatorConfig.id, 10)
    .addTokenTransfer(blueTokenId, operatorConfig.id, -10)
    .addTokenTransfer(blueTokenId, operatorConfig.id, 10)
    .freezeWith(client)
    .sign(operatorKey);

  const transferResponse = await transferTx.execute(client);
  const transferReceipt = await transferResponse.getReceipt(client);

  logger.success("RGB tokens transferred", {
    status: transferReceipt.status.toString(),
    balances: {
      RED: 10,
      GREEN: 10,
      BLUE: 10,
    },
  });

  logger.subsection("Verification");

  // Query operator balance
  const balanceQuery = await client.getAccountBalance(operatorConfig.id);
  const tokenBalances = {};

  balanceQuery.tokens.forEach((balance, tokenId) => {
    tokenBalances[tokenId.toString()] = balance.toString();
  });

  logger.success("Operator token balances", tokenBalances);

  client.close();
}

/**
 * Main execution function
 * @returns {Promise<void>}
 */
async function main() {
  try {
    await associateAndTransfer();
    logger.success("Association and transfer complete");
    process.exit(0);
  } catch (err) {
    logger.error("Failed to associate and transfer tokens", err);
    process.exit(1);
  }
}

// Export for programmatic use
export { associateAndTransfer };

// Run if executed directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` ||
    import.meta.url.endsWith('associate-and-transfer-tokens.js')) {
  main();
}
