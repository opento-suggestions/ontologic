# Ontologic Architecture

🔒 **FROZEN v0.6.3** - Hackathon Demo Reference (2025-11-15)

**Version**: v0.6.3
**Date**: 2025-11-15
**Status**: ✅ Fully Operational - Triune Architecture Complete

---

## Overview

Ontologic is a proof-of-reasoning toolkit for Hedera that implements a **three-layer provenance architecture** where logical operations on input tokens produce output tokens with verifiable on-chain proofs.

**The Morpheme**: Logical inference + material consequence + public consensus = single cryptographic hash compressing all three layers.

---

## Key Innovations

### v0.6.3 (Ascension Hackathon Demo)
- **Complete Triune Architecture**: Peirce (additive) + Tarski (subtractive) + Floridi (entity attestation)
- **publishEntityV2**: Explicit evidence validation for entity proofs
- **Rule Registry Infrastructure**: Built but deferred to v0.7.0+ (hardcoded execution remains authoritative)
- **Glass Box Verification**: Deterministic rule application, verifiable on-chain

### v0.6.0 (Floridi Layer)
- **Entity Attestation**: publishEntity function with domain verdict logic
- **Evidence-Based Validation**: Entity bundles consume multiple reasoning proofs
- **ProofEntity Event**: Floridi layer tracking

### v0.5.2 (Production Baseline)
- **Idempotent Proofs**: Each proofHash executes exactly once, replays return cached outputs
- **Order-Invariant Hashing**: Commutative operations (RED+GREEN == GREEN+RED) produce identical proofs
- **Input Mutation Guards**: Preimage hash verification prevents replay attacks
- **Configurable Token Addresses**: Post-deployment configuration breaks circular dependency

### v0.4.2 (MVP)
- **Dual-Layer Reasoning**: Peirce (additive minting) + Tarski (subtractive verification)
- **SDK-Based Execution**: Required for Hedera ContractId supply keys
- **HCS Integration**: Consensus-backed proof logging

---

## Current Deployment (Testnet - v0.6.3)

**ReasoningContract:**
- Contract ID: `0.0.7261322`
- EVM Address: `0x00000000000000000000000000000000006ecc8a`
- Owner: `0.0.7238571` (demo operator)
- Version: v0.6.3
- Code Hash: `0xd35199bebcddccd1e150e9140fcb1842295616dd249d63a0be6cc66ea75a48fd`

**HCS Topic:**
- Topic ID: `0.0.7239064`
- Name: Ontologic Reasoning Proof Tree
- Sequences Used: 33-42 (fresh demo proofs: 39-42)

**Token Infrastructure:**
- RGB Primaries: RED (0.0.7247682), GREEN (0.0.7247683), BLUE (0.0.7247684)
- CMY Secondaries: YELLOW (0.0.7247769), CYAN (0.0.7247778), MAGENTA (0.0.7247782)
- Entity Verdicts: WHITE (0.0.7261514), BLACK (0.0.7261517)

**Validation Status** (HCS Seq 39-42, 2025-11-15):
- ✅ RED+GREEN→YELLOW (Peirce layer)
- ✅ GREEN+BLUE→CYAN (Peirce layer)
- ✅ RED+BLUE→MAGENTA (Peirce layer)
- ✅ WHITE entity attestation (Floridi layer, evidence: 3 CMY proofs)

**See**: [DEMO_SNAPSHOT_V063.md](../DEMO_SNAPSHOT_V063.md) for complete canonical reference.

---

## Three-Layer Provenance

### Layer 1: CONTRACTCALL (Logic)
- Contract enforces deterministic rules via `_mixAddDeterministic`
- Domain: `color.light`, Operator: `mix_add@v1`
- Validation: Input preimage verification, output determinism

### Layer 2: TOKENMINT (Material Reality)
- Output token minted via HTS precompile (0x167)
- Permanent on-chain record of reasoning consequence
- Supply key held by contract for autonomous minting

### Layer 3: HCS MESSAGE (Meaning/Consensus)
- Canonical proof manifest posted to consensus topic
- Ordered, timestamped, immutable
- Public verification of reasoning provenance

**Compression:**
```
ruleHash = keccak256("color.light:mix_add@v1")
inputsHash = keccak256(sorted([RED, GREEN]))
proofHash = keccak256(canonical_manifest)
```

All three layers compress into a single `proofHash` - the **morpheme**.

---

## Contract Architecture

### Core Functions

**Peirce Layer (Additive Reasoning):**
```solidity
function reasonAdd(
    bytes32 proofHash,
    bytes32 inputsHash,
    address tokenA,
    address tokenB,
    address outputToken,
    uint64 amount
) external returns (bool ok)
```

**Tarski Layer (Subtractive Verification):**
```solidity
function checkSub(
    address tokenA,
    address tokenB,
    address tokenC,
    uint8 epsilon
) external view returns (bool verdict)
```

**Floridi Layer (Entity Attestation):**
```solidity
function publishEntity(
    address token,
    bytes32 manifestHash,
    string calldata uri
) external returns (bool ok)

function publishEntityV2(
    address token,
    bytes32 manifestHash,
    string calldata uri,
    bytes32[] calldata evidenceHashes
) external returns (bool ok)
```

**Rule Registry (v0.7.0+):**
```solidity
function setRule(
    bytes32 domain,
    bytes32 operator,
    address[] calldata inputs,
    address outputToken,
    uint64 ratioNumerator
) external onlyOwner returns (bytes32 ruleId)
```

### Storage Layout

```solidity
// Token addresses (configurable post-deployment)
address RED_TOKEN_ADDR;
address GREEN_TOKEN_ADDR;
address BLUE_TOKEN_ADDR;
address YELLOW_TOKEN_ADDR;
address CYAN_TOKEN_ADDR;
address MAGENTA_TOKEN_ADDR;
address WHITE_TOKEN_ADDR;
address BLACK_TOKEN_ADDR;

// Proof tracking
mapping(bytes32 => bool) proofSeen;           // Replay detection
mapping(bytes32 => address) cachedOutputs;    // Idempotent results

// Rule registry (v0.6.3+, not yet active)
mapping(bytes32 => Rule) rules;
```

### Domain & Operator Constants

```solidity
bytes32 constant D_LIGHT = keccak256("color.light");
bytes32 constant D_PAINT = keccak256("color.paint");
bytes32 constant D_ENTITY_LIGHT = keccak256("color.entity.light");
bytes32 constant D_ENTITY_PAINT = keccak256("color.entity.paint");

bytes32 constant OP_ADD = keccak256("mix_add@v1");
bytes32 constant OP_SUB = keccak256("mix_sub@v1");
bytes32 constant OP_ATTEST = keccak256("attest_palette@v1");
```

---

## Canonical Rule Definitions

### LIGHT Domain (RGB Additive Color Mixing)

**Rule 1: RED + GREEN → YELLOW**
- Domain: `color.light`
- Operator: `mix_add@v1`
- Inputs: [RED, GREEN]
- Output: YELLOW
- Semantics: Additive light mixing

**Rule 2: GREEN + BLUE → CYAN**
- Domain: `color.light`
- Operator: `mix_add@v1`
- Inputs: [GREEN, BLUE]
- Output: CYAN

**Rule 3: RED + BLUE → MAGENTA**
- Domain: `color.light`
- Operator: `mix_add@v1`
- Inputs: [RED, BLUE]
- Output: MAGENTA

**Rule 4: YELLOW + CYAN + MAGENTA → WHITE (Entity)**
- Domain: `color.entity.light`
- Operator: `attest_palette@v1`
- Evidence: 3 CMY proofs
- Verdict: WHITE (complete light spectrum)

**See**: [docs/rules-light-v063.md](rules-light-v063.md) for complete specifications.

---

## Execution Flow

### Additive Proof (Peirce Layer)

1. **Client**: Build canonical proof manifest
2. **Client**: Post manifest to HCS → get timestamp
3. **Client**: Compute `proofHash = keccak256(manifest)`
4. **Client**: Call `reasonAdd(proofHash, inputsHash, tokenA, tokenB, output, amount)`
5. **Contract**: Verify inputsHash preimage matches (tokenA, tokenB)
6. **Contract**: Check `proofSeen[proofHash]` for replay
7. **Contract**: Execute `_mixAddDeterministic(tokenA, tokenB)` → validate output
8. **Contract**: Mint output token via HTS precompile
9. **Contract**: Mark `proofSeen[proofHash] = true`
10. **Contract**: Emit `ProofAdd` event

### Entity Attestation (Floridi Layer)

1. **Client**: Build entity manifest with evidence references
2. **Client**: Post manifest to HCS → get timestamp
3. **Client**: Compute `manifestHash = keccak256(manifest)`
4. **Client**: Call `publishEntityV2(token, manifestHash, uri, evidenceHashes[])`
5. **Contract**: Validate evidence count (3 CMY proofs)
6. **Contract**: Verify each `evidenceHash` exists in `proofSeen` mapping
7. **Contract**: Determine domain verdict (LIGHT→WHITE, PAINT→BLACK)
8. **Contract**: Mint verdict token via HTS precompile
9. **Contract**: Emit `ProofEntity` event

---

## Known Limitations (v0.6.3)

### Rule Registry: Present but Not Active
- **Status**: Infrastructure built in source code but not deployed on-chain
- **Reason**: Hedera contracts with direct bytecode deployment are immutable
- **Impact**: Zero - hardcoded rules remain authoritative and fully functional
- **Resolution**: v0.7.0+ will deploy new contract instance OR implement proxy pattern

### Hardcoded Execution Path
- **Current**: `_mixAddDeterministic` enforces RGB→CMY logic directly
- **Future**: Registry-driven execution will replace hardcoded rules
- **Timeline**: Post-hackathon (v0.7.0+)

---

## Project Structure

```
ontologic/
├── contracts/
│   └── ReasoningContract.sol        # Core reasoning contract (v0.6.3)
├── scripts/
│   ├── lib/
│   │   ├── config.js                # Environment configuration
│   │   ├── logger.js                # Structured logging
│   │   └── canonicalize.js          # Canonical JSON serialization
│   ├── reason.js                    # Execute RGB→CMY proofs
│   ├── entity-v06.js                # Execute entity attestation
│   ├── validate-light-e2e-v063.js   # E2E validation
│   ├── deploy-sdk.js                # Contract deployment
│   ├── create_topic.js              # HCS topic creation
│   ├── migrate-supply-keys.js       # Supply key migration
│   ├── register-projections.js      # Color projection setup
│   └── mint_*.js                    # Token creation scripts
├── examples/
│   └── mvp/
│       ├── final/                   # 🔒 Frozen canonical bundles
│       ├── red-green-yellow.json
│       ├── green-blue-cyan.json
│       ├── red-blue-magenta.json
│       └── entity-white-light.json
├── docs/
│   ├── architecture.md              # This file
│   └── rules-light-v063.md          # Canonical rule definitions
├── CLAUDE.md                        # Development guide
├── DEMO_SNAPSHOT_V063.md            # 🔒 Canonical demo reference
├── JUDGE_CARD.md                    # Quick reference
└── README.md                        # Project overview
```

---

## Development Workflow

### Quick Start (Demo)

```bash
# 1. Install dependencies
npm install

# 2. Copy environment (pre-configured with demo credentials)
cp .env.example .env

# 3. Run proof chain
node scripts/reason.js examples/mvp/red-green-yellow.json
node scripts/reason.js examples/mvp/green-blue-cyan.json
node scripts/reason.js examples/mvp/red-blue-magenta.json
node scripts/entity-v06.js examples/mvp/entity-white-light.json

# 4. Validate
node scripts/validate-light-e2e-v063.js
```

### Infrastructure Setup (Already Complete)

```bash
# Create HCS topic
node scripts/create_topic.js

# Deploy contract
node scripts/deploy-sdk.js

# Create tokens
node scripts/mint_red.js
node scripts/mint_green.js
node scripts/mint_blue.js
node scripts/mint_yellow.js
node scripts/mint_cyan.js
node scripts/mint_magenta.js
node scripts/mint_white.js
node scripts/mint_black.js

# Migrate supply keys
node scripts/migrate-supply-keys.js

# Register projections
node scripts/register-projections.js --token RED
node scripts/register-projections.js --token GREEN
node scripts/register-projections.js --token BLUE
node scripts/register-projections.js --token YELLOW
node scripts/register-projections.js --token CYAN
node scripts/register-projections.js --token MAGENTA
```

---

## Verification

**On-Chain:**
- Contract: https://hashscan.io/testnet/contract/0.0.7261322
- HCS Topic: https://hashscan.io/testnet/topic/0.0.7239064

**Canonical Proofs (HCS Seq 39-42):**
- Seq 39: RED+GREEN→YELLOW (`0x8f61b2423b4aacab...`)
- Seq 40: GREEN+BLUE→CYAN (`0xef80dcbe1178c27f...`)
- Seq 41: RED+BLUE→MAGENTA (`0xe00da13738d4c2af...`)
- Seq 42: WHITE entity (`0xeb02c0ad5d7e7b35...`)

**Local:**
```bash
node scripts/validate-light-e2e-v063.js
```

---

## Post-Hackathon Roadmap

**v0.7.0 - Registry Activation:**
- Deploy new contract instance OR implement proxy pattern
- Migrate to registry-driven execution
- Enable `publishEntityV2` with strict on-chain validation
- Preserve proof continuity via HCS

**v0.8.0 - Federation:**
- Multi-domain support (LIGHT + PAINT + custom)
- Registry governance layer
- Modular rule operators

**v1.0.0 - Production:**
- Remove hardcoded rules entirely
- Full hsphere integration
- Cross-domain reasoning

---

**Document Status**: FROZEN for hackathon demo
**Last Updated**: 2025-11-15
**Version**: v0.6.3
