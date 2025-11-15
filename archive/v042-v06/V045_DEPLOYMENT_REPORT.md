# Ontologic v0.4.5 Deployment Report

**Deployment Date**: 2025-11-12
**Network**: Hedera Testnet
**Status**: ✅ Successfully Deployed and Configured

## Summary

Ontologic v0.4.5 successfully deployed with extended 9-token support (RGB+CMY+WHITE+GREY+PURPLE). The contract implements a configurable token address system with post-deployment configuration via `setTokenAddresses()`.

---

## Deployment Details

### Contract Information

| Field | Value |
|-------|-------|
| **Version** | v0.4.5 (Extended Token Support) |
| **Contract ID** | `0.0.7238692` |
| **EVM Address** | `0x00000000000000000000000000000000006e7424` |
| **Schema Hash** | `0xf1944d69e7680639ebde87ed129a18522cdf8415d254b9a12d638df5e1ddd934` |
| **Deploy Transaction** | `0.0.7238571@1762927137.220403625` |
| **Deployer** | `0.0.7238571` |

**Verification Links**:
- [HashScan Contract](https://hashscan.io/testnet/contract/0.0.7238692)
- [Mirror Node](https://testnet.mirrornode.hedera.com/api/v1/contracts/0.0.7238692)

---

## Token Configuration

### Input Tokens (RGB Primaries)

| Token | Token ID | EVM Address | Supply Key | Status |
|-------|----------|-------------|------------|--------|
| **RED** | `0.0.7238644` | `0x00000000000000000000000000000000006e73f4` | Operator | ✅ Configured |
| **GREEN** | `0.0.7238655` | `0x00000000000000000000000000000000006e73ff` | Operator | ✅ Configured |
| **BLUE** | `0.0.7238658` | `0x00000000000000000000000000000000006e7402` | Operator | ✅ Configured |

### Output Tokens (CMY Secondaries)

| Token | Token ID | EVM Address | Supply Key | Status |
|-------|----------|-------------|------------|--------|
| **YELLOW** | `0.0.7238660` | `0x00000000000000000000000000000000006e7404` | Operator (immutable) | ✅ Configured |
| **CYAN** | `0.0.7238647` | `0x00000000000000000000000000000000006e73f7` | Operator (immutable) | ✅ Configured |
| **MAGENTA** | `0.0.7238650` | `0x00000000000000000000000000000000006e73fa` | Operator (immutable) | ✅ Configured |

**Note**: CMY tokens are immutable (no admin key), so supply keys cannot be migrated. These tokens were created before v0.4.5 deployment.

### Derived Output Tokens

| Token | Token ID | EVM Address | Supply Key | Status |
|-------|----------|-------------|------------|--------|
| **WHITE** | `0.0.7238662` | `0x00000000000000000000000000000000006e7406` | Operator | ✅ Configured |
| **GREY** | `0.0.7238664` | `0x00000000000000000000000000000000006e7408` | Operator | ✅ Configured |
| **PURPLE** | `0.0.7238696` | `0x00000000000000000000000000000000006e7428` | **Contract (0.0.7238692)** | ✅ Created & Configured |

### Entity-Only Token

| Token | Token ID | EVM Address | Supply Key | Status |
|-------|----------|-------------|------------|--------|
| **ORANGE** | `0.0.7238666` | `0x00000000000000000000000000000000006e740a` | Operator | ✅ Configured |

---

## Contract Architecture Changes (v0.4.2 → v0.4.5)

### New Features

1. **Extended Token Support**:
   - Added 3 new state variables: `WHITE_TOKEN_ADDR`, `GREY_TOKEN_ADDR`, `PURPLE_TOKEN_ADDR`
   - Total: 9 configurable token addresses (RGB+CMY+WHITE+GREY+PURPLE)

2. **9-Argument Setter**:
   ```solidity
   function setTokenAddresses(
       address _red, address _green, address _blue,
       address _yellow, address _cyan, address _magenta,
       address _white, address _grey, address _purple
   ) external onlyOwner
   ```

3. **Updated Event**:
   ```solidity
   event TokenAddressesUpdated(
       address indexed red, address indexed green, address indexed blue,
       address yellow, address cyan, address magenta,
       address white, address grey, address purple
   );
   ```

4. **Bug Fix**:
   - Fixed `_mixAddDeterministic()` visibility: `pure` → `view` (state variable access)

### Preserved Features

- ✅ Idempotent proof execution with replay detection
- ✅ Order-invariant hashing for commutative operations
- ✅ Input mutation guards via `inputsHashOf` mapping
- ✅ Projection registry for subtractive reasoning
- ✅ Triple-layer provenance architecture (Contract, Token, HCS)
- ✅ Domain separation (D_LIGHT, D_PAINT)

---

## Deployment Steps Executed

### Step 1: Contract Compilation & Deployment ✅

```bash
npm run build
node scripts/deploy-sdk.js
```

**Result**: Contract deployed at `0.0.7238692` with schema hash `0xf1944d69e7680639ebde87ed129a18522cdf8415d254b9a12d638df5e1ddd934`

### Step 2: PURPLE Token Creation ✅

```bash
node scripts/mint_purple.js
```

**Result**: Created `$PURPLE` token (`0.0.7238696`) with contract as supply key

### Step 3: Contract Configuration ✅

```bash
node scripts/migrate-supply-keys.js
```

**Result**: `TokenAddressesUpdated` event emitted with all 9 token addresses

**Configuration Transaction**: `0.0.7238571@1762927461.xxx`

**Event Data**:
```json
{
  "red": "0x00000000000000000000000000000000006e73f4",
  "green": "0x00000000000000000000000000000000006e73ff",
  "blue": "0x00000000000000000000000000000000006e7402",
  "yellow": "0x00000000000000000000000000000000006e7404",
  "cyan": "0x00000000000000000000000000000000006e73f7",
  "magenta": "0x00000000000000000000000000000000006e73fa",
  "white": "0x00000000000000000000000000000000006e7406",
  "grey": "0x00000000000000000000000000000000006e7408",
  "purple": "0x00000000000000000000000000000000006e7428"
}
```

---

## Known Limitations

### 1. CMY Token Supply Keys

**Issue**: YELLOW, CYAN, MAGENTA tokens cannot have supply keys migrated.

**Cause**: Tokens created without admin keys are immutable (`TOKEN_IS_IMMUTABLE` error).

**Impact**: Contract cannot autonomously mint CMY tokens via `reasonAdd()`.

**Mitigation Options**:
- **Option A**: Recreate CMY tokens with admin keys, then migrate supply keys
- **Option B**: Use existing CMY tokens for projection-based subtractive reasoning only
- **Option C**: Pre-mint CMY tokens and distribute manually (no autonomous minting)

**Recommendation**: Option A for full v0.4.5 functionality with autonomous minting.

### 2. HCS Topic

**Current**: Using v0.4.2 topic `0.0.7204585` (Ontologic Reasoning Proof Alpha Tree)

**Note**: Same topic can be used for v0.4.5 proofs. Consider creating a new topic with "v0.4.5" in the memo for clear versioning.

---

## Next Steps

### Immediate Actions

1. **Verify Contract State**:
   ```bash
   # Query contract to confirm token addresses are set
   # (Use HashScan or Mirror Node API)
   ```

2. **Associate Tokens** (if needed):
   ```bash
   node scripts/associate-tokens.js
   ```

3. **Register Projections** (for subtractive reasoning):
   ```bash
   node scripts/register-projections.js --token YELLOW
   node scripts/register-projections.js --token CYAN
   node scripts/register-projections.js --token MAGENTA
   node scripts/register-projections.js --token WHITE
   node scripts/register-projections.js --token GREY
   node scripts/register-projections.js --token PURPLE
   node scripts/register-projections.js --token ORANGE
   ```

### Testing Phase

**Test Scenarios**:

1. **Additive Reasoning (Peirce Layer)** - Blocked pending CMY supply key resolution:
   - ~~RED + GREEN → YELLOW~~
   - ~~GREEN + BLUE → CYAN~~
   - ~~RED + BLUE → MAGENTA~~

2. **Subtractive Reasoning (Tarski Layer)**:
   - GREEN - YELLOW == CYAN (projection-based)
   - BLUE - MAGENTA == CYAN
   - RED - YELLOW == MAGENTA

3. **Replay Detection**:
   - Re-execute same proof, verify `ProofReplay` event
   - Confirm cached output returned
   - Validate ~91% gas savings

4. **Triple-Layer Verification**:
   - `hash_local == hash_event == hash_hcs`
   - Verify contract event on Mirror Node
   - Verify HCS message on topic `0.0.7204585`

---

## Validation Checklist

- [x] Contract deployed successfully
- [x] All 9 token addresses configured in contract
- [x] PURPLE token created with contract as supply key
- [x] `TokenAddressesUpdated` event verified
- [ ] Token associations verified
- [ ] Projections registered for all tokens
- [ ] Additive proofs executed (pending CMY supply keys)
- [ ] Subtractive proofs executed
- [ ] Replay detection tested
- [ ] Triple-layer provenance validated

---

## Files Updated

### Smart Contract
- `contracts/reasoningContract.sol` - v0.4.5 with 9-token support

### Scripts
- `scripts/deploy-sdk.js` - SDK-based deployment (new)
- `scripts/mint_purple.js` - Updated to use `.env.example`
- `scripts/migrate-supply-keys.js` - Updated for 9-arg setter

### Configuration
- `.env.example` - Updated with v0.4.5 contract and PURPLE token

---

## Summary

✅ **Deployment Status**: Complete
✅ **Contract Configuration**: Complete
⚠️ **Supply Key Migration**: Partial (CMY tokens immutable)
⏳ **Testing**: Pending CMY token resolution

**v0.4.5 is deployed and configured**. The contract is ready for subtractive reasoning operations and entity manifest publication. Additive reasoning requires either recreating CMY tokens with admin keys or using pre-minted token pools.

---

**Report Generated**: 2025-11-12
**Contract Version**: v0.4.5
**Deployment Network**: Hedera Testnet
