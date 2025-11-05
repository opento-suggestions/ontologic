import type { HardhatUserConfig } from "hardhat/config";
import "dotenv/config";

const HEDERA_RPC_URL = process.env.HEDERA_RPC_URL || "https://testnet.hashio.io/api";
const PRIVATE_KEY    = process.env.OPERATOR_HEX_KEY    || "";

const config: HardhatUserConfig = {
  solidity: "0.8.20",
  networks: {
    hedera: {
      type: "http",  // required for JSON-RPC endpoints
      url:      HEDERA_RPC_URL,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId:  296  // Testnet chain-id
    }
  }
};

export default config;
