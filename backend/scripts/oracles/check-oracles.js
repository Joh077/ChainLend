const { ethers } = require("hardhat");

async function main() {

  const ethPriceFeedAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const usdcPriceFeedAddress = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";
  
  await checkOracle("ETH", ethPriceFeedAddress);
  await checkOracle("USDC", usdcPriceFeedAddress);
}

async function checkOracle(name, address) {
  try {
    const oracle = await ethers.getContractAt([
      "function latestRoundData() external view returns (uint80 roundId, int256 price, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
      "function decimals() external view returns (uint8)"
    ], address);
    
    const data = await oracle.latestRoundData();
    const decimals = await oracle.decimals();
    const currentTime = (await ethers.provider.getBlock('latest')).timestamp;
    const age = currentTime - Number(data.updatedAt);
    
    const status = age < 86400 ? 'OK' : 'OBSOLÈTE'; 
    const hoursOld = Math.floor(age / 3600);
    const minutesOld = Math.floor((age % 3600) / 60);
    const ageFormatted = `${hoursOld}h ${minutesOld}m`;
    
    const timeLeft = age < 86400 ? `(${Math.floor((86400 - age) / 3600)}h restantes)` : `(${hoursOld - 24}h de trop)`;
    
    console.log(`${name}: ${status} ${ageFormatted} ${timeLeft} - ${ethers.formatUnits(data.price, decimals)} USD`);
    
  } catch (error) {
    console.log(`${name}: Error ${error.message}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });