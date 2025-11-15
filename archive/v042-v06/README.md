# Archive: v0.4.2 - v0.6.0 Legacy Scripts

This directory contains scripts from earlier versions of Ontologic that are no longer needed for the v0.6.3 demo but are preserved for historical reference.

## Archived 2025-11-15 (v0.6.3 Cleanup)

### Legacy Version Scripts
- `reason-v041-legacy.js` - v0.4.1 reasoning execution
- `verify-v0.4.1.js` - v0.4.1 verification
- `reason-add-v042.js` - v0.4.2 reasoning execution
- `upgrade-contract-v05.js` - v0.5.x upgrade script
- `upgrade-contract-v06.js` - v0.6.0 upgrade script

### Debug & Test Scripts
- `test-address-comparison.js` - Address comparison testing
- `test-set-rule-debug.js` - setRule debugging (v0.6.3 investigation)
- `test-sorting.js` - Input sorting validation
- `debug-validation.js` - General debugging utilities

### Superseded Scripts
- `reason-add.js` - Superseded by `reason.js`
- `reason-add-sdk.js` - Superseded by `reason.js`
- `entity.js` - Superseded by `entity-v06.js`
- `set_rule.js` - Superseded by `register-rules-light-v063.js`
- `check-sub.js` - Subtractive checking (Tarski layer, not in v0.6.3 demo)
- `check-sub-sdk.js` - SDK version of above

### Utility Scripts (Setup Complete)
- `approve-allowances.js` - Token allowance approval
- `associate-and-transfer-tokens.js` - Token association + transfer
- `associate-contract-tokens.js` - Contract token association
- `associate-tokens.js` - General token association
- `batch-mint-tokens.js` - Batch token minting
- `grant-supply-key.js` - Supply key grants
- `mint-cmy-with-contract-key.js` - CMY minting with contract supply key
- `mint-wbp-operator.js` - WHITE/BLACK/PURPLE operator minting
- `query-token-addrs.js` - Token address queries
- `query-token-info.js` - Token info queries
- `register-tokens.js` - Token registration utilities
- `resolve_token_addresses.js` - Address resolution
- `setup-example-wallet.js` - Example wallet setup
- `transfer-to-contract.js` - Token transfers to contract
- `update-supply-key.js` - Supply key updates
- `export-hcs-proofs.js` - HCS proof export utilities

### Non-Core Token Scripts
- `mint_grey.js` - Grey token (not in RGB/CMY/WBP demo)
- `mint_orange.js` - Orange token (not in RGB/CMY/WBP demo)
- `mint_pink.js` - Pink token (not in RGB/CMY/WBP demo)

## Restoration

To restore any script:
```bash
cp archive/v042-v06/<script-name> scripts/
```

## Notes

All infrastructure setup (tokens, supply keys, projections, HCS topic) is complete. The remaining scripts in `scripts/` are the minimal set needed for:
1. Demo execution (reason.js, entity-v06.js)
2. Validation (validate-light-e2e-v063.js)
3. Future operations (upgrade-contract-v063.js, register-rules-light-v063.js)
4. Core token minting (RGB + CMY + WBP)
5. Infrastructure setup (deploy, create_topic, migrate-supply-keys, register-projections)
