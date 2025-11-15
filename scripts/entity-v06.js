// scripts/entity-v06.js
// Entity-level attestation executor (Floridi Layer - v0.6)
// Usage: node scripts/entity-v06.js <entity-bundle-path>
// Example: node scripts/entity-v06.js examples/mvp/entity-white-light.json

/**
 * v0.6 Entity Attestation Flow
 *
 * This script implements the Floridi layer execution for entity-level attestation.
 * It consumes evidence from previous reasoning proofs and produces a domain verdict.
 *
 * Architecture:
 * 1. Load entity manifest bundle (nsid, evidence[], domain, operator)
 * 2. Build canonical manifest JSON
 * 3. Compute manifestHash = keccak256(canonical)
 * 4. Post manifest to HCS (Floridi consensus plane)
 * 5. Call publishEntity(token, manifestHash, manifestUri)
 * 6. Emit ProofEntity event
 * 7. Mint verdict token (WHITE for color.entity.light, BLACK for color.entity.paint)
 *
 * Domain Verdict Logic (Rules Within Rules):
 * - LIGHT domain: Evidence references CMY proofs → YES → WHITE
 * - PAINT domain: Evidence references CMY proofs → YES → BLACK
 * - Invalid evidence → NO → revert
 */

import { readFileSync } from "fs";
import { ethers } from "ethers";
import {
  Client,
  ContractExecuteTransaction,
  ContractId,
  ContractFunctionParameters,
} from "@hashgraph/sdk";
import { getConfig } from "./lib/config.js";
import { canonicalize } from "./lib/canonicalize.js";
import * as logger from "./lib/logger.js";

// Parse command-line argument
const bundlePath = process.argv[2];
if (!bundlePath) {
  console.error("Usage: node scripts/entity-v06.js <entity-bundle-path>");
  console.error("Example: node scripts/entity-v06.js examples/mvp/entity-purple.json");
  process.exit(1);
}

// Load entity manifest bundle
let bundle;
try {
  bundle = JSON.parse(readFileSync(bundlePath, "utf8"));
} catch (err) {
  console.error(`Failed to load bundle: ${bundlePath}`);
  console.error(err.message);
  process.exit(1);
}

// Validate bundle structure
if (!bundle.nsid) {
  console.error("Entity bundle must have nsid (namespace identifier)");
  process.exit(1);
}
if (!bundle.evidence || !Array.isArray(bundle.evidence) || bundle.evidence.length === 0) {
  console.error("Entity bundle must have evidence array with at least one proof");
  process.exit(1);
}
if (!bundle.domain || !bundle.operator) {
  console.error("Entity bundle must specify domain and operator");
  process.exit(1);
}
if (!bundle.output || !bundle.output.token) {
  console.error("Entity bundle must specify output verdict token");
  process.exit(1);
}

const cfg = await getConfig();

// Extract entity token and verdict token
const entityToken = ethers.getAddress(bundle.output.token);
const verdictToken = bundle.output.verdict
  ? ethers.getAddress(bundle.output.verdict)
  : entityToken; // Default to same token if no separate verdict specified

logger.subsection("Entity Attestation (Floridi Layer v0.6 DRAFT)");
logger.info(`NSID: ${bundle.nsid}`);
logger.info(`Domain: ${bundle.domain}`);
logger.info(`Operator: ${bundle.operator}`);
logger.info(`Entity Token: ${entityToken}`);
logger.info(`Verdict Token: ${verdictToken}`);
logger.info(`Evidence Count: ${bundle.evidence.length}`);

// Display evidence proofs
logger.subsection("Evidence Proofs");
bundle.evidence.forEach((e, idx) => {
  logger.info(`[${idx + 1}] ${e.canonicalUri}`);
  logger.info(`    proofHash: ${e.proofHash}`);
  logger.info(`    inputs: ${e.inputs.map(i => i.symbol).join(" + ")}`);
});

// Build canonical entity manifest JSON (v0.6 schema)
const nowIso = new Date().toISOString();
const manifest = {
  v: bundle.v || "0.6.0",
  nsid: bundle.nsid,
  layer: "floridi",
  mode: "entity",
  domain: bundle.domain,
  operator: bundle.operator,
  evidence: bundle.evidence.map(e => ({
    proofHash: e.proofHash,
    canonicalUri: e.canonicalUri,
    hcsSeq: e.hcsSeq,
    inputs: e.inputs || [],
  })),
  output: {
    token: entityToken.toLowerCase(),
    verdict: verdictToken.toLowerCase(),
    amount: bundle.output.amount || "1"
  },
  signers: bundle.signers || [cfg.signer.toLowerCase()],
  nonce: bundle.nonce || ethers.hexlify(ethers.randomBytes(32)),
  topicId: cfg.hcsTopicId,
  ts: nowIso
};

const canon = canonicalize(manifest);
const canonBytes = Buffer.from(canon, "utf8");
if (canonBytes.length > 1024) {
  console.warn(`Warning: Canonical manifest is ${canonBytes.length} bytes (>1024 recommended)`);
}

const manifestHash = ethers.keccak256(canonBytes);

logger.line({
  stage: "manifest_canonicalize",
  ok: true,
  manifestHash,
  size: canonBytes.length
});

// Post to HCS (Floridi Consensus Layer)
let hcsMeta;
try {
  hcsMeta = await cfg.hcsPost(cfg.hcsTopicId, canon);
  logger.line({
    stage: "hcs_post",
    ok: true,
    seq: hcsMeta.sequence,
    ts: hcsMeta.consensusTimestamp,
    manifestHash
  });
} catch (e) {
  logger.line({ stage: "hcs_post", ok: false, error: String(e) });
  process.exit(3);
}

const manifestUri = `hcs://${cfg.hcsTopicId}/${hcsMeta.consensusTimestamp}`;

logger.subsection("Floridi Manifest Anchored");
logger.table({
  "Manifest Hash": manifestHash.slice(0, 16) + "...",
  "Manifest URI": manifestUri,
  "HCS Sequence": hcsMeta.sequence,
  "Evidence Proofs": bundle.evidence.length,
  "NSID": bundle.nsid
});

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

// Build function parameters for publishEntity
// NOTE: This uses ContractFunctionParameters (Hedera SDK pattern)
// publishEntity(address token, bytes32 manifestHash, string manifestUri)
const functionParams = new ContractFunctionParameters()
  .addAddress(entityToken)
  .addBytes32(Buffer.from(manifestHash.replace("0x", ""), "hex"))
  .addString(manifestUri);

logger.subsection("Entity Verdict Execution (v0.6 DRAFT)");
logger.info(`Calling publishEntity on contract ${contractId.toString()}`);
logger.info(`Entity Token: ${entityToken}`);
logger.info(`Manifest Hash: ${manifestHash}`);
logger.info(`Manifest URI: ${manifestUri}`);

// Execute contract via SDK
let receipt;
try {
  const tx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(300000)
    .setFunction("publishEntity", functionParams)
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

  logger.subsection("Entity Attestation Complete");
  logger.line({
    stage: "entity_publish",
    ok: true,
    nsid: bundle.nsid,
    manifestHash,
    manifestUri,
    entityToken,
    verdictToken,
    txId: tx.transactionId.toString(),
    hcsSeq: hcsMeta.sequence,
    mirrorNode: `https://testnet.mirrornode.hedera.com/api/v1/transactions/${tx.transactionId.toString().replace("@", "-").replace(".", "-")}`,
  });

  logger.success("Entity attestation complete!");
  logger.info(`\nVerify on HashScan: https://hashscan.io/testnet/transaction/${tx.transactionId.toString()}`);
  logger.info(`HCS manifest: https://hashscan.io/testnet/topic/${cfg.hcsTopicId}`);
  logger.info(`\nDomain Verdict: ${bundle.domain} → ${bundle.output.verdict ? "APPROVED" : "EVALUATED"}`);

} catch (e) {
  logger.line({ stage: "contract_call", ok: false, error: String(e) });
  logger.error("\n⚠️  Entity attestation failed");
  logger.error("\nContract error details:");
  logger.error(String(e));
  process.exit(3);
}

client.close();
process.exit(0);
