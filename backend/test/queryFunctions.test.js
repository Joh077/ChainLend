const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");


const { deployChainLendFixture, createMultipleLoansFixture } = require("./fixtures");

describe("Query Functions", function () {
  
  // QUERY FUNCTIONS TESTS 
  
  describe("Query Functions", function () {
    let chainLend, borrower, lender, ethPriceFeed;

    beforeEach(async function () {
      ({ chainLend, borrower, lender, ethPriceFeed } = await loadFixture(createMultipleLoansFixture));
    });

    it("Should return correct health factor for active loan", async function () {
      const healthFactor = await chainLend.getHealthFactor(2); // Active loan
      expect(healthFactor).to.be.gt(0);
      
      // Should be around 150% (15000 basis points) initially
      expect(healthFactor).to.be.gte(15000);
    });

    it("Should revert getHealthFactor for non-active loan", async function () {
      await expect(chainLend.getHealthFactor(1)) // Repaid loan
        .to.be.revertedWithCustomError(chainLend, "InvalidLoan")
        .withArgs(1, "Loan not active");
    });

    it("Should detect loan at risk of liquidation", async function () {
      // Drop ETH price to put loan at risk
      await ethPriceFeed.updatePrice(1400e8); // Below WARNING_THRESHOLD (140%)
      
      const [atRisk, currentRatio] = await chainLend.isAtRiskOfLiquidation(2);
      expect(atRisk).to.be.true;
      expect(currentRatio).to.be.lt(14000); // Below WARNING_THRESHOLD
    });

    it("Should return false for safe loan not at risk", async function () {
      const [atRisk, currentRatio] = await chainLend.isAtRiskOfLiquidation(2);
      expect(atRisk).to.be.false;
      expect(currentRatio).to.be.gte(14000); // Above WARNING_THRESHOLD
    });

    it("Should return false for non-active loan in risk check", async function () {
      const [atRisk, currentRatio] = await chainLend.isAtRiskOfLiquidation(1); // Repaid loan
      expect(atRisk).to.be.false;
      expect(currentRatio).to.equal(0);
    });

    it("Should calculate excess collateral correctly", async function () {
      // Add extra collateral to loan 2
      await chainLend.connect(borrower).addCollateral(2, { value: ethers.parseEther("1") });
      
      const excessAmount = await chainLend.getExcessCollateral(2);
      expect(excessAmount).to.be.gt(0);
    });

    it("Should return zero excess for non-active loan", async function () {
      const excessAmount = await chainLend.getExcessCollateral(1); // Repaid loan
      expect(excessAmount).to.equal(0);
    });
  });

  // DATA RESEARCH TESTS 
  
  describe("Data Research Functions", function () {
    let chainLend, borrower, lender, amounts, requestIds;

    beforeEach(async function () {
      ({ chainLend, borrower, lender, amounts, requestIds } = await loadFixture(createMultipleLoansFixture));
    });

    it("Should return correct loan request data", async function () {
      const request = await chainLend.getLoanRequest(1);
      
      expect(request.id).to.equal(1);
      expect(request.borrower).to.equal(borrower.address);
      expect(request.amountRequested).to.equal(amounts[0]);
      expect(request.status).to.equal(1); // Funded
    });

    it("Should revert getLoanRequest for invalid ID range", async function () {
      await expect(chainLend.getLoanRequest(0))
        .to.be.revertedWithCustomError(chainLend, "InvalidRequest")
        .withArgs(0, "Invalid ID range");
      
      await expect(chainLend.getLoanRequest(500))
        .to.be.revertedWithCustomError(chainLend, "InvalidRequest")
        .withArgs(500, "Invalid ID range");
    });

    it("Should return correct active loan data", async function () {
      const activeLoan = await chainLend.getActiveLoan(2);
      
      expect(activeLoan.requestId).to.equal(2);
      expect(activeLoan.lender).to.equal(lender.address);
      expect(activeLoan.status).to.equal(0); // Active
      expect(activeLoan.principalAmount).to.equal(amounts[1]);
    });

    it("Should revert getActiveLoan for invalid ID range", async function () {
      await expect(chainLend.getActiveLoan(0))
        .to.be.revertedWithCustomError(chainLend, "InvalidLoan")
        .withArgs(0, "Invalid ID range");
      
      await expect(chainLend.getActiveLoan(500))
        .to.be.revertedWithCustomError(chainLend, "InvalidLoan")
        .withArgs(500, "Invalid ID range");
    });

    it("Should revert getActiveLoan for non-existent active loan", async function () {
      await expect(chainLend.getActiveLoan(3)) // Pending request
        .to.be.revertedWithCustomError(chainLend, "InvalidLoan")
        .withArgs(3, "Active loan not found");
    });

    it("Should return active loan data even for repaid loans", async function () {
      const repaidLoan = await chainLend.getActiveLoan(1);
      
      expect(repaidLoan.requestId).to.equal(1);
      expect(repaidLoan.status).to.equal(1); // Repaid
    });

    it("Should return correct user requests", async function () {
      const userRequests = await chainLend.getUserRequests(borrower.address);
      
      expect(userRequests.length).to.equal(3);
      expect(userRequests).to.include(1n);
      expect(userRequests).to.include(2n);
      expect(userRequests).to.include(3n);
    });

    it("Should return correct user loans", async function () {
      const userLoans = await chainLend.getUserLoans(lender.address);
      
      expect(userLoans.length).to.equal(2);
      expect(userLoans).to.include(1n);
      expect(userLoans).to.include(2n);
    });

    it("Should return empty arrays for users with no activity", async function () {
      const [, , , , , newUser] = await ethers.getSigners();
      
      const userRequests = await chainLend.getUserRequests(newUser.address);
      const userLoans = await chainLend.getUserLoans(newUser.address);
      
      expect(userRequests.length).to.equal(0);
      expect(userLoans.length).to.equal(0);
    });
  });

  // PENDING REQUESTS TESTS 
  
  describe("Pending Requests Functions", function () {
    let chainLend, borrower, lender;

    beforeEach(async function () {
      ({ chainLend, borrower, lender } = await loadFixture(createMultipleLoansFixture));
    });

    it("Should update pending count when requests are funded", async function () {
      const countBefore = await chainLend.getPendingRequestsCount();
      
      await chainLend.connect(lender).fundLoan(3);
      
      const countAfter = await chainLend.getPendingRequestsCount();
      expect(countAfter).to.equal(countBefore - 1n);
    });

    it("Should update pending count when requests are cancelled", async function () {
      const countBefore = await chainLend.getPendingRequestsCount();
      
      await chainLend.connect(borrower).cancelLoanRequest(3);
      
      const countAfter = await chainLend.getPendingRequestsCount();
      expect(countAfter).to.equal(countBefore - 1n);
    });
  });

  // WITHDRAWAL STATUS TESTS 
  
  describe("Withdrawal Status Functions", function () {
    let chainLend, borrower, lender;

    beforeEach(async function () {
      ({ chainLend, borrower, lender } = await loadFixture(createMultipleLoansFixture));
    });

    it("Should return correct withdrawal status for repaid loan", async function () {
      const [canWithdraw, amount, reason] = await chainLend.canWithdrawCollateral(1);
      
      expect(canWithdraw).to.be.true;
      expect(amount).to.be.gt(0);
      expect(reason).to.equal("");
    });

    it("Should return false for active loan", async function () {
      const [canWithdraw, amount, reason] = await chainLend.canWithdrawCollateral(2);
      
      expect(canWithdraw).to.be.false;
      expect(amount).to.be.gt(0);
      expect(reason).to.equal("Loan must be repaid first");
    });

    it("Should return false for pending request", async function () {
      const [canWithdraw, amount, reason] = await chainLend.canWithdrawCollateral(3);
      
      expect(canWithdraw).to.be.false;
      expect(amount).to.be.gt(0);
      expect(reason).to.equal("Loan must be repaid first");
    });

    it("Should return 'Invalid request ID' for out of range IDs", async function () {
      const [canWithdraw1, amount1, reason1] = await chainLend.canWithdrawCollateral(0);
      expect(canWithdraw1).to.be.false;
      expect(amount1).to.equal(0);
      expect(reason1).to.equal("Invalid request ID");

      const [canWithdraw2, amount2, reason2] = await chainLend.canWithdrawCollateral(999);
      expect(canWithdraw2).to.be.false;
      expect(amount2).to.equal(0);
      expect(reason2).to.equal("Invalid request ID");
    });

    it("Should return 'No collateral deposited' after withdrawal", async function () {
      // Withdraw collateral from repaid loan
      await chainLend.connect(borrower).withdrawCollateral(1);
      
      const [canWithdraw, amount, reason] = await chainLend.canWithdrawCollateral(1);
      
      expect(canWithdraw).to.be.false;
      expect(amount).to.equal(0);
      expect(reason).to.equal("No collateral deposited");
    });

    it("Should return 'No collateral deposited' for cancelled request", async function () {
      // Create and cancel a request
      const amount = ethers.parseUnits("500", 6);
      const collateral = await chainLend.calculateRequiredCollateral(amount);
      
      await chainLend.connect(borrower).createLoanRequest(
        amount,
        1000,
        30 * 24 * 60 * 60,
        { value: collateral }
      );
      
      await chainLend.connect(borrower).cancelLoanRequest(4);
      
      const [canWithdraw, collateralAmount, reason] = await chainLend.canWithdrawCollateral(4);
      
      expect(canWithdraw).to.be.false;
      expect(collateralAmount).to.equal(0);
      expect(reason).to.equal("No collateral deposited");
    });

  });

  // ========== PROTOCOL STATISTICS TESTS ==========
  
  describe("Protocol Statistics", function () {
    let chainLend, borrower, lender, amounts;

    beforeEach(async function () {
      ({ chainLend, borrower, lender, amounts } = await loadFixture(createMultipleLoansFixture));
    });

    it("Should return correct protocol statistics", async function () {
      const [totalRequests, activeRequests, activeLoansCount, totalVolume] = 
        await chainLend.getProtocolStats();
      
      expect(totalRequests).to.equal(3); // 3 requests created
      expect(activeRequests).to.equal(1); // 1 pending request
      expect(activeLoansCount).to.equal(1); // 1 active loan (loan 2)
      expect(totalVolume).to.equal(amounts[0] + amounts[1]); // Volume from funded loans
    });

    it("Should update statistics when loans are created", async function () {
      const [totalBefore] = await chainLend.getProtocolStats();
      
      const amount = ethers.parseUnits("300", 6);
      const collateral = await chainLend.calculateRequiredCollateral(amount);
      
      await chainLend.connect(borrower).createLoanRequest(
        amount,
        1000,
        30 * 24 * 60 * 60,
        { value: collateral }
      );
      
      const [totalAfter, activeAfter] = await chainLend.getProtocolStats();
      
      expect(totalAfter).to.equal(totalBefore + 1n);
      expect(activeAfter).to.equal(2); // 2 pending requests now
    });

    it("Should update statistics when loans are funded", async function () {
      const [, activeBefore, activeLoansCountBefore, volumeBefore] = await chainLend.getProtocolStats();
      
      await chainLend.connect(lender).fundLoan(3);
      
      const [, activeAfter, activeLoansCountAfter, volumeAfter] = await chainLend.getProtocolStats();
      
      expect(activeAfter).to.equal(activeBefore - 1n); // One less pending request
      expect(activeLoansCountAfter).to.equal(activeLoansCountBefore + 1n); // One more active loan
      expect(volumeAfter).to.equal(volumeBefore + amounts[2]); // Volume increased
    });

    it("Should update statistics when loans are repaid", async function () {
      const [, , activeLoansCountBefore] = await chainLend.getProtocolStats();
      
      await chainLend.connect(borrower).repayLoan(2);
      
      const [, , activeLoansCountAfter] = await chainLend.getProtocolStats();
      
      expect(activeLoansCountAfter).to.equal(activeLoansCountBefore - 1n);
    });

    it("Should update statistics when requests are cancelled", async function () {
      const [, activeBefore] = await chainLend.getProtocolStats();
      
      await chainLend.connect(borrower).cancelLoanRequest(3);
      
      const [, activeAfter] = await chainLend.getProtocolStats();
      
      expect(activeAfter).to.equal(activeBefore - 1n);
    });
  });
});