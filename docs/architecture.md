# Ontologic Architecture

**Version**: Alpha v0.4.2
**Date**: 2025-11-08
**Validation Status**: ✅ Complete - 8/8 proofs executed successfully

## Overview

This document describes the architecture of the Ontologic proof-of-reasoning toolkit at Alpha v0.4.2, which introduces **idempotent proof execution with replay detection** and **dual-layer reasoning** (Peirce additive + Tarski subtractive).

**Key Innovations**:
- **Idempotent Proofs**: Each proofHash executes exactly once, replays return cached outputs (~91% gas savings)
- **Order-Invariant Hashing**: Commutative operations (RED+GREEN == GREEN+RED) produce identical proofs
- **Dual-Layer Reasoning**: Peirce layer (additive, minting) + Tarski layer (subtractive, verification)
- **Input Mutation Guards**: Preimage hash verification prevents replay attacks with different tokens
- **SDK-Based Execution**: Required for Hedera JSON-RPC limitations with ContractId supply keys
- **Configurable Token Addresses**: Post-deployment configuration breaks circular deployment dependency

## Current Deployment (Testnet)

**Contract**: `0x97e00a2597C20b490fE869204B0728EF6c9F23eA` (v0.4.2)
**Contract ID**: `0.0.1822368746`
**Code Hash**: `0xc33f4e5747d3ef237fab636a0336e471cc6fa748d9c87c4c94351b6cd9e2ba16`
**HCS Topic**: `0.0.7204585` (Ontologic Reasoning Proof Alpha Tree)

**Validation Results** (8 proofs - HCS sequences 22-29):
- ✅ 3 Additive Proofs (Peirce layer): RED+GREEN→YELLOW, GREEN+BLUE→CYAN, RED+BLUE→MAGENTA
- ✅ 3 Subtractive Proofs (Tarski layer): GREEN-YELLOW==CYAN, BLUE-MAGENTA==CYAN, RED-YELLOW==MAGENTA
- ✅ 2 Negative Guards (Entity-only): ORANGE-YELLOW==RED (false), ORANGE-RED==YELLOW (false)

**See**: [V042_VALIDATION_REPORT.md](../proofs/V042_VALIDATION_REPORT.md) for complete validation details.

## Project Structure

```
ontologic/
├── contracts/
│   └── ReasoningContract.sol      # Core reasoning contract with NatSpec (v0.4.2)
├── scripts/
│   ├── lib/
│   │   ├── config.js              # Centralized configuration with getConfig()
│   │   ├── logger.js              # Structured logging utilities
│   │   ├── canonicalize.js        # Canonical JSON serialization
│   │   └── tokens.json            # Token address mapping
│   ├── deploy.js                  # Contract deployment
│   ├── mint_red.js                # Create $RED input token
│   ├── mint_green.js              # Create $GREEN input token
│   ├── mint_blue.js               # Create $BLUE input token
│   ├── mint-cmy-with-contract-key.js  # Create CMY tokens with contract supply key
│   ├── migrate-supply-keys.js     # Migrate supply keys + configure contract
│   ├── register-projections.js    # Register RGB24 color projections
│   ├── create_topic.js            # Create HCS topic for proofs
│   ├── reason-add-sdk.js          # Execute additive proofs (SDK-based)
│   ├── check-sub-sdk.js           # Execute subtractive proofs (SDK-based)
│   └── export-hcs-proofs.js       # Export HCS topic to JSON snapshot
├── proofs/
│   ├── V042_VALIDATION_REPORT.md  # Comprehensive v0.4.2 validation report
│   └── hcs-topic-0.0.7204585-v042.json  # HCS topic snapshot
├── hardhat.config.ts              # Hardhat configuration for Hedera
├── package.json                   # Dependencies and scripts
├── .env                           # Environment configuration (7 tokens)
├── CLAUDE.md                      # Complete project documentation
└── README.md                      # User-facing documentation
```

## Refactor Changes

### 1. Modular Architecture

#### Before
- All configuration and logic embedded in individual scripts
- Repeated code for environment loading, error handling, and logging
- No shared utilities or helpers

#### After
- **scripts/lib/config.js**: Centralized configuration with validation
- **scripts/lib/logger.js**: Structured logging with consistent formatting
- **scripts/lib/proof.js**: Canonical proof utilities
- DRY principles applied across all scripts

### 2. Comprehensive JSDoc Annotations

All exported functions now include:
- `@fileoverview` for module purpose
- `@module` declarations
- `@param` type annotations
- `@returns` documentation
- `@throws` error conditions
- `@typedef` for complex types

Example:
```javascript
/**
 * @fileoverview Execute proof-of-reasoning operations on Hedera
 * @module scripts/reason
 */

/**
 * Perform a complete proof-of-reasoning operation
 * @param {Object} options - Operation options
 * @param {number} [options.inputUnits=1] - Number of input units to process
 * @returns {Promise<{txHash: string, proof: Object, canonical: string}>}
 * @throws {Error} If operation fails
 */
async function performReasoning(options = {}) {
  // ...
}
```

### 3. Consistent Error Handling

#### Before
```javascript
main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
```

#### After
```javascript
async function main() {
  try {
    logger.section("Task Name");
    // ... operation
    logger.success("Task complete!");
  } catch (err) {
    logger.error("Task failed", err);
    process.exit(1);
  }
}
```

### 4. Programmatic Exports

All scripts now export their core functions for reuse:

```javascript
// Export for programmatic use
export { performReasoning, executeReasoning, submitProofToHCS };

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
```

This enables:
- Testing without side effects
- Composition in other scripts
- Library-style usage

### 5. Enhanced Smart Contract Documentation

#### Contract Structure
- Organized sections with Solmate-style comments (`/*//////////////...*/`)
- Comprehensive NatSpec for all functions
- Clear separation of state, events, modifiers, and functions

#### Example:
```solidity
/**
 * @notice Execute a reasoning operation
 * @dev Validates input token balances, mints output tokens, and emits proof event
 * @param ruleId Identifier of rule to execute
 * @param inputUnits Number of input units to process
 * @return minted Number of output tokens minted
 */
function reason(...) external returns (uint64 minted) {
  // ...
}
```

### 6. Structured Logging

#### Before
```javascript
console.log("Creating token...");
console.log("✅ Token created:", tokenId);
```

#### After
```javascript
logger.section("Create Token");
logger.info("Creating token...", { treasury, supply });
logger.success("Token created", { tokenId, evmAddress });
logger.verificationLinks(txHash);
```

Benefits:
- Consistent formatting with timestamps
- Structured data output (JSON)
- Clear visual hierarchy
- Reusable verification link formatter

### 7. Configuration Management

#### lib/config.js Features
- Environment variable validation
- Type-safe configuration getters
- Constants from CLAUDE.md
- Clear error messages for missing vars

```javascript
export function getOperatorConfig() {
  validateEnvVars(["OPERATOR_ID", "OPERATOR_DER_KEY", ...]);
  return {
    id: process.env.OPERATOR_ID,
    derKey: process.env.OPERATOR_DER_KEY,
    // ...
  };
}
```

### 8. Proof Generation Utilities

#### lib/proof.js Features
- Canonical proof creation
- Proof validation
- Hash verification
- Type definitions

```javascript
const { proof, canonical, hash } = createCanonicalProof({
  domain: "color",
  subdomain: "paint",
  operator: "mix_paint",
  inputs: [...],
  output: {...},
});
```

## Dual-Domain Architecture (Alpha v0.3)

### Domain Model

Alpha v0.3 introduces **composable domain logic** where the same input tokens produce different outputs based on reasoning context:

**Light Domain (Additive Color Mixing)**
- **Domain**: `color.additive`
- **Operator**: `mix_light`
- **Physical Model**: When red, green, and blue light sources combine, they produce white light
- **Rule**: RED + GREEN + BLUE → WHITE
- **Contract Address**: `0xC3Bed03792d94BC3f99eb295bCA1ce7632E7f08B`
- **Rule ID**: `0xdd1480153360259fb34ae591a5e4be71d81827a82318549ca838be2b91346e65`

**Paint Domain (Subtractive Color Mixing)**
- **Domain**: `color.subtractive`
- **Operator**: `mix_paint`
- **Physical Model**: When red, green, and blue pigments mix, they produce grey/brown
- **Rule**: RED + GREEN + BLUE → GREY
- **Contract Address**: `0xC3Bed03792d94BC3f99eb295bCA1ce7632E7f08B`
- **Rule ID**: `0x4e8881312f98809e731a219db65a5bdf0df53d4e966f948cd11c091e8ae047ea`

### Domain Selection Implementation

**CLI Interface** (`reason.js`):
```bash
# Execute light domain reasoning
node scripts/reason.js --domain light

# Execute paint domain reasoning
node scripts/reason.js --domain paint
```

**Domain Configuration Mapping**:
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

**Domain Selection Flow**:
1. Parse `--domain` CLI flag (defaults to "paint")
2. Load domain-specific configuration from `DOMAIN_CONFIG`
3. Select appropriate rule ID from `ACTIVE_RULE_IDS`
4. Generate domain-scoped canonical proof with `subdomain` field
5. Execute reasoning and mint domain-specific output token
6. Submit canonical proof to HCS with domain context

### Token Architecture

**Input Tokens (Reusable Across Domains)**:
- **$RED** (`0.0.7204552`): EVM `0x006deec8`, Metadata: `#FF0000`
- **$GREEN** (`0.0.7204840`): EVM `0x006defe8`, Metadata: `#00FF00`
- **$BLUE** (`0.0.7204565`): EVM `0x006deed5`, Metadata: `#0000FF`

**Output Tokens (Domain-Specific)**:
- **$WHITE** (`0.0.7204868`): EVM `0x006df004`, Light domain output
- **$GREY** (`0.0.7204885`): EVM `0x006df015`, Paint domain output
- **$PURPLE** (`0.0.7204602`): EVM `0x006deefa`, Proof A output (RED + BLUE)

All output tokens have **contract as supply key** enabling autonomous minting.

### Canonical Proof Structure (Domain-Scoped)

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

**Proof Hash**: `0x285de51362a08794ad428dcc103fbea005dc8e68546b3cdb7af4a88f092b8ecd`

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

**Proof Hash**: `0xf746e0d8c8eae3bff01c4c721a840430b393daf5745ea5a2f0d7742386ee912f`

**Key Observation**: Identical inputs produce **completely different proof hashes** based on the `subdomain` and `operator` fields, demonstrating deterministic domain separation at the protocol level.

### Contract Updates for Dual-Domain Support

**3-Token Rule Validation** (`reasoningContract.sol`):
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

**GREEN Token Constant**:
```solidity
/// @notice EVM address for $GREEN token (soft-gate)
/// @dev Checksummed address for 0.0.7204840
address public constant GREEN_TOKEN_ADDR = 0x00000000000000000000000000000000006DEfE8;
```

### Domain Separation Properties

**1. Deterministic Proof Hashes**
- Same inputs → Different hashes based on domain
- No collision risk between domain proofs
- Enables domain-specific proof verification

**2. Token Reusability**
- Physical tokens participate in multiple reasoning contexts
- No token duplication required
- Material assets serve different logical purposes

**3. Scalable Domain Registry**
- Domain hash computed as: `keccak256(abi.encode(domain, operator, inputs))`
- Enables future on-chain domain registry
- Supports arbitrary domain namespaces

**4. Composable Reasoning Chains**
- Future proofs can reference outputs from multiple domains
- Example: WHITE + GREY → new composite token
- Enables cross-domain reasoning logic

## Three-Layer Provenance Architecture

The dual-domain implementation maintains complete provenance across all three layers:

### Layer 1: CONTRACTCALL (Logical Validation)
**Location**: `reasoningContract.sol`
- Validates input token balances for all required tokens
- Enforces domain-specific reasoning rules
- Supports both 2-token and 3-token rule validation
- Performs checksummed address-based token checks (RED, GREEN, BLUE)
- Domain hash validation ensures rule-domain consistency

### Layer 2: TOKENMINT (Material Consequence)
**Location**: `reasoningContract.sol` + HTS precompile (0x167)
- Mints domain-specific output token via HTS
- Output varies by domain: WHITE (light), GREY (paint), PURPLE (proof A)
- Requires contract supply key permissions for output tokens
- Provides material proof of valid domain-specific reasoning
- Gas cost: ~92,710 for 3-token operations

### Layer 3: HCS MESSAGE (Consensus-Backed Provenance)
**Location**: `reason.js` → HCS topic (0.0.7204585)
- Submits canonical proof JSON with domain context
- Creates append-only, domain-scoped reasoning record
- Proof includes `subdomain` and `operator` fields for domain identification
- Enables cross-agent shared reasoning memory across domains
- Distinct proof hashes prevent domain collision

## Key Design Patterns

### 1. Fail-Fast Validation
All configuration and environment variables are validated early:
```javascript
const operatorConfig = getOperatorConfig(); // Throws if invalid
```

### 2. Separation of Concerns
- **Config**: Environment and constants
- **Logger**: Output formatting
- **Proof**: Canonical proof logic
- **Scripts**: Orchestration and execution

### 3. Async/Await Consistency
All asynchronous operations use async/await syntax:
```javascript
const result = await createRedToken();
await submitProofToHCS(canonical, topicId);
```

### 4. Pure Functions
Proof generation is side-effect-free:
```javascript
const { proof, canonical, hash } = createCanonicalProof(params);
// No mutations, no external calls
```

## Deployment Workflow (Alpha v0.3)

### 1. Initial Setup
```bash
# Deploy contract (Alpha v0.3 with 3-token support)
node scripts/deploy.js

# Create input tokens
node scripts/mint_red.js
node scripts/mint_green.js
node scripts/mint_blue.js

# Create output tokens with contract as supply key
node scripts/mint_purple.js   # For Proof A (RED + BLUE → PURPLE)
node scripts/mint_white.js    # For Light domain (RED + GREEN + BLUE → WHITE)
node scripts/mint_grey.js     # For Paint domain (RED + GREEN + BLUE → GREY)

# Create HCS topic
node scripts/create_topic.js
```

### 2. Configuration
```bash
# Set dual-domain reasoning rules
node scripts/set_rule.js
# This configures both LIGHT and PAINT domain rules
# Updates ACTIVE_RULE_IDS in config.js with returned rule IDs
```

### 3. Execution (Domain Selection)
```bash
# Execute light domain reasoning (additive color mixing)
node scripts/reason.js --domain light

# Execute paint domain reasoning (subtractive color mixing)
node scripts/reason.js --domain paint

# Short form
node scripts/reason.js -d light
```

**Output for each execution:**
- Transaction hash (CONTRACTCALL + TOKENMINT)
- Canonical proof JSON with domain context
- Proof hash (domain-specific)
- HCS submission confirmation
- Verification links (HashScan, Mirror Node)

## Environment Variables

All scripts use centralized configuration from `lib/config.js`:

**Required Variables:**
- `OPERATOR_ID` - Hedera account
- `OPERATOR_DER_KEY` - SDK format key
- `OPERATOR_HEX_KEY` - EVM format key (0x...)
- `OPERATOR_EVM_ADDR` - EVM address
- `HEDERA_RPC_URL` - JSON-RPC endpoint (testnet: https://testnet.hashio.io/api)
- `MIRROR_NODE_URL` - Mirror node API endpoint

**Token Configuration (Alpha v0.3 - 6 tokens):**
- `RED_TOKEN_ID` / `RED_ADDR` - Input token
- `GREEN_TOKEN_ID` / `GREEN_ADDR` - Input token (added in v0.3)
- `BLUE_TOKEN_ID` / `BLUE_ADDR` - Input token
- `PURPLE_TOKEN_ID` / `PURPLE_ADDR` - Output token (Proof A)
- `WHITE_TOKEN_ID` / `WHITE_ADDR` - Output token (Light domain)
- `GREY_TOKEN_ID` / `GREY_ADDR` - Output token (Paint domain)

**HCS Configuration:**
- `HCS_TOPIC_ID` - Consensus topic for reasoning proofs

## Testing Approach

With the refactored exports, testing becomes straightforward:

```javascript
import { performReasoning } from './scripts/reason.js';

// Mock environment
process.env.OPERATOR_ID = "0.0.test";
// ...

// Test function
const result = await performReasoning({ inputUnits: 1 });
assert(result.txHash);
assert(result.canonical);
```

## Future Enhancements (Proof C Scope)

### 1. Cross-Domain Composition
Enable proofs that reference outputs from multiple domains:
```solidity
// Example: Compose outputs from different domains
// WHITE (light domain) + GREY (paint domain) → new composite token
function composeFromDomains(
    address[] calldata domainOutputs,
    address compositeToken
) external returns (uint64 minted);
```

**Benefits:**
- Reasoning chains that span logical contexts
- Domain interoperability at the protocol level
- Hierarchical proof structures

### 2. Dynamic Domain Registration
Move from hardcoded domains to on-chain domain registry:
```solidity
struct DomainMetadata {
    string name;
    string description;
    address registrar;
    uint64 timestamp;
    bool active;
}

mapping(bytes32 => DomainMetadata) public domains;

function registerDomain(
    string calldata domainPath,
    string calldata description
) external returns (bytes32 domainHash);
```

**Benefits:**
- Register new domains without contract redeployment
- Namespace management and collision prevention
- Domain permissions and governance

### 3. Multi-Domain Rules
Support rules that combine logic from multiple domains:
```javascript
// Example configuration
const crossDomainRule = {
  domains: ["color.additive", "physics.optics"],
  operator: "refract_light",
  inputs: ["WHITE", "PRISM"],
  outputs: ["RED", "GREEN", "BLUE"], // Multiple outputs
};
```

### 4. Domain Metadata Extension
Extend domain definitions with richer metadata:
```javascript
const domainMetadata = {
  domain: "color.additive",
  description: "Additive color mixing (light sources)",
  units: "wavelength_nm",
  validationSchema: "ipfs://Qm...",
  dependencies: ["physics.optics"],
  registeredBy: "0x...",
  registeredAt: 1730923200,
};
```

### 5. Hooks Integration (HIP-1195)
The architecture is "hooks-ready":
- **Pre-hook**: Domain registry validation before execution
- **Post-hook**: Automatic HCS submission with domain context
- **No breaking changes** required when HIP-1195 activates

### 6. Batch Operations
Export structure enables batch domain reasoning:
```javascript
// Execute multiple domain proofs in sequence
for (const domain of ["light", "paint"]) {
  await performReasoning({ domain, inputUnits: 10 });
}
```

## Migration Notes

### Breaking Changes
**None**. All refactored scripts maintain the same CLI interface and behavior.

### New Features
- Programmatic exports for all scripts
- Structured logging with machine-readable output
- Centralized configuration management
- Enhanced error messages

### Deprecated Patterns
- Direct `dotenv.config()` calls (use `lib/config.js`)
- Inline `console.log` (use `logger.*` functions)
- Hardcoded addresses (use constants from `lib/config.js`)

## Performance Considerations

### Improvements
- Lazy environment loading (only when needed)
- Single artifact read per script execution
- Efficient proof hash computation

### Trade-offs
- Slightly larger bundle size due to utility libraries
- Additional function call overhead (negligible)

## Security Considerations

### Environment Validation
All sensitive operations validate required environment variables before execution.

### Contract Security
- Owner-only administrative functions
- Input validation before state changes
- Safe external calls with proper error handling

### Proof Integrity
- keccak256 hashing for canonical proofs
- Deterministic rule ID computation
- Event emission for audit trail

## Alpha v0.4.2 Architecture

### Idempotent Proof Execution

v0.4.2 introduces deterministic proof execution with replay detection:

**ProofData Struct**:
```solidity
struct ProofData {
    bytes32 inputsHash;   // Preimage hash of sorted inputs
    bytes32 proofHash;    // keccak256(canonical JSON)
    bytes32 factHash;     // keccak256(HCS message bytes)
    bytes32 ruleHash;     // keccak256(contract, codeHash, version)
    string canonicalUri;  // hcs://topicId/timestamp
}
```

**Key State:**
- `proofSeen` mapping - Tracks executed proofs for replay detection
- `inputsHashOf` mapping - Guards against input mutation attacks
- `cachedOutputs` mapping - Stores (token, amount) for replayed proofs

**Gas Savings**: Replay detection reduces gas consumption by ~91% (5,900 vs 69,100 gas)

### Dual-Layer Reasoning

**Peirce Layer (Additive)**:
- Logical inference produces material consequence
- Mints output tokens via HTS precompile
- Domain: `color.light`
- Operator: `mix_add@v1`
- Example: RED + GREEN → YELLOW (1 unit minted)

**Tarski Layer (Subtractive)**:
- Projection-based boolean verification
- No minting, verdict only
- Domain: `color.paint`
- Operator: `check_sub@v1`
- Example: GREEN - YELLOW == CYAN (true/false)

### Order-Invariant Hashing

Commutative operations produce identical proofs:

```javascript
// Both produce the same inputsHash and proofHash
RED + GREEN == GREEN + RED

// Implementation
const [X, Y] = (A < B) ? [A, B] : [B, A];
const inputsHash = keccak256(encode([X, Y, domain, operator]));
```

### SDK-Based Execution Pattern

Due to Hedera JSON-RPC limitations with ContractId supply keys:

```javascript
// SDK script orchestration (reason-add-sdk.js)
1. Build canonical proof JSON
2. Post to HCS via TopicMessageSubmitTransaction
3. Call contract via ContractExecuteTransaction with ProofData
4. Contract validates logic, mints tokens, emits events
5. Triple-layer provenance achieved
```

**Benefits**:
- Separation of concerns (contract logic vs orchestration)
- Modularity (HCS submission evolves independently)
- Verifiability (triple equality: hash_local == hash_event == hash_hcs)
- Composability (same contract serves multiple HCS topics)

### Configurable Token Addresses

Breaks circular deployment dependency:

**Deployment Sequence**:
1. Deploy contract (no token addresses required)
2. Mint CMY tokens with treasury as supply key
3. Migrate supply keys to contract via `TokenUpdateTransaction`
4. Configure contract via `setTokenAddresses()` call

**setTokenAddresses() Function**:
```solidity
function setTokenAddresses(
    address red, address green, address blue,
    address yellow, address cyan, address magenta
) external onlyOwner {
    RED = red;
    GREEN = green;
    BLUE = blue;
    YELLOW = yellow;
    CYAN = cyan;
    MAGENTA = magenta;
}
```

### Token Configuration (v0.4.2)

**Input Tokens (RGB Primaries)**:
- $RED: `0.0.7204552` (EVM: `0x...006deec8`)
- $GREEN: `0.0.7204840` (EVM: `0x...006defe8`)
- $BLUE: `0.0.7204565` (EVM: `0x...006deed5`)

**Output Tokens (CMY Secondaries, Contract as Supply Key)**:
- $YELLOW: `0.0.7218008` (EVM: `0x...006e2358`)
- $CYAN: `0.0.7218009` (EVM: `0x...006e2359`)
- $MAGENTA: `0.0.7218010` (EVM: `0x...006e235a`)

**Entity-Only Token**:
- $ORANGE: `0.0.7217513` (EVM: `0x...006e2169`) - Projections registered, no proof operations

### Canonical Proof Schema (v0.4.2)

**Additive Proof Example**:
```json
{
  "v": "0.4.2",
  "layer": "peirce",
  "mode": "additive",
  "domain": "color.light",
  "operator": "mix_add@v1",
  "inputs": [
    {"token": "0x...006deec8"},
    {"token": "0x...006defe8"}
  ],
  "output": {"amount": "1", "token": "0x...006e2358"},
  "rule": {
    "contract": "0x97e00a2597c20b490fe869204b0728ef6c9f23ea",
    "codeHash": "0xc33f4e5747d3ef237fab636a0336e471cc6fa748d9c87c4c94351b6cd9e2ba16",
    "functionSelector": "0xc687cfeb",
    "version": "v0.4.2"
  },
  "signer": "0xf14e3ebf486da30f7295119051a053d167b7eb5e",
  "topicId": "0.0.7204585",
  "ts": "2025-11-08T06:53:34.740Z"
}
```

**Subtractive Proof Example**:
```json
{
  "v": "0.4.2",
  "layer": "tarski",
  "mode": "subtractive",
  "domain": "color.paint",
  "operator": "check_sub@v1",
  "epsilon": 0,
  "inputs": [
    {"label": "A", "token": "0x...006defe8"},
    {"label": "B", "token": "0x...006e2358"},
    {"label": "C", "token": "0x...006e2359"}
  ],
  "relation": "A-B==C",
  "rule": {...},
  "signer": "0xf14e3ebf486da30f7295119051a053d167b7eb5e",
  "topicId": "0.0.7204585",
  "ts": "2025-11-08T06:55:52.098Z"
}
```

### Deployment Workflow (v0.4.2)

**Step 1: Deploy Contract**
```bash
npx hardhat compile
node scripts/deploy.js
# Capture CONTRACT_ADDR and CODE_HASH
```

**Step 2: Create Tokens**
```bash
# Create RGB input tokens
node scripts/mint_red.js
node scripts/mint_green.js
node scripts/mint_blue.js

# Create CMY output tokens with admin keys
node scripts/mint-cmy-with-contract-key.js
```

**Step 3: Migrate Supply Keys & Configure Contract**
```bash
# Single atomic script performs both operations:
# 1. Update CMY token supply keys to contract
# 2. Call contract.setTokenAddresses() with RGB+CMY addresses
node scripts/migrate-supply-keys.js
```

**Step 4: Register Projections**
```bash
# Required for subtractive reasoning
node scripts/register-projections.js --token YELLOW
node scripts/register-projections.js --token CYAN
node scripts/register-projections.js --token MAGENTA
```

**Step 5: Execute Proofs**
```bash
# Additive proofs (Peirce layer)
node scripts/reason-add-sdk.js --A RED --B GREEN --out YELLOW

# Subtractive proofs (Tarski layer)
node scripts/check-sub-sdk.js --A GREEN --B YELLOW --C CYAN
```

## Conclusion

**Alpha v0.4.2 successfully demonstrates idempotent proof-of-reasoning with dual-layer reasoning (Peirce + Tarski) on Hedera**, establishing a robust foundation for verifiable reasoning systems.

### Key Achievements (v0.4.2)

✅ **Idempotent Proof Execution**: Each proofHash executes exactly once
- Replay detection via `proofSeen` mapping
- Cached outputs for replayed proofs
- ~91% gas savings on replay (5,900 vs 69,100 gas)

✅ **Order-Invariant Hashing**: Commutative operations produce identical proofs
- RED+GREEN == GREEN+RED (same proofHash)
- `inputsHash` uses sorted addresses
- Deterministic proof identity

✅ **Input Mutation Guards**: Prevents replay attacks with different tokens
- `inputsHashOf` mapping verifies preimage hash
- Cannot reuse proofHash with different input tokens
- Cryptographic proof integrity

✅ **Dual-Layer Reasoning**: Peirce (additive) + Tarski (subtractive)
- Peirce layer: Logical inference produces material tokens (minting)
- Tarski layer: Boolean verification with projection math (no minting)
- Domain-scoped operations (color.light vs color.paint)

✅ **Complete Provenance**: Triple-layer validation for all 8 proofs
- Layer 1: Contract validates logic and enforces rules
- Layer 2: HTS mints output tokens (additive only)
- Layer 3: HCS records canonical proofs with consensus timestamps

✅ **Configurable Architecture**: Breaks circular deployment dependency
- Deploy contract first (no token addresses required)
- Mint tokens with treasury as supply key
- Migrate supply keys to contract
- Configure contract via `setTokenAddresses()`

✅ **SDK-Based Execution**: Handles Hedera JSON-RPC limitations
- Uses Hedera SDK's `ContractExecuteTransaction` for contract calls
- Separation of concerns (contract logic vs orchestration)
- Modular HCS submission (can evolve independently)

### Validation Results

✅ **8/8 Proofs Executed Successfully** (HCS sequences 22-29):
- 3 Additive (Peirce): RED+GREEN→YELLOW, GREEN+BLUE→CYAN, RED+BLUE→MAGENTA
- 3 Subtractive (Tarski): GREEN-YELLOW==CYAN, BLUE-MAGENTA==CYAN, RED-YELLOW==MAGENTA
- 2 Negative Guards: ORANGE-YELLOW==RED (false), ORANGE-RED==YELLOW (false)

✅ **Triple Equality Verified**: hash_local == hash_event == hash_hcs for all proofs

### Architecture Quality

✅ **Clarity**: Comprehensive NatSpec, detailed validation report, clear documentation
✅ **Security**: Input mutation guards, replay detection, owner-only configuration
✅ **Efficiency**: ~91% gas savings on replay, deterministic RGB→CMY mapping
✅ **Modularity**: SDK orchestration pattern, configurable token addresses
✅ **Verifiability**: Triple-layer provenance, HCS topic snapshot export

### Production Readiness

The codebase is **production-ready** with:
- ✅ Complete E2E validation ([V042_VALIDATION_REPORT.md](../proofs/V042_VALIDATION_REPORT.md))
- ✅ Live deployment on Hedera testnet (contract `0x97e00a2597C20b490fE869204B0728EF6c9F23eA`)
- ✅ Verified transactions on HashScan
- ✅ HCS consensus records (topic `0.0.7204585`, sequences 22-29)
- ✅ Full documentation suite (CLAUDE.md, README.md, architecture.md, validation report)
- ✅ Idempotent proof execution with replay detection
- ✅ Input mutation attack prevention
- ✅ Dual-layer reasoning (additive + subtractive)

**Next Evolution**: Future versions will explore dynamic domain registration, cross-domain composition, proof aggregation, and cross-chain bridges.
