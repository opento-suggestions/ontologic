/**
 * @fileoverview Associate tokens with accounts (operator and contract)
 * @module scripts/associate-tokens
 *
 * Usage: node scripts/associate-tokens.js --account operator
 *        node scripts/associate-tokens.js --account contract
 *
 * Associates all tokens from .env with the specified account.
 * Required before an account can receive tokens.
 */

import {
  Client,
  TokenAssociateTransaction,
  PrivateKey,
  TokenId,
  AccountId,
  ContractId,
} from "@hashgraph/sdk";
import { getOperatorConfig, DEPLOYED_CONTRACT_ADDRESS } from "./lib/config.js";

// Parse args
function arg(name, d=null){ const i=process.argv.indexOf(name); return i<0?d:process.argv[i+1]; }

const ACCOUNT_TYPE = arg("--account", "operator");

// Load all token IDs from environment
const TOKEN_IDS = [
  process.env.RED_TOKEN_ID,
  process.env.GREEN_TOKEN_ID,
  process.env.BLUE_TOKEN_ID,
  process.env.YELLOW_TOKEN_ID,
  process.env.CYAN_TOKEN_ID,
  process.env.MAGENTA_TOKEN_ID,
  process.env.ORANGE_TOKEN_ID,
  process.env.PURPLE_TOKEN_ID,
  process.env.WHITE_TOKEN_ID,
  process.env.GREY_TOKEN_ID,
  process.env.PINK_TOKEN_ID,
].filter(Boolean); // Remove undefined tokens

async function main() {
  const operatorConfig = getOperatorConfig();

  console.log(JSON.stringify({
    stage: "init",
    ok: true,
    accountType: ACCOUNT_TYPE,
    tokenCount: TOKEN_IDS.length,
    tokens: TOKEN_IDS
  }));

  const client = Client.forTestnet().setOperator(
    operatorConfig.id,
    operatorConfig.derKey
  );

  const operatorKey = PrivateKey.fromString(operatorConfig.derKey);

  try {
    let targetAccount;

    if (ACCOUNT_TYPE === "operator") {
      targetAccount = operatorConfig.id;
    } else if (ACCOUNT_TYPE === "contract") {
      // Convert EVM address to ContractId
      const evmAddrClean = DEPLOYED_CONTRACT_ADDRESS.toLowerCase().replace("0x", "");
      const entityNumHex = evmAddrClean.slice(-8);
      const entityNum = parseInt(entityNumHex, 16);
      targetAccount = `0.0.${entityNum}`;
    } else {
      throw new Error(`Unknown account type: ${ACCOUNT_TYPE}. Use 'operator' or 'contract'`);
    }

    console.log(JSON.stringify({
      stage: "associate",
      ok: true,
      action: "submitting",
      targetAccount,
      tokenCount: TOKEN_IDS.length
    }));

    // Create token association transaction
    const associateTx = await new TokenAssociateTransaction()
      .setAccountId(targetAccount)
      .setTokenIds(TOKEN_IDS.map(id => TokenId.fromString(id)))
      .freezeWith(client);

    const signedTx = await associateTx.sign(operatorKey);
    const response = await signedTx.execute(client);
    const receipt = await response.getReceipt(client);

    console.log(JSON.stringify({
      stage: "associate",
      ok: true,
      action: "confirmed",
      targetAccount,
      status: receipt.status.toString(),
      txHash: response.transactionHash ? `0x${Buffer.from(response.transactionHash).toString('hex')}` : "N/A"
    }));

    console.log(JSON.stringify({
      stage: "complete",
      ok: true,
      message: `Associated ${TOKEN_IDS.length} tokens with ${targetAccount}`,
      tokenIds: TOKEN_IDS
    }));

  } catch (error) {
    console.error(JSON.stringify({
      stage: "error",
      ok: false,
      error: error.message,
      details: error.toString()
    }));
    process.exit(1);
  } finally {
    client.close();
  }
}

main();
