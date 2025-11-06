# Ontologic Proof A - E2E Test Report (New Deployment)
Date: 2025-11-06
Network: Hedera Testnet

✅ Updated Alpha v0.2 Ontologic Deployment Summary

What Was Done

Fresh Contract Deployment: Deployed new ReasoningContract with updated token addresses.

Token Creation with Metadata: Created $RED, $BLUE, $PURPLE tokens, each embedding RGB hex metadata (#FF0000, #0000FF, #800080) for self-describing reasoning proofs.

HCS Topic Setup: Established new consensus topic for proof messages.

Rule Configuration: Added color.paint + mix_paint rule (RED + BLUE → PURPLE).

Proof Execution: Completed proof-of-reasoning operation end to end.

Three-Layer Validation: Verified CONTRACTCALL, TOKENMINT, and HCS MESSAGE layers in the provenance chain.

Contract:    0xC739f496E8dbc146a54fDBF47080AE557FF8Ea27
Rule ID:     0xf2f46b98fc2fc538ecffaca7cdc83e722b23beeba55aa086b5c916a49ef943bd
RED:         0.0.7204552  (0x006deec8)
BLUE:        0.0.7204565  (0x006deed5)
PURPLE:      0.0.7204602  (0x006deefa)
HCS Topic:   0.0.7204585

All three provenance layers validated.

Canonical proof JSON confirmed on-chain with embedded RGB color metadata.


Everything is correctly configured. 
We now have a fully self-describing, provenance-complete reasoning system live on Hedera.

Scope: color.paint domain, mix_paint operator (RED + BLUE → PURPLE)
Contract Deployment
ReasoningContract: 0xC739f496E8dbc146a54fDBF47080AE557FF8Ea27
Schema Hash: 0xf1944d69e7680639ebde87ed129a18522cdf8415d254b9a12d638df5e1ddd934
Deploy Tx: 0x141496c9d99aeb2cd361fa5147ac7cc030dc2ad349159ee21520644c9b23b67e
HashScan: https://hashscan.io/testnet/transaction/0x141496c9d99aeb2cd361fa5147ac7cc030dc2ad349159ee21520644c9b23b67e
Tokens Created
$RED Token:
Token ID: 0.0.7204552
EVM Address: 0x00000000000000000000000000000000006deec8
Metadata: {"name":"Red","symbol":"RED","color":"#FF0000"}
$BLUE Token:
Token ID: 0.0.7204565
EVM Address: 0x00000000000000000000000000000000006deed5
Metadata: {"name":"Blue","symbol":"BLUE","color":"#0000FF"}
$PURPLE Token:
Token ID: 0.0.7204602
EVM Address: 0x00000000000000000000000000000000006deefa
Supply Key: Contract (0xC739f496E8dbc146a54fDBF47080AE557FF8Ea27)
Metadata: {"name":"Purple","symbol":"PURPLE","color":"#800080"}
HCS Topic
Topic ID: 0.0.7204585
Memo: "Ontologic Reasoning Proof Alpha Tree"
Submit Key: 0.0.6748221
Messages: https://testnet.mirrornode.hedera.com/api/v1/topics/0.0.7204585/messages
Reasoning Rule Configuration
Rule ID: 0xf2f46b98fc2fc538ecffaca7cdc83e722b23beeba55aa086b5c916a49ef943bd
Domain: color.paint
Operator: mix_paint
Inputs: RED (0x006deec8) + BLUE (0x006deed5)
Output: PURPLE (0x006deefa)
Ratio: 1:1
Set Rule Tx: 0xce2ec0bb098c5904a5a502ce826658d1536c58218aed44608113a28a9af2978a
HashScan: https://hashscan.io/testnet/transaction/0xce2ec0bb098c5904a5a502ce826658d1536c58218aed44608113a28a9af2978a
Proof-of-Reasoning Execution
Reasoning Transaction: 0x02c151b7ec3c11209299875f284f3d33fa6ba8d25fef1b7f089da5b0b9e0292e
Block: 27208563
Gas Used: 79192
Proof Hash: 0x53929dc41119af8651bd34f9265b7634559a0b99f7b44a021e27d06bcf78fe80
HashScan: https://hashscan.io/testnet/transaction/0x02c151b7ec3c11209299875f284f3d33fa6ba8d25fef1b7f089da5b0b9e0292e
Three-Layer Validation
Layer 1: CONTRACTCALL (Logical Validation) ✓
Contract validated RED + BLUE token requirements
Soft-gate enforcement checked token addresses match contract constants
Status: SUCCESS
Layer 2: TOKENMINT (Material Consequence) ✓
Contract autonomously minted 1 unit of $PURPLE token
HTS precompile (0x167) executed mint operation
Supply key permissions validated
Status: SUCCESS
Layer 3: HCS MESSAGE (Consensus-Backed Provenance) ✓
Consensus Timestamp: 1762463524.374956680
Sequence Number: 1
Message (decoded):
{
  "v":"0",
  "domain":"color",
  "subdomain":"paint",
  "operator":"mix_paint",
  "inputs":[
    {"token":"0.0.7204552","alias":"red","hex":"#FF0000"},
    {"token":"0.0.7204565","alias":"blue","hex":"#0000FF"}
  ],
  "output":{"token":"0.0.7204602","alias":"purple","hex":"#800080"},
  "ts":"2025-11-06T21:11:53.327Z"
}
Status: SUCCESS
Proof includes RGB hex colors for self-describing visualizations
Verification Links
Transaction:
https://hashscan.io/testnet/transaction/0x02c151b7ec3c11209299875f284f3d33fa6ba8d25fef1b7f089da5b0b9e0292e
HCS Topic:
https://hashscan.io/testnet/topic/0.0.7204585

## Test Summary

All steps of the E2E test completed successfully:
✅ Contract compiled and deployed with new token addresses
✅ Three tokens created with RGB color metadata
✅ HCS topic created for reasoning proofs
✅ Reasoning rule configured (RED + BLUE → PURPLE)
✅ Proof-of-reasoning executed successfully
✅ Layer 1 (CONTRACTCALL) validated
✅ Layer 2 (TOKENMINT) validated
✅ Layer 3 (HCS MESSAGE) validated with complete canonical proof JSON

Complete provenance chain established: Logical Inference → Material Consequence → Public Consensus Record

## Key Improvements:
RGB Hex Color Metadata: All tokens include color metadata in their token memos, making reasoning proofs self-describing and visualization-ready
Environment Override: Added override: true to dotenv config to handle system environment variable conflicts
Fresh Deployment: New contract deployment with updated token addresses ensures clean state
Complete Three-Layer Validation: All layers of the provenance architecture verified via Mirror Node and HCS APIs