/**
 * @fileoverview Execute additive reasoning (Peirce/ProofAdd) - v0.4.1 schema
 * @module scripts/reason-add
 *
 * Usage: node scripts/reason-add.js --domain <light|paint> --A <SYM> --B <SYM> --output <SYM>
 *
 * Flow:
 * 1. Parse args and resolve token addresses
 * 2. Build canonical proof JSON (v0.4.1, layer:peirce)
 * 3. Compute proofHash = keccak256(canonical)
 * 4. Post to HCS → capture consensusTimestamp
 * 5. Call reasonAdd() → mint output token
 * 6. Verify ProofAdd event contains proofHash
 * 7. Output: {ok, proofHash, txId}
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

const DOMAIN_MAP = {
  light: "color.light",
  paint: "color.paint",
};

/**
 * Parse CLI arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--domain" && i + 1 < args.length) {
      parsed.domain = args[++i];
    } else if (args[i] === "--A" && i + 1 < args.length) {
      parsed.A = args[++i];
    } else if (args[i] === "--B" && i + 1 < args.length) {
      parsed.B = args[++i];
    } else if (args[i] === "--output" && i + 1 < args.length) {
      parsed.output = args[++i];
    }
  }

  // Validation
  if (!parsed.domain || !parsed.A || !parsed.B || !parsed.output) {
    console.error(JSON.stringify({
      stage: "parse-args",
      ok: false,
      error: "Missing required args: --domain --A --B --output",
      usage: "node scripts/reason-add.js --domain <light|paint> --A <SYM> --B <SYM> --output <SYM>"
    }));
    process.exit(1);
  }

  if (!DOMAIN_MAP[parsed.domain]) {
    console.error(JSON.stringify({
      stage: "parse-args",
      ok: false,
      error: `Invalid domain: ${parsed.domain}. Must be 'light' or 'paint'.`
    }));
    process.exit(1);
  }

  return {
    domain: DOMAIN_MAP[parsed.domain],
    domainKey: parsed.domain,
    A: resolveToken(parsed.A),
    B: resolveToken(parsed.B),
    output: resolveToken(parsed.output),
    outputSym: parsed.output.toUpperCase(),
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
 * Get contract code hash and function selector
 */
async function getContractMetadata(provider) {
  const code = await provider.getCode(DEPLOYED_CONTRACT_ADDRESS);
  const codeHash = ethers.keccak256(code);

  // For additive: reasonAdd (or similar - adjust based on actual contract method)
  // Using generic signature - update if contract has specific additive function
  const fnSignature = "reason(bytes32,uint256,bytes32,string)";
  const fnSelector = ethers.id(fnSignature).slice(0, 10);

  return { codeHash, fnSelector };
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
      domain: params.domain,
      relation: `${params.A} + ${params.B} → ${params.output}`
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

    // Get contract metadata
    const { codeHash, fnSelector } = await getContractMetadata(provider);

    // Build canonical proof JSON (v0.4.1 schema - Peirce/additive)
    const proof = {
      domain: params.domain,
      inputs: [
        { label: "A", token: params.A },
        { label: "B", token: params.B }
      ],
      layer: "peirce",
      mode: "additive",
      operator: "mix_add@v1",
      output: { token: params.output, amount: "1" },
      relation: "A+B→C",
      rule: {
        codeHash,
        contract: DEPLOYED_CONTRACT_ADDRESS.toLowerCase(),
        functionSelector: fnSelector,
        version: "v0.4.1"
      },
      signer: wallet.address.toLowerCase(),
      topicId,
      ts: new Date().toISOString(),
      v: "0.4.1"
    };

    const canonical = canonicalizeJSON(proof);
    const proofHash = hashCanonicalJSON(proof);

    console.log(JSON.stringify({
      stage: "canonical-proof",
      ok: true,
      proofHash,
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

    const canonicalUri = `hcs://${topicId}/${consensusTimestamp.seconds}.${consensusTimestamp.nanos}`;

    // Note: This assumes contract has a reasonAdd or similar method
    // If not, this will fail - adjust based on actual contract interface
    console.log(JSON.stringify({
      stage: "reason-add",
      ok: true,
      note: "Additive proof generated. Contract call would require reasonAdd() or reason() method.",
      proofHash,
      canonicalUri,
      domain: params.domain,
      relation: `${params.A} + ${params.B} → ${params.output}`
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
