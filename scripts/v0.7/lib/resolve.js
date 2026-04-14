/**
 * @fileoverview Resolution algorithms for v0.7 rule registry
 * @module scripts/v07/lib/resolve
 *
 * Implements:
 * - Algorithm 11.1: ruleUri → RuleDef resolution
 * - Algorithm 11.2: ruleId + "latest" → ruleUri resolution
 */

import { ethers } from "ethers";
import { canonicalizeJSON } from "../../v0.6.3/lib/canonicalize.js";
import { getNetworkConfig } from "../../v0.6.3/lib/config.js";

/**
 * Parse an HCS URI into its components
 * @param {string} ruleUri - HCS URI (e.g., "hcs://0.0.12345/1763200000.000000000")
 * @returns {{topicId: string, timestamp: string}} Parsed components
 * @throws {Error} If URI format is invalid
 */
export function parseHcsUri(ruleUri) {
  const match = ruleUri.match(/^hcs:\/\/(\d+\.\d+\.\d+)\/(\d+\.\d+)$/);
  if (!match) {
    throw new Error(`Invalid ruleUri format: ${ruleUri}. Expected: hcs://<topicId>/<timestamp>`);
  }
  return {
    topicId: match[1],
    timestamp: match[2]
  };
}

/**
 * Build an HCS URI from components
 * @param {string} topicId - HCS topic ID (e.g., "0.0.12345")
 * @param {string} timestamp - Consensus timestamp (e.g., "1763200000.000000000")
 * @returns {string} HCS URI
 */
export function buildHcsUri(topicId, timestamp) {
  return `hcs://${topicId}/${timestamp}`;
}

/**
 * Compute SHA256 hash of ruleUri string
 * @param {string} ruleUri - HCS URI string
 * @returns {string} SHA256 hash (0x prefixed)
 */
export function computeRuleUriHash(ruleUri) {
  return ethers.sha256(ethers.toUtf8Bytes(ruleUri));
}

/**
 * Resolve ruleUri to RuleDef from HCS via mirror node
 * Algorithm 11.1 from rule-registry-v07.md
 *
 * @param {string} ruleUri - HCS URI pointing to RuleDef message
 * @param {Object} [options] - Resolution options
 * @param {string} [options.mirrorNodeUrl] - Override mirror node URL
 * @param {boolean} [options.skipVerification] - Skip hash verification
 * @returns {Promise<Object>} Resolved RuleDef object
 * @throws {Error} If resolution fails or verification fails
 */
export async function resolveRuleDef(ruleUri, options = {}) {
  // 1. Parse URI
  const { topicId, timestamp } = parseHcsUri(ruleUri);

  // 2. Query mirror node
  const networkConfig = getNetworkConfig();
  const mirrorNodeUrl = options.mirrorNodeUrl || networkConfig.mirrorNodeUrl;

  // Format timestamp for query (seconds.nanos format)
  const url = `${mirrorNodeUrl}/topics/${topicId}/messages?timestamp=${timestamp}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Mirror node query failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (!data.messages || data.messages.length === 0) {
    throw new Error(`RuleDef not found at ${ruleUri}`);
  }

  // 3. Handle chunked messages (HCS splits large messages)
  const firstMsg = data.messages[0];
  let messageBody;

  if (firstMsg.chunk_info && firstMsg.chunk_info.total > 1) {
    // Message is chunked - need to fetch and reassemble all chunks
    const totalChunks = firstMsg.chunk_info.total;
    const initialTxId = firstMsg.chunk_info.initial_transaction_id;

    // Collect all chunks with the same initial_transaction_id.
    // The timestamp query may land on any chunk (not necessarily #1),
    // and batch publishing can interleave chunks with other messages.
    // Strategy: search a bounded window around the hit (back + forward).
    // Cap at 8 mirror node queries total to stay under 10 per resolve.
    const txStart = initialTxId.transaction_valid_start;
    const seqNum = parseInt(firstMsg.sequence_number, 10);
    const chunks = [firstMsg];
    const maxQueries = 8;
    let queries = 0;

    // Search backward from hit (chunks may precede our entry point)
    const backStart = Math.max(1, seqNum - totalChunks * 3);
    let backLink = `${mirrorNodeUrl}/topics/${topicId}/messages?sequencenumber=gte:${backStart}&sequencenumber=lt:${seqNum}&limit=100`;
    while (chunks.length < totalChunks && backLink && queries < maxQueries) {
      queries++;
      const resp = await fetch(backLink);
      const data = await resp.json();
      for (const m of data.messages || []) {
        if (m.chunk_info &&
            m.chunk_info.initial_transaction_id.transaction_valid_start === txStart) {
          chunks.push(m);
        }
      }
      backLink = data.links?.next ? `${mirrorNodeUrl}${data.links.next}` : null;
    }

    // Search forward from hit (sibling chunks may follow)
    let fwdLink = `${mirrorNodeUrl}/topics/${topicId}/messages?sequencenumber=gt:${seqNum}&limit=100`;
    while (chunks.length < totalChunks && fwdLink && queries < maxQueries) {
      queries++;
      const resp = await fetch(fwdLink);
      const data = await resp.json();
      for (const m of data.messages || []) {
        if (m.chunk_info &&
            m.chunk_info.initial_transaction_id.transaction_valid_start === txStart) {
          chunks.push(m);
        }
      }
      fwdLink = data.links?.next ? `${mirrorNodeUrl}${data.links.next}` : null;
    }

    chunks.sort((a, b) => a.chunk_info.number - b.chunk_info.number);

    if (chunks.length !== totalChunks) {
      throw new Error(`Expected ${totalChunks} chunks, found ${chunks.length}`);
    }

    // Reassemble message from chunks
    const reassembled = chunks
      .map(c => Buffer.from(c.message, "base64").toString("utf8"))
      .join("");

    messageBody = reassembled;
  } else {
    // Single message, no chunking
    messageBody = Buffer.from(firstMsg.message, "base64").toString("utf8");
  }

  // 4. Parse as RuleDef
  let ruleDef;
  try {
    ruleDef = JSON.parse(messageBody);
  } catch (e) {
    throw new Error(`Failed to parse RuleDef JSON: ${e.message}`);
  }

  // 5. Validate schema
  if (ruleDef.schema !== "hcs.ontologic.ruleDef") {
    throw new Error(`Invalid schema: ${ruleDef.schema}. Expected: hcs.ontologic.ruleDef`);
  }

  // 6. Verify ruleUriHash if present and verification not skipped
  if (!options.skipVerification && ruleDef.ruleUriHash) {
    const computedHash = computeRuleUriHash(ruleUri);
    if (computedHash.toLowerCase() !== ruleDef.ruleUriHash.toLowerCase()) {
      throw new Error(`ruleUriHash mismatch. Computed: ${computedHash}, Found: ${ruleDef.ruleUriHash}`);
    }
  }

  // 7. Verify contentHash if present and verification not skipped
  if (!options.skipVerification && ruleDef.contentHash) {
    // Remove self-referential fields before hashing
    const verifyObj = { ...ruleDef };
    delete verifyObj.ruleUri;
    delete verifyObj.ruleUriHash;
    delete verifyObj.contentHash;

    const canonical = canonicalizeJSON(verifyObj);
    const computedContentHash = ethers.keccak256(ethers.toUtf8Bytes(canonical));

    if (computedContentHash.toLowerCase() !== ruleDef.contentHash.toLowerCase()) {
      throw new Error(`contentHash mismatch. Computed: ${computedContentHash}, Found: ${ruleDef.contentHash}`);
    }
  }

  return ruleDef;
}

/**
 * Resolve ruleId + "latest" to ruleUri from rule registry
 * Algorithm 11.2 from rule-registry-v07.md
 *
 * @param {string} ruleId - Rule identifier (e.g., "sphere://demo/light/red-green-yellow")
 * @param {string} registryTopicId - HCS topic ID for rule registry
 * @param {Object} [options] - Resolution options
 * @param {string} [options.mirrorNodeUrl] - Override mirror node URL
 * @param {string} [options.version] - Specific version to find (default: "latest")
 * @returns {Promise<string>} Resolved ruleUri
 * @throws {Error} If rule not found
 */
export async function resolveLatestRule(ruleId, registryTopicId, options = {}) {
  const networkConfig = getNetworkConfig();
  const mirrorNodeUrl = options.mirrorNodeUrl || networkConfig.mirrorNodeUrl;

  // 1. Query all registry entries (paginated)
  let allEntries = [];
  let nextLink = `${mirrorNodeUrl}/topics/${registryTopicId}/messages?limit=100`;

  while (nextLink) {
    const response = await fetch(nextLink);
    if (!response.ok) {
      throw new Error(`Mirror node query failed: ${response.status}`);
    }

    const data = await response.json();

    // Parse each message
    for (const msg of data.messages || []) {
      try {
        const payload = Buffer.from(msg.message, "base64").toString("utf8");
        const entry = JSON.parse(payload);

        // 2. Filter by ruleId match and schema
        if (
          entry.schema === "hcs.ontologic.ruleRegistryEntry" &&
          entry.ruleId === ruleId &&
          entry.status === "active"
        ) {
          allEntries.push(entry);
        }
      } catch (e) {
        // Skip invalid messages silently
        continue;
      }
    }

    // Handle pagination
    nextLink = data.links?.next ? `${mirrorNodeUrl}${data.links.next}` : null;
  }

  if (allEntries.length === 0) {
    throw new Error(`Rule not found in registry: ${ruleId}`);
  }

  // 3. Find the entry to use
  let selected;

  if (options.version && options.version !== "latest") {
    // Find specific version
    selected = allEntries.find((e) => e.version === options.version);
    if (!selected) {
      throw new Error(`Version ${options.version} not found for rule: ${ruleId}`);
    }
  } else {
    // Find latest: prefer explicit isLatest flag, else highest versionNumber
    selected = allEntries.find((e) => e.isLatest === true);
    if (!selected) {
      selected = allEntries.reduce((max, e) =>
        (e.versionNumber > max.versionNumber) ? e : max
      );
    }
  }

  return selected.ruleUri;
}

/**
 * Resolve a rule reference to full RuleDef
 * Handles both direct ruleUri and ruleId (via registry lookup)
 *
 * @param {string} ruleRef - Either ruleUri (hcs://...) or ruleId (sphere://...)
 * @param {Object} sphereConfig - Sphere configuration with topic IDs
 * @param {Object} [options] - Resolution options
 * @returns {Promise<{ruleDef: Object, ruleUri: string, ruleUriHash: string}>}
 */
export async function resolveRule(ruleRef, sphereConfig, options = {}) {
  let ruleUri;

  if (ruleRef.startsWith("hcs://")) {
    // Direct ruleUri
    ruleUri = ruleRef;
  } else {
    // ruleId - resolve via registry
    ruleUri = await resolveLatestRule(ruleRef, sphereConfig.ruleRegistryTopicId, options);
  }

  // Resolve full RuleDef
  const ruleDef = await resolveRuleDef(ruleUri, options);
  const ruleUriHash = computeRuleUriHash(ruleUri);

  return {
    ruleDef,
    ruleUri,
    ruleUriHash
  };
}

/**
 * Verify that a RuleDef matches expected values
 * @param {Object} ruleDef - RuleDef to verify
 * @param {Object} expected - Expected values to check
 * @returns {{valid: boolean, errors: string[]}}
 */
export function verifyRuleDef(ruleDef, expected = {}) {
  const errors = [];

  if (expected.ruleId && ruleDef.ruleId !== expected.ruleId) {
    errors.push(`ruleId mismatch: ${ruleDef.ruleId} !== ${expected.ruleId}`);
  }

  if (expected.domain && ruleDef.domain !== expected.domain) {
    errors.push(`domain mismatch: ${ruleDef.domain} !== ${expected.domain}`);
  }

  if (expected.operator && ruleDef.operator !== expected.operator) {
    errors.push(`operator mismatch: ${ruleDef.operator} !== ${expected.operator}`);
  }

  if (expected.version && ruleDef.version !== expected.version) {
    errors.push(`version mismatch: ${ruleDef.version} !== ${expected.version}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Auto-resolve entity bundle evidence from PROOF_TOPIC
 *
 * For each evidence entry with bindingHash === null, queries the PROOF_TOPIC
 * to find the latest MorphemeProof matching that ruleId and populates
 * bindingHash and hcsSeq from the on-chain record.
 *
 * @param {Object} bundle - Reasoning bundle with inputs[0].proofs array
 * @param {string} proofTopicId - HCS topic ID for proof messages
 * @param {Object} [options] - Resolution options
 * @param {string} [options.mirrorNodeUrl] - Override mirror node URL
 * @returns {Promise<Object>} The bundle with evidence fields populated
 * @throws {Error} If required evidence is not found on PROOF_TOPIC
 */
export async function resolveEvidence(bundle, proofTopicId, options = {}) {
  const proofs = bundle.inputs?.[0]?.proofs;
  if (!proofs || !proofs.some(p => p.bindingHash === null)) {
    return bundle; // nothing to resolve
  }

  const networkConfig = getNetworkConfig();
  const mirrorNodeUrl = options.mirrorNodeUrl || networkConfig.mirrorNodeUrl;

  // Collect which ruleIds we need to resolve
  const needed = new Set(proofs.filter(p => p.bindingHash === null).map(p => p.ruleId));

  // Paginated query of PROOF_TOPIC (same pattern as resolveLatestRule)
  const proofsByRuleId = new Map();
  let nextLink = `${mirrorNodeUrl}/topics/${proofTopicId}/messages?limit=100`;

  while (nextLink) {
    const response = await fetch(nextLink);
    if (!response.ok) {
      throw new Error(`Mirror node query failed: ${response.status}`);
    }
    const data = await response.json();

    for (const msg of data.messages || []) {
      try {
        const payload = Buffer.from(msg.message, "base64").toString("utf8");
        const entry = JSON.parse(payload);

        if (entry.schema === "hcs.ontologic.morphemeProof" && needed.has(entry.ruleId)) {
          const seq = parseInt(msg.sequence_number, 10);
          const existing = proofsByRuleId.get(entry.ruleId);
          if (!existing || seq > existing.hcsSeq) {
            proofsByRuleId.set(entry.ruleId, {
              bindingHash: entry.bindingHash,
              hcsSeq: seq,
            });
          }
        }
      } catch {
        continue; // skip malformed messages
      }
    }

    nextLink = data.links?.next ? `${mirrorNodeUrl}${data.links.next}` : null;
  }

  // Populate null evidence fields
  for (const proof of proofs) {
    if (proof.bindingHash === null) {
      const resolved = proofsByRuleId.get(proof.ruleId);
      if (!resolved) {
        throw new Error(`Evidence not found on PROOF_TOPIC for ruleId: ${proof.ruleId}`);
      }
      proof.bindingHash = resolved.bindingHash;
      proof.hcsSeq = resolved.hcsSeq;
    }
  }

  return bundle;
}

export default {
  parseHcsUri,
  buildHcsUri,
  computeRuleUriHash,
  resolveRuleDef,
  resolveLatestRule,
  resolveRule,
  verifyRuleDef,
  resolveEvidence
};
