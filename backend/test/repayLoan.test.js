const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");


const { deployChainLendFixture, createActiveLoanFixture } = require("./fixtures");

describe("Test Loan Repayment Function", function () {
  
  //  LOAN REPAYMENT TESTS 
  
  describe("Loan Repayment", function () {
    let chainLend, borrower, lender, treasury, usdcToken, requestId;

    beforeEach(async function () {
      ({ chainLend, borrower, lender, treasury, usdcToken, requestId } = await loadFixture(createActiveLoanFixture));
    });

    it("Should allow borrower to repay loan successfully", async function () {
      await expect(chainLend.connect(borrower).repayLoan(requestId))
        .to.not.be.reverted;
    });

    it("Should emit LoanRepaid event", async function () {
      const activeLoan = await chainLend.getActiveLoan(requestId);
      const protocolFee = activeLoan.interestAmount * 1000n / 10000n; // 10% protocol fee

      await expect(chainLend.connect(borrower).repayLoan(requestId))
        .to.emit(chainLend, "LoanRepaid")
        .withArgs(requestId, borrower.address, activeLoan.totalAmountDue, protocolFee);
    });

    it("Should transfer correct amount to lender", async function () {
      const activeLoan = await chainLend.getActiveLoan(requestId);
      const protocolFee = activeLoan.interestAmount * 1000n / 10000n; // 10% protocol fee on interest only
      const expectedLenderAmount = activeLoan.totalAmountDue - protocolFee;
      
      const lenderBalanceBefore = await usdcToken.balanceOf(lender.address);
      
      await chainLend.connect(borrower).repayLoan(requestId);
      
      const lenderBalanceAfter = await usdcToken.balanceOf(lender.address);
      expect(lenderBalanceAfter - lenderBalanceBefore).to.equal(expectedLenderAmount);
    });

    it("Should transfer protocol fee to treasury", async function () {
      const activeLoan = await chainLend.getActiveLoan(requestId);
      const expectedProtocolFee = activeLoan.interestAmount * 1000n / 10000n; // 10% of interest
      
      const treasuryBalanceBefore = await usdcToken.balanceOf(treasury.address);
      
      await chainLend.connect(borrower).repayLoan(requestId);
      
      const treasuryBalanceAfter = await usdcToken.balanceOf(treasury.address);
      expect(treasuryBalanceAfter - treasuryBalanceBefore).to.equal(expectedProtocolFee);
    });

    it("Should set loan status to Repaid", async function () {
      await chainLend.connect(borrower).repayLoan(requestId);

      const activeLoan = await chainLend.getActiveLoan(requestId);
      expect(activeLoan.status).to.equal(1); // LoanStatus.Repaid
    });

    it("Should decrement totalActiveLoans", async function () {
      const totalBefore = await chainLend.totalActiveLoans();
      
      await chainLend.connect(borrower).repayLoan(requestId);

      const totalAfter = await chainLend.totalActiveLoans();
      expect(totalAfter).to.equal(totalBefore - 1n);
    });

    it("Should calculate protocol fee correctly", async function () {
      const activeLoan = await chainLend.getActiveLoan(requestId);
      const protocolFeeRate = await chainLend.PROTOCOL_FEE(); // 10%
      const expectedProtocolFee = activeLoan.interestAmount * protocolFeeRate / 10000n;
      
      const treasuryBalanceBefore = await usdcToken.balanceOf(treasury.address);
      
      await chainLend.connect(borrower).repayLoan(requestId);
      
      const treasuryBalanceAfter = await usdcToken.balanceOf(treasury.address);
      expect(treasuryBalanceAfter - treasuryBalanceBefore).to.equal(expectedProtocolFee);
    });


    it("Should preserve loan data after repayment", async function () {
      const loanBefore = await chainLend.getActiveLoan(requestId);
      
      await chainLend.connect(borrower).repayLoan(requestId);
      
      const loanAfter = await chainLend.getActiveLoan(requestId);
      
      // Most data should remain the same except status
      expect(loanAfter.requestId).to.equal(loanBefore.requestId);
      expect(loanAfter.lender).to.equal(loanBefore.lender);
      expect(loanAfter.principalAmount).to.equal(loanBefore.principalAmount);
      expect(loanAfter.totalAmountDue).to.equal(loanBefore.totalAmountDue);
      expect(loanAfter.interestAmount).to.equal(loanBefore.interestAmount);
      
      // Status should change
      expect(loanAfter.status).to.equal(1); // Repaid
    });
  });

  //  REPAYMENT REVERT TESTS 
  
  describe("Repayment Revert Tests", function () {
    let chainLend, borrower, lender, requestId, usdcToken;

    beforeEach(async function () {
      ({ chainLend, borrower, lender, requestId, usdcToken } = await loadFixture(createActiveLoanFixture));
    });

    it("Should revert when non-borrower tries to repay", async function () {
      await expect(chainLend.connect(lender).repayLoan(requestId))
        .to.be.revertedWithCustomError(chainLend, "Unauthorized");
    });

    it("Should revert when repaying non-existent loan", async function () {
      await expect(chainLend.connect(borrower).repayLoan(500))
        .to.be.revertedWithCustomError(chainLend, "InvalidLoan");
    });

    it("Should revert when repaying invalid loan ID (zero)", async function () {
      await expect(chainLend.connect(borrower).repayLoan(0))
        .to.be.revertedWithCustomError(chainLend, "InvalidLoan");
    });

    it("Should revert when repaying invalid loan ID (above range)", async function () {
      const nextId = await chainLend.nextRequestId();
      
      await expect(chainLend.connect(borrower).repayLoan(nextId))
        .to.be.revertedWithCustomError(chainLend, "InvalidLoan");
    });

    it("Should revert when loan is already repaid", async function () {
      await chainLend.connect(borrower).repayLoan(requestId);

      await expect(chainLend.connect(borrower).repayLoan(requestId))
        .to.be.revertedWithCustomError(chainLend, "InvalidLoan");
    });

    it("Should revert when borrower has insufficient USDC balance", async function () {
      // Create a new borrower with no USDC
      const [, , , poorBorrower] = await ethers.getSigners();
      const { chainLend: newChainLend, lender: newLender } = await loadFixture(deployChainLendFixture);
      
      // Create loan request with poor borrower
      const amountRequested = ethers.parseUnits("1000", 6);
      const requiredCollateral = await newChainLend.calculateRequiredCollateral(amountRequested);
      
      await newChainLend.connect(poorBorrower).createLoanRequest(
        amountRequested,
        1000,
        30 * 24 * 60 * 60,
        { value: requiredCollateral }
      );
      
      await newChainLend.connect(newLender).fundLoan(1);

      await expect(newChainLend.connect(poorBorrower).repayLoan(1))
        .to.be.reverted; // ERC20 will revert on insufficient balance
    });
  });

  // REPAYMENT CALCULATION TESTS 
  
  describe("Repayment Calculations", function () {
    let chainLend, borrower, lender, treasury, usdcToken;

    beforeEach(async function () {
      ({ chainLend, borrower, lender, treasury, usdcToken } = await loadFixture(deployChainLendFixture));
    });

    it("Should calculate correct amounts for minimum loan parameters", async function () {
      const minAmount = ethers.parseUnits("1", 6);
      const minRate = await chainLend.MIN_INTEREST_RATE();
      const minDuration = await chainLend.MIN_LOAN_DURATION();
      const requiredCollateral = await chainLend.calculateRequiredCollateral(minAmount);

      await chainLend.connect(borrower).createLoanRequest(
        minAmount,
        minRate,
        minDuration,
        { value: requiredCollateral }
      );

      await chainLend.connect(lender).fundLoan(1);

      const activeLoan = await chainLend.getActiveLoan(1);
      const protocolFee = activeLoan.interestAmount * 1000n / 10000n;
      const lenderAmount = activeLoan.totalAmountDue - protocolFee;

      const lenderBalanceBefore = await usdcToken.balanceOf(lender.address);
      const treasuryBalanceBefore = await usdcToken.balanceOf(treasury.address);
      
      await chainLend.connect(borrower).repayLoan(1);

      const lenderBalanceAfter = await usdcToken.balanceOf(lender.address);
      const treasuryBalanceAfter = await usdcToken.balanceOf(treasury.address);

      expect(lenderBalanceAfter - lenderBalanceBefore).to.equal(lenderAmount);
      expect(treasuryBalanceAfter - treasuryBalanceBefore).to.equal(protocolFee);
    });
  });

  // REPAYMENT STATE MANAGEMENT TESTS 
  
  describe("Repayment State Management", function () {
    let chainLend, borrower, lender, requestId;

    beforeEach(async function () {
      ({ chainLend, borrower, lender, requestId } = await loadFixture(createActiveLoanFixture));
    });

    it("Should properly transition loan state from Active to Repaid", async function () {
      const loanBefore = await chainLend.getActiveLoan(requestId);
      expect(loanBefore.status).to.equal(0); // Active

      await chainLend.connect(borrower).repayLoan(requestId);

      const loanAfter = await chainLend.getActiveLoan(requestId);
      expect(loanAfter.status).to.equal(1); // Repaid
    });

    it("Should update protocol statistics after repayment", async function () {
      const statsBefore = await chainLend.getProtocolStats();
      
      await chainLend.connect(borrower).repayLoan(requestId);

      const statsAfter = await chainLend.getProtocolStats();
      
      expect(statsAfter[2]).to.equal(statsBefore[2] - 1n); // activeLoansCount decreased
    });
  });
});