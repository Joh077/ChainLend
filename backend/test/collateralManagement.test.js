const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

const { deployChainLendFixture, createActiveLoanWithExcessCollateralFixture } = require("./fixtures");

describe("Collateral Management", function () {
  
  // COLLATERAL ADDITION TEST
  
  describe("Collateral Management", function () {
    let chainLend, borrower, lender, requestId;

    beforeEach(async function () {
      ({ chainLend, borrower, lender, requestId } = await loadFixture(createActiveLoanWithExcessCollateralFixture));
    });

    it("Should allow borrower to add collateral to active loan", async function () {
      const additionalCollateral = ethers.parseEther("0.5");
      
      await expect(chainLend.connect(borrower).addCollateral(requestId, { value: additionalCollateral }))
        .to.not.be.reverted;
    });

    it("Should emit CollateralAdded event", async function () {
      const additionalCollateral = ethers.parseEther("0.5");
      const requestBefore = await chainLend.getLoanRequest(requestId);
      const expectedNewTotal = requestBefore.actualCollateralDeposited + additionalCollateral;
      
      await expect(chainLend.connect(borrower).addCollateral(requestId, { value: additionalCollateral }))
        .to.emit(chainLend, "CollateralAdded")
    });

    it("Should update actualCollateralDeposited correctly", async function () {
      const additionalCollateral = ethers.parseEther("0.5");
      const requestBefore = await chainLend.getLoanRequest(requestId);
      
      await chainLend.connect(borrower).addCollateral(requestId, { value: additionalCollateral });
      
      const requestAfter = await chainLend.getLoanRequest(requestId);
      expect(requestAfter.actualCollateralDeposited).to.equal(
        requestBefore.actualCollateralDeposited + additionalCollateral
      );
    });

    it("Should improve health factor after adding collateral", async function () {
      const healthFactorBefore = await chainLend.getHealthFactor(requestId);
      const additionalCollateral = ethers.parseEther("1");
      
      await chainLend.connect(borrower).addCollateral(requestId, { value: additionalCollateral });
      
      const healthFactorAfter = await chainLend.getHealthFactor(requestId);
      expect(healthFactorAfter).to.be.gt(healthFactorBefore);
    });

    it("Should revert when non-borrower tries to add collateral", async function () {
      const additionalCollateral = ethers.parseEther("0.5");
      
      await expect(chainLend.connect(lender).addCollateral(requestId, { value: additionalCollateral }))
        .to.be.revertedWithCustomError(chainLend, "Unauthorized");
    });

    it("Should revert when adding zero collateral", async function () {
      await expect(chainLend.connect(borrower).addCollateral(requestId, { value: 0 }))
        .to.be.revertedWithCustomError(chainLend, "ZeroAmount");
    });

    it("Should revert when adding collateral to non-existent loan", async function () {
      const additionalCollateral = ethers.parseEther("0.5");
      
      await expect(chainLend.connect(borrower).addCollateral(999, { value: additionalCollateral }))
        .to.be.revertedWithCustomError(chainLend, "InvalidLoan");
    });

    it("Should allow multiple collateral additions", async function () {
      const addition1 = ethers.parseEther("0.3");
      const addition2 = ethers.parseEther("0.7");
      const requestBefore = await chainLend.getLoanRequest(requestId);
      
      await chainLend.connect(borrower).addCollateral(requestId, { value: addition1 });
      await chainLend.connect(borrower).addCollateral(requestId, { value: addition2 });
      
      const requestAfter = await chainLend.getLoanRequest(requestId);
      expect(requestAfter.actualCollateralDeposited).to.equal(
        requestBefore.actualCollateralDeposited + addition1 + addition2
      );
    });
  });

  // EXCESS COLLATERAL WITHDRAWAL TESTS 
  
  describe("Excess Collateral Withdrawal", function () {
    let chainLend, borrower, lender, requestId, requiredCollateral;

    beforeEach(async function () {
      ({ chainLend, borrower, lender, requestId, requiredCollateral } = await loadFixture(createActiveLoanWithExcessCollateralFixture));
    });

    it("Should allow borrower to withdraw excess collateral", async function () {
      const withdrawAmount = ethers.parseEther("0.5");
      
      await expect(chainLend.connect(borrower).withdrawExcessCollateral(requestId, withdrawAmount))
        .to.not.be.reverted;
    });

    it("Should emit ExcessCollateralWithdrawn event", async function () {
      const withdrawAmount = ethers.parseEther("0.5");
      const requestBefore = await chainLend.getLoanRequest(requestId);
      const expectedNewTotal = requestBefore.actualCollateralDeposited - withdrawAmount;
      
      await expect(chainLend.connect(borrower).withdrawExcessCollateral(requestId, withdrawAmount))
        .to.emit(chainLend, "ExcessCollateralWithdrawn");
    });

    it("Should transfer ETH to borrower", async function () {
      const withdrawAmount = ethers.parseEther("0.5");
      const balanceBefore = await ethers.provider.getBalance(borrower.address);
      
      const tx = await chainLend.connect(borrower).withdrawExcessCollateral(requestId, withdrawAmount);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      
      const balanceAfter = await ethers.provider.getBalance(borrower.address);
      expect(balanceAfter + gasUsed - balanceBefore).to.equal(withdrawAmount);
    });

    it("Should update actualCollateralDeposited correctly", async function () {
      const withdrawAmount = ethers.parseEther("0.5");
      const requestBefore = await chainLend.getLoanRequest(requestId);
      
      await chainLend.connect(borrower).withdrawExcessCollateral(requestId, withdrawAmount);
      
      const requestAfter = await chainLend.getLoanRequest(requestId);
      expect(requestAfter.actualCollateralDeposited).to.equal(
        requestBefore.actualCollateralDeposited - withdrawAmount
      );
    });

    it("Should calculate excess correctly", async function () {
      const excessAmount = await chainLend.getExcessCollateral(requestId);
      expect(excessAmount).to.be.gt(0);
      
      // Should be able to withdraw the calculated excess
      await expect(chainLend.connect(borrower).withdrawExcessCollateral(requestId, excessAmount))
        .to.not.be.reverted;
    });

    it("Should revert when non-borrower tries to withdraw", async function () {
      const withdrawAmount = ethers.parseEther("0.5");
      
      await expect(chainLend.connect(lender).withdrawExcessCollateral(requestId, withdrawAmount))
        .to.be.revertedWithCustomError(chainLend, "Unauthorized");
    });

    it("Should revert when withdrawing zero amount", async function () {
      await expect(chainLend.connect(borrower).withdrawExcessCollateral(requestId, 0))
        .to.be.revertedWithCustomError(chainLend, "ZeroAmount");
    });

    it("Should revert when withdraw more than excess", async function () {
      const excessAmount = await chainLend.getExcessCollateral(requestId);
      const excessiveAmount = excessAmount + ethers.parseEther("1");
      
      await expect(chainLend.connect(borrower).withdrawExcessCollateral(requestId, excessiveAmount))
        .to.be.revertedWithCustomError(chainLend, "ExcessWithdrawalAmount");
    });

    it("Should revert when no excess collateral exists", async function () {
      // First withdraw all excess
      const excessAmount = await chainLend.getExcessCollateral(requestId);
      await chainLend.connect(borrower).withdrawExcessCollateral(requestId, excessAmount);
      
      // Try to withdraw more
      await expect(chainLend.connect(borrower).withdrawExcessCollateral(requestId, ethers.parseEther("0.1")))
        .to.be.revertedWithCustomError(chainLend, "ExcessWithdrawalAmount");
    });

    it("Should maintain collateral ratio above minimum after withdrawal", async function () {
      const withdrawAmount = ethers.parseEther("0.3");
      
      await chainLend.connect(borrower).withdrawExcessCollateral(requestId, withdrawAmount);
      
      const healthFactor = await chainLend.getHealthFactor(requestId);
      const minRatio = await chainLend.MIN_COLLATERAL_RATIO();
      expect(healthFactor).to.be.gte(minRatio);
    });

  });
});