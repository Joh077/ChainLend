const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("ChainLendModule", (m) => {
  // Paramètres avec prix actualisés
  const deployer = m.getAccount(0);
  
  // Prix actualisés (Chainlink format: 8 décimales)
  const ethPrice = m.getParameter("ethPrice", "300000000000"); // $3000 ← CORRIGÉ !
  const usdcPrice = m.getParameter("usdcPrice", "100000000");   // $1
  
  // 1. Déployer CLToken
  const clToken = m.contract("CLToken", [deployer]);
  
  // 2. Déployer Mock USDC (6 décimales)
  const mockUSDC = m.contract("MockERC20", ["USD Coin", "USDC", 6]);
  
  // 3. Déployer Price Feeds avec IDs uniques
  const ethPriceFeed = m.contract("MockChainlinkPriceFeed", [ethPrice, 8], {
    id: "ETH_PriceFeed"
  });
  
  const usdcPriceFeed = m.contract("MockChainlinkPriceFeed", [usdcPrice, 8], {
    id: "USDC_PriceFeed"
  });
  
  // 4. Déployer ChainLendCore
  const chainLendCore = m.contract("ChainLendCore", [
    mockUSDC,           // USDC token
    ethPriceFeed,       // ETH price feed  
    deployer,           // Treasury
    usdcPriceFeed,      // USDC price feed
    clToken,            // CL token
    deployer            // Initial owner
  ]);
  
  // 5. Configuration: ChainLendCore devient minter du CLToken
  m.call(clToken, "addMinter", [chainLendCore]);
  
  return { 
    clToken, 
    mockUSDC, 
    ethPriceFeed, 
    usdcPriceFeed, 
    chainLendCore 
  };
});