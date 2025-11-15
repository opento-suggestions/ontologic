# v0.5.2-debug Validation Report

**Contract**: 0.0.7261322 (v0.5.2-debug with DebugPair event)
**Validation Date**: 2025-11-14
**Status**: ✅ OPERATIONAL - Full triple-layer provenance achieved

## Critical Fix: ProofData Struct Encoding

### Problem
`reason-add-sdk.js` was passing 8 individual parameters via `ContractFunctionParameters`, causing function selector mismatch:
- Sent selector: `0x75bd2f38` (function not found)
- Expected selector: `0xc687cfeb` (reasonAdd with ProofData tuple)

### Solution
Implemented hybrid SDK/ethers encoding pattern:
1. Use `ethers.Interface` to encode ProofData struct as tuple
2. Pass encoded bytes to Hedera SDK via `.setFunctionParameters()`

**Code Pattern**:
```javascript
import { ethers, Interface } from "ethers";

const REASONING_ABI = [
  "function reasonAdd(address A, address B, bytes32 domainHash, (bytes32 inputsHash, bytes32 proofHash, bytes32 factHash, bytes32 ruleHash, string canonicalUri) p) external returns (address outToken, uint64 amount)"
];

const iface = new Interface(REASONING_ABI);

const proofData = {
  inputsHash,
  proofHash: kCanon,
  factHash,
  ruleHash,
  canonicalUri,
};

const encodedFn = iface.encodeFunctionData("reasonAdd", [A, B, D_LIGHT, proofData]);

const tx = await new ContractExecuteTransaction()
  .setContractId(contractId)
  .setGas(300000)
  .setFunctionParameters(Buffer.from(encodedFn.slice(2), "hex"))
  .execute(client);
```

## Validation Proof 1: RED + GREEN → YELLOW

**Execution**: 2025-11-14 @ 1763162366.592247123

### Layer 3: HCS Consensus Record
- Topic: 0.0.7239064
- Sequence: 29
- Timestamp: 1763162369.899374764
- Canonical URI: `hcs://0.0.7239064/1763162369.899374764`

### Layer 1: Contract Logical Validation
- Transaction: [0.0.7238571@1763162366.592247123](https://testnet.mirrornode.hedera.com/api/v1/transactions/0.0.7238571-1763162366-592247123)
- Status: SUCCESS
- Function Selector: `0xc687cfeb` ✅
- Encoded Call Data: 778 bytes

### Layer 2: Material Consequence
- Operation: TOKENMINT
- Token: 0.0.7247769 (YELLOW, `0x00000000000000000000000000000000006e9799`)
- Amount: 1 unit
- Recipient: 0.0.7238571 (operator)
- Consensus: 1763162372.080453976

### Proof Hashes
- **inputsHash**: `0x4286d42d926e19c4a9273884ea90961113f8edb8091d535eba8ea448da9f7df8`
- **proofHash**: `0x476dd3c9ebd98e1be563d819589a0d02f43d2fe59cdc56f9b00301a8a89fae7e`
- **factHash**: `0x476dd3c9ebd98e1be563d819589a0d02f43d2fe59cdc56f9b00301a8a89fae7e`
- **ruleHash**: `0x6bc9804e9b6433b873699c286615c9b6ff38ed8bc42f9fdc48639c2285d53cbd`

## Architecture Validation

### Glass Box Junction ✅
The "Triune proof compression into on-chain morpheme" succeeded:
- **Tarski Layer**: domainHash + ruleHash → logical rule anchor
- **Material Reality**: inputsHash + factHash → physical token binding
- **Floridi Manifest**: proofHash + canonicalUri → consensus provenance

### SDK + ethers Hybrid Pattern ✅
- Hedera SDK handles transaction signing and HTS integration
- ethers.js provides battle-tested ABI encoding for complex structs
- No contract changes required
- No helper wrappers introduced

## Validation Proof 2: GREEN + BLUE → CYAN

**Execution**: 2025-11-15 @ 1763178517.096951684

### Triple-Layer Provenance
- **HCS**: Sequence 31, timestamp 1763178521.821186271
- **Transaction**: [0.0.7238571@1763178517.096951684](https://hashscan.io/testnet/transaction/0.0.7238571@1763178517.096951684)
- **inputsHash**: `0x8691d4fc4e9802b00dba8c0a2d5830da642d90c1e14d253d8e3700a733a618cf`
- **proofHash**: `0xc0ac8b9538c80b2a6bdf2adb76d8b8e874cf719bd58f6cafceb131da175c7331`
- **Canonical URI**: `hcs://0.0.7239064/1763178521.821186271`

## Validation Proof 3: RED + BLUE → MAGENTA

**Execution**: 2025-11-15 @ 1763178548.867002931

### Triple-Layer Provenance
- **HCS**: Sequence 32, timestamp 1763178552.110560000
- **Transaction**: [0.0.7238571@1763178548.867002931](https://hashscan.io/testnet/transaction/0.0.7238571@1763178548.867002931)
- **inputsHash**: `0x8f03ac868aefa4eb10c8976f8903d327efe60ae4b316516f54dab26f56f29e87`
- **proofHash**: `0x7ab2dd1f2b24139d0dfa5462ff93f93a8b74c6418998e4c101b53ea2da9077ce`
- **Canonical URI**: `hcs://0.0.7239064/1763178552.110560000`

## Generalized Proof Execution

**New CLI**: `node scripts/reason.js <bundle-path>`

**Example Bundles**:
- [examples/mvp/red-green-yellow.json](examples/mvp/red-green-yellow.json)
- [examples/mvp/green-blue-cyan.json](examples/mvp/green-blue-cyan.json)
- [examples/mvp/red-blue-magenta.json](examples/mvp/red-blue-magenta.json)

**Architecture**:
1. Load reasoning bundle (JSON)
2. Derive domain/operator hashes
3. Build canonical proof payload
4. Post to HCS (Layer 3)
5. Compute ProofData struct fields
6. Encode via ethers.Interface
7. Execute via Hedera SDK (Layer 1 + 2)

## Validation Summary

✅ **3/3 RGB→CMY Proofs Executed Successfully**

| Proof | Transaction | HCS Seq | Status |
|-------|-------------|---------|--------|
| RED+GREEN→YELLOW | 0.0.7238571@1763178487.325085160 | 30 | ✅ SUCCESS |
| GREEN+BLUE→CYAN | 0.0.7238571@1763178517.096951684 | 31 | ✅ SUCCESS |
| RED+BLUE→MAGENTA | 0.0.7238571@1763178548.867002931 | 32 | ✅ SUCCESS |

**All proofs demonstrated**:
- ✅ Function selector `0xc687cfeb` (correct ProofData tuple encoding)
- ✅ HCS consensus submission (Layer 3)
- ✅ Contract logical validation (Layer 1)
- ✅ Token mint execution (Layer 2)
- ✅ Glass Box junction operational (Triune compression)

## Next Steps
1. ✅ Encoding fix validated
2. ✅ Run RGB→CMY validation proofs
3. ✅ Generalize proof execution via bundles
4. ⏳ Strip debug instrumentation for production v0.6
5. ⏳ Document complete v0.5 deployment with all artifacts
