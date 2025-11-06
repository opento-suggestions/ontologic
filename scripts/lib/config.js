/**
 * @fileoverview Centralized configuration management for Ontologic scripts
 * @module scripts/lib/config
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from project root
// Use override: true to override system environment variables with .env values
dotenv.config({ path: path.join(__dirname, "..", "..", ".env"), override: true });

/**
 * Validates that required environment variables are present
 * @param {string[]} requiredVars - Array of required environment variable names
 * @throws {Error} If any required variables are missing
 */
export function validateEnvVars(requiredVars) {
  const missing = requiredVars.filter(varName => !process.env[varName]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}\n` +
      `Please ensure your .env file contains all required values.`
    );
  }
}

/**
 * Operator account configuration
 * @typedef {Object} OperatorConfig
 * @property {string} id - Hedera account ID (e.g., 0.0.6748221)
 * @property {string} derKey - Private key in DER format
 * @property {string} hexKey - Private key in hex format
 * @property {string} evmAddr - EVM-compatible address
 */

/**
 * Token configuration
 * @typedef {Object} TokenConfig
 * @property {string} id - Hedera token ID (e.g., 0.0.7185272)
 * @property {string} addr - EVM address representation
 */

/**
 * Network endpoints configuration
 * @typedef {Object} NetworkConfig
 * @property {string} rpcUrl - Hedera JSON-RPC endpoint
 * @property {string} mirrorNodeUrl - Mirror node REST API endpoint
 */

/**
 * Get operator account configuration from environment
 * @returns {OperatorConfig}
 */
export function getOperatorConfig() {
  validateEnvVars(["OPERATOR_ID", "OPERATOR_DER_KEY", "OPERATOR_HEX_KEY", "OPERATOR_EVM_ADDR"]);

  return {
    id: process.env.OPERATOR_ID,
    derKey: process.env.OPERATOR_DER_KEY,
    hexKey: process.env.OPERATOR_HEX_KEY,
    evmAddr: process.env.OPERATOR_EVM_ADDR,
  };
}

/**
 * Get network configuration from environment
 * @returns {NetworkConfig}
 */
export function getNetworkConfig() {
  return {
    rpcUrl: process.env.HEDERA_RPC_URL || "https://testnet.hashio.io/api",
    mirrorNodeUrl: process.env.MIRROR_NODE_URL || "https://testnet.mirrornode.hedera.com/api/v1",
  };
}

/**
 * Get token configuration from environment
 * @param {('RED'|'BLUE'|'PURPLE')} tokenName - Token name
 * @returns {TokenConfig}
 */
export function getTokenConfig(tokenName) {
  const idVar = `${tokenName}_TOKEN_ID`;
  const addrVar = `${tokenName}_ADDR`;

  validateEnvVars([idVar, addrVar]);

  return {
    id: process.env[idVar],
    addr: process.env[addrVar],
  };
}

/**
 * Get HCS topic ID from environment
 * @returns {string|null} Topic ID or null if not configured
 */
export function getHcsTopicId() {
  return process.env.HCS_TOPIC_ID || null;
}

/**
 * Deployed contract address (from CLAUDE.md)
 * @constant {string}
 */
export const DEPLOYED_CONTRACT_ADDRESS = "0xC739f496E8dbc146a54fDBF47080AE557FF8Ea27";

/**
 * Active rule ID (from CLAUDE.md)
 * @constant {string}
 */
export const ACTIVE_RULE_ID = "0xf2f46b98fc2fc538ecffaca7cdc83e722b23beeba55aa086b5c916a49ef943bd";

/**
 * Schema hash for reasoning protocol v0
 * @constant {string}
 */
export const SCHEMA_HASH = "0xf1944d69e7680639ebde87ed129a18522cdf8415d254b9a12d638df5e1ddd934";
