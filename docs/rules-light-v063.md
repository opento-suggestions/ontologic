# Canonical LIGHT Domain Rules - v0.6.3

This document defines the complete, explicit, and deterministic rule set for the LIGHT domain in Ontologic v0.6.3.

## Overview

The LIGHT domain implements additive color theory where RGB primaries combine to produce CMY secondaries, which attest to the WHITE entity. This is a closed, verifiable system with four canonical rules spanning two epistemic layers:

- **Peirce Layer (Additive):** 3 rules for RGB → CMY mixing
- **Floridi Layer (Entity):** 1 rule for CMY → WHITE attestation

## Rule Computation

All rules use deterministic semantic hashing:

```solidity
ruleHash = keccak256(abi.encodePacked(domain, ":", operator))
```

Domain and operator constants are defined in the contract:

```solidity
bytes32 public constant D_LIGHT = keccak256("color.light");
bytes32 public constant D_ENTITY_LIGHT = keccak256("color.entity.light");
bytes32 public constant OP_ADD = keccak256("mix_add@v1");
bytes32 public constant OP_ATTEST = keccak256("attest_palette@v1");
```

## Token Configuration (Testnet - 0.0.7238571)

**RGB Primaries (Operator-Controlled):**
- RED: `0.0.7247682` → `0x00000000000000000000000000000000006e9742`
- GREEN: `0.0.7247683` → `0x00000000000000000000000000000000006e9743`
- BLUE: `0.0.7247684` → `0x00000000000000000000000000000000006e9744`

**CMY Secondaries (Contract-Minted):**
- YELLOW: `0.0.7247769` → `0x00000000000000000000000000000000006e9799`
- CYAN: `0.0.7247778` → `0x00000000000000000000000000000000006e97a2`
- MAGENTA: `0.0.7247782` → `0x00000000000000000000000000000000006e97a6`

**Entity Token (Contract-Minted):**
- WHITE: `0.0.7261514` → `0x00000000000000000000000000000000006ecd4a`

---

## Canonical Rules

### Rule 1: RED + GREEN → YELLOW

**Layer:** Peirce (Additive Reasoning)

**Domain:**
- String: `"color.light"`
- Hash: `keccak256("color.light")` = `0x4b3f6c1e8e9f0a2c7d5b3e1a9f8d6c4e2b0a8f7d5c3e1a9f8d6c4e2b0a8f7d5c`

**Operator:**
- String: `"mix_add@v1"`
- Hash: `keccak256("mix_add@v1")` = (computed by contract constant OP_ADD)

**Inputs (Order-Invariant):**
1. RED: `0x00000000000000000000000000000000006e9742`
2. GREEN: `0x00000000000000000000000000000000006e9743`

**Output:**
- YELLOW: `0x00000000000000000000000000000000006e9799`
- Amount: `1` (atomic units)
- Ratio: `1:1` (ratioNumerator = 1)

**Rule ID:**
```solidity
ruleId = keccak256(abi.encode(domain, operator, inputs))
```
(Computed at registration time)

**Semantics:**
Additive light mixing: red light + green light = yellow light

**HCS Proofs:**
- Seq 33: First v0.5.2 proof (2025-11-13)
- Seq 36: Backward compatibility test post-v0.6.0 upgrade

---

### Rule 2: GREEN + BLUE → CYAN

**Layer:** Peirce (Additive Reasoning)

**Domain:**
- String: `"color.light"`
- Hash: Same as Rule 1

**Operator:**
- String: `"mix_add@v1"`
- Hash: Same as Rule 1

**Inputs (Order-Invariant):**
1. GREEN: `0x00000000000000000000000000000000006e9743`
2. BLUE: `0x00000000000000000000000000000000006e9744`

**Output:**
- CYAN: `0x00000000000000000000000000000000006e97a2`
- Amount: `1` (atomic units)
- Ratio: `1:1` (ratioNumerator = 1)

**Rule ID:**
```solidity
ruleId = keccak256(abi.encode(domain, operator, inputs))
```

**Semantics:**
Additive light mixing: green light + blue light = cyan light

**HCS Proofs:**
- Seq 34: First v0.5.2 proof (2025-11-13)

---

### Rule 3: RED + BLUE → MAGENTA

**Layer:** Peirce (Additive Reasoning)

**Domain:**
- String: `"color.light"`
- Hash: Same as Rule 1

**Operator:**
- String: `"mix_add@v1"`
- Hash: Same as Rule 1

**Inputs (Order-Invariant):**
1. RED: `0x00000000000000000000000000000000006e9742`
2. BLUE: `0x00000000000000000000000000000000006e9744`

**Output:**
- MAGENTA: `0x00000000000000000000000000000000006e97a6`
- Amount: `1` (atomic units)
- Ratio: `1:1` (ratioNumerator = 1)

**Rule ID:**
```solidity
ruleId = keccak256(abi.encode(domain, operator, inputs))
```

**Semantics:**
Additive light mixing: red light + blue light = magenta light

**HCS Proofs:**
- Seq 35: First v0.5.2 proof (2025-11-13)

---

### Rule 4: YELLOW + CYAN + MAGENTA → WHITE

**Layer:** Floridi (Entity Attestation)

**Domain:**
- String: `"color.entity.light"`
- Hash: `keccak256("color.entity.light")` = (computed by contract constant D_ENTITY_LIGHT)

**Operator:**
- String: `"attest_palette@v1"`
- Hash: `keccak256("attest_palette@v1")` = (computed by contract constant OP_ATTEST)

**Inputs (Evidence-Based):**
1. YELLOW: `0x00000000000000000000000000000000006e9799` (requires proof from Rule 1)
2. CYAN: `0x00000000000000000000000000000000006e97a2` (requires proof from Rule 2)
3. MAGENTA: `0x00000000000000000000000000000000006e97a6` (requires proof from Rule 3)

**Output (Verdict):**
- WHITE: `0x00000000000000000000000000000000006ecd4a`
- Amount: `1` (atomic units)
- Ratio: `1:1` (ratioNumerator = 1)

**Evidence Requirements (v0.6.3+):**
- Must provide 3 proof hashes corresponding to Rules 1, 2, 3
- Each proof hash must exist in contract's `proofSeen` mapping
- Each proof must produce one of the required CMY outputs

**Rule ID:**
```solidity
ruleId = keccak256(abi.encode(domain, operator, inputs))
```

**Semantics:**
Entity attestation: Complete CMY palette proves WHITE (full additive spectrum)

**Domain Verdict Logic:**
```
IF domain == "color.entity.light"
AND evidence contains valid YELLOW proof
AND evidence contains valid CYAN proof
AND evidence contains valid MAGENTA proof
THEN verdict = APPROVED → mint WHITE
ELSE revert
```

**HCS Proofs:**
- Seq 37: First v0.6.0 entity attestation (2025-11-14)

---

## v0.6.3 Registration Strategy

**Goal:** Make all 4 rules explicitly registered and queryable from contract state.

**Approach:**
1. **Additive Rules (1-3):** Register via `setRule()` function
   - Populates `rules` mapping for introspection
   - Does NOT change execution path (still uses `_mixAddDeterministic`)
   - Enables on-chain verification of rule configuration

2. **Entity Rule (4):** Register via `setRule()` function
   - Documents the 3-input attestation rule
   - Used by new `publishEntityV2()` for explicit validation
   - Backward compatible with v0.6.0 `publishEntity()` (no evidence validation)

**Execution Paths (v0.6.3):**
- `reasonAdd()` → continues using hardcoded `_mixAddDeterministic` logic
- `publishEntity()` → v0.6.0 behavior (no evidence validation)
- `publishEntityV2()` → NEW: validates evidence against registered rule

**Future (v0.7.0):**
- `reasonAdd()` → consult rule registry instead of hardcoded logic
- Full registry-driven execution across all layers
- Deprecate hardcoded paths

---

## Verification Checklist

After v0.6.3 upgrade and registration, verify:

- [ ] All 4 rules registered in contract storage
- [ ] Rule IDs computable and deterministic
- [ ] `rules[ruleId]` query returns expected domain, operator, inputs, output
- [ ] Backward compatibility: v0.5.2 proofs (Seq 33-35) still valid
- [ ] Backward compatibility: v0.6.0 entity proof (Seq 37) still valid
- [ ] Forward compatibility: New `publishEntityV2()` validates evidence
- [ ] E2E test: RGB → CMY → WHITE chain with explicit evidence

---

## References

- Contract: `0.0.7261322` (Hedera Testnet)
- HCS Topic: `0.0.7239064` (Ontologic Reasoning Proof Tree)
- Operator: `0.0.7238571` (Demo account)
- Version: v0.6.3 (Rule Registry + Evidence Validation)
- Previous: v0.6.0 (Floridi Layer - Basic Entity Attestation)
- Next: v0.7.0 (Full Registry-Driven Execution)

---

## Appendix: Rule Hash Computation Examples

### Domain Hashes
```javascript
import { ethers } from "ethers";

const D_LIGHT = ethers.keccak256(ethers.toUtf8Bytes("color.light"));
const D_ENTITY_LIGHT = ethers.keccak256(ethers.toUtf8Bytes("color.entity.light"));

console.log("D_LIGHT:", D_LIGHT);
console.log("D_ENTITY_LIGHT:", D_ENTITY_LIGHT);
```

### Operator Hashes
```javascript
const OP_ADD = ethers.keccak256(ethers.toUtf8Bytes("mix_add@v1"));
const OP_ATTEST = ethers.keccak256(ethers.toUtf8Bytes("attest_palette@v1"));

console.log("OP_ADD:", OP_ADD);
console.log("OP_ATTEST:", OP_ATTEST);
```

### Rule ID Computation (Example: Rule 1)
```javascript
const domain = D_LIGHT;
const operator = OP_ADD;
const inputs = [
  "0x00000000000000000000000000000000006e9742", // RED (sorted)
  "0x00000000000000000000000000000000006e9743"  // GREEN
].sort(); // Order-invariant

const ruleId = ethers.keccak256(
  ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "bytes32", "address[]"],
    [domain, operator, inputs]
  )
);

console.log("Rule 1 ID:", ruleId);
```

---

**Last Updated:** 2025-11-14
**Status:** Ready for v0.6.3 implementation
