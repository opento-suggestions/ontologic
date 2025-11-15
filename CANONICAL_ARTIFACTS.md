# Canonical Artifacts - v0.6.3 Hackathon Demo

🔒 **FROZEN** - 2025-11-15

---

## Frozen Documentation

### Primary References (🔒 IMMUTABLE)

1. **DEMO_SNAPSHOT_V063.md** ✅
   - Location: `/DEMO_SNAPSHOT_V063.md`
   - Purpose: Complete canonical snapshot with all transaction IDs, proof hashes, HCS URIs
   - Status: FROZEN
   - Use: Video script, slide references, judge verification

2. **CLAUDE.md** ✅
   - Location: `/CLAUDE.md` (project root)
   - Purpose: Developer guide and operational procedures
   - Status: FROZEN v0.6.3
   - Use: Development context, deployment procedures

3. **docs/architecture.md** ✅
   - Location: `/docs/architecture.md`
   - Purpose: Technical architecture documentation
   - Status: FROZEN v0.6.3
   - Use: System design reference, execution flow diagrams

### Proof Bundles (🔒 IMMUTABLE)

4. **examples/mvp/final/** ✅
   - Location: `/examples/mvp/final/`
   - Contents: 4 canonical proof JSON files + README
   - Files:
     - `red-green-yellow.json` (HCS Seq 39)
     - `green-blue-cyan.json` (HCS Seq 40)
     - `red-blue-magenta.json` (HCS Seq 41)
     - `entity-white-light.json` (HCS Seq 42)
   - Status: FROZEN
   - Use: Exact proofs shown in demo video

---

## Canonical References

### Contract
- **ID**: 0.0.7261322
- **Address**: 0x00000000000000000000000000000000006ecc8a
- **Version**: v0.6.3
- **Code Hash**: 0xd35199bebcddccd1e150e9140fcb1842295616dd249d63a0be6cc66ea75a48fd
- **HashScan**: https://hashscan.io/testnet/contract/0.0.7261322

### HCS Topic
- **ID**: 0.0.7239064
- **Name**: Ontologic Reasoning Proof Tree
- **HashScan**: https://hashscan.io/testnet/topic/0.0.7239064

### Demo Proofs (HCS Seq 39-42, 2025-11-15)

**Proof 1: RED+GREEN→YELLOW**
- Sequence: 39
- Proof Hash: `0x8f61b2423b4aacab9b16550c499a3974fc77005df1a166aafa65c5479f05bea2`
- Inputs Hash: `0x4286d42d926e19c4a9273884ea90961113f8edb8091d535eba8ea448da9f7df8`
- Contract TX: `0.0.7238571@1763192770.640250429`
- HCS URI: `hcs://0.0.7239064/1763192772.294402000`

**Proof 2: GREEN+BLUE→CYAN**
- Sequence: 40
- Proof Hash: `0xef80dcbe1178c27f586fe90cf3ad9e404b54bdbe3b04e583e2a91303e95188f2`
- Inputs Hash: `0x8691d4fc4e9802b00dba8c0a2d5830da642d90c1e14d253d8e3700a733a618cf`
- Contract TX: `0.0.7238571@1763192800.935525095`
- HCS URI: `hcs://0.0.7239064/1763192805.501876738`

**Proof 3: RED+BLUE→MAGENTA**
- Sequence: 41
- Proof Hash: `0xe00da13738d4c2af08be0256c5d179e5587cb6ff1bf660ccdb3af0d7048aa448`
- Inputs Hash: `0x8f03ac868aefa4eb10c8976f8903d327efe60ae4b316516f54dab26f56f29e87`
- Contract TX: `0.0.7238571@1763192831.575284546`
- HCS URI: `hcs://0.0.7239064/1763192835.411991000`

**Proof 4: WHITE Entity Attestation**
- Sequence: 42
- Manifest Hash: `0xeb02c0ad5d7e7b35886a85feac08c3f8a92c7ca65c6702eb96834096f1644b97`
- Contract TX: `0.0.7238571@1763192887.025965132`
- HCS URI: `hcs://0.0.7239064/1763192891.585059752`
- Evidence: 3 CMY proofs (Seq 33, 34, 35 - original deployment)

### Tokens

**RGB Primaries:**
- RED: 0.0.7247682 → 0x00000000000000000000000000000000006e9742
- GREEN: 0.0.7247683 → 0x00000000000000000000000000000000006e9743
- BLUE: 0.0.7247684 → 0x00000000000000000000000000000000006e9744

**CMY Secondaries:**
- YELLOW: 0.0.7247769 → 0x00000000000000000000000000000000006e9799
- CYAN: 0.0.7247778 → 0x00000000000000000000000000000000006e97a2
- MAGENTA: 0.0.7247782 → 0x00000000000000000000000000000000006e97a6

**Entity Verdict:**
- WHITE: 0.0.7261514 → 0x00000000000000000000000000000000006ecd4a

---

## Verification Checklist

### Documentation ✅
- [x] DEMO_SNAPSHOT_V063.md marked FROZEN
- [x] CLAUDE.md marked FROZEN v0.6.3
- [x] docs/architecture.md marked FROZEN v0.6.3
- [x] All docs reference same contract ID (0.0.7261322)
- [x] All docs reference same HCS topic (0.0.7239064)
- [x] All docs reference same proof sequences (39-42)

### Proof Bundles ✅
- [x] examples/mvp/final/ directory created
- [x] 4 proof JSON files copied
- [x] README.md in final/ documenting frozen status
- [x] All bundles match executed proofs (HCS Seq 39-42)

### Consistency ✅
- [x] Contract ID consistent across all docs
- [x] HCS topic ID consistent across all docs
- [x] Proof hashes match DEMO_SNAPSHOT
- [x] Transaction IDs match verified executions
- [x] Token addresses match .env configuration

---

## Usage Notes

### For Slides/Video
- Reference: `DEMO_SNAPSHOT_V063.md`
- Use proof hashes, transaction IDs, HCS URIs from this file
- All values verified on 2025-11-15

### For Judge Verification
- Point to: `examples/mvp/final/`
- Judges can run: `node scripts/reason.js examples/mvp/final/red-green-yellow.json`
- Expected: New HCS sequence, same proof structure

### For Development (Post-Hackathon)
- Use: `examples/mvp/*.json` (parent directory, not final/)
- Modify working copies, not frozen bundles
- Reference frozen artifacts for canonical behavior

---

## Immutability Contract

**These artifacts are FROZEN for the hackathon demo.**

- ✅ All transaction IDs are real, verified on testnet
- ✅ All proof hashes computed from actual executions
- ✅ All HCS URIs point to real consensus messages
- ✅ No hypothetical or placeholder data

**DO NOT MODIFY** these files for hackathon submission. They represent the exact state demonstrated in the video and slides.

---

**Frozen**: 2025-11-15
**Purpose**: Hackathon canonical reference
**Status**: Immutable until v0.7.0
