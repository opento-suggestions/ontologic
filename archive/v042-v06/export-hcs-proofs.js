/**
 * @fileoverview Export HCS topic proofs to JSON snapshot
 * Usage: node scripts/export-hcs-proofs.js
 */

import fs from 'fs';
import { ethers } from 'ethers';

const rawData = JSON.parse(fs.readFileSync('./proofs/hcs-raw-fetch.json', 'utf8'));

const proofs = rawData.messages.map(msg => {
  // Decode base64 message
  const messageBytes = Buffer.from(msg.message, 'base64');
  const messageText = messageBytes.toString('utf8');

  let proof;
  try {
    proof = JSON.parse(messageText);
  } catch (e) {
    console.error(`Failed to parse message ${msg.sequence_number}:`, e.message);
    return null;
  }

  // Compute proof hash for verification
  const proofHash = ethers.keccak256(ethers.toUtf8Bytes(messageText));

  return {
    sequence: parseInt(msg.sequence_number),
    consensusTimestamp: msg.consensus_timestamp,
    payerAccountId: msg.payer_account_id,
    runningHash: msg.running_hash,
    runningHashVersion: msg.running_hash_version,
    messageSize: messageBytes.length,
    proofHash,
    proof
  };
}).filter(Boolean).sort((a, b) => a.sequence - b.sequence);

// Summary by layer
const summary = {
  topic: "0.0.7204585",
  description: "Ontologic Reasoning Proof Alpha Tree - v0.4.2 Validation",
  version: "v0.4.2",
  totalProofs: proofs.length,
  sequences: {
    start: proofs[0]?.sequence,
    end: proofs[proofs.length - 1]?.sequence
  },
  layers: {
    peirce: proofs.filter(p => p.proof.layer === 'peirce').length,
    tarski: proofs.filter(p => p.proof.layer === 'tarski').length
  },
  modes: {
    additive: proofs.filter(p => p.proof.mode === 'additive').length,
    subtractive: proofs.filter(p => p.proof.mode === 'subtractive').length
  }
};

// Create snapshot
const snapshot = {
  meta: {
    exportedAt: new Date().toISOString(),
    topicId: "0.0.7204585",
    version: "v0.4.2",
    contract: proofs[0]?.proof?.rule?.contract || "N/A",
    codeHash: proofs[0]?.proof?.rule?.codeHash || "N/A"
  },
  summary,
  proofs
};

// Write snapshot
fs.writeFileSync(
  './proofs/hcs-topic-0.0.7204585-v042.json',
  JSON.stringify(snapshot, null, 2)
);

console.log(JSON.stringify({
  stage: "export-complete",
  ok: true,
  outputFile: "./proofs/hcs-topic-0.0.7204585-v042.json",
  summary
}));
