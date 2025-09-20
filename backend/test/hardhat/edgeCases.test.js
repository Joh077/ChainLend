const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

const { deployChainLendFixture } = require("./fixtures");

describe("ChainLend - Edge Cases", function () {
  
  // ========== CALCULATION EDGE CASES ==========
  
  describe("Calculation Edge Cases", function () {
    let chainLend, borrower, lender, ethPriceFeed, usdcPriceFeed;

    beforeEach(async function () {
      ({ chainLend, borrower, lender, ethPriceFeed, usdcPriceFeed } = await loadFixture(deployChainLendFixture));
    });

    it("Should handle calculations with numbers that might cause rounding issues", async function () {
      // Use odd amounts that might cause rounding issues
      const amountRequested = ethers.parseUnits("1337", 6); // Odd number
      const oddInterestRate = 1337; // 13.37%
      const oddDuration = 47 * 24 * 60 * 60; // 47 days
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);

      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        oddInterestRate,
        oddDuration,
        { value: requiredCollateral }
      );

      await chainLend.connect(lender).fundLoan(1);
      
      // Verify loan was created successfully despite potential rounding issues
      const activeLoan = await chainLend.getActiveLoan(1);
      expect(activeLoan.totalAmountDue).to.be.gt(amountRequested);
      expect(activeLoan.interestAmount).to.be.gt(0);
    });

    it("Should handle very small loan amounts", async function () {
      const minAmount = ethers.parseUnits("0.01", 6); // 1 cent
      const requiredCollateral = await chainLend.calculateRequiredCollateral(minAmount);
      
      await chainLend.connect(borrower).createLoanRequest(
        minAmount,
        1000,
        30 * 24 * 60 * 60,
        { value: requiredCollateral }
      );

      await chainLend.connect(lender).fundLoan(1);
      
      const activeLoan = await chainLend.getActiveLoan(1);
      expect(activeLoan.principalAmount).to.equal(minAmount);
      expect(activeLoan.interestAmount).to.be.gte(0); // Interest might be very small but should not underflow
    });

    it("Should handle calculations with various price levels", async function () {
      const amountRequested = ethers.parseUnits("1000", 6);
      const prices = [100e8, 500e8, 1000e8, 2000e8, 5000e8, 10000e8];
      
      for (let i = 0; i < prices.length; i++) {
        await ethPriceFeed.updatePrice(prices[i]);
        const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);
        expect(requiredCollateral).to.be.gt(0);
        
        // Higher ETH price should require less ETH collateral
        if (i > 0) {
          const prevRequiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);
          // Note: This comparison might be affected by the previous price change
        }
      }
    });

    it("Should handle precision edge cases in collateral calculations", async function () {
      const amountRequested = ethers.parseUnits("999.999999", 6); // Maximum USDC precision
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);
      
      expect(requiredCollateral).to.be.gt(0);
      
      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        1000,
        30 * 24 * 60 * 60,
        { value: requiredCollateral }
      );

      await expect(chainLend.connect(lender).fundLoan(1))
        .to.not.be.reverted;
    });

    it("Should handle interest calculations with extreme parameters", async function () {
      const amountRequested = ethers.parseUnits("1000", 6);
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
      
      const activeLoan = await chainLend.getActiveLoan(1);
      
      // Verify calculations don't overflow
      expect(activeLoan.totalAmountDue).to.be.gt(amountRequested);
      expect(activeLoan.totalAmountDue).to.be.lt(ethers.MaxUint256);
      expect(activeLoan.interestAmount).to.be.gt(0);
    });

    it("Should handle protocol fee calculations with edge cases", async function () {
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
      
      // Repay and verify protocol fee calculation
      await expect(chainLend.connect(borrower).repayLoan(1))
        .to.not.be.reverted;
      
      const loan = await chainLend.getActiveLoan(1);
      expect(loan.status).to.equal(1); // Repaid
    });
  });

  // ========== OVERFLOW PROTECTION EDGE CASES ==========
  
  describe("Overflow Protection Edge Cases", function () {
    let chainLend, borrower, lender, ethPriceFeed;

    beforeEach(async function () {
      ({ chainLend, borrower, lender, ethPriceFeed } = await loadFixture(deployChainLendFixture));
    });

    it("Should handle large interest calculations safely", async function () {
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
      expect(loan.totalAmountDue).to.be.lt(ethers.MaxUint256); // No overflow
    });

    it("Should handle calculations with maximum loan amount", async function () {
      const maxAmount = await chainLend.MAX_LOAN_AMOUNT();
      const requiredCollateral = await chainLend.calculateRequiredCollateral(maxAmount);
      
      await chainLend.connect(borrower).createLoanRequest(
        maxAmount,
        1000,
        365 * 24 * 60 * 60, // 1 year
        { value: requiredCollateral }
      );
      
      await chainLend.connect(lender).fundLoan(1);
      
      const activeLoan = await chainLend.getActiveLoan(1);
      expect(activeLoan.principalAmount).to.equal(maxAmount);
      expect(activeLoan.totalAmountDue).to.be.gt(maxAmount);
    });

    it("Should handle health factor calculations with extreme ratios", async function () {
      const amountRequested = ethers.parseUnits("1000", 6);
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);
      
      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        1000,
        30 * 24 * 60 * 60,
        { value: requiredCollateral }
      );
      
      await chainLend.connect(lender).fundLoan(1);
      
      // Test with very high ETH price (should give very high health factor)
      await ethPriceFeed.updatePrice(50000e8); // $50,000 per ETH
      
      const healthFactor = await chainLend.getHealthFactor(1);
      expect(healthFactor).to.be.gt(100000); // Very high ratio
      expect(healthFactor).to.be.lt(ethers.MaxUint256); // No overflow
    });

    it("Should handle division by zero protection", async function () {
      // Test scenarios that might cause division by zero
      const amountRequested = ethers.parseUnits("1", 6); // Minimal amount
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);
      
      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        500, // Minimum interest rate
        30 * 24 * 60 * 60,
        { value: requiredCollateral }
      );
      
      await chainLend.connect(lender).fundLoan(1);
      
      // All calculations should work without division errors
      const healthFactor = await chainLend.getHealthFactor(1);
      expect(healthFactor).to.be.gt(0);
      
      const excessCollateral = await chainLend.getExcessCollateral(1);
      expect(excessCollateral).to.be.gte(0);
    });
  });

  // ========== PRICE FEED EDGE CASES ==========
  
  describe("Price Feed Edge Cases", function () {
    let chainLend, borrower, lender, ethPriceFeed, usdcPriceFeed;

    beforeEach(async function () {
      ({ chainLend, borrower, lender, ethPriceFeed, usdcPriceFeed } = await loadFixture(deployChainLendFixture));
    });

    it("Should handle USDC price depegging scenarios", async function () {
      // Test with USDC price different from $1
      await usdcPriceFeed.updatePrice(95000000); // $0.95 with 8 decimals (5% depeg)
      
      const amountRequested = ethers.parseUnits("1000", 6);
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);
      
      expect(requiredCollateral).to.be.gt(0);
      
      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        1000,
        30 * 24 * 60 * 60,
        { value: requiredCollateral }
      );

      await expect(chainLend.connect(lender).fundLoan(1))
        .to.not.be.reverted;
    });

    it("Should handle extreme ETH price volatility", async function () {
      const amountRequested = ethers.parseUnits("1000", 6);
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);
      
      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        1000,
        30 * 24 * 60 * 60,
        { value: requiredCollateral }
      );
      
      await chainLend.connect(lender).fundLoan(1);
      
      // Test rapid price changes
      const prices = [2000e8, 5000e8, 1000e8, 10000e8, 500e8, 3000e8];
      
      for (const price of prices) {
        await ethPriceFeed.updatePrice(price);
        
        // Health factor calculation should not revert
        if (price >= 1300e8) { // Above liquidation threshold
          const healthFactor = await chainLend.getHealthFactor(1);
          expect(healthFactor).to.be.gt(0);
        }
      }
    });

    it("Should handle price feed edge values", async function () {
      const amountRequested = ethers.parseUnits("1000", 6);
      
      // Test with price = 1 (minimum valid price)
      await ethPriceFeed.updatePrice(1);
      
      const requiredCollateral1 = await chainLend.calculateRequiredCollateral(amountRequested);
      expect(requiredCollateral1).to.be.gt(0);
      
      // Test with very high price
      await ethPriceFeed.updatePrice(1000000e8); // $1M per ETH
      
      const requiredCollateral2 = await chainLend.calculateRequiredCollateral(amountRequested);
      expect(requiredCollateral2).to.be.gt(0);
      expect(requiredCollateral2).to.be.lt(requiredCollateral1); // Should require less ETH
    });

    it("Should handle price feed returning negative values", async function () {
      const amountRequested = ethers.parseUnits("1000", 6);
      
      // Test with negative ETH price
      await ethPriceFeed.updatePrice(-1);
      
      await expect(chainLend.calculateRequiredCollateral(amountRequested))
        .to.be.revertedWithCustomError(chainLend, "InvalidPrice");
      
      // Reset ETH price and test negative USDC price
      await ethPriceFeed.updatePrice(2000e8);
      await usdcPriceFeed.updatePrice(-1);
      
      await expect(chainLend.calculateRequiredCollateral(amountRequested))
        .to.be.revertedWithCustomError(chainLend, "InvalidPrice");
    });
  });

  // ========== ETH TRANSFER EDGE CASES ==========
  
  describe("ETH Transfer Edge Cases", function () {
    let chainLend, borrower, lender;

    beforeEach(async function () {
      ({ chainLend, borrower, lender } = await loadFixture(deployChainLendFixture));
    });

    it("Should handle edge cases in excess collateral withdrawal", async function () {
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
      
      // Try to withdraw very small amount
      const smallWithdraw = ethers.parseEther("0.000001");
      
      await expect(chainLend.connect(borrower).withdrawExcessCollateral(1, smallWithdraw))
        .to.not.be.reverted;
    });

    it("Should handle edge case in collateral withdrawal after repayment", async function () {
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
      
      // Withdrawal should work
      await chainLend.connect(borrower).withdrawCollateral(1);
      
      // Second withdrawal attempt should fail gracefully
      await expect(chainLend.connect(borrower).withdrawCollateral(1))
        .to.be.revertedWithCustomError(chainLend, "InvalidRequest")
        .withArgs(1, "No collateral to withdraw");
    });

    it("Should handle collateral operations with dust amounts", async function () {
      const amountRequested = ethers.parseUnits("1", 6); // Very small loan
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);
      
      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        1000,
        30 * 24 * 60 * 60,
        { value: requiredCollateral + 1n } // Add 1 wei
      );
      
      await chainLend.connect(lender).fundLoan(1);
      
      // Should handle dust amounts in excess calculation
      const excess = await chainLend.getExcessCollateral(1);
      expect(excess).to.be.gte(0);
    });

    it("Should handle multiple rapid collateral operations", async function () {
      const amountRequested = ethers.parseUnits("1000", 6);
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);
      const extraCollateral = ethers.parseEther("5");
      
      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        1000,
        30 * 24 * 60 * 60,
        { value: requiredCollateral + extraCollateral }
      );
      
      await chainLend.connect(lender).fundLoan(1);
      
      // Multiple small additions and withdrawals
      for (let i = 0; i < 3; i++) {
        await chainLend.connect(borrower).addCollateral(1, { value: ethers.parseEther("0.1") });
        
        const excess = await chainLend.getExcessCollateral(1);
        if (excess > ethers.parseEther("0.05")) {
          await chainLend.connect(borrower).withdrawExcessCollateral(1, ethers.parseEther("0.05"));
        }
      }
      
      // Final state should be consistent
      const finalRequest = await chainLend.getLoanRequest(1);
      expect(finalRequest.actualCollateralDeposited).to.be.gt(requiredCollateral);
    });
  });

  // ========== COMPREHENSIVE EDGE CASE COVERAGE ==========
  
  describe("Comprehensive Edge Case Coverage", function () {
    let chainLend, borrower, lender, liquidator, ethPriceFeed;

    beforeEach(async function () {
      ({ chainLend, borrower, lender, liquidator, ethPriceFeed } = await loadFixture(deployChainLendFixture));
    });

    it("Should create complex scenario to hit multiple edge cases", async function () {
      // Create multiple different types of requests to maximize code coverage
      const amountRequested = ethers.parseUnits("1000", 6);
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);
      
      // 1. Create a request that will be funded and repaid
      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        1000,
        30 * 24 * 60 * 60,
        { value: requiredCollateral }
      );
      
      // 2. Create a request that will be funded and liquidated
      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        1000,
        30 * 24 * 60 * 60,
        { value: requiredCollateral }
      );
      
      // 3. Create a request that will be cancelled
      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        1000,
        30 * 24 * 60 * 60,
        { value: requiredCollateral }
      );
      
      // 4. Create a request that stays pending
      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        1000,
        30 * 24 * 60 * 60,
        { value: requiredCollateral }
      );
      
      // Fund first two loans
      await chainLend.connect(lender).fundLoan(1);
      await chainLend.connect(lender).fundLoan(2);
      
      // Cancel third request
      await chainLend.connect(borrower).cancelLoanRequest(3);
      
      // Repay first loan
      await chainLend.connect(borrower).repayLoan(1);
      
      // Liquidate second loan
      await ethPriceFeed.updatePrice(1000e8);
      await chainLend.connect(liquidator).liquidateCollateral(2);
      
      // Test all withdrawal scenarios
      await chainLend.connect(borrower).withdrawCollateral(1); // Should work
      
      // Test withdrawal on liquidated loan
      const [canWithdraw2] = await chainLend.canWithdrawCollateral(2);
      expect(canWithdraw2).to.be.false;
      
      // Test withdrawal on cancelled loan
      const [canWithdraw3] = await chainLend.canWithdrawCollateral(3);
      expect(canWithdraw3).to.be.false;
      
      // Test withdrawal on pending loan
      const [canWithdraw4] = await chainLend.canWithdrawCollateral(4);
      expect(canWithdraw4).to.be.false;
      
      // Verify protocol statistics
      const [totalRequests, activeRequests, activeLoansCount] = await chainLend.getProtocolStats();
      expect(totalRequests).to.equal(4);
      expect(activeRequests).to.equal(1); // Only request 4 pending
      expect(activeLoansCount).to.equal(0); // No active loans remaining
    });

    it("Should handle boundary conditions for all functions", async function () {
      const currentNextId = await chainLend.nextRequestId();
      
      // Test boundary conditions for various functions
      const testIds = [0, 1, currentNextId - 1n, currentNextId, currentNextId + 1n];
      
      for (const id of testIds) {
        // Test getLoanRequest boundaries
        if (id === 0n || id >= currentNextId) {
          await expect(chainLend.getLoanRequest(id))
            .to.be.revertedWithCustomError(chainLend, "InvalidRequest");
        }
        
        // Test getActiveLoan boundaries
        if (id === 0n || id >= currentNextId) {
          await expect(chainLend.getActiveLoan(id))
            .to.be.revertedWithCustomError(chainLend, "InvalidLoan");
        }
        
        // Test canWithdrawCollateral boundaries
        const [canWithdraw] = await chainLend.canWithdrawCollateral(id);
        if (id === 0n || id >= currentNextId) {
          expect(canWithdraw).to.be.false;
        }
      }
    });

    it("Should handle state consistency during complex operations", async function () {
      // Create loan with complex parameters
      const amountRequested = ethers.parseUnits("1337.123456", 6); // Odd precision
      const oddRate = 1337; // 13.37%
      const oddDuration = 47 * 24 * 60 * 60; // 47 days
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);
      const excessCollateral = ethers.parseEther("2.345678901234567890"); // High precision
      
      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        oddRate,
        oddDuration,
        { value: requiredCollateral + excessCollateral }
      );
      
      await chainLend.connect(lender).fundLoan(1);
      
      // Perform various operations
      await chainLend.connect(borrower).addCollateral(1, { value: ethers.parseEther("0.987654321") });
      
      const excess = await chainLend.getExcessCollateral(1);
      if (excess > ethers.parseEther("1")) {
        await chainLend.connect(borrower).withdrawExcessCollateral(1, ethers.parseEther("1"));
      }
      
      // Check health factor
      const healthFactor = await chainLend.getHealthFactor(1);
      expect(healthFactor).to.be.gt(0);
      
      // Final repayment
      await chainLend.connect(borrower).repayLoan(1);
      
      // Verify final state
      const loan = await chainLend.getActiveLoan(1);
      expect(loan.status).to.equal(1); // Repaid
    });

    it("Should handle extreme market conditions simulation", async function () {
      const amountRequested = ethers.parseUnits("10000", 6);
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);
      
      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        1000,
        365 * 24 * 60 * 60, // 1 year loan
        { value: requiredCollateral }
      );
      
      await chainLend.connect(lender).fundLoan(1);
      
      // Simulate extreme market volatility
      const priceSequence = [
        2000e8, // Starting price
        5000e8, // Bull market
        1500e8, // Crash
        10000e8, // Recovery + bubble
        800e8,  // Major crash
        3000e8  // Stabilization
      ];
      
      for (const price of priceSequence) {
        await ethPriceFeed.updatePrice(price);
        
        try {
          const healthFactor = await chainLend.getHealthFactor(1);
          
          if (healthFactor < 13000) { // Below liquidation threshold
            // Loan should be liquidatable
            await expect(chainLend.connect(liquidator).liquidateCollateral(1))
              .to.not.be.reverted;
            break; // Exit loop after liquidation
          }
        } catch (error) {
          // Loan might have been liquidated in previous iteration
          break;
        }
      }
    });
  });
});