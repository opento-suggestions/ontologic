# Ontologic Proof B – Dual-Domain Reasoning E2E Validation

**Date**: 2025-11-06
**Network**: Hedera Testnet
**Version**: Alpha v0.3

---

## Executive Summary

**Proof B successfully validates dual-domain reasoning on Hedera**, demonstrating that identical input tokens (RED + GREEN + BLUE) can produce different outputs based on the reasoning domain context. This implementation establishes **composable, domain-scoped proof-of-reasoning** where the same material inputs yield different material consequences depending on logical context.

### Key Achievement: Composable Domain Logic

- **Light Domain (Additive)**: RED + GREEN + BLUE → WHITE
- **Paint Domain (Subtractive)**: RED + GREEN + BLUE → GREY

Both proofs share identical inputs but produce **distinct canonical proof hashes**, demonstrating deterministic domain separation at the protocol level.

---

## Deployment Configuration (Alpha v0.3)

### Contract & Infrastructure

| Component | Value |
|-----------|-------|
| **ReasoningContract** | `0xC3Bed03792d94BC3f99eb295bCA1ce7632E7f08B` |
| **Schema Hash** | `0xf1944d69e7680639ebde87ed129a18522cdf8415d254b9a12d638df5e1ddd934` |
| **HCS Topic** | `0.0.7204585` (Ontologic Reasoning Proof Alpha Tree) |
| **Deploy Transaction** | `0x20feb190e8f627c92a6b45a572b932bd87922003a64cdc124e950bbe97dc865e` |

### Token Configuration

All tokens include RGB hex color metadata in their on-chain memos for self-describing proofs.

#### Input Tokens

| Token | ID | EVM Address | Metadata | Supply |
|-------|-----|-------------|----------|--------|
| **$RED** | `0.0.7204552` | `0x006deec8` | `{"name":"Red","symbol":"RED","color":"#FF0000"}` | 10 units |
| **$GREEN** | `0.0.7204840` | `0x006defe8` | `{"name":"Green","symbol":"GREEN","color":"#00FF00"}` | 10 units |
| **$BLUE** | `0.0.7204565` | `0x006deed5` | `{"name":"Blue","symbol":"BLUE","color":"#0000FF"}` | 10 units |

#### Output Tokens

| Token | ID | EVM Address | Metadata | Supply Key |
|-------|-----|-------------|----------|------------|
| **$WHITE** | `0.0.7204868` | `0x006df004` | `{"name":"White","symbol":"WHITE","color":"#FFFFFF"}` | Contract (`0xC3Bed...`) |
| **$GREY** | `0.0.7204885` | `0x006df015` | `{"name":"Grey","symbol":"GREY","color":"#808080"}` | Contract (`0xC3Bed...`) |

---

## Domain Rule Configuration

### Light Domain (Additive Color Mixing)

| Attribute | Value |
|-----------|-------|
| **Domain** | `color.additive` |
| **Operator** | `mix_light` |
| **Inputs** | RED + GREEN + BLUE |
| **Output** | WHITE |
| **Ratio** | 1:1 |
| **Rule ID** | `0xdd1480153360259fb34ae591a5e4be71d81827a82318549ca838be2b91346e65` |
| **Setup Transaction** | `0xf2301bef3fc473c555aab69cea9a816f3495cdeccf20f6304df3e997c365e2f7` |

**Physical Analogy**: Additive color mixing (light sources). When red, green, and blue light combine, they produce white light.

### Paint Domain (Subtractive Color Mixing)

| Attribute | Value |
|-----------|-------|
| **Domain** | `color.subtractive` |
| **Operator** | `mix_paint` |
| **Inputs** | RED + GREEN + BLUE |
| **Output** | GREY |
| **Ratio** | 1:1 |
| **Rule ID** | `0x4e8881312f98809e731a219db65a5bdf0df53d4e966f948cd11c091e8ae047ea` |
| **Setup Transaction** | `0xad0fd919a26e9dfa0ed128ec32b3cc9cad0b7ee4f62f5b98718343756d2a3af6` |

**Physical Analogy**: Subtractive color mixing (pigments). When red, green, and blue paint are mixed, they produce grey/brown.

---

## Proof Execution Results

### Light Domain Proof (Additive)

**Transaction**: `0xb5e8e003f0dd4fb196c7161e12507bbfc529a1a7be0679ac28457b6324b7ec58`
**Block**: 27210174
**Gas Used**: 92,710

#### Canonical Proof JSON
```json
{
  "v": "0",
  "domain": "color",
  "subdomain": "additive",
  "operator": "mix_light",
  "inputs": [
    {"token": "0.0.7204552", "alias": "red", "hex": "#FF0000"},
    {"token": "0.0.7204840", "alias": "green", "hex": "#00FF00"},
    {"token": "0.0.7204565", "alias": "blue", "hex": "#0000FF"}
  ],
  "output": {"token": "0.0.7204868", "alias": "white", "hex": "#FFFFFF"},
  "ts": "2025-11-06T22:05:35.272Z"
}
```

**Proof Hash**: `0x285de51362a08794ad428dcc103fbea005dc8e68546b3cdb7af4a88f092b8ecd`

#### Three-Layer Validation
- **Layer 1 (CONTRACTCALL)**: ✅ Contract validated RED + GREEN + BLUE inputs
- **Layer 2 (TOKENMINT)**: ✅ Minted 1 unit of $WHITE token
- **Layer 3 (HCS MESSAGE)**: ✅ Canonical proof submitted to topic `0.0.7204585`

### Paint Domain Proof (Subtractive)

**Transaction**: `0xb44d4cb4fd46da5ef36419112587d2e4f9f2c4d163677eeaafe1f0864e74e6b9`
**Block**: 27210241
**Gas Used**: 92,710

#### Canonical Proof JSON
```json
{
  "v": "0",
  "domain": "color",
  "subdomain": "subtractive",
  "operator": "mix_paint",
  "inputs": [
    {"token": "0.0.7204552", "alias": "red", "hex": "#FF0000"},
    {"token": "0.0.7204840", "alias": "green", "hex": "#00FF00"},
    {"token": "0.0.7204565", "alias": "blue", "hex": "#0000FF"}
  ],
  "output": {"token": "0.0.7204885", "alias": "grey", "hex": "#808080"},
  "ts": "2025-11-06T22:07:46.055Z"
}
```

**Proof Hash**: `0xf746e0d8c8eae3bff01c4c721a840430b393daf5745ea5a2f0d7742386ee912f`

#### Three-Layer Validation
- **Layer 1 (CONTRACTCALL)**: ✅ Contract validated RED + GREEN + BLUE inputs
- **Layer 2 (TOKENMINT)**: ✅ Minted 1 unit of $GREY token
- **Layer 3 (HCS MESSAGE)**: ✅ Canonical proof submitted to topic `0.0.7204585`

---

## Verification Links

### Light Domain Proof
- **HashScan**: https://hashscan.io/testnet/transaction/0xb5e8e003f0dd4fb196c7161e12507bbfc529a1a7be0679ac28457b6324b7ec58
- **Mirror Node**: https://testnet.mirrornode.hedera.com/api/v1/transactions/0xb5e8e003f0dd4fb196c7161e12507bbfc529a1a7be0679ac28457b6324b7ec58

### Paint Domain Proof
- **HashScan**: https://hashscan.io/testnet/transaction/0xb44d4cb4fd46da5ef36419112587d2e4f9f2c4d163677eeaafe1f0864e74e6b9
- **Mirror Node**: https://testnet.mirrornode.hedera.com/api/v1/transactions/0xb44d4cb4fd46da5ef36419112587d2e4f9f2c4d163677eeaafe1f0864e74e6b9

### HCS Topic Messages
- **Topic Endpoint**: https://testnet.mirrornode.hedera.com/api/v1/topics/0.0.7204585/messages

---

## Key Observations

### 1. Deterministic Domain Separation

The canonical proof hashes are **completely different** despite identical inputs:
- Light proof hash: `0x285de...b8ecd`
- Paint proof hash: `0xf746e...e912f`

This proves that the `subdomain` and `operator` fields create distinct proof identities, enabling composable reasoning contexts without collision.

### 2. Composability at the Token Level

The same material tokens (RED, GREEN, BLUE) participate in multiple reasoning contexts:
- Physical tokens remain unchanged
- Logical interpretation varies by domain
- Output tokens are domain-specific (WHITE vs GREY)

This demonstrates **token reusability across reasoning domains** without requiring token duplication.

### 3. Three-Layer Provenance Consistency

Both domains maintain complete provenance chains:
1. **CONTRACTCALL**: On-chain validation of inputs and domain rules
2. **TOKENMINT**: Autonomous minting of domain-specific output tokens
3. **HCS MESSAGE**: Append-only consensus record with full proof metadata

The contract enforces domain consistency by validating that the rule's domain hash matches the proof's domain context.

### 4. Gas Efficiency

Both proofs consumed identical gas (92,710), showing that 3-token rules have predictable costs regardless of domain. This is ~17% more gas than the 2-token MVP (79,192 gas), a reasonable cost for the additional input validation.

### 5. Self-Describing Proofs

All tokens include RGB color metadata in their memos, enabling:
- Visual representation of proofs without external lookups
- Deterministic color values embedded in canonical proofs
- Human-readable proof verification

---

## Contract Updates (v0.2 → v0.3)

### Added Features
1. **3-Token Rule Support**: Contract now validates 2 or 3 input tokens
2. **GREEN Token Integration**: Added `GREEN_TOKEN_ADDR` constant (`0x006DEfE8`)
3. **Flexible Validation**:
   - 2-token rules: Requires RED + BLUE
   - 3-token rules: Requires RED + GREEN + BLUE

### Updated Logic
```solidity
// Alpha v0.3: Support 2-token and 3-token rules
require(inputs.length == 2 || inputs.length == 3, "must provide 2 or 3 inputs");

bool hasRed = false;
bool hasGreen = false;
bool hasBlue = false;

for (uint256 i = 0; i < inputs.length; i++) {
    if (inputs[i] == RED_TOKEN_ADDR) hasRed = true;
    if (inputs[i] == GREEN_TOKEN_ADDR) hasGreen = true;
    if (inputs[i] == BLUE_TOKEN_ADDR) hasBlue = true;
}

if (inputs.length == 2) {
    require(hasRed && hasBlue, "2-token rules require RED and BLUE");
} else if (inputs.length == 3) {
    require(hasRed && hasGreen && hasBlue, "3-token rules require RED, GREEN, and BLUE");
}
```

---

## CLI Usage

### Execute Light Domain Reasoning
```bash
node scripts/reason.js --domain light
```

### Execute Paint Domain Reasoning
```bash
node scripts/reason.js --domain paint
```

### Domain Flag Implementation
The `--domain` flag (or `-d` short form) selects between reasoning contexts:
- **light**: Uses `color.additive` + `mix_light` → WHITE
- **paint**: Uses `color.subtractive` + `mix_paint` → GREY

Default: `paint` (maintains backward compatibility)

---

## Test Summary

**All E2E validation steps completed successfully:**

✅ Contract compiled and deployed with 3-token support
✅ Six tokens created with RGB metadata (RED, GREEN, BLUE, WHITE, GREY, PURPLE)
✅ GREEN token address added to contract constants
✅ Both domain rules configured on-chain
✅ Light domain proof executed and validated
✅ Paint domain proof executed and validated
✅ Three-layer provenance confirmed for both domains
✅ Distinct canonical proof hashes verified
✅ HCS messages submitted for both proofs

**Complete provenance chain established for dual-domain reasoning:**
```
Logical Inference (Domain-Scoped) → Material Consequence (Token Minting) → Public Consensus Record (HCS)
```

---

## Future Enhancements (Proof C Scope)

### 1. Cross-Domain Composition
Enable proofs that reference outputs from multiple domains:
- Example: WHITE (light domain output) + GREY (paint domain output) → new composite

### 2. Dynamic Domain Registration
Move from hardcoded domains to on-chain domain registry:
- Register new domains without contract redeployment
- Domain-specific validation rules
- Namespace management for domain identifiers

### 3. Multi-Domain Rules
Support rules that combine logic from multiple domains:
- Example: Physics domain + Chemistry domain → Material Science domain
- Cross-domain inference chains

### 4. Domain Metadata
Extend domain definitions with richer metadata:
- Human-readable descriptions
- Domain-specific units and measurements
- Validation schemas for domain-specific proofs

---

## Conclusion

**Alpha v0.3 successfully demonstrates composable dual-domain reasoning on Hedera.** The implementation proves that:

1. **Domain scoping works**: Same inputs produce different outputs based on reasoning context
2. **Provenance is maintained**: All three layers validate correctly for both domains
3. **Proofs are deterministic**: Canonical hashes uniquely identify domain-specific operations
4. **Tokens are reusable**: Physical tokens participate in multiple logical contexts
5. **The system scales**: Gas costs are predictable and reasonable for 3-token operations

This establishes a foundation for **multi-context reasoning systems** where shared primitives (tokens) enable diverse logical operations without duplication of material assets.

---

## Technical Details

### Environment Configuration
All token addresses and rule IDs stored in `.env`:
```env
GREEN_TOKEN_ID=0.0.7204840
WHITE_TOKEN_ID=0.0.7204868
GREY_TOKEN_ID=0.0.7204885
```

### Configuration Constants (config.js)
```javascript
export const ACTIVE_RULE_IDS = {
  LIGHT: "0xdd1480153360259fb34ae591a5e4be71d81827a82318549ca838be2b91346e65",
  PAINT: "0x4e8881312f98809e731a219db65a5bdf0df53d4e966f948cd11c091e8ae047ea",
};
```

### Domain Mapping (reason.js)
```javascript
const DOMAIN_CONFIG = {
  light: {
    domain: "color",
    subdomain: "additive",
    operator: "mix_light",
    inputs: ["RED", "GREEN", "BLUE"],
    output: "WHITE",
    outputColor: "#FFFFFF",
  },
  paint: {
    domain: "color",
    subdomain: "subtractive",
    operator: "mix_paint",
    inputs: ["RED", "GREEN", "BLUE"],
    output: "GREY",
    outputColor: "#808080",
  },
};
```

---

**Proof B Status**: ✅ **VALIDATED AND OPERATIONAL**

The dual-domain reasoning system is live on Hedera testnet and ready for further expansion in Proof C.
