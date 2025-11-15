// scripts/reason-add-sdk.js
// Usage: node scripts/reason-add-sdk.js --A RED --B GREEN --out YELLOW
// Uses Hedera SDK for contract execution (required for ContractId supply keys)

import { readFileSync } from "fs";
import { ethers, Interface } from "ethers";
import {
  Client,
  ContractExecuteTransaction,
  ContractId,
} from "@hashgraph/sdk";
import { getConfig } from "./lib/config.js";
import { canonicalize } from "./lib/canonicalize.js";
import * as logger from "./lib/logger.js";

// ABI fragment for reasonAdd with ProofData struct
const REASONING_ABI = [
  "function reasonAdd(address A, address B, bytes32 domainHash, (bytes32 inputsHash, bytes32 proofHash, bytes32 factHash, bytes32 ruleHash, string canonicalUri) p) external returns (address outToken, uint64 amount)"
];

const iface = new Interface(REASONING_ABI);

function arg(name, d=null){ const i=process.argv.indexOf(name); return i<0?d:process.argv[i+1]; }

const A_SYM = arg("--A");
const B_SYM = arg("--B");
const OUT_SYM = arg("--out");

if (!A_SYM || !B_SYM || !OUT_SYM) {
  console.error("usage: node scripts/reason-add-sdk.js --A RED --B GREEN --out YELLOW");
  process.exit(1);
}

let TOKS = {};
try { TOKS = JSON.parse(readFileSync("./scripts/lib/tokens.json","utf8")); }
catch { console.error("missing ./scripts/lib/tokens.json"); process.exit(1); }

function addrOf(sym){
  if(sym.startsWith("0x")) return ethers.getAddress(sym); // Checksum provided address
  const a=TOKS[sym];
  if(!a) throw new Error(`unknown token: ${sym}`);
  return ethers.getAddress(a); // Checksum address from tokens.json
}

const cfg = await getConfig();

const A = addrOf(A_SYM);
const B = addrOf(B_SYM);
const OUT = addrOf(OUT_SYM);

// Domain and operator constants
const D_LIGHT = ethers.keccak256(ethers.toUtf8Bytes("color.light"));
const OP_ADD  = ethers.keccak256(ethers.toUtf8Bytes("mix_add@v1"));

// Build canonical proof JSON
const nowIso = new Date().toISOString();
const payload = {
  v: "0.4.2",
  layer: "peirce",
  mode: "additive",
  domain: "color.light",
  operator: "mix_add@v1",
  inputs: [{ token: A.toLowerCase() }, { token: B.toLowerCase() }],
  output: { token: OUT.toLowerCase(), amount: "1" },
  rule: {
    contract: cfg.contract.toLowerCase(),
    codeHash: cfg.rule.codeHash,
    functionSelector: cfg.rule.fnAdd,
    version: cfg.rule.version || "v0.4.2"
  },
  signer: cfg.signer.toLowerCase(),
  topicId: cfg.hcsTopicId,
  ts: nowIso
};

const canon = canonicalize(payload);
const canonBytes = Buffer.from(canon, "utf8");
if (canonBytes.length > 1024) { console.error("canonical payload > 1024 bytes"); process.exit(1); }

const kCanon = ethers.keccak256(canonBytes);

// Post to HCS
let hcsMeta;
try {
  hcsMeta = await cfg.hcsPost(cfg.hcsTopicId, canon);
  logger.line({ stage:"hcs_post", ok:true, seq:hcsMeta.sequence, ts:hcsMeta.consensusTimestamp, proofHash:kCanon });
} catch (e) {
  logger.line({ stage:"hcs_post", ok:false, error:String(e) });
  process.exit(3);
}

const canonicalUri = `hcs://${cfg.hcsTopicId}/${hcsMeta.consensusTimestamp}`;

// Compute ProofData fields
const [X,Y] = (A.toLowerCase() < B.toLowerCase()) ? [A,B] : [B,A];
const inputsPreimage = ethers.AbiCoder.defaultAbiCoder().encode(
  ["address","address","bytes32","bytes32"],
  [X, Y, D_LIGHT, OP_ADD]
);
const inputsHash = ethers.keccak256(inputsPreimage);

const ruleHash = ethers.keccak256(ethers.solidityPacked(
  ["address","bytes32","string"],
  [cfg.contract.toLowerCase(), cfg.rule.codeHash, cfg.rule.version || "v0.4.2"]
));

const factHash = kCanon;

// Create Hedera SDK client
const client = Client.forTestnet().setOperator(
  process.env.OPERATOR_ID,
  process.env.OPERATOR_DER_KEY
);

// Convert contract address to ContractId
const evmAddrClean = cfg.contract.toLowerCase().replace("0x", "");
const entityNumHex = evmAddrClean.slice(-8);
const entityNum = parseInt(entityNumHex, 16);
const contractId = new ContractId(0, 0, entityNum);

// Build ProofData struct and encode function call via ethers.Interface
const proofData = {
  inputsHash,
  proofHash: kCanon,
  factHash,
  ruleHash,
  canonicalUri,
};

const encodedFn = iface.encodeFunctionData("reasonAdd", [
  A,
  B,
  D_LIGHT,
  proofData,
]);

// DEBUG: Print all computed values before contract call
console.log("\n=== DEBUG: Parameters Being Sent to Contract ===");
console.log("Token A (original):", A);
console.log("Token B (original):", B);
console.log("Token A (sorted X):", X);
console.log("Token B (sorted Y):", Y);
console.log("Output Token:", OUT);
console.log("D_LIGHT:", D_LIGHT);
console.log("OP_ADD:", OP_ADD);
console.log("inputsPreimage:", inputsPreimage);
console.log("inputsHash:", inputsHash);
console.log("proofHash (kCanon):", kCanon);
console.log("factHash:", factHash);
console.log("ruleHash:", ruleHash);
console.log("canonicalUri:", canonicalUri);
console.log("Contract ID:", contractId.toString());
console.log("Encoded call data length:", encodedFn.length);
console.log("Function selector (first 10 chars):", encodedFn.slice(0, 10));
console.log("=== END DEBUG ===\n");

// Execute contract via SDK with properly encoded struct
let receipt;
try {
  const tx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(300000)
    .setFunctionParameters(Buffer.from(encodedFn.slice(2), "hex"))
    .execute(client);

  logger.line({ stage:"contract_call", ok:true, action:"submitted", txId: tx.transactionId.toString() });

  receipt = await tx.getReceipt(client);

  logger.line({
    stage:"contract_call",
    ok:true,
    action:"confirmed",
    status: receipt.status.toString(),
    txId: tx.transactionId.toString()
  });

  // Get transaction record for logs/events
  const record = await tx.getRecord(client);

  logger.line({
    stage:"proof_add",
    ok:true,
    proofHash:kCanon,
    inputsHash,
    domain:"color.light",
    A:A_SYM,B:B_SYM,out:OUT_SYM,
    txId: tx.transactionId.toString(),
    hcsSeq: hcsMeta.sequence,
    mirrorNode: `https://testnet.mirrornode.hedera.com/api/v1/transactions/${tx.transactionId.toString().replace("@", "-").replace(".", "-")}`,
  });

} catch (e) {
  logger.line({ stage:"contract_call", ok:false, error:String(e) });
  process.exit(3);
}

client.close();
process.exit(0);
