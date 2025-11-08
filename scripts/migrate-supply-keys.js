/**
 * @fileoverview Migrate token supply keys from treasury to contract
 * @module scripts/migrate-supply-keys
 *
 * Usage: node scripts/migrate-supply-keys.js
 *
 * Updates CMY tokens to use the deployed ReasoningContract as supply key.
 * Requires tokens to have admin keys set.
 */

import {
  Client,
  TokenUpdateTransaction,
  PrivateKey,
  ContractId,
  ContractExecuteTransaction,
  ContractFunctionParameters,
} from "@hashgraph/sdk";
import { getOperatorConfig, DEPLOYED_CONTRACT_ADDRESS } from "./lib/config.js";

const TOKENS_TO_UPDATE = [
  { symbol: "YELLOW", id: process.env.YELLOW_TOKEN_ID, evmAddr: process.env.YELLOW_ADDR },
  { symbol: "CYAN", id: process.env.CYAN_TOKEN_ID, evmAddr: process.env.CYAN_ADDR },
  { symbol: "MAGENTA", id: process.env.MAGENTA_TOKEN_ID, evmAddr: process.env.MAGENTA_ADDR },
];

const INPUT_TOKENS = [
  { symbol: "RED", evmAddr: process.env.RED_ADDR },
  { symbol: "GREEN", evmAddr: process.env.GREEN_ADDR },
  { symbol: "BLUE", evmAddr: process.env.BLUE_ADDR },
];

async function main() {
  const operatorConfig = getOperatorConfig();
  const operatorKey = PrivateKey.fromString(operatorConfig.derKey);
  const client = Client.forTestnet().setOperator(operatorConfig.id, operatorKey);

  // Convert EVM address to ContractId
  const evmAddrClean = DEPLOYED_CONTRACT_ADDRESS.toLowerCase().replace("0x", "");
  const entityNumHex = evmAddrClean.slice(-8);
  const entityNum = parseInt(entityNumHex, 16);
  const contractKey = new ContractId(0, 0, entityNum);

  console.log(JSON.stringify({
    stage: "init",
    ok: true,
    contract: DEPLOYED_CONTRACT_ADDRESS,
    contractId: `0.0.${entityNum}`,
    tokens: TOKENS_TO_UPDATE.map(t => ({symbol: t.symbol, id: t.id}))
  }));

  for (const token of TOKENS_TO_UPDATE) {
    if (!token.id) {
      console.error(JSON.stringify({
        stage: "error",
        ok: false,
        symbol: token.symbol,
        error: `${token.symbol}_TOKEN_ID not set in .env`
      }));
      continue;
    }

    try {
      console.log(JSON.stringify({
        stage: "update-supply-key",
        ok: true,
        action: "submitting",
        symbol: token.symbol,
        tokenId: token.id,
        newSupplyKey: DEPLOYED_CONTRACT_ADDRESS
      }));

      const updateTx = await new TokenUpdateTransaction()
        .setTokenId(token.id)
        .setSupplyKey(contractKey)  // Use ContractId key
        .freezeWith(client);

      const signedTx = await updateTx.sign(operatorKey);
      const response = await signedTx.execute(client);
      const receipt = await response.getReceipt(client);

      console.log(JSON.stringify({
        stage: "update-supply-key",
        ok: true,
        action: "confirmed",
        symbol: token.symbol,
        tokenId: token.id,
        status: receipt.status.toString()
      }));

    } catch (error) {
      console.error(JSON.stringify({
        stage: "update-supply-key",
        ok: false,
        symbol: token.symbol,
        tokenId: token.id,
        error: error.message
      }));
    }
  }

  // Step 2: Update contract with token addresses
  console.log(JSON.stringify({
    stage: "configure-contract",
    ok: true,
    action: "submitting",
    message: "Updating contract with token addresses"
  }));

  try {
    // Validate all required token addresses are present
    const allTokens = [...INPUT_TOKENS, ...TOKENS_TO_UPDATE];
    const missingAddrs = allTokens.filter(t => !t.evmAddr);
    if (missingAddrs.length > 0) {
      console.error(JSON.stringify({
        stage: "configure-contract",
        ok: false,
        error: `Missing EVM addresses for: ${missingAddrs.map(t => t.symbol).join(", ")}`
      }));
      client.close();
      return;
    }

    const contractExec = await new ContractExecuteTransaction()
      .setContractId(contractKey)
      .setGas(200000)
      .setFunction(
        "setTokenAddresses",
        new ContractFunctionParameters()
          .addAddress(INPUT_TOKENS[0].evmAddr)  // RED
          .addAddress(INPUT_TOKENS[1].evmAddr)  // GREEN
          .addAddress(INPUT_TOKENS[2].evmAddr)  // BLUE
          .addAddress(TOKENS_TO_UPDATE[0].evmAddr)  // YELLOW
          .addAddress(TOKENS_TO_UPDATE[1].evmAddr)  // CYAN
          .addAddress(TOKENS_TO_UPDATE[2].evmAddr)  // MAGENTA
      )
      .execute(client);

    const contractReceipt = await contractExec.getReceipt(client);

    console.log(JSON.stringify({
      stage: "configure-contract",
      ok: true,
      action: "confirmed",
      status: contractReceipt.status.toString(),
      tokens: {
        red: INPUT_TOKENS[0].evmAddr,
        green: INPUT_TOKENS[1].evmAddr,
        blue: INPUT_TOKENS[2].evmAddr,
        yellow: TOKENS_TO_UPDATE[0].evmAddr,
        cyan: TOKENS_TO_UPDATE[1].evmAddr,
        magenta: TOKENS_TO_UPDATE[2].evmAddr
      }
    }));

  } catch (error) {
    console.error(JSON.stringify({
      stage: "configure-contract",
      ok: false,
      error: error.message
    }));
  }

  console.log(JSON.stringify({
    stage: "complete",
    ok: true,
    message: "Supply key migration and contract configuration complete"
  }));

  client.close();
}

main();
