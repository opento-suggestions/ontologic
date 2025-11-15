Ontologic – Proof-of-Reasoning Demo (v0.6.3)

Hedera Ascension Hackathon — Final Judge Reference (2025-11-15)

✅ What Ontologic Demonstrates

Ontologic shows verifiable reasoning on-chain using Hedera Smart Contracts + HCS + HTS.

Every proof compresses logic → reality → meaning into a single cryptographic hash, called a morpheme.

This morpheme is independently verifiable across:

Contract logic (Peirce)

Token state changes (Tarski)

Consensus manifests (Floridi)

🏛 Core Contract

ReasoningContract v0.6.3
Contract ID: 0.0.7261322
EVM: 0x00000000000000000000000000000000006ecc8a
HashScan: https://hashscan.io/testnet/contract/0.0.7261322

HCS Topic: 0.0.7239064
https://hashscan.io/testnet/topic/0.0.7239064

Everything you see in the demo video and examples happens on this live contract.

🎨 Token System (HTS)
RGB (axioms)

RED — 0.0.7247682

GREEN — 0.0.7247683

BLUE — 0.0.7247684

CMY (reasoned proofs)

YELLOW — 0.0.7247769

CYAN — 0.0.7247778

MAGENTA — 0.0.7247782

Entity Verdict

WHITE — 0.0.7261514

🔑 The Three Proof Layers
1. Peirce (Logic)

Contract enforces additive rule:
RED + GREEN → YELLOW
GREEN + BLUE → CYAN
RED + BLUE → MAGENTA

2. Tarski (Material)

Token mint occurs on-chain using HTS precompiles.
This proves the contract’s logic affects material reality.

3. Floridi (Meaning)

A canonical manifest is published to HCS, producing:

consensus timestamp

immutable record

canonical URI

proofHash = keccak256(manifest)

All three layers share the same proofHash.

📦 How to Reproduce the Demo

After cloning:

cp .env.example .env
npm install

Run the three additive proofs:
node scripts/reason.js examples/mvp/red-green-yellow.json
node scripts/reason.js examples/mvp/green-blue-cyan.json
node scripts/reason.js examples/mvp/red-blue-magenta.json

Run the entity attestation (WHITE):
node scripts/entity-v06.js examples/mvp/entity-white-light.json

Validate system health:
node scripts/validate-light-e2e-v063.js

🧬 The Morpheme (Core Technical Punchline)

Each proof produces a single hash:

proofHash = keccak256({
  ruleHash,
  inputsHash,
  factHash,
  canonicalUri
})


This merges rule → inputs → outputs → meaning into one final cryptographic artifact.

It is:

deterministic

replayable

independently verifiable

universal across domains

This is what we mean when we say:

Ontologic is TCP/IP for reasoning provenance.
One morpheme = one verifiable unit of reasoning.

🧪 Canonical Proofs (Used in Demo Video)
RED + GREEN → YELLOW

TX: 0.0.7238571@1763192770.640250429
HCS Seq: 39

GREEN + BLUE → CYAN

TX: 0.0.7238571@1763192800.935525095
HCS Seq: 40

RED + BLUE → MAGENTA

TX: 0.0.7238571@1763192831.575284546
HCS Seq: 41

WHITE Entity Attestation

TX: 0.0.7238571@1763192887.025965132
HCS Seq: 42

🧭 Why This Matters

Ontologic proves that:

reasoning can be expressed as deterministic rules

contracts can enforce them

tokens can reflect them

consensus can attest to them

All verifiable by a single hash.

This is the first general-purpose reasoning protocol on Hedera.