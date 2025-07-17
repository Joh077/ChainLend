const { ethers } = require("hardhat");

async function main() {

  const ethPriceFeedAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const usdcPriceFeedAddress = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";
  
  try {
    console.log("Vérif maj prix");
    
    // Mettre à jour Oracle ETH
    await updateOracleIfNeeded("ETH", ethPriceFeedAddress, "300000000000"); // 3000 USD
    
    // Mettre à jour Oracle USDC  
    await updateOracleIfNeeded("USDC", usdcPriceFeedAddress, "100000000"); // 1 USD
    
    console.log("\nMaintenance terminée ! Les oracles sont à jour.");
    
  } catch (error) {
    console.error("Erreur lors de la maintenance:", error.message);
  }
}

async function updateOracleIfNeeded(name, address, price) {
  try {
    const oracle = await ethers.getContractAt([
      "function latestRoundData() external view returns (uint80 roundId, int256 price, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
      "function updatePrice(int256 _price) external"
    ], address);
    
    // Vérifier l'âge actuel
    const data = await oracle.latestRoundData();
    const currentTime = (await ethers.provider.getBlock('latest')).timestamp;
    const age = currentTime - Number(data.updatedAt);
    
    const hoursOld = Math.floor(age / 3600);
    const minutesOld = Math.floor((age % 3600) / 60);
    
    console.log(`${name}: ${age < 86400 ? 'Ok' : 'Relancez'} ${hoursOld}h ${minutesOld}m`);
    
    if (age >= 86400) {
      // Mettre à jour si plus de 24 heures
      const tx = await oracle.updatePrice(price);
      await tx.wait();
      console.log(`${name} mis à jour (était obsolète de ${hoursOld}h)`);
    } else {
      console.log(`${name} OK (encore valide pour ${Math.floor((86400 - age) / 3600)}h)`);
    }
    
  } catch (error) {
    console.log(`Erreur ${name}: ${error.message}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error", error);
    process.exit(1);
  });