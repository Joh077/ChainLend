const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("ChainLendModule", (m) => {

  const deployer = m.getAccount(0);

  const ethPrice = m.getParameter("ethPrice", "300000000000");
  const usdcPrice = m.getParameter("usdcPrice", "100000000");
  
  const clToken = m.contract("CLToken", [deployer]);
  
  const mockUSDC = m.contract("MockERC20", ["USD Coin", "USDC", 6]);

  const ethPriceFeed = m.contract("MockChainlinkPriceFeed", [ethPrice, 8], {
    id: "ETH_PriceFeed"
  });
  
  const usdcPriceFeed = m.contract("MockChainlinkPriceFeed", [usdcPrice, 8], {
    id: "USDC_PriceFeed"
  });
  
  const chainLendCore = m.contract("ChainLend", 
  [
    mockUSDC,
    ethPriceFeed, 
    deployer,
    usdcPriceFeed,
    clToken,
    deployer
  ]
 );
  
  m.call(clToken, "addMinter", [chainLendCore]);
  
  return { 
    clToken, 
    mockUSDC, 
    ethPriceFeed, 
    usdcPriceFeed, 
    chainLendCore 
  };
});