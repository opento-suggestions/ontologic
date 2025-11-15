# RGB ↔ CMY(K) Complete Closure

**Version**: Ontologic v0.4.5+
**Rule Count**: 25 (12 light + 13 paint)
**Status**: Normalized, minimal, and complete

---

## Overview

This document describes the complete, normalized rule set for RGB ↔ CMY(K) color reasoning across dual domains (light and paint). The system implements **25 explicit rules** that provide full closure for color transformation operations.

### Key Principles

1. **Associativity**: `A+(B+C) = (A+B)+C` - Operations can be composed sequentially
2. **Commutativity**: `A+B = B+A` - Order-invariant (inputs sorted as normalized multisets)
3. **Single 3-Input Rule**: Only `{C,M,Y} → K` requires 3 inputs
4. **Generic Identity**: 1-input rules handled generically (returns input if valid)
5. **Graceful Failure**: Undefined combinations return `ok=false` without revert

### Domain Model

| Domain | Physical Analogy | Primary Colors | Output Range |
|--------|------------------|----------------|--------------|
| **color.light** | Additive light mixing | RGB (Red, Green, Blue) | CMY + White |
| **color.paint** | Subtractive pigment mixing | CMY (Cyan, Magenta, Yellow) | RGB + Black |

---

## Rule Breakdown by Domain

### Domain 1: color.light (12 rules)

**Physical Model**: Additive light mixing - combining light sources increases brightness

#### Category 1.1: Additive Rules (3 rules)
Produce the additive secondaries from RGB primaries:

| Rule ID | Inputs | Output | Normalized Multiset | Description |
|---------|--------|--------|---------------------|-------------|
| 1 | {RED, GREEN} | YELLOW | `{R,G}` | Red + green light → yellow |
| 2 | {RED, BLUE} | MAGENTA | `{R,B}` | Red + blue light → magenta |
| 3 | {GREEN, BLUE} | CYAN | `{G,B}` | Green + blue light → cyan |

**Operator**: `mix_add@v1`

#### Category 1.2: Secondary − Primary Rules (6 rules)
Each secondary minus one primary returns the remaining primary:

| Rule ID | Inputs | Output | Relation | Description |
|---------|--------|--------|----------|-------------|
| 4 | {YELLOW, RED} | GREEN | `Y−R==G` | Yellow − red → green |
| 5 | {YELLOW, GREEN} | RED | `Y−G==R` | Yellow − green → red |
| 6 | {MAGENTA, RED} | BLUE | `M−R==B` | Magenta − red → blue |
| 7 | {MAGENTA, BLUE} | RED | `M−B==R` | Magenta − blue → red |
| 8 | {CYAN, GREEN} | BLUE | `C−G==B` | Cyan − green → blue |
| 9 | {CYAN, BLUE} | GREEN | `C−B==G` | Cyan − blue → green |

**Operator**: `check_sub@v1`

#### Category 1.3: White Complement Rules (3 rules)
White minus each primary returns its complement (a secondary):

| Rule ID | Inputs | Output | Relation | Description |
|---------|--------|--------|----------|-------------|
| 10 | {WHITE, RED} | CYAN | `W−R==C` | White − red → cyan |
| 11 | {WHITE, GREEN} | MAGENTA | `W−G==M` | White − green → magenta |
| 12 | {WHITE, BLUE} | YELLOW | `W−B==Y` | White − blue → yellow |

**Operator**: `check_sub@v1`

**Light Domain Total**: 12 rules (3 additive + 6 subtractive + 3 white complement)

---

### Domain 2: color.paint (13 rules)

**Physical Model**: Subtractive pigment mixing - combining pigments absorbs more wavelengths

#### Category 2.1: Pairwise Subtractive Mix (3 rules)
Subtractive mixing produces RGB secondaries from CMY primaries:

| Rule ID | Inputs | Output | Normalized Multiset | Description |
|---------|--------|--------|---------------------|-------------|
| 13 | {CYAN, MAGENTA} | BLUE | `{C,M}` | Cyan + magenta pigment → blue |
| 14 | {MAGENTA, YELLOW} | RED | `{M,Y}` | Magenta + yellow pigment → red |
| 15 | {CYAN, YELLOW} | GREEN | `{C,Y}` | Cyan + yellow pigment → green |

**Operator**: `mix_add@v1` (additive in the mixing sense, subtractive in the color model)

#### Category 2.2: Triple Saturation (1 rule)
Only 3-input rule in the system:

| Rule ID | Inputs | Output | Normalized Multiset | Description |
|---------|--------|--------|---------------------|-------------|
| 16 | {CYAN, MAGENTA, YELLOW} | GREY | `{C,M,Y}` | C+M+Y → K (black/grey) |

**Operator**: `mix_add@v1`

**Note**: Uses GREY token as BLACK (K) proxy if dedicated BLACK token not minted.

#### Category 2.3: Secondary − Primary Rules (6 rules)
Printing logic: remove pigment to reveal underlying base:

| Rule ID | Inputs | Output | Relation | Description |
|---------|--------|--------|----------|-------------|
| 17 | {RED, MAGENTA} | YELLOW | `R−M==Y` | Red − magenta → yellow |
| 18 | {RED, YELLOW} | MAGENTA | `R−Y==M` | Red − yellow → magenta |
| 19 | {GREEN, CYAN} | YELLOW | `G−C==Y` | Green − cyan → yellow |
| 20 | {GREEN, YELLOW} | CYAN | `G−Y==C` | Green − yellow → cyan |
| 21 | {BLUE, CYAN} | MAGENTA | `B−C==M` | Blue − cyan → magenta |
| 22 | {BLUE, MAGENTA} | CYAN | `B−M==C` | Blue − magenta → cyan |

**Operator**: `check_sub@v1`

#### Category 2.4: Black Complement Rules (3 rules)
Black minus a primary returns the complement primary:

| Rule ID | Inputs | Output | Relation | Description |
|---------|--------|--------|----------|-------------|
| 23 | {GREY, CYAN} | RED | `K−C==R` | Black − cyan → red |
| 24 | {GREY, MAGENTA} | GREEN | `K−M==G` | Black − magenta → green |
| 25 | {GREY, YELLOW} | BLUE | `K−Y==B` | Black − yellow → blue |

**Operator**: `check_sub@v1`

**Paint Domain Total**: 13 rules (3 pairwise + 1 triple + 6 secondary-primary + 3 black complement)

---

## Completeness Analysis

### Why 25 Rules Are Complete

1. **Every primary ↔ secondary relationship is expressed**
   - Light: RGB → CMY (rules 1-3)
   - Paint: CMY → RGB (rules 13-15)

2. **Every complement relationship is expressed**
   - Light white complements (rules 10-12)
   - Paint black complements (rules 23-25)

3. **Every decomposition is expressed**
   - Light secondary-primary (rules 4-9)
   - Paint secondary-primary (rules 17-22)

4. **Triple saturation handled explicitly**
   - Single 3-input rule for CMY→K (rule 16)

5. **Larger sets handled via associativity**
   - Example (light): `{R,G,B}` can be computed as `(R+G)→Y; Y+B→W`
   - Example (paint): `{C,M,Y}→K` defined directly (rule 16)

### What's NOT Included (By Design)

- **Cross-domain mixing**: Rules do not mix light and paint tokens (e.g., no `RED_LIGHT + CYAN_PAINT`)
- **Undefined combinations**: Unmapped pairs (e.g., `MAGENTA+CYAN` in light domain) return `ok=false` without revert
- **N-input rules (N>3)**: Use associativity to compose (future enhancement: fold operators)

---

## Implementation Strategy

### Normalized Multisets & Commutativity

All inputs are sorted before hashing to ensure order-invariant ruleId computation:

```javascript
const sortedInputs = [...params.inputAddresses].sort((a, b) =>
  a.toLowerCase().localeCompare(b.toLowerCase())
);

const ruleId = ethers.keccak256(
  ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "bytes32", "address[]"],
    [domainHash, operatorHash, sortedInputs]
  )
);
```

**Result**: `{R,G}` and `{G,R}` produce identical ruleId `0x...`

### Identity Rules (1-Input Generic)

Single-input operations handled generically:

```solidity
function reason(bytes32 ruleId, uint64 inputUnits, ...) external {
    if (inputs.length == 1) {
        // Check token belongs to domain
        bool inDomain = _isTokenInDomain(domainHash, inputs[0]);
        if (inDomain) {
            return (true, inputs[0]); // Identity: return self
        } else {
            return (false, address(0)); // Reject
        }
    }
    // ... multi-input logic
}
```

### Undefined Combinations

When a rule doesn't exist in the registry:

```solidity
function reason(bytes32 ruleId, ...) external returns (bool ok, address output) {
    Rule storage rule = rules[ruleId];
    if (rule.outputToken == address(0)) {
        emit ReasoningResult(false, address(0), ruleId);
        return (false, address(0)); // ✅ Returns false, does NOT revert
    }
    // ... rule execution
}
```

**Critical**: Verdict functions (Tarski layer) must NEVER revert on semantic failures.

---

## Phased Deployment

Recommended order for registering rules on a fresh deployment:

### Phase 1: RGB → CMY Additive (3 rules)
**Prerequisites**: RED, GREEN, BLUE tokens exist
**Registers**: Rules 1-3 (initial minting capability)

```bash
node scripts/admin/register_all_rules.js --phase 1
```

### Phase 2: Light Subtractive (6 rules)
**Prerequisites**: YELLOW, CYAN, MAGENTA tokens exist
**Registers**: Rules 4-9 (secondary-primary verification)

```bash
node scripts/admin/register_all_rules.js --phase 2
```

### Phase 3: White Complement (3 rules)
**Prerequisites**: WHITE token exists
**Registers**: Rules 10-12 (white-based complements)

```bash
node scripts/admin/register_all_rules.js --phase 3
```

### Phase 4: CMY → RGB Pairwise (3 rules)
**Prerequisites**: All RGB and CMY tokens exist
**Registers**: Rules 13-15 (paint domain mixing)

```bash
node scripts/admin/register_all_rules.js --phase 4
```

### Phase 5: Triple Saturation (1 rule)
**Prerequisites**: GREY token exists (as BLACK proxy)
**Registers**: Rule 16 (CMY→K demonstration)

```bash
node scripts/admin/register_all_rules.js --phase 5
```

### Phase 6: Paint Subtractive (6 rules)
**Prerequisites**: All RGB and CMY tokens exist
**Registers**: Rules 17-22 (paint secondary-primary)

```bash
node scripts/admin/register_all_rules.js --phase 6
```

### Phase 7: Black Complement (3 rules)
**Prerequisites**: GREY token exists (as BLACK proxy)
**Registers**: Rules 23-25 (black-based complements)

```bash
node scripts/admin/register_all_rules.js --phase 7
```

---

## Usage Examples

### Register All Rules
```bash
node scripts/admin/register_all_rules.js
```

### Register Light Domain Only
```bash
node scripts/admin/register_all_rules.js --domain light
```

### Register Paint Domain Only
```bash
node scripts/admin/register_all_rules.js --domain paint
```

### Register Specific Phase
```bash
node scripts/admin/register_all_rules.js --phase 1
```

### Register Specific Rules
```bash
node scripts/admin/register_all_rules.js --ids 1,2,3,13,14,15
```

### Dry Run (Preview)
```bash
node scripts/admin/register_all_rules.js --dry-run
```

---

## Future Extensions

### N-Input Folding (Associativity)
Implement generic fold operators for N>3 inputs:

```solidity
function foldAdd(address[] calldata inputs, bytes32 domainHash)
    external returns (address result) {
    require(inputs.length >= 2, "min-2-inputs");

    address acc = inputs[0];
    for (uint i = 1; i < inputs.length; i++) {
        (bool ok, address next) = _mixPair(acc, inputs[i], domainHash);
        require(ok, "fold-failed");
        acc = next;
    }
    return acc;
}
```

**Example**: `foldAdd([R,G,B], D_LIGHT)` → `(R+G)→Y; (Y+B)→W`

### Cross-Domain Composition
Enable rules that reference outputs from multiple domains:

```json
{
  "inputs": ["WHITE@color.light", "GREY@color.paint"],
  "output": "NEUTRAL",
  "domain": "color.composite"
}
```

### Domain Registry
On-chain registry for domain metadata:

```solidity
struct DomainInfo {
    string name;
    string description;
    address[] primaries;
    bytes32 schemaHash;
}

mapping(bytes32 => DomainInfo) public domains;
```

---

## Validation & Testing

### Rule Registration Validation
After running `register_all_rules.js`, verify:

1. **Transaction Success**: All 25 rules registered without revert
2. **RuleId Uniqueness**: No duplicate ruleIds (order-invariant hashing working)
3. **Domain Coverage**: 12 light + 13 paint rules confirmed
4. **Results File**: Check `proofs/rule_registration_<timestamp>.json` for full audit

### Proof Execution Validation
Execute proof operations to verify:

1. **Additive Proofs**: RGB → CMY minting (rules 1-3)
2. **Subtractive Checks**: Secondary-primary verification (rules 4-9, 17-22)
3. **Complement Checks**: White/black complement verification (rules 10-12, 23-25)
4. **Triple Saturation**: CMY → K demonstration (rule 16)
5. **Replay Detection**: Re-execute proofs to verify idempotency
6. **Undefined Combinations**: Verify graceful `ok=false` for unmapped pairs

### Triple-Layer Provenance
For each successful proof, verify:

1. **Layer 1 (CONTRACTCALL)**: Transaction confirmed on Mirror Node
2. **Layer 2 (TOKENMINT)**: Output token minted (additive rules only)
3. **Layer 3 (HCS MESSAGE)**: Canonical proof on HCS topic

---

## Reference Links

- **Rule Set Definition**: [`rules/rgb_cmyk_complete.json`](../rules/rgb_cmyk_complete.json)
- **Registration Script**: [`scripts/admin/register_all_rules.js`](../scripts/admin/register_all_rules.js)
- **Token Configuration**: [`scripts/lib/tokens.json`](../scripts/lib/tokens.json)
- **Contract**: [`contracts/reasoningContract.sol`](../contracts/reasoningContract.sol)

---

## Summary

The RGB ↔ CMY(K) complete closure provides:

✅ **25 normalized rules** (12 light + 13 paint)
✅ **Order-invariant hashing** (commutativity)
✅ **Associative composition** (multi-step operations)
✅ **Graceful failure** (undefined combinations return false)
✅ **Dual-domain reasoning** (light and paint)
✅ **Generic identity** (1-input returns self)
✅ **Complete coverage** (all primary-secondary relationships)

**Next**: Register all rules on deployed contract and execute validation proofs.

---

**Document Version**: 1.0
**Last Updated**: 2025-11-12
**Ontologic Version**: v0.4.5+
