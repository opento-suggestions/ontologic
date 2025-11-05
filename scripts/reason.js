import dotenv from "dotenv";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

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

async function main() {
  const RPC_URL = process.env.HEDERA_RPC_URL || "https://testnet.hashio.io/api";
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet   = new ethers.Wallet(process.env.OPERATOR_HEX_KEY, provider);
  const contract = new ethers.Contract(CONTRACT_ADDR, artifact.abi, wallet);

  console.log("Caller:", wallet.address);
  console.log("Using rule:", RULE_ID);
  console.log("Proof hash:", proofHash);
  console.log("\nExecuting reasoning operation: RED + BLUE = PURPLE");

  const tx = await contract.reason(RULE_ID, 1n, proofHash, PROOF_URI);
  const rc = await tx.wait();

  console.log("\nReasoned transaction:", rc.hash);
  console.log("\nCanonical JSON:");
  console.log(canonical);
  console.log("\n=Verification Links:");
  console.log("Mirror Node:", `https://testnet.mirrornode.hedera.com/api/v1/transactions/${rc.hash}`);
  console.log("HashScan:   ", `https://hashscan.io/testnet/transaction/${rc.hash}`);

  console.log("\n<Proof-of-Reasoning complete! Check the links above for the Reasoned event.");
}

main().catch((err) => {
  console.error("Reasoning failed:", err);
  process.exit(1);
});
