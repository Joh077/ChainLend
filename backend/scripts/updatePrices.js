// scripts/updatePrices.js
const { ethers } = require("hardhat");

async function main() {
  console.log("🔄 Mise à jour des prix des mocks...");

  // Adresses des price feeds (récupère-les depuis ton déploiement)
  const ethPriceFeedAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const usdcPriceFeedAddress = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";

  // Nouveaux prix (format Chainlink : 8 décimales)
  const newEthPrice = ethers.parseUnits("3000", 8);  // 3000 USD
  const newUsdcPrice = ethers.parseUnits("1", 8);    // 1 USD (stable)

  // Connexion aux contrats
  const ethPriceFeed = await ethers.getContractAt("MockChainlinkPriceFeed", ethPriceFeedAddress);
  const usdcPriceFeed = await ethers.getContractAt("MockChainlinkPriceFeed", usdcPriceFeedAddress);

  // Mise à jour des prix
  console.log("📈 Mise à jour du prix ETH : 2500$ → 3000$");
  await ethPriceFeed.updatePrice(newEthPrice);

  console.log("💰 Confirmation du prix USDC : 1$");
  await usdcPriceFeed.updatePrice(newUsdcPrice);

  // Vérification
  const [, ethPrice] = await ethPriceFeed.latestRoundData();
  const [, usdcPrice] = await usdcPriceFeed.latestRoundData();

  console.log("✅ Prix mis à jour :");
  console.log(`   • ETH: $${ethers.formatUnits(ethPrice, 8)}`);
  console.log(`   • USDC: $${ethers.formatUnits(usdcPrice, 8)}`);
  
  console.log("\n🧮 Nouveau calcul pour 100,000 USDC :");
  console.log(`   • Collatéral 150% : 150,000$`);
  console.log(`   • En ETH : 150,000$ ÷ 3000$ = ${150000/3000} ETH`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });