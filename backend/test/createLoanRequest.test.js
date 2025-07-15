const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

const { deployChainLendFixture } = require("./fixtures");

describe("Create Loan Request", function () {
  
  // LOAN REQUEST CREATION
  
  describe("Loan Request Creation", function () {
    let chainLend, borrower, clToken;

    beforeEach(async function () {
      ({ chainLend, borrower, clToken } = await loadFixture(deployChainLendFixture));
    });

    it("Should create loan request successfully", async function () {
      const amountRequested = ethers.parseUnits("1000", 6);
      const interestRate = 1000; // 10%
      const duration = 30 * 24 * 60 * 60; // 30 days
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);

      await expect(chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        interestRate,
        duration,
        { value: requiredCollateral }
      )).to.not.be.reverted;
    });

    it("Should emit LoanRequestCreated event", async function () {
      const amountRequested = ethers.parseUnits("1000", 6);
      const interestRate = 1000;
      const duration = 30 * 24 * 60 * 60;
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);

      await expect(chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        interestRate,
        duration,
        { value: requiredCollateral }
      )).to.emit(chainLend, "LoanRequestCreated")
        .withArgs(
          1, // requestId
          borrower.address,
          amountRequested,
          requiredCollateral,
          interestRate,
          duration
        );
    });

    it("Should emit CollateralDeposited event", async function () {
      const amountRequested = ethers.parseUnits("1000", 6);
      const interestRate = 1000;
      const duration = 30 * 24 * 60 * 60;
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);

      await expect(chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        interestRate,
        duration,
        { value: requiredCollateral }
      )).to.emit(chainLend, "CollateralDeposited")
        .withArgs(
          1, // requestId
          borrower.address,
          requiredCollateral,
          requiredCollateral
        );
    });

    it("Should emit CLRewardsEarned event", async function () {
      const amountRequested = ethers.parseUnits("1000", 6);
      const interestRate = 1000;
      const duration = 30 * 24 * 60 * 60;
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);

      await expect(chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        interestRate,
        duration,
        { value: requiredCollateral }
      )).to.emit(chainLend, "CLRewardsEarned")
        .withArgs(borrower.address, ethers.parseEther("10"), "Create Request");
    });

    it("Should store loan request data correctly", async function () {
      const amountRequested = ethers.parseUnits("1000", 6);
      const interestRate = 1000;
      const duration = 30 * 24 * 60 * 60;
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);

      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        interestRate,
        duration,
        { value: requiredCollateral }
      );

      

      const request = await chainLend.getLoanRequest(1);

      expect(request.id).to.equal(1);
      expect(request.borrower).to.equal(borrower.address);
      expect(request.amountRequested).to.equal(amountRequested);
      expect(request.requiredCollateral).to.equal(requiredCollateral);
      expect(request.actualCollateralDeposited).to.equal(requiredCollateral);
      expect(request.interestRate).to.equal(interestRate);
      expect(request.duration).to.equal(duration);
      expect(request.status).to.equal(0); // RequestStatus.Pending
    });

    it("Should increment nextRequestId", async function () {
      const amountRequested = ethers.parseUnits("1000", 6);
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);

      const nextIdBefore = await chainLend.nextRequestId();
      
      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        1000,
        30 * 24 * 60 * 60,
        { value: requiredCollateral }
      );

      const nextIdAfter = await chainLend.nextRequestId();
      expect(nextIdAfter).to.equal(nextIdBefore + 1n);
    });

    it("Should increment totalActiveRequests", async function () {
      const amountRequested = ethers.parseUnits("1000", 6);
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);

      const totalBefore = await chainLend.totalActiveRequests();
      
      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        1000,
        30 * 24 * 60 * 60,
        { value: requiredCollateral }
      );

      const totalAfter = await chainLend.totalActiveRequests();
      expect(totalAfter).to.equal(totalBefore + 1n);
    });

    it("Should update user request count", async function () {
      const amountRequested = ethers.parseUnits("1000", 6);
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);

      const countBefore = await chainLend.userRequestCount(borrower.address);
      
      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        1000,
        30 * 24 * 60 * 60,
        { value: requiredCollateral }
      );

      const countAfter = await chainLend.userRequestCount(borrower.address);
      expect(countAfter).to.equal(countBefore + 1n);
    });

    it("Should add request to user's request list", async function () {
      const amountRequested = ethers.parseUnits("1000", 6);
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);

      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        1000,
        30 * 24 * 60 * 60,
        { value: requiredCollateral }
      );

      const userRequests = await chainLend.getUserRequests(borrower.address);
      expect(userRequests).to.include(1n);
    });

    it("Should accumulate CL rewards for borrower", async function () {
      const amountRequested = ethers.parseUnits("1000", 6);
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);

      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        1000,
        30 * 24 * 60 * 60,
        { value: requiredCollateral }
      );

      const pendingRewards = await chainLend.pendingCLRewards(borrower.address);
      expect(pendingRewards).to.equal(ethers.parseEther("10"));
    });

    it("Should allow excess collateral deposit", async function () {
      const amountRequested = ethers.parseUnits("1000", 6);
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);
      const excessCollateral = ethers.parseEther("1"); // Extra 1 ETH

      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        1000,
        30 * 24 * 60 * 60,
        { value: requiredCollateral + excessCollateral }
      );

      const request = await chainLend.getLoanRequest(1);
      expect(request.actualCollateralDeposited).to.equal(requiredCollateral + excessCollateral);
    });

    it("Should create multiple requests from same borrower", async function () {
      const amountRequested = ethers.parseUnits("500", 6);
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);

      // Create first request
      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        1000,
        30 * 24 * 60 * 60,
        { value: requiredCollateral }
      );

      // Create second request
      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        1200,
        60 * 24 * 60 * 60,
        { value: requiredCollateral }
      );

      expect(await chainLend.nextRequestId()).to.equal(3);
      expect(await chainLend.userRequestCount(borrower.address)).to.equal(2);
      expect(await chainLend.totalActiveRequests()).to.equal(2);
    });
  });

  // LOAN REQUEST REVERT 
  
  describe("Loan Request Reverts Verification", function () {
    let chainLend, borrower;

    beforeEach(async function () {
      ({ chainLend, borrower } = await loadFixture(deployChainLendFixture));
    });

    it("Should revert with zero amount requested", async function () {
      await expect(chainLend.connect(borrower).createLoanRequest(
        0,
        1000,
        30 * 24 * 60 * 60,
        { value: ethers.parseEther("1") }
      )).to.be.revertedWithCustomError(chainLend, "ZeroAmount");
    });

    it("Should revert with zero collateral (msg.value)", async function () {
      const amountRequested = ethers.parseUnits("1000", 6);
      
      await expect(chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        1000,
        30 * 24 * 60 * 60,
        { value: 0 }
      )).to.be.revertedWithCustomError(chainLend, "ZeroAmount");
    });

    it("Should revert when amount exceeds maximum", async function () {
      const maxAmount = await chainLend.MAX_LOAN_AMOUNT();
      const excessAmount = maxAmount + 1n;
      
      await expect(chainLend.connect(borrower).createLoanRequest(
        excessAmount,
        1000,
        30 * 24 * 60 * 60,
        { value: ethers.parseEther("1") }
      )).to.be.revertedWithCustomError(chainLend, "InvalidAmount");
    });

    it("Should revert with interest rate below minimum", async function () {
      const amountRequested = ethers.parseUnits("1000", 6);
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);
      const minRate = await chainLend.MIN_INTEREST_RATE();
      
      await expect(chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        minRate - 1n,
        30 * 24 * 60 * 60,
        { value: requiredCollateral }
      )).to.be.revertedWithCustomError(chainLend, "InvalidParameter");
    });

    it("Should revert with interest rate above maximum", async function () {
      const amountRequested = ethers.parseUnits("1000", 6);
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);
      const maxRate = await chainLend.MAX_INTEREST_RATE();
      
      await expect(chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        maxRate + 1n,
        30 * 24 * 60 * 60,
        { value: requiredCollateral }
      )).to.be.revertedWithCustomError(chainLend, "InvalidParameter");
    });

    it("Should revert with duration below minimum", async function () {
      const amountRequested = ethers.parseUnits("1000", 6);
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);
      const minDuration = await chainLend.MIN_LOAN_DURATION();
      
      await expect(chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        1000,
        minDuration - 1n,
        { value: requiredCollateral }
      )).to.be.revertedWithCustomError(chainLend, "InvalidParameter");
    });

    it("Should revert with duration above maximum", async function () {
      const amountRequested = ethers.parseUnits("1000", 6);
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);
      const maxDuration = await chainLend.MAX_LOAN_DURATION();
      
      await expect(chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        1000,
        maxDuration + 1n,
        { value: requiredCollateral }
      )).to.be.revertedWithCustomError(chainLend, "InvalidParameter");
    });

    it("Should revert with insufficient collateral", async function () {
      const amountRequested = ethers.parseUnits("1000", 6);
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);
      const insufficientCollateral = requiredCollateral - 1n;
      
      await expect(chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        1000,
        30 * 24 * 60 * 60,
        { value: insufficientCollateral }
      )).to.be.revertedWithCustomError(chainLend, "InsufficientCollateral");
    });

    it("Should accept maximum valid parameters", async function () {
      const maxAmount = await chainLend.MAX_LOAN_AMOUNT();
      const maxInterestRate = await chainLend.MAX_INTEREST_RATE();
      const maxDuration = await chainLend.MAX_LOAN_DURATION();
      const requiredCollateral = await chainLend.calculateRequiredCollateral(maxAmount);
      
      await expect(chainLend.connect(borrower).createLoanRequest(
        maxAmount,
        maxInterestRate,
        maxDuration,
        { value: requiredCollateral }
      )).to.not.be.reverted;
    });
  });
});