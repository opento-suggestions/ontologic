/**
 * @fileoverview Associate contract with all output tokens after bytecode upgrade
 * @module scripts/associate-contract-tokens
 *
 * After ContractUpdateTransaction, token associations are reset.
 * This script re-establishes HTS token associations for the contract.
 *
 * Tokens to associate: YELLOW, CYAN, MAGENTA, WHITE, BLACK, PURPLE
 */

import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import {
  Client,
  PrivateKey,
  TokenAssociateTransaction,
  ContractId,
  TokenId,
} from "@hashgraph/sdk";
import * as logger from "./lib/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
config({ path: path.join(__dirname, "..", ".env") });

async function main() {
  logger.section("Re-Associate Contract with Output Tokens (Post-Upgrade)");

  // Load configuration
  const operatorId = process.env.OPERATOR_ID;
  const operatorKey = process.env.OPERATOR_DER_KEY;
  const contractIdStr = process.env.CONTRACT_ID;

  if (!operatorId || !operatorKey || !contractIdStr) {
    logger.error("Missing OPERATOR_ID, OPERATOR_DER_KEY, or CONTRACT_ID in .env");
    process.exit(1);
  }

  // Parse IDs
  const contractId = ContractId.fromString(contractIdStr);

  // All 9 tokens need association with contract
  // - RGB (inputs): Contract validates these addresses
  // - CMY+WBP (outputs): Contract mints these via HTS precompile
  const allTokens = [
    { symbol: "RED", id: process.env.RED_TOKEN_ID },
    { symbol: "GREEN", id: process.env.GREEN_TOKEN_ID },
    { symbol: "BLUE", id: process.env.BLUE_TOKEN_ID },
    { symbol: "YELLOW", id: process.env.YELLOW_TOKEN_ID },
    { symbol: "CYAN", id: process.env.CYAN_TOKEN_ID },
    { symbol: "MAGENTA", id: process.env.MAGENTA_TOKEN_ID },
    { symbol: "WHITE", id: process.env.WHITE_TOKEN_ID },
    { symbol: "BLACK", id: process.env.BLACK_TOKEN_ID },
    { symbol: "PURPLE", id: process.env.PURPLE_TOKEN_ID },
  ];

  // Validate all token IDs present
  for (const token of allTokens) {
    if (!token.id) {
      logger.error(`Missing ${token.symbol}_TOKEN_ID in .env`);
      process.exit(1);
    }
  }

  // Create client
  const client = Client.forTestnet();
  const operatorPrivateKey = PrivateKey.fromStringDer(operatorKey);
  client.setOperator(operatorId, operatorPrivateKey);

  logger.info("Client configured", {
    operator: operatorId,
    contract: contractIdStr,
    tokensToAssociate: allTokens.length,
  });

  logger.info("Associating contract with all 9 tokens...");

  try {
    // Create token association transaction for contract account
    // Note: Contract associations use ContractExecuteTransaction calling associateToken() on HTS precompile
    // However, for simplicity, we'll use TokenAssociateTransaction with AccountId cast
    const tokenIds = allTokens.map(t => TokenId.fromString(t.id));

    // Convert ContractId to AccountId for association
    // ContractId and AccountId share the same structure in Hedera
    const contractAsAccount = `0.0.${contractId.num}`;

    const associateTx = new TokenAssociateTransaction()
      .setAccountId(contractAsAccount)
      .setTokenIds(tokenIds)
      .freezeWith(client);

    // Sign with operator key (admin key for contract)
    const signedTx = await associateTx.sign(operatorPrivateKey);
    const txResponse = await signedTx.execute(client);
    const receipt = await txResponse.getReceipt(client);

    if (receipt.status.toString() !== "SUCCESS") {
      logger.error("Token association failed", {
        status: receipt.status.toString(),
      });
      process.exit(1);
    }

    logger.success("Contract associated with all 9 tokens!", {
      contractId: contractId.toString(),
      tokensAssociated: allTokens.map(t => `${t.symbol} (${t.id})`),
      txHash: txResponse.transactionId.toString(),
    });

    logger.subsection("Association Complete");
    logger.table({
      "Contract ID": contractId.toString(),
      "Tokens Associated": allTokens.length,
      "Transaction": txResponse.transactionId.toString(),
    });

    logger.subsection("Next Steps");
    logger.info("1. Verify associations:");
    console.log(`     curl https://testnet.mirrornode.hedera.com/api/v1/accounts/${contractIdStr}/tokens`);
    logger.info("\n2. Retry validation proof:");
    console.log("     node scripts/reason-add-sdk.js --A RED --B GREEN --out YELLOW");

  } catch (err) {
    logger.error("Token association failed", err);
    process.exit(1);
  } finally {
    client.close();
  }
}

main();
