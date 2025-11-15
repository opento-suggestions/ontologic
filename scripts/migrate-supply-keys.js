/**
 * @fileoverview Migrate token supply keys and configure contract (v0.4.5)
 * @module scripts/migrate-supply-keys
 *
 * Usage: node scripts/migrate-supply-keys.js
 *
 * Performs two operations:
 * 1. Updates proof-output tokens (CMY + WHITE + BLACK + PURPLE) to use ReasoningContract as supply key
 * 2. Calls setTokenAddresses() with all 9 tokens (RGB+CMY+WHITE+BLACK+PURPLE)
 *
 * Architecture Principle:
 * - Primitives (RGB only): Treasury-controlled, axiomatic inputs, contract reads only
 * - Proof Outputs (CMY + WHITE + BLACK + PURPLE): Contract-minted, reasoning consequences
 */

import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import {
  Client,
  TokenUpdateTransaction,
  PrivateKey,
  ContractId,
  ContractExecuteTransaction,
  ContractFunctionParameters,
} from "@hashgraph/sdk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env (canonical configuration)
config({ path: path.join(__dirname, "..", ".env") });

// Tokens that need supply key migration (proof outputs: CMY + WHITE + BLACK + PURPLE)
// Contract mints these as consequences of valid reasoning operations
const TOKENS_TO_UPDATE = [
  { symbol: "YELLOW", id: process.env.YELLOW_TOKEN_ID, evmAddr: process.env.YELLOW_ADDR },
  { symbol: "CYAN", id: process.env.CYAN_TOKEN_ID, evmAddr: process.env.CYAN_ADDR },
  { symbol: "MAGENTA", id: process.env.MAGENTA_TOKEN_ID, evmAddr: process.env.MAGENTA_ADDR },
  { symbol: "WHITE", id: process.env.WHITE_TOKEN_ID, evmAddr: process.env.WHITE_ADDR },
  { symbol: "BLACK", id: process.env.BLACK_TOKEN_ID, evmAddr: process.env.BLACK_ADDR },
  { symbol: "PURPLE", id: process.env.PURPLE_TOKEN_ID, evmAddr: process.env.PURPLE_ADDR },
];

// Primitive tokens (RGB only) remain treasury-controlled
// These are axiomatic inputs, not proof products
// Contract reads them but never mints them
const PRIMITIVE_TOKENS = ["RED", "GREEN", "BLUE"];

// All 9 tokens for contract configuration (order matters!)
const ALL_TOKENS = [
  { symbol: "RED", evmAddr: process.env.RED_ADDR },
  { symbol: "GREEN", evmAddr: process.env.GREEN_ADDR },
  { symbol: "BLUE", evmAddr: process.env.BLUE_ADDR },
  { symbol: "YELLOW", evmAddr: process.env.YELLOW_ADDR },
  { symbol: "CYAN", evmAddr: process.env.CYAN_ADDR },
  { symbol: "MAGENTA", evmAddr: process.env.MAGENTA_ADDR },
  { symbol: "WHITE", evmAddr: process.env.WHITE_ADDR },
  { symbol: "BLACK", evmAddr: process.env.BLACK_ADDR },
  { symbol: "PURPLE", evmAddr: process.env.PURPLE_ADDR },
];

async function main() {
  const operatorId = process.env.OPERATOR_ID;
  const operatorDerKey = process.env.OPERATOR_DER_KEY;
  const contractAddr = process.env.CONTRACT_ADDR;
  const contractIdStr = process.env.CONTRACT_ID;

  if (!operatorId || !operatorDerKey || !contractAddr || !contractIdStr) {
    console.error(JSON.stringify({
      stage: "init",
      ok: false,
      error: "Missing required env vars: OPERATOR_ID, OPERATOR_DER_KEY, CONTRACT_ADDR, CONTRACT_ID"
    }));
    process.exit(1);
  }

  const operatorKey = PrivateKey.fromStringDer(operatorDerKey);
  const client = Client.forTestnet().setOperator(operatorId, operatorKey);

  // Parse contract ID
  const contractId = ContractId.fromString(contractIdStr);

  console.log(JSON.stringify({
    stage: "init",
    ok: true,
    contract: contractAddr,
    contractId: contractIdStr,
    tokensToUpdate: TOKENS_TO_UPDATE.map(t => ({ symbol: t.symbol, id: t.id })),
    note: "Migrating proof-output tokens (CMY + WHITE + BLACK + PURPLE) - RGB primitives remain treasury-controlled"
  }));

  // Step 1: Migrate supply keys for proof-output tokens (CMY + WHITE + BLACK + PURPLE)
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
        newSupplyKey: contractAddr
      }));

      const updateTx = await new TokenUpdateTransaction()
        .setTokenId(token.id)
        .setSupplyKey(contractId)  // Use ContractId
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

  // Step 2: Configure contract with all 9 token addresses
  console.log(JSON.stringify({
    stage: "configure-contract",
    ok: true,
    action: "submitting",
    message: "Updating contract with 9 token addresses (RGB+CMY+WHITE+BLACK+PURPLE)"
  }));

  try {
    // Validate all required token addresses are present
    const missingAddrs = ALL_TOKENS.filter(t => !t.evmAddr);
    if (missingAddrs.length > 0) {
      console.error(JSON.stringify({
        stage: "configure-contract",
        ok: false,
        error: `Missing EVM addresses for: ${missingAddrs.map(t => t.symbol).join(", ")}`
      }));
      client.close();
      return;
    }

    // Call setTokenAddresses with 9 arguments
    const contractExec = await new ContractExecuteTransaction()
      .setContractId(contractId)
      .setGas(300000)
      .setFunction(
        "setTokenAddresses",
        new ContractFunctionParameters()
          .addAddress(ALL_TOKENS[0].evmAddr)  // RED
          .addAddress(ALL_TOKENS[1].evmAddr)  // GREEN
          .addAddress(ALL_TOKENS[2].evmAddr)  // BLUE
          .addAddress(ALL_TOKENS[3].evmAddr)  // YELLOW
          .addAddress(ALL_TOKENS[4].evmAddr)  // CYAN
          .addAddress(ALL_TOKENS[5].evmAddr)  // MAGENTA
          .addAddress(ALL_TOKENS[6].evmAddr)  // WHITE
          .addAddress(ALL_TOKENS[7].evmAddr)  // BLACK
          .addAddress(ALL_TOKENS[8].evmAddr)  // PURPLE
      )
      .execute(client);

    const contractReceipt = await contractExec.getReceipt(client);

    console.log(JSON.stringify({
      stage: "configure-contract",
      ok: true,
      action: "confirmed",
      status: contractReceipt.status.toString(),
      tokens: {
        red: ALL_TOKENS[0].evmAddr,
        green: ALL_TOKENS[1].evmAddr,
        blue: ALL_TOKENS[2].evmAddr,
        yellow: ALL_TOKENS[3].evmAddr,
        cyan: ALL_TOKENS[4].evmAddr,
        magenta: ALL_TOKENS[5].evmAddr,
        white: ALL_TOKENS[6].evmAddr,
        black: ALL_TOKENS[7].evmAddr,
        purple: ALL_TOKENS[8].evmAddr
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
    message: "Supply key migration and v0.4.5 contract configuration complete"
  }));

  client.close();
}

main();
