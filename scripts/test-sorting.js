// Test address sorting
import { ethers } from "ethers";

const A = ethers.getAddress("0x00000000000000000000000000000000006e9742");
const B = ethers.getAddress("0x00000000000000000000000000000000006e9743");

console.log("A:", A);
console.log("B:", B);
console.log("A < B (Solidity-style):", A < B);
console.log("A < B (numeric):", BigInt(A) < BigInt(B));

const [X, Y] = A < B ? [A, B] : [B, A];
console.log("X (min):", X);
console.log("Y (max):", Y);

// Contract expectations
const RED = "0x00000000000000000000000000000000006E9742";
const GREEN = "0x00000000000000000000000000000000006E9743";

console.log("\nContract state:");
console.log("RED_TOKEN_ADDR:", RED);
console.log("GREEN_TOKEN_ADDR:", GREEN);

console.log("\nComparison:");
console.log("X == RED:", X === RED);
console.log("Y == GREEN:", Y === GREEN);
