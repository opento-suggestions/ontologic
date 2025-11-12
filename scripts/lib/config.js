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
// Use .env.example for example wallet operations
dotenv.config({ path: path.join(__dirname, "..", "..", ".env.example"), override: true });

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
 * @param {('RED'|'GREEN'|'BLUE'|'PURPLE'|'WHITE'|'GREY')} tokenName - Token name
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
 * Deployed contract address (Alpha v0.4.2 - Idempotent Proofs)
 * @constant {string}
 */
export const DEPLOYED_CONTRACT_ADDRESS = process.env.CONTRACT_ADDR || "0x97e00a2597C20b490fE869204B0728EF6c9F23eA";

/**
 * Active rule IDs (Alpha v0.3 - Dual-Domain)
 * @constant {Object}
 */
export const ACTIVE_RULE_IDS = {
  LIGHT: "0xdd1480153360259fb34ae591a5e4be71d81827a82318549ca838be2b91346e65",  // RED + GREEN + BLUE → WHITE
  PAINT: "0x4e8881312f98809e731a219db65a5bdf0df53d4e966f948cd11c091e8ae047ea",  // RED + GREEN + BLUE → GREY
};

/**
 * Schema hash for reasoning protocol v0
 * @constant {string}
 */
export const SCHEMA_HASH = "0xf1944d69e7680639ebde87ed129a18522cdf8415d254b9a12d638df5e1ddd934";

/**
 * Get complete configuration for v0.4.2 scripts
 * @returns {Object} Config object with rpc, pkey, contract, rule, signer, hcsTopicId, hcsPost
 */
export async function getConfig() {
  const { Client, TopicMessageSubmitTransaction } = await import("@hashgraph/sdk");
  const operatorConfig = getOperatorConfig();
  const networkConfig = getNetworkConfig();
  const topicId = getHcsTopicId();

  return {
    rpc: networkConfig.rpcUrl,
    pkey: operatorConfig.hexKey,
    contract: DEPLOYED_CONTRACT_ADDRESS,
    rule: {
      codeHash: process.env.CODE_HASH,
      version: process.env.RULE_VERSION || "v0.4.2",
      fnAdd: process.env.FN_SELECTOR_ADD,
      fnAddSel: process.env.FN_SELECTOR_ADD,
      fnSub: process.env.FN_SELECTOR_SUB,
    },
    signer: operatorConfig.evmAddr,
    hcsTopicId: topicId,
    async hcsPost(topicId, bytes) {
      const client = Client.forTestnet().setOperator(
        operatorConfig.id,
        operatorConfig.derKey
      );
      const submitTx = await new TopicMessageSubmitTransaction()
        .setTopicId(topicId)
        .setMessage(bytes)
        .execute(client);
      const submitRecord = await submitTx.getRecord(client);
      const consensusTimestamp = submitRecord.consensusTimestamp;
      client.close();
      return {
        sequence: submitRecord.receipt.topicSequenceNumber?.toString() || "0",
        consensusTimestamp: `${consensusTimestamp.seconds}.${consensusTimestamp.nanos}`,
      };
    },
  };
}
