const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("ChainLendETHModule", (m) => {
  // Adresses Ethereum mainnet CORRECTES avec checksum EIP-55
  const usdcToken = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"; // USDC ETH
  const ethPriceFeed = "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419"; // ETH/USD
  const usdcPriceFeed = "0x8fffffd4afb6115b954bd326cbe7b4ba576818f6"; // USDC/USD
  const treasury = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
  const owner = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

  // Déployer CLToken avec owner
  const clToken = m.contract("CLToken", [owner]);

  // Déployer ChainLend
  const chainLend = m.contract("ChainLend", [
    usdcToken,
    ethPriceFeed,
    treasury,
    usdcPriceFeed,
    clToken,
    owner
  ]);

  // Ajouter ChainLend comme minter
  m.call(clToken, "addMinter", [chainLend]);

  return { clToken, chainLend };
});