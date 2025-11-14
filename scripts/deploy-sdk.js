/**
 * @fileoverview Deploy ReasoningContract v0.4.5 using Hedera SDK
 * @module scripts/deploy-sdk
 *
 * Uses Hedera SDK for deployment to avoid JSON-RPC gas estimation issues.
 * Deploys the ReasoningContract with 9-token support (RGB+CMY+WHITE+GREY+PURPLE).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import { ethers } from "ethers";
import {
  Client,
  ContractCreateFlow,
  PrivateKey,
} from "@hashgraph/sdk";
import * as logger from "./lib/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env (canonical configuration)
config({ path: path.join(__dirname, "..", ".env") });

/**
 * Deploy ReasoningContract using Hedera SDK
 */
async function main() {
  logger.section("Deploy ReasoningContract v0.4.5 (SDK)");

  // Load operator credentials
  const operatorId = process.env.OPERATOR_ID;
  const operatorKey = process.env.OPERATOR_DER_KEY;

  if (!operatorId || !operatorKey) {
    logger.error("Missing OPERATOR_ID or OPERATOR_DER_KEY in .env");
    process.exit(1);
  }

  // Create Hedera client
  const client = Client.forTestnet();
  client.setOperator(operatorId, PrivateKey.fromStringDer(operatorKey));

  logger.info("Client configured", {
    operator: operatorId,
    network: "Hedera Testnet",
  });

  // Load compiled bytecode
  const artifactPath = path.join(
    __dirname,
    "..",
    "artifacts",
    "contracts",
    "reasoningContract.sol",
    "ReasoningContract.json"
  );

  if (!fs.existsSync(artifactPath)) {
    logger.error("Contract artifact not found. Run: npx hardhat compile");
    process.exit(1);
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const bytecode = artifact.bytecode;

  // Generate schema hash (same as v0.4.2)
  const schemaIdentifier = "reasoning.v0";
  const schemaHash = ethers.keccak256(ethers.toUtf8Bytes(schemaIdentifier));

  logger.info("Schema hash computed", {
    identifier: schemaIdentifier,
    hash: schemaHash,
  });

  // Encode constructor parameters
  const constructorParams = ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes32"],
    [schemaHash]
  );

  // Deploy via SDK with admin key = operator
  logger.info("Deploying contract via SDK with admin key...");

  try {
    const operatorPrivateKey = PrivateKey.fromStringDer(operatorKey);

    const contractCreateTx = new ContractCreateFlow()
      .setBytecode(bytecode)
      .setConstructorParameters(constructorParams)
      .setGas(5000000) // 5M gas for deployment
      .setMaxChunks(30) // Handle large bytecode
      .setAdminKey(operatorPrivateKey.publicKey); // Enable Hedera-native upgrades

    const txResponse = await contractCreateTx.execute(client);
    const receipt = await txResponse.getReceipt(client);
    const contractId = receipt.contractId;

    logger.success("Contract deployed!", {
      contractId: contractId.toString(),
      schemaHash,
      txHash: txResponse.transactionId.toString(),
    });

    // Compute EVM address from contract ID
    const evmAddress = `0x${contractId.toSolidityAddress()}`;

    logger.subsection("Deployment Complete");
    logger.table({
      "Contract ID": contractId.toString(),
      "EVM Address": evmAddress,
      "Schema Hash": schemaHash,
      "Transaction": txResponse.transactionId.toString(),
    });

    logger.subsection("Next Steps");
    logger.info("1. Update .env with:");
    console.log(`     CONTRACT_ID="${contractId.toString()}"`);
    console.log(`     CONTRACT_ADDR="${evmAddress}"`);
    logger.info("\n2. Verify tokens exist (RGB+CMY+WHITE+GREY+PURPLE)");
    logger.info("\n3. Run migration script:");
    console.log("     node scripts/migrate-supply-keys.js");
    logger.info("\n4. Register projections:");
    console.log("     node scripts/register-projections.js --token YELLOW");
    console.log("     node scripts/register-projections.js --token CYAN");
    console.log("     node scripts/register-projections.js --token MAGENTA");

  } catch (err) {
    logger.error("Deployment failed", err);
    process.exit(1);
  } finally {
    client.close();
  }
}

main();
