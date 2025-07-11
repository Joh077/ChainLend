// scripts/debugEnumStatus.js
const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 Debug du statut des demandes...\n");

  const chainLendCoreAddress = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";
  const chainLendCore = await ethers.getContractAt("ChainLendCore", chainLendCoreAddress);

  try {
    const nextRequestId = await chainLendCore.nextRequestId();
    const totalRequests = Number(nextRequestId) - 1;
    
    console.log(`📋 Debug de ${totalRequests} demandes:\n`);

    for (let i = 1; i <= totalRequests; i++) {
      const request = await chainLendCore.getLoanRequest(i);
      
      console.log(`Demande #${i}:`);
      console.log(`   • Statut (raw): ${request.status}`);
      console.log(`   • Statut (number): ${Number(request.status)}`);
      console.log(`   • Statut (hex): 0x${request.status.toString(16)}`);
      console.log(`   • Type: ${typeof request.status}`);
      
      // Test de tous les statuts possibles
      const statusCode = Number(request.status);
      const statusMap = {
        0: "Pending (En attente)",
        1: "Funded (Financé)", 
        2: "Cancelled (Annulé)",
        3: "Autre statut 3",
        4: "Autre statut 4"
      };
      
      console.log(`   • Interprétation: ${statusMap[statusCode] || `Statut inconnu: ${statusCode}`}`);
      console.log("");
    }

    // Test direct des constantes du contrat
    console.log("🔧 Test des fonctions du contrat:");
    
    try {
      // Essayer d'appeler une fonction de lecture pour voir si ça fonctionne
      const totalActiveRequests = await chainLendCore.totalActiveRequests();
      console.log(`   • Total demandes actives: ${totalActiveRequests}`);
      
      // Vérifier les constantes aussi
      const minRatio = await chainLendCore.MIN_COLLATERAL_RATIO();
      console.log(`   • Ratio min collatéral: ${Number(minRatio) / 100}%`);
      
    } catch (error) {
      console.log(`   ❌ Erreur lecture contrat: ${error.message}`);
    }

    // Regarder l'ABI du contrat pour voir l'enum exact
    console.log("\n📜 Informations sur l'enum RequestStatus:");
    console.log("   Dans le code Solidity, l'enum peut être:");
    console.log("   0 = Pending");
    console.log("   1 = Funded");  
    console.log("   2 = Cancelled");
    console.log("   Ou il peut y avoir d'autres valeurs...");

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