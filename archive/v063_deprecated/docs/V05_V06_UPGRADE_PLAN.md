# v0.5 → v0.6 Upgrade Plan: Hedera-Native Contract Upgrades

**Date**: 2025-11-13
**Status**: Planning Complete, Ready for Implementation
**Principle**: One account, one `.env`, one source of truth. `.env.DO_NOT_USE` is sealed.

---

## Context: Current State (Pre-v0.5)

### What Works ✅
- All 9 tokens created (RGB + CMY + WHITE + BLACK + PURPLE)
- RGB tokens: 1M units held by operator 0.0.7238571
- CMY tokens: Supply keys migrated to contract
- Contract configured with correct token addresses (via owner-only script)
- HCS topic operational
- Projections registered for all tokens
- Environment standardized: `.env` as canonical source

### Critical Blocker 🔴
**Contract uses `IERC20(token).balanceOf(msg.sender)` which fails on Hedera native HTS tokens.**

**Evidence:**
- Lines 503-504 in ReasoningContract.sol
- Mirror Node confirms operator has 1M RED/GREEN/BLUE tokens
- SDK `AccountBalanceQuery` returns empty token map
- Contract balance check returns 0, causing proof execution to revert

**Root Cause:**
Hedera native HTS tokens don't properly implement ERC-20 `balanceOf` interface when queried from smart contracts. Must use HTS precompile (0x167) instead.

---

## v0.5: "Upgradeable Shell + Working Demo"

**Goal:** Deploy working reasoning contract with upgradeable architecture, balance checks temporarily disabled.

### Phase 1: Contract Changes

**Location:** `contracts/ReasoningContract.sol`

**Changes:**
1. Add version header: `// v0.5.0 - Upgradeable baseline with HTS balance checks disabled`

2. **Disable ERC-20 balance checks** in `reasonAdd()` (lines 498-504):

```solidity
// NOTE (v0.5.0): On Hedera, native HTS tokens do not reliably expose ERC20.balanceOf
// from contracts. For the hackathon build we skip on-chain balance enforcement
// and rely on HTS state + off-chain audit. v0.6 will reintroduce checks using
// the HTS precompile at 0x167.

/*
// DISABLED: ERC-20 balance checks (incompatible with Hedera native HTS)
IERC20 tokenA = IERC20(A);
IERC20 tokenB = IERC20(B);
uint8 decimalsA = _safeDecimals(A);
uint8 decimalsB = _safeDecimals(B);
require(tokenA.balanceOf(msg.sender) >= 10 ** decimalsA, "insufficient A");
require(tokenB.balanceOf(msg.sender) >= 10 ** decimalsB, "insufficient B");
*/
```

3. **Add upgrade capability**:
   - Deploy script must set contract admin key = operator key
   - Hedera's `ContractUpdateTransaction` provides native bytecode upgrade
   - No proxy pattern needed

**Also Update:** `reason()` function (line 453) with same pattern

### Phase 2: Deploy v0.5

**Script:** `scripts/deploy.js`

**Prerequisites:**
- `.env` contains current operator credentials (0.0.7238571)
- All token IDs/addresses already in `.env`

**Deployment Steps:**
```bash
# 1. Build contract
npm run build

# 2. Deploy with admin key set to operator
npm run deploy

# 3. Record outputs
# - CONTRACT_ID (e.g., 0.0.XXXXXXX)
# - CONTRACT_ADDR (0x...)
```

**Post-Deployment:**
1. Update `.env` with new `CONTRACT_ID` and `CONTRACT_ADDR`
2. Update `.env.example` to match (keep in lockstep)
3. Verify contract deployed with admin key = operator

### Phase 3: Rewire Supply Keys (One Time)

**Script:** `scripts/migrate-supply-keys.js` (update to target new contract)

**Migration:**
- CMY tokens (YELLOW, CYAN, MAGENTA): `supplyKey` → new contract
- Derived tokens (WHITE, BLACK, PURPLE): `supplyKey` → new contract
- RGB axioms (RED, GREEN, BLUE): `supplyKey` remains on operator (by design)

**Verification:**
```bash
# Query supply keys via Mirror Node or TokenInfoQuery
# Confirm:
# - YELLOW/CYAN/MAGENTA/WHITE/BLACK/PURPLE: supplyKey = new contract
# - RED/GREEN/BLUE: supplyKey = operator
# - All treasuries unchanged
```

### Phase 4: Configure Token Addresses

**Script:** `scripts/admin/configure-token-addresses.js` (new or adapt owner-only script)

**Action:**
1. Load 9 token addresses from `.env` or `scripts/lib/tokens.json`
2. Call `setTokenAddresses(red, green, blue, yellow, cyan, magenta, white, black, purple)`
3. Verify `receipt.status === "SUCCESS"`

**Verification Script:**
```javascript
// scripts/verify-contract-config.js
// Read token addresses from contract
// Compare with .env/tokens.json
// Confirm exact match
```

### Phase 5: Script Cleanup

**Folder: `scripts/`**

**Consistency Requirements:**
- All CLI scripts accept standard flags:
  ```bash
  node scripts/reason-add-sdk.js --domain light --inputs RED,GREEN
  node scripts/check-sub-sdk.js --domain paint --inputs BLACK,CYAN
  ```
- All scripts load from `.env` (via config.js)
- No hardcoded credentials or token IDs in scripts

**Rules Update:**
- `rules/rgb_cmyk_complete.json`: Set `RULE_VERSION=v0.5`

**Proofs Folder:**
- Create `proofs/v050/` for canonical proof outputs

### Phase 6: v0.5 Validation Set (Hackathon-Ready)

**Validation Proofs:**

1. **Additive (Peirce Layer, Light Domain):**
   ```bash
   node scripts/reason-add-sdk.js --A RED --B GREEN --out YELLOW
   ```
   - Expected: YELLOW minted, HCS proof logged

2. **Additive (Peirce Layer, Paint Domain - Black Synthesis):**
   ```bash
   # Requires 3-input additive rule or sequential proofs
   # RED+GREEN → YELLOW
   # YELLOW+BLUE → BLACK (paint domain)
   ```

3. **Subtractive (Tarski Layer, Paint Domain):**
   ```bash
   node scripts/check-sub-sdk.js --A BLACK --B CYAN --C RED
   # Verifies: BLACK - CYAN == RED
   ```

4. **Entity (Floridi Layer, PURPLE Manifest):**
   ```bash
   node scripts/publish-entity.js --token PURPLE --manifest ./manifests/purple.json
   ```

**Success Criteria for Each Proof:**
- ✅ Contract transaction succeeds
- ✅ Token minted (for additive proofs)
- ✅ HCS message logged to topic 0.0.7239064
- ✅ Canonical proof JSON written to `proofs/v050/{timestamp}-{operation}.json`
- ✅ Mirror Node shows transaction details
- ✅ HashScan explorer link accessible

**v0.5 Completion Gate:**
All 4 validation proofs execute successfully → **Hackathon demo baseline achieved**

---

## v0.6: "Real HTS Balance Checks"

**Goal:** Upgrade existing v0.5 contract bytecode to include proper HTS precompile balance queries.

**Key Principle:** Same contract ID as v0.5, hot-swapped bytecode using Hedera's native upgrade mechanism.

### Phase 1: Contract Implementation

**Location:** `contracts/ReasoningContract.sol`

**Changes:**

1. Add HTS balance query helper:

```solidity
/**
 * @notice Query token balance via HTS precompile
 * @dev Uses IHederaTokenService at 0x167 instead of ERC-20 interface
 * @param token HTS token address
 * @param account Account to query
 * @return balance Token balance in smallest units
 */
function _getHTSBalance(address token, address account) internal returns (uint256 balance) {
    // Call HTS precompile balanceOf(token, account)
    // Return balance from HTS native state
    // Implementation TBD based on HIP-206/376/514 interface
}
```

2. **Restore balance checks** in `reasonAdd()`:

```solidity
// v0.6.0: Proper HTS balance checks using precompile
uint8 decimalsA = _safeDecimals(A);
uint8 decimalsB = _safeDecimals(B);
uint256 balanceA = _getHTSBalance(A, msg.sender);
uint256 balanceB = _getHTSBalance(B, msg.sender);
require(balanceA >= 10 ** decimalsA, "insufficient A");
require(balanceB >= 10 ** decimalsB, "insufficient B");
```

3. Update version header: `// v0.6.0 - HTS-native balance checks via precompile`

**Research Required:**
- HTS precompile balance query signature
- Response code handling (HTS returns `int64 responseCode`)
- Proper ABI encoding for HTS calls

### Phase 2: Bytecode Upgrade (No New Deployment)

**Script:** `scripts/upgrade-contract-v06.js` (new)

**Action:**
1. Compile new v0.6 bytecode
2. Create `ContractUpdateTransaction`:
   ```javascript
   const tx = new ContractUpdateTransaction()
     .setContractId(EXISTING_CONTRACT_ID)  // v0.5 contract
     .setBytecode(v06Bytecode)             // new compiled bytecode
     .freezeWith(client)
     .sign(operatorKey);  // Admin key signature

   const receipt = await tx.execute(client);
   ```

3. Verify upgrade success:
   - Query contract via Mirror Node
   - Check bytecode hash changed
   - Confirm contract ID unchanged

**Critical Constraints:**
- Uses SAME contract ID from v0.5
- No token supply key changes needed (already pointing to this contract ID)
- All token addresses remain configured
- Admin key still set to operator

### Phase 3: Re-Validation

**Repeat v0.5 validation set:**

Run all 4 proofs from v0.5 validation:
1. RED + GREEN → YELLOW
2. Paint domain black synthesis
3. BLACK - CYAN == RED
4. PURPLE entity manifest

**Expected Behavior:**
- Identical results to v0.5
- Balance checks now execute via HTS precompile
- No reverts due to balance query failures
- Proofs written to `proofs/v060/`

**Success Criteria:**
- All proofs execute successfully
- On-chain balance guards aligned with Mirror Node reality
- Gas costs documented (compare v0.5 vs v0.6)

### Phase 4: Documentation Update

**Files to Update:**

1. `CLAUDE.md`:
   - Current deployment section: v0.6 contract details
   - Remove v0.5 balance check disclaimer
   - Note upgrade history

2. `docs/V06_VALIDATION_REPORT.md` (new):
   - Upgrade transaction details
   - Before/after bytecode hashes
   - Validation proof results
   - Gas comparison table

3. `rules/rgb_cmyk_complete.json`:
   - Set `RULE_VERSION=v0.6`

4. `.env` and `.env.example`:
   - Add `RULE_VERSION=v0.6`
   - No other changes needed

---

## Upgrade Story Summary

**v0.5: Upgradeable Baseline**
- Working reasoning contract with balance checks disabled
- Upgradeable via Hedera's native admin key mechanism
- Hackathon demo ready

**v0.6: Production-Grade Balance Checks**
- Hot-swapped bytecode on same contract ID
- HTS-native balance queries via precompile
- Full on-chain enforcement aligned with HTS state

**Key Benefits:**
- Single contract ID throughout
- No token migration needed
- No proxy complexity
- Hedera-native upgrade path
- Zero downtime transition

---

## Environment Consistency (CRITICAL)

**Single Source of Truth:** `.env`

**Files That Must Stay in Sync:**
1. `.env` (canonical, used by all scripts)
2. `.env.example` (documentation/reference, must match .env)
3. `scripts/lib/tokens.json` (derived from .env)

**Sealed Files (Never Used Again):**
- `.env.DO_NOT_USE` (owner account 0.0.6748221, used once for initial config)

**Config Loading:**
- `scripts/lib/config.js` loads from `.env` (line 15)
- All scripts import from `config.js`
- No script should load env vars directly

**Operator Account:**
- ID: 0.0.7238571
- EVM Address: 0x00000000000000000000000000000000006e73ab
- Role: Contract admin, RGB token treasury, demo executor

---

## Next Session Checklist

**Pre-Work:**
- [ ] Review this plan
- [ ] Confirm Hedera upgrade mechanism details
- [ ] Research HTS precompile balance query interface

**Implementation Order:**
1. [ ] Update contract to v0.5 (disable balance checks)
2. [ ] Deploy v0.5 with admin key
3. [ ] Migrate supply keys to new contract
4. [ ] Configure token addresses
5. [ ] Run validation proofs
6. [ ] Document v0.5 baseline
7. [ ] (Next session) Implement v0.6 HTS balance queries
8. [ ] (Next session) Upgrade bytecode via ContractUpdateTransaction
9. [ ] (Next session) Re-run validation suite
10. [ ] (Next session) Complete deployment report

**Success Metrics:**
- v0.5: All 4 validation proofs execute successfully
- v0.6: All 4 validation proofs execute with HTS balance checks
- Documentation: Complete audit trail from v0.4.5 → v0.5 → v0.6

---

**End of Plan - Ready for Tomorrow's Implementation**
