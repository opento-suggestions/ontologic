/**
 * @fileoverview Upgrade ReasoningContract to v0.5.0 using ContractUpdateTransaction
 * @module scripts/upgrade-contract-v05
 *
 * Performs Hedera-native contract upgrade by hot-swapping bytecode on existing contract ID.
 * Uses admin key to authorize the update.
 *
 * v0.5.0 Changes:
 * - Disabled ERC-20 balanceOf() guards (commented out, not deleted)
 * - TODO v0.6: Replace with HTS precompile balance queries at 0x167
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import { ethers } from "ethers";
import {
  Client,
  ContractUpdateTransaction,
  FileCreateTransaction,
  FileAppendTransaction,
  PrivateKey,
  ContractId,
} from "@hashgraph/sdk";
import * as logger from "./lib/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env (canonical configuration)
config({ path: path.join(__dirname, "..", ".env") });

/**
 * Upgrade ReasoningContract to v0.5.0 using Hedera SDK
 */
async function main() {
  logger.section("Upgrade ReasoningContract to v0.5.0 (Hedera-Native)");

  // Load operator credentials and contract ID
  const operatorId = process.env.OPERATOR_ID;
  const operatorKey = process.env.OPERATOR_DER_KEY;
  const contractIdStr = process.env.CONTRACT_ID;

  if (!operatorId || !operatorKey || !contractIdStr) {
    logger.error("Missing OPERATOR_ID, OPERATOR_DER_KEY, or CONTRACT_ID in .env");
    process.exit(1);
  }

  // Create Hedera client
  const client = Client.forTestnet();
  const operatorPrivateKey = PrivateKey.fromStringDer(operatorKey);
  client.setOperator(operatorId, operatorPrivateKey);

  logger.info("Client configured", {
    operator: operatorId,
    network: "Hedera Testnet",
    contractId: contractIdStr,
  });

  // Parse contract ID
  const contractId = ContractId.fromString(contractIdStr);

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

  logger.info("Loaded v0.5.0 bytecode", {
    bytecodeLength: bytecode.length,
    artifactPath: artifactPath,
  });

  // Calculate new code hash
  const codeHash = ethers.keccak256(bytecode);

  logger.info("Computed new code hash", {
    codeHash,
  });

  // Step 1: Upload bytecode to Hedera File Service
  logger.info("Uploading v0.5.0 bytecode to Hedera File Service...");

  try {
    // Create file with first 4KB chunk
    const fileCreateTx = new FileCreateTransaction()
      .setKeys([operatorPrivateKey.publicKey])
      .setContents(bytecode.slice(0, 4096))
      .freezeWith(client);

    const fileCreateResponse = await fileCreateTx.execute(client);
    const fileCreateReceipt = await fileCreateResponse.getReceipt(client);
    const bytecodeFileId = fileCreateReceipt.fileId;

    logger.info("Bytecode file created", {
      fileId: bytecodeFileId.toString(),
    });

    // Append remaining chunks if bytecode is larger than 4KB
    if (bytecode.length > 4096) {
      logger.info("Appending remaining bytecode chunks...");
      for (let i = 4096; i < bytecode.length; i += 4096) {
        const chunk = bytecode.slice(i, Math.min(i + 4096, bytecode.length));
        const fileAppendTx = new FileAppendTransaction()
          .setFileId(bytecodeFileId)
          .setContents(chunk)
          .freezeWith(client);

        await fileAppendTx.execute(client);
      }
      logger.info("All bytecode chunks appended");
    }

    // Step 2: Execute ContractUpdateTransaction
    logger.info("Executing ContractUpdateTransaction...");

    const updateTx = new ContractUpdateTransaction()
      .setContractId(contractId)
      .setBytecodeFileId(bytecodeFileId)
      .freezeWith(client);

    // Sign with admin key (operator key)
    const signedTx = await updateTx.sign(operatorPrivateKey);
    const txResponse = await signedTx.execute(client);
    const receipt = await txResponse.getReceipt(client);

    if (receipt.status.toString() !== "SUCCESS") {
      logger.error("Contract update failed", {
        status: receipt.status.toString(),
      });
      process.exit(1);
    }

    logger.success("Contract upgraded to v0.5.0!", {
      contractId: contractId.toString(),
      bytecodeFileId: bytecodeFileId.toString(),
      codeHash,
      txHash: txResponse.transactionId.toString(),
      status: receipt.status.toString(),
    });

    logger.subsection("Upgrade Complete");
    logger.table({
      "Contract ID": contractId.toString(),
      "Version": "v0.5.0",
      "Code Hash": codeHash,
      "Transaction": txResponse.transactionId.toString(),
    });

    logger.subsection("Next Steps");
    logger.info("1. Update .env with:");
    console.log(`     RULE_VERSION="v0.5.0"`);
    console.log(`     CODE_HASH="${codeHash}"`);
    logger.info("\n2. Run validation proof suite:");
    console.log("     node scripts/reason-add-sdk.js --A RED --B GREEN --out YELLOW");
    console.log("     (Additional proofs as specified in validation plan)");

  } catch (err) {
    logger.error("Contract upgrade failed", err);
    process.exit(1);
  } finally {
    client.close();
  }
}

main();
