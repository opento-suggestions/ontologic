// scripts/reason-add-v042.js
// Usage:
//   node scripts/reason-add-v042.js --A RED --B GREEN --out YELLOW
// Notes:
//   • Domain is fixed to color.light for additive
//   • Computes order-invariant inputsHash
//   • Posts canonical JSON to HCS, then calls reasonAdd(A,B,domainHash,ProofData)

import { readFileSync } from "fs";
import { ethers } from "ethers";

// ----- tiny arg helper
function arg(name, d=null){ const i=process.argv.indexOf(name); return i<0?d:process.argv[i+1]; }

// ----- config contract + env
import { getConfig } from "./lib/config.js";
import { canonicalize } from "./lib/canonicalize.js";
import * as logger from "./lib/logger.js";

const A_SYM = arg("--A");
const B_SYM = arg("--B");
const OUT_SYM = arg("--out");

if (!A_SYM || !B_SYM || !OUT_SYM) {
  console.error("usage: node scripts/reason-add-v042.js --A RED --B GREEN --out YELLOW");
  process.exit(1);
}

// ----- token map
let TOKS = {};
try { TOKS = JSON.parse(readFileSync("./scripts/lib/tokens.json","utf8")); }
catch { console.error("missing ./scripts/lib/tokens.json"); process.exit(1); }

function addrOf(sym){ if(sym.startsWith("0x")) return sym; const a=TOKS[sym]; if(!a) throw new Error(`unknown token: ${sym}`); return a; }

const cfg = await getConfig();
const provider = new ethers.JsonRpcProvider(cfg.rpc);
const wallet = new ethers.Wallet(cfg.pkey, provider);

// --- constants (must match contract)
const D_LIGHT = ethers.keccak256(ethers.toUtf8Bytes("color.light"));
const OP_ADD  = ethers.keccak256(ethers.toUtf8Bytes("mix_add@v1"));

// minimal ABI (struct ProofData)
const ABI = [
  "function reasonAdd(address A,address B,bytes32 domainHash,(bytes32 inputsHash,bytes32 proofHash,bytes32 factHash,bytes32 ruleHash,string canonicalUri) p) external returns (address outToken,uint64 amount)",
  "event ProofAdd(bytes32 indexed proofHash, bytes32 indexed domainHash, address A, address B, address outputToken, uint256 outputAmount, bytes32 inputsHash, bytes32 factHash, bytes32 ruleHash, string canonicalUri)"
];

const contract = new ethers.Contract(cfg.contract, ABI, wallet);

const A = addrOf(A_SYM);
const B = addrOf(B_SYM);
const OUT = addrOf(OUT_SYM);

// ---- canonical proof JSON (v0.4.2 schema)
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

// Use ethers keccak256
const kCanon = ethers.keccak256(canonBytes);

let hcsMeta;
try {
  hcsMeta = await cfg.hcsPost(cfg.hcsTopicId, canon); // { sequence, consensusTimestamp }
  logger.line({ stage:"hcs_post", ok:true, seq:hcsMeta.sequence, ts:hcsMeta.consensusTimestamp, proofHash:kCanon });
} catch (e) {
  logger.line({ stage:"hcs_post", ok:false, error:String(e) });
  process.exit(3);
}

// Build canonicalUri
const canonicalUri = `hcs://${cfg.hcsTopicId}/${hcsMeta.consensusTimestamp}`;

// inputsHash = keccak(min(A,B), max(A,B), D_LIGHT, OP_ADD)
const [X,Y] = (A.toLowerCase() < B.toLowerCase()) ? [A,B] : [B,A];
const inputsPreimage = ethers.AbiCoder.defaultAbiCoder().encode(
  ["address","address","bytes32","bytes32"],
  [X, Y, D_LIGHT, OP_ADD]
);
const inputsHash = ethers.keccak256(inputsPreimage);

// ruleHash = keccak256( packed( contract, codeHash, version ) )
// Note: Using string for version instead of bytes4 selector
const ruleHash = ethers.keccak256(ethers.solidityPacked(
  ["address","bytes32","string"],
  [cfg.contract.toLowerCase(), cfg.rule.codeHash, cfg.rule.version || "v0.4.2"]
));

// factHash = keccak256(raw HCS bytes) == proofHash in your pipeline
const factHash = kCanon;

// assemble ProofData
const p = {
  inputsHash,
  proofHash: kCanon,
  factHash,
  ruleHash,
  canonicalUri
};

// --- contract call
let rcpt;
try {
  const tx = await contract.reasonAdd(A, B, D_LIGHT, p);
  logger.line({ stage:"contract_call", ok:true, action:"submitted", txHash: tx.hash });
  rcpt = await tx.wait();
  logger.line({ stage:"contract_call", ok:true, action:"confirmed", txHash: rcpt.hash, blockNumber: rcpt.blockNumber, gasUsed: rcpt.gasUsed.toString() });
} catch (e) {
  logger.line({ stage:"contract_call", ok:false, error:String(e) });
  process.exit(3);
}

// --- event sanity
const iface = new ethers.Interface(ABI);
const ev = rcpt.logs.map(l=>{ try { return iface.parseLog(l); } catch { return null; }})
                   .filter(Boolean).find(e => e.name === "ProofAdd");
if (!ev) {
  logger.line({ stage:"event", ok:false, error:"ProofAdd not found" });
  process.exit(2);
}

logger.line({
  stage:"proof_add",
  ok:true,
  proofHash:kCanon,
  inputsHash,
  domain:"color.light",
  A:A_SYM,B:B_SYM,out:OUT_SYM,
  tx: rcpt.hash,
  hcsSeq: hcsMeta.sequence,
  mirrorNode: `https://testnet.mirrornode.hedera.com/api/v1/transactions/${rcpt.hash}`,
  hashScan: `https://hashscan.io/testnet/transaction/${rcpt.hash}`
});

process.exit(0);
