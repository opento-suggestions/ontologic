import dotenv from "dotenv";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Load .env from parent directory
dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

const artifact = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "..", "artifacts", "contracts", "reasoningContract.sol", "ReasoningContract.json"), "utf8")
);

// Contract and token addresses
const CONTRACT_ADDR = "0xf5D115A6193B392298Aff8336628a68d05e02a1a";
const RED_ADDR  = process.env.RED_ADDR;   // EVM address for 0.0.7185272
const BLUE_ADDR = process.env.BLUE_ADDR;  // EVM address for 0.0.7185298
const PURPLE_ADDR = process.env.PURPLE_ADDR || ethers.ZeroAddress; // Will be created in next step

const domain   = ethers.keccak256(ethers.toUtf8Bytes("color.paint"));
const operator = ethers.keccak256(ethers.toUtf8Bytes("mix_paint"));

async function main() {
  const RPC_URL = process.env.HEDERA_RPC_URL || "https://testnet.hashio.io/api";
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet   = new ethers.Wallet(process.env.OPERATOR_HEX_KEY, provider);

  console.log("Setting rule from account:", wallet.address);
  console.log("Contract address:", CONTRACT_ADDR);
  console.log("RED token:", RED_ADDR);
  console.log("BLUE token:", BLUE_ADDR);
  console.log("Output (PURPLE) token:", PURPLE_ADDR);

  if (!RED_ADDR || !BLUE_ADDR) {
    throw new Error("RED_ADDR and BLUE_ADDR must be set in .env");
  }

  if (PURPLE_ADDR === ethers.ZeroAddress) {
    console.warn("\n⚠️  WARNING: PURPLE_ADDR not set. You must create the $PURPLE token first.");
    console.warn("After creating $PURPLE, add PURPLE_ADDR to .env and run this script again.\n");
    process.exit(1);
  }

  const c = new ethers.Contract(CONTRACT_ADDR, artifact.abi, wallet);

  const tx = await c.setRule(
    domain,
    operator,
    [RED_ADDR, BLUE_ADDR],
    PURPLE_ADDR,   // outputToken for PURPLE
    1n             // ratioNumerator: 1:1 ratio
  );
  const rc = await tx.wait();
  console.log("✅ setRule mined in tx:", rc.hash);

  // Calculate and display the ruleId
  const ruleId = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "bytes32", "address[]"],
    [domain, operator, [RED_ADDR, BLUE_ADDR]]
  ));
  console.log("Rule ID:", ruleId);
}

main().catch(e => { console.error(e); process.exit(1); });
