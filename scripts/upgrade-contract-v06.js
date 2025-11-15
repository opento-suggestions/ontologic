/**
 * @fileoverview Upgrade ReasoningContract to v0.6.0 using ContractUpdateTransaction
 * @module scripts/upgrade-contract-v06
 *
 * Performs Hedera-native contract upgrade by hot-swapping bytecode on existing contract ID.
 * Uses admin key to authorize the update.
 *
 * v0.6.0 Changes:
 * - Added publishEntity function with evidence-based verdict logic
 * - Added ProofEntity event for Floridi layer
 * - Added entity domain constants (D_ENTITY_LIGHT, D_ENTITY_PAINT)
 * - Removed Debug

Pair event (debugging complete)
 * - Domain verdict logic: LIGHT→WHITE, PAINT→BLACK
 *
 * CRITICAL: This is an UPGRADE, not a redeployment
 * - Contract ID stays the same: 0.0.7261322
 * - All v0.5.2 proofs (Seq 33/34/35) remain valid
 * - All token supply key associations preserved
 * - Storage layout preserved (new fields appended only)
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
 * Upgrade ReasoningContract to v0.6.0 using Hedera SDK
 */
async function main() {
  logger.section("Upgrade ReasoningContract: v0.5.2 → v0.6.0 (Hedera-Native)");

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

  logger.info("📋 Upgrade invariants:", {
    "Contract ID": contractIdStr + " (UNCHANGED)",
    "v0.5.2 Proofs": "Seq 33/34/35 remain valid",
    "Token Supply Keys": "Y/C/M/W/B bound to same contract",
    "Storage Layout": "Safe (new fields appended)"
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
    logger.error("Contract artifact not found. Run: npm run build");
    process.exit(1);
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const bytecode = artifact.bytecode;

  logger.info("Loaded v0.6.0 bytecode", {
    bytecodeLength: bytecode.length,
    artifactPath: artifactPath,
  });

  // Calculate new code hash
  const codeHash = ethers.keccak256(bytecode);

  logger.info("Computed new code hash", {
    codeHash,
  });

  // Step 1: Upload bytecode to Hedera File Service
  logger.info("Uploading v0.6.0 bytecode to Hedera File Service...");

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

    logger.success("Contract upgraded to v0.6.0!", {
      contractId: contractId.toString(),
      bytecodeFileId: bytecodeFileId.toString(),
      codeHash,
      txHash: txResponse.transactionId.toString(),
      status: receipt.status.toString(),
    });

    logger.subsection("Upgrade Complete");
    logger.table({
      "Contract ID": contractId.toString() + " (SAME)",
      "Version": "v0.6.0",
      "Code Hash": codeHash,
      "Transaction": txResponse.transactionId.toString(),
    });

    logger.subsection("Next Steps");
    logger.info("1. Update .env with:");
    console.log(`     RULE_VERSION="v0.6.0"`);
    console.log(`     CODE_HASH="${codeHash}"`);

    logger.info("\n2. Verify v0.5.2 proofs still work:");
    console.log("     node scripts/reason.js examples/mvp/red-green-yellow.json");

    logger.info("\n3. Test new v0.6.0 entity attestation:");
    console.log("     node scripts/entity-v06.js examples/mvp/entity-white-light.json");

    logger.info("\n4. Verify on HashScan:");
    console.log(`     https://hashscan.io/testnet/contract/${contractId.toString()}`);

  } catch (err) {
    logger.error("Contract upgrade failed", err);
    process.exit(1);
  } finally {
    client.close();
  }
}

main();
