import { ethers } from "ethers";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  // Connect to Hedera testnet via Hiero JSON-RPC
  const RPC_URL = process.env.HEDERA_RPC_URL || "https://testnet.hashio.io/api";
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(process.env.OPERATOR_HEX_KEY, provider);

  console.log("Deploying from account:", wallet.address);
  console.log("Using RPC endpoint:", RPC_URL);

  // Load compiled contract
  const artifactPath = path.join(__dirname, "..", "artifacts", "contracts", "reasoningContract.sol", "ReasoningContract.json");
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  // Create contract factory
  const ReasoningContract = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);

  // Generate schema hash and deploy
  const schemaHash = ethers.keccak256(ethers.toUtf8Bytes("reasoning.v0"));
  console.log("Schema hash:", schemaHash);

  const contract = await ReasoningContract.deploy(schemaHash);
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  console.log("✅ ReasoningContract deployed to:", contractAddress);
  console.log("\nNext steps:");
  console.log("1. Grant this contract supply key permissions for $PURPLE token");
  console.log("2. Use TokenUpdateTransaction to assign", contractAddress, "as supply key");
}

main().catch((err) => {
  console.error("Deploy failed:", err);
  process.exit(1);
});
