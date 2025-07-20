const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Setup présentation ChainLend sur Base fork...");

  // Adresses Base mainnet 
  const usdcAddress = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // USDC Base
  const whaleAddress = "0x20FE51A9229EEf2cF8Ad9E89d91CAb9312cF3b7A"; // Aave pool (1.6M USDC)

  // Utiliser le chemin complet
  const usdc = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", usdcAddress);
  const [deployer, borrower, lender1, lender2, lender3] = await ethers.getSigners();

  // Impersonate whale Base
  await ethers.provider.send("hardhat_impersonateAccount", [whaleAddress]);
  await ethers.provider.send("hardhat_setBalance", [whaleAddress, "0x1000000000000000000"]); // 1 ETH gas
  const whaleSigner = await ethers.getSigner(whaleAddress);

  console.log("Whale USDC balance:", ethers.formatUnits(await usdc.balanceOf(whaleAddress), 6));

  // Distribution d'USDC 
  const accounts = [
    { name: "Borrower", signer: borrower, amount: "50000" },
    { name: "Lender1", signer: lender1, amount: "50000" },
    { name: "Lender2", signer: lender2, amount: "50000" }, 
    { name: "Lender3", signer: lender3, amount: "50000" },
  ];

  for (const account of accounts) {
    const amount = ethers.parseUnits(account.amount, 6);
    
    console.log(`Transfer ${account.amount} USDC vers ${account.name}...`);
    
    const tx = await usdc.connect(whaleSigner).transfer(account.signer.address, amount);
    await tx.wait();
    
    const balance = await usdc.balanceOf(account.signer.address);
    console.log(`${account.name}: ${ethers.formatUnits(balance, 6)} USDC`);
  }

  // Vérifier ETH (déjà 10k ETH par compte avec Anvil)
  console.log("\n Soldes ETH :");
  for (const account of accounts) {
    const ethBalance = await ethers.provider.getBalance(account.signer.address);
    console.log(`- ${account.name}: ${ethers.formatEther(ethBalance)} ETH`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });