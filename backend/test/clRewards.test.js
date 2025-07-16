const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

const { deployChainLendFixture, createUserWithRewardsFixture } = require("./fixtures");

describe("CL Token Rewards", function () {
  
  // REWARD EARNING TESTS

  describe("Rewards Earning", function () {
    let chainLend, borrower, lender, clToken, usdcToken;

    beforeEach(async function () {
      ({ chainLend, borrower, lender, clToken, usdcToken } = await loadFixture(deployChainLendFixture));
    });

    it("Should validate reward constants", async function () {
      expect(await chainLend.REWARD_CREATE_REQUEST()).to.equal(ethers.parseEther("10"));
      expect(await chainLend.REWARD_FUND_LOAN()).to.equal(ethers.parseEther("50"));
      expect(await chainLend.REWARD_REPAY_ONTIME()).to.equal(ethers.parseEther("100"));
      expect(await chainLend.REWARD_LIQUIDATE()).to.equal(ethers.parseEther("20"));
      expect(await chainLend.MIN_CLAIM_AMOUNT()).to.equal(ethers.parseEther("10"));
    });

    it("Should earn rewards for creating loan request", async function () {
      const amountRequested = ethers.parseUnits("1000", 6);
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);

      await expect(chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        1000,
        30 * 24 * 60 * 60,
        { value: requiredCollateral }
      )).to.emit(chainLend, "CLRewardsEarned")
        .withArgs(borrower.address, ethers.parseEther("10"), "Create Request");

      const pendingRewards = await chainLend.pendingCLRewards(borrower.address);
      expect(pendingRewards).to.equal(ethers.parseEther("10"));
    });

    it("Should earn rewards for funding loan", async function () {
      const amountRequested = ethers.parseUnits("1000", 6);
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);

      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        1000,
        30 * 24 * 60 * 60,
        { value: requiredCollateral }
      );

      await expect(chainLend.connect(lender).fundLoan(1))
        .to.emit(chainLend, "CLRewardsEarned")
        .withArgs(lender.address, ethers.parseEther("50"), "Fund Loan");

      const pendingRewards = await chainLend.pendingCLRewards(lender.address);
      expect(pendingRewards).to.equal(ethers.parseEther("50"));
    });

    it("Should accumulate rewards from multiple actions", async function () {
      const amountRequested = ethers.parseUnits("1000", 6);
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);

      // Borrower creates multiple requests
      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        1000,
        30 * 24 * 60 * 60,
        { value: requiredCollateral }
      );

      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        1100,
        45 * 24 * 60 * 60,
        { value: requiredCollateral }
      );

      const pendingRewards = await chainLend.pendingCLRewards(borrower.address);
      expect(pendingRewards).to.equal(ethers.parseEther("20")); // 10 + 10
    });

    it("Should accumulate rewards for lender funding multiple loans", async function () {
      const amountRequested = ethers.parseUnits("500", 6);
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);

      // Create multiple loan requests
      for (let i = 0; i < 3; i++) {
        await chainLend.connect(borrower).createLoanRequest(
          amountRequested,
          1000,
          30 * 24 * 60 * 60,
          { value: requiredCollateral }
        );
      }

      // Fund all loans
      await chainLend.connect(lender).fundLoan(1);
      await chainLend.connect(lender).fundLoan(2);
      await chainLend.connect(lender).fundLoan(3);

      const pendingRewards = await chainLend.pendingCLRewards(lender.address);
      expect(pendingRewards).to.equal(ethers.parseEther("150")); // 50 * 3
    });
  });

  // REWARD CLAIMING TESTS 
  
  describe("Rewards Claiming", function () {
    let chainLend, borrower, lender, clToken;

    beforeEach(async function () {
      ({ chainLend, borrower, lender, clToken } = await loadFixture(createUserWithRewardsFixture));
    });

    it("Should allow claiming rewards when above or equal minimum", async function () {
      await expect(chainLend.connect(borrower).claimCLRewards())
        .to.emit(chainLend, "CLRewardsClaimed")
        .withArgs(borrower.address, ethers.parseEther("10"));
    });

    it("Should mint CL tokens to user when claiming", async function () {
      const balanceBefore = await clToken.balanceOf(borrower.address);
      
      await chainLend.connect(borrower).claimCLRewards();
      
      const balanceAfter = await clToken.balanceOf(borrower.address);
      expect(balanceAfter - balanceBefore).to.equal(ethers.parseEther("10"));
    });

    it("Should reset pending rewards to zero after claiming", async function () {
      await chainLend.connect(borrower).claimCLRewards();
      
      const pendingRewards = await chainLend.pendingCLRewards(borrower.address);
      expect(pendingRewards).to.equal(0);
    });

    it("Should allow claiming larger reward amounts", async function () {
      // Lender has 50 CL pending
      const pendingBefore = await chainLend.pendingCLRewards(lender.address);
      expect(pendingBefore).to.equal(ethers.parseEther("50"));

      await chainLend.connect(lender).claimCLRewards();

      const balanceAfter = await clToken.balanceOf(lender.address);
      expect(balanceAfter).to.equal(ethers.parseEther("50"));
    });

    it("Should handle multiple claims correctly", async function () {
      // First claim
      await chainLend.connect(borrower).claimCLRewards();
      expect(await clToken.balanceOf(borrower.address)).to.equal(ethers.parseEther("10"));

      // Earn more rewards
      const amountRequested = ethers.parseUnits("500", 6);
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);

      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        1000,
        30 * 24 * 60 * 60,
        { value: requiredCollateral }
      );

      // Second claim
      await chainLend.connect(borrower).claimCLRewards();
      expect(await clToken.balanceOf(borrower.address)).to.equal(ethers.parseEther("20"));
    });
  });

  // REWARD CLAIMING REVERT TESTS 
  
  describe("Rewards Claiming Revert", function () {
    let chainLend, clToken;

    beforeEach(async function () {
      ({ chainLend, clToken } = await loadFixture(deployChainLendFixture));
    });

    it("Should revert when claiming below minimum amount", async function () {
      const [, , , , , newUser] = await ethers.getSigners();
      
      // User with no rewards
      await expect(chainLend.connect(newUser).claimCLRewards())
        .to.be.revertedWithCustomError(chainLend, "InvalidAmount");
    });
  });

  // ========== REWARD INTEGRATION TESTS ==========
  
  describe("Rewards Integration", function () {
    let chainLend, borrower, lender, clToken, ethPriceFeed, usdcToken;

    beforeEach(async function () {
      ({ chainLend, borrower, lender, clToken, ethPriceFeed, usdcToken } = await loadFixture(deployChainLendFixture));
    });

    it("Should integrate rewards with complete loan lifecycle", async function () {
      const amountRequested = ethers.parseUnits("1000", 6);
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);

      // Create request (10 CL for borrower)
      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        1000,
        30 * 24 * 60 * 60,
        { value: requiredCollateral }
      );

      // Fund loan (50 CL for lender)
      await chainLend.connect(lender).fundLoan(1);

      // Repay loan (should not give additional rewards in current implementation)
      await chainLend.connect(borrower).repayLoan(1);

      // Check final rewards
      expect(await chainLend.pendingCLRewards(borrower.address)).to.equal(ethers.parseEther("10"));
      expect(await chainLend.pendingCLRewards(lender.address)).to.equal(ethers.parseEther("50"));

      // Both should be able to claim
      await chainLend.connect(borrower).claimCLRewards();
      await chainLend.connect(lender).claimCLRewards();

      expect(await clToken.balanceOf(borrower.address)).to.equal(ethers.parseEther("10"));
      expect(await clToken.balanceOf(lender.address)).to.equal(ethers.parseEther("50"));
    });

    it("Should handle rewards in liquidation", async function () {
      const { liquidator } = await loadFixture(deployChainLendFixture);
      const amountRequested = ethers.parseUnits("1000", 6);
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);

      // Create and fund loan
      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        1000,
        30 * 24 * 60 * 60,
        { value: requiredCollateral }
      );

      await chainLend.connect(lender).fundLoan(1);

      // Drop price to trigger liquidation
      await ethPriceFeed.updatePrice(1000e8);

      // Liquidate (should not give additional rewards in current implementation)
      await chainLend.connect(liquidator).liquidateCollateral(1);

      // Check rewards remain from creation and funding
      expect(await chainLend.pendingCLRewards(borrower.address)).to.equal(ethers.parseEther("10"));
      expect(await chainLend.pendingCLRewards(lender.address)).to.equal(ethers.parseEther("50")); 
    });

    it("Should handle rewards with loan cancellation", async function () {
      const amountRequested = ethers.parseUnits("1000", 6);
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);

      // Create request (10 CL for borrower)
      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        1000,
        30 * 24 * 60 * 60,
        { value: requiredCollateral }
      );

      // Cancel request (rewards should remain)
      await chainLend.connect(borrower).cancelLoanRequest(1);

      // Borrower should still have rewards from creation
      expect(await chainLend.pendingCLRewards(borrower.address)).to.equal(ethers.parseEther("10"));

      await chainLend.connect(borrower).claimCLRewards();
      expect(await clToken.balanceOf(borrower.address)).to.equal(ethers.parseEther("10"));
    });
  });

  // REWARD SYSTEM SECURITY TESTS 
  
  describe("Rewards Security", function () {
    let chainLend, borrower, clToken;

    beforeEach(async function () {
      ({ chainLend, borrower, clToken } = await loadFixture(createUserWithRewardsFixture));
    });

    it("Should validate CLToken minting permissions", async function () {
      // Only ChainLend should be able to mint CL tokens
      expect(await clToken.isMinter(await chainLend.getAddress())).to.be.true;
      expect(await clToken.isMinter(borrower.address)).to.be.false;

      await expect(clToken.connect(borrower).mint(borrower.address, ethers.parseEther("100")))
        .to.be.revertedWithCustomError(clToken, "NotMinter");
    });
  });
});