# Ontologic — Proof-of-Reasoning on Hedera

A proof-of-reasoning toolkit for Hedera using the Hiero SDK. Implements a three-layer provenance architecture where logical operations on input tokens (RED + BLUE) produce output tokens (PURPLE) with verifiable on-chain proofs.

**Status**: Alpha v0.2 deployed and operational on Hedera testnet

## Current Deployment (Testnet)

**Contract**: `0xC739f496E8dbc146a54fDBF47080AE557FF8Ea27`
**Schema Hash**: `0xf1944d69e7680639ebde87ed129a18522cdf8415d254b9a12d638df5e1ddd934`
**HCS Topic**: `0.0.7204585`

**Tokens (with RGB Metadata)**:
- **$RED**: `0.0.7204552` (EVM: `0x006deec8`) - Metadata: `#FF0000`
- **$BLUE**: `0.0.7204565` (EVM: `0x006deed5`) - Metadata: `#0000FF`
- **$PURPLE**: `0.0.7204602` (EVM: `0x006deefa`) - Metadata: `#800080`

**Active Rule**: `0xf2f46b98fc2fc538ecffaca7cdc83e722b23beeba55aa086b5c916a49ef943bd`

**Example Transaction**: [View on HashScan](https://hashscan.io/testnet/transaction/0x02c151b7ec3c11209299875f284f3d33fa6ba8d25fef1b7f089da5b0b9e0292e)

## Three-Layer Provenance Architecture

1. **Layer 1: CONTRACTCALL** - Smart contract validates input tokens and enforces reasoning rules
2. **Layer 2: TOKENMINT** - HTS precompile mints output token as material proof of valid reasoning
3. **Layer 3: HCS MESSAGE** - Canonical proof JSON submitted to consensus topic for append-only provenance

**Complete provenance chain**: Logical Inference → Material Consequence → Public Consensus Record

## Quick Start

### Prerequisites

```bash
npm install
```

### Environment Setup

Create a `.env` file in the project root:

```env
# Operator Account
OPERATOR_ID=0.0.xxxxxx
OPERATOR_DER_KEY=302e...
OPERATOR_HEX_KEY=0x...
OPERATOR_EVM_ADDR=0x...

# Network
HEDERA_RPC_URL=https://testnet.hashio.io/api
MIRROR_NODE_URL=https://testnet.mirrornode.hedera.com/api/v1

# Tokens (created during setup)
RED_TOKEN_ID=0.0.xxxxxx
BLUE_TOKEN_ID=0.0.xxxxxx
PURPLE_TOKEN_ID=0.0.xxxxxx
RED_ADDR=0x...
BLUE_ADDR=0x...
PURPLE_ADDR=0x...

# HCS Topic (created during setup)
HCS_TOPIC_ID=0.0.xxxxxx
```

### Deployment Steps

```bash
# 1. Build contracts
npx hardhat compile

# 2. Deploy ReasoningContract
node scripts/deploy.js

# 3. Create tokens with RGB metadata
node scripts/mint_red.js
node scripts/mint_blue.js
node scripts/mint_purple.js

# 4. Create HCS topic
node scripts/create_topic.js

# 5. Configure reasoning rule
node scripts/set_rule.js

# 6. Execute proof-of-reasoning
node scripts/reason.js
```

### Execute Reasoning (After Setup)

```bash
node scripts/reason.js
```

**Output**:
- Transaction hash (CONTRACTCALL + TOKENMINT)
- Canonical proof JSON with RGB color metadata
- HCS submission confirmation
- Verification links (HashScan & Mirror Node)

## Key Features

- **Self-Describing Proofs**: All tokens include RGB hex color metadata in their on-chain memos
- **Three-Layer Validation**: Complete provenance from logical validation through material consequence to consensus record
- **Autonomous Minting**: Contract holds supply key for output token, enabling trustless token creation
- **Canonical Proofs**: keccak256-hashed JSON proofs submitted to HCS for immutable record
- **Hedera-Native**: Built on HTS precompile (0x167) and HCS for network-native operations

## Architecture

**Smart Contract**: `contracts/reasoningContract.sol`
- Rule-based reasoning system
- HTS integration for token minting
- Event emission for proof verification

**Scripts**:
- `deploy.js` - Deploy ReasoningContract
- `mint_*.js` - Create tokens with metadata
- `create_topic.js` - Set up HCS topic
- `set_rule.js` - Configure reasoning rules
- `reason.js` - Execute proof-of-reasoning operations

**Utilities** (`scripts/lib/`):
- `config.js` - Environment and configuration management
- `logger.js` - Structured logging
- `proof.js` - Canonical proof generation

## Canonical Proof Format

```json
{
  "v": "0",
  "domain": "color",
  "subdomain": "paint",
  "operator": "mix_paint",
  "inputs": [
    {"token": "0.0.7204552", "alias": "red", "hex": "#FF0000"},
    {"token": "0.0.7204565", "alias": "blue", "hex": "#0000FF"}
  ],
  "output": {"token": "0.0.7204602", "alias": "purple", "hex": "#800080"},
  "ts": "2025-11-06T21:11:53.327Z"
}
```

## Documentation

- Detailed architecture overview
- Environment configuration
- Development workflows
- Hedera-specific considerations
- Future enhancements (HIP-1195 hooks)

## Verification

**Contract**: [View on HashScan](https://hashscan.io/testnet/contract/0xC739f496E8dbc146a54fDBF47080AE557FF8Ea27)

**HCS Topic**: [View Messages](https://testnet.mirrornode.hedera.com/api/v1/topics/0.0.7204585/messages)

**Example Reasoning Operation**: [View Transaction](https://hashscan.io/testnet/transaction/0x02c151b7ec3c11209299875f284f3d33fa6ba8d25fef1b7f089da5b0b9e0292e)

## License

See [LICENSE](LICENSE) for details.

## Links

- [Hedera Documentation](https://docs.hedera.com)
- [Hiero JSON-RPC](https://docs.hedera.com/hedera/smart-contracts/json-rpc)
- [Hedera Agent Kit](https://github.com/hashgraph/hedera-agent-kit)
