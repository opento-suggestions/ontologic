# Canonical v0.6.3 Proof Bundles (FROZEN)

**Status**: Hackathon Demo - Canonical Reference
**Version**: v0.6.3
**Date**: 2025-11-15
**Contract**: 0.0.7261322
**HCS Topic**: 0.0.7239064

---

## These are the EXACT proof bundles used in the hackathon demo video and slides.

**DO NOT MODIFY** - These files are frozen as canonical references.

For development/testing, use the files in `examples/mvp/` (parent directory).

---

## Proof Bundle Index

### RGB → CMY (Peirce Layer - Additive Reasoning)

1. **red-green-yellow.json**
   - Rule: RED + GREEN → YELLOW
   - Domain: color.light
   - Operator: mix_add@v1
   - Latest Execution: HCS Seq 39 (2025-11-15)
   - Proof Hash: `0x8f61b2423b4aacab9b16550c499a3974fc77005df1a166aafa65c5479f05bea2`

2. **green-blue-cyan.json**
   - Rule: GREEN + BLUE → CYAN
   - Domain: color.light
   - Operator: mix_add@v1
   - Latest Execution: HCS Seq 40 (2025-11-15)
   - Proof Hash: `0xef80dcbe1178c27f586fe90cf3ad9e404b54bdbe3b04e583e2a91303e95188f2`

3. **red-blue-magenta.json**
   - Rule: RED + BLUE → MAGENTA
   - Domain: color.light
   - Operator: mix_add@v1
   - Latest Execution: HCS Seq 41 (2025-11-15)
   - Proof Hash: `0xe00da13738d4c2af08be0256c5d179e5587cb6ff1bf660ccdb3af0d7048aa448`

### CMY → WHITE (Floridi Layer - Entity Attestation)

4. **entity-white-light.json**
   - Entity: WHITE (complete light spectrum)
   - Domain: color.entity.light
   - Operator: attest_palette@v1
   - Evidence: 3 CMY proofs (HCS Seq 33, 34, 35)
   - Latest Execution: HCS Seq 42 (2025-11-15)
   - Manifest Hash: `0xeb02c0ad5d7e7b35886a85feac08c3f8a92c7ca65c6702eb96834096f1644b97`

---

## Execution Commands (Reference Only)

```bash
# DO NOT RUN THESE - BUNDLES ARE FROZEN
# For testing, use ../red-green-yellow.json instead

node scripts/reason.js examples/mvp/final/red-green-yellow.json
node scripts/reason.js examples/mvp/final/green-blue-cyan.json
node scripts/reason.js examples/mvp/final/red-blue-magenta.json
node scripts/entity-v06.js examples/mvp/final/entity-white-light.json
```

---

## Canonical Snapshot

See **DEMO_SNAPSHOT_V063.md** in project root for complete canonical reference including:
- Transaction IDs
- Proof hashes
- HCS URIs
- Contract addresses
- Token IDs

---

**FROZEN**: 2025-11-15
**Purpose**: Hackathon demo canonical reference
**Status**: Immutable
