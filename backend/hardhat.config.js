require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-viem");
require("@nomicfoundation/hardhat-verify");
require('dotenv').config()
require("solidity-coverage");

const INFURA_API_KEY = process.env.INFURA_API_KEY || "";
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
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD"
  },
  networks: {
    sepolia: {
      url: `https://sepolia.infura.io/v3/${INFURA_API_KEY}`,
      accounts: [`0x${PK}`],
      chainId: 11155111
    },
    localhost: {
      url: "http://127.0.0.1:8546",
      chainId: 31337,
    },
    // Configuration hardhat pour fork Base
    hardhat: {
      chainId: 8453, // Force Base chainId
      forking: {
        url: `https://base-mainnet.infura.io/v3/${INFURA_API_KEY}`,
        blockNumber: 32680000, // Block fixe pour éviter trop de requêtes Infura
      },
      accounts: {
        mnemonic: "test test test test test test test test test test test junk",
        count: 20,
        accountsBalance: "100000000000000000000000" // 100,000 ETH
      },
      allowUnlimitedContractSize: true,
      blockGasLimit: 30000000,
      gas: 30000000,
      initialBaseFeePerGas: 0,
    }
  },
  etherscan: {
    apiKey: ETHERSCAN
  },
};