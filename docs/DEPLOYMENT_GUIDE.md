# Ontologic Deployment Guide

**Target Version**: v0.4.5+ (RGB ↔ CMY(K) Complete Closure)
**Network**: Hedera Testnet
**Rule Count**: 25 (12 light + 13 paint)

---

## Quick Start

### Prerequisites

1. **Hedera Testnet Account** with sufficient HBAR for:
   - Contract deployment (~$1-2)
   - Token creation (~$0.50 per token × 10)
   - Rule registration (~$0.10 per rule × 25)
   - Test proofs (~$0.05 per proof)

2. **Environment Configuration** (`.env` file):
   ```bash
   OPERATOR_ID=0.0.XXXXXXX
   OPERATOR_DER_KEY=302e020100300506032b...
   OPERATOR_HEX_KEY=922994ee3019284e...
   OPERATOR_EVM_ADDR=0x00000000000000000000000000000000006XXXXX
   ```

3. **Node.js Dependencies**:
   ```bash
   npm install
   ```

---

## Deployment Phases

### Phase 0: Contract Deployment

**Deploy ReasoningContract v0.4.5+**:

```bash
npm run build
node scripts/deploy-sdk.js
```

**Expected Output**:
```
Contract deployed at: 0.0.XXXXXXX
EVM Address: 0x00000000000000000000000000000000006XXXXX
Schema Hash: 0x...
```

**Update `.env`**:
```bash
CONTRACT_ID=0.0.XXXXXXX
CONTRACT_ADDR=0x00000000000000000000000000000000006XXXXX
```

---

### Phase 1: Token Creation

**Create RGB Primary Tokens** (operator as supply key):

```bash
node scripts/mint_red.js
node scripts/mint_green.js
node scripts/mint_blue.js
```

**Create CMY Secondary Tokens** (operator as supply key for now):

```bash
node scripts/mint_yellow.js
node scripts/mint_cyan.js
node scripts/mint_magenta.js
```

**Create Derived Tokens**:

```bash
node scripts/mint_white.js
node scripts/mint_grey.js
node scripts/mint_purple.js    # Contract as supply key
node scripts/mint_orange.js     # Entity-only
```

**Update `scripts/lib/tokens.json`** with all 10 token addresses.

**Update `.env`** with token IDs and addresses.

---

### Phase 2: Contract Configuration

**Configure Token Addresses** (9-arg setter):

```bash
node scripts/migrate-supply-keys.js
```

**Expected Output**:
```
TokenAddressesUpdated event emitted
  red: 0x...
  green: 0x...
  blue: 0x...
  yellow: 0x...
  cyan: 0x...
  magenta: 0x...
  white: 0x...
  grey: 0x...
  purple: 0x...
```

**Verify Contract State**:
```bash
# Check on HashScan or Mirror Node
https://hashscan.io/testnet/contract/0.0.XXXXXXX
```

---

### Phase 3: HCS Topic Creation

**Create Reasoning Proof Topic**:

```bash
node scripts/create_topic.js
```

**Expected Output**:
```
Topic created: 0.0.XXXXXXX
Memo: "Ontologic Reasoning Proof Alpha Tree"
```

**Update `.env`**:
```bash
HCS_TOPIC_ID=0.0.XXXXXXX
```

---

### Phase 4: Projection Registration

**Register Color Projections** (all 10 tokens × 2 domains = 20 projections):

```bash
node scripts/register-projections.js --token RED
node scripts/register-projections.js --token GREEN
node scripts/register-projections.js --token BLUE
node scripts/register-projections.js --token YELLOW
node scripts/register-projections.js --token CYAN
node scripts/register-projections.js --token MAGENTA
node scripts/register-projections.js --token WHITE
node scripts/register-projections.js --token GREY
node scripts/register-projections.js --token PURPLE
node scripts/register-projections.js --token ORANGE
```

**Or use a loop**:
```bash
for TOKEN in RED GREEN BLUE YELLOW CYAN MAGENTA WHITE GREY PURPLE ORANGE; do
  node scripts/register-projections.js --token $TOKEN
done
```

---

### Phase 5: Rule Registration

**Option A: Register All 25 Rules**:

```bash
node scripts/admin/register_all_rules.js
```

**Option B: Phased Registration**:

```bash
# Phase 1: RGB → CMY additive (3 rules)
node scripts/admin/register_all_rules.js --phase 1

# Phase 2: Light subtractive (6 rules)
node scripts/admin/register_all_rules.js --phase 2

# Phase 3: White complement (3 rules)
node scripts/admin/register_all_rules.js --phase 3

# Phase 4: CMY → RGB pairwise (3 rules)
node scripts/admin/register_all_rules.js --phase 4

# Phase 5: Triple saturation (1 rule)
node scripts/admin/register_all_rules.js --phase 5

# Phase 6: Paint subtractive (6 rules)
node scripts/admin/register_all_rules.js --phase 6

# Phase 7: Black complement (3 rules)
node scripts/admin/register_all_rules.js --phase 7
```

**Option C: Domain-Specific**:

```bash
# Light domain only (12 rules)
node scripts/admin/register_all_rules.js --domain light

# Paint domain only (13 rules)
node scripts/admin/register_all_rules.js --domain paint
```

**Dry Run** (preview without executing):

```bash
node scripts/admin/register_all_rules.js --dry-run
```

**Expected Output**:
```
═══════════════════════════════════════════════════════
  Ontologic – Batch Rule Registration (RGB↔CMYK)
═══════════════════════════════════════════════════════

📋 Rule Set: ontologic.v045.rgb_cmyk_complete
📝 Description: Complete RGB ↔ CMY(K) closure with 25 normalized rules

🎯 Rules to register: 25
   Light domain: 12 rules
   Paint domain: 13 rules

───────────────────────────────────────────────────────
⚡ Starting rule registration...

[1/25] {R,G} → YELLOW
   Domain: color.light
   Category: additive
   Operator: mix_add@v1
   ✅ Success
      Rule ID: 0x6602dbbb...
      Tx: 0.0.XXXXXXX@...

[2/25] {R,B} → MAGENTA
   ...

═══════════════════════════════════════════════════════
  Registration Complete
═══════════════════════════════════════════════════════

✅ Success: 25 rules
❌ Failed:  0 rules
📊 Total:   25 rules

📁 Results saved to: proofs/rule_registration_<timestamp>.json
```

---

### Phase 6: Token Associations & Approvals

**Associate Operator with All Tokens**:

```bash
node scripts/associate-tokens.js
```

**Approve Contract for Token Spending**:

```bash
node scripts/approve-contract.js --token RED --amount 10
node scripts/approve-contract.js --token GREEN --amount 10
node scripts/approve-contract.js --token BLUE --amount 10
# ... repeat for all tokens
```

---

## Validation & Testing

### Test 1: Additive Proof (Peirce Layer)

**Execute RED + GREEN → YELLOW**:

```bash
# Method 1: Using rule file
node scripts/reason.js --rule-file rules/rgb_cmyk_complete.json --rule-id 1

# Method 2: Direct execution (requires rule already registered)
node scripts/reason.js --A RED --B GREEN --out YELLOW
```

**Expected**:
- ✅ 1 YELLOW token minted
- ✅ HCS message submitted
- ✅ ProofAdd event emitted

### Test 2: Subtractive Check (Tarski Layer)

**Execute YELLOW − RED == GREEN?**:

```bash
node scripts/check-sub-sdk.js --A YELLOW --B RED --C GREEN --domain color.light --epsilon 0
```

**Expected** (after v0.4.6 contract fix):
- ✅ Boolean verdict returned (true)
- ✅ HCS message submitted
- ✅ ProofCheck event emitted

### Test 3: Entity Manifest (Floridi Layer)

**Publish PURPLE entity**:

```bash
node scripts/entity.js --token PURPLE --tokenId 0.0.XXXXXXX --projections.light "#800080" --projections.paint "#800080" --symbol PURPLE
```

**Expected**:
- ✅ Manifest hash computed
- ✅ HCS message submitted
- ✅ ProofEntity event emitted

### Test 4: Triple Saturation (3-Input Rule)

**Execute CYAN + MAGENTA + YELLOW → GREY**:

```bash
# Requires 3-input support in reason.js (future enhancement)
node scripts/reason.js --rule-file rules/rgb_cmyk_complete.json --rule-id 16
```

**Expected**:
- ✅ 1 GREY token minted
- ✅ HCS message submitted
- ✅ ProofAdd event emitted

---

## Post-Deployment Checklist

### Contract Verification

- [ ] Contract deployed and verified on HashScan
- [ ] All 9 token addresses configured via `setTokenAddresses()`
- [ ] `TokenAddressesUpdated` event confirmed
- [ ] Contract owns PURPLE token supply key

### Token Verification

- [ ] All 10 tokens created (RGB + CMY + WHITE + GREY + PURPLE + ORANGE)
- [ ] Token metadata JSON in memo field
- [ ] Operator associated with all tokens
- [ ] Contract associated with input tokens (RED, GREEN, BLUE)
- [ ] Contract approved to spend operator's input tokens

### Projection Verification

- [ ] 20 projections registered (10 tokens × 2 domains)
- [ ] RGB24 values match token metadata (e.g., RED = `#FF0000` = `16711680`)
- [ ] Both `color.light` and `color.paint` projections exist

### Rule Verification

- [ ] All 25 rules registered successfully
- [ ] 12 light domain rules confirmed
- [ ] 13 paint domain rules confirmed
- [ ] Results file saved to `proofs/rule_registration_<timestamp>.json`
- [ ] No duplicate ruleIds (order-invariant hashing working)

### HCS Verification

- [ ] Topic created with operator as submit key
- [ ] Topic memo: "Ontologic Reasoning Proof Alpha Tree"
- [ ] Test message submitted successfully

### Proof Execution Verification

- [ ] At least 1 additive proof executed (Peirce layer)
- [ ] At least 1 subtractive check executed (Tarski layer)
- [ ] At least 1 entity manifest published (Floridi layer)
- [ ] Triple-layer provenance validated (CONTRACTCALL + TOKENMINT + HCS)
- [ ] Replay detection tested (re-execute same proof)

---

## Common Issues & Solutions

### Issue 1: TOKEN_IS_IMMUTABLE Error

**Symptom**: Cannot migrate supply key for CMY tokens

**Cause**: Tokens created without admin key

**Solution**: Recreate tokens with admin key:
```bash
node scripts/mint_yellow.js --with-admin-key
```

### Issue 2: INVALID_SIGNATURE on HCS Submit

**Symptom**: HCS submission fails with INVALID_SIGNATURE

**Cause**: Topic submit key doesn't match operator

**Solution**: Create new topic with correct submit key:
```bash
node scripts/create_topic.js
```

### Issue 3: CONTRACT_REVERT_EXECUTED on Subtractive Checks

**Symptom**: `reasonCheckSub()` reverts instead of returning verdict

**Cause**: Contract has `require()` statements that fail before verdict logic (v0.4.5 bug)

**Solution**: Deploy v0.4.6 with non-reverting verdict functions

### Issue 4: Unsupported Additive Pair

**Symptom**: Additive proof fails with "unsupported-additive-pair"

**Cause**: Using `reasonAdd()` instead of `reason(ruleId, ...)`

**Solution**: Use rule-based execution:
```bash
node scripts/reason.js --rule-file rules/add_rb_purple.json
```

### Issue 5: Projection Missing

**Symptom**: Subtractive check fails with "projection-missing"

**Cause**: Token projection not registered for domain

**Solution**: Register projection:
```bash
node scripts/register-projections.js --token <SYMBOL>
```

---

## Maintenance Tasks

### Update Token Addresses (Post-Migration)

If you recreate tokens or migrate to new network:

1. Update `scripts/lib/tokens.json`
2. Update `.env` file with new token IDs/addresses
3. Re-run `migrate-supply-keys.js` to configure contract
4. Re-register projections for all tokens
5. Re-register rules (ruleIds will change if token addresses change)

### Query Contract State

**Read token addresses**:
```bash
# Use HashScan or Mirror Node API
https://hashscan.io/testnet/contract/0.0.XXXXXXX
```

**Query specific rule**:
```bash
# Call contract.getRule(ruleId) via SDK or JSON-RPC
node scripts/query-rule.js --rule-id 0x...
```

**List all registered rules**:
```bash
# Iterate through ruleIds from rule_registration_<timestamp>.json
node scripts/list-rules.js
```

---

## Reference

- **RGB ↔ CMY(K) Closure Documentation**: [docs/RGB_CMYK_CLOSURE.md](RGB_CMYK_CLOSURE.md)
- **Rule Set Definition**: [rules/rgb_cmyk_complete.json](../rules/rgb_cmyk_complete.json)
- **Registration Script**: [scripts/admin/register_all_rules.js](../scripts/admin/register_all_rules.js)
- **V045 Validation Report**: [V045_VALIDATION_REPORT.md](../V045_VALIDATION_REPORT.md)
- **V045 Deployment Report**: [V045_DEPLOYMENT_REPORT.md](../V045_DEPLOYMENT_REPORT.md)

---

## Support

For issues or questions:
1. Check [docs/RGB_CMYK_CLOSURE.md](RGB_CMYK_CLOSURE.md) for conceptual details
2. Review validation reports for example executions
3. Inspect `proofs/rule_registration_<timestamp>.json` for rule details
4. Query contract state on HashScan

---

**Document Version**: 1.0
**Last Updated**: 2025-11-12
**Ontologic Version**: v0.4.5+
