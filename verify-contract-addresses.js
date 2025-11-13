import { ethers } from "ethers";
import "dotenv/config";

const provider = new ethers.JsonRpcProvider(process.env.HEDERA_RPC_URL);
const contractAddr = process.env.CONTRACT_ADDR;

const abi = [
  "function RED_TOKEN_ADDR() view returns (address)",
  "function GREEN_TOKEN_ADDR() view returns (address)",
  "function BLUE_TOKEN_ADDR() view returns (address)",
  "function YELLOW_TOKEN_ADDR() view returns (address)",
  "function CYAN_TOKEN_ADDR() view returns (address)",
  "function MAGENTA_TOKEN_ADDR() view returns (address)"
];

const contract = new ethers.Contract(contractAddr, abi, provider);

console.log("=== CONTRACT STORED ADDRESSES ===");
const red = await contract.RED_TOKEN_ADDR();
const green = await contract.GREEN_TOKEN_ADDR();
const blue = await contract.BLUE_TOKEN_ADDR();
const yellow = await contract.YELLOW_TOKEN_ADDR();
const cyan = await contract.CYAN_TOKEN_ADDR();
const magenta = await contract.MAGENTA_TOKEN_ADDR();

console.log("RED:    ", red);
console.log("GREEN:  ", green);
console.log("BLUE:   ", blue);
console.log("YELLOW: ", yellow);
console.log("CYAN:   ", cyan);
console.log("MAGENTA:", magenta);

console.log("\n=== EXPECTED FROM .env.example ===");
console.log("RED:    ", process.env.RED_ADDR);
console.log("GREEN:  ", process.env.GREEN_ADDR);
console.log("BLUE:   ", process.env.BLUE_ADDR);
console.log("YELLOW: ", process.env.YELLOW_ADDR);
console.log("CYAN:   ", process.env.CYAN_ADDR);
console.log("MAGENTA:", process.env.MAGENTA_ADDR);

console.log("\n=== MATCH STATUS ===");
console.log("RED matches:    ", red.toLowerCase() === process.env.RED_ADDR?.toLowerCase());
console.log("GREEN matches:  ", green.toLowerCase() === process.env.GREEN_ADDR?.toLowerCase());
console.log("BLUE matches:   ", blue.toLowerCase() === process.env.BLUE_ADDR?.toLowerCase());
console.log("YELLOW matches: ", yellow.toLowerCase() === process.env.YELLOW_ADDR?.toLowerCase());
console.log("CYAN matches:   ", cyan.toLowerCase() === process.env.CYAN_ADDR?.toLowerCase());
console.log("MAGENTA matches:", magenta.toLowerCase() === process.env.MAGENTA_ADDR?.toLowerCase());
