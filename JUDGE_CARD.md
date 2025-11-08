# Ontologic Judge Card - Proof Demonstrations

**Contract**: 0x97e00a2597C20b490fE869204B0728EF6c9F23eA
**Contract ID**: 0.0.1822368746
**Code Hash**: 0xc33f4e5747d3ef237fab636a0336e471cc6fa748d9c87c4c94351b6cd9e2ba16
**HCS Topic**: 0.0.7204585
**Network**: Hedera Testnet
**Updated**: 2025-11-08 (v0.4.2 - Validated)

---

## v0.4.2 - Additive and Subtractive Reasoning

### Additive Proofs (Peirce Layer, color.light domain)

Demonstrates RGB → CMY secondary color synthesis via additive (light) color mixing.

#### Proof 1: RED + GREEN → YELLOW

**Relation**: `A + B → C` (additive synthesis)
**Layer**: `peirce`
**Operator**: `mix_add@v1`

```json
{
  "v": "0.4.2",
  "layer": "peirce",
  "mode": "additive",
  "domain": "color.light",
  "operator": "mix_add@v1",
  "inputs": [
    {"token": "0x00000000000000000000000000000000006deec8"},
    {"token": "0x00000000000000000000000000000000006defe8"}
  ],
  "output": {"amount": "1", "token": "0x00000000000000000000000000000000006e2358"},
  "rule": {
    "contract": "0x97e00a2597c20b490fe869204b0728ef6c9f23ea",
    "codeHash": "0xc33f4e5747d3ef237fab636a0336e471cc6fa748d9c87c4c94351b6cd9e2ba16",
    "functionSelector": "0xc687cfeb",
    "version": "v0.4.2"
  }
}
```

**Results**:
- ProofHash: `0x598c...7246`
- HCS Sequence: 22
- Transaction: [0.0.6748221@1762584809.265709533](https://hashscan.io/testnet/transaction/0.0.6748221@1762584809.265709533)
- Token Minted: 1 YELLOW
- Status: ✅ Validated (Layer 1 + Layer 2 + Layer 3)

#### Proof 2: GREEN + BLUE → CYAN

**Relation**: `A + B → C`

**Results**:
- ProofHash: `0x6727...2782`
- HCS Sequence: 23
- Transaction: [0.0.6748221@1762584843.628968871](https://hashscan.io/testnet/transaction/0.0.6748221@1762584843.628968871)
- Token Minted: 1 CYAN
- Status: ✅ Validated

#### Proof 3: RED + BLUE → MAGENTA

**Relation**: `A + B → C`

**Results**:
- ProofHash: `0x6fe2...6a4f`
- HCS Sequence: 24
- Transaction: [0.0.6748221@1762584875.725125624](https://hashscan.io/testnet/transaction/0.0.6748221@1762584875.725125624)
- Token Minted: 1 MAGENTA
- Status: ✅ Validated

---

### Subtractive Proofs (Tarski Layer, color.paint domain)

Demonstrates CMY color relationships via subtractive (paint) color checking.

#### Proof 4: GREEN - YELLOW == CYAN

**Relation**: `A - B == C` (subtractive verification)
**Layer**: `tarski`
**Operator**: `check_sub@v1`

**Results**:
- ProofHash: `0x36f1...c3c9`
- HCS Sequence: 25
- Transaction: [0.0.6748221@1762584950.995828670](https://hashscan.io/testnet/transaction/0.0.6748221@1762584950.995828670)
- Verdict: TRUE ✅
- Status: ✅ Validated

#### Proof 5: BLUE - MAGENTA == CYAN

**Relation**: `A - B == C`

**Results**:
- ProofHash: `0x3c6e...7dc1`
- HCS Sequence: 26
- Transaction: [0.0.6748221@1762584963.754348526](https://hashscan.io/testnet/transaction/0.0.6748221@1762584963.754348526)
- Verdict: TRUE ✅
- Status: ✅ Validated

#### Proof 6: RED - YELLOW == MAGENTA

**Relation**: `A - B == C`

**Results**:
- ProofHash: `0x00f1...fe36`
- HCS Sequence: 27
- Transaction: [0.0.6748221@1762584969.428319762](https://hashscan.io/testnet/transaction/0.0.6748221@1762584969.428319762)
- Verdict: TRUE ✅
- Status: ✅ Validated

---

### Negative Case Proofs (Entity-Only Guard)

Demonstrates that ORANGE (entity-only token) does not satisfy subtractive proof relations.

#### Proof 7: ORANGE - YELLOW == RED (Expected: false)

**Relation**: `A - B == C`

**Results**:
- ProofHash: `0xb8d7...ef75`
- HCS Sequence: 28
- Transaction: [0.0.6748221@1762584973.040043150](https://hashscan.io/testnet/transaction/0.0.6748221@1762584973.040043150)
- Verdict: FALSE ✅ (as expected - ORANGE is entity-only)
- Status: ✅ Validated

#### Proof 8: ORANGE - RED == YELLOW (Expected: false)

**Relation**: `A - B == C`

**Results**:
- ProofHash: `0x3035...d782`
- HCS Sequence: 29
- Transaction: [0.0.6748221@1762584979.494407622](https://hashscan.io/testnet/transaction/0.0.6748221@1762584979.494407622)
- Verdict: FALSE ✅ (as expected - ORANGE is entity-only)
- Status: ✅ Validated

---

## Token Reference

| Symbol | Token ID | EVM Address | Purpose |
|--------|----------|-------------|---------|
| RED | 0.0.7204552 | ...006deec8 | Primary Input |
| GREEN | 0.0.7204840 | ...006defe8 | Primary Input |
| BLUE | 0.0.7204565 | ...006deed5 | Primary Input |
| YELLOW | 0.0.7218008 | ...006e2358 | Secondary Output (v0.4.2) |
| CYAN | 0.0.7218009 | ...006e2359 | Secondary Output (v0.4.2) |
| MAGENTA | 0.0.7218010 | ...006e235a | Secondary Output (v0.4.2) |
| ORANGE | 0.0.7217513 | ...006e2169 | Entity-Only (v0.4.2) |

---

## Verification Commands

### Query HCS Topic
```bash
# Retrieve all v0.4.2 proofs (sequences 22-29)
curl "https://testnet.mirrornode.hedera.com/api/v1/topics/0.0.7204585/messages?sequencenumber=gte:22&limit=10"
```

### View Transaction on HashScan
```
https://hashscan.io/testnet/transaction/{TRANSACTION_ID}
```

### Export HCS Topic Snapshot
```bash
node scripts/export-hcs-proofs.js
# Outputs: proofs/hcs-topic-0.0.7204585-v042.json
```

---

## Summary Statistics

**Total Proofs**: 8/8 ✅
- Additive (Peirce): 3/3 ✅
- Subtractive (Tarski): 3/3 ✅
- Negative Guards: 2/2 ✅

**Validation Achievement**: 100% (8/8 proofs validated)
**HCS Sequences**: 22-29 (consecutive)
**Schema Version**: v0.4.2
**Contract Version**: v0.4.2
**Code Hash**: `0xc33f4e5747d3ef237fab636a0336e471cc6fa748d9c87c4c94351b6cd9e2ba16`

**Key Features Validated**:
- ✅ Idempotent proof execution with replay detection
- ✅ Order-invariant hashing (RED+GREEN == GREEN+RED)
- ✅ Input mutation guards (preimage hash verification)
- ✅ Triple-layer provenance (CONTRACTCALL + TOKENMINT + HCS MESSAGE)
- ✅ Dual-layer reasoning (Peirce additive + Tarski subtractive)
- ✅ Entity-only token handling (ORANGE projections without proof operations)

**Detailed Report**: [proofs/V042_VALIDATION_REPORT.md](proofs/V042_VALIDATION_REPORT.md)
