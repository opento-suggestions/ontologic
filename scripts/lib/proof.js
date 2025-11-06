/**
 * @fileoverview Canonical proof generation and validation utilities
 * @module scripts/lib/proof
 */

import { ethers } from "ethers";

/**
 * Canonical proof structure for reasoning operations
 * @typedef {Object} CanonicalProof
 * @property {string} v - Protocol version
 * @property {string} domain - Reasoning domain (e.g., "color")
 * @property {string} subdomain - Reasoning subdomain (e.g., "paint")
 * @property {string} operator - Operation identifier (e.g., "mix_paint")
 * @property {Array<{token: string, alias: string, hex: string}>} inputs - Input tokens
 * @property {{token: string, alias: string, hex: string}} output - Output token
 * @property {string} ts - ISO 8601 timestamp
 */

/**
 * Create a canonical proof JSON for a reasoning operation
 * @param {Object} params - Proof parameters
 * @param {string} params.domain - Reasoning domain
 * @param {string} params.subdomain - Reasoning subdomain
 * @param {string} params.operator - Operation identifier
 * @param {Array<{token: string, alias: string, hex: string}>} params.inputs - Input tokens
 * @param {{token: string, alias: string, hex: string}} params.output - Output token
 * @returns {{proof: CanonicalProof, canonical: string, hash: string}} Proof object, canonical JSON, and hash
 */
export function createCanonicalProof({
  domain,
  subdomain,
  operator,
  inputs,
  output,
}) {
  const proof = {
    v: "0",
    domain,
    subdomain,
    operator,
    inputs,
    output,
    ts: new Date().toISOString(),
  };

  const canonical = JSON.stringify(proof);
  const hash = ethers.keccak256(ethers.toUtf8Bytes(canonical));

  return { proof, canonical, hash };
}

/**
 * Validate a proof structure
 * @param {CanonicalProof} proof - Proof to validate
 * @throws {Error} If proof is invalid
 */
export function validateProof(proof) {
  const required = ["v", "domain", "subdomain", "operator", "inputs", "output", "ts"];
  const missing = required.filter(field => !(field in proof));

  if (missing.length > 0) {
    throw new Error(`Invalid proof: missing fields ${missing.join(", ")}`);
  }

  if (!Array.isArray(proof.inputs) || proof.inputs.length === 0) {
    throw new Error("Invalid proof: inputs must be a non-empty array");
  }

  if (typeof proof.output !== "object" || !proof.output.token) {
    throw new Error("Invalid proof: output must be an object with token field");
  }
}

/**
 * Verify a proof hash matches the canonical JSON
 * @param {string} canonical - Canonical JSON string
 * @param {string} expectedHash - Expected keccak256 hash
 * @returns {boolean} True if hash matches
 */
export function verifyProofHash(canonical, expectedHash) {
  const computedHash = ethers.keccak256(ethers.toUtf8Bytes(canonical));
  return computedHash === expectedHash;
}
