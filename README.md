# Ontologic — Proof-of-Reasoning on Hedera

A proof-of-reasoning toolkit for Hedera using the Hiero SDK. Implements a three-layer provenance architecture with **dual-domain reasoning**, where identical input tokens produce different outputs based on logical context.

**Status**: Alpha v0.3 - Dual-Domain Reasoning deployed and operational on Hedera testnet

## Current Deployment (Testnet)

**Contract**: `0xC3Bed03792d94BC3f99eb295bCA1ce7632E7f08B`
**Schema Hash**: `0xf1944d69e7680639ebde87ed129a18522cdf8415d254b9a12d638df5e1ddd934`
**HCS Topic**: `0.0.7204585`

**Input Tokens (with RGB Metadata)**:
- **$RED**: `0.0.7204552` (EVM: `0x006deec8`) - `#FF0000`
- **$GREEN**: `0.0.7204840` (EVM: `0x006defe8`) - `#00FF00`
- **$BLUE**: `0.0.7204565` (EVM: `0x006deed5`) - `#0000FF`

**Output Tokens (Contract as Supply Key)**:
- **$PURPLE**: `0.0.7204602` (EVM: `0x006deefa`) - `#800080` (Proof A: RED + BLUE)
- **$WHITE**: `0.0.7204868` (EVM: `0x006df004`) - `#FFFFFF` (Light domain: RED + GREEN + BLUE)
- **$GREY**: `0.0.7204885` (EVM: `0x006df015`) - `#808080` (Paint domain: RED + GREEN + BLUE)

**Active Rules (Dual-Domain)**:
- **LIGHT**: `0xdd148...6e65` - `color.additive` + `mix_light` → WHITE
- **PAINT**: `0x4e888...47ea` - `color.subtractive` + `mix_paint` → GREY

**Example Transactions**:
- Light Domain: [View on HashScan](https://hashscan.io/testnet/transaction/0xb5e8e003f0dd4fb196c7161e12507bbfc529a1a7be0679ac28457b6324b7ec58)
- Paint Domain: [View on HashScan](https://hashscan.io/testnet/transaction/0xb44d4cb4fd46da5ef36419112587d2e4f9f2c4d163677eeaafe1f0864e74e6b9)

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
GREEN_TOKEN_ID=0.0.xxxxxx
BLUE_TOKEN_ID=0.0.xxxxxx
PURPLE_TOKEN_ID=0.0.xxxxxx
WHITE_TOKEN_ID=0.0.xxxxxx
GREY_TOKEN_ID=0.0.xxxxxx
RED_ADDR=0x...
GREEN_ADDR=0x...
BLUE_ADDR=0x...
PURPLE_ADDR=0x...
WHITE_ADDR=0x...
GREY_ADDR=0x...

# HCS Topic (created during setup)
HCS_TOPIC_ID=0.0.xxxxxx
```

### Deployment Steps

```bash
# 1. Build contracts
npx hardhat compile

# 2. Deploy ReasoningContract
node scripts/deploy.js

# 3. Create input tokens with RGB metadata
node scripts/mint_red.js
node scripts/mint_green.js
node scripts/mint_blue.js

# 4. Create output tokens with contract as supply key
node scripts/mint_purple.js   # For Proof A (RED + BLUE → PURPLE)
node scripts/mint_white.js    # For Light domain (RED + GREEN + BLUE → WHITE)
node scripts/mint_grey.js     # For Paint domain (RED + GREEN + BLUE → GREY)

# 5. Create HCS topic
node scripts/create_topic.js

# 6. Configure reasoning rules (sets both LIGHT and PAINT domains)
node scripts/set_rule.js

# 7. Execute proof-of-reasoning with domain selection
node scripts/reason.js --domain light   # Additive color mixing → WHITE
node scripts/reason.js --domain paint   # Subtractive color mixing → GREY
```

### Execute Reasoning (After Setup)

```bash
# Execute light domain reasoning (additive color mixing)
node scripts/reason.js --domain light

# Execute paint domain reasoning (subtractive color mixing)
node scripts/reason.js --domain paint

# Short form
node scripts/reason.js -d light
```

**Output**:
- Transaction hash (CONTRACTCALL + TOKENMINT)
- Canonical proof JSON with domain-scoped metadata and RGB colors
- HCS submission confirmation
- Verification links (HashScan & Mirror Node)

## Key Features

- **Dual-Domain Reasoning** (Alpha v0.3): Same input tokens produce different outputs based on logical context
  - Light domain (additive): RED + GREEN + BLUE → WHITE
  - Paint domain (subtractive): RED + GREEN + BLUE → GREY
  - Deterministic domain separation via canonical proof hashes
- **Self-Describing Proofs**: All tokens include RGB hex color metadata in their on-chain memos
- **Three-Layer Validation**: Complete provenance from logical validation through material consequence to consensus record
- **Autonomous Minting**: Contract holds supply key for output tokens, enabling trustless token creation
- **Canonical Proofs**: keccak256-hashed JSON proofs submitted to HCS for immutable record
- **Hedera-Native**: Built on HTS precompile (0x167) and HCS for network-native operations
- **Token Reusability**: Physical tokens participate in multiple reasoning contexts without duplication

## Architecture

**Smart Contract**: `contracts/reasoningContract.sol`
- Rule-based reasoning system
- HTS integration for token minting
- Event emission for proof verification

**Scripts**:
- `deploy.js` - Deploy ReasoningContract
- `mint_*.js` - Create tokens with RGB metadata (red, green, blue, purple, white, grey)
- `create_topic.js` - Set up HCS topic for reasoning proofs
- `set_rule.js` - Configure dual-domain reasoning rules (LIGHT and PAINT)
- `reason.js` - Execute proof-of-reasoning operations with domain selection

**Utilities** (`scripts/lib/`):
- `config.js` - Environment and configuration management
- `logger.js` - Structured logging
- `proof.js` - Canonical proof generation

## Canonical Proof Format (Domain-Scoped)

**Light Domain Example**:
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

**Paint Domain Example**:
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

**Note**: The `subdomain` and `operator` fields create distinct proof identities. Identical inputs produce different canonical proof hashes based on domain context.

## Documentation

See [CLAUDE.md](CLAUDE.md) for complete documentation including:
- Detailed architecture overview
- Proof B: Dual-Domain Reasoning section
- Environment configuration
- Development workflows
- Hedera-specific considerations
- Future enhancements (HIP-1195 hooks)

See [PROOF_B_REPORT.md](PROOF_B_REPORT.md) for complete E2E validation of dual-domain reasoning with transaction links and technical analysis.

## Verification

**Contract**: [View on HashScan](https://hashscan.io/testnet/contract/0xC3Bed03792d94BC3f99eb295bCA1ce7632E7f08B)

**HCS Topic**: [View Messages](https://testnet.mirrornode.hedera.com/api/v1/topics/0.0.7204585/messages)

**Example Reasoning Operations (Proof B - Dual-Domain)**:
- Light Domain (Additive): [View Transaction](https://hashscan.io/testnet/transaction/0xb5e8e003f0dd4fb196c7161e12507bbfc529a1a7be0679ac28457b6324b7ec58)
- Paint Domain (Subtractive): [View Transaction](https://hashscan.io/testnet/transaction/0xb44d4cb4fd46da5ef36419112587d2e4f9f2c4d163677eeaafe1f0864e74e6b9)

## License

See [LICENSE](LICENSE) for details.

## Links

- [Hedera Documentation](https://docs.hedera.com)
- [Hiero JSON-RPC](https://docs.hedera.com/hedera/smart-contracts/json-rpc)
- [Hedera Agent Kit](https://github.com/hashgraph/hedera-agent-kit)
