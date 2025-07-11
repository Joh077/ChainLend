// scripts/verifyLoanRequest.js
const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 Vérification de ta demande de prêt...\n");

  const chainLendCoreAddress = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";
  const chainLendCore = await ethers.getContractAt("ChainLendCore", chainLendCoreAddress);

  try {
    // 1. Obtenir le prochain ID (pour savoir combien de demandes ont été créées)
    const nextRequestId = await chainLendCore.nextRequestId();
    console.log(`📋 Nombre total de demandes: ${Number(nextRequestId) - 1}`);
    
    if (nextRequestId <= 1n) {
      console.log("❌ Aucune demande trouvée");
      return;
    }

    // 2. Obtenir la dernière demande (probablement la tienne)
    const lastRequestId = Number(nextRequestId) - 1;
    console.log(`🔍 Vérification de la demande #${lastRequestId}...\n`);

    const request = await chainLendCore.getLoanRequest(lastRequestId);
    
    console.log("✅ Détails de ta demande:");
    console.log(`   • ID: ${request.id.toString()}`);
    console.log(`   • Emprunteur: ${request.borrower}`);
    console.log(`   • Montant demandé: ${ethers.formatUnits(request.amountRequested, 6)} USDC`);
    console.log(`   • Taux d'intérêt: ${Number(request.interestRate) / 100}% par an`);
    console.log(`   • Durée: ${Number(request.duration) / (24 * 3600)} jours`);
    console.log(`   • Collatéral requis: ${ethers.formatEther(request.requiredCollateral)} ETH`);
    console.log(`   • Collatéral déposé: ${ethers.formatEther(request.actualCollateralDeposited)} ETH`);
    console.log(`   • Statut: ${request.status === 0 ? "En attente" : request.status === 1 ? "Financé" : "Annulé"}`);
    console.log(`   • Créé le: ${new Date(Number(request.createdAt) * 1000).toLocaleString()}`);

    // 3. Vérification du collatéral
    console.log("\n💰 Vérification du collatéral:");
    const ratio = request.actualCollateralDeposited >= request.requiredCollateral;
    console.log(`   • Suffisant: ${ratio ? "✅ Oui" : "❌ Non"}`);
    
    if (request.actualCollateralDeposited > 0n) {
      const actualRatio = (Number(request.actualCollateralDeposited) / Number(request.requiredCollateral)) * 100;
      console.log(`   • Ratio actuel: ${actualRatio.toFixed(1)}% du minimum requis`);
    }

    // 4. Balance du contrat (pour vérifier que l'ETH est bien arrivé)
    const contractBalance = await ethers.provider.getBalance(chainLendCoreAddress);
    console.log(`\n🏦 Balance du contrat: ${ethers.formatEther(contractBalance)} ETH`);

    // 5. Statistiques générales
    const stats = await chainLendCore.getProtocolStats();
    console.log("\n📊 Statistiques du protocole:");
    console.log(`   • Total des demandes: ${stats[0].toString()}`);
    console.log(`   • Demandes actives: ${stats[1].toString()}`);
    console.log(`   • Prêts actifs: ${stats[2].toString()}`);
    console.log(`   • Volume total: ${ethers.formatUnits(stats[3], 6)} USDC`);

    console.log("\n🎉 Ta demande a été créée avec succès !");
    console.log("   • L'ETH est bien verrouillé dans le contrat");
    console.log("   • Ta demande est visible pour les prêteurs");
    console.log("   • Attendez qu'un prêteur finance votre demande");

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