# Ontologic Architecture

**Version**: 1.0 (Post-Refactor)
**Date**: 2025-11-06

## Overview

This document describes the refactored architecture of the Ontologic proof-of-reasoning toolkit. The refactor focused on clarity, maintainability, and consistency with modern TypeScript and Hedera Hiero SDK conventions while preserving all logical behaviors.

## Project Structure

```
ontologic/
├── contracts/
│   └── reasoningContract.sol      # Core reasoning contract with NatSpec
├── scripts/
│   ├── lib/
│   │   ├── config.js              # Centralized configuration management
│   │   ├── logger.js              # Structured logging utilities
│   │   └── proof.js               # Canonical proof generation & validation
│   ├── deploy.js                  # Contract deployment
│   ├── mint_red.js                # Create $RED token
│   ├── mint_blue.js               # Create $BLUE token
│   ├── mint_purple.js             # Create $PURPLE token with contract supply key
│   ├── create_topic.js            # Create HCS topic for proofs
│   ├── set_rule.js                # Configure reasoning rules
│   └── reason.js                  # Execute proof-of-reasoning operations
├── hardhat.config.ts              # Hardhat configuration for Hedera
├── package.json                   # Dependencies and scripts
├── .env                           # Environment configuration
└── CLAUDE.md                      # Project documentation
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

## Three-Layer Provenance Architecture

The refactored code clearly documents each layer:

### Layer 1: CONTRACTCALL (Logical Validation)
**Location**: `reasoningContract.sol`
- Validates input token balances
- Enforces reasoning rules
- Performs address-based token checks

### Layer 2: TOKENMINT (Material Consequence)
**Location**: `reasoningContract.sol` + HTS precompile
- Mints output token via HTS
- Requires contract supply key permissions
- Provides material proof of valid reasoning

### Layer 3: HCS MESSAGE (Consensus-Backed Provenance)
**Location**: `reason.js` → HCS topic
- Submits canonical proof JSON
- Creates append-only reasoning record
- Enables cross-agent shared memory

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

## Deployment Workflow

### 1. Initial Setup
```bash
# Deploy contract
node scripts/deploy.js

# Create tokens
node scripts/mint_red.js
node scripts/mint_blue.js
node scripts/mint_purple.js

# Create HCS topic
node scripts/create_topic.js
```

### 2. Configuration
```bash
# Set reasoning rule
node scripts/set_rule.js
```

### 3. Execution
```bash
# Perform reasoning operation
node scripts/reason.js
```

## Environment Variables

All scripts use centralized configuration from `lib/config.js`:

**Required Variables:**
- `OPERATOR_ID` - Hedera account
- `OPERATOR_DER_KEY` - SDK format key
- `OPERATOR_HEX_KEY` - EVM format key
- `OPERATOR_EVM_ADDR` - EVM address
- `HEDERA_RPC_URL` - JSON-RPC endpoint
- `RED_TOKEN_ID` / `RED_ADDR` - Token configuration
- `BLUE_TOKEN_ID` / `BLUE_ADDR` - Token configuration
- `PURPLE_TOKEN_ID` / `PURPLE_ADDR` - Token configuration
- `HCS_TOPIC_ID` - Consensus topic

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

## Future Enhancements

### Hooks Integration (HIP-1195)
The architecture is "hooks-ready":
- Pre-hook for validation
- Post-hook for automatic HCS submission
- No breaking changes required

### Multi-Rule Support
Current soft-gate can be removed:
```solidity
// Remove MVP constraint
// require(hasRed && hasBlue, "missing RED or BLUE");
```

### Batch Operations
Export structure enables batch reasoning:
```javascript
for (const rule of rules) {
  await performReasoning({ ruleId: rule.id, inputUnits: 10 });
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

## Conclusion

The refactor successfully modernizes the Ontologic codebase while preserving all logical behaviors. The new architecture provides:

✅ **Clarity**: Well-documented, organized code
✅ **Maintainability**: DRY principles and modular design
✅ **Consistency**: Uniform patterns across all scripts
✅ **Extensibility**: Easy to add new features
✅ **Testability**: Programmatic exports enable testing

The codebase is now production-ready and follows modern JavaScript/Solidity best practices for Hedera development.
