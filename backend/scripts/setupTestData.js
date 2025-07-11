const { ethers } = require("hardhat");

async function main() {
  console.log("🧪 Configuration des données de test...");

  // Récupérer les contrats déployés depuis Ignition
  const chainLendCore = await ethers.getContractAt("ChainLendCore", "ADRESSE_CHAINLEND_CORE");
  const mockUSDC = await ethers.getContractAt("MockERC20", "ADRESSE_MOCK_USDC");
  
  const [deployer, user1, user2, user3, ...others] = await ethers.getSigners();
  
  // 1. Distribuer USDC aux comptes de test
  console.log("💰 Distribution d'USDC aux comptes de test...");
  const usdcAmount = ethers.parseUnits("100000", 6); // 100k USDC par compte
  
  const testUsers = [deployer, user1, user2, user3];
  for (let i = 0; i < testUsers.length; i++) {
    await mockUSDC.mint(testUsers[i].address, usdcAmount);
    console.log(`   • ${testUsers[i].address}: 100,000 USDC`);
  }
  
  // 2. Créer quelques demandes de prêt de test
  console.log("\n📋 Création de demandes de prêt de test...");
  
  const testRequests = [
    {
      signer: user1,
      amount: ethers.parseUnits("1000", 6),    // 1000 USDC
      rate: 800,                               // 8%
      duration: 30 * 24 * 3600,               // 30 jours
      collateral: ethers.parseEther("0.8")     // 0.8 ETH
    },
    {
      signer: user2,
      amount: ethers.parseUnits("5000", 6),    // 5000 USDC
      rate: 1000,                              // 10%
      duration: 90 * 24 * 3600,               // 90 jours  
      collateral: ethers.parseEther("4")       // 4 ETH
    }
  ];

  for (let i = 0; i < testRequests.length; i++) {
    const req = testRequests[i];
    const chainLendWithUser = chainLendCore.connect(req.signer);
    
    try {
      await chainLendWithUser.createLoanRequest(
        req.amount,
        req.rate, 
        req.duration,
        { value: req.collateral }
      );
      
      console.log(`   ✅ Demande ${i + 1}: ${ethers.formatUnits(req.amount, 6)} USDC à ${req.rate/100}%`);
    } catch (error) {
      console.log(`   ❌ Erreur demande ${i + 1}:`, error.message);
    }
  }
  
  console.log("\n✅ Données de test configurées!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });