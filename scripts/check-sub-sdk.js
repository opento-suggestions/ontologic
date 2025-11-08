// scripts/check-sub-sdk.js
// Usage: node scripts/check-sub-sdk.js --A GREEN --B YELLOW --C CYAN
// Subtractive check: A - B == C in paint domain

import { readFileSync } from "fs";
import { ethers } from "ethers";
import { Client, ContractExecuteTransaction, ContractFunctionParameters, ContractId } from "@hashgraph/sdk";
import { getConfig } from "./lib/config.js";
import { canonicalize } from "./lib/canonicalize.js";
import * as logger from "./lib/logger.js";

function arg(name, d=null){ const i=process.argv.indexOf(name); return i<0?d:process.argv[i+1]; }

const A_SYM = arg("--A");
const B_SYM = arg("--B");
const C_SYM = arg("--C");
const EPSILON = parseInt(arg("--epsilon", "0"));

if (!A_SYM || !B_SYM || !C_SYM) {
  console.error("usage: node scripts/check-sub-sdk.js --A <TOKEN> --B <TOKEN> --C <TOKEN> [--epsilon N]");
  process.exit(1);
}

let TOKS = JSON.parse(readFileSync("./scripts/lib/tokens.json","utf8"));
function addrOf(sym){ if(sym.startsWith("0x")) return sym; const a=TOKS[sym]; if(!a) throw new Error(`unknown token: ${sym}`); return a; }

const cfg = await getConfig();
const A = addrOf(A_SYM);
const B = addrOf(B_SYM);
const C = addrOf(C_SYM);

const D_PAINT = ethers.keccak256(ethers.toUtf8Bytes("color.paint"));
const OP_SUB  = ethers.keccak256(ethers.toUtf8Bytes("check_sub@v1"));

const payload = {
  v: "0.4.2",
  layer: "tarski",
  mode: "subtractive",
  domain: "color.paint",
  operator: "check_sub@v1",
  inputs: [{ label: "A", token: A.toLowerCase() }, { label: "B", token: B.toLowerCase() }, { label: "C", token: C.toLowerCase() }],
  epsilon: EPSILON,
  relation: "A-B==C",
  rule: {
    contract: cfg.contract.toLowerCase(),
    codeHash: cfg.rule.codeHash,
    functionSelector: cfg.rule.fnSub,
    version: cfg.rule.version || "v0.4.2"
  },
  signer: cfg.signer.toLowerCase(),
  topicId: cfg.hcsTopicId,
  ts: new Date().toISOString()
};

const canon = canonicalize(payload);
const canonBytes = Buffer.from(canon, "utf8");
const kCanon = ethers.keccak256(canonBytes);

let hcsMeta = await cfg.hcsPost(cfg.hcsTopicId, canon);
logger.line({ stage:"hcs_post", ok:true, seq:hcsMeta.sequence, ts:hcsMeta.consensusTimestamp, proofHash:kCanon });

const canonicalUri = `hcs://${cfg.hcsTopicId}/${hcsMeta.consensusTimestamp}`;

// inputsHash for subtractive: keccak(A, B, C, domain, operator)
const inputsPreimage = ethers.AbiCoder.defaultAbiCoder().encode(
  ["address","address","address","bytes32","bytes32"],
  [A, B, C, D_PAINT, OP_SUB]
);
const inputsHash = ethers.keccak256(inputsPreimage);

const ruleHash = ethers.keccak256(ethers.solidityPacked(
  ["address","bytes32","string"],
  [cfg.contract.toLowerCase(), cfg.rule.codeHash, cfg.rule.version || "v0.4.2"]
));

const factHash = kCanon;

const client = Client.forTestnet().setOperator(process.env.OPERATOR_ID, process.env.OPERATOR_DER_KEY);

const evmAddrClean = cfg.contract.toLowerCase().replace("0x", "");
const entityNum = parseInt(evmAddrClean.slice(-8), 16);
const contractId = new ContractId(0, 0, entityNum);

const params = new ContractFunctionParameters()
  .addAddress(A)
  .addAddress(B)
  .addAddress(C)
  .addBytes32(Buffer.from(D_PAINT.replace("0x", ""), "hex"))
  .addBytes32(Buffer.from(inputsHash.replace("0x", ""), "hex"))
  .addBytes32(Buffer.from(kCanon.replace("0x", ""), "hex"))
  .addBytes32(Buffer.from(factHash.replace("0x", ""), "hex"))
  .addBytes32(Buffer.from(ruleHash.replace("0x", ""), "hex"))
  .addString(canonicalUri);

try {
  const tx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(300000)
    .setFunction("reasonCheckSub", params)
    .execute(client);

  logger.line({ stage:"contract_call", ok:true, action:"submitted", txId: tx.transactionId.toString() });

  const receipt = await tx.getReceipt(client);

  logger.line({
    stage:"contract_call",
    ok:true,
    action:"confirmed",
    status: receipt.status.toString(),
    txId: tx.transactionId.toString()
  });

  logger.line({
    stage:"proof_check",
    ok:true,
    proofHash:kCanon,
    inputsHash,
    domain:"color.paint",
    relation:`${A_SYM}-${B_SYM}==${C_SYM}`,
    txId: tx.transactionId.toString(),
    hcsSeq: hcsMeta.sequence,
    mirrorNode: `https://testnet.mirrornode.hedera.com/api/v1/transactions/${tx.transactionId.toString().replace("@", "-").replace(".", "-")}`
  });

} catch (e) {
  logger.line({ stage:"contract_call", ok:false, error:String(e) });
  process.exit(3);
}

client.close();
process.exit(0);
