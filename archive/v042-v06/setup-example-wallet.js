/**
 * @fileoverview Setup example wallet for Ontologic v0.4.2
 * @module scripts/setup-example-wallet
 *
 * Usage: node scripts/setup-example-wallet.js
 *
 * Performs all required setup operations:
 * 1. Associates all tokens to operator account
 * 2. Sets PURPLE token supply key to contract
 * 3. Approves allowances (1 RED + 1 BLUE) to contract
 */

import { execSync } from "child_process";

function run(cmd, description) {
  console.log(`\n=== ${description} ===`);
  try {
    const output = execSync(cmd, {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: "inherit"
    });
    return true;
  } catch (error) {
    console.error(`Failed: ${description}`);
    console.error(error.message);
    return false;
  }
}

async function main() {
  console.log("🚀 Ontologic v0.4.2 - Example Wallet Setup");
  console.log("==========================================\n");

  // Step 1: Associate tokens to operator account
  if (!run("node scripts/associate-tokens.js --account operator", "Step 1: Associate tokens to operator")) {
    process.exit(1);
  }

  // Step 2: Set PURPLE token supply key to contract
  if (!run("node scripts/grant-supply-key.js --token PURPLE", "Step 2: Set PURPLE supply key to contract")) {
    process.exit(1);
  }

  // Step 3: Approve allowances for RED and BLUE
  if (!run("node scripts/approve-allowances.js", "Step 3: Approve allowances (1 RED + 1 BLUE)")) {
    process.exit(1);
  }

  console.log("\n✅ Setup complete!");
  console.log("\nNext steps:");
  console.log("  - Register projections: node scripts/register-projections.js --token PURPLE");
  console.log("  - Execute proofs: node scripts/reason-add-sdk.js --A RED --B BLUE --out PURPLE");
}

main();
