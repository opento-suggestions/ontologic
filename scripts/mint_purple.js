import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import {
  Client,
  PrivateKey,
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
  ContractId,
} from "@hashgraph/sdk";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Load .env from parent directory
dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

const CONTRACT_ADDR = "0xf5D115A6193B392298Aff8336628a68d05e02a1a";

async function main() {
  // Connect
  const operatorId  = process.env.OPERATOR_ID;
  const operatorKey = PrivateKey.fromString(process.env.OPERATOR_DER_KEY);
  const client = Client.forTestnet().setOperator(operatorId, operatorKey);

  console.log("Creating $PURPLE token with contract as supply key...");
  console.log("Contract address:", CONTRACT_ADDR);

  // Convert EVM address to ContractId for supply key
  // Note: The contract must exist on-chain for this to work
  const contractId = ContractId.fromEvmAddress(0, 0, CONTRACT_ADDR);

  // Create $PURPLE with contract as supply key
  const tx = await new TokenCreateTransaction()
    .setTokenName("$PURPLE")
    .setTokenSymbol("PURPLE")
    .setTokenType(TokenType.FungibleCommon)
    .setDecimals(0)
    .setInitialSupply(0)  // Start with 0, contract will mint
    .setTreasuryAccountId(operatorId)
    .setSupplyType(TokenSupplyType.Infinite)
    .setSupplyKey(contractId)  // Contract can mint this token
    .freezeWith(client)
    .sign(operatorKey);

  const submit = await tx.execute(client);
  const receipt = await submit.getReceipt(client);

  const tokenId = receipt.tokenId.toString();
  console.log("✅ $PURPLE token created:", tokenId);

  // Calculate EVM address for the token
  const parts = tokenId.split(".");
  const tokenNum = parseInt(parts[2]);
  const evmAddr = "0x" + tokenNum.toString(16).padStart(40, "0");

  console.log("\nAdd to your .env file:");
  console.log(`PURPLE_TOKEN_ID=${tokenId}`);
  console.log(`PURPLE_ADDR=${evmAddr}`);
}

main().catch((err) => {
  console.error("Error creating $PURPLE:", err);
  process.exit(1);
});
