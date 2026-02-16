# Ontologic Architecture v0.7

**Version**: v0.7.0 (in development)
**Date**: 2025-02-16
**Status**: Specification Phase - No Code Changes Yet
**Baseline**: v0.6.3 (frozen hackathon demo)

---

## 1. Overview - v0.7 Delta

### 1.1 Triune Architecture Foundation

Ontologic implements a **three-layer provenance architecture** where logical operations on input tokens produce output tokens with verifiable on-chain proofs. This foundation remains unchanged from v0.6.3:

| Layer | Name | Purpose |
|-------|------|---------|
| **Peirce** | Logical Inference | Contract validates deterministic rules |
| **Tarski** | Material Reality | Token minting via HTS precompile |
| **Floridi** | Consensus/Meaning | HCS-backed provenance record |

The **Morpheme** compresses all three layers into a single cryptographic hash.

### 1.2 The v0.7 Change

**v0.6.3 (Current):**
- Rules are **hardcoded** in `ReasoningContract.sol` via `_mixAddDeterministic()`
- Contract knows the exact token combinations (RED+GREEN→YELLOW, etc.)
- Rule logic is embedded in bytecode

**v0.7 (Target):**
- Rules are **defined on HCS** as `RuleDef` messages
- Contract references rules by `ruleUri` + `ruleUriHash`
- Contract **does not read HCS** - it only logs hashes and validates invariants
- Off-chain scripts resolve, validate, and execute rules

```
┌─────────────────────────────────────────────────────────────────────┐
│                         v0.6.3 vs v0.7                              │
├─────────────────────────────────────────────────────────────────────┤
│  v0.6.3:  Contract executes hardcoded rule logic                    │
│           reasonAdd(proofHash, inputsHash, tokenA, tokenB, ...)     │
│                                                                      │
│  v0.7:    Contract logs rule reference, off-chain executes          │
│           prepareReasoning(ruleUri, ruleUriHash, inputsHash)        │
│           → off-chain: resolve ruleUri, validate, run inference     │
│           reason(ruleUri, ruleUriHash, inputsHash, outputsHash,     │
│                  bindingHash)                                       │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.3 Why This Change?

1. **Extensibility**: New rules can be added without contract redeployment
2. **Auditability**: Rule definitions are immutable HCS records, not bytecode
3. **Composability**: Rules from different spheres can be referenced
4. **Standards Alignment**: HCS-1/HCS-2/HCS-13 compatible

---

## 2. Entities

### 2.1 RuleDef

**Schema**: `hcs.ontologic.ruleDef@1`
**Storage**: RULE_DEFS_TOPIC (HCS-1 style)
**Purpose**: Immutable rule definition

A RuleDef describes:
- What inputs are required (token addresses)
- What output is produced
- Which contract/function enforces the rule
- Domain and operator semantics

```
RuleDef
├── Identity
│   ├── schema: "hcs.ontologic.ruleDef"
│   ├── schemaVersion: "1"
│   ├── ruleId: logical ID (sphere://demo/light/red-green-yellow)
│   ├── ruleUri: canonical HCS address (hcs://topicId/timestamp)
│   ├── version: "1.0.0"
│   └── versionNumber: 1
├── Semantics
│   ├── domain: "color.light"
│   ├── operator: "mix_add@v1"
│   ├── inputs: [{tokenSymbol, tokenId, tokenAddr}, ...]
│   └── output: {tokenSymbol, tokenId, tokenAddr}
├── Engine Binding
│   ├── engineType: "evm"
│   ├── contractAddress: 0x...
│   ├── functionSelector: 0xc687cfeb
│   └── engineCodeHash: 0x...
├── Meta
│   ├── createdAt: ISO timestamp
│   ├── author: AccountId or DID
│   └── status: "active" | "deprecated"
└── Anchors
    ├── ruleUriHash: sha256(ruleUri)
    └── contentHash: sha256(canonicalJSON)
```

### 2.2 RuleRegistryEntry

**Schema**: `hcs.ontologic.ruleRegistryEntry@1`
**Storage**: RULE_REGISTRY_TOPIC (HCS-2 style)
**Purpose**: Map logical ruleId → concrete ruleUri

```
RuleRegistryEntry
├── schema: "hcs.ontologic.ruleRegistryEntry"
├── schemaVersion: "1"
├── ruleId: logical ID
├── version: "1.0.0"
├── versionNumber: 1
├── ruleUri: hcs://topicId/timestamp
├── ruleUriHash: sha256(ruleUri)
├── status: "active" | "deprecated"
├── isLatest: boolean (only one true per ruleId)
└── supersededBy: optional ruleUri of newer version
```

### 2.3 MorphemeProof v0.7

**Schema**: `hcs.ontologic.morphemeProof@0.7`
**Storage**: PROOF_TOPIC (per ReasoningContract)
**Purpose**: Complete reasoning proof with rule reference

```
MorphemeProof v0.7
├── Schema
│   ├── schema: "hcs.ontologic.morphemeProof"
│   └── schemaVersion: "0.7"
├── Rule Reference
│   ├── ruleId: logical ID
│   ├── ruleUri: concrete HCS address
│   ├── ruleUriHash: sha256(ruleUri)
│   └── ruleSchemaRef: HCS-13 schema pointer
├── Triune Hashes
│   ├── inputsHash: keccak256(canonical inputs)
│   ├── outputsHash: keccak256(canonical outputs)
│   └── bindingHash: keccak256({ruleUri, inputsHash, outputsHash})
├── Contract Context
│   ├── reasoningContractId: Hedera ContractId
│   └── callerAccountId: AccountId
└── Timestamps
    └── createdAt: ISO timestamp (HCS consensus timestamp implicit)
```

---

## 3. Topics per Sphere

### 3.1 Local-First Architecture

Each "sphere" (user/project) deploys their own infrastructure:

```
┌─────────────────────────────────────────────────────────────────────┐
│                           SPHERE: demo                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────┐  ┌──────────────────────┐                 │
│  │   RULE_DEFS_TOPIC    │  │  RULE_REGISTRY_TOPIC │                 │
│  │   (HCS-1 style)      │  │   (HCS-2 style)      │                 │
│  │                      │  │                      │                 │
│  │  seq 1: RuleDef A    │  │  seq 1: Entry A→v1   │                 │
│  │  seq 2: RuleDef B    │  │  seq 2: Entry B→v1   │                 │
│  │  seq 3: RuleDef A'   │  │  seq 3: Entry A→v2   │                 │
│  │         (new ver)    │  │         (isLatest)   │                 │
│  └──────────────────────┘  └──────────────────────┘                 │
│                                                                      │
│  ┌──────────────────────┐  ┌──────────────────────┐                 │
│  │ ReasoningContractV07 │  │     PROOF_TOPIC      │                 │
│  │                      │  │   (per contract)     │                 │
│  │  prepareReasoning()  │  │                      │                 │
│  │  reason()            │──│  seq 1: Proof #1     │                 │
│  │                      │  │  seq 2: Proof #2     │                 │
│  └──────────────────────┘  └──────────────────────┘                 │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Topic Roles

| Topic | Purpose | Write Access | Read Access |
|-------|---------|--------------|-------------|
| **RULE_DEFS_TOPIC_ID** | Store RuleDef messages | Sphere owner | Anyone |
| **RULE_REGISTRY_TOPIC_ID** | Map ruleId → ruleUri | Sphere owner | Anyone |
| **PROOF_TOPIC_ID** | Store MorphemeProof messages | Contract caller | Anyone |

### 3.3 Environment Variables

```bash
# Sphere-specific topics (v0.7)
RULE_DEFS_TOPIC_ID=0.0.XXXXXX
RULE_REGISTRY_TOPIC_ID=0.0.XXXXXX
PROOF_TOPIC_ID=0.0.7239064  # May reuse existing HCS topic

# Contract (v0.7 instance)
CONTRACT_V07_ID=0.0.XXXXXX
CONTRACT_V07_ADDR=0x...
```

---

## 4. High-Level Flow

### 4.1 Rule Publication

```
┌─────────────────────────────────────────────────────────────────────┐
│                     publishRule Flow                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. Author creates RuleDef JSON (without ruleUri)                   │
│  2. Canonicalize JSON (RFC 8785)                                    │
│  3. Compute contentHash = sha256(canonical)                         │
│  4. Submit to RULE_DEFS_TOPIC → get consensusTimestamp              │
│  5. Compute ruleUri = hcs://<topicId>/<timestamp>                   │
│  6. Compute ruleUriHash = sha256(ruleUri)                           │
│  7. (Optional) Submit RuleRegistryEntry with isLatest=true          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 Rule Version Registration

```
┌─────────────────────────────────────────────────────────────────────┐
│                   registerRuleVersion Flow                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. Given: ruleId, version, ruleUri                                 │
│  2. Fetch RuleDef from ruleUri, verify hashes                       │
│  3. Create RuleRegistryEntry JSON                                   │
│  4. Set isLatest=true (update previous entry if needed)             │
│  5. Submit to RULE_REGISTRY_TOPIC                                   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.3 Reasoning Execution (v0.7)

```
┌─────────────────────────────────────────────────────────────────────┐
│                      v0.7 Reasoning Flow                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. Client: Resolve ruleId → ruleUri (via registry or direct)       │
│  2. Client: Fetch RuleDef from ruleUri, validate hashes             │
│  3. Client: Compute inputsHash from input tokens                    │
│  4. Client: Call prepareReasoning(ruleUri, ruleUriHash, inputsHash) │
│     └─→ Contract emits Prepared event                               │
│  5. Off-chain: Execute reasoning logic per RuleDef                  │
│  6. Client: Compute outputsHash, bindingHash                        │
│  7. Client: Call reason(ruleUri, ruleUriHash, inputsHash,           │
│                         outputsHash, bindingHash)                   │
│     └─→ Contract validates, mints token, emits Reasoned event       │
│  8. Client: Build MorphemeProof v0.7 payload                        │
│  9. Client: Submit to PROOF_TOPIC                                   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 5. Contract Interface Spec (Milestone 2)

### 5.1 ReasoningContractV07.sol

**Note**: This is a specification only. Implementation comes after documentation approval.

#### 5.1.1 prepareReasoning

```solidity
/// @notice Log intent to execute a rule (pre-flight check)
/// @param ruleUri The canonical HCS URI for the rule definition
/// @param ruleUriHash sha256(ruleUri) for verification
/// @param inputsHash Hash of canonical inputs
function prepareReasoning(
    string calldata ruleUri,
    bytes32 ruleUriHash,
    bytes32 inputsHash
) external;
```

**Contract Responsibilities:**
1. Verify `sha256(bytes(ruleUri)) == ruleUriHash`
2. Optionally validate `ruleUri` starts with `"hcs://"`
3. Emit `Prepared(ruleUri, ruleUriHash, inputsHash, msg.sender, block.timestamp)`

#### 5.1.2 reason

```solidity
/// @notice Execute reasoning and log complete proof
/// @param ruleUri The canonical HCS URI for the rule definition
/// @param ruleUriHash sha256(ruleUri) for verification
/// @param inputsHash Hash of canonical inputs
/// @param outputsHash Hash of canonical outputs
/// @param bindingHash Hash binding rule + inputs + outputs
function reason(
    string calldata ruleUri,
    bytes32 ruleUriHash,
    bytes32 inputsHash,
    bytes32 outputsHash,
    bytes32 bindingHash
) external returns (bool ok);
```

**Contract Responsibilities:**
1. Re-verify `sha256(bytes(ruleUri)) == ruleUriHash`
2. Optionally check `inputsHash` matches a previous `Prepared` event
3. Check replay protection: `require(!proofSeen[bindingHash])`
4. Mark as seen: `proofSeen[bindingHash] = true`
5. Emit `Reasoned(ruleUri, ruleUriHash, inputsHash, outputsHash, bindingHash, msg.sender, block.timestamp)`

#### 5.1.3 Storage Layout

```solidity
// Replay detection (reused from v0.6.3)
mapping(bytes32 => bool) public proofSeen;

// Optional: Track prepared inputs for strict pairing
mapping(bytes32 => bool) public preparedInputs;

// Version identifier
string public constant VERSION = "v0.7.0";
```

#### 5.1.4 Events

```solidity
event Prepared(
    string ruleUri,
    bytes32 indexed ruleUriHash,
    bytes32 indexed inputsHash,
    address indexed caller,
    uint256 timestamp
);

event Reasoned(
    string ruleUri,
    bytes32 indexed ruleUriHash,
    bytes32 indexed inputsHash,
    bytes32 outputsHash,
    bytes32 bindingHash,
    address indexed caller,
    uint256 timestamp
);
```

### 5.2 What the Contract Does NOT Do

The v0.7 contract is intentionally minimal:

| Capability | v0.6.3 | v0.7 |
|------------|--------|------|
| Read HCS messages | No | No |
| Query mirror nodes | No | No |
| Validate JSON schema | No | No |
| Execute rule logic | Yes (hardcoded) | No (off-chain) |
| Mint tokens | Yes (HTS precompile) | Yes (unchanged) |
| Log proof hashes | Yes | Yes (enhanced) |

---

## 6. Testing Strategy (Milestone 5)

### 6.1 Unit-Level Tests

**JSON Schema Validation:**
- Validate RuleDef against HCS-13 schema
- Validate RuleRegistryEntry against HCS-13 schema
- Validate MorphemeProof against HCS-13 schema

**Hash Computation:**
- `computeRuleUriHash(ruleUri)` returns correct sha256
- `computeContentHash(ruleDef)` returns correct sha256 of canonical JSON
- `computeBindingHash(ruleUri, inputsHash, outputsHash)` returns correct keccak256

### 6.2 Integration-Level Tests

**Rule Resolution:**
```javascript
// Given: ruleId = "sphere://demo/light/red-green-yellow"
// When: resolveLatestRule(ruleId)
// Then: returns valid RuleDef with correct hashes
```

**Dry-Run Reasoning:**
```javascript
// Given: RuleDef for RED+GREEN→YELLOW
// When: dryRunReason(inputs, ruleDef)
// Then: returns expected outputsHash
```

### 6.3 End-to-End Scenario

Recreate the four canonical proofs using v0.7 flow:

1. **Peirce Layer (3 proofs):**
   - RED+GREEN→YELLOW via `sphere://demo/light/red-green-yellow`
   - GREEN+BLUE→CYAN via `sphere://demo/light/green-blue-cyan`
   - RED+BLUE→MAGENTA via `sphere://demo/light/red-blue-magenta`

2. **Floridi Layer (1 proof):**
   - WHITE entity via `sphere://demo/entity/white-from-cmy`

**Verification Checklist:**
- [ ] RuleDef messages exist on RULE_DEFS_TOPIC
- [ ] RuleRegistryEntry records exist on RULE_REGISTRY_TOPIC
- [ ] MorphemeProof messages exist on PROOF_TOPIC
- [ ] ReasoningContract events match HCS payloads
- [ ] All hashes cross-validate

### 6.4 Offline Verification

An auditor with only:
- Snapshot of RULE_DEFS_TOPIC
- Snapshot of RULE_REGISTRY_TOPIC
- Snapshot of PROOF_TOPIC
- Contract logs (via mirror node)
- Engine code hash

Can recompute and verify all morphemes:

```
1. For each MorphemeProof in PROOF_TOPIC:
   a. Fetch RuleDef from ruleUri
   b. Verify ruleUriHash == sha256(ruleUri)
   c. Verify contentHash == sha256(canonical RuleDef)
   d. Verify bindingHash == keccak256(ruleUri, inputsHash, outputsHash)
   e. Match contract logs for same bindingHash
   f. Confirm token mint event exists
```

---

## 7. Migration from v0.6.3

### 7.1 Strategy

v0.6.3 remains the **frozen hackathon demo**. v0.7 is built **alongside**, not replacing it.

| Aspect | v0.6.3 | v0.7 |
|--------|--------|------|
| Contract | 0.0.7261322 | New deployment |
| HCS Topic | 0.0.7239064 | New topics (may share PROOF_TOPIC) |
| Rules | Hardcoded | HCS-based |
| Tokens | Existing (RED, GREEN, etc.) | Reuse same tokens |

### 7.2 Rule Migration

For each hardcoded rule in v0.6.3, create a RuleDef referencing the same semantics:

| v0.6.3 Rule | v0.7 ruleId |
|-------------|-------------|
| RED+GREEN→YELLOW | `sphere://demo/light/red-green-yellow` |
| GREEN+BLUE→CYAN | `sphere://demo/light/green-blue-cyan` |
| RED+BLUE→MAGENTA | `sphere://demo/light/red-blue-magenta` |
| WHITE entity | `sphere://demo/entity/white-from-cmy` |

### 7.3 Backward Compatibility

- v0.6.3 proofs (HCS Seq 33-42) remain valid historical records
- v0.7 proofs will have new sequence numbers
- Both can coexist on the same HCS topic if desired

---

## 8. Reference Links

**v0.6.3 (Frozen):**
- [architecture.md](architecture.md) - v0.6.3 architecture
- [DEMO_SNAPSHOT_V063.md](../DEMO_SNAPSHOT_V063.md) - Canonical demo reference

**v0.7 Specs:**
- [rule-registry-v07.md](rule-registry-v07.md) - Complete rule registry specification
  - Section 10: Concrete JSON examples for RuleDef, RuleRegistryEntry, MorphemeProof
  - Section 11: Resolution algorithms (ruleUri → RuleDef, ruleId + "latest" → ruleUri)
  - Section 12: Client workflow specifications
  - Section 13: Migration strategy from v0.6.3

**Hedera Standards:**
- [HCS-1](https://hips.hedera.com/hip/hip-1) - Topic creation
- [HCS-2](https://github.com/hashgraph/hedera-improvement-proposal) - Topic registries
- [HCS-13](https://github.com/hashgraph/hedera-improvement-proposal) - Schema references

---

**Document Status**: DRAFT - Milestone 1 (Spec Only)
**Last Updated**: 2025-02-16
**Version**: v0.7.0
