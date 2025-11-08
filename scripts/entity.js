/**
 * @fileoverview Publish entity manifest (Floridi/ProofEntity)
 * @module scripts/entity
 *
 * Usage: node scripts/entity.js --token <SYM|0x...> --projections.light <#RRGGBB> --projections.paint <#RRGGBB> [--policyUri <uri>] [--license <SPDX>]
 *
 * Flow:
 * 1. Parse args and resolve token address
 * 2. Build manifest JSON (v0.4, layer:floridi)
 * 3. Compute manifestHash = keccak256(canonical)
 * 4. Post to HCS → capture consensusTimestamp
 * 5. Call publishEntity(token, manifestHash, uri)
 * 6. Verify ProofEntity event contains manifestHash
 * 7. Output: {ok, manifestHash, txId}
 *
 * Exit codes:
 * 0 - success
 * 1 - usage error
 * 2 - hash mismatch
 * 3 - network error
 */

import { ethers } from "ethers";
import { Client, TopicMessageSubmitTransaction } from "@hashgraph/sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  getOperatorConfig,
  getNetworkConfig,
  getHcsTopicId,
  getTokenConfig,
  DEPLOYED_CONTRACT_ADDRESS,
} from "./lib/config.js";
import { hashCanonicalJSON, canonicalizeJSON } from "./lib/canonicalize.js";

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

/**
 * Parse CLI arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    projections: {}
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--token" && i + 1 < args.length) {
      parsed.token = args[++i];
    } else if (args[i] === "--tokenId" && i + 1 < args.length) {
      parsed.tokenId = args[++i];
    } else if (args[i] === "--projections.light" && i + 1 < args.length) {
      parsed.projections.light = args[++i];
    } else if (args[i] === "--projections.paint" && i + 1 < args.length) {
      parsed.projections.paint = args[++i];
    } else if (args[i] === "--owner" && i + 1 < args.length) {
      parsed.owner = args[++i];
    } else if (args[i] === "--policyUri" && i + 1 < args.length) {
      parsed.policyUri = args[++i];
    } else if (args[i] === "--license" && i + 1 < args.length) {
      parsed.license = args[++i];
    } else if (args[i] === "--symbol" && i + 1 < args.length) {
      parsed.symbol = args[++i];
    }
  }

  // Validation
  if (!parsed.token || !parsed.tokenId || !parsed.projections.light || !parsed.projections.paint) {
    console.error(JSON.stringify({
      stage: "parse-args",
      ok: false,
      error: "Missing required args: --token --tokenId --projections.light --projections.paint",
      usage: "node scripts/entity.js --token <SYM|0x...> --tokenId <0.0.xxxxx> --projections.light <#RRGGBB> --projections.paint <#RRGGBB> [--owner <0.0.xxxxx>] [--policyUri <uri>] [--license <SPDX>]"
    }));
    process.exit(1);
  }

  // Validate hex colors
  const hexPattern = /^#[0-9A-Fa-f]{6}$/;
  if (!hexPattern.test(parsed.projections.light) || !hexPattern.test(parsed.projections.paint)) {
    console.error(JSON.stringify({
      stage: "parse-args",
      ok: false,
      error: "Invalid hex color format. Must be #RRGGBB"
    }));
    process.exit(1);
  }

  return {
    token: resolveToken(parsed.token),
    tokenId: parsed.tokenId,
    symbol: parsed.symbol || parsed.token.toUpperCase(),
    owner: parsed.owner,
    projections: {
      "color.light": parsed.projections.light.toUpperCase(),
      "color.paint": parsed.projections.paint.toUpperCase()
    },
    policyUri: parsed.policyUri,
    license: parsed.license
  };
}

/**
 * Resolve token symbol or address to EVM address
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
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r << 16) | (g << 8) | b;
}

/**
 * Main execution
 */
async function main() {
  try {
    const params = parseArgs();
    const operatorConfig = getOperatorConfig();
    const networkConfig = getNetworkConfig();
    const topicId = getHcsTopicId();

    if (!topicId) {
      console.error(JSON.stringify({
        stage: "init",
        ok: false,
        error: "HCS_TOPIC_ID not configured in .env"
      }));
      process.exit(3);
    }

    console.log(JSON.stringify({
      stage: "init",
      ok: true,
      token: params.token,
      symbol: params.symbol,
      projections: params.projections
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
    const contract = new ethers.Contract(DEPLOYED_CONTRACT_ADDRESS, artifact.abi, wallet);

    // Build manifest JSON (v0.4.1 schema - ASCII key sort)
    const manifest = {
      controller: wallet.address.toLowerCase(),
      layer: "floridi",
      owner: params.owner || wallet.address.toLowerCase(),
      projections: params.projections,
      signer: wallet.address.toLowerCase(),
      token: {
        address: params.token,
        id: params.tokenId,
        symbol: params.symbol
      },
      topicId,
      ts: new Date().toISOString(),
      v: "0.4"
    };

    if (params.policyUri) {
      manifest.policyUri = params.policyUri;
    }
    if (params.license) {
      manifest.license = params.license;
    }

    const canonical = canonicalizeJSON(manifest);
    const manifestHash = hashCanonicalJSON(manifest);

    console.log(JSON.stringify({
      stage: "canonical-manifest",
      ok: true,
      manifestHash,
      bytes: canonical.length
    }));

    // Submit to HCS
    const client = Client.forTestnet().setOperator(
      operatorConfig.id,
      operatorConfig.derKey
    );

    const submitTx = await new TopicMessageSubmitTransaction()
      .setTopicId(topicId)
      .setMessage(canonical)
      .execute(client);

    const submitRecord = await submitTx.getRecord(client);
    const consensusTimestamp = submitRecord.consensusTimestamp;

    console.log(JSON.stringify({
      stage: "hcs-submit",
      ok: true,
      consensusTimestamp: consensusTimestamp.toString(),
      topicId
    }));

    // Call publishEntity
    const canonicalUri = `hcs://${topicId}/${consensusTimestamp.seconds}.${consensusTimestamp.nanos}`;

    const tx = await contract.publishEntity(
      params.token,
      manifestHash,
      canonicalUri
    );

    const receipt = await tx.wait();

    console.log(JSON.stringify({
      stage: "contract-call",
      ok: true,
      txId: receipt.hash,
      gasUsed: receipt.gasUsed.toString()
    }));

    // Parse ProofEntity event
    const proofEntityEvent = receipt.logs
      .map(log => {
        try {
          return contract.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
        } catch {
          return null;
        }
      })
      .find(e => e && e.name === "ProofEntity");

    if (!proofEntityEvent) {
      console.error(JSON.stringify({
        stage: "verify-event",
        ok: false,
        error: "ProofEntity event not found in transaction logs"
      }));
      process.exit(2);
    }

    const eventManifestHash = proofEntityEvent.args.manifestHash;
    const eventToken = proofEntityEvent.args.token;

    // Verify hash equality
    if (eventManifestHash.toLowerCase() !== manifestHash.toLowerCase()) {
      console.error(JSON.stringify({
        stage: "verify-hash",
        ok: false,
        error: "ManifestHash mismatch",
        expected: manifestHash,
        eventHash: eventManifestHash
      }));
      process.exit(2);
    }

    if (eventToken.toLowerCase() !== params.token.toLowerCase()) {
      console.error(JSON.stringify({
        stage: "verify-token",
        ok: false,
        error: "Token address mismatch",
        expected: params.token,
        eventToken: eventToken
      }));
      process.exit(2);
    }

    // Final output
    console.log(JSON.stringify({
      stage: "entity",
      ok: true,
      manifestHash,
      txId: receipt.hash,
      topicId,
      consensusTimestamp: consensusTimestamp.toString(),
      blockNumber: receipt.blockNumber,
      token: params.token,
      symbol: params.symbol,
      projections: params.projections
    }));

    client.close();
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
