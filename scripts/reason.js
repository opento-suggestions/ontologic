// scripts/reason.js
// Generalized proof-of-reasoning executor
// Usage: node scripts/reason.js <bundle-path>
// Example: node scripts/reason.js examples/mvp/red-green-yellow.json

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

// Parse command-line argument
const bundlePath = process.argv[2];
if (!bundlePath) {
  console.error("Usage: node scripts/reason.js <bundle-path>");
  console.error("Example: node scripts/reason.js examples/mvp/red-green-yellow.json");
  process.exit(1);
}

// Load reasoning bundle
let bundle;
try {
  bundle = JSON.parse(readFileSync(bundlePath, "utf8"));
} catch (err) {
  console.error(`Failed to load bundle: ${bundlePath}`);
  console.error(err.message);
  process.exit(1);
}

// Validate bundle structure
if (!bundle.inputs || bundle.inputs.length !== 2) {
  console.error("Bundle must have exactly 2 inputs (binary additive reasoning)");
  process.exit(1);
}
if (!bundle.output || !bundle.output.token) {
  console.error("Bundle must specify output token");
  process.exit(1);
}
if (!bundle.domain || !bundle.operator) {
  console.error("Bundle must specify domain and operator");
  process.exit(1);
}

const cfg = await getConfig();

// Extract tokens from bundle
const A = ethers.getAddress(bundle.inputs[0].token);
const B = ethers.getAddress(bundle.inputs[1].token);
const OUT = ethers.getAddress(bundle.output.token);

// Domain and operator hashes (dynamic from bundle)
const domainHash = ethers.keccak256(ethers.toUtf8Bytes(bundle.domain));
const operatorHash = ethers.keccak256(ethers.toUtf8Bytes(bundle.operator));

// Build canonical proof JSON
const nowIso = new Date().toISOString();
const payload = {
  v: bundle.v || "0.5.2",
  layer: bundle.layer || "peirce",
  mode: bundle.mode || "additive",
  domain: bundle.domain,
  operator: bundle.operator,
  inputs: [
    { token: A.toLowerCase() },
    { token: B.toLowerCase() }
  ],
  output: { token: OUT.toLowerCase(), amount: bundle.output.amount || "1" },
  rule: {
    contract: cfg.contract.toLowerCase(),
    codeHash: cfg.rule.codeHash,
    functionSelector: cfg.rule.fnAdd,
    version: bundle.rule.version || cfg.rule.version || "v0.5.2"
  },
  signer: cfg.signer.toLowerCase(),
  topicId: cfg.hcsTopicId,
  ts: nowIso
};

const canon = canonicalize(payload);
const canonBytes = Buffer.from(canon, "utf8");
if (canonBytes.length > 1024) {
  console.error("Canonical payload > 1024 bytes");
  process.exit(1);
}

const kCanon = ethers.keccak256(canonBytes);

// Post to HCS (Layer 3: Consensus Record)
let hcsMeta;
try {
  hcsMeta = await cfg.hcsPost(cfg.hcsTopicId, canon);
  logger.line({
    stage: "hcs_post",
    ok: true,
    seq: hcsMeta.sequence,
    ts: hcsMeta.consensusTimestamp,
    proofHash: kCanon
  });
} catch (e) {
  logger.line({ stage: "hcs_post", ok: false, error: String(e) });
  process.exit(3);
}

const canonicalUri = `hcs://${cfg.hcsTopicId}/${hcsMeta.consensusTimestamp}`;

// Compute ProofData fields
const [X, Y] = (A.toLowerCase() < B.toLowerCase()) ? [A, B] : [B, A];
const inputsPreimage = ethers.AbiCoder.defaultAbiCoder().encode(
  ["address", "address", "bytes32", "bytes32"],
  [X, Y, domainHash, operatorHash]
);
const inputsHash = ethers.keccak256(inputsPreimage);

// ruleHash = semantic rule identity (domain:operator)
const ruleHash = ethers.keccak256(
  ethers.toUtf8Bytes(`${bundle.domain}:${bundle.operator}`)
);

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
  domainHash,
  proofData,
]);

logger.subsection("Glass Box Compression");
logger.info("Triune Proof → On-Chain Morpheme:");
logger.table({
  "Tarski (rule)": ruleHash.slice(0, 16) + "...",
  "Material (inputs)": inputsHash.slice(0, 16) + "...",
  "Floridi (canon)": kCanon.slice(0, 16) + "...",
  "Canonical URI": canonicalUri,
  "Function Selector": encodedFn.slice(0, 10)
});

// Execute contract via SDK (Layer 1: Logical Validation + Layer 2: Material Consequence)
let receipt;
try {
  const tx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(300000)
    .setFunctionParameters(Buffer.from(encodedFn.slice(2), "hex"))
    .execute(client);

  logger.line({
    stage: "contract_call",
    ok: true,
    action: "submitted",
    txId: tx.transactionId.toString()
  });

  receipt = await tx.getReceipt(client);

  logger.line({
    stage: "contract_call",
    ok: true,
    action: "confirmed",
    status: receipt.status.toString(),
    txId: tx.transactionId.toString()
  });

  // Get transaction record for logs/events
  const record = await tx.getRecord(client);

  logger.subsection("Triple-Layer Provenance");
  logger.line({
    stage: "proof_add",
    ok: true,
    proofHash: kCanon,
    inputsHash,
    domain: bundle.domain,
    A: bundle.inputs[0].symbol,
    B: bundle.inputs[1].symbol,
    out: bundle.output.symbol,
    txId: tx.transactionId.toString(),
    hcsSeq: hcsMeta.sequence,
    mirrorNode: `https://testnet.mirrornode.hedera.com/api/v1/transactions/${tx.transactionId.toString().replace("@", "-").replace(".", "-")}`,
  });

  logger.success("Proof execution complete!");
  logger.info(`\nVerify on HashScan: https://hashscan.io/testnet/transaction/${tx.transactionId.toString()}`);
  logger.info(`HCS proof: https://hashscan.io/testnet/topic/${cfg.hcsTopicId}`);

} catch (e) {
  logger.line({ stage: "contract_call", ok: false, error: String(e) });
  process.exit(3);
}

client.close();
process.exit(0);
