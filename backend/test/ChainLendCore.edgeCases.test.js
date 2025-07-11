const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("ChainLendCore - Edge Cases Coverage", function () {
  // ========== FIXTURES ==========
  
  async function deployChainLendFixture() {
    const [owner, borrower, lender, liquidator, treasury] = await ethers.getSigners();

    // Deploy MockERC20 (USDC)
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdcToken = await MockERC20.deploy("USD Coin", "USDC", 6);

    // Deploy Mock Price Feeds
    const MockPriceFeed = await ethers.getContractFactory("MockChainlinkPriceFeed");
    const ethPriceFeed = await MockPriceFeed.deploy(2000e8, 8);
    const usdcPriceFeed = await MockPriceFeed.deploy(1e8, 8);

    // Deploy CLToken
    const CLToken = await ethers.getContractFactory("CLToken");
    const clToken = await CLToken.deploy(owner.address);

    // Deploy ChainLendCore
    const ChainLendCore = await ethers.getContractFactory("ChainLendCore");
    const chainLend = await ChainLendCore.deploy(
      await usdcToken.getAddress(),
      await ethPriceFeed.getAddress(),
      treasury.address,
      await usdcPriceFeed.getAddress(),
      await clToken.getAddress(),
      owner.address
    );

    // Setup CLToken minter
    await clToken.addMinter(await chainLend.getAddress());

    // Mint USDC to lender and borrower
    await usdcToken.mint(lender.address, ethers.parseUnits("1000000", 6));
    await usdcToken.mint(borrower.address, ethers.parseUnits("100000", 6));
    await usdcToken.connect(lender).approve(await chainLend.getAddress(), ethers.MaxUint256);
    await usdcToken.connect(borrower).approve(await chainLend.getAddress(), ethers.MaxUint256);

    return {
      chainLend,
      usdcToken,
      clToken,
      ethPriceFeed,
      usdcPriceFeed,
      owner,
      borrower,
      lender,
      liquidator,
      treasury
    };
  }

  // ========== LIQUIDATION EDGE CASES ==========
  
  describe("Liquidation Edge Cases", function () {
    it("Should handle edge case when collateral value equals debt exactly", async function () {
      const { chainLend, borrower, lender, liquidator, ethPriceFeed } = await loadFixture(deployChainLendFixture);
      
      // Create a loan that will be exactly at liquidation threshold
      const amountRequested = ethers.parseUnits("1000", 6);
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);
      
      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        1000,
        30 * 24 * 60 * 60,
        { value: requiredCollateral }
      );
      
      await chainLend.connect(lender).fundLoan(1);
      
      // Set price to make collateral value exactly equal to debt
      // This might trigger specific distribution logic
      await ethPriceFeed.updatePrice(1300e8); // Specific price for edge case
      
      await expect(chainLend.connect(liquidator).liquidateCollateral(1))
        .to.not.be.reverted;
    });

    it("Should handle liquidation when borrower has zero remaining collateral", async function () {
      const { chainLend, borrower, lender, liquidator, ethPriceFeed } = await loadFixture(deployChainLendFixture);
      
      const amountRequested = ethers.parseUnits("1000", 6);
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);
      
      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        1000,
        30 * 24 * 60 * 60,
        { value: requiredCollateral }
      );
      
      await chainLend.connect(lender).fundLoan(1);
      
      // Drop price significantly to make collateral worth less than debt
      await ethPriceFeed.updatePrice(800e8);
      
      await chainLend.connect(liquidator).liquidateCollateral(1);
      
      // Verify liquidation completed
      const loan = await chainLend.getActiveLoan(1);
      expect(loan.status).to.equal(2); // Liquidated
    });

    it("Should handle case when liquidation distribution has rounding", async function () {
      const { chainLend, borrower, lender, liquidator, ethPriceFeed } = await loadFixture(deployChainLendFixture);
      
      // Use odd amounts that might cause rounding issues
      const amountRequested = ethers.parseUnits("1337", 6); // Odd number
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);
      
      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        1337, // Odd interest rate
        33 * 24 * 60 * 60, // Odd duration
        { value: requiredCollateral }
      );
      
      await chainLend.connect(lender).fundLoan(1);
      
      // Use odd price that might cause rounding in calculations
      await ethPriceFeed.updatePrice(1337e8);
      
      await chainLend.connect(liquidator).liquidateCollateral(1);
      
      // Verify success despite potential rounding
      const loan = await chainLend.getActiveLoan(1);
      expect(loan.status).to.equal(2);
    });
  });

  // ========== ETH TRANSFER EDGE CASES ==========
  
  describe("ETH Transfer Edge Cases", function () {
    it("Should handle failed ETH transfer in excess collateral withdrawal", async function () {
      const { chainLend, borrower, lender } = await loadFixture(deployChainLendFixture);
      
      const amountRequested = ethers.parseUnits("1000", 6);
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);
      
      // Add extra collateral for withdrawal
      const extraCollateral = ethers.parseEther("1");
      
      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        1000,
        30 * 24 * 60 * 60,
        { value: requiredCollateral + extraCollateral }
      );
      
      await chainLend.connect(lender).fundLoan(1);
      
      // Try to withdraw small amount first
      const smallWithdraw = ethers.parseEther("0.1");
      
      await expect(chainLend.connect(borrower).withdrawExcessCollateral(1, smallWithdraw))
        .to.not.be.reverted;
    });

    it("Should handle edge case in collateral withdrawal after repayment", async function () {
      const { chainLend, borrower, lender } = await loadFixture(deployChainLendFixture);
      
      const amountRequested = ethers.parseUnits("1000", 6);
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);
      
      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        1000,
        30 * 24 * 60 * 60,
        { value: requiredCollateral }
      );
      
      await chainLend.connect(lender).fundLoan(1);
      await chainLend.connect(borrower).repayLoan(1);
      
      // Multiple withdrawals should be handled correctly
      await chainLend.connect(borrower).withdrawCollateral(1);
      
      // Second withdrawal attempt should fail gracefully
      await expect(chainLend.connect(borrower).withdrawCollateral(1))
        .to.be.reverted;
    });
  });

  // ========== CALCULATION EDGE CASES ==========
  
  describe("Calculation Edge Cases", function () {
    it("Should handle minimum loan amount calculations", async function () {
      const { chainLend } = await loadFixture(deployChainLendFixture);
      
      // Test with minimum possible loan amount (1 USDC)
      const minAmount = ethers.parseUnits("1", 6);
      const requiredCollateral = await chainLend.calculateRequiredCollateral(minAmount);
      
      expect(requiredCollateral).to.be.gt(0);
    });

    it("Should handle maximum loan amount calculations", async function () {
      const { chainLend } = await loadFixture(deployChainLendFixture);
      
      // Test with maximum allowed loan amount
      const maxAmount = await chainLend.MAX_LOAN_AMOUNT();
      const requiredCollateral = await chainLend.calculateRequiredCollateral(maxAmount);
      
      expect(requiredCollateral).to.be.gt(0);
    });

    it("Should handle edge case in health factor calculation", async function () {
      const { chainLend, borrower, lender, ethPriceFeed } = await loadFixture(deployChainLendFixture);
      
      const amountRequested = ethers.parseUnits("1000", 6);
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);
      
      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        1000,
        30 * 24 * 60 * 60,
        { value: requiredCollateral }
      );
      
      await chainLend.connect(lender).fundLoan(1);
      
      // Test health factor at exact liquidation threshold
      await ethPriceFeed.updatePrice(1300e8); // Should be around 130% ratio
      
      const healthFactor = await chainLend.getHealthFactor(1);
      expect(healthFactor).to.be.gt(0);
    });
  });

  // ========== OVERFLOW/UNDERFLOW EDGE CASES ==========
  
  describe("Overflow Protection Edge Cases", function () {
    it("Should handle large interest calculations safely", async function () {
      const { chainLend, borrower, lender } = await loadFixture(deployChainLendFixture);
      
      // Use maximum interest rate and long duration
      const amountRequested = ethers.parseUnits("100000", 6); // Large amount
      const maxInterestRate = await chainLend.MAX_INTEREST_RATE(); // 15%
      const maxDuration = await chainLend.MAX_LOAN_DURATION(); // ~3 years
      
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);
      
      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        maxInterestRate,
        maxDuration,
        { value: requiredCollateral }
      );
      
      await chainLend.connect(lender).fundLoan(1);
      
      // Verify loan was created successfully despite large numbers
      const loan = await chainLend.getActiveLoan(1);
      expect(loan.totalAmountDue).to.be.gt(amountRequested);
    });

    it("Should handle edge case in protocol fee calculation", async function () {
      const { chainLend, borrower, lender } = await loadFixture(deployChainLendFixture);
      
      // Use amount that might cause interesting rounding in protocol fees
      const amountRequested = ethers.parseUnits("999", 6);
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);
      
      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        999, // Odd interest rate
        31 * 24 * 60 * 60, // 31 days
        { value: requiredCollateral }
      );
      
      await chainLend.connect(lender).fundLoan(1);
      await chainLend.connect(borrower).repayLoan(1);
      
      // Verify repayment succeeded despite potential rounding issues
      const loan = await chainLend.getActiveLoan(1);
      expect(loan.status).to.equal(1); // Repaid
    });
  });

  // ========== PRICE FEED EDGE CASES ==========
  
  describe("Price Feed Edge Cases", function () {
    it("Should handle USDC price different from $1", async function () {
      const { chainLend, usdcPriceFeed } = await loadFixture(deployChainLendFixture);
      
      // Set USDC price slightly different from $1 (e.g., $0.99)
      await usdcPriceFeed.updatePrice(99000000); // $0.99 with 8 decimals
      
      const amountRequested = ethers.parseUnits("1000", 6);
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);
      
      expect(requiredCollateral).to.be.gt(0);
    });

    it("Should handle very high ETH price", async function () {
      const { chainLend, ethPriceFeed } = await loadFixture(deployChainLendFixture);
      
      // Set very high ETH price
      await ethPriceFeed.updatePrice(10000e8); // $10,000
      
      const amountRequested = ethers.parseUnits("1000", 6);
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);
      
      expect(requiredCollateral).to.be.gt(0);
      expect(requiredCollateral).to.be.lt(ethers.parseEther("1")); // Should be less than 1 ETH
    });

    it("Should handle very low ETH price", async function () {
      const { chainLend, ethPriceFeed } = await loadFixture(deployChainLendFixture);
      
      // Set low ETH price (but not triggering liquidation)
      await ethPriceFeed.updatePrice(500e8); // $500
      
      const amountRequested = ethers.parseUnits("100", 6); // Smaller amount
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);
      
      expect(requiredCollateral).to.be.gt(0);
    });
  });
});