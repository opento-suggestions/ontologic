// Quick test: Do addresses match in Solidity?
import { ethers } from "ethers";

const clientAddr = ethers.getAddress("0x00000000000000000000000000000000006e9742");
const contractAddr = "0x00000000000000000000000000000000006E9742"; // From query

console.log("Client (checksummed):", clientAddr);
console.log("Contract (from state):", contractAddr);
console.log("String equality:", clientAddr === contractAddr);
console.log("Bytes equality (after normalization):", ethers.getAddress(clientAddr) === ethers.getAddress(contractAddr));
