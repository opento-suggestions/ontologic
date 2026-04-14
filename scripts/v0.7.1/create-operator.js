#!/usr/bin/env node

/**
 * @fileoverview Create a new operator account for v0.7.1 reformation
 * @module scripts/v0.7.1/create-operator
 *
 * Uses the OLD operator (from .env) to:
 * 1. Generate a new ED25519 keypair
 * 2. Create a new Hedera account
 * 3. Fund it with HBAR from the old operator
 *
 * Usage:
 *   node scripts/v0.7.1/create-operator.js [--fund <hbar>] [--dry-run]
 *
 * Options:
 *   --fund <hbar>  Amount of HBAR to transfer (default: 100)
 *   --dry-run      Generate keypair and print plan without executing
 */

import {
  Client,
  PrivateKey,
  AccountCreateTransaction,
  Hbar,
  AccountId
} from "@hashgraph/sdk";
import { getOperatorConfig } from "../v0.6.3/lib/config.js";
import * as logger from "../v0.6.3/lib/logger.js";

async function main() {
  const args = process.argv.slice(2);

  const getArg = (flag) => {
    const idx = args.indexOf(flag);
    return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
  };

  const fundAmount = parseInt(getArg("--fund") || "100", 10);
  const dryRun = args.includes("--dry-run");

  logger.section("v0.7.1 Reformation — Phase 1: New Operator Account");

  // Load old operator config
  const oldOperator = getOperatorConfig();
  logger.info("Old operator loaded", { id: oldOperator.id });

  // Generate new keypair
  logger.info("Generating new ED25519 keypair...");
  const newKey = PrivateKey.generateED25519();
  const newPublicKey = newKey.publicKey;

  // Derive key formats
  const derKey = newKey.toStringDer();
  const hexKey = newKey.toStringRaw();

  logger.info("New keypair generated", {
    publicKey: newPublicKey.toStringDer(),
  });

  if (dryRun) {
    logger.subsection("DRY RUN — Would create account with:");
    logger.table({
      "Public Key": newPublicKey.toStringDer(),
      "Fund Amount": `${fundAmount} HBAR`,
      "Funded By": oldOperator.id,
    });

    logger.subsection("New Credentials (save these!)");
    console.log(`OPERATOR_DER_KEY=${derKey}`);
    console.log(`OPERATOR_HEX_KEY=${hexKey}`);
    console.log("\nAccount ID and EVM address will be available after live execution.");
    return;
  }

  // Initialize client with OLD operator
  const oldKey = PrivateKey.fromString(oldOperator.derKey);
  const client = Client.forTestnet().setOperator(oldOperator.id, oldKey);

  try {
    // Create new account
    logger.info("Creating new account on Hedera testnet...");
    const createTx = await new AccountCreateTransaction()
      .setKey(newPublicKey)
      .setInitialBalance(new Hbar(fundAmount))
      .setMaxAutomaticTokenAssociations(20)
      .execute(client);

    const createReceipt = await createTx.getReceipt(client);
    const newAccountId = createReceipt.accountId;

    if (!newAccountId) {
      throw new Error("Account creation failed: no account ID returned");
    }

    // Derive EVM address from account ID
    const evmAddress = "0x" + AccountId.fromString(newAccountId.toString()).toSolidityAddress();

    logger.success("New operator account created", {
      accountId: newAccountId.toString(),
      evmAddress,
      initialBalance: `${fundAmount} HBAR`,
    });

    // Print credentials for .env update
    logger.subsection("Update .env with these values");
    console.log(`OPERATOR_ID=${newAccountId.toString()}`);
    console.log(`OPERATOR_DER_KEY=${derKey}`);
    console.log(`OPERATOR_HEX_KEY=${hexKey}`);
    console.log(`OPERATOR_EVM_ADDR=${evmAddress}`);

    logger.subsection("Next Steps");
    logger.info("1. Back up current .env to .env.legacy");
    logger.info("2. Update .env with the credentials above");
    logger.info("3. Run: node scripts/v0.7.1/create-tokens.js --dry-run");

  } finally {
    client.close();
  }
}

main().catch((err) => {
  logger.error("Failed to create operator account", err);
  process.exit(1);
});
