/**
 * @fileoverview Deploy ReasoningContract to Hedera testnet
 * @module scripts/deploy
 *
 * This script deploys the core ReasoningContract smart contract to Hedera testnet.
 * The contract implements Layer 1 (CONTRACTCALL) and Layer 2 (TOKENMINT) of the
 * three-layer provenance architecture.
 *
 * Deployment process:
 * 1. Compile contract (npx hardhat compile)
 * 2. Generate schema hash for reasoning protocol v0
 * 3. Deploy contract with schema hash as constructor parameter
 * 4. Output contract address for configuration
 */

import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getOperatorConfig, getNetworkConfig } from "./lib/config.js";
import * as logger from "./lib/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Deploy the ReasoningContract to Hedera
 * @param {string} [schemaIdentifier="reasoning.v0"] - Schema identifier for versioning
 * @returns {Promise<{address: string, schemaHash: string, txHash: string}>} Deployment details
 * @throws {Error} If deployment fails
 */
async function deployReasoningContract(schemaIdentifier = "reasoning.v0") {
  const operatorConfig = getOperatorConfig();
  const networkConfig = getNetworkConfig();

  // Connect to network
  const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
  const wallet = new ethers.Wallet(operatorConfig.hexKey, provider);

  logger.info("Deploying ReasoningContract...", {
    deployer: wallet.address,
    network: "Hedera Testnet",
    rpcUrl: networkConfig.rpcUrl,
  });

  // Load compiled contract artifact
  const artifactPath = path.join(
    __dirname,
    "..",
    "artifacts",
    "contracts",
    "reasoningContract.sol",
    "ReasoningContract.json"
  );

  if (!fs.existsSync(artifactPath)) {
    throw new Error(
      "Contract artifact not found. Please compile the contract first:\n" +
      "  npx hardhat compile"
    );
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  // Generate schema hash for reasoning protocol
  const schemaHash = ethers.keccak256(ethers.toUtf8Bytes(schemaIdentifier));
  logger.info("Reasoning schema hash computed", {
    identifier: schemaIdentifier,
    hash: schemaHash,
  });

  // Create contract factory and deploy
  const factory = new ethers.ContractFactory(
    artifact.abi,
    artifact.bytecode,
    wallet
  );

  logger.info("Submitting deployment transaction...");
  const contract = await factory.deploy(schemaHash);

  logger.info("Waiting for deployment confirmation...");
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  const deployTx = contract.deploymentTransaction();

  logger.success("ReasoningContract deployed!", {
    address,
    schemaHash,
    txHash: deployTx?.hash || "N/A",
  });

  return {
    address,
    schemaHash,
    txHash: deployTx?.hash || "",
  };
}

/**
 * Main execution function
 * @returns {Promise<void>}
 */
async function main() {
  try {
    logger.section("Deploy ReasoningContract");

    const result = await deployReasoningContract();

    logger.subsection("Deployment Complete");
    logger.table({
      "Contract Address": result.address,
      "Schema Hash": result.schemaHash,
      "Transaction": result.txHash,
    });

    if (result.txHash) {
      logger.verificationLinks(result.txHash);
    }

    logger.subsection("Next Steps");
    logger.info("1. Grant supply key permissions for $PURPLE token:");
    console.log(`     Use TokenUpdateTransaction to assign ${result.address} as supply key`);
    logger.info("\n2. Create $PURPLE token with contract as supply key:");
    console.log("     node scripts/mint_purple.js");
    logger.info("\n3. Configure reasoning rule:");
    console.log("     node scripts/set_rule.js");
    logger.info("\n4. Update DEPLOYED_CONTRACT_ADDRESS in scripts/lib/config.js");

  } catch (err) {
    logger.error("Deployment failed", err);
    process.exit(1);
  }
}

// Export for programmatic use
export { deployReasoningContract };

// Run if executed directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` ||
    import.meta.url.endsWith('deploy.js')) {
  main();
}
