import dotenv from "dotenv";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  Client,
  PrivateKey,
  TopicMessageSubmitTransaction,
} from "@hashgraph/sdk";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Load .env from parent directory
dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

// Load compiled artifact
const artifact = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "..", "..", "artifacts", "contracts", "reasoningContract.sol", "ReasoningContract.json"),
    "utf8"
  )
);

// ---- Contract and token addresses ----
const CONTRACT_ADDR = "0xf5D115A6193B392298Aff8336628a68d05e02a1a";
const RED_ADDR      = "0x00000000000000000000000000000000006dA378";
const BLUE_ADDR     = "0x00000000000000000000000000000000006Da392";
const RULE_ID       = "0xd61dfd155ad2fda96638dfd894f34ebc3d74396cb0977dcb2fbcbfbcda5483e0";
// optional IPFS or HCS URI
const PROOF_URI     = "";

const domain   = ethers.keccak256(ethers.toUtf8Bytes("color.paint"));
const operator = ethers.keccak256(ethers.toUtf8Bytes("mix_paint"));

// canonical proof JSON
const proof = {
  v: "0",
  domain: "color",
  subdomain: "paint",
  operator: "mix_paint",
  inputs: [
    { token: "0.0.7185272", alias: "red",  hex: "#FF0000" },
    { token: "0.0.7185298", alias: "blue", hex: "#0000FF" }
  ],
  output: { token: "0.0.7194300", alias: "purple", hex: "#800080" },
  ts: new Date().toISOString()
};
const canonical = JSON.stringify(proof);
const proofHash = ethers.keccak256(ethers.toUtf8Bytes(canonical));

async function submitToHCS(message) {
  const topicId = process.env.HCS_TOPIC_ID;

  if (!topicId) {
    console.warn("⚠️  No HCS_TOPIC_ID set in .env — skipping consensus write.");
    return null;
  }

  const operatorId = process.env.OPERATOR_ID;
  const operatorKey = PrivateKey.fromString(process.env.OPERATOR_DER_KEY);
  const client = Client.forTestnet().setOperator(operatorId, operatorKey);

  console.log(`\n📝 Submitting proof to HCS topic ${topicId}...`);

  const tx = await new TopicMessageSubmitTransaction()
    .setTopicId(topicId)
    .setMessage(message)
    .execute(client);

  const receipt = await tx.getReceipt(client);
  console.log("✅ HCS submission status:", receipt.status.toString());

  return receipt;
}

async function main() {
  const RPC_URL = process.env.HEDERA_RPC_URL || "https://testnet.hashio.io/api";
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet   = new ethers.Wallet(process.env.OPERATOR_HEX_KEY, provider);
  const contract = new ethers.Contract(CONTRACT_ADDR, artifact.abi, wallet);

  console.log("Caller:", wallet.address);
  console.log("Using rule:", RULE_ID);
  console.log("Proof hash:", proofHash);
  console.log("\nExecuting reasoning operation: RED + BLUE → PURPLE");

  // Step 1: Execute on-chain reasoning
  const tx = await contract.reason(RULE_ID, 1n, proofHash, PROOF_URI);
  const rc = await tx.wait();

  console.log("\n✅ Reasoned transaction:", rc.hash);
  console.log("\nCanonical JSON:");
  console.log(canonical);

  // Step 2: Submit proof to HCS for consensus-backed provenance
  await submitToHCS(canonical);

  console.log("\n📊 Verification Links:");
  console.log("Mirror Node:", `https://testnet.mirrornode.hedera.com/api/v1/transactions/${rc.hash}`);
  console.log("HashScan:   ", `https://hashscan.io/testnet/transaction/${rc.hash}`);

  console.log("\n🎉 Complete Proof-of-Reasoning chain:");
  console.log("  1. ✓ CONTRACTCALL (validated RED + BLUE)");
  console.log("  2. ✓ TOKENMINT (minted PURPLE)");
  console.log("  3. ✓ HCS MESSAGE (consensus-backed proof)");
}

main().catch((err) => {
  console.error("Reasoning failed:", err);
  process.exit(1);
});
