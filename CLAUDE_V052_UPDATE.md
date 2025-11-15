# v0.5.2 Final State & v0.6 Roadmap

**Date**: 2025-11-15
**Status**: v0.5.2 COMPLETE ✅ | v0.6 PLANNED 📋

## Executive Summary

v0.5.2 achieves **full triple-layer provenance** with **semantic rule hashing** and **bundle-based proof execution**. All 3 RGB→CMY validation proofs executed successfully. The Glass Box architecture is operational.

**Key Accomplishment**: Implemented "rules within the rules" via semantic ruleHash (`domain:operator` pattern), decoupling logical rule identity from contract bytecode.

---

## v0.5.2 Final State

### Contract Deployment

- **Contract**: `0.0.7261322` (v0.5.2-debug)
- **EVM Address**: `0x6f46212a06e6bca5e3f74f4a2acafc70ca9db7fd`
- **HCS Topic**: `0.0.7239064` (Ontologic Reasoning Proof Tree)
- **Operator**: `0.0.7238571` (`0x00000000000000000000000000000000006e73ab`)

### Architecture: The Glass Box

Ontologic implements a **Triune Proof Compression** where three dimensions of verification compress into a single on-chain morpheme (the ProofData struct):

```
           Peirce Layer (User Expectation)
                     ↓
           Tarski Layer (Domain Rules)
                     ↓
           Floridi Layer (Public Manifest)
                     ↓
              [Glass Box Junction]
                     ↓
              ProofData struct
```

#### ProofData Struct (The Glass Box)

```solidity
struct ProofData {
    bytes32 inputsHash;    // Material Reality (sorted tokens + domain + operator)
    bytes32 proofHash;     // Floridi Manifest (canonical proof keccak256)
    bytes32 factHash;      // Canonical fact (same as proofHash in v0.5.2)
    bytes32 ruleHash;      // Tarski Rule (semantic identity: keccak256(domain:operator))
    string canonicalUri;   // HCS consensus anchor
}
```

**The Three Dimensions**:
1. **Tarski** (`ruleHash`): Semantic rule identity - the domain's logical constraints
2. **Material** (`inputsHash`): Physical token binding - which tokens are involved
3. **Floridi** (`proofHash`, `canonicalUri`): Consensus provenance - public verification record

### Critical Implementation: Semantic Rule Hashing

**The "Rules Within Rules" Principle**:

> In Ontologic, the YES or NO result is determined by the **rules within the rules** of the domain.
> Each domain encodes its own valid logical constraints, and the system validates whether inputs satisfy that domain's rule set.

**v0.5.2 Implementation**:

```javascript
// Semantic rule identity (domain-level logical constraint)
const ruleHash = keccak256(toUtf8Bytes(`${domain}:${operator}`));
// Example: keccak256("color.light:mix_add@v1") = 0xd59ddaedcf858a...
```

**Why This Matters**:
- Rule identity is **semantic**, not bytecode-bound
- Same logical rule can exist across multiple contract deployments
- Enables rule portability and cross-contract proof verification
- **Outer rule** (contract bytecode) enforces **inner rule** (domain semantics)
- `ruleHash` captures the **inner rule identity**, not the implementation

**Example Flow (color.light domain)**:

```
User: "RED + GREEN → ?"
  ↓ Peirce layer: Requested action (expectation)

Domain rules evaluate:
  domain = "color.light"
  operator = "mix_add@v1"
  ruleHash = keccak256("color.light:mix_add@v1")

Contract checks:
  1. Are inputs valid tokens in this domain? (projection registry)
  2. Does operator apply to these inputs? (RGB→CMY hardcoded in v0.5.2)
  3. Is proof unique? (inputsHash not seen before)

  ↓ Tarski layer: Domain says YES

Result: YELLOW token minted
  ↓ Floridi layer: Public manifest

canonicalUri = "hcs://0.0.7239064/1763179772.831308000"
  ^ Anyone can verify the proof that justified YES
```

### Validation Proofs (v0.5.2 Final)

All 3 RGB→CMY proofs executed successfully with corrected semantic rule hashing:

| Proof | Transaction | HCS Seq | ruleHash | Status |
|-------|-------------|---------|----------|--------|
| RED+GREEN→YELLOW | [0.0.7238571@1763179767.103497294](https://hashscan.io/testnet/transaction/0.0.7238571@1763179767.103497294) | 33 | `0xd59ddaedcf858a...` | ✅ SUCCESS |
| GREEN+BLUE→CYAN | [0.0.7238571@1763179807.449701123](https://hashscan.io/testnet/transaction/0.0.7238571@1763179807.449701123) | 34 | `0xd59ddaedcf858a...` | ✅ SUCCESS |
| RED+BLUE→MAGENTA | [0.0.7238571@1763179817.908083868](https://hashscan.io/testnet/transaction/0.0.7238571@1763179817.908083868) | 35 | `0xd59ddaedcf858a...` | ✅ SUCCESS |

**Note**: All 3 proofs share the same `ruleHash` because they use the same semantic rule (`color.light:mix_add@v1`).

**Canonical Proofs ("Bytes Used On Video")**:
- RED+GREEN→YELLOW: `hcs://0.0.7239064/1763179772.831308000` (Seq 33)
- GREEN+BLUE→CYAN: `hcs://0.0.7239064/1763179810.548449000` (Seq 34)
- RED+BLUE→MAGENTA: `hcs://0.0.7239064/1763179820.102571032` (Seq 35)

### Bundle-Based Proof Execution

**New Quickstart**:

```bash
node scripts/reason.js examples/mvp/red-green-yellow.json
```

**Bundle Format**:

```json
{
  "v": "0.5.2",
  "layer": "peirce",
  "mode": "additive",
  "domain": "color.light",
  "operator": "mix_add@v1",
  "inputs": [
    { "symbol": "RED", "token": "0x00000000000000000000000000000000006e9742" },
    { "symbol": "GREEN", "token": "0x00000000000000000000000000000000006e9743" }
  ],
  "output": {
    "symbol": "YELLOW",
    "token": "0x00000000000000000000000000000000006e9799",
    "amount": "1"
  },
  "rule": {
    "contract": "0x6f46212a06e6bca5e3f74f4a2acafc70ca9db7fd",
    "version": "v0.5.2"
  },
  "description": "Red light + Green light = Yellow light (additive color mixing)"
}
```

**Execution Flow**:
1. Load reasoning bundle (JSON)
2. Derive `domainHash = keccak256(domain)`
3. Derive `operatorHash = keccak256(operator)`
4. Build canonical proof payload
5. Post to HCS (Layer 3) → get `consensusTimestamp`
6. Compute ProofData fields:
   - `inputsHash = keccak256(abi.encode(sortedTokens, domainHash, operatorHash))`
   - `proofHash = keccak256(canonical JSON)`
   - `factHash = proofHash` (MVP form)
   - `ruleHash = keccak256(domain + ":" + operator)`
   - `canonicalUri = hcs://${topicId}/${consensusTimestamp}`
7. Encode via `ethers.Interface`
8. Execute via Hedera SDK (Layer 1 + 2)

### Technical Fixes in v0.5.2

#### 1. ProofData Struct Encoding (v0.5.2-debug)
**Problem**: Passing 8 individual parameters caused function selector mismatch.

**Solution**: Hybrid SDK/ethers encoding pattern:
```javascript
import { ethers, Interface } from "ethers";

const REASONING_ABI = [
  "function reasonAdd(address A, address B, bytes32 domainHash, (bytes32 inputsHash, bytes32 proofHash, bytes32 factHash, bytes32 ruleHash, string canonicalUri) p) external returns (address outToken, uint64 amount)"
];

const iface = new Interface(REASONING_ABI);

const proofData = { inputsHash, proofHash, factHash, ruleHash, canonicalUri };
const encodedFn = iface.encodeFunctionData("reasonAdd", [A, B, domainHash, proofData]);

const tx = await new ContractExecuteTransaction()
  .setContractId(contractId)
  .setGas(300000)
  .setFunctionParameters(Buffer.from(encodedFn.slice(2), "hex"))
  .execute(client);
```

#### 2. Semantic Rule Hashing (v0.5.2 final)
**Changed from**: `ruleHash = keccak256(solidityPacked([contractAddr, codeHash, version]))`
**Changed to**: `ruleHash = keccak256(toUtf8Bytes(domain + ":" + operator))`

**Impact**: Rule identity is now portable across contract deployments.

#### 3. Dynamic Domain/Operator Hashing (v0.5.2 final)
**Changed from**: Hardcoded `D_LIGHT` and `OP_ADD` constants
**Changed to**: Bundle-driven `domainHash = keccak256(bundle.domain)` and `operatorHash = keccak256(bundle.operator)`

**Impact**: Generalized proof execution across any domain/operator combination.

### Token Architecture (Current Deployment)

**RGB Primaries (Human-Minted Axioms)**:
- RED: `0.0.7247682` (`0x00000000000000000000000000000000006e9742`)
- GREEN: `0.0.7247683` (`0x00000000000000000000000000000000006e9743`)
- BLUE: `0.0.7247684` (`0x00000000000000000000000000000000006e9744`)
- 1M initial supply, operator-controlled admin + supply keys

**CMY Secondaries (Contract-Minted Proof Outputs)**:
- YELLOW: `0.0.7247769` (`0x00000000000000000000000000000000006e9799`)
- CYAN: `0.0.7247778` (`0x00000000000000000000000000000000006e97a2`)
- MAGENTA: `0.0.7247782` (`0x00000000000000000000000000000000006e97a6`)
- 0 initial supply, contract holds supply key

**Derived Tokens (Entity-Level)**:
- WHITE: `0.0.7238662` (`0x00000000000000000000000000000000006e7406`)
- BLACK: `0.0.7246868` (`0x00000000000000000000000000000000006e9414`)
- PURPLE: `0.0.7238696` (`0x00000000000000000000000000000000006e7428`)

---

## v0.6 Roadmap (Floridi Layer)

### Goal: Entity-Level Attestation

Extend Ontologic to the full Floridi layer where entities consume evidence from reasoning proofs and produce domain verdicts.

### Architecture Extension

```
v0.5.2: Peirce → Tarski (Reasoning Proofs)
         ↓
v0.6:   Floridi → Entity Attestation (Domain Verdicts)
```

**New Flow**:

1. **Reasoning Proofs** (v0.5.2): RED+GREEN→YELLOW, GREEN+BLUE→CYAN, RED+BLUE→MAGENTA
2. **Entity Attestation** (v0.6): Consume 3 proofs → Attest WHITE (light domain) or BLACK (paint domain)

### Domain Verdict Logic ("Rules Within Rules")

**LIGHT Domain** (`color.entity.light`):
- **Rule**: If YELLOW + CYAN + MAGENTA proofs are valid → YES → mint WHITE
- **Semantic**: All CMY secondaries present = complete additive spectrum
- **Verdict Token**: WHITE

**PAINT Domain** (`color.entity.paint`):
- **Rule**: If YELLOW + CYAN + MAGENTA proofs are valid → YES → mint BLACK
- **Semantic**: All CMY secondaries present = complete subtractive spectrum
- **Verdict Token**: BLACK

**Invalid Evidence**:
- Missing proofs → NO → revert
- Invalid proofHashes → NO → revert
- Cross-domain contamination → NO → revert

### v0.6 Contract Extension

**New Function**:

```solidity
function publishEntity(
    address token,
    bytes32 manifestHash,
    string calldata manifestUri
) external returns (address verdictToken, uint64 amount);
```

**New Event**:

```solidity
event ProofEntity(
    bytes32 indexed manifestHash,
    address indexed entityToken,
    address indexed verdictToken,
    string manifestUri,
    uint64 amount
);
```

### v0.6 Manifest Schema (Formal Reasoning JSON v0.1)

```json
{
  "v": "0.6.0",
  "nsid": "color.entity.WHITE.light@v1",
  "layer": "floridi",
  "mode": "entity",
  "domain": "color.entity.light",
  "operator": "attest_palette@v1",
  "evidence": [
    {
      "proofHash": "0x536d578fe6704ea413ca3e51a66f220db2ceeeacc3c12e7d905acf24795417b2",
      "canonicalUri": "hcs://0.0.7239064/1763179772.831308000",
      "hcsSeq": "33",
      "inputs": [...],
      "output": { "symbol": "YELLOW", ... }
    },
    {
      "proofHash": "0xb61992a0c5d7114ff82af5fb2f4863b1099d431837cc83a013e9d090f00978bd",
      "canonicalUri": "hcs://0.0.7239064/1763179810.548449000",
      "hcsSeq": "34",
      "inputs": [...],
      "output": { "symbol": "CYAN", ... }
    },
    {
      "proofHash": "0x33608b66fa5b9be56ca0939faea1f360741f07edb30dac81521582a61f4059ba",
      "canonicalUri": "hcs://0.0.7239064/1763179820.102571032",
      "hcsSeq": "35",
      "inputs": [...],
      "output": { "symbol": "MAGENTA", ... }
    }
  ],
  "output": {
    "token": "0x00000000000000000000000000000000006ecd4a",
    "symbol": "WHITE",
    "verdict": "0x00000000000000000000000000000000006ecd4a",
    "amount": "1"
  },
  "signers": ["0x00000000000000000000000000000000006e73ab"],
  "nonce": "0x...",
  "topicId": "0.0.7239064",
  "ts": "2025-11-15T..."
}
```

### v0.6 Execution (DRAFT - Not Yet Operational)

**CLI**:

```bash
node scripts/entity-v06.js examples/mvp/entity-white-light.json
```

**Flow**:
1. Load entity manifest bundle
2. Canonicalize → `manifestHash`
3. Post manifest to HCS (Floridi plane)
4. Call `publishEntity(token, manifestHash, manifestUri)`
5. Contract validates:
   - All evidence proofHashes exist in contract state
   - All evidence is from the correct domain
   - Evidence set is complete per domain rules
6. Domain verdict: YES → mint verdict token (WHITE or BLACK)
7. Emit `ProofEntity` event

### Triple-Lock Verification (v0.6)

**Layer 3 (HCS)**:
- `manifestHash` in consensus record at `manifestUri`

**Layer 1 (Contract)**:
- `manifestHash` in `ProofEntity` event
- Evidence validation (all `proofHash`es exist in state)

**Layer 2 (Material)**:
- WHITE or BLACK token state change
- Recipient receives verdict token

### v0.6 Implementation Tasks

**Contract Changes**:
1. Add `publishEntity` function
2. Add `ProofEntity` event
3. Add evidence validation logic (domain-specific rules)
4. Add entity state registry (`manifestHash` → verdict)

**Script Changes**:
1. ✅ Draft `entity-v06.js` (DONE)
2. ✅ Create entity bundle format (DONE)
3. Implement evidence cross-linking
4. Add domain verdict validation

**Documentation**:
1. Update architecture.md with full Floridi flow diagram
2. Document entity attestation as "triple-lock" completion
3. Add Formal Reasoning JSON v0.1 specification

---

## Key Artifacts

### v0.5.2 (Production)

**Scripts**:
- [scripts/reason.js](scripts/reason.js) - Bundle-based proof executor
- [scripts/lib/canonicalize.js](scripts/lib/canonicalize.js) - RFC 8785 canonicalizer

**Bundles**:
- [examples/mvp/red-green-yellow.json](examples/mvp/red-green-yellow.json)
- [examples/mvp/green-blue-cyan.json](examples/mvp/green-blue-cyan.json)
- [examples/mvp/red-blue-magenta.json](examples/mvp/red-blue-magenta.json)

**Validation**:
- [V052_FINAL_VALIDATION.md](V052_FINAL_VALIDATION.md) - Complete validation report

### v0.6 (Draft)

**Scripts**:
- [scripts/entity-v06.js](scripts/entity-v06.js) - Entity attestation executor (DRAFT)

**Bundles**:
- [examples/mvp/entity-white-light.json](examples/mvp/entity-white-light.json) - WHITE entity manifest

---

## Usage

### Execute Reasoning Proof (v0.5.2)

```bash
# Run additive color proof
node scripts/reason.js examples/mvp/red-green-yellow.json

# Output:
# ✅ HCS post: Seq 33, proofHash 0x536d...
# ✅ Contract call: SUCCESS
# ✅ Triple-layer provenance confirmed
```

### Execute Entity Attestation (v0.6 - Not Yet Available)

```bash
# Will FAIL on v0.5.2 contract (publishEntity not deployed)
node scripts/entity-v06.js examples/mvp/entity-white-light.json

# Expected error:
# ⚠️  EXPECTED FAILURE: publishEntity function requires v0.6 contract deployment
```

---

## Next Session Priorities

1. **Strip Debug Instrumentation**: Remove `DebugPair` event, deploy clean v0.6 contract
2. **Implement publishEntity**: Add entity attestation function to contract
3. **Add Evidence Validation**: Implement domain-specific verdict logic
4. **Execute Entity Proof**: Run first WHITE attestation with real evidence
5. **Document Full Architecture**: Update architecture.md with complete Floridi flow

---

**For historical context, see the full [CLAUDE.md](CLAUDE.md) file.**
