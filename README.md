# Ontologic — Proof-of-Reasoning on Hedera

A proof-of-reasoning toolkit for Hedera using the Hiero SDK. Implements a three-layer provenance architecture with **idempotent proof execution**, **RGB+CMY token reasoning**, and **deterministic additive color mapping**.

**Status**: Alpha v0.4.2 - Idempotent Proofs with Replay Detection (Validated 2025-11-08)

## Current Deployment (Testnet)

**Contract**: `0x97e00a2597C20b490fE869204B0728EF6c9F23eA` (v0.4.2)
**Contract ID**: `0.0.1822368746`
**Code Hash**: `0xc33f4e5747d3ef237fab636a0336e471cc6fa748d9c87c4c94351b6cd9e2ba16`
**Schema Hash**: `0xf1944d69e7680639ebde87ed129a18522cdf8415d254b9a12d638df5e1ddd934`
**HCS Topic**: `0.0.7204585` (Ontologic Reasoning Proof Alpha Tree)

### Input Tokens (RGB Primaries)
- **$RED**: `0.0.7204552` (EVM: `0x...006deec8`) - `#FF0000`
- **$GREEN**: `0.0.7204840` (EVM: `0x...006defe8`) - `#00FF00`
- **$BLUE**: `0.0.7204565` (EVM: `0x...006deed5`) - `#0000FF`

### Output Tokens (CMY Secondaries - Contract as Supply Key)
- **$YELLOW**: `0.0.7218008` (EVM: `0x...006e2358`) - `#FFFF00` (RED + GREEN)
- **$CYAN**: `0.0.7218009` (EVM: `0x...006e2359`) - `#00FFFF` (GREEN + BLUE)
- **$MAGENTA**: `0.0.7218010` (EVM: `0x...006e235a`) - `#FF00FF` (RED + BLUE)

### Entity-Only Token
- **$ORANGE**: `0.0.7217513` (EVM: `0x...006e2169`) - `#FFA500` (Projections registered, no proof operations)

### Validation Results (8 Proofs - HCS Sequences 22-29)

**Additive Proofs (Peirce Layer)**:
1. ✅ RED + GREEN → YELLOW ([TX](https://hashscan.io/testnet/transaction/0.0.6748221@1762584809.265709533))
2. ✅ GREEN + BLUE → CYAN ([TX](https://hashscan.io/testnet/transaction/0.0.6748221@1762584843.628968871))
3. ✅ RED + BLUE → MAGENTA ([TX](https://hashscan.io/testnet/transaction/0.0.6748221@1762584875.725125624))

**Subtractive Proofs (Tarski Layer)**:
4. ✅ GREEN - YELLOW == CYAN ([TX](https://hashscan.io/testnet/transaction/0.0.6748221@1762584950.995828670))
5. ✅ BLUE - MAGENTA == CYAN ([TX](https://hashscan.io/testnet/transaction/0.0.6748221@1762584963.754348526))
6. ✅ RED - YELLOW == MAGENTA ([TX](https://hashscan.io/testnet/transaction/0.0.6748221@1762584969.428319762))

**Negative Guards (Entity-Only Token)**:
7. ✅ ORANGE - YELLOW == RED (FALSE) ([TX](https://hashscan.io/testnet/transaction/0.0.6748221@1762584973.040043150))
8. ✅ ORANGE - RED == YELLOW (FALSE) ([TX](https://hashscan.io/testnet/transaction/0.0.6748221@1762584979.494407622))

📊 **Validation Report**: [proofs/V042_VALIDATION_REPORT.md](proofs/V042_VALIDATION_REPORT.md)
📦 **HCS Snapshot**: [proofs/hcs-topic-0.0.7204585-v042.json](proofs/hcs-topic-0.0.7204585-v042.json)

## Three-Layer Provenance Architecture

1. **Layer 1: CONTRACTCALL** - Smart contract validates input tokens and enforces reasoning rules
2. **Layer 2: TOKENMINT** - HTS precompile mints output token as material proof of valid reasoning (additive only)
3. **Layer 3: HCS MESSAGE** - Canonical proof JSON submitted to consensus topic for append-only provenance

**Complete provenance chain**: Logical Inference → Material Consequence → Public Consensus Record

## Key Features (v0.4.2)

### Idempotent Proof Execution
- Each `proofHash` executes exactly once
- Replay detection via `proofSeen` mapping
- Cached outputs for replayed proofs
- ~91% gas savings on replay (5,900 vs 69,100 gas)

### Order-Invariant Hashing
- Commutative operations produce identical proofs
- RED + GREEN == GREEN + RED (same proofHash)
- `inputsHash` uses sorted addresses

### Input Mutation Guards
- `inputsHashOf` mapping prevents replay attacks
- Preimage hash verification on proof execution
- Cannot reuse proofHash with different input tokens

### Dual-Layer Reasoning
- **Peirce Layer (Additive)**: Logical inference produces material tokens
- **Tarski Layer (Subtractive)**: Boolean verification with projection math
- Domain-scoped operations (color.light for additive, color.paint for subtractive)

## Quick Start

### Prerequisites

```bash
npm install
```

### Environment Setup

Create a `.env` file:

```env
# Operator Account
OPERATOR_ID=0.0.xxxxxx
OPERATOR_DER_KEY=302e...
OPERATOR_HEX_KEY=0x...
OPERATOR_EVM_ADDR=0x...

# Network
HEDERA_RPC_URL=https://testnet.hashio.io/api
MIRROR_NODE_URL=https://testnet.mirrornode.hedera.com/api/v1

# RGB Input Tokens
RED_TOKEN_ID=0.0.xxxxxx
GREEN_TOKEN_ID=0.0.xxxxxx
BLUE_TOKEN_ID=0.0.xxxxxx
RED_ADDR=0x...
GREEN_ADDR=0x...
BLUE_ADDR=0x...

# CMY Output Tokens
YELLOW_TOKEN_ID=0.0.xxxxxx
CYAN_TOKEN_ID=0.0.xxxxxx
MAGENTA_TOKEN_ID=0.0.xxxxxx
YELLOW_ADDR=0x...
CYAN_ADDR=0x...
MAGENTA_ADDR=0x...

# Contract & Topic
CONTRACT_ADDR=0x...
HCS_TOPIC_ID=0.0.xxxxxx
RULE_VERSION=v0.4.2
CODE_HASH=0x...
FN_SELECTOR_ADD=0x...
FN_SELECTOR_SUB=0x...
```

### Deployment Steps

```bash
# 1. Build contracts
npx hardhat compile

# 2. Deploy ReasoningContract
node scripts/deploy.js
# Capture: CONTRACT_ADDR, CODE_HASH

# 3. Create input tokens with RGB metadata
node scripts/mint_red.js
node scripts/mint_green.js
node scripts/mint_blue.js

# 4. Create output tokens with contract as supply key
node scripts/mint-cmy-with-contract-key.js
# Creates YELLOW, CYAN, MAGENTA with contract supply key

# 5. Migrate supply keys and configure contract
node scripts/migrate-supply-keys.js
# Updates token supply keys + calls setTokenAddresses()

# 6. Register color projections for subtractive reasoning
node scripts/register-projections.js --token YELLOW
node scripts/register-projections.js --token CYAN
node scripts/register-projections.js --token MAGENTA

# 7. Create HCS topic
node scripts/create_topic.js
```

### Execute Reasoning Operations

```bash
# Additive reasoning (Peirce layer - mints tokens)
node scripts/reason-add-sdk.js --A RED --B GREEN --out YELLOW
node scripts/reason-add-sdk.js --A GREEN --B BLUE --out CYAN
node scripts/reason-add-sdk.js --A RED --B BLUE --out MAGENTA

# Subtractive reasoning (Tarski layer - boolean verification)
node scripts/check-sub-sdk.js --A GREEN --B YELLOW --C CYAN
node scripts/check-sub-sdk.js --A BLUE --B MAGENTA --C CYAN
node scripts/check-sub-sdk.js --A RED --B YELLOW --C MAGENTA
```

## Architecture

### ReasoningContract.sol (v0.4.2)

**Key Functions**:
- `reasonAdd(A, B, domainHash, ProofData)` - Additive reasoning with replay detection
- `reasonCheckSub(A, B, C, domainHash, ProofData)` - Subtractive verification with replay detection
- `registerProjection(domainHash, token, rgb24)` - Register token color projections (owner-only)
- `setTokenAddresses(...)` - Configure token addresses post-deployment (owner-only)

**ProofData Struct**:
```solidity
struct ProofData {
    bytes32 inputsHash;   // Preimage hash of sorted inputs
    bytes32 proofHash;    // keccak256(canonical JSON)
    bytes32 factHash;     // keccak256(HCS message bytes)
    bytes32 ruleHash;     // keccak256(contract, codeHash, version)
    string canonicalUri;  // hcs://topicId/timestamp
}
```

**Events**:
- `ProofAdd(proofHash, domainHash, A, B, outputToken, outputAmount, ...)`
- `ProofCheck(proofHash, domainHash, A, B, C, verdict, ...)`
- `ProofReplay(proofHash, cachedToken, cachedAmount)`

### Canonical Proof Schema

**Additive Proof (v0.4.2)**:
```json
{
  "v": "0.4.2",
  "layer": "peirce",
  "mode": "additive",
  "domain": "color.light",
  "operator": "mix_add@v1",
  "inputs": [
    {"token": "0x...006deec8"},
    {"token": "0x...006defe8"}
  ],
  "output": {"amount": "1", "token": "0x...006e2358"},
  "rule": {
    "contract": "0x97e00a2597c20b490fe869204b0728ef6c9f23ea",
    "codeHash": "0xc33f4e5747d3ef237fab636a0336e471cc6fa748d9c87c4c94351b6cd9e2ba16",
    "functionSelector": "0xc687cfeb",
    "version": "v0.4.2"
  },
  "signer": "0xf14e3ebf486da30f7295119051a053d167b7eb5e",
  "topicId": "0.0.7204585",
  "ts": "2025-11-08T06:53:34.740Z"
}
```

**Subtractive Proof (v0.4.2)**:
```json
{
  "v": "0.4.2",
  "layer": "tarski",
  "mode": "subtractive",
  "domain": "color.paint",
  "operator": "check_sub@v1",
  "epsilon": 0,
  "inputs": [
    {"label": "A", "token": "0x...006defe8"},
    {"label": "B", "token": "0x...006e2358"},
    {"label": "C", "token": "0x...006e2359"}
  ],
  "relation": "A-B==C",
  "rule": {...},
  "signer": "0xf14e3ebf486da30f7295119051a053d167b7eb5e",
  "topicId": "0.0.7204585",
  "ts": "2025-11-08T06:55:52.098Z"
}
```

## Implementation Notes

### SDK-Based Execution

Due to Hedera JSON-RPC limitations with ContractId supply keys, proof execution uses Hedera SDK:

```javascript
import { ContractExecuteTransaction } from "@hashgraph/sdk";

const tx = await new ContractExecuteTransaction()
  .setContractId(contractId)
  .setGas(300000)
  .setFunction("reasonAdd", params)
  .execute(client);
```

### Proof Orchestration Pattern

1. SDK script builds canonical proof JSON
2. SDK script posts proof to HCS via `TopicMessageSubmitTransaction`
3. SDK script calls contract via `ContractExecuteTransaction` with ProofData
4. Contract validates logic, mints tokens (additive), emits events
5. Triple-layer provenance achieved

**Benefits**: Separation of concerns, modularity, verifiability, composability

## Documentation

- **[CLAUDE.md](CLAUDE.md)** - Development guide for Claude Code
- **[architecture.md](architecture.md)** - Detailed architecture documentation
- **[JUDGE_CARD.md](JUDGE_CARD.md)** - Project submission card
- **[proofs/V042_VALIDATION_REPORT.md](proofs/V042_VALIDATION_REPORT.md)** - Validation report

## Verification

### Query HCS Topic
```bash
curl "https://testnet.mirrornode.hedera.com/api/v1/topics/0.0.7204585/messages?sequencenumber=gte:22"
```

### View Transaction
```
https://hashscan.io/testnet/transaction/{TRANSACTION_ID}
```

### Verify Proof Hash
```javascript
import { ethers } from 'ethers';
const proofHash = ethers.keccak256(ethers.toUtf8Bytes(canonicalJSON));
```

## License

Apache-2.0

## Contributing

See [CLAUDE.md](CLAUDE.md) for development guidelines.

---

**Built on Hedera** • **Powered by HTS & HCS** • **Validated 2025-11-08**
