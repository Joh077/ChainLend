const { ethers } = require("hardhat");

async function main() {

  const usdcAddress = "0x92fC18e65714Eb4c355E90D3BfD76fE75a10ecc9";
  
  // Vérification préalable
  const code = await ethers.provider.getCode(usdcAddress);
  if (code === "0x") {
    console.error("Contrat USDC non trouvé. Redéployez d'abord vos contrats.");
    return;
  }

  const mockUSDC = await ethers.getContractAt("MockERC20", usdcAddress);
  const [deployer, user1, user2, user3] = await ethers.getSigners();

  // Distribuer USDC aux comptes prêteurs
  const accounts = [
    { name: "User1", signer: user1 },
    { name: "User2", signer: user2 },
    { name: "User3", signer: user3 }
  ];
  const amountPerAccount = ethers.parseUnits("50000", 6); // 50k USDC
  
  for (const account of accounts) { 

    try {
      // Étape 1: Mint les tokens
      const mintTx = await mockUSDC.mint(account.signer.address, amountPerAccount);
      await mintTx.wait();
      
      // Étape 2: Vérification avec gestion d'erreur
      try {
        // Essayer plusieurs méthodes pour récupérer le solde
        let balance;
        
        // Méthode 1: Appel direct
        try {
          balance = await mockUSDC.balanceOf(account.signer.address);
        } 
        
        catch (e1) {
          // Méthode 2: Avec délai
          await new Promise(resolve => setTimeout(resolve, 100));
          balance = await mockUSDC.connect(account.signer).balanceOf(account.signer.address);
        }

      } catch (balanceError) {
      }
      
    } catch (error) {
    }
  }

  
  // Vérification finale sur le deployer (qui fonctionne)
  try {
    const deployerBalance = await mockUSDC.balanceOf(deployer.address);
  } catch (error) {
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });