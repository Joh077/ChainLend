// scripts/checkPrices.js
const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 Vérification des prix actuels...\n");

  // Adresses des contrats
  const ethPriceFeedAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const usdcPriceFeedAddress = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";
  const chainLendCoreAddress = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";

  try {
    // 1. Vérifier les prix des oracles
    const ethPriceFeed = await ethers.getContractAt("MockChainlinkPriceFeed", ethPriceFeedAddress);
    const usdcPriceFeed = await ethers.getContractAt("MockChainlinkPriceFeed", usdcPriceFeedAddress);

    const [, ethPrice] = await ethPriceFeed.latestRoundData();
    const [, usdcPrice] = await usdcPriceFeed.latestRoundData();

    console.log("💰 Prix des oracles:");
    console.log(`   • ETH: $${ethers.formatUnits(ethPrice, 8)}`);
    console.log(`   • USDC: $${ethers.formatUnits(usdcPrice, 8)}`);

    // 2. Test du calcul de collatéral
    const chainLendCore = await ethers.getContractAt("ChainLendCore", chainLendCoreAddress);
    
    const testAmount = ethers.parseUnits("100000", 6); // 100k USDC
    const requiredCollateral = await chainLendCore.calculateRequiredCollateral(testAmount);
    
    console.log("\n🧮 Test de calcul (100,000 USDC):");
    console.log(`   • Montant demandé: 100,000 USDC`);
    console.log(`   • Collatéral requis: ${ethers.formatEther(requiredCollateral)} ETH`);
    console.log(`   • Valeur du collatéral: $${(parseFloat(ethers.formatEther(requiredCollateral)) * parseFloat(ethers.formatUnits(ethPrice, 8))).toLocaleString()}`);
    console.log(`   • Ratio: ${(parseFloat(ethers.formatEther(requiredCollateral)) * parseFloat(ethers.formatUnits(ethPrice, 8)) / 100000 * 100).toFixed(1)}%`);

    // 3. Vérifications de cohérence
    const expectedETH = 150000 / parseFloat(ethers.formatUnits(ethPrice, 8));
    console.log("\n✅ Vérifications:");
    console.log(`   • Prix ETH attendu: $3000`);
    console.log(`   • Prix ETH actuel: $${ethers.formatUnits(ethPrice, 8)}`);
    console.log(`   • Collatéral attendu: ${expectedETH.toFixed(4)} ETH`);
    console.log(`   • Collatéral calculé: ${ethers.formatEther(requiredCollateral)} ETH`);
    
    if (ethers.formatUnits(ethPrice, 8) === "3000.0") {
      console.log("   🎉 Prix ETH correct à 3000$ !");
    } else {
      console.log("   ⚠️  Prix ETH différent de 3000$");
    }

  } catch (error) {
    console.error("❌ Erreur lors de la vérification:", error.message);
    console.log("\n💡 Solution: Redéployer les contrats avec --reset");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });