const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");


const { deployChainLendFixture, createPendingLoanFixture } = require("./fixtures");

describe("Test Fund Loan Function", function () {
  
  // LOAN FUNDING TESTS 
  
  describe("Loan Funding", function () {
    let chainLend, borrower, lender, usdcToken, requestId, amountRequested;

    beforeEach(async function () {
      ({ chainLend, borrower, lender, usdcToken, requestId, amountRequested } = await loadFixture(createPendingLoanFixture));
    });

    it("Should fund loan successfully", async function () {
      await expect(chainLend.connect(lender).fundLoan(requestId))
        .to.not.be.reverted;
    });

    it("Should emit LoanFunded event", async function () {
      await expect(chainLend.connect(lender).fundLoan(requestId))
        .to.emit(chainLend, "LoanFunded");
    });

    it("Should emit CLRewardsEarned event for lender", async function () {
      await expect(chainLend.connect(lender).fundLoan(requestId))
        .to.emit(chainLend, "CLRewardsEarned")
        .withArgs(lender.address, ethers.parseEther("50"), "Fund Loan");
    });

    it("Should transfer USDC from lender to borrower", async function () {
      const lenderBalanceBefore = await usdcToken.balanceOf(lender.address);
      const borrowerBalanceBefore = await usdcToken.balanceOf(borrower.address);

      await chainLend.connect(lender).fundLoan(requestId);

      const lenderBalanceAfter = await usdcToken.balanceOf(lender.address);
      const borrowerBalanceAfter = await usdcToken.balanceOf(borrower.address);

      expect(lenderBalanceBefore - lenderBalanceAfter).to.equal(amountRequested);
      expect(borrowerBalanceAfter - borrowerBalanceBefore).to.equal(amountRequested);
    });

    it("Should create active loan with correct data", async function () {
      await chainLend.connect(lender).fundLoan(requestId);

      const activeLoan = await chainLend.getActiveLoan(requestId);
      expect(activeLoan.requestId).to.equal(requestId);
      expect(activeLoan.lender).to.equal(lender.address);
      expect(activeLoan.principalAmount).to.equal(amountRequested);
      expect(activeLoan.status).to.equal(0); // LoanStatus.Active
    });

    it("Should calculate interest correctly", async function () {
      await chainLend.connect(lender).fundLoan(requestId);

      const activeLoan = await chainLend.getActiveLoan(requestId);
      const request = await chainLend.getLoanRequest(requestId);
      
      // Interest = Principal * Rate * Duration / (365 days * 10000)
      const expectedAnnualInterest = amountRequested * BigInt(request.interestRate) / 10000n;
      const expectedInterest = expectedAnnualInterest * BigInt(request.duration) / (365n * 24n * 3600n);
      
      expect(activeLoan.interestAmount).to.equal(expectedInterest);
      expect(activeLoan.totalAmountDue).to.equal(amountRequested + expectedInterest);
    });

    it("Should set correct due date", async function () {
      const fundTimestamp = await ethers.provider.getBlock('latest').then(b => b.timestamp);
      
      await chainLend.connect(lender).fundLoan(requestId);

      const activeLoan = await chainLend.getActiveLoan(requestId);
      const request = await chainLend.getLoanRequest(requestId);
      
      expect(activeLoan.dueDate).to.be.approximately(
        BigInt(fundTimestamp) + request.duration,
        10 // Allow for block timing differences
      );
    });

    it("Should update request status to Funded", async function () {
      await chainLend.connect(lender).fundLoan(requestId);

      const request = await chainLend.getLoanRequest(requestId);
      expect(request.status).to.equal(1); // RequestStatus.Funded
    });

    it("Should increment totalActiveLoans", async function () {
      const totalBefore = await chainLend.totalActiveLoans();
      
      await chainLend.connect(lender).fundLoan(requestId);

      const totalAfter = await chainLend.totalActiveLoans();
      expect(totalAfter).to.equal(totalBefore + 1n);
    });

    it("Should decrement totalActiveRequests", async function () {
      const totalBefore = await chainLend.totalActiveRequests();
      
      await chainLend.connect(lender).fundLoan(requestId);

      const totalAfter = await chainLend.totalActiveRequests();
      expect(totalAfter).to.equal(totalBefore - 1n);
    });

    it("Should update user loan count for lender", async function () {
      const countBefore = await chainLend.userLoanCount(lender.address);
      
      await chainLend.connect(lender).fundLoan(requestId);

      const countAfter = await chainLend.userLoanCount(lender.address);
      expect(countAfter).to.equal(countBefore + 1n);
    });

    it("Should add loan to lender's loan list", async function () {
      await chainLend.connect(lender).fundLoan(requestId);

      const userLoans = await chainLend.getUserLoans(lender.address);
      expect(userLoans).to.include(BigInt(requestId));
    });

    it("Should accumulate CL rewards for lender", async function () {
      const rewardsBefore = await chainLend.pendingCLRewards(lender.address);
      
      await chainLend.connect(lender).fundLoan(requestId);

      const rewardsAfter = await chainLend.pendingCLRewards(lender.address);
      expect(rewardsAfter).to.equal(rewardsBefore + ethers.parseEther("50"));
    });
  });

  // LOAN FUNDING REVERT TESTS ==========
  
  describe("Loan Funding Reverts", function () {
    let chainLend, borrower, lender, requestId, usdcToken;

    beforeEach(async function () {
      ({ chainLend, borrower, lender, requestId, usdcToken } = await loadFixture(createPendingLoanFixture));
    });

    it("Should revert when borrower tries to fund own request", async function () {
      await expect(chainLend.connect(borrower).fundLoan(requestId))
        .to.be.revertedWithCustomError(chainLend, "InvalidRequest")
        .withArgs(requestId, "Cannot fund own request");
    });

    it("Should revert when funding non-existent loan", async function () {
      await expect(chainLend.connect(lender).fundLoan(999))
        .to.be.revertedWithCustomError(chainLend, "InvalidRequest");
    });

    it("Should revert when funding already funded loan", async function () {
      await chainLend.connect(lender).fundLoan(requestId);

      await expect(chainLend.connect(lender).fundLoan(requestId))
        .to.be.revertedWithCustomError(chainLend, "InvalidRequestStatus");
    });

    it("Should revert when funding cancelled loan", async function () {
      await chainLend.connect(borrower).cancelLoanRequest(requestId);

      await expect(chainLend.connect(lender).fundLoan(requestId))
        .to.be.revertedWithCustomError(chainLend, "InvalidRequestStatus");
    });

    it("Should revert when lender has insufficient USDC balance", async function () {
      // Create lender with insufficient balance
      const [, , , poorLender] = await ethers.getSigners();
      const { chainLend: newChainLend, usdcToken: newUsdcToken } = await loadFixture(deployChainLendFixture);
      
      // Mint only small amount to poor lender
      await newUsdcToken.mint(poorLender.address, ethers.parseUnits("100", 6));
      await newUsdcToken.connect(poorLender).approve(await newChainLend.getAddress(), ethers.MaxUint256);

      // Create large loan request
      const { borrower: newBorrower } = await loadFixture(deployChainLendFixture);
      const largeAmount = ethers.parseUnits("1000", 6);
      const requiredCollateral = await newChainLend.calculateRequiredCollateral(largeAmount);
      
      await newChainLend.connect(newBorrower).createLoanRequest(
        largeAmount,
        1000,
        30 * 24 * 60 * 60,
        { value: requiredCollateral }
      );

      await expect(newChainLend.connect(poorLender).fundLoan(1))
        .to.be.reverted; // ERC20 insufficient balance
    });

    it("Should revert when lender has insufficient USDC allowance", async function () {
      // Reset allowance to zero
      await usdcToken.connect(lender).approve(await chainLend.getAddress(), 0);

      await expect(chainLend.connect(lender).fundLoan(requestId))
        .to.be.reverted; // ERC20 insufficient allowance
    });

    it("Should revert with invalid request ID", async function () {
      await expect(chainLend.connect(lender).fundLoan(0))
        .to.be.revertedWithCustomError(chainLend, "InvalidRequest");
    });
  });

  // INTEREST CALCULATION
  
  describe("Interest Calculation", function () {
    let chainLend, borrower, lender;

    beforeEach(async function () {
      ({ chainLend, borrower, lender } = await loadFixture(deployChainLendFixture));
    });

    it("Should handle minimum interest rate and duration", async function () {
      const amountRequested = ethers.parseUnits("1000", 6);
      const minInterestRate = await chainLend.MIN_INTEREST_RATE(); // 5%
      const minDuration = await chainLend.MIN_LOAN_DURATION(); // 30 days
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);

      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        minInterestRate,
        minDuration,
        { value: requiredCollateral }
      );

      await chainLend.connect(lender).fundLoan(1);

      const activeLoan = await chainLend.getActiveLoan(1);
      expect(activeLoan.interestAmount).to.be.gt(0);
    });

    it("Should handle maximum interest rate and duration", async function () {
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
      expect(activeLoan.interestAmount).to.be.gt(0);
      expect(activeLoan.totalAmountDue).to.be.gt(amountRequested);
    });
  });
});