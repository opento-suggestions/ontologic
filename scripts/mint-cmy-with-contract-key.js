/**
 * @fileoverview Mint YELLOW, CYAN, MAGENTA tokens with contract as supply key
 * Usage: node scripts/mint-cmy-with-contract-key.js
 */

import {
  Client,
  PrivateKey,
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
  ContractId,
} from "@hashgraph/sdk";
import { getOperatorConfig, DEPLOYED_CONTRACT_ADDRESS } from "./lib/config.js";

const TOKENS = [
  { symbol: "YELLOW", name: "$YELLOW", color: "#FFFF00" },
  { symbol: "CYAN", name: "$CYAN", color: "#00FFFF" },
  { symbol: "MAGENTA", name: "$MAGENTA", color: "#FF00FF" },
];

async function main() {
  const operatorConfig = getOperatorConfig();
  const operatorKey = PrivateKey.fromString(operatorConfig.derKey);
  const client = Client.forTestnet().setOperator(operatorConfig.id, operatorKey);

  // Convert contract EVM address to ContractId
  const evmAddrClean = DEPLOYED_CONTRACT_ADDRESS.toLowerCase().replace("0x", "");
  const entityNumHex = evmAddrClean.slice(-8);
  const entityNum = parseInt(entityNumHex, 16);
  const contractId = new ContractId(0, 0, entityNum);

  console.log(JSON.stringify({
    stage: "init",
    ok: true,
    contract: DEPLOYED_CONTRACT_ADDRESS,
    contractId: `0.0.${entityNum}`,
    tokens: TOKENS.map(t => t.symbol)
  }));

  const results = [];

  for (const tokenDef of TOKENS) {
    const metadata = { name: tokenDef.name.substring(1), symbol: tokenDef.symbol, color: tokenDef.color };

    const transaction = await new TokenCreateTransaction()
      .setTokenName(tokenDef.name)
      .setTokenSymbol(tokenDef.symbol)
      .setTokenMemo(JSON.stringify(metadata))
      .setTokenType(TokenType.FungibleCommon)
      .setDecimals(0)
      .setInitialSupply(0)  // Contract mints on demand
      .setTreasuryAccountId(operatorConfig.id)
      .setSupplyType(TokenSupplyType.Infinite)
      .setSupplyKey(contractId)  // Contract can mint
      .setAdminKey(operatorKey.publicKey)  // Allow future updates
      .freezeWith(client)
      .sign(operatorKey);

    const response = await transaction.execute(client);
    const receipt = await response.getReceipt(client);
    const tokenId = receipt.tokenId;

    if (!tokenId) {
      throw new Error(`Failed to create ${tokenDef.symbol}`);
    }

    const evmAddress = "0x" + tokenId.toSolidityAddress();

    results.push({
      symbol: tokenDef.symbol,
      tokenId: tokenId.toString(),
      evmAddress,
    });

    console.log(JSON.stringify({
      stage: "token-created",
      ok: true,
      symbol: tokenDef.symbol,
      tokenId: tokenId.toString(),
      evmAddress,
    }));
  }

  console.log(JSON.stringify({
    stage: "complete",
    ok: true,
    tokens: results
  }));

  console.log("\n# Add these to your .env file:");
  for (const result of results) {
    console.log(`${result.symbol}_TOKEN_ID=${result.tokenId}`);
    console.log(`${result.symbol}_ADDR=${result.evmAddress}`);
  }

  client.close();
}

main().catch((err) => {
  console.error(JSON.stringify({ stage: "error", ok: false, error: err.message }));
  process.exit(1);
});
