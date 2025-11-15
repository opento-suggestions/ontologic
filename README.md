# Ontologic v0.6.3  The Glass Box Protocol

**Triune Proof-of-Reasoning on Hedera (HTS + HCS + Smart Contracts)**

< **Website**: [https://ontologic-uv6.caffeine.xyz/](https://ontologic-uv6.caffeine.xyz/)

---

## P What Ontologic Is

Ontologic turns AI/agentic reasoning from a **black box** into a **glass box** by producing verifiable, on-chain proofs of *why* a system made a decision.

Each proof compresses:

1. **Logic** (Peirce)
2. **Material consequence** (Tarski)
3. **Meaning / attestation** (Floridi)

into a **single cryptographic artifact** called a **morpheme**.

This morpheme is independently verifiable across:

* A Hedera **smart contract** (ReasoningContract v0.6.3)
* A Hedera **token state change** (HTS mint)
* A Hedera **consensus record** (HCS manifest)

This repo demonstrates the entire flow end-to-end.

---

## <Û Live On-Testnet

**Contract:** `0.0.7261322`
[https://hashscan.io/testnet/contract/0.0.7261322](https://hashscan.io/testnet/contract/0.0.7261322)

**HCS Topic:** `0.0.7239064`
[https://hashscan.io/testnet/topic/0.0.7239064](https://hashscan.io/testnet/topic/0.0.7239064)

**Version:** `v0.6.3` (Frozen)
All canonical artifacts: [`CANONICAL_ARTIFACTS.md`](CANONICAL_ARTIFACTS.md)

---

## <¨ Token System (HTS)

### RGB (axioms)

* RED  `0.0.7247682`
* GREEN  `0.0.7247683`
* BLUE  `0.0.7247684`

### CMY (reasoned results)

* YELLOW  `0.0.7247769`
* CYAN  `0.0.7247778`
* MAGENTA  `0.0.7247782`

### Entity Verdict

* WHITE  `0.0.7261514`

---

## =' Installation

```bash
npm install
cp .env.example .env
```

Set your operator account + private key in `.env`.

---

## =€ Run the Demo Proofs

Ontologic includes frozen example bundles in:

```
examples/mvp/final/
```

### 1. Run additive (Peirce/Tarski) proofs

```bash
node scripts/reason.js examples/mvp/final/red-green-yellow.json
node scripts/reason.js examples/mvp/final/green-blue-cyan.json
node scripts/reason.js examples/mvp/final/red-blue-magenta.json
```

Each proof:

* Executes `reasonAdd()` on contract `0.0.7261322`
* Mints the correct CMY token (HTS)
* Publishes manifest to HCS topic `0.0.7239064`
* Produces a morpheme (`proofHash`)

### 2. Run entity attestation (Floridi)

```bash
node scripts/entity-v06.js examples/mvp/final/entity-white-light.json
```

This verifies:

* 3 CMY proofs exist
* Evidence hashes match
* WHITE is attested in LIGHT domain
* Manifest is anchored in HCS

### 3. Validate entire system

```bash
node scripts/validate-light-e2e-v063.js
```

---

## = Morpheme: The Proof Compression Unit

Ontologic compresses:

* `ruleHash` (semantic rule identity)
* `inputsHash` (materials)
* `factHash` (result)
* `canonicalUri` (HCS manifest)

into:

```
proofHash = keccak256(...)
```

This is the "TCP/IP for reasoning provenance" moment 
a **single hash** representing a **complete, verifiable thought**.

---

## =æ Canonical "Bytes Used in Demo"

All demo proofs (HCS sequences 3942) + hashes:
See: [`DEMO_SNAPSHOT_V063.md`](DEMO_SNAPSHOT_V063.md)

---

## = v0.6.3 Architecture

Full explanation of:

* Peirce ’ Tarski ’ Floridi layers
* How morphemes work
* Contract internals
* Token flow
* Consensus anchoring

See: [`docs/architecture.md`](docs/architecture.md)

---

## =Ã Project Structure

```
contracts/                 ReasoningContract v0.6.3
scripts/                   Proof executors + entity logic
examples/mvp/final/        Frozen bundles used in demo
docs/                      Architecture + judge card
archive/                   All legacy material
```

---

## >í Roadmap (Post-hackathon)

* v0.7  Rule registry activation & proxy-pattern migration
* v0.8  Multi-domain reasoning + subtractive "paint" model
* v0.9  Secure element (SE) signatures for silicon-layer proofs
* v1.0  Ontologic SDK & hsphere.execute() abstraction

---

## =Ü License

Apache 2.0

---

## =O Acknowledgments

Built for the Hedera Ascension Hackathon 2025. Copyright Ontologic, Open To Suggestions Media.
Open-sourced. Apache 2.0 license. Because it is better to give than to receive.

Uses HTS, HCS, Smart Contracts 2.0, and Hedera's low-latency consensus.

Grateful to all of the assistance I received throughout this process, my wife Melanie, my parents, my sister, friends and family, as well as agentic and otherwise. I express gratitude.
