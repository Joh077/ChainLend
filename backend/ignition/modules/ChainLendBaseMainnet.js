const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("ChainLendBaseMainnetModule", (m) => {
  // Paramètres Base mainnet
  const deployer = m.getAccount(0);
  
  const usdcToken = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
  const ethPriceFeed = "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70";
  const usdcPriceFeed = "0x7e860098F58bBFC8648a4311b374B1D669a2bc6B";
  const treasury = "ADRESSE_TREASURY";

  // 1. Déployer CLToken
  const clToken = m.contract("CLToken", [
    "ChainLend Token",
    "CL",
    deployer,
  ]);

  // 2. Déployer ChainLend
  const chainLend = m.contract("ChainLend", [
    usdcToken,
    ethPriceFeed,
    treasury,
    usdcPriceFeed,
    clToken,
    deployer, // owner initial
  ]);

  return { clToken, chainLend };
});