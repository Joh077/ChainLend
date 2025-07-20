const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ChainLend Happy Path on Base Fork", function() {
  let chainLend, clToken;
  let owner, borrower, lender;
  
  // Adresses Base mainnet
  const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  const ETH_USD_FEED = "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70";
  const USDC_USD_FEED = "0x7e860098F58bBFC8648a4311b374B1D669a2bc6B";

  before(async function() {
    [owner, borrower, lender] = await ethers.getSigners();
    
    // Deploy CLToken
    const CLToken = await ethers.getContractFactory("CLToken");
    clToken = await CLToken.deploy(owner.address);
    console.log("CLToken deployé à l'adresse :", await clToken.getAddress());
    
    // Deploy ChainLend
    const ChainLend = await ethers.getContractFactory("ChainLend");
    chainLend = await ChainLend.deploy(
      USDC_ADDRESS,
      ETH_USD_FEED,
      owner.address, // treasury
      USDC_USD_FEED,
      await clToken.getAddress(),
      owner.address
    );
    console.log("ChainLend deployé à l'adresse :", await chainLend.getAddress());
    
    // Authorize ChainLend to mint CL tokens
    await clToken.addMinter(await chainLend.getAddress());
    console.log("Autorisation de minter à ChainLend");
    
    // Get USDC for lender - WHALE DIRECTE
    const usdc = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", USDC_ADDRESS);
    const whale = "0x20FE51A9229EEf2cF8Ad9E89d91CAb9312cF3b7A"; // Aave pool Base
    
    // Impersonate whale
    await ethers.provider.send("hardhat_impersonateAccount", [whale]);
    await ethers.provider.send("hardhat_setBalance", [whale, "0x1000000000000000000"]); // 1 ETH for gas
    const whaleSigner = await ethers.getSigner(whale);
    
    // Check whale balance
    const whaleBalance = await usdc.balanceOf(whale);
    console.log("Whale USDC balance:", ethers.formatUnits(whaleBalance, 6));
    
    // Transfer 50,000 USDC to lender
    const transferAmount = ethers.parseUnits("50000", 6);
    console.log("Transfert de ", ethers.formatUnits(transferAmount, 6), "USDC au lender");
    
    const tx = await usdc.connect(whaleSigner).transfer(lender.address, transferAmount);
    await tx.wait();
    
    const lenderBalance = await usdc.balanceOf(lender.address);
    console.log("Lender USDC balance après transfer:", ethers.formatUnits(lenderBalance, 6));
    expect(lenderBalance).to.be.gte(transferAmount);
  });

  it("Should complete full lending cycle with 10,000 USDC", async function() {
    const loanAmount = ethers.parseUnits("10000", 6); // 10,000 USDC
    const interestRate = 1000; // 10%
    const duration = 30 * 24 * 3600; // 30 days
    
    // Calculate required collateral
    const requiredCollateral = await chainLend.calculateRequiredCollateral(loanAmount);
    console.log("Collateral requis:", ethers.formatEther(requiredCollateral), "ETH");
    console.log("Montant de l'emprunt:", ethers.formatUnits(loanAmount, 6), "USDC");
    
    // Create loan request with ETH collateral
    console.log("--- Création de la demande ---");
    await chainLend.connect(borrower).createLoanRequest(
      loanAmount,
      interestRate,
      duration,
      { value: requiredCollateral }
    );
    
    const request = await chainLend.getLoanRequest(1);
    console.log("Request status:", request.status);
    expect(request.status).to.equal(0); // Pending
    
    // Approve and fund loan
    console.log("--- Financement du prêt ---");
    const usdc = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", USDC_ADDRESS);
    
    await usdc.connect(lender).approve(await chainLend.getAddress(), loanAmount);
    console.log("USDC approved");
    
    await chainLend.connect(lender).fundLoan(1);
    console.log("Prêt financé");
    
    // Check request status after funding
    const requestAfterFunding = await chainLend.getLoanRequest(1);
    console.log("Request status après financement:", requestAfterFunding.status);
    
    // Get active loan
    const loan = await chainLend.getActiveLoan(1);
    console.log("Prêt actif status:", loan.status);
    console.log("Montant de la dette:", ethers.formatUnits(loan.totalAmountDue, 6), "USDC");
    expect(loan.status).to.equal(0); // Active
    
    // Check borrower received USDC
    const borrowerBalance = await usdc.balanceOf(borrower.address);
    console.log("Borrower USDC balance:", ethers.formatUnits(borrowerBalance, 6));
    expect(borrowerBalance).to.equal(loanAmount);
    
    // Give borrower enough USDC to repay (from whale)
    console.log("--- Donne des USDC au Borrower pour remboursement ---");
    const whale = "0x20FE51A9229EEf2cF8Ad9E89d91CAb9312cF3b7A";
    const whaleSigner = await ethers.getSigner(whale);
    
    const repayAmount = loan.totalAmountDue - borrowerBalance; // Additional amount needed
    await usdc.connect(whaleSigner).transfer(borrower.address, repayAmount);
    
    const borrowerBalanceAfterTop = await usdc.balanceOf(borrower.address);
    console.log("Borrower balance après transfert:", ethers.formatUnits(borrowerBalanceAfterTop, 6), "USDC");
    
    // Repay loan
    console.log("--- Remboursement du prêt ---");
    await usdc.connect(borrower).approve(await chainLend.getAddress(), loan.totalAmountDue);
    await chainLend.connect(borrower).repayLoan(1);
    
    // Withdraw collateral
    console.log("--- Retrait du collateral ---");
    await chainLend.connect(borrower).withdrawCollateral(1);
    
    console.log("Happy path OK avec 10,000 USDC!");
  });
});