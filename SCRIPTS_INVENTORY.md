# Scripts Inventory - v0.6.3

## Demo Execution (Core)
- **reason.js** - Execute RGB→CMY additive reasoning proofs
- **entity-v06.js** - Execute WHITE entity attestation (Floridi layer)
- **validate-light-e2e-v063.js** - E2E validation of LIGHT domain proofs

## Verification & Debugging
- **query-transaction-mirror.js** - Query transaction details from Mirror Node
- **verify.js** - Contract verification utilities

## Infrastructure Setup (One-Time)
- **create_topic.js** - Create HCS topic for proof logging
- **deploy.js** / **deploy-sdk.js** - Deploy ReasoningContract
- **migrate-supply-keys.js** - Migrate token supply keys to contract
- **register-projections.js** - Register color domain projections

## Token Creation (One-Time)
- **mint_red.js** - Mint RED token (RGB primary)
- **mint_green.js** - Mint GREEN token (RGB primary)
- **mint_blue.js** - Mint BLUE token (RGB primary)
- **mint_yellow.js** - Mint YELLOW token (CMY secondary)
- **mint_cyan.js** - Mint CYAN token (CMY secondary)
- **mint_magenta.js** - Mint MAGENTA token (CMY secondary)
- **mint_white.js** - Mint WHITE token (entity verdict)
- **mint_black.js** - Mint BLACK token (entity verdict)
- **mint_purple.js** - Mint PURPLE token (additional)

## Future Operations
- **register-rules-light-v063.js** - Register LIGHT rules in contract registry (v0.7.0+)
- **upgrade-contract-v063.js** - Upgrade contract bytecode (limited by Hedera immutability)

## Quick Start (Judge/Demo)

**Run a complete proof chain:**
```bash
# 1. RGB→CMY proofs (Peirce layer)
node scripts/reason.js examples/mvp/red-green-yellow.json
node scripts/reason.js examples/mvp/green-blue-cyan.json
node scripts/reason.js examples/mvp/red-blue-magenta.json

# 2. WHITE entity attestation (Floridi layer)
node scripts/entity-v06.js examples/mvp/entity-white-light.json

# 3. Validate
node scripts/validate-light-e2e-v063.js
```

**All infrastructure is pre-configured:**
- Contract deployed at 0.0.7261322
- All 9 tokens created with proper supply keys
- HCS topic 0.0.7239064 operational
- Historical proofs (Seq 33-37) available

## Archive

Legacy scripts moved to `archive/v042-v06/`. See `archive/v042-v06/README.md` for details.
