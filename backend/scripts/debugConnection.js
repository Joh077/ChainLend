// scripts/debugConnection.js
const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 Debug de la connexion...\n");

  try {
    // 1. Test de la connexion réseau
    const network = await ethers.provider.getNetwork();
    console.log("🌐 Réseau connecté:");
    console.log(`   • Nom: ${network.name}`);
    console.log(`   • ChainId: ${network.chainId}`);
    
    // 2. Test du bloc actuel
    const blockNumber = await ethers.provider.getBlockNumber();
    console.log(`   • Bloc actuel: ${blockNumber}`);
    
    // 3. Test des comptes
    const accounts = await ethers.getSigners();
    console.log(`   • Comptes disponibles: ${accounts.length}`);
    console.log(`   • Premier compte: ${accounts[0].address}`);
    
    // 4. Test de balance
    const balance = await ethers.provider.getBalance(accounts[0].address);
    console.log(`   • Balance: ${ethers.formatEther(balance)} ETH\n`);
    
    // 5. Test simple de déploiement d'un contrat basique
    console.log("🧪 Test de déploiement d'un contrat simple...");
    const testPrice = ethers.parseUnits("3000", 8);
    
    const MockChainlinkPriceFeed = await ethers.getContractFactory("MockChainlinkPriceFeed");
    const testContract = await MockChainlinkPriceFeed.deploy(testPrice, 8);
    await testContract.waitForDeployment();
    
    const testAddress = await testContract.getAddress();
    console.log(`   ✅ Contrat de test déployé: ${testAddress}`);
    
    // 6. Test de lecture
    const [, price] = await testContract.latestRoundData();
    console.log(`   ✅ Lecture réussie - Prix: $${ethers.formatUnits(price, 8)}`);
    
    console.log("\n🎉 Connexion OK ! Le problème vient probablement des adresses.");
    console.log("💡 Solution: Vérifier que les contrats sont bien déployés sur ce réseau.");
    
  } catch (error) {
    console.error("❌ Erreur de connexion:", error.message);
    console.log("\n💡 Solutions possibles:");
    console.log("   1. Vérifier que le nœud localhost tourne");
    console.log("   2. Vérifier la configuration hardhat.config.js");
    console.log("   3. Relancer: npx hardhat node --hostname 127.0.0.1 --port 8545");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });