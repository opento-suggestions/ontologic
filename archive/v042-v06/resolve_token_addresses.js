import { TokenId } from "@hashgraph/sdk";

const ids = ["0.0.7185272", "0.0.7185298"]; // RED, BLUE
for (const id of ids) {
  const evm = "0x" + TokenId.fromString(id).toSolidityAddress();
  console.log(id, "=>", evm);
}
