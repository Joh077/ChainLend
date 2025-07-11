// scripts/checkAllRequests.js
const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 Vérification de toutes les demandes de prêt...\n");

  const chainLendCoreAddress = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";
  const chainLendCore = await ethers.getContractAt("ChainLendCore", chainLendCoreAddress);

  try {
    const nextRequestId = await chainLendCore.nextRequestId();
    const totalRequests = Number(nextRequestId) - 1;
    
    console.log(`📋 Total des demandes créées: ${totalRequests}\n`);

    // Analyser chaque demande
    for (let i = 1; i <= totalRequests; i++) {
      try {
        const request = await chainLendCore.getLoanRequest(i);
        
        // Déterminer le statut (enum complet)
        let statusText = "Inconnu";
        let statusColor = "";
        switch (Number(request.status)) {
          case 0:
            statusText = "En attente";
            statusColor = "🟡";
            break;
          case 1:
            statusText = "Financé";
            statusColor = "🟢";
            break;
          case 2:
            statusText = "Annulé";
            statusColor = "🔴";
            break;
          default:
            statusText = `Statut ${Number(request.status)}`;
            statusColor = "❓";
        }

        console.log(`${statusColor} Demande #${i} - ${statusText} (Code: ${Number(request.status)})`);
        console.log(`   • Emprunteur: ${request.borrower}`);
        console.log(`   • Montant: ${ethers.formatUnits(request.amountRequested, 6)} USDC`);
        console.log(`   • Taux: ${Number(request.interestRate) / 100}%`);
        console.log(`   • Durée: ${Number(request.duration) / (24 * 3600)} jours`);
        console.log(`   • Collatéral déposé: ${ethers.formatEther(request.actualCollateralDeposited)} ETH`);
        console.log(`   • Créé le: ${new Date(Number(request.createdAt) * 1000).toLocaleString()}`);
        console.log("");

      } catch (error) {
        console.log(`❌ Erreur lecture demande #${i}: ${error.message}`);
      }
    }

    // Statistiques détaillées
    console.log("📊 Analyse des statuts:");
    const stats = await chainLendCore.getProtocolStats();
    console.log(`   • Demandes totales: ${stats[0].toString()}`);
    console.log(`   • Demandes actives: ${stats[1].toString()}`);
    console.log(`   • Prêts en cours: ${stats[2].toString()}`);
    
    // Balance du contrat
    const contractBalance = await ethers.provider.getBalance(chainLendCoreAddress);
    console.log(`\n🏦 ETH total dans le contrat: ${ethers.formatEther(contractBalance)} ETH`);

    // Vérification si il y a des demandes vraiment "En attente"
    console.log("\n🎯 Prochaines étapes:");
    if (stats[1] > 0) {
      console.log("   ✅ Il y a des demandes en attente de financement");
      console.log("   🎪 Crée une page pour afficher les demandes disponibles");
      console.log("   💰 Implémente la fonction de financement pour les prêteurs");
    } else {
      console.log("   🔄 Crée une nouvelle demande pour tester le financement");
    }

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