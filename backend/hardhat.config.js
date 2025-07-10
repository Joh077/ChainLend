require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-viem");
require("@nomicfoundation/hardhat-verify");
require('dotenv').config()
require("solidity-coverage");

const INFURA = process.env.INFURA || "";
const PK = process.env.PK || "";
const ETHERSCAN = process.env.ETHERSCAN || "";

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      
    }
  },
    base: {
      url: `https://base-mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
      chainId: 8453,
      // accounts: [process.env.PRIVATE_KEY] // Pour déploiement réel plus tard
    },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD"
  },
  networks: {
    sepolia: {
      url: INFURA,
      accounts: [`0x${PK}`],
      chainId: 11155111
    },
    localhost: {
      url: "http://127.0.0.1:8546",
      chainId: 31337,
    }
  },
  etherscan: {
    apiKey: ETHERSCAN
  },
};
