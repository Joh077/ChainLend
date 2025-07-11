// scripts/setupSecondAccount.js
const { ethers } = require("hardhat");

async function main() {
  console.log("🏦 Configuration d'un compte prêteur...\n");

  const usdcAddress = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
  const mockUSDC = await ethers.getContractAt("MockERC20", usdcAddress);

  const [deployer, user1, user2, user3] = await ethers.getSigners();

  console.log("👥 Comptes disponibles:");
  console.log(`   • Compte 0 (Emprunteur): ${deployer.address}`);
  console.log(`   • Compte 1 (Prêteur): ${user1.address}`);
  console.log(`   • Compte 2: ${user2.address}`);
  console.log(`   • Compte 3: ${user3.address}`);

  // Distribuer USDC aux comptes prêteurs
  const accounts = [user1, user2, user3];
  const amountPerAccount = ethers.parseUnits("50000", 6); // 50k USDC

  console.log("\n💰 Distribution d'USDC aux prêteurs:");
  for (let i = 0; i < accounts.length; i++) {
    await mockUSDC.mint(accounts[i].address, amountPerAccount);
    const balance = await mockUSDC.balanceOf(accounts[i].address);
    
    console.log(`   ✅ ${accounts[i].address}: ${ethers.formatUnits(balance, 6)} USDC`);
  }

  console.log("\n🎯 Instructions pour tester le marketplace:");
  console.log("1. Dans MetaMask, change vers le compte 1:");
  console.log(`   ${user1.address}`);
  console.log("2. Va sur /marketplace");
  console.log("3. Tu verras les boutons 'Prêter' actifs");
  console.log("4. Clique pour financer une demande !");

  console.log("\n💡 Note:");
  console.log("   • Le compte 0 a créé les demandes → boutons 'Votre demande'");
  console.log("   • Les autres comptes peuvent les financer → boutons 'Prêter'");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });