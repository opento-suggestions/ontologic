/**
 * @fileoverview Register token projections with custom RGB values
 * @module scripts/register-tokens
 *
 * Usage: node scripts/register-tokens.js --token <SYM|0x...> --light <#RRGGBB> --paint <#RRGGBB>
 */

import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  getOperatorConfig,
  getNetworkConfig,
  DEPLOYED_CONTRACT_ADDRESS,
} from "./lib/config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Token symbol map
const TOKEN_MAP = {
  RED: "0x00000000000000000000000000000000006deec8",
  GREEN: "0x00000000000000000000000000000000006defe8",
  BLUE: "0x00000000000000000000000000000000006deed5",
  PURPLE: "0x00000000000000000000000000000000006deefa",
  WHITE: "0x00000000000000000000000000000000006df004",
  GREY: "0x00000000000000000000000000000000006df015",
};

/**
 * Parse CLI arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--token" && i + 1 < args.length) {
      parsed.token = args[++i];
    } else if (args[i] === "--light" && i + 1 < args.length) {
      parsed.light = args[++i];
    } else if (args[i] === "--paint" && i + 1 < args.length) {
      parsed.paint = args[++i];
    } else if (args[i] === "--contract" && i + 1 < args.length) {
      parsed.contract = args[++i];
    }
  }

  if (!parsed.token || !parsed.light || !parsed.paint) {
    console.error(JSON.stringify({
      stage: "parse-args",
      ok: false,
      error: "Missing required args",
      usage: "node scripts/register-tokens.js --token <SYM|0x...> --light <#RRGGBB> --paint <#RRGGBB>"
    }));
    process.exit(1);
  }

  // Validate hex colors
  const hexPattern = /^#[0-9A-Fa-f]{6}$/;
  if (!hexPattern.test(parsed.light) || !hexPattern.test(parsed.paint)) {
    console.error(JSON.stringify({
      stage: "parse-args",
      ok: false,
      error: "Invalid hex color format. Must be #RRGGBB"
    }));
    process.exit(1);
  }

  return {
    token: resolveToken(parsed.token),
    tokenSym: parsed.token.toUpperCase(),
    light: parsed.light,
    paint: parsed.paint,
    contract: parsed.contract || DEPLOYED_CONTRACT_ADDRESS,
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
      light: params.light,
      paint: params.paint,
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

    // Projection definitions
    const projections = [
      { domain: "color.light", hex: params.light, rgb24: hexToRgb24(params.light) },
      { domain: "color.paint", hex: params.paint, rgb24: hexToRgb24(params.paint) },
    ];

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
      stage: "register-tokens",
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
