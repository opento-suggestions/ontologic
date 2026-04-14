# Ontologic 本體 :: The Glass Box Protocol

**Proof-of-Reasoning on Hedera**

---

## 拆 What Is Decomposition?

The Cangjie input method decomposes every Chinese character into a sequence of structural radicals. No matter how complex the character, it reduces to a combination of irreducible components. The decomposition is deterministic — the same character always produces the same radical sequence — and reversible — the radicals reconstruct the original character without loss.

Ontologic does for reasoning what Cangjie does for characters. Every act of reasoning — no matter how complex — decomposes into four structural primitives: what rule was applied, what was given, what was produced, and the cryptographic binding that proves the relationship holds. This decomposition is the **morpheme**: the smallest unit of verifiable thought.

---

## 形態素 The Morpheme: RIOM

A morpheme is a four-component structure called **RIOM**:

- **R** — Rule (`ruleUriHash`): What logic was applied
- **I** — Inputs (`inputsHash`): What was given
- **O** — Outputs (`outputsHash`): What was produced
- **M** — Meaning (`bindingHash`): The cryptographic binding that proves the relationship

These four components are **irreducibly bound** — like quaternion components, decomposing them loses information. This is why the protocol uses four hashes rather than collapsing to fewer. Remove any one and the proof is incomplete. Tamper with any one and the binding invalidates.

A log records *what happened*. A morpheme proves *why* — and the proof is cryptographically bound so tightly that altering any component destroys the whole.

Every morpheme is anchored to three independent verification surfaces: a smart contract, a token state change, and a consensus record. This is the triune proof.

---

## 三證 Triune Proof Architecture

Every proof must answer three epistemic questions. Each question maps to a philosopher, a verification layer, and a Hedera primitive:

| Question | Philosopher | Layer | Hedera Primitive |
|----------|-------------|-------|-----------------|
| Was the reasoning valid? | **Peirce** (Logic) | Contract call / hash validation | Smart Contract |
| Did reality change? | **Tarski** (Material) | Token mint or metadata attestation | HTS |
| Is the proof anchored in consensus? | **Floridi** (Meaning) | Proof message on consensus topic | HCS |

All three must fire. This is not optional layering — it is structural completeness. A proof that validates logic but doesn't change state is an assertion. A proof that changes state without consensus is a unilateral act. A proof that achieves consensus without logic is noise. The triune proof is the minimum complete unit.

### Two Proof Topologies

The three layers fire in both proof modes. The difference is how Tarski (material attestation) is expressed:

**ContractProof** — Tarski as creation:
```
resolve rule → prepareReasoning() → reasonWithMint()    → HCS anchor       → metadata stamp
                Peirce (logic)       Tarski (creation)     Floridi (meaning)  Tarski (alteration)
```
The contract validates hashes, mints a new token, anchors the proof to consensus, and stamps the output token's metadata. Used when reasoning *produces* something that didn't exist before.

**RegistryProof** — Tarski as alteration:
```
resolve rule → compute hashes    → HCS anchor       → metadata stamp
                Peirce (logic)     Floridi (meaning)  Tarski (alteration)
```
Hashes are computed locally, the proof is anchored to consensus, and the output token's metadata is updated. No contract interaction. No minting. Used when reasoning *transforms the epistemic status* of something that already exists.

Both topologies are three-layer. Both are complete. The `proofMode` field in the MorphemeProof (`"contract"` or `"registry"`) tells verifiers which audit trail to follow — it is a routing signal for *how* to verify, not *what* to verify.

**Critical invariant**: Both modes produce identical `proofHash` values for identical RIOM inputs. The proof mode is a deployment choice, not a semantic one.

**Hard invariant**: HCS anchor lands BEFORE metadata stamp. Always. If the stamp fails, the proof still exists on consensus and the stamp can be retried. Reversing this order risks a stamped token with no consensus anchor — a dangling attestation.

---

## 色域 The Color Domain

Ontologic uses color theory as its reference domain because color has two contradictory physics — additive (light) and subtractive (paint) — operating on the same objects. If the protocol can prove reasoning across both domains while preserving the identity of each object, it can prove reasoning in any domain.

### Token Taxonomy

| Token | Type | Role |
|-------|------|------|
| RED, GREEN, BLUE | Axiom | Primary inputs — operator-controlled, 1M supply |
| YELLOW, CYAN, MAGENTA | Reasoned | Secondary outputs — contract-minted via proof |
| WHITE | Entity verdict | Additive completeness (all light combined) |
| BLACK | Entity verdict | Subtractive completeness (pigment saturation) |

### Two Domains, One Token Set

| Domain | Physics | Rule Family | Primaries → Secondaries | Entity |
|--------|---------|-------------|------------------------|--------|
| `color.light` | Additive light mixing | `mix_add@v1` | RGB → CMY | WHITE |
| `color.paint` | Subtractive pigment mixing | `mix_add@v1` | CMY → RGB | BLACK |

The operator name `mix_add@v1` is used in both domains — it describes the *operation* (combining inputs), not the color model. The `domain` field in the RuleDef distinguishes the physics.

### Proof Flow

```
1. publish_rule.js  →  RuleDef JSON posted to RULE_DEFS topic
                       Returns: ruleUri (hcs://topicId/timestamp)

2. --register       →  RuleRegistryEntry posted to RULE_REGISTRY topic
                       Maps: ruleId → ruleUri

3. reason.js        →  Resolve ruleId to ruleUri via registry
   (ContractProof)     Call prepareReasoning() + reasonWithMint()
                       Submit MorphemeProof to PROOF topic
                       Stamp output token metadata

   reason-registry.js  →  Resolve ruleId to ruleUri via registry
   (RegistryProof)        Compute hashes locally
                          Submit MorphemeProof to PROOF topic
                          Stamp output token metadata
```

---

## 經 The Object Moves Through Reasoning

When a proof completes, the output token's metadata is updated with a provenance commitment — a compact hash chain that accumulates every proof the token has participated in:

```json
{"n":3,"root":"0x<keccak256 hash chain>"}
```

Each stamp computes: `newRoot = keccak256(previousRoot + keccak256(canonicalize(entry)))`

The full provenance history lives on HCS (in the MorphemeProof messages on the PROOF topic). The token metadata commits to that history without storing it — a verifiable fingerprint. Reconstruct from HCS, recompute the chain, and the root must match.

This is what distinguishes Ontologic from every logging system. A log is a record attached to a process. A provenance commitment is a mark left *on the object itself*. The BLUE token doesn't just know it was produced by mixing cyan and magenta pigment — that proof is cryptographically inscribed in its on-chain state. The token is physically different after reasoning than before.

The object moves through the act of reasoning. Each proof is a passage through a domain. The metadata accumulates — never replaces — because replacing erases epistemic history, which is antithetical to attestation.

---

## 根 Live Deployment

### 新 Sphere "v08" (Active)

**Contract:** `0.0.8641949`
[https://hashscan.io/testnet/contract/0.0.8641949](https://hashscan.io/testnet/contract/0.0.8641949)

**Operator:** `0.0.8641261`

**HCS Topics:**
| Topic | ID | Content |
|-------|-----|---------|
| RULE_DEFS | `0.0.8641938` | 8 RuleDef JSONs |
| RULE_REGISTRY | `0.0.8641941` | 8 ruleId → ruleUri mappings |
| PROOF | `0.0.8641943` | 8 MorphemeProof v0.8 anchors (Seq 18-25) |

**Executed Proofs:**

| # | Mode | Rule | Output | HCS Seq |
|---|------|------|--------|---------|
| 1 | ContractProof | R+G→YELLOW | Minted | 18 |
| 2 | ContractProof | G+B→CYAN | Minted | 19 |
| 3 | ContractProof | R+B→MAGENTA | Minted | 20 |
| 4 | RegistryProof | C+M→BLUE | Stamped | 21 |
| 5 | RegistryProof | C+Y→GREEN | Stamped | 22 |
| 6 | RegistryProof | M+Y→RED | Stamped | 23 |
| 7 | ContractProof | CMY→WHITE | Minted | 24 |
| 8 | RegistryProof | RGB→BLACK | Stamped | 25 |

### 舊 Legacy (Frozen)

**v0.7 Sphere "demo":** `config.sphere-demo-legacy.json` (contract `0.0.7972924`)
**v0.6.3 Contract:** `0.0.7261322` — Hedera Ascension Hackathon 2025

---

## 單位 Token System

All 9 tokens carry **metadata keys** (HIP-646/657/1028) held by the operator, enabling provenance stamping regardless of proof mode.

| Token | ID | Supply Key | Metadata Key |
|-------|-----|------------|-------------|
| RED | `0.0.8641312` | Operator | Operator |
| GREEN | `0.0.8641314` | Operator | Operator |
| BLUE | `0.0.8641316` | Operator | Operator |
| YELLOW | `0.0.8641318` | Contract | Operator |
| CYAN | `0.0.8641320` | Contract | Operator |
| MAGENTA | `0.0.8641322` | Contract | Operator |
| WHITE | `0.0.8641323` | Contract | Operator |
| BLACK | `0.0.8641324` | Contract | Operator |
| PURPLE | `0.0.8641325` | Contract | Operator |

---

## 何 Installation

```bash
cd ontologic
npm install
cp .env.example .env
```

Set your operator account + private key in `.env`. Scripts load configuration via `scripts/v0.6.3/lib/config.js`.

Sphere-specific config lives in `config.sphere-<name>.json` (topic IDs, contract ID, code hash).

**SDK**: `@hiero-ledger/sdk` v2.82+ (Hiero, Linux Foundation Decentralized Trust). Aliased as `@hashgraph/sdk` in `package.json` for import compatibility.

---

## 示範 Running Proofs

### Batch Publish All Rules

```bash
node scripts/v0.7.1/publish-all-rules.js --sphere v08
```

Publishes and registers all 8 rules (4 light + 4 paint) in one run.

### End-to-End Smoke Test

```bash
node scripts/v0.7.1/smoke-test-e2e.js --sphere v08
```

Executes all 8 proofs across both modes:
- Phase 1: ContractProof — R+G→Y, G+B→C, R+B→M (mint + HCS + metadata)
- Phase 2: RegistryProof — C+M→B, C+Y→G, M+Y→R (HCS + metadata, no mint)
- Phase 3: Entity attestations — WHITE (ContractProof) + BLACK (RegistryProof)
- Phase 4: Metadata verification on all tokens

### Individual Proofs

```bash
# ContractProof (light domain)
node scripts/v0.7/reason.js examples/v07/bundle-red-green-yellow.json --sphere v08

# RegistryProof (paint domain)
node scripts/v0.7.1/reason-registry.js examples/v07/bundle-cyan-magenta-blue.json --sphere v08

# Dry run (no on-chain transactions)
node scripts/v0.7/reason.js examples/v07/bundle-red-green-yellow.json --sphere v08 --dry-run
```

### Infrastructure

```bash
# Create a new sphere (3 HCS topics + 1 contract)
node scripts/v0.7/create_sphere.js <sphereName>

# Migrate supply keys to contract
node scripts/v0.7/migrate-supply-keys-v07.js --sphere <name>

# Reformation (new operator + tokens with metadata keys)
node scripts/v0.7.1/create-operator.js
node scripts/v0.7.1/create-tokens.js
node scripts/v0.7.1/verify-reformation.js --sphere v08
```

---

## 架構 Architecture

### Hash Functions

| Hash | Algorithm | Purpose |
|------|-----------|---------|
| `ruleUriHash` | **SHA256** | URI identity |
| `inputsHash` | **keccak256** | Canonical inputs |
| `outputsHash` | **keccak256** | Canonical outputs |
| `bindingHash` | **keccak256** | Proof identity |
| `contentHash` | **keccak256** | RuleDef integrity |

SHA256 vs keccak256 confusion produces silent, catastrophic failures. `ruleUriHash` is SHA256 because the contract uses `sha256()` in Solidity. Everything else is keccak256.

JSON canonicalization follows RFC 8785 subset: deterministic key ordering, no whitespace, standard number serialization.

### Contract Interface (ReasoningContractV07.sol)

```solidity
function prepareReasoning(string ruleUri, bytes32 ruleUriHash, bytes32 inputsHash) external;
function reason(string ruleUri, bytes32 ruleUriHash, bytes32 inputsHash, bytes32 outputsHash, bytes32 bindingHash) external returns (bool);
function reasonWithMint(..., address outputToken, uint64 amount) external returns (bool);
```

Replay protection: `proofSeen[bindingHash]` mapping. Duplicate proofs emit `ProofReplay` instead of `Reasoned`.

### MorphemeProof v0.8 Schema

```json
{
  "schema": "hcs.ontologic.morphemeProof",
  "schemaVersion": "0.8",
  "proofMode": "contract | registry",
  "ruleId": "sphere://demo/light/red-green-yellow",
  "ruleUri": "hcs://0.0.8641938/...",
  "ruleUriHash": "0x...",
  "inputsHash": "0x...",
  "outputsHash": "0x...",
  "bindingHash": "0x...",
  "reasoningContractId": "0.0.8641949 | null",
  "callerAccountId": "0.0.8641261",
  "transactionId": "... | null",
  "createdAt": "..."
}
```

`reasoningContractId` and `transactionId` are null for RegistryProof. `proofMode` is the routing signal.

### Spheres

A **sphere** is a deployment unit: 3 HCS topics (RULE_DEFS, RULE_REGISTRY, PROOF) + 1 contract instance + config file. Rules are stored as JSON on HCS and resolved by URI. See `docs/architecture-v07.md` and `docs/rule-registry-v07.md`.

---

## 想法 Roadmap

* ~~v0.6.3  Ascension Hackathon — triune architecture proven~~ COMPLETE
* ~~v0.7  Rule Registry, sphere architecture, supply key migration~~ COMPLETE
* ~~v0.8  Dual proof modes, paint domain, metadata provenance~~ COMPLETE
* v0.9  Secure element (SE) signatures for silicon-layer proofs
* v1.0  Ontologic SDK & hsphere.execute() abstraction

---

## 可验证 Project Structure

```
contracts/
├── ReasoningContractV07.sol       # Active contract (v0.7+)
└── ReasoningContract.sol          # v0.6.3 (frozen)

scripts/
├── v0.7/
│   ├── create_sphere.js           # Deploy sphere infrastructure
│   ├── publish_rule.js            # Post RuleDef to HCS
│   ├── reason.js                  # ContractProof execution
│   ├── migrate-supply-keys-v07.js
│   └── lib/
│       ├── resolve.js             # ruleUri resolution + chunking
│       └── sphere-config.js       # Sphere config CRUD
├── v0.7.1/
│   ├── reason-registry.js         # RegistryProof execution
│   ├── publish-all-rules.js       # Batch rule publisher
│   ├── smoke-test-e2e.js          # End-to-end dual-mode test
│   ├── create-operator.js         # New operator account
│   ├── create-tokens.js           # 9 tokens with metadata keys
│   ├── verify-reformation.js      # Mirror node verification
│   └── lib/
│       └── metadata.js            # Provenance stamp utilities
└── v0.6.3/                        # Legacy scripts (frozen)

examples/v07/                      # 8 RuleDefs + 8 bundles
docs/                              # Architecture specs
```

---

## 单哈 License

Apache 2.0

---

## 恩 Acknowledgments

Built for the Hedera Ascension Hackathon 2025. Copyright Ontologic, Open To Suggestions Media.
Open-sourced. Apache 2.0 license. Because it is better to give than to receive.

Uses HTS, HCS, Smart Contracts 2.0, and Hedera's low-latency consensus.
SDK: `@hiero-ledger/sdk` (Linux Foundation Decentralized Trust).

Grateful to all of the assistance I received throughout this process, my wife Melanie, my parents, my sister, friends and family, as well as agentic and otherwise. I express gratitude.

---

## 變化 Changelog

### v0.8.0 (2026-04-14)

* **Dual Proof Mode**: ContractProof (creation) + RegistryProof (alteration) — same proofHash invariant
* **Subtractive Paint Domain**: 4 paint rules (C+M→B, C+Y→G, M+Y→R, CMY→K)
* **Provenance Commitment**: Hash chain on token metadata (HIP-646/657/1028)
* **Infrastructure Reformation**: New operator, 9 tokens with metadata keys, Hiero SDK migration
* **End-to-End Smoke Test**: 8 proofs across both modes in single orchestrated run

### v0.7.0 (2026-02-18) 蜕變

* Rule Registry Architecture: rules stored on HCS, referenced by URI
* Sphere concept: deployment unit with 3 topics + 1 contract
* New contract: ReasoningContractV07 with `prepareReasoning()`, `reason()`, `reasonWithMint()`
* Supply key migration from v0.6.3

### v0.6.3 (2025-11-15)

* Hedera Ascension Hackathon demo release
* Triune architecture proven (Peirce + Tarski + Floridi)
* Entity attestation with evidence validation
