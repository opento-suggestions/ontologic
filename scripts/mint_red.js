import dotenv from "dotenv";
import {
  Client,
  PrivateKey,
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
} from "@hashgraph/sdk";

dotenv.config();

async function main() {
  // Connect
  const operatorId  = process.env.OPERATOR_ID;
  const operatorKey = PrivateKey.fromString(process.env.OPERATOR_DER_KEY);
  const client = Client.forTestnet().setOperator(operatorId, operatorKey);

  // Create $RED
  const tx = await new TokenCreateTransaction()
    .setTokenName("$RED")
    .setTokenSymbol("RED")
    .setTokenType(TokenType.FungibleCommon)
    .setDecimals(0)
    .setInitialSupply(10)
    .setTreasuryAccountId(operatorId)
    .setSupplyType(TokenSupplyType.Infinite)
    .freezeWith(client)
    .sign(operatorKey);

  const submit = await tx.execute(client);
  const receipt = await submit.getReceipt(client);

  console.log("✅ $RED token created:", receipt.tokenId.toString());
}

main().catch((err) => {
  console.error("Error minting $RED:", err);
  process.exit(1);
});
