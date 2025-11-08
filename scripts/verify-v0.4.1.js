/**
 * @fileoverview Full triple-equality verifier for Ontologic proofs (v0.4.1)
 * @module scripts/verify-v0.4.1
 *
 * Usage: node scripts/verify-v0.4.1.js --tx <hash>
 *
 * Verifies hash_local == hash_event == hash_hcs for any proof type.
 * Exit codes: 0=PASS, 2=MISMATCH, 3=NETWORK_ERROR
 */

import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getNetworkConfig, DEPLOYED_CONTRACT_ADDRESS } from "./lib/config.js";
import { hashCanonicalJSON } from "./lib/canonicalize.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Fetch HCS message by exact consensus timestamp
 */
async function fetchHCSMessage(topicId, consensusTimestamp) {
  try {
    const url = `https://testnet.mirrornode.hedera.com/api/v1/topics/${topicId}/messages?timestamp=${consensusTimestamp}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error(JSON.stringify({
        stage: "fetch-hcs",
        ok: false,
        error: `Mirror Node API returned ${response.status}`,
        url
      }));
      return null;
    }

    const data = await response.json();

    // Find exact message by timestamp
    const message = data.messages?.find(m => m.consensus_timestamp === consensusTimestamp);

    if (!message) {
      console.error(JSON.stringify({
        stage: "fetch-hcs",
        ok: false,
        error: "No message found at exact timestamp",
        consensusTimestamp,
        foundMessages: data.messages?.length || 0
      }));
      return null;
    }

    return message;
  } catch (error) {
    console.error(JSON.stringify({
      stage: "fetch-hcs",
      ok: false,
      error: error.message,
      stack: error.stack
    }));
    return null;
  }
}

/**
 * Extract consensusTimestamp from canonicalUri
 */
function parseCanonicalUri(uri) {
  // Format: hcs://0.0.7204585/1762575806.056544213
  const match = uri.match(/hcs:\/\/([\d.]+)\/([\d.]+)/);
  if (!match) {
    return null;
  }

  const [, topicId, timestamp] = match;
  return { topicId, consensusTimestamp: timestamp };
}

async function main() {
  try {
    const args = process.argv.slice(2);
    let txHash;

    for (let i = 0; i < args.length; i++) {
      if (args[i] === "--tx" && i + 1 < args.length) {
        txHash = args[++i];
      }
    }

    if (!txHash) {
      console.error(JSON.stringify({
        stage: "parse-args",
        ok: false,
        error: "Missing --tx <hash>",
        usage: "node scripts/verify-v0.4.1.js --tx <hash>"
      }));
      process.exit(1);
    }

    console.log(JSON.stringify({ stage: "init", ok: true, txHash }));

    const networkConfig = getNetworkConfig();
    const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);

    // 1. Fetch transaction receipt
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
      console.error(JSON.stringify({
        stage: "fetch-tx",
        ok: false,
        error: "Transaction not found"
      }));
      process.exit(3);
    }

    console.log(JSON.stringify({
      stage: "fetch-tx",
      ok: true,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString()
    }));

    // 2. Load contract ABI and parse logs
    const artifactPath = path.join(
      __dirname,
      "..",
      "artifacts",
      "contracts",
      "reasoningContract.sol",
      "ReasoningContract.json"
    );
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    const contractInterface = new ethers.Interface(artifact.abi);

    // 3. Find proof event
    let proofEvent = null;
    let eventType = null;
    let hash_event = null;
    let canonicalUri = null;

    for (const log of receipt.logs) {
      try {
        const parsed = contractInterface.parseLog({
          topics: log.topics,
          data: log.data
        });

        if (parsed && (parsed.name === "ProofAdd" || parsed.name === "ProofCheck" || parsed.name === "ProofEntity")) {
          proofEvent = parsed;
          eventType = parsed.name;

          // Extract hash and URI based on event type
          if (eventType === "ProofAdd" || eventType === "ProofCheck") {
            hash_event = proofEvent.args.proofHash;
            canonicalUri = proofEvent.args.canonicalUri;
          } else if (eventType === "ProofEntity") {
            hash_event = proofEvent.args.manifestHash;
            canonicalUri = proofEvent.args.uri;
          }

          break;
        }
      } catch {}
    }

    if (!proofEvent) {
      console.error(JSON.stringify({
        stage: "parse-event",
        ok: false,
        error: "No proof event found in transaction"
      }));
      process.exit(3);
    }

    console.log(JSON.stringify({
      stage: "parse-event",
      ok: true,
      eventType,
      hash_event,
      canonicalUri
    }));

    // 4. Extract HCS info from canonicalUri
    const hcsInfo = parseCanonicalUri(canonicalUri);
    if (!hcsInfo) {
      console.error(JSON.stringify({
        stage: "parse-uri",
        ok: false,
        error: "Invalid canonicalUri format",
        canonicalUri
      }));
      process.exit(3);
    }

    console.log(JSON.stringify({
      stage: "parse-uri",
      ok: true,
      topicId: hcsInfo.topicId,
      consensusTimestamp: hcsInfo.consensusTimestamp
    }));

    // 5. Fetch HCS message
    const hcsMessage = await fetchHCSMessage(hcsInfo.topicId, hcsInfo.consensusTimestamp);
    if (!hcsMessage) {
      console.error(JSON.stringify({
        stage: "verify",
        ok: false,
        error: "Failed to fetch HCS message"
      }));
      process.exit(3);
    }

    console.log(JSON.stringify({
      stage: "fetch-hcs",
      ok: true,
      sequenceNumber: hcsMessage.sequence_number,
      consensusTimestamp: hcsMessage.consensus_timestamp
    }));

    // 6. Decode HCS message and compute hash
    const canonicalPayload = Buffer.from(hcsMessage.message, 'base64').toString('utf8');
    const hash_hcs = ethers.keccak256(ethers.toUtf8Bytes(canonicalPayload));

    console.log(JSON.stringify({
      stage: "decode-hcs",
      ok: true,
      payloadBytes: canonicalPayload.length,
      hash_hcs
    }));

    // 7. Parse JSON and recompute local hash
    let parsedProof;
    try {
      parsedProof = JSON.parse(canonicalPayload);
    } catch (error) {
      console.error(JSON.stringify({
        stage: "parse-json",
        ok: false,
        error: "Invalid JSON in HCS message",
        message: error.message
      }));
      process.exit(3);
    }

    const hash_local = hashCanonicalJSON(parsedProof);

    console.log(JSON.stringify({
      stage: "hash-local",
      ok: true,
      hash_local,
      proofVersion: parsedProof.v,
      proofLayer: parsedProof.layer
    }));

    // 8. Triple-equality check
    const localMatchesEvent = hash_local.toLowerCase() === hash_event.toLowerCase();
    const eventMatchesHcs = hash_event.toLowerCase() === hash_hcs.toLowerCase();
    const localMatchesHcs = hash_local.toLowerCase() === hash_hcs.toLowerCase();

    const tripleEquality = localMatchesEvent && eventMatchesHcs && localMatchesHcs;

    if (!tripleEquality) {
      console.error(JSON.stringify({
        stage: "verify",
        ok: false,
        result: "MISMATCH",
        hash_local,
        hash_event,
        hash_hcs,
        comparison: {
          local_vs_event: localMatchesEvent,
          event_vs_hcs: eventMatchesHcs,
          local_vs_hcs: localMatchesHcs
        },
        txHash,
        blockNumber: receipt.blockNumber
      }));
      process.exit(2);
    }

    // 9. Success!
    console.log(JSON.stringify({
      stage: "verify",
      ok: true,
      result: "PASS",
      eventType,
      hash_local,
      hash_event,
      hash_hcs,
      tripleEquality: true,
      txHash,
      blockNumber: receipt.blockNumber,
      topicId: hcsInfo.topicId,
      consensusTimestamp: hcsInfo.consensusTimestamp,
      sequenceNumber: hcsMessage.sequence_number
    }));

    process.exit(0);

  } catch (error) {
    console.error(JSON.stringify({
      stage: "error",
      ok: false,
      error: error.message,
      stack: error.stack
    }));
    process.exit(3);
  }
}

main();
