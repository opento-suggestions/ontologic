/**
 * Minimal debug script to test setRule with verbose error output
 */

import { ethers } from "ethers";
import {
  Client,
  ContractExecuteTransaction,
  ContractId,
  ContractFunctionParameters,
  PrivateKey,
  TransactionRecordQuery,
  TransactionId,
} from "@hashgraph/sdk";
import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config({ path: path.join(__dirname, "..", ".env") });

async function main() {
  console.log("\n=== Testing setRule with Rule 1: RED + GREEN → YELLOW ===\n");

  const operatorId = process.env.OPERATOR_ID;
  const operatorKey = process.env.OPERATOR_DER_KEY;
  const contractIdStr = process.env.CONTRACT_ID;

  const client = Client.forTestnet();
  const operatorPrivateKey = PrivateKey.fromStringDer(operatorKey);
  client.setOperator(operatorId, operatorPrivateKey);

  const contractId = ContractId.fromString(contractIdStr);

  // Rule 1 parameters
  const domain = "color.light";
  const operator = "mix_add@v1";
  const inputs = [
    process.env.RED_ADDR,
    process.env.GREEN_ADDR,
  ];
  const output = process.env.YELLOW_ADDR;
  const ratio = 1;

  // Compute hashes
  const domainH = ethers.keccak256(ethers.toUtf8Bytes(domain));
  const operatorH = ethers.keccak256(ethers.toUtf8Bytes(operator));

  // Sort inputs
  const sortedInputs = [...inputs].sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );

  console.log("Parameters:");
  console.log("  Domain:", domain, "→", domainH);
  console.log("  Operator:", operator, "→", operatorH);
  console.log("  Inputs (sorted):", sortedInputs);
  console.log("  Output:", output);
  console.log("  Ratio:", ratio);
  console.log("");

  // Build function parameters
  const functionParams = new ContractFunctionParameters()
    .addBytes32(Buffer.from(domainH.replace("0x", ""), "hex"))
    .addBytes32(Buffer.from(operatorH.replace("0x", ""), "hex"))
    .addAddressArray(sortedInputs)
    .addAddress(output)
    .addUint64(ratio);

  console.log("Calling setRule...");

  try {
    const tx = await new ContractExecuteTransaction()
      .setContractId(contractId)
      .setGas(500000)
      .setFunction("setRule", functionParams)
      .execute(client);

    console.log("  Transaction submitted:", tx.transactionId.toString());

    const receipt = await tx.getReceipt(client);

    console.log("  Status:", receipt.status.toString());

    if (receipt.status.toString() === "SUCCESS") {
      console.log("\n✅ Rule registered successfully!");
    } else {
      console.log("\n❌ Transaction failed with status:", receipt.status.toString());
    }

    // Fetch the full record to get error details
    try {
      const record = await tx.getRecord(client);

      if (record.contractFunctionResult) {
        console.log("\nContract Function Result:");
        console.log("  Error message:", record.contractFunctionResult.errorMessage || "(none)");
        console.log("  Gas used:", record.contractFunctionResult.gasUsed.toString());

        const resultBytes = record.contractFunctionResult.contractCallResult;
        if (resultBytes && resultBytes.length > 0) {
          console.log("  Raw result bytes:", Buffer.from(resultBytes).toString("hex"));
        }
      }
    } catch (recordErr) {
      console.log("\nCould not fetch transaction record:", recordErr.message);
    }

  } catch (err) {
    console.log("\n❌ Transaction failed:");
    console.log("  Error:", err.message);
    console.log("  Status:", err.status || "unknown");

    if (err.transactionId) {
      console.log("\n  HashScan:", `https://hashscan.io/testnet/transaction/${err.transactionId.toString()}`);
    }

    // Try to get the record even on failure using TransactionRecordQuery
    if (err.transactionId) {
      try {
        const txId = err.transactionId;
        const record = await new TransactionRecordQuery()
          .setTransactionId(txId)
          .execute(client);

        if (record.contractFunctionResult) {
          console.log("\nContract Function Result (from error):");
          console.log("  Error message:", record.contractFunctionResult.errorMessage || "(none)");
          console.log("  Gas used:", record.contractFunctionResult.gasUsed.toString());

          const resultBytes = record.contractFunctionResult.contractCallResult;
          if (resultBytes && resultBytes.length > 0) {
            console.log("  Raw result bytes:", Buffer.from(resultBytes).toString("hex"));
          }
        }
      } catch (recordErr) {
        console.log("\nCould not fetch transaction record from error:", recordErr.message);
      }
    }
  } finally {
    client.close();
  }
}

main();
