// scripts/verifyMarketplaceData.js
const { ethers } = require("hardhat");

async function main() {
  console.log("🏪 Vérification des données Marketplace...\n");

  const chainLendCoreAddress = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";
  const chainLendCore = await ethers.getContractAt("ChainLendCore", chainLendCoreAddress);

  try {
    // 1. Récupérer les demandes en attente (comme le fait le frontend)
    console.log("📋 Récupération des demandes en attente...");
    const [pendingIds, hasMore] = await chainLendCore.getPendingRequests(0, 100);
    
    console.log(`   • Nombre de demandes: ${pendingIds.length}`);
    console.log(`   • IDs: [${pendingIds.map(id => Number(id)).join(', ')}]`);
    console.log(`   • Plus de demandes: ${hasMore}\n`);

    // 2. Détailler chaque demande (comme le fera le frontend)
    console.log("🔍 Détails des demandes pour le marketplace:\n");
    
    for (let i = 0; i < pendingIds.length; i++) {
      const requestId = Number(pendingIds[i]);
      const request = await chainLendCore.getLoanRequest(requestId);
      
      // Formatage pour l'affichage (comme dans le composant)
      const borrower = request.borrower;
      const avatar = borrower.slice(2, 6).toUpperCase(); // 4 premiers caractères
      const displayName = `${borrower.slice(0, 6)}...${borrower.slice(-4)}`;
      const amount = ethers.formatUnits(request.amountRequested, 6);
      const collateral = ethers.formatUnits(request.actualCollateralDeposited, 18);
      const apr = (Number(request.interestRate) / 100).toFixed(1);
      const durationDays = Math.floor(Number(request.duration) / (24 * 3600));
      
      // Calcul des intérêts
      const principal = parseFloat(amount);
      const rate = Number(request.interestRate) / 10000;
      const totalInterest = (principal * rate * durationDays) / 365;
      
      console.log(`💰 Demande #${requestId}:`);
      console.log(`   • Avatar: "${avatar}"`);
      console.log(`   • Nom affiché: "${displayName}"`);
      console.log(`   • Emprunteur: ${borrower}`);
      console.log(`   • Montant: ${parseFloat(amount).toLocaleString()} USDC`);
      console.log(`   • Taux: ${apr}% par an`);
      console.log(`   • Durée: ${durationDays} jours`);
      console.log(`   • Collatéral: ${parseFloat(collateral).toFixed(2)} ETH`);
      console.log(`   • Intérêts estimés: ${totalInterest.toFixed(2)} USDC`);
      console.log(`   • Statut: ${Number(request.status)} (0=Pending)`);
      console.log("");
    }

    // 3. Test avec différents comptes
    const [deployer, user1] = await ethers.getSigners();
    console.log("👥 Test des permissions:");
    console.log(`   • Emprunteur (compte qui a créé): ${deployer.address}`);
    console.log(`   • Prêteur potentiel: ${user1.address}`);
    
    if (pendingIds.length > 0) {
      const firstRequest = await chainLendCore.getLoanRequest(Number(pendingIds[0]));
      const sameUser = deployer.address.toLowerCase() === firstRequest.borrower.toLowerCase();
      console.log(`   • Même utilisateur: ${sameUser ? "Oui → Bouton 'Votre demande'" : "Non → Bouton 'Prêter'"}`);
    }

    // 4. Vérifier les balances USDC pour le financement
    const usdcAddress = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
    const mockUSDC = await ethers.getContractAt("MockERC20", usdcAddress);
    
    console.log("\n💳 Balances USDC:");
    const accounts = [deployer, user1];
    for (let i = 0; i < accounts.length; i++) {
      const balance = await mockUSDC.balanceOf(accounts[i].address);
      console.log(`   • ${accounts[i].address}: ${ethers.formatUnits(balance, 6)} USDC`);
    }

    console.log("\n✅ Données prêtes pour le marketplace!");
    console.log("🎯 Le frontend devrait afficher toutes ces demandes avec les bons formats.");

  } catch (error) {
    console.error("❌ Erreur:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });