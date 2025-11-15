/**
 * @fileoverview Create new WHITE, BLACK, PURPLE tokens with operator as admin/supply
 * @module scripts/mint-wbp-operator
 *
 * Creates fresh W/B/P tokens under current operator (0.0.7238571)
 * - Admin key: Operator
 * - Supply key: Operator (will migrate to contract later)
 * - Initial supply: 0
 * - Treasury: Operator
 *
 * This replaces old W/B/P tokens (0.0.7238662, 0.0.7246868, 0.0.7238696)
 * which were created under sealed account 0.0.6748221.
 */

import {
  Client,
  PrivateKey,
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
} from "@hashgraph/sdk";
import { getOperatorConfig } from "./lib/config.js";
import * as logger from "./lib/logger.js";

const TOKENS = [
  { name: "Ontologic White", symbol: "WHITE", color: "#FFFFFF" },
  { name: "Ontologic Black", symbol: "BLACK", color: "#000000" },
  { name: "Ontologic Purple", symbol: "PURPLE", color: "#800080" },
];

async function main() {
  logger.section("Mint WHITE + BLACK + PURPLE (Operator-controlled)");

  const operatorConfig = getOperatorConfig();
  const operatorKey = PrivateKey.fromString(operatorConfig.derKey);
  const client = Client.forTestnet().setOperator(operatorConfig.id, operatorKey);

  logger.info("Creating tokens with operator as admin + supply", {
    operator: operatorConfig.id,
    note: "Supply keys will be migrated to contract after creation"
  });

  const results = [];

  for (const token of TOKENS) {
    logger.info(`Creating ${token.symbol}...`, {
      name: token.name,
      symbol: token.symbol,
      color: token.color
    });

    const metadata = {
      name: token.name.replace("Ontologic ", ""),
      symbol: token.symbol,
      color: token.color
    };

    const transaction = await new TokenCreateTransaction()
      .setTokenName(token.name)
      .setTokenSymbol(token.symbol)
      .setTokenMemo(JSON.stringify(metadata))
      .setTokenType(TokenType.FungibleCommon)
      .setDecimals(0)
      .setInitialSupply(0) // Contract will mint on demand
      .setTreasuryAccountId(operatorConfig.id)
      .setSupplyType(TokenSupplyType.Infinite)
      .setAdminKey(operatorKey.publicKey) // Operator admin
      .setSupplyKey(operatorKey.publicKey) // Operator supply (temp, will migrate)
      .freezeWith(client)
      .sign(operatorKey);

    const response = await transaction.execute(client);
    const receipt = await response.getReceipt(client);
    const tokenId = receipt.tokenId;

    if (!tokenId) {
      throw new Error(`${token.symbol} creation failed: no token ID returned`);
    }

    const evmAddress = "0x" + tokenId.toSolidityAddress();

    logger.success(`${token.symbol} created`, {
      tokenId: tokenId.toString(),
      evmAddress,
      adminKey: "operator",
      supplyKey: "operator (will migrate to contract)"
    });

    results.push({
      symbol: token.symbol,
      tokenId: tokenId.toString(),
      evmAddress
    });
  }

  client.close();

  logger.subsection("Token Creation Complete");
  logger.table(results.reduce((acc, r) => ({
    ...acc,
    [`${r.symbol}_TOKEN_ID`]: r.tokenId,
    [`${r.symbol}_ADDR`]: r.evmAddress
  }), {}));

  logger.subsection("Next Steps");
  logger.info("1. Update .env and .env.example with new token IDs:");
  results.forEach(r => {
    console.log(`     ${r.symbol}_TOKEN_ID=${r.tokenId}`);
    console.log(`     ${r.symbol}_ADDR=${r.evmAddress}`);
  });
  logger.info("\n2. Migrate supply keys to contract:");
  console.log("     node scripts/migrate-supply-keys.js");
  logger.info("\n3. Reconfigure contract with all 9 tokens:");
  console.log("     (Will happen automatically in migrate-supply-keys.js)");
}

main().catch(err => {
  logger.error("Token creation failed", err);
  process.exit(1);
});
