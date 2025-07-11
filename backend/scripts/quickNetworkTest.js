// scripts/quickNetworkTest.js
const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 Test réseau rapide...\n");

  try {
    const network = await ethers.provider.getNetwork();
    const blockNumber = await ethers.provider.getBlockNumber();
    const [signer] = await ethers.getSigners();
    const balance = await ethers.provider.getBalance(signer.address);

    console.log("✅ Informations réseau:");
    console.log(`   • Nom: ${network.name}`);
    console.log(`   • ChainId: ${network.chainId}`);
    console.log(`   • Bloc actuel: ${blockNumber}`);
    console.log(`   • Compte: ${signer.address}`);
    console.log(`   • Balance: ${ethers.formatEther(balance)} ETH`);

    console.log("\n🎯 Pour MetaMask, utilise:");
    console.log(`   • ChainId: ${network.chainId}`);
    console.log(`   • RPC URL: http://127.0.0.1:8545`);

  } catch (error) {
    console.error("❌ Erreur:", error.message);
  }
}
