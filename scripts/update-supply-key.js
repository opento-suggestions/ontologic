/**
 * @fileoverview Update token supply key to grant contract minting permissions
 * @module scripts/update-supply-key
 *
 * Usage: node scripts/update-supply-key.js --token YELLOW
 */

import {
  Client,
  TokenUpdateTransaction,
  PrivateKey,
  AccountId,
  TokenId,
} from "@hashgraph/sdk";
import { getOperatorConfig, DEPLOYED_CONTRACT_ADDRESS } from "./lib/config.js";

// Parse args
function arg(name, d=null){ const i=process.argv.indexOf(name); return i<0?d:process.argv[i+1]; }

const TOKEN_SYM = arg("--token");

if (!TOKEN_SYM) {
  console.error("usage: node scripts/update-supply-key.js --token <YELLOW|CYAN|MAGENTA>");
  process.exit(1);
}

const TOKEN_ID_MAP = {
  YELLOW: process.env.YELLOW_TOKEN_ID,
  CYAN: process.env.CYAN_TOKEN_ID,
  MAGENTA: process.env.MAGENTA_TOKEN_ID,
  ORANGE: process.env.ORANGE_TOKEN_ID,
};

const tokenId = TOKEN_ID_MAP[TOKEN_SYM.toUpperCase()];
if (!tokenId) {
  console.error(`Unknown token: ${TOKEN_SYM}. Must be YELLOW, CYAN, or MAGENTA`);
  process.exit(1);
}

async function main() {
  const operatorConfig = getOperatorConfig();

  console.log(JSON.stringify({
    stage: "init",
    ok: true,
    token: TOKEN_SYM,
    tokenId,
    contract: DEPLOYED_CONTRACT_ADDRESS
  }));

  const client = Client.forTestnet().setOperator(
    operatorConfig.id,
    operatorConfig.derKey
  );

  // Convert contract EVM address to AccountId representation
  // Hedera EVM addresses map to account IDs
  // For now, we'll use the operator's private key as the supply key initially,
  // but this should ideally be the contract's key

  // Note: The contract address needs to be converted to a proper Hedera format
  // For HTS, we typically need to use ContractId, not AccountId
  // The proper way is to use the contract's public key or admin key

  console.log(JSON.stringify({
    stage: "warning",
    ok: true,
    message: "HTS tokens require supply key to be a Hedera key (ED25519/ECDSA), not a contract address directly."
  }));

  console.log(JSON.stringify({
    stage: "info",
    ok: true,
    message: "For v0.4.2 testing, tokens should have been created with contract as supply key.",
    suggestion: "Re-mint tokens with contract address as supply key using mint scripts."
  }));

  client.close();
  process.exit(1);
}

main();
