/**
 * @fileoverview Grant contract supply key permissions for CMY tokens
 * @module scripts/grant-supply-key
 *
 * Usage: node scripts/grant-supply-key.js --token YELLOW
 *
 * This updates an existing token to add the deployed contract as a supply key.
 * On Hedera, we use a ContractId key to allow the contract to mint tokens.
 */

import {
  Client,
  TokenUpdateTransaction,
  PrivateKey,
  ContractId,
  KeyList,
  TokenId,
} from "@hashgraph/sdk";
import { getOperatorConfig, DEPLOYED_CONTRACT_ADDRESS } from "./lib/config.js";

// Parse args
function arg(name, d=null){ const i=process.argv.indexOf(name); return i<0?d:process.argv[i+1]; }

const TOKEN_SYM = arg("--token");

if (!TOKEN_SYM) {
  console.error("usage: node scripts/grant-supply-key.js --token <YELLOW|CYAN|MAGENTA|ORANGE|PURPLE>");
  process.exit(1);
}

const TOKEN_ID_MAP = {
  YELLOW: process.env.YELLOW_TOKEN_ID,
  CYAN: process.env.CYAN_TOKEN_ID,
  MAGENTA: process.env.MAGENTA_TOKEN_ID,
  ORANGE: process.env.ORANGE_TOKEN_ID,
  PURPLE: process.env.PURPLE_TOKEN_ID,
};

const tokenId = TOKEN_ID_MAP[TOKEN_SYM.toUpperCase()];
if (!tokenId) {
  console.error(`Unknown token: ${TOKEN_SYM}. Must be YELLOW, CYAN, MAGENTA, ORANGE, or PURPLE`);
  process.exit(1);
}

async function main() {
  const operatorConfig = getOperatorConfig();

  console.log(JSON.stringify({
    stage: "init",
    ok: true,
    token: TOKEN_SYM,
    tokenId,
    contractEVM: DEPLOYED_CONTRACT_ADDRESS
  }));

  // Convert EVM address to Hedera contract ID
  // EVM addresses are in format 0x...
  // Need to extract the entity number from the address
  // Format: 0x00000000000000000000000000000000{shard}{realm}{num}

  // For Hedera testnet contracts, shard and realm are typically 0
  // Extract the last 8 hex chars (4 bytes) which represent the entity num
  const evmAddrClean = DEPLOYED_CONTRACT_ADDRESS.toLowerCase().replace("0x", "");
  const entityNumHex = evmAddrClean.slice(-8);
  const entityNum = parseInt(entityNumHex, 16);

  const contractId = `0.0.${entityNum}`;

  console.log(JSON.stringify({
    stage: "contract-id-mapping",
    ok: true,
    evmAddress: DEPLOYED_CONTRACT_ADDRESS,
    contractId,
    entityNum
  }));

  const client = Client.forTestnet().setOperator(
    operatorConfig.id,
    operatorConfig.derKey
  );

  const operatorKey = PrivateKey.fromString(operatorConfig.derKey);

  try {
    // Create a delegatable ContractId key
    // This allows the contract at contractId to act as a supply key
    const contractKey = new ContractId(0, 0, entityNum);

    console.log(JSON.stringify({
      stage: "update-token",
      ok: true,
      action: "submitting",
      tokenId,
      supplyKey: contractId
    }));

    // Update token to set supply key to the contract
    const updateTx = await new TokenUpdateTransaction()
      .setTokenId(tokenId)
      .setSupplyKey(contractKey)
      .freezeWith(client);

    const signedTx = await updateTx.sign(operatorKey);
    const response = await signedTx.execute(client);
    const receipt = await response.getReceipt(client);

    console.log(JSON.stringify({
      stage: "update-token",
      ok: true,
      action: "confirmed",
      tokenId,
      status: receipt.status.toString(),
      txHash: response.transactionHash ? `0x${Buffer.from(response.transactionHash).toString('hex')}` : "N/A"
    }));

    console.log(JSON.stringify({
      stage: "complete",
      ok: true,
      message: `${TOKEN_SYM} token updated with contract supply key`,
      tokenId,
      contractId
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
