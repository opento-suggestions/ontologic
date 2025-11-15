/**
 * Query transaction details from Mirror Node API
 * Usage: node scripts/query-transaction-mirror.js <transaction-id>
 * Example: node scripts/query-transaction-mirror.js 0.0.7238571@1763191367.705830627
 */

import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config({ path: path.join(__dirname, "..", ".env") });

async function main() {
  const txId = process.argv[2];

  if (!txId) {
    console.error("Usage: node scripts/query-transaction-mirror.js <transaction-id>");
    console.error("Example: node scripts/query-transaction-mirror.js 0.0.7238571@1763191367.705830627");
    process.exit(1);
  }

  // Format for mirror node API: 0.0.X-SSSSSSSSSS-NNNNNNNNN
  const parts = txId.split("@");
  const account = parts[0];
  const timestamp = parts[1];
  const [seconds, nanos] = timestamp.split(".");
  const mirrorTxId = `${account}-${seconds}-${nanos}`;

  const mirrorUrl = process.env.MIRROR_NODE_URL || "https://testnet.mirrornode.hedera.com/api/v1";
  const url = `${mirrorUrl}/contracts/results/${mirrorTxId}`;

  console.log(`\n=== Querying Mirror Node ===`);
  console.log(`Transaction ID: ${txId}`);
  console.log(`Mirror format: ${mirrorTxId}`);
  console.log(`URL: ${url}\n`);

  try {
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`HTTP ${response.status}: ${response.statusText}`);
      const text = await response.text();
      console.error(text);
      process.exit(1);
    }

    const data = await response.json();

    console.log("Contract Call Result:");
    console.log("  Result:", data.result || "(none)");
    console.log("  Error Message:", data.error_message || "(none)");
    console.log("  Gas Used:", data.gas_used || 0);
    console.log("  Status:", data.status || "unknown");

    if (data.failed_initcode) {
      console.log("  Failed Init Code:", data.failed_initcode);
    }

    if (data.call_result) {
      console.log("\nCall Result (hex):", data.call_result);

      // Try to decode as revert string
      if (data.call_result.startsWith("0x08c379a0")) {
        console.log("\nDetected Error(string) ABI encoding:");
        try {
          // Skip 0x08c379a0 (4 bytes) and decode the rest
          const errorData = data.call_result.slice(10);
          const decoded = Buffer.from(errorData, "hex");

          // ABI encoded string: offset(32) + length(32) + data
          const offset = parseInt(decoded.slice(0, 32).toString("hex"), 16);
          const length = parseInt(decoded.slice(32, 64).toString("hex"), 16);
          const message = decoded.slice(64, 64 + length).toString("utf8");

          console.log("  Revert reason:", message);
        } catch (e) {
          console.log("  (Could not decode revert string)");
        }
      }
    }

    console.log("\n=== Full Response ===");
    console.log(JSON.stringify(data, null, 2));

  } catch (err) {
    console.error("Error querying mirror node:", err.message);
    process.exit(1);
  }
}

main();
