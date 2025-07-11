// scripts/debugTransaction.js
const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 Debug de la transaction createLoanRequest...\n");

  // Adresses et paramètres de test (utilise les mêmes que ton frontend)
  const chainLendCoreAddress = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";
  
  // Paramètres de test (ajuste selon tes valeurs)
  const testAmount = ethers.parseUnits("10000", 6); // 10k USDC
  const testRate = 800; // 8% = 800 basis points
  const testDuration = 365 * 24 * 3600; // 365 jours en secondes

  try {
    const [signer] = await ethers.getSigners();
    console.log(`🔑 Utilisateur: ${signer.address}`);
    console.log(`💰 Balance: ${ethers.formatEther(await ethers.provider.getBalance(signer.address))} ETH\n`);

    // 1. Connexion au contrat
    const chainLendCore = await ethers.getContractAt("ChainLendCore", chainLendCoreAddress);
    
    // 2. Vérification des constantes du contrat
    console.log("📋 Constantes du contrat:");
    const minRate = await chainLendCore.MIN_INTEREST_RATE();
    const maxRate = await chainLendCore.MAX_INTEREST_RATE();
    const minDuration = await chainLendCore.MIN_LOAN_DURATION();
    const maxDuration = await chainLendCore.MAX_LOAN_DURATION();
    const maxAmount = await chainLendCore.MAX_LOAN_AMOUNT();
    
    console.log(`   • Taux min: ${minRate.toString()} (${Number(minRate)/100}%)`);
    console.log(`   • Taux max: ${maxRate.toString()} (${Number(maxRate)/100}%)`);
    console.log(`   • Durée min: ${minDuration.toString()} secondes (${Number(minDuration)/(24*3600)} jours)`);
    console.log(`   • Durée max: ${maxDuration.toString()} secondes (${Number(maxDuration)/(24*3600)} jours)`);
    console.log(`   • Montant max: ${ethers.formatUnits(maxAmount, 6)} USDC\n`);

    // 3. Validation des paramètres
    console.log("✅ Validation des paramètres:");
    console.log(`   • Montant: ${ethers.formatUnits(testAmount, 6)} USDC`);
    console.log(`   • Taux: ${testRate} basis points (${testRate/100}%)`);
    console.log(`   • Durée: ${testDuration} secondes (${testDuration/(24*3600)} jours)`);
    
    // Vérifications
    if (testAmount == 0n) console.log("   ❌ Montant ne peut pas être 0");
    if (testAmount > maxAmount) console.log("   ❌ Montant trop élevé");
    if (BigInt(testRate) < minRate || BigInt(testRate) > maxRate) console.log("   ❌ Taux hors limites");
    if (BigInt(testDuration) < minDuration || BigInt(testDuration) > maxDuration) console.log("   ❌ Durée hors limites");
    
    // 4. Calcul du collatéral requis
    console.log("\n💰 Calcul du collatéral:");
    const requiredCollateral = await chainLendCore.calculateRequiredCollateral(testAmount);
    console.log(`   • Collatéral requis: ${ethers.formatEther(requiredCollateral)} ETH`);
    console.log(`   • Valeur: ~$${(parseFloat(ethers.formatEther(requiredCollateral)) * 3000).toLocaleString()}`);

    // 5. Test de la transaction (simulation)
    console.log("\n🧪 Test de simulation:");
    try {
      // Simuler la transaction sans l'exécuter
      await chainLendCore.createLoanRequest.staticCall(
        testAmount,
        testRate,
        testDuration,
        { value: requiredCollateral }
      );
      console.log("   ✅ Simulation réussie - les paramètres sont corrects");
      
      // 6. Test avec transaction réelle
      console.log("\n🚀 Exécution de la transaction réelle...");
      const tx = await chainLendCore.createLoanRequest(
        testAmount,
        testRate,
        testDuration,
        { 
          value: requiredCollateral,
          gasLimit: 500000 // Gas limit explicite
        }
      );
      
      console.log(`   • Hash: ${tx.hash}`);
      console.log("   • Attente de confirmation...");
      
      const receipt = await tx.wait();
      console.log(`   ✅ Transaction confirmée dans le bloc ${receipt.blockNumber}`);
      console.log(`   • Gas utilisé: ${receipt.gasUsed.toString()}`);

    } catch (simError) {
      console.log("   ❌ Erreur de simulation:", simError.message);
      
      // Analyser l'erreur plus en détail
      if (simError.message.includes("InsufficientCollateral")) {
        console.log("   💡 Problème: Pas assez d'ETH envoyé comme collatéral");
      } else if (simError.message.includes("InvalidParameter")) {
        console.log("   💡 Problème: Paramètre invalide (taux ou durée)");
      } else if (simError.message.includes("InvalidAmount")) {
        console.log("   💡 Problème: Montant invalide");
      } else {
        console.log("   💡 Vérifiez les validations du contrat");
      }
    }

  } catch (error) {
    console.error("❌ Erreur générale:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });