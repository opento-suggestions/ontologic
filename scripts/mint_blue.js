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

  // Create $BLUE
  const tx = await new TokenCreateTransaction()
    .setTokenName("$BLUE")
    .setTokenSymbol("BLUE")
    .setTokenType(TokenType.FungibleCommon)
    .setDecimals(0)
    .setInitialSupply(10)
    .setTreasuryAccountId(operatorId)
    .setSupplyType(TokenSupplyType.Infinite)
    .freezeWith(client)
    .sign(operatorKey);

  const submit = await tx.execute(client);
  const receipt = await submit.getReceipt(client);

  console.log("✅ $BLUE token created:", receipt.tokenId.toString());
}

main().catch((err) => {
  console.error("Error minting $BLUE:", err);
  process.exit(1);
});
