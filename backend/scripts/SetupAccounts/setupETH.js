const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Setup ETH mainnet fork...");

  // VRAIE adresse USDC sur ETH mainnet
  const usdcAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; // Centre USD Coin
  const whaleAddress = "0x28c6c06298d514db089934071355e5743bf21d60"; // Binance14

  const [deployer, borrower, lender1, lender2] = await ethers.getSigners();

  console.log("Comptes :");
  console.log("- Deployer:", deployer.address);
  console.log("- Borrower:", borrower.address);  
  console.log("- Lender1:", lender1.address);
  console.log("- Lender2:", lender2.address);

  console.log("Testing USDC contract...");
  
  // Test si le contrat USDC existe
  const code = await ethers.provider.getCode(usdcAddress);
  if (code === "0x") {
    console.error("USDC contract not found at:", usdcAddress);
    console.log("Try deploying with MockERC20 instead");
    return;
  }
  console.log("USDC contract found");
  
  const usdc = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", usdcAddress);

  // Test balance whale avant impersonation
  try {
    const whaleBalance = await usdc.balanceOf(whaleAddress);
    console.log("Whale USDC balance:", ethers.formatUnits(whaleBalance, 6));
    
    if (whaleBalance === 0n) {
      console.error("Whale has no USDC, trying different whale...");
      // Alternative whales
      const altWhales = [
        "0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503", // FTX
        "0x5041ed759dd4afc3a72b8192c143f72f4724081a", // Another whale
        "0x0a59649758aa4d66e25f08dd01271e891fe52199"  // Maker
      ];
      
      for (const altWhale of altWhales) {
        try {
          const altBalance = await usdc.balanceOf(altWhale);
          if (altBalance > 0n) {
            console.log(`Found alternative whale: ${altWhale} with ${ethers.formatUnits(altBalance, 6)} USDC`);
            whaleAddress = altWhale;
            break;
          }
        } catch (error) {
          continue;
        }
      }
    }
  } catch (error) {
    console.error("Error checking whale balance:", error.message);
    return;
  }

  // Impersonate whale ETH
  console.log("Impersonating whale...");
  await ethers.provider.send("hardhat_impersonateAccount", [whaleAddress]);
  await ethers.provider.send("hardhat_setBalance", [whaleAddress, "0x1000000000000000000"]); // 1 ETH for gas
  const whaleSigner = await ethers.getSigner(whaleAddress);

  // Distribuer USDC
  const accounts = [
    { name: "Borrower", signer: borrower, amount: "5000" },
    { name: "Lender1", signer: lender1, amount: "100000" },
    { name: "Lender2", signer: lender2, amount: "50000" },
  ];

  console.log("Distributing USDC...");

  for (const account of accounts) {
    const amount = ethers.parseUnits(account.amount, 6);
    console.log(`Transfer ${account.amount} USDC vers ${account.name}...`);
    
    try {
      const tx = await usdc.connect(whaleSigner).transfer(account.signer.address, amount);
      await tx.wait();
      
      const balance = await usdc.balanceOf(account.signer.address);
      console.log(`${account.name}: ${ethers.formatUnits(balance, 6)} USDC`);
    } catch (error) {
      console.error(`Failed to transfer to ${account.name}:`, error.message);
    }
  }

  // Vérifier ETH balances (déjà 10k ETH par compte avec Anvil)
  console.log(" Soldes ETH :");
  for (const account of accounts) {
    const ethBalance = await ethers.provider.getBalance(account.signer.address);
    console.log(`- ${account.name}: ${ethers.formatEther(ethBalance)} ETH`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });