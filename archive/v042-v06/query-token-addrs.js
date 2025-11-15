// scripts/query-token-addrs.js
// Query contract's token address state variables

import { ethers } from "ethers";
import { Client, ContractCallQuery, ContractId } from "@hashgraph/sdk";
import { getConfig } from "./lib/config.js";

const cfg = await getConfig();

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

console.log("Querying token addresses from contract", contractId.toString(), "\n");

const abiCoder = ethers.AbiCoder.defaultAbiCoder();

const tokens = [
  "RED_TOKEN_ADDR",
  "GREEN_TOKEN_ADDR",
  "BLUE_TOKEN_ADDR",
  "YELLOW_TOKEN_ADDR",
  "CYAN_TOKEN_ADDR",
  "MAGENTA_TOKEN_ADDR",
  "WHITE_TOKEN_ADDR",
  "BLACK_TOKEN_ADDR",
  "PURPLE_TOKEN_ADDR"
];

for (const tokenName of tokens) {
  try {
    const selector = ethers.id(`${tokenName}()`).slice(0, 10);
    const query = new ContractCallQuery()
      .setContractId(contractId)
      .setGas(50000)
      .setFunctionParameters(Buffer.from(selector.slice(2), "hex"));

    const result = await query.execute(client);
    const addr = abiCoder.decode(
      ["address"],
      "0x" + Buffer.from(result.bytes).toString("hex")
    )[0];

    console.log(`${tokenName}: ${addr}`);
  } catch (err) {
    console.log(`${tokenName}: Query failed -`, err.message);
  }
}

client.close();
