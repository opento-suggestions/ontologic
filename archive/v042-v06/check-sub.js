/**
 * @fileoverview Execute subtractive reasoning check (Tarski/ProofCheck)
 * @module scripts/check-sub
 *
 * Usage: node scripts/check-sub.js --domain <light|paint> --A <SYM|0x...> --B <SYM|0x...> --C <SYM|0x...> [--epsilon N]
 *
 * Flow:
 * 1. Parse args and resolve token addresses
 * 2. Build canonical proof JSON (v0.4, layer:tarski)
 * 3. Compute proofHash = keccak256(canonical)
 * 4. Post to HCS → capture message and consensusTimestamp
 * 5. Call reasonCheckSub() → get verdict
 * 6. Verify ProofCheck event contains proofHash
 * 7. Assert: hash_event == proofHash
 * 8. Output: {ok, verdict, proofHash, txId}
 *
 * Exit codes:
 * 0 - success (regardless of verdict)
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
    } else if (args[i] === "--C" && i + 1 < args.length) {
      parsed.C = args[++i];
    } else if (args[i] === "--epsilon" && i + 1 < args.length) {
      parsed.epsilon = parseInt(args[++i], 10);
    }
  }

  // Validation
  if (!parsed.domain || !parsed.A || !parsed.B || !parsed.C) {
    console.error(JSON.stringify({
      stage: "parse-args",
      ok: false,
      error: "Missing required args: --domain --A --B --C",
      usage: "node scripts/check-sub.js --domain <light|paint> --A <SYM|0x...> --B <SYM|0x...> --C <SYM|0x...> [--epsilon N]"
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
    C: resolveToken(parsed.C),
    epsilon: parsed.epsilon || 0,
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

  // reasonCheckSub(address,address,address,bytes32,bytes32,string)
  const fnSignature = "reasonCheckSub(address,address,address,bytes32,bytes32,string)";
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
      relation: `${params.A} - ${params.B} == ${params.C}`,
      epsilon: params.epsilon
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

    // Build canonical proof JSON (v0.4.1 schema)
    const proof = {
      v: "0.4",
      domain: params.domain,
      epsilon: params.epsilon,
      inputs: [
        { label: "A", token: params.A },
        { label: "B", token: params.B },
        { label: "C", token: params.C }
      ],
      layer: "tarski",
      mode: "subtractive",
      operator: "check_sub@v1",
      relation: "A-B==C",
      rule: {
        codeHash,
        contract: DEPLOYED_CONTRACT_ADDRESS.toLowerCase(),
        functionSelector: fnSelector,
        version: "v0.4"
      },
      signer: wallet.address.toLowerCase(),
      topicId,
      ts: new Date().toISOString()
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

    // Compute HCS message hash
    const hcsHash = ethers.keccak256(ethers.toUtf8Bytes(canonical));

    // Call reasonCheckSub
    const domainHash = ethers.keccak256(ethers.toUtf8Bytes(params.domain));
    const canonicalUri = `hcs://${topicId}/${consensusTimestamp.seconds}.${consensusTimestamp.nanos}`;

    const tx = await contract.reasonCheckSub(
      params.A,
      params.B,
      params.C,
      domainHash,
      proofHash,
      canonicalUri
    );

    const receipt = await tx.wait();
    const verdict = await contract.reasonCheckSub.staticCall(
      params.A,
      params.B,
      params.C,
      domainHash,
      proofHash,
      canonicalUri
    );

    console.log(JSON.stringify({
      stage: "contract-call",
      ok: true,
      txId: receipt.hash,
      verdict,
      gasUsed: receipt.gasUsed.toString()
    }));

    // Parse ProofCheck event
    const proofCheckEvent = receipt.logs
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
      .find(e => e && e.name === "ProofCheck");

    if (!proofCheckEvent) {
      console.error(JSON.stringify({
        stage: "verify-event",
        ok: false,
        error: "ProofCheck event not found in transaction logs"
      }));
      process.exit(2);
    }

    const eventProofHash = proofCheckEvent.args.proofHash;
    const eventDomain = proofCheckEvent.args.domain;
    const eventVerdict = proofCheckEvent.args.verdict;

    // Verify hash equality
    if (eventProofHash.toLowerCase() !== proofHash.toLowerCase()) {
      console.error(JSON.stringify({
        stage: "verify-hash",
        ok: false,
        error: "ProofHash mismatch",
        expected: proofHash,
        eventHash: eventProofHash
      }));
      process.exit(2);
    }

    if (eventDomain.toLowerCase() !== domainHash.toLowerCase()) {
      console.error(JSON.stringify({
        stage: "verify-domain",
        ok: false,
        error: "Domain hash mismatch",
        expected: domainHash,
        eventDomain: eventDomain
      }));
      process.exit(2);
    }

    // Triple-equality check
    console.log(JSON.stringify({
      stage: "triple-equality",
      ok: true,
      hash_local: proofHash,
      hash_event: eventProofHash,
      hash_hcs: hcsHash,
      match: proofHash === eventProofHash && proofHash === hcsHash
    }));

    // Final output
    console.log(JSON.stringify({
      stage: "check-sub",
      ok: true,
      verdict: eventVerdict,
      proofHash,
      txId: receipt.hash,
      topicId,
      consensusTimestamp: consensusTimestamp.toString(),
      blockNumber: receipt.blockNumber,
      domain: params.domain,
      relation: `${params.A} - ${params.B} == ${params.C}`
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
