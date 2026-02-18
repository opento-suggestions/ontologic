/**
 * @fileoverview Sphere configuration management for v0.7
 * @module scripts/v07/lib/sphere-config
 *
 * Manages sphere configuration files that track:
 * - Sphere name and metadata
 * - HCS topic IDs for rule defs, registry, and proofs
 * - Deployed contract information
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * @typedef {Object} SphereConfig
 * @property {string} sphereName - Name of the sphere (e.g., "demo")
 * @property {string} ruleDefsTopicId - HCS topic for RuleDef messages
 * @property {string} ruleRegistryTopicId - HCS topic for RuleRegistryEntry messages
 * @property {string} proofTopicId - HCS topic for MorphemeProof messages
 * @property {string} contractId - Hedera contract ID (e.g., "0.0.12345")
 * @property {string} contractAddr - EVM address of contract
 * @property {string} createdAt - ISO timestamp of creation
 * @property {string} [network] - Network identifier (default: "hedera-testnet")
 * @property {Object} [tokens] - Token configuration for this sphere
 */

/**
 * Get the path to a sphere config file
 * @param {string} sphereName - Name of the sphere
 * @param {string} [baseDir] - Base directory for config files
 * @returns {string} Full path to config file
 */
export function getSphereConfigPath(sphereName, baseDir = null) {
  const dir = baseDir || path.join(__dirname, "..", "..", "..");
  return path.join(dir, `config.sphere-${sphereName}.json`);
}

/**
 * Load sphere configuration from file
 * @param {string} sphereName - Name of the sphere
 * @param {string} [baseDir] - Base directory for config files
 * @returns {SphereConfig} Sphere configuration
 * @throws {Error} If config file not found or invalid
 */
export function loadSphereConfig(sphereName, baseDir = null) {
  const configPath = getSphereConfigPath(sphereName, baseDir);

  if (!fs.existsSync(configPath)) {
    throw new Error(`Sphere config not found: ${configPath}. Run create_sphere.js first.`);
  }

  const content = fs.readFileSync(configPath, "utf8");
  const config = JSON.parse(content);

  // Validate required fields
  const required = ["sphereName", "ruleDefsTopicId", "ruleRegistryTopicId", "proofTopicId"];
  const missing = required.filter((field) => !config[field]);
  if (missing.length > 0) {
    throw new Error(`Sphere config missing required fields: ${missing.join(", ")}`);
  }

  return config;
}

/**
 * Save sphere configuration to file
 * @param {SphereConfig} config - Sphere configuration to save
 * @param {string} [baseDir] - Base directory for config files
 */
export function saveSphereConfig(config, baseDir = null) {
  const configPath = getSphereConfigPath(config.sphereName, baseDir);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

/**
 * List all available sphere configurations
 * @param {string} [baseDir] - Base directory to search
 * @returns {string[]} Array of sphere names
 */
export function listSpheres(baseDir = null) {
  const dir = baseDir || path.join(__dirname, "..", "..", "..");
  const files = fs.readdirSync(dir);
  const sphereFiles = files.filter((f) => f.startsWith("config.sphere-") && f.endsWith(".json"));
  return sphereFiles.map((f) => f.replace("config.sphere-", "").replace(".json", ""));
}

/**
 * Update sphere configuration with new values
 * @param {string} sphereName - Name of the sphere
 * @param {Partial<SphereConfig>} updates - Fields to update
 * @param {string} [baseDir] - Base directory for config files
 * @returns {SphereConfig} Updated configuration
 */
export function updateSphereConfig(sphereName, updates, baseDir = null) {
  const config = loadSphereConfig(sphereName, baseDir);
  const updated = { ...config, ...updates };
  saveSphereConfig(updated, baseDir);
  return updated;
}

/**
 * Create initial sphere configuration
 * @param {Object} params - Sphere parameters
 * @param {string} params.sphereName - Name of the sphere
 * @param {string} params.ruleDefsTopicId - HCS topic for rule defs
 * @param {string} params.ruleRegistryTopicId - HCS topic for registry
 * @param {string} params.proofTopicId - HCS topic for proofs
 * @param {string} [params.contractId] - Contract ID (if deployed)
 * @param {string} [params.contractAddr] - Contract address (if deployed)
 * @param {string} [params.network] - Network identifier
 * @param {Object} [params.tokens] - Token configuration
 * @param {string} [baseDir] - Base directory for config files
 * @returns {SphereConfig} Created configuration
 */
export function createSphereConfig(params, baseDir = null) {
  const config = {
    sphereName: params.sphereName,
    ruleDefsTopicId: params.ruleDefsTopicId,
    ruleRegistryTopicId: params.ruleRegistryTopicId,
    proofTopicId: params.proofTopicId,
    contractId: params.contractId || null,
    contractAddr: params.contractAddr || null,
    network: params.network || "hedera-testnet",
    tokens: params.tokens || {},
    createdAt: new Date().toISOString()
  };

  saveSphereConfig(config, baseDir);
  return config;
}

/**
 * Validate that a sphere config has contract deployment info
 * @param {SphereConfig} config - Config to validate
 * @throws {Error} If contract not deployed
 */
export function requireContract(config) {
  if (!config.contractId || !config.contractAddr) {
    throw new Error(`Sphere "${config.sphereName}" does not have a deployed contract. Run deploy step first.`);
  }
}

/**
 * Get mirror node URL for a sphere's network
 * @param {SphereConfig} config - Sphere configuration
 * @returns {string} Mirror node URL
 */
export function getMirrorNodeUrl(config) {
  const network = config.network || "hedera-testnet";
  switch (network) {
    case "hedera-mainnet":
      return "https://mainnet-public.mirrornode.hedera.com/api/v1";
    case "hedera-testnet":
      return "https://testnet.mirrornode.hedera.com/api/v1";
    case "hedera-previewnet":
      return "https://previewnet.mirrornode.hedera.com/api/v1";
    default:
      return "https://testnet.mirrornode.hedera.com/api/v1";
  }
}

export default {
  getSphereConfigPath,
  loadSphereConfig,
  saveSphereConfig,
  listSpheres,
  updateSphereConfig,
  createSphereConfig,
  requireContract,
  getMirrorNodeUrl
};
