const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("ChainLendModule", (m) => {
  // Adresses des contracts sur Base mainnet
  const usdcAddress = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  const ethPriceFeed = "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70";
  const usdcPriceFeed = "0x7e860098F58bBFC8648a4311b374B1D669a2bc6B";
  
  // Treasury = deployer address
  const treasury = m.getAccount(0);
  const owner = m.getAccount(0);

  // Deploy CLToken first
  const clToken = m.contract("CLToken", [owner]);
  
  // Deploy ChainLend main contract
  const chainLend = m.contract("ChainLend", [
    usdcAddress,      // USDC token address
    ethPriceFeed,     // ETH/USD price feed
    treasury,         // Treasury address
    usdcPriceFeed,    // USDC/USD price feed  
    clToken,          // CL token address
    owner             // Initial owner
  ]);
  
  // Add ChainLend as minter for CL tokens
  m.call(clToken, "addMinter", [chainLend]);

  return { 
    clToken, 
    chainLend,
    // Export addresses for verification
    config: {
      usdc: usdcAddress,
      ethFeed: ethPriceFeed,
      usdcFeed: usdcPriceFeed
    }
  };
});