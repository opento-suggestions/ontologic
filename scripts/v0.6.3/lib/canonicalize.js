/**
 * @fileoverview Deterministic JSON canonicalizer for proof hashing
 * @module scripts/lib/canonicalize
 *
 * Implements RFC 8785 (JSON Canonicalization Scheme) subset:
 * - ASCII lexicographic key ordering
 * - No whitespace or formatting
 * - Deterministic number serialization
 * - UTF-8 encoding for keccak256 hashing
 */

import { ethers } from "ethers";

/**
 * Canonicalize a JSON object for deterministic hashing
 * @param {Object} obj - JSON object to canonicalize
 * @returns {string} Canonical JSON string
 */
export function canonicalizeJSON(obj) {
  if (obj === null) return "null";
  if (obj === undefined) return "null";
  if (typeof obj === "boolean") return obj.toString();
  if (typeof obj === "number") return Number(obj).toString();
  if (typeof obj === "string") return JSON.stringify(obj);

  if (Array.isArray(obj)) {
    const items = obj.map((item) => canonicalizeJSON(item));
    return `[${items.join(",")}]`;
  }

  if (typeof obj === "object") {
    // Sort keys lexicographically (ASCII order)
    const keys = Object.keys(obj).sort();
    const pairs = keys.map((key) => {
      const value = canonicalizeJSON(obj[key]);
      return `${JSON.stringify(key)}:${value}`;
    });
    return `{${pairs.join(",")}}`;
  }

  throw new Error(`Cannot canonicalize type: ${typeof obj}`);
}

/**
 * Compute keccak256 hash of canonical JSON
 * @param {Object} obj - JSON object to hash
 * @returns {string} keccak256 hash (0x prefixed hex string)
 */
export function hashCanonicalJSON(obj) {
  const canonical = canonicalizeJSON(obj);
  // Convert to UTF-8 bytes and hash
  return ethers.keccak256(ethers.toUtf8Bytes(canonical));
}

/**
 * Verify that a canonical JSON matches a given hash
 * @param {Object} obj - JSON object to verify
 * @param {string} expectedHash - Expected keccak256 hash
 * @returns {boolean} True if hash matches
 */
export function verifyCanonicalHash(obj, expectedHash) {
  const computed = hashCanonicalJSON(obj);
  return computed.toLowerCase() === expectedHash.toLowerCase();
}

/**
 * Round-trip test: canonicalize, hash, and return both
 * @param {Object} obj - JSON object
 * @returns {{canonical: string, hash: string}}
 */
export function canonicalizeAndHash(obj) {
  const canonical = canonicalizeJSON(obj);
  const hash = ethers.keccak256(ethers.toUtf8Bytes(canonical));
  return { canonical, hash };
}

/**
 * Alias for canonicalizeJSON for compatibility
 * @param {Object} obj - JSON object to canonicalize
 * @returns {string} Canonical JSON string
 */
export function canonicalize(obj) {
  return canonicalizeJSON(obj);
}
