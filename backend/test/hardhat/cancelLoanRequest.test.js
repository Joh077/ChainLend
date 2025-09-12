const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

const { deployChainLendFixture, createPendingLoanFixture } = require("./fixtures");

describe("Cancel Loan Request", function () {
  
  // LOAN REQUEST CANCEL TESTS 
  
  describe("Loan Request Cancellation", function () {
    let chainLend, borrower, requestId, requiredCollateral;

    beforeEach(async function () {
      ({ chainLend, borrower, requestId, requiredCollateral } = await loadFixture(createPendingLoanFixture));
    });

    it("Should allow borrower to cancel their own request", async function () {
      await expect(chainLend.connect(borrower).cancelLoanRequest(requestId))
        .to.not.be.reverted;
    });

    it("Should emit LoanRequestCancelled event", async function () {
      await expect(chainLend.connect(borrower).cancelLoanRequest(requestId))
        .to.emit(chainLend, "LoanRequestCancelled")
        .withArgs(requestId, borrower.address, requiredCollateral);
    });

    it("Should refund collateral to borrower", async function () {
      const balanceBefore = await ethers.provider.getBalance(borrower.address);
      
      const tx = await chainLend.connect(borrower).cancelLoanRequest(requestId);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      
      const balanceAfter = await ethers.provider.getBalance(borrower.address);
      expect(balanceAfter + gasUsed - balanceBefore).to.equal(requiredCollateral);
    });

    it("Should set request status to Cancelled", async function () {
      await chainLend.connect(borrower).cancelLoanRequest(requestId);

      const request = await chainLend.getLoanRequest(requestId);
      expect(request.status).to.equal(2); // RequestStatus.Cancelled
    });

    it("Should reset actualCollateralDeposited to zero", async function () {
      await chainLend.connect(borrower).cancelLoanRequest(requestId);

      const request = await chainLend.getLoanRequest(requestId);
      expect(request.actualCollateralDeposited).to.equal(0);
    });

    it("Should decrement totalActiveRequests", async function () {
      const totalBefore = await chainLend.totalActiveRequests();
      
      await chainLend.connect(borrower).cancelLoanRequest(requestId);

      const totalAfter = await chainLend.totalActiveRequests();
      expect(totalAfter).to.equal(totalBefore - 1n);
    });
  });

  // CANCEL VALIDATION TESTS
  
  describe("Cancellation revert and validation", function () {
    let chainLend, borrower, lender, requestId;

    beforeEach(async function () {
      ({ chainLend, borrower, lender, requestId } = await loadFixture(createPendingLoanFixture));
    });

    it("Should revert when non-borrower tries to cancel", async function () {
      await expect(chainLend.connect(lender).cancelLoanRequest(requestId))
        .to.be.revertedWithCustomError(chainLend, "Unauthorized");
    });

    it("Should revert when cancelling invalid request ID (zero)", async function () {
      await expect(chainLend.connect(borrower).cancelLoanRequest(0))
      .to.be.revertedWithCustomError(chainLend, "InvalidRequest")
    });

    it("Should revert when cancelling already funded request", async function () {
      // Fund the loan first
      await chainLend.connect(lender).fundLoan(requestId);

      await expect(chainLend.connect(borrower).cancelLoanRequest(requestId))
        .to.be.revertedWithCustomError(chainLend, "InvalidRequestStatus");
    });

    it("Should revert when cancelling already cancelled request", async function () {
      // Cancel once
      await chainLend.connect(borrower).cancelLoanRequest(requestId);

      // Try to cancel again
      await expect(chainLend.connect(borrower).cancelLoanRequest(requestId))
        .to.be.revertedWithCustomError(chainLend, "InvalidRequestStatus");
    });

    it("Should handle unauthorized access with different users", async function () {
      const [, , , randomUser] = await ethers.getSigners();
      
      await expect(chainLend.connect(randomUser).cancelLoanRequest(requestId))
        .to.be.revertedWithCustomError(chainLend, "Unauthorized");
    });

    it("Should not let original borrower to cancel new borrower request", async function () {
      // Create and cancel one request
      await chainLend.connect(borrower).cancelLoanRequest(requestId);
      
      // Create a new request by different borrower
      const [, , , , , newBorrower] = await ethers.getSigners();
      const amountRequested = ethers.parseUnits("500", 6);
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);
      
      await chainLend.connect(newBorrower).createLoanRequest(
        amountRequested,
        1000,
        30 * 24 * 60 * 60,
        { value: requiredCollateral }
      );

      await expect(chainLend.connect(borrower).cancelLoanRequest(2))
        .to.be.revertedWithCustomError(chainLend, "Unauthorized");
    });
  });

  // CANCELLATION EDGE CASES 
  
  describe("Cancellation Edge Cases", function () {
    let chainLend, borrower;

    beforeEach(async function () {
      ({ chainLend, borrower } = await loadFixture(deployChainLendFixture));
    });

    it("Should handle cancellation with minimal collateral", async function () {
      const amountRequested = ethers.parseUnits("1", 6); // 1 USDC
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);

      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        1000,
        30 * 24 * 60 * 60,
        { value: requiredCollateral }
      );

      await expect(chainLend.connect(borrower).cancelLoanRequest(1))
        .to.not.be.reverted;
    });

    it("Should handle cancellation with maximum collateral", async function () {
      const maxAmount = await chainLend.MAX_LOAN_AMOUNT();
      const requiredCollateral = await chainLend.calculateRequiredCollateral(maxAmount);

      await chainLend.connect(borrower).createLoanRequest(
        maxAmount,
        1000,
        30 * 24 * 60 * 60,
        { value: requiredCollateral }
      );

      await expect(chainLend.connect(borrower).cancelLoanRequest(1))
        .to.not.be.reverted;
    });
  });
});