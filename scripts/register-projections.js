/**
 * @fileoverview Register PURPLE projections for color.light and color.paint
 * @module scripts/register-projections
 *
 * Usage: node scripts/register-projections.js [--token <SYM|0x...>] [--contract <0x...>]
 */

import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  Client,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  PrivateKey,
  ContractId,
} from "@hashgraph/sdk";
import {
  getOperatorConfig,
  getNetworkConfig,
  getTokenConfig,
  DEPLOYED_CONTRACT_ADDRESS,
} from "./lib/config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Token symbol map (v0.4.2)
// Primary colors: RED, GREEN, BLUE (light domain inputs)
// Secondary colors: YELLOW, CYAN, MAGENTA (valid for proofs)
// Entity-only: PURPLE, ORANGE (projections registered, no proof operations)
const TOKEN_MAP = {
  RED: "0x00000000000000000000000000000000006e9742",
  GREEN: "0x00000000000000000000000000000000006e9743",
  BLUE: "0x00000000000000000000000000000000006e9744",
  PURPLE: "0x00000000000000000000000000000000006e7428",
  WHITE: "0x00000000000000000000000000000000006e7406",
  BLACK: "0x00000000000000000000000000000000006e9414",
  YELLOW: "0x00000000000000000000000000000000006e9799",
  CYAN: "0x00000000000000000000000000000000006e97a2",
  MAGENTA: "0x00000000000000000000000000000000006e97a6",
  ORANGE: "0x00000000000000000000000000000000006e740a",
};

// Projection definitions for all tokens
const PROJECTION_MAP = {
  RED: [
    { domain: "color.light", hex: "#FF0000" },
    { domain: "color.paint", hex: "#FF0000" },
  ],
  GREEN: [
    { domain: "color.light", hex: "#00FF00" },
    { domain: "color.paint", hex: "#00FF00" },
  ],
  BLUE: [
    { domain: "color.light", hex: "#0000FF" },
    { domain: "color.paint", hex: "#0000FF" },
  ],
  PURPLE: [
    { domain: "color.light", hex: "#800080" },
    { domain: "color.paint", hex: "#800080" },
  ],
  YELLOW: [
    { domain: "color.light", hex: "#FFFF00" },
    { domain: "color.paint", hex: "#FFFF00" },
  ],
  CYAN: [
    { domain: "color.light", hex: "#00FFFF" },
    { domain: "color.paint", hex: "#00FFFF" },
  ],
  MAGENTA: [
    { domain: "color.light", hex: "#FF00FF" },
    { domain: "color.paint", hex: "#FF00FF" },
  ],
  WHITE: [
    { domain: "color.light", hex: "#FFFFFF" },
    { domain: "color.paint", hex: "#FFFFFF" },
  ],
  BLACK: [
    { domain: "color.light", hex: "#000000" },
    { domain: "color.paint", hex: "#000000" },
  ],
  ORANGE: [
    { domain: "color.light", hex: "#FFA500" },
    { domain: "color.paint", hex: "#FFA500" },
  ],
};

/**
 * Parse CLI arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  let token = "PURPLE";
  let contract = DEPLOYED_CONTRACT_ADDRESS;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--token" && i + 1 < args.length) {
      token = args[++i];
    } else if (args[i] === "--contract" && i + 1 < args.length) {
      contract = args[++i];
    }
  }

  return {
    token: resolveToken(token),
    tokenSym: token.toUpperCase(),
    contract,
  };
}

/**
 * Resolve token symbol to EVM address
 */
function resolveToken(input) {
  if (input.startsWith("0x")) {
    return input.toLowerCase();
  }
  const addr = TOKEN_MAP[input.toUpperCase()];
  if (!addr) {
    console.error(JSON.stringify({
      stage: "resolve-token",
      ok: false,
      error: `Unknown token symbol: ${input}`
    }));
    process.exit(1);
  }
  return addr;
}

/**
 * Convert hex color to RGB24
 */
function hexToRgb24(hex) {
  const clean = hex.startsWith("#") ? hex.slice(1) : hex;
  if (!/^[0-9A-Fa-f]{6}$/.test(clean)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  return parseInt(clean, 16);
}

/**
 * Main execution
 */
async function main() {
  try {
    const params = parseArgs();
    const operatorConfig = getOperatorConfig();

    console.log(JSON.stringify({
      stage: "init",
      ok: true,
      token: params.token,
      symbol: params.tokenSym,
      contract: params.contract
    }));

    // Get projection definitions for this token
    const tokenProjections = PROJECTION_MAP[params.tokenSym];
    if (!tokenProjections) {
      console.error(JSON.stringify({
        stage: "init",
        ok: false,
        error: `No projections defined for token: ${params.tokenSym}. Available: ${Object.keys(PROJECTION_MAP).join(", ")}`
      }));
      process.exit(1);
    }

    // Setup SDK client
    const client = Client.forTestnet().setOperator(
      operatorConfig.id,
      PrivateKey.fromStringDer(operatorConfig.derKey)
    );

    // Convert contract address to ContractId
    const evmAddrClean = params.contract.toLowerCase().replace("0x", "");
    const entityNum = parseInt(evmAddrClean.slice(-8), 16);
    const contractId = new ContractId(0, 0, entityNum);

    // Projection definitions with RGB24 conversion
    const projections = tokenProjections.map(p => ({
      domain: p.domain,
      hex: p.hex,
      rgb24: hexToRgb24(p.hex)
    }));

    // Register each projection
    for (const proj of projections) {
      const domainHash = ethers.keccak256(ethers.toUtf8Bytes(proj.domain));

      console.log(JSON.stringify({
        stage: "register-projection",
        ok: true,
        action: "submitting",
        domain: proj.domain,
        domainHash,
        rgbHex: proj.hex,
        rgb24: `0x${proj.rgb24.toString(16).padStart(6, '0')}`,
        token: params.token
      }));

      // Build function parameters
      const functionParams = new ContractFunctionParameters()
        .addBytes32(Buffer.from(domainHash.replace("0x", ""), "hex"))
        .addAddress(params.token)
        .addUint24(proj.rgb24);

      // Execute via SDK
      const tx = await new ContractExecuteTransaction()
        .setContractId(contractId)
        .setGas(200000)
        .setFunction("registerProjection", functionParams)
        .execute(client);

      const receipt = await tx.getReceipt(client);

      console.log(JSON.stringify({
        stage: "register-projection",
        ok: true,
        action: "confirmed",
        domain: proj.domain,
        rgbHex: proj.hex,
        token: params.token,
        txHash: tx.transactionId.toString(),
        status: receipt.status.toString()
      }));
    }

    client.close();

    // Final summary
    console.log(JSON.stringify({
      stage: "register-projections",
      ok: true,
      token: params.token,
      symbol: params.tokenSym,
      projections: projections.map(p => ({ domain: p.domain, hex: p.hex })),
      contract: params.contract
    }));

    process.exit(0);

  } catch (error) {
    console.error(JSON.stringify({
      stage: "error",
      ok: false,
      error: error.message,
      stack: error.stack
    }));
    process.exit(3);
  }
}

main();
