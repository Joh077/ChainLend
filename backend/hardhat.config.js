require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-viem");
require("@nomicfoundation/hardhat-verify");
require('dotenv').config()
require("solidity-coverage");

const INFURA_API_KEY = process.env.INFURA_API_KEY || "";
const PK = process.env.PK || "";
const PRIVATE_KEY_BASE = process.env.PRIVATE_KEY_BASE || "";
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
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337, 
      //chainId: 8453,
    },
    hardhat: {
      //chainId: 8453,
      chainId: 31337, 
      forking: {
        url: "https://mainnet.base.org",
      },
      accounts: {
        mnemonic: "test test test test test test test test test test test junk",
        count: 20,
        accountsBalance: "100000000000000000000000"
      },
      allowUnlimitedContractSize: true,
      blockGasLimit: 30000000,
      gas: 30000000,
      initialBaseFeePerGas: 0,
    },
  },
  etherscan: {
    apiKey: ETHERSCAN
  },
};