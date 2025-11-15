import { Client, PrivateKey, TokenInfoQuery, TokenId } from "@hashgraph/sdk";
import "dotenv/config";

const client = Client.forTestnet().setOperator(
  process.env.OPERATOR_ID,
  process.env.OPERATOR_DER_KEY
);

const tokens = {
  RED: process.env.RED_TOKEN_ID,
  GREEN: process.env.GREEN_TOKEN_ID,
  BLUE: process.env.BLUE_TOKEN_ID
};

for (const [name, tokenId] of Object.entries(tokens)) {
  try {
    const info = await new TokenInfoQuery()
      .setTokenId(TokenId.fromString(tokenId))
      .execute(client);

    console.log(`\n=== ${name} (${tokenId}) ===`);
    console.log(`Treasury: ${info.treasuryAccountId}`);
    console.log(`Total Supply: ${info.totalSupply}`);
    console.log(`Supply Type: ${info.supplyType}`);
  } catch (e) {
    console.log(`\n=== ${name} (${tokenId}) ===`);
    console.log(`ERROR: ${e.message}`);
  }
}

client.close();
