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
  RED: "0x00000000000000000000000000000000006deec8",
  GREEN: "0x00000000000000000000000000000000006defe8",
  BLUE: "0x00000000000000000000000000000000006deed5",
  PURPLE: "0x00000000000000000000000000000000006deefa",  // Entity-only (v0.1)
  WHITE: "0x00000000000000000000000000000000006df004",
  GREY: "0x00000000000000000000000000000000006df015",
  YELLOW: "0x00000000000000000000000000000000006e213b",
  CYAN: "0x00000000000000000000000000000000006e2143",
  MAGENTA: "0x00000000000000000000000000000000006e214e",
  ORANGE: "0x00000000000000000000000000000000006e2169",  // Entity-only (v0.4.2)
};

// Projection definitions for all tokens
const PROJECTION_MAP = {
  PURPLE: [
    { domain: "color.light", hex: "#FF00FF" },
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
    const networkConfig = getNetworkConfig();

    console.log(JSON.stringify({
      stage: "init",
      ok: true,
      token: params.token,
      symbol: params.tokenSym,
      contract: params.contract
    }));

    // Setup provider and contract
    const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
    const wallet = new ethers.Wallet(operatorConfig.hexKey, provider);

    // Load contract ABI
    const artifactPath = path.join(
      __dirname,
      "..",
      "artifacts",
      "contracts",
      "reasoningContract.sol",
      "ReasoningContract.json"
    );
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    const contract = new ethers.Contract(params.contract, artifact.abi, wallet);

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

      const tx = await contract.registerProjection(domainHash, params.token, proj.rgb24);
      const receipt = await tx.wait();

      console.log(JSON.stringify({
        stage: "register-projection",
        ok: true,
        action: "confirmed",
        domain: proj.domain,
        rgbHex: proj.hex,
        token: params.token,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      }));
    }

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
