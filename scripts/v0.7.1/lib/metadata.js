/**
 * @fileoverview Shared token metadata utilities for provenance stamping
 * @module scripts/v0.7.1/lib/metadata
 *
 * Stores a compact provenance commitment on the token (hash chain),
 * not the full history. The full history lives on HCS (PROOF_TOPIC).
 *
 * Token metadata format: {"n":<count>,"root":"0x<keccak256>"}
 * ~80 bytes. Always fits within token metadata limits.
 *
 * Hash chain: newRoot = keccak256(prevRoot + keccak256(canonicalize(entry)))
 * Verifiable by reconstructing from HCS messages and recomputing the chain.
 *
 * Hard invariant: HCS anchor MUST land BEFORE metadata stamp.
 */

import {
  TokenUpdateTransaction,
} from "@hashgraph/sdk";
import { ethers } from "ethers";
import { canonicalizeJSON } from "../../v0.6.3/lib/canonicalize.js";

/**
 * Fetch current provenance state from token metadata
 * @param {string} mirrorUrl - Mirror node base URL
 * @param {string} tokenId - Hedera token ID (e.g., "0.0.8641316")
 * @returns {Promise<{n: number, root: string|null}>} Current provenance state
 */
export async function fetchProvenanceState(mirrorUrl, tokenId) {
  const url = `${mirrorUrl}/tokens/${tokenId}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Mirror node ${response.status}: ${url}`);
  }

  const data = await response.json();

  if (data.metadata && data.metadata.length > 0) {
    try {
      const decoded = Buffer.from(data.metadata, "base64").toString("utf8");
      const parsed = JSON.parse(decoded);
      if (typeof parsed.n === "number" && parsed.root) {
        return { n: parsed.n, root: parsed.root };
      }
    } catch {
      // Metadata exists but isn't our format — start fresh
    }
  }

  return { n: 0, root: null };
}

/**
 * Build a provenance entry for the hash chain
 * @param {Object} params
 * @param {string} params.bindingHash - Proof binding hash
 * @param {string} params.domain - Rule domain (e.g., "color.light", "color.paint")
 * @param {string} params.ruleId - Rule identifier
 * @param {string} params.proofUri - HCS proof URI
 * @param {string} params.proofMode - "contract" or "registry"
 * @returns {Object} Provenance entry
 */
export function buildProvenanceEntry(params) {
  return {
    bindingHash: params.bindingHash,
    domain: params.domain,
    ruleId: params.ruleId,
    proofUri: params.proofUri,
    proofMode: params.proofMode,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Stamp token metadata with updated provenance commitment
 *
 * Computes hash chain: newRoot = keccak256(prevRoot + entryHash)
 * Stores compact {n, root} as token metadata.
 *
 * @param {Client} client - Hedera SDK client
 * @param {string} tokenId - Token to update
 * @param {{n: number, root: string|null}} currentState - Current provenance state
 * @param {Object} newEntry - Provenance entry to append
 * @param {PrivateKey} operatorKey - Operator key (holds metadata key)
 * @returns {Promise<{status: string, n: number, root: string}>}
 */
export async function stampProvenance(client, tokenId, currentState, newEntry, operatorKey) {
  // Compute entry hash
  const entryHash = ethers.keccak256(ethers.toUtf8Bytes(canonicalizeJSON(newEntry)));

  // Compute new root via hash chain
  let newRoot;
  if (currentState.root) {
    // Chain: keccak256(prevRoot + entryHash)
    newRoot = ethers.keccak256(
      ethers.concat([currentState.root, entryHash])
    );
  } else {
    // First entry: root = entryHash
    newRoot = entryHash;
  }

  const newN = currentState.n + 1;

  // Compact metadata: always ~80 bytes
  const metadata = JSON.stringify({ n: newN, root: newRoot });
  const metadataBytes = Buffer.from(metadata, "utf8");

  const updateTx = await new TokenUpdateTransaction()
    .setTokenId(tokenId)
    .setMetadata(metadataBytes)
    .freezeWith(client);

  const signedTx = await updateTx.sign(operatorKey);
  const response = await signedTx.execute(client);
  const receipt = await response.getReceipt(client);

  return { status: receipt.status.toString(), n: newN, root: newRoot };
}
