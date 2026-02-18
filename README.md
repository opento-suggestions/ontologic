# Ontologic v0.7 蜕變 :: The Glass Box Protocol

**Triune Proof-of-Reasoning on Hedera (HTS + HCS + Smart Contracts)**

<案 **Demo Website**: [https://ontologic-uv6.caffeine.xyz/](https://ontologic-uv6.caffeine.xyz/)
<案 **Primary Webpage**: [https://ontologic.dev/](https://ontologic.dev/)

---

## 河 What Ontologic Is

Ontologic turns AI/agentic reasoning from a **black box** into a **glass box** by producing verifiable, on-chain proofs of *why* a system made a decision.

Each proof compresses:

1. **Logic** (Peirce)
2. **Material consequence** (Tarski)
3. **Meaning / attestation** (Floridi)

into a **single cryptographic artifact** called a **morpheme**.

This morpheme is independently verifiable across:

* A Hedera **smart contract** (ReasoningContractV07)
* A Hedera **token state change** (HTS mint)
* A Hedera **consensus record** (HCS proof anchor)

This repo demonstrates the entire flow end-to-end.

---

## 蛻 What's New in v0.7

**The Rule Registry Architecture** 規則登記

v0.7 introduces **HCS-referenced rules** — rules are no longer hardcoded in the contract but stored as JSON documents on HCS topics, resolved by URI:

```
sphere://demo/light/red-green-yellow  →  hcs://0.0.7972919/1771435238.311281000
```

**Key Concepts:**

| 概念 | Concept | Description |
|------|---------|-------------|
| 球體 | **Sphere** | A deployment unit: 3 HCS topics + 1 contract |
| 規則 | **RuleDef** | Rule definition stored on RULE_DEFS_TOPIC |
| 登記 | **Registry** | ruleId → ruleUri mapping on RULE_REGISTRY_TOPIC |
| 證明 | **MorphemeProof** | v0.7 proof anchored to PROOF_TOPIC |

**Flow:**
```
publish_rule.js  →  RuleDef on HCS  →  ruleUri
register_rule.js →  RuleRegistryEntry on HCS
reason.js        →  resolve(ruleId) → contract call → MorphemeProof on HCS
```

---

## <根 Live On-Testnet

### 新 v0.7 Sphere "demo" (Active)

**Contract:** `0.0.7972924`
[https://hashscan.io/testnet/contract/0.0.7972924](https://hashscan.io/testnet/contract/0.0.7972924)

**HCS Topics:**
| Topic | ID | Purpose |
|-------|-----|---------|
| RULE_DEFS | `0.0.7972919` | RuleDef JSON storage |
| RULE_REGISTRY | `0.0.7972920` | ruleId → ruleUri mappings |
| PROOF | `0.0.7972921` | MorphemeProof v0.7 anchors |

**Code Hash:** `0xafdbdd...`

### 舊 v0.6.3 Legacy (Frozen)

**Contract:** `0.0.7261322`
[https://hashscan.io/testnet/contract/0.0.7261322](https://hashscan.io/testnet/contract/0.0.7261322)

**HCS Topic:** `0.0.7239064`
[https://hashscan.io/testnet/topic/0.0.7239064](https://hashscan.io/testnet/topic/0.0.7239064)

---

## <單位 Token System (HTS)

### 原色 RGB (axioms)

* RED  `0.0.7247682`
* GREEN  `0.0.7247683`
* BLUE  `0.0.7247684`

### 混色 CMY (reasoned results)

* YELLOW  `0.0.7247769`
* CYAN  `0.0.7247778`
* MAGENTA  `0.0.7247782`

### 裁決 Entity Verdict

* WHITE  `0.0.7261514`
* BLACK  `0.0.7261515`

---

## 何 Installation

```bash
npm install
cp .env.example .env
```

Set your operator account + private key in `.env`.

---

## 示範 Run the v0.7 Demo

### 創建 1. Create a Sphere (already done for "demo")

```bash
node scripts/v0.7/create_sphere.js demo
```

Creates 3 HCS topics + deploys ReasoningContractV07.

### 發布 2. Publish Rules to HCS

```bash
node scripts/v0.7/publish_rule.js examples/v07/ruleDef-red-green-yellow.json --register
node scripts/v0.7/publish_rule.js examples/v07/ruleDef-green-blue-cyan.json --register
node scripts/v0.7/publish_rule.js examples/v07/ruleDef-red-blue-magenta.json --register
```

Each command:
* Posts RuleDef JSON to RULE_DEFS_TOPIC
* Creates RuleRegistryEntry on RULE_REGISTRY_TOPIC
* Returns a `ruleUri` for reasoning

### 推理 3. Execute Reasoning

```bash
node scripts/v0.7/reason.js examples/v07/bundle-red-green-yellow.json
node scripts/v0.7/reason.js examples/v07/bundle-green-blue-cyan.json
node scripts/v0.7/reason.js examples/v07/bundle-red-blue-magenta.json
```

Each proof:
* Resolves `ruleId` → `ruleUri` via registry
* Calls `prepareReasoning()` on contract
* Calls `reasonWithMint()` → mints CMY token
* Submits MorphemeProof v0.7 to PROOF_TOPIC

### 驗證 4. Verify Proofs

Check HashScan for:
* Contract events: [0.0.7972924](https://hashscan.io/testnet/contract/0.0.7972924)
* HCS messages: [0.0.7972921](https://hashscan.io/testnet/topic/0.0.7972921)

---

## 舊版 Run Legacy v0.6.3 Demo

The frozen v0.6.3 examples remain in `examples/mvp/final/`:

```bash
node scripts/v0.6.3/reason.js examples/mvp/final/red-green-yellow.json
node scripts/v0.6.3/entity-v06.js examples/mvp/final/entity-white-light.json
```

Note: v0.6.3 contract no longer holds supply keys for CMY tokens (migrated to v0.7).

---

## 形態素 Morpheme: The Proof Compression Unit

Ontologic compresses:

* `ruleUri` (HCS-referenced rule)
* `ruleUriHash` (SHA256 of URI)
* `inputsHash` (keccak256 of inputs)
* `outputsHash` (keccak256 of outputs)
* `bindingHash` (unique proof identifier)

into:

```
MorphemeProof v0.7 = {
  ruleUri, ruleUriHash, inputsHash, outputsHash, bindingHash,
  reasoningContractId, callerAccountId, transactionId
}
```

This is the "TCP/IP for reasoning provenance" moment 地址證明
a **single hash** representing a **complete, verifiable thought**.

---

## 架構 v0.7 Architecture

### Three-Layer Provenance

```
Layer 1: CONTRACTCALL  →  Validates hashes, emits Reasoned event
Layer 2: TOKENMINT     →  HTS precompile mints output token
Layer 3: HCS MESSAGE   →  MorphemeProof anchored to PROOF_TOPIC
```

### HCS Topic Architecture

```
RULE_DEFS_TOPIC      →  RuleDef JSON (rule definitions)
RULE_REGISTRY_TOPIC  →  RuleRegistryEntry (ruleId → ruleUri)
PROOF_TOPIC          →  MorphemeProof (reasoning proofs)
```

### Resolution Flow 解析

```
ruleId: "sphere://demo/light/red-green-yellow"
    ↓
Registry lookup (scan RULE_REGISTRY_TOPIC for ruleId)
    ↓
ruleUri: "hcs://0.0.7972919/1771435238.311281000"
    ↓
Mirror node fetch → RuleDef JSON
    ↓
Contract execution with ruleUri + hashes
```

Full explanation: [`docs/architecture-v07.md`](docs/architecture-v07.md)

---

## 可验证的 Project Structure

```
contracts/
├── ReasoningContractV07.sol    # v0.7 contract (active)
└── ReasoningContract.sol       # v0.6.3 contract (frozen)

scripts/
├── v0.7/
│   ├── create_sphere.js        # Deploy sphere infrastructure
│   ├── publish_rule.js         # Post RuleDef to HCS
│   ├── register_rule_version.js
│   ├── reason.js               # Execute v0.7 reasoning
│   ├── migrate-supply-keys-v07.js
│   └── lib/
│       ├── resolve.js          # ruleUri resolution
│       └── sphere-config.js    # Sphere config management
└── v0.6.3/                     # Legacy scripts (frozen)

examples/
├── v07/                        # v0.7 RuleDefs and bundles
└── mvp/final/                  # v0.6.3 frozen bundles

docs/
├── architecture-v07.md         # v0.7 architecture
├── rule-registry-v07.md        # Rule registry spec
└── architecture.md             # v0.6.3 architecture (frozen)
```

---

## 想法的 Roadmap

* ~~v0.7  Rule registry activation~~ ✅ **COMPLETE**
* v0.8  Multi-domain reasoning + subtractive "paint" model
* v0.9  Secure element (SE) signatures for silicon-layer proofs
* v1.0  Ontologic SDK & hsphere.execute() abstraction

---

## 单个哈 License

Apache 2.0

---

## 希值 Acknowledgments

Built for the Hedera Ascension Hackathon 2025. Copyright Ontologic, Open To Suggestions Media.
Open-sourced. Apache 2.0 license. Because it is better to give than to receive.

Uses HTS, HCS, Smart Contracts 2.0, and Hedera's low-latency consensus.

Grateful to all of the assistance I received throughout this process, my wife Melanie, my parents, my sister, friends and family, as well as agentic and otherwise. I express gratitude.

---

## 變化 Changelog

### v0.7.0 (2026-02-18) 蜕變

* **Rule Registry Architecture**: Rules stored on HCS, referenced by URI
* **Sphere Concept**: Deployment unit with 3 topics + 1 contract
* **New Contract**: ReasoningContractV07 with `prepareReasoning()`, `reason()`, `reasonWithMint()`
* **Resolution Algorithms**: ruleId → ruleUri → RuleDef
* **Supply Key Migration**: CMY tokens now minted by v0.7 contract

### v0.6.3 (2025-11-15)

* Hackathon demo release
* Triune architecture proven (Peirce + Tarski + Floridi)
* Entity attestation with evidence validation
