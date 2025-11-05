import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import {
  Client,
  PrivateKey,
  TopicCreateTransaction,
} from "@hashgraph/sdk";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Load .env from parent directory
dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

async function main() {
  const operatorId  = process.env.OPERATOR_ID;
  const operatorKey = PrivateKey.fromString(process.env.OPERATOR_DER_KEY);
  const client = Client.forTestnet().setOperator(operatorId, operatorKey);

  console.log("Creating HCS topic for Ontologic Reasoning Proof Alpha Tree...");

  const tx = await new TopicCreateTransaction()
    .setTopicMemo("Ontologic Reasoning Proof Alpha Tree")
    .setSubmitKey(operatorKey)
    .execute(client);

  const receipt = await tx.getReceipt(client);
  const topicId = receipt.topicId;

  console.log("✅ HCS Topic created:", topicId.toString());
  console.log("\nAdd to your .env file:");
  console.log(`HCS_TOPIC_ID=${topicId.toString()}`);
  console.log("\nThis topic will store consensus-backed reasoning proofs.");
}

main().catch((err) => {
  console.error("Topic creation failed:", err);
  process.exit(1);
});
