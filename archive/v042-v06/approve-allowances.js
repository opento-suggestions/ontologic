/**
 * @fileoverview Approve token allowances for the contract
 * @module scripts/approve-allowances
 *
 * Usage: node scripts/approve-allowances.js
 *
 * Approves allowances for all 6 semantic morpheme tokens (RGB + CMY) to the contract.
 * This allows the contract to spend tokens on behalf of the operator.
 */

import {
  Client,
  AccountAllowanceApproveTransaction,
  PrivateKey,
  TokenId,
} from "@hashgraph/sdk";
import { getOperatorConfig, DEPLOYED_CONTRACT_ADDRESS } from "./lib/config.js";

async function main() {
  const operatorConfig = getOperatorConfig();

  console.log(JSON.stringify({
    stage: "init",
    ok: true,
    contractEVM: DEPLOYED_CONTRACT_ADDRESS,
    operator: operatorConfig.id
  }));

  // Convert EVM address to Hedera contract ID
  const evmAddrClean = DEPLOYED_CONTRACT_ADDRESS.toLowerCase().replace("0x", "");
  const entityNumHex = evmAddrClean.slice(-8);
  const entityNum = parseInt(entityNumHex, 16);
  const contractId = `0.0.${entityNum}`;

  console.log(JSON.stringify({
    stage: "contract-id-mapping",
    ok: true,
    evmAddress: DEPLOYED_CONTRACT_ADDRESS,
    contractId,
    entityNum
  }));

  const client = Client.forTestnet().setOperator(
    operatorConfig.id,
    operatorConfig.derKey
  );

  const operatorKey = PrivateKey.fromString(operatorConfig.derKey);

  try {
    // All 6 semantic morpheme tokens (RGB + CMY)
    const redTokenId = TokenId.fromString(process.env.RED_TOKEN_ID);
    const greenTokenId = TokenId.fromString(process.env.GREEN_TOKEN_ID);
    const blueTokenId = TokenId.fromString(process.env.BLUE_TOKEN_ID);
    const yellowTokenId = TokenId.fromString(process.env.YELLOW_TOKEN_ID);
    const cyanTokenId = TokenId.fromString(process.env.CYAN_TOKEN_ID);
    const magentaTokenId = TokenId.fromString(process.env.MAGENTA_TOKEN_ID);

    console.log(JSON.stringify({
      stage: "approve-allowances",
      ok: true,
      action: "submitting",
      allowances: [
        { token: "RED", tokenId: process.env.RED_TOKEN_ID, amount: "100" },
        { token: "GREEN", tokenId: process.env.GREEN_TOKEN_ID, amount: "100" },
        { token: "BLUE", tokenId: process.env.BLUE_TOKEN_ID, amount: "100" },
        { token: "YELLOW", tokenId: process.env.YELLOW_TOKEN_ID, amount: "100" },
        { token: "CYAN", tokenId: process.env.CYAN_TOKEN_ID, amount: "100" },
        { token: "MAGENTA", tokenId: process.env.MAGENTA_TOKEN_ID, amount: "100" }
      ],
      spender: contractId
    }));

    // Approve allowances for all 6 semantic morpheme tokens (RGB + CMY)
    const approveTx = await new AccountAllowanceApproveTransaction()
      .approveTokenAllowance(redTokenId, operatorConfig.id, contractId, 100)
      .approveTokenAllowance(greenTokenId, operatorConfig.id, contractId, 100)
      .approveTokenAllowance(blueTokenId, operatorConfig.id, contractId, 100)
      .approveTokenAllowance(yellowTokenId, operatorConfig.id, contractId, 100)
      .approveTokenAllowance(cyanTokenId, operatorConfig.id, contractId, 100)
      .approveTokenAllowance(magentaTokenId, operatorConfig.id, contractId, 100)
      .freezeWith(client);

    const signedTx = await approveTx.sign(operatorKey);
    const response = await signedTx.execute(client);
    const receipt = await response.getReceipt(client);

    console.log(JSON.stringify({
      stage: "approve-allowances",
      ok: true,
      action: "confirmed",
      status: receipt.status.toString(),
      txHash: response.transactionHash ? `0x${Buffer.from(response.transactionHash).toString('hex')}` : "N/A"
    }));

    console.log(JSON.stringify({
      stage: "complete",
      ok: true,
      message: "Approved allowances for all 6 semantic morpheme tokens (RGB + CMY)",
      spender: contractId,
      allowances: [
        { token: "RED", amount: 100 },
        { token: "GREEN", amount: 100 },
        { token: "BLUE", amount: 100 },
        { token: "YELLOW", amount: 100 },
        { token: "CYAN", amount: 100 },
        { token: "MAGENTA", amount: 100 }
      ]
    }));

  } catch (error) {
    console.error(JSON.stringify({
      stage: "error",
      ok: false,
      error: error.message,
      details: error.toString()
    }));
    process.exit(1);
  } finally {
    client.close();
  }
}

main();
