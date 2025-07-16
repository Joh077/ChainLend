const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");


const { deployChainLendFixture, createRepaidLoanFixture } = require("./fixtures");

describe("Withdraw Collateral Function", function () {
  
  // WITHDRAW COLLATERAL TESTS
  
  describe("Collateral Withdrawal After Repayment", function () {
    let chainLend, borrower, requestId, requiredCollateral;

    beforeEach(async function () {
      ({ chainLend, borrower, requestId, requiredCollateral } = await loadFixture(createRepaidLoanFixture));
    });

    it("Should allow borrower to withdraw collateral after repayment", async function () {
      await expect(chainLend.connect(borrower).withdrawCollateral(requestId))
        .to.not.be.reverted;
    });

    it("Should emit CollateralWithdrawn event", async function () {
      await expect(chainLend.connect(borrower).withdrawCollateral(requestId))
        .to.emit(chainLend, "CollateralWithdrawn")
        .withArgs(requestId, borrower.address, requiredCollateral, 0);
    });

    it("Should transfer collateral ETH to borrower", async function () {
      const balanceBefore = await ethers.provider.getBalance(borrower.address);
      
      const tx = await chainLend.connect(borrower).withdrawCollateral(requestId);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      
      const balanceAfter = await ethers.provider.getBalance(borrower.address);
      expect(balanceAfter + gasUsed - balanceBefore).to.equal(requiredCollateral);
    });

    it("Should reset actualCollateralDeposited to zero", async function () {
      await chainLend.connect(borrower).withdrawCollateral(requestId);

      const request = await chainLend.getLoanRequest(requestId);
      expect(request.actualCollateralDeposited).to.equal(0);
    });

    it("Should update canWithdrawCollateral status correctly", async function () {
      // Before withdrawal - should be able to withdraw
      const [canWithdrawBefore, amountBefore, reasonBefore] = await chainLend.canWithdrawCollateral(requestId);
      expect(canWithdrawBefore).to.be.true;
      expect(amountBefore).to.equal(requiredCollateral);
      expect(reasonBefore).to.equal("");

      await chainLend.connect(borrower).withdrawCollateral(requestId);

      // After withdrawal - should not be able to withdraw
      const [canWithdrawAfter, amountAfter, reasonAfter] = await chainLend.canWithdrawCollateral(requestId);
      expect(canWithdrawAfter).to.be.false;
      expect(amountAfter).to.equal(0);
      expect(reasonAfter).to.equal("No collateral deposited");
    });
  });

  // WITHDRAWAL REVERT TESTS 
  
  describe("Withdrawal Reverts Test", function () {
    let chainLend, borrower, lender, requestId;

    beforeEach(async function () {
      ({ chainLend, borrower, lender, requestId } = await loadFixture(createRepaidLoanFixture));
    });

    it("Should revert when non-borrower tries to withdraw", async function () {
      await expect(chainLend.connect(lender).withdrawCollateral(requestId))
        .to.be.revertedWithCustomError(chainLend, "Unauthorized");
    });

    it("Should revert when withdrawing from non-existent request", async function () {
      await expect(chainLend.connect(borrower).withdrawCollateral(500))
        .to.be.revertedWithCustomError(chainLend, "InvalidRequest")
        .withArgs(500, "Invalid ID range");
    });

    it("Should revert when withdrawing with invalid request ID (zero)", async function () {
      await expect(chainLend.connect(borrower).withdrawCollateral(0))
        .to.be.revertedWithCustomError(chainLend, "InvalidRequest")
        .withArgs(0, "Invalid ID range");
    });

    it("Should revert when withdrawing from non-repaid loan", async function () {
      const amount = ethers.parseUnits("1000", 6);
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amount);
      
      // Créer demande ID 2 (ID 1 existe déjà du beforeEach)
      await chainLend.connect(borrower).createLoanRequest(
        amount,
        1000,
        30 * 24 * 60 * 60,
        { value: requiredCollateral }
      );
      
      // Financer la demande ID 2
      await chainLend.connect(lender).fundLoan(2);
    
      // Essayer de retirer (devrait échouer car non remboursé)
      await expect(chainLend.connect(borrower).withdrawCollateral(2))
        .to.be.revertedWithCustomError(chainLend, "InvalidLoan");
    });

    it("Should revert when withdrawing from pending request", async function () {
      const amount = ethers.parseUnits("1000", 6);
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amount);
      
      // Créer demande pending (ID=2)
      await chainLend.connect(borrower).createLoanRequest(
        amount,
        1000,
        30 * 24 * 60 * 60,
        { value: requiredCollateral }
      );
    
      // NE PAS financer, laisser pending
      // Essayer de retirer (devrait échouer - loan pas actif)
      await expect(chainLend.connect(borrower).withdrawCollateral(2))
        .to.be.revertedWithCustomError(chainLend, "InvalidLoan");
    });


    it("Should revert when collateral already withdrawn", async function () {
      await chainLend.connect(borrower).withdrawCollateral(requestId);

      await expect(chainLend.connect(borrower).withdrawCollateral(requestId))
        .to.be.revertedWithCustomError(chainLend, "InvalidRequest")
        .withArgs(requestId, "No collateral to withdraw");
    });

    it("Should revert Unauthorized ownership correctly", async function () {
      const [, , , , , randomUser] = await ethers.getSigners();
      
      await expect(chainLend.connect(randomUser).withdrawCollateral(requestId))
        .to.be.revertedWithCustomError(chainLend, "Unauthorized");
    });
  });

  // ========== canWithdrawCollateral EDGE CASES ==========
  
  describe("canWithdrawCollateral Special Cases", function () {
    let chainLend, borrower;

    beforeEach(async function () {
      ({ chainLend, borrower } = await loadFixture(deployChainLendFixture));
    });

    it("Should return 'No collateral deposited' for cancelled request", async function () {
      const amount = ethers.parseUnits("1000", 6);
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amount);
      
      await chainLend.connect(borrower).createLoanRequest(
        amount,
        1000,
        30 * 24 * 60 * 60,
        { value: requiredCollateral }
      );
      
      // Cancel the request
      await chainLend.connect(borrower).cancelLoanRequest(1);
      
      const [canWithdraw, collateralAmount, reason] = await chainLend.canWithdrawCollateral(1);
      
      expect(canWithdraw).to.be.false;
      expect(collateralAmount).to.equal(0);
      expect(reason).to.equal("No collateral deposited");
    });

    it("Should return 'Loan must be repaid first' for active loan", async function () {
      const { lender } = await loadFixture(deployChainLendFixture);
      const amount = ethers.parseUnits("1000", 6);
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amount);
      
      await chainLend.connect(borrower).createLoanRequest(
        amount,
        1000,
        30 * 24 * 60 * 60,
        { value: requiredCollateral }
      );
      
      await chainLend.connect(lender).fundLoan(1);
      
      const [canWithdraw, collateralAmount, reason] = await chainLend.canWithdrawCollateral(1);
      
      expect(canWithdraw).to.be.false;
      expect(collateralAmount).to.equal(requiredCollateral);
      expect(reason).to.equal("Loan must be repaid first");
    });
  });
});