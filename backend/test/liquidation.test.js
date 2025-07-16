const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");


const { deployChainLendFixture, createLiquidatableLoanFixture } = require("./fixtures");

describe("ChainLend - Liquidation", function () {
  
  // LIQUIDATION TESTS 
  
  describe("Liquidation", function () {
    let chainLend, borrower, lender, liquidator, ethPriceFeed, requestId;

    beforeEach(async function () {
      ({ chainLend, borrower, lender, liquidator, ethPriceFeed, requestId } = await loadFixture(createLiquidatableLoanFixture));
    });

    it("Should allow liquidation when collateral ratio is below threshold", async function () {
      await expect(chainLend.connect(liquidator).liquidateCollateral(requestId))
        .to.not.be.reverted;
    });

    it("Should emit LoanLiquidated event", async function () {
      const requestBefore = await chainLend.getLoanRequest(requestId);
      const collateralETH = requestBefore.actualCollateralDeposited;

      await expect(chainLend.connect(liquidator).liquidateCollateral(requestId))
        .to.emit(chainLend, "LoanLiquidated")
    });

    it("Should set loan status to Liquidated", async function () {
      await chainLend.connect(liquidator).liquidateCollateral(requestId);

      const activeLoan = await chainLend.getActiveLoan(requestId);
      expect(activeLoan.status).to.equal(2); // LoanStatus.Liquidated
    });

    it("Should decrement totalActiveLoans", async function () {
      const totalBefore = await chainLend.totalActiveLoans();
      
      await chainLend.connect(liquidator).liquidateCollateral(requestId);

      const totalAfter = await chainLend.totalActiveLoans();
      expect(totalAfter).to.equal(totalBefore - 1n);
    });

    it("Should reset actualCollateralDeposited to zero", async function () {
      await chainLend.connect(liquidator).liquidateCollateral(requestId);

      const request = await chainLend.getLoanRequest(requestId);
      expect(request.actualCollateralDeposited).to.equal(0);
    });

    it("Should distribute collateral to lender", async function () {
      const lenderBalanceBefore = await ethers.provider.getBalance(lender.address);
      
      await chainLend.connect(liquidator).liquidateCollateral(requestId);
      
      const lenderBalanceAfter = await ethers.provider.getBalance(lender.address);
      expect(lenderBalanceAfter).to.be.gt(lenderBalanceBefore);
    });

    it("Should give liquidation bonus to liquidator", async function () {
      const liquidatorBalanceBefore = await ethers.provider.getBalance(liquidator.address);
      
      const tx = await chainLend.connect(liquidator).liquidateCollateral(requestId);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      
      const liquidatorBalanceAfter = await ethers.provider.getBalance(liquidator.address);
      expect(liquidatorBalanceAfter + gasUsed).to.be.gt(liquidatorBalanceBefore);
    });

    it("Should send protocol fee to treasury", async function () {
      const treasuryBalanceBefore = await ethers.provider.getBalance(await chainLend.treasury());
      
      await chainLend.connect(liquidator).liquidateCollateral(requestId);
      
      const treasuryBalanceAfter = await ethers.provider.getBalance(await chainLend.treasury());
      expect(treasuryBalanceAfter).to.be.gt(treasuryBalanceBefore);
    });

    it("Should return remaining collateral to borrower if any", async function () {

      const borrowerBalanceBefore = await ethers.provider.getBalance(borrower.address);
      
      await chainLend.connect(liquidator).liquidateCollateral(requestId);
      
      const borrowerBalanceAfter = await ethers.provider.getBalance(borrower.address);

      expect(borrowerBalanceAfter).to.be.gte(borrowerBalanceBefore);
    });
  });

  // LIQUIDATION REVERT TESTS 
  
  describe("Liquidation Reverts Tests", function () {
    let chainLend, borrower, lender, liquidator, ethPriceFeed, requestId;

    beforeEach(async function () {
      const contracts = await loadFixture(deployChainLendFixture);
      ({ chainLend, borrower, lender, liquidator, ethPriceFeed } = contracts);
      
      // Create funded loan without dropping price
      const amountRequested = ethers.parseUnits("1000", 6);
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);
      
      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        1000,
        30 * 24 * 60 * 60,
        { value: requiredCollateral }
      );
      
      await chainLend.connect(lender).fundLoan(1);
      requestId = 1;
    });

    it("Should revert when collateral ratio is above liquidation threshold", async function () {
      // Keep ETH price high, ratio should be above 130%
      await expect(chainLend.connect(liquidator).liquidateCollateral(requestId))
        .to.be.revertedWithCustomError(chainLend, "InvalidLoan")
        .withArgs(requestId, "Collateral ratio above liquidation threshold");
    });

    it("Should revert when liquidating non-active loan", async function () {
      // Drop price and liquidate once
      await ethPriceFeed.updatePrice(1000e8);
      await chainLend.connect(liquidator).liquidateCollateral(requestId);

      // Try to liquidate again
      await expect(chainLend.connect(liquidator).liquidateCollateral(requestId))
        .to.be.revertedWithCustomError(chainLend, "InvalidLoan");
    });

    it("Should revert when liquidating non-existent loan", async function () {
      await expect(chainLend.connect(liquidator).liquidateCollateral(999))
        .to.be.revertedWithCustomError(chainLend, "InvalidLoan");
    });

    it("Should revert when liquidating invalid loan ID (zero)", async function () {
      await expect(chainLend.connect(liquidator).liquidateCollateral(0))
        .to.be.revertedWithCustomError(chainLend, "InvalidLoan");
    });

    it("Should revert when liquidating pending request", async function () {
      // Create pending request (not funded)
      const amount = ethers.parseUnits("500", 6);
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amount);
      
      await chainLend.connect(borrower).createLoanRequest(
        amount,
        1000,
        30 * 24 * 60 * 60,
        { value: requiredCollateral }
      );

      await expect(chainLend.connect(liquidator).liquidateCollateral(2))
        .to.be.revertedWithCustomError(chainLend, "InvalidLoan");
    });

    it("Should revert when liquidating repaid loan", async function () {
      // Repay the loan first
      await chainLend.connect(borrower).repayLoan(requestId);

      await expect(chainLend.connect(liquidator).liquidateCollateral(requestId))
        .to.be.revertedWithCustomError(chainLend, "InvalidLoan");
    });

    it("Should validate liquidation threshold correctly", async function () {
      const liquidationThreshold = await chainLend.LIQUIDATION_THRESHOLD(); // 130%
      
      // Test right at the threshold
      await ethPriceFeed.updatePrice(1300e8); // Should be around 130%
      
      const healthFactor = await chainLend.getHealthFactor(requestId);
      
      if (healthFactor >= liquidationThreshold) {
        await expect(chainLend.connect(liquidator).liquidateCollateral(requestId))
          .to.be.revertedWithCustomError(chainLend, "InvalidLoan");
      } else {
        await expect(chainLend.connect(liquidator).liquidateCollateral(requestId))
          .to.not.be.reverted;
      }
    });

    it("Should handle stale price feeds during liquidation", async function () {
      // First drop price to make loan liquidatable
      await ethPriceFeed.updatePrice(1000e8);
      
      // Then set stale timestamp
      const staleTimestamp = (await time.latest()) - 86500; // More than 1 day
      await ethPriceFeed.setStalePrice(staleTimestamp);
      
      await expect(chainLend.connect(liquidator).liquidateCollateral(requestId))
        .to.be.revertedWithCustomError(chainLend, "StalePrice");
    });

    it("Should handle invalid price feeds during liquidation", async function () {
      // Set invalid price
      await ethPriceFeed.updatePrice(-1);
      
      await expect(chainLend.connect(liquidator).liquidateCollateral(requestId))
        .to.be.revertedWithCustomError(chainLend, "InvalidPrice");
    });
  });

  // LIQUIDATION PARTICULAR CASES 
  
  describe("Liquidation Particular Cases", function () {
    let chainLend, borrower, lender, liquidator, ethPriceFeed;

    beforeEach(async function () {
      ({ chainLend, borrower, lender, liquidator, ethPriceFeed } = await loadFixture(deployChainLendFixture));
    });

    it("Should handle edge case when collateral value equals debt exactly", async function () {
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
      await ethPriceFeed.updatePrice(1300e8); // Specific price for edge case
      
      await expect(chainLend.connect(liquidator).liquidateCollateral(1))
        .to.not.be.reverted;
    });

    it("Should handle liquidation with maximum loan parameters", async function () {
      const largeAmount = ethers.parseUnits("10000", 6); // 10k USDC
      const maxRate = await chainLend.MAX_INTEREST_RATE();
      const maxDuration = 365 * 24 * 60 * 60; // 1 year
      const requiredCollateral = await chainLend.calculateRequiredCollateral(largeAmount);
      
      await chainLend.connect(borrower).createLoanRequest(
        largeAmount,
        maxRate,
        maxDuration,
        { value: requiredCollateral }
      );
      
      await chainLend.connect(lender).fundLoan(1);
      
      // Drop price for liquidation
      await ethPriceFeed.updatePrice(1000e8);
      
      await expect(chainLend.connect(liquidator).liquidateCollateral(1))
        .to.not.be.reverted;
    });
  });
});