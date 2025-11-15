// scripts/debug-validation.js
// Debug script to compare client-computed hashes with contract expectations
// Usage: node scripts/debug-validation.js

import { readFileSync } from "fs";
import { ethers } from "ethers";
import { Client, ContractCallQuery, ContractId } from "@hashgraph/sdk";
import { getConfig } from "./lib/config.js";

// Load config
const cfg = await getConfig();

// Token addresses (from tokens.json or .env)
let TOKS = {};
try { TOKS = JSON.parse(readFileSync("./scripts/lib/tokens.json","utf8")); }
catch { console.error("missing ./scripts/lib/tokens.json"); process.exit(1); }

const A = TOKS.RED;
const B = TOKS.GREEN;

// Domain and operator constants (client-side computation)
const D_LIGHT = ethers.keccak256(ethers.toUtf8Bytes("color.light"));
const OP_ADD  = ethers.keccak256(ethers.toUtf8Bytes("mix_add@v1"));

// Sort tokens (order-invariant)
const [X, Y] = (A.toLowerCase() < B.toLowerCase()) ? [A, B] : [B, A];

// Compute inputsHash (client-side)
const inputsPreimage = ethers.AbiCoder.defaultAbiCoder().encode(
  ["address","address","bytes32","bytes32"],
  [X, Y, D_LIGHT, OP_ADD]
);
const clientInputsHash = ethers.keccak256(inputsPreimage);

console.log("\n=== CLIENT-SIDE COMPUTED VALUES ===");
console.log("Token A (RED):", A);
console.log("Token B (GREEN):", B);
console.log("Sorted X:", X);
console.log("Sorted Y:", Y);
console.log("D_LIGHT:", D_LIGHT);
console.log("OP_ADD:", OP_ADD);
console.log("inputsPreimage:", inputsPreimage);
console.log("clientInputsHash:", clientInputsHash);

// Create Hedera client
const client = Client.forTestnet().setOperator(
  process.env.OPERATOR_ID,
  process.env.OPERATOR_DER_KEY
);

// Convert contract address to ContractId
const evmAddrClean = cfg.contract.toLowerCase().replace("0x", "");
const entityNumHex = evmAddrClean.slice(-8);
const entityNum = parseInt(entityNumHex, 16);
const contractId = new ContractId(0, 0, entityNum);

console.log("\nContract ID:", contractId.toString());

// Try calling existing inputsHashAdd public function to get contract's expected value
console.log("\nCalling contract's inputsHashAdd(A, B, D_LIGHT)...\n");

try {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();

  // Call inputsHashAdd(address,address,bytes32) - existing public function
  const functionSelector = ethers.id("inputsHashAdd(address,address,bytes32)").slice(0, 10);
  const params = abiCoder.encode(
    ["address", "address", "bytes32"],
    [A, B, D_LIGHT]
  );
  const functionCallBytes = functionSelector + params.slice(2);

  const query = new ContractCallQuery()
    .setContractId(contractId)
    .setGas(100000)
    .setFunctionParameters(Buffer.from(functionCallBytes.slice(2), "hex"));

  const result = await query.execute(client);

  // Decode result (returns bytes32)
  const contractInputsHash = abiCoder.decode(
    ["bytes32"],
    "0x" + Buffer.from(result.bytes).toString("hex")
  )[0];

  console.log("=== CONTRACT RESPONSE ===");
  console.log("contractInputsHash:", contractInputsHash);

  console.log("\n=== COMPARISON ===");
  console.log("Client inputsHash:", clientInputsHash);
  console.log("Contract inputsHash:", contractInputsHash);
  console.log("Match:", clientInputsHash === contractInputsHash);

  if (clientInputsHash === contractInputsHash) {
    console.log("\n✅ InputsHash MATCH - Client and contract agree!");
  } else {
    console.log("\n❌ InputsHash MISMATCH - Values differ!");
    console.log("\nThis means the revert is likely due to a different validation failure.");
  }

} catch (err) {
  console.error("Query failed:", err);
  process.exit(1);
} finally {
  client.close();
}
