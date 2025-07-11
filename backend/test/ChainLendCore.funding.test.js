const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("ChainLendCore - Funding & Management", function () {
  // ========== FIXTURES ==========
  
  async function deployChainLendFixture() {
    const [owner, borrower, lender, liquidator, treasury] = await ethers.getSigners();

    // Deploy MockERC20 (USDC)
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdcToken = await MockERC20.deploy("USD Coin", "USDC", 6);

    // Deploy Mock Price Feeds
    const MockPriceFeed = await ethers.getContractFactory("MockChainlinkPriceFeed");
    const ethPriceFeed = await MockPriceFeed.deploy(2000e8, 8); // $2000 with 8 decimals
    const usdcPriceFeed = await MockPriceFeed.deploy(1e8, 8);   // $1 with 8 decimals

    // Deploy CLToken
    const CLToken = await ethers.getContractFactory("CLToken");
    const clToken = await CLToken.deploy(owner.address);

    // Deploy ChainLendCore
    const ChainLendCore = await ethers.getContractFactory("ChainLendCore");
    const chainLend = await ChainLendCore.deploy(
      await usdcToken.getAddress(),
      await ethPriceFeed.getAddress(),
      treasury.address,
      await usdcPriceFeed.getAddress(),
      await clToken.getAddress(),
      owner.address
    );

    // Setup CLToken minter
    await clToken.addMinter(await chainLend.getAddress());

    // Mint USDC to lender for testing
    await usdcToken.mint(lender.address, ethers.parseUnits("1000000", 6)); // 1M USDC
    await usdcToken.connect(lender).approve(await chainLend.getAddress(), ethers.MaxUint256);

    return {
      chainLend,
      usdcToken,
      clToken,
      ethPriceFeed,
      usdcPriceFeed,
      owner,
      borrower,
      lender,
      liquidator,
      treasury
    };
  }

  async function createLoanRequestFixture() {
    const contracts = await deployChainLendFixture();
    const { chainLend, borrower } = contracts;

    const amountRequested = ethers.parseUnits("1000", 6); // 1000 USDC
    const interestRate = 1000; // 10%
    const duration = 30 * 24 * 60 * 60; // 30 days
    const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);

    await chainLend.connect(borrower).createLoanRequest(
      amountRequested,
      interestRate,
      duration,
      { value: requiredCollateral }
    );

    return {
      ...contracts,
      amountRequested,
      interestRate,
      duration,
      requiredCollateral,
      requestId: 1
    };
  }

  async function createFundedLoanFixture() {
    const contracts = await createLoanRequestFixture();
    const { chainLend, lender, requestId } = contracts;

    await chainLend.connect(lender).fundLoan(requestId);

    return contracts;
  }

  // ========== LOAN FUNDING TESTS ==========
  
  describe("Loan Funding", function () {
    let chainLend, lender, borrower, usdcToken, requestId, amountRequested;

    beforeEach(async function () {
      ({ chainLend, lender, borrower, usdcToken, requestId, amountRequested } = await loadFixture(createLoanRequestFixture));
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
      const borrowerBalanceBefore = await usdcToken.balanceOf(borrower.address);

      await chainLend.connect(lender).fundLoan(requestId);

      const borrowerBalanceAfter = await usdcToken.balanceOf(borrower.address);
      expect(borrowerBalanceAfter - borrowerBalanceBefore).to.equal(amountRequested);
    });

    it("Should update request status to Funded", async function () {
      await chainLend.connect(lender).fundLoan(requestId);

      const request = await chainLend.getLoanRequest(requestId);
      expect(request.status).to.equal(1); // RequestStatus.Funded
    });

    it("Should decrement totalActiveRequests", async function () {
      await chainLend.connect(lender).fundLoan(requestId);

      expect(await chainLend.totalActiveRequests()).to.equal(0);
    });

    it("Should increment totalActiveLoans", async function () {
      await chainLend.connect(lender).fundLoan(requestId);

      expect(await chainLend.totalActiveLoans()).to.equal(1);
    });

    it("Should increment userLoanCount for lender", async function () {
      await chainLend.connect(lender).fundLoan(requestId);

      expect(await chainLend.userLoanCount(lender.address)).to.equal(1);
    });

    it("Should add loan to lender's loans array", async function () {
      await chainLend.connect(lender).fundLoan(requestId);

      const userLoans = await chainLend.getUserLoans(lender.address);
      expect(userLoans[0]).to.equal(requestId);
    });

    it("Should create active loan with correct requestId", async function () {
      await chainLend.connect(lender).fundLoan(requestId);

      const activeLoan = await chainLend.getActiveLoan(requestId);
      expect(activeLoan.requestId).to.equal(requestId);
    });

    it("Should create active loan with correct lender", async function () {
      await chainLend.connect(lender).fundLoan(requestId);

      const activeLoan = await chainLend.getActiveLoan(requestId);
      expect(activeLoan.lender).to.equal(lender.address);
    });

    it("Should create active loan with correct principal amount", async function () {
      await chainLend.connect(lender).fundLoan(requestId);

      const activeLoan = await chainLend.getActiveLoan(requestId);
      expect(activeLoan.principalAmount).to.equal(amountRequested);
    });

    it("Should create active loan with correct due date", async function () {
      const fundTx = await chainLend.connect(lender).fundLoan(requestId);
      const receipt = await fundTx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      const fundTimestamp = block.timestamp;
      
      const activeLoan = await chainLend.getActiveLoan(requestId);
      const expectedDueDate = fundTimestamp + (30 * 24 * 60 * 60);
      
      expect(activeLoan.dueDate).to.equal(expectedDueDate);
    });

    it("Should create active loan with correct total amount due", async function () {
      await chainLend.connect(lender).fundLoan(requestId);

      const activeLoan = await chainLend.getActiveLoan(requestId);
      // 1000 USDC + (1000 * 10% * 30/365) = 1000 + 8.22 = ~1008.22 USDC
      const expectedInterest = amountRequested * 1000n * 30n * 24n * 60n * 60n / (10000n * 365n * 24n * 60n * 60n);
      const expectedTotal = amountRequested + expectedInterest;
      
      expect(activeLoan.totalAmountDue).to.equal(expectedTotal);
    });

    it("Should set active loan status to Active", async function () {
      await chainLend.connect(lender).fundLoan(requestId);

      const activeLoan = await chainLend.getActiveLoan(requestId);
      expect(activeLoan.status).to.equal(0); // LoanStatus.Active
    });

    it("Should add CL rewards to lender's pending balance", async function () {
      await chainLend.connect(lender).fundLoan(requestId);

      expect(await chainLend.pendingCLRewards(lender.address)).to.equal(ethers.parseEther("50"));
    });
  });

  // ========== LOAN FUNDING VALIDATION TESTS ==========
  
  describe("Loan Funding Validation", function () {
    let chainLend, borrower, lender, requestId;

    beforeEach(async function () {
      ({ chainLend, borrower, lender, requestId } = await loadFixture(createLoanRequestFixture));
    });

    it("Should revert when funding own request", async function () {
      await expect(chainLend.connect(borrower).fundLoan(requestId))
        .to.be.revertedWithCustomError(chainLend, "InvalidRequest");
    });

    it("Should revert when request does not exist", async function () {
      await expect(chainLend.connect(lender).fundLoan(999))
        .to.be.revertedWithCustomError(chainLend, "InvalidRequest");
    });

    it("Should revert when request is already funded", async function () {
      await chainLend.connect(lender).fundLoan(requestId);

      await expect(chainLend.connect(lender).fundLoan(requestId))
        .to.be.revertedWithCustomError(chainLend, "InvalidRequestStatus");
    });

    it("Should revert when request is cancelled", async function () {
      await chainLend.connect(borrower).cancelLoanRequest(requestId);

      await expect(chainLend.connect(lender).fundLoan(requestId))
        .to.be.revertedWithCustomError(chainLend, "InvalidRequestStatus");
    });

    it("Should revert when lender has insufficient USDC balance", async function () {
      const { chainLend: newChainLend, usdcToken, owner, borrower } = await loadFixture(deployChainLendFixture);
      const poorLender = owner; // Using owner as poor lender (no USDC minted)

      // Create a loan request
      const amountRequested = ethers.parseUnits("1000", 6);
      const requiredCollateral = await newChainLend.calculateRequiredCollateral(amountRequested);
      
      await newChainLend.connect(borrower).createLoanRequest(
        amountRequested,
        1000,
        30 * 24 * 60 * 60,
        { value: requiredCollateral }
      );

      // Try to fund without USDC balance
      await expect(newChainLend.connect(poorLender).fundLoan(1))
        .to.be.reverted; // ERC20 will revert on insufficient balance
    });
  });

  // ========== COLLATERAL MANAGEMENT TESTS ==========
  
  describe("Collateral Management", function () {
    let chainLend, borrower, requestId;

    beforeEach(async function () {
      ({ chainLend, borrower, requestId } = await loadFixture(createFundedLoanFixture));
    });

    it("Should emit CollateralAdded event when adding collateral", async function () {
      const additionalCollateral = ethers.parseEther("0.1");
      
      await expect(
        chainLend.connect(borrower).addCollateral(requestId, { value: additionalCollateral })
      ).to.emit(chainLend, "CollateralAdded");
    });

    it("Should increase actual collateral deposited when adding", async function () {
      const additionalCollateral = ethers.parseEther("0.1");
      const requestBefore = await chainLend.getLoanRequest(requestId);
      
      await chainLend.connect(borrower).addCollateral(requestId, { value: additionalCollateral });
      
      const requestAfter = await chainLend.getLoanRequest(requestId);
      expect(requestAfter.actualCollateralDeposited - requestBefore.actualCollateralDeposited)
        .to.equal(additionalCollateral);
    });

    it("Should revert when adding zero collateral", async function () {
      await expect(
        chainLend.connect(borrower).addCollateral(requestId, { value: 0 })
      ).to.be.revertedWithCustomError(chainLend, "ZeroAmount");
    });

    it("Should revert when non-borrower tries to add collateral", async function () {
      const { lender } = await loadFixture(createFundedLoanFixture);
      
      await expect(
        chainLend.connect(lender).addCollateral(requestId, { value: ethers.parseEther("0.1") })
      ).to.be.revertedWithCustomError(chainLend, "Unauthorized");
    });

    it("Should revert when adding collateral to non-active loan", async function () {
      const { chainLend: newChainLend, borrower: newBorrower } = await loadFixture(createLoanRequestFixture);
      
      await expect(
        newChainLend.connect(newBorrower).addCollateral(1, { value: ethers.parseEther("0.1") })
      ).to.be.revertedWithCustomError(newChainLend, "InvalidLoan");
    });
  });

  // ========== EXCESS COLLATERAL WITHDRAWAL TESTS ==========
  
  describe("Excess Collateral Withdrawal", function () {
    let chainLend, borrower, requestId;

    beforeEach(async function () {
      ({ chainLend, borrower, requestId } = await loadFixture(createFundedLoanFixture));
      // Add excess collateral
      await chainLend.connect(borrower).addCollateral(requestId, { value: ethers.parseEther("0.5") });
    });

    it("Should emit ExcessCollateralWithdrawn event", async function () {
      const withdrawAmount = ethers.parseEther("0.1");
      
      await expect(
        chainLend.connect(borrower).withdrawExcessCollateral(requestId, withdrawAmount)
      ).to.emit(chainLend, "ExcessCollateralWithdrawn");
    });

    it("Should decrease actual collateral deposited", async function () {
      const withdrawAmount = ethers.parseEther("0.1");
      const requestBefore = await chainLend.getLoanRequest(requestId);
      
      await chainLend.connect(borrower).withdrawExcessCollateral(requestId, withdrawAmount);
      
      const requestAfter = await chainLend.getLoanRequest(requestId);
      expect(requestBefore.actualCollateralDeposited - requestAfter.actualCollateralDeposited)
        .to.equal(withdrawAmount);
    });

    it("Should transfer ETH to borrower", async function () {
      const withdrawAmount = ethers.parseEther("0.1");
      const balanceBefore = await ethers.provider.getBalance(borrower.address);
      
      const tx = await chainLend.connect(borrower).withdrawExcessCollateral(requestId, withdrawAmount);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      
      const balanceAfter = await ethers.provider.getBalance(borrower.address);
      expect(balanceAfter + gasUsed - balanceBefore).to.equal(withdrawAmount);
    });

    it("Should revert when withdrawing zero amount", async function () {
      await expect(
        chainLend.connect(borrower).withdrawExcessCollateral(requestId, 0)
      ).to.be.revertedWithCustomError(chainLend, "ZeroAmount");
    });

    it("Should revert when non-borrower tries to withdraw", async function () {
      const { lender } = await loadFixture(createFundedLoanFixture);
      
      await expect(
        chainLend.connect(lender).withdrawExcessCollateral(requestId, ethers.parseEther("0.1"))
      ).to.be.revertedWithCustomError(chainLend, "Unauthorized");
    });

    it("Should revert when withdrawing more than excess", async function () {
      const excessiveAmount = ethers.parseEther("1"); // More than available excess
      
      await expect(
        chainLend.connect(borrower).withdrawExcessCollateral(requestId, excessiveAmount)
      ).to.be.revertedWithCustomError(chainLend, "ExcessWithdrawalAmount");
    });

    it("Should revert when withdrawal would put ratio below minimum", async function () {
      // Try to withdraw amount that would bring ratio below 150%
      const request = await chainLend.getLoanRequest(requestId);
      const withdrawAmount = request.actualCollateralDeposited; // Withdraw everything
      
      await expect(
        chainLend.connect(borrower).withdrawExcessCollateral(requestId, withdrawAmount)
      ).to.be.revertedWithCustomError(chainLend, "ExcessWithdrawalAmount");
    });
  });

  // ========== LOAN CANCELLATION TESTS ==========
  
  describe("Loan Request Cancellation", function () {
    let chainLend, borrower, requestId, requiredCollateral;

    beforeEach(async function () {
      ({ chainLend, borrower, requestId, requiredCollateral } = await loadFixture(createLoanRequestFixture));
    });

    it("Should emit LoanRequestCancelled event", async function () {
      await expect(chainLend.connect(borrower).cancelLoanRequest(requestId))
        .to.emit(chainLend, "LoanRequestCancelled")
        .withArgs(requestId, borrower.address, requiredCollateral);
    });

    it("Should set request status to Cancelled", async function () {
      await chainLend.connect(borrower).cancelLoanRequest(requestId);

      const request = await chainLend.getLoanRequest(requestId);
      expect(request.status).to.equal(2); // RequestStatus.Cancelled
    });

    it("Should reset actual collateral deposited to zero", async function () {
      await chainLend.connect(borrower).cancelLoanRequest(requestId);

      const request = await chainLend.getLoanRequest(requestId);
      expect(request.actualCollateralDeposited).to.equal(0);
    });

    it("Should decrement totalActiveRequests", async function () {
      await chainLend.connect(borrower).cancelLoanRequest(requestId);

      expect(await chainLend.totalActiveRequests()).to.equal(0);
    });

    it("Should refund collateral to borrower", async function () {
      const balanceBefore = await ethers.provider.getBalance(borrower.address);
      
      const tx = await chainLend.connect(borrower).cancelLoanRequest(requestId);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      
      const balanceAfter = await ethers.provider.getBalance(borrower.address);
      expect(balanceAfter + gasUsed - balanceBefore).to.equal(requiredCollateral);
    });

    it("Should revert when non-borrower tries to cancel", async function () {
      const { lender } = await loadFixture(createLoanRequestFixture);
      
      await expect(chainLend.connect(lender).cancelLoanRequest(requestId))
        .to.be.revertedWithCustomError(chainLend, "Unauthorized");
    });

    it("Should revert when cancelling non-existent request", async function () {
      await expect(chainLend.connect(borrower).cancelLoanRequest(999))
        .to.be.revertedWithCustomError(chainLend, "InvalidRequest");
    });

    it("Should revert when cancelling already funded request", async function () {
      const { lender } = await loadFixture(createLoanRequestFixture);
      await chainLend.connect(lender).fundLoan(requestId);

      await expect(chainLend.connect(borrower).cancelLoanRequest(requestId))
        .to.be.revertedWithCustomError(chainLend, "InvalidRequestStatus");
    });

    it("Should revert when cancelling already cancelled request", async function () {
      await chainLend.connect(borrower).cancelLoanRequest(requestId);

      await expect(chainLend.connect(borrower).cancelLoanRequest(requestId))
        .to.be.revertedWithCustomError(chainLend, "InvalidRequestStatus");
    });
  });

  // ========== UTILITY FUNCTIONS ==========
  
  describe("Query Functions", function () {
    let chainLend, borrower, requestId;

    beforeEach(async function () {
      ({ chainLend, borrower, requestId } = await loadFixture(createFundedLoanFixture));
    });

    it("Should return correct health factor for active loan", async function () {
      // Add some extra collateral to ensure health factor > 150%
      await chainLend.connect(borrower).addCollateral(requestId, { 
        value: ethers.parseEther("0.1") 
      });
      
      const healthFactor = await chainLend.getHealthFactor(requestId);
      expect(healthFactor).to.be.gt(15000); // Should be > 150% (minimum ratio)
    });

    it("Should return correct excess collateral amount", async function () {
      // Add some excess collateral first
      await chainLend.connect(borrower).addCollateral(requestId, { 
        value: ethers.parseEther("0.5") 
      });
      
      const excessAmount = await chainLend.getExcessCollateral(requestId);
      expect(excessAmount).to.be.gt(0);
    });

    it("Should correctly identify non-risky loan", async function () {
      const [atRisk, currentRatio] = await chainLend.isAtRiskOfLiquidation(requestId);
      expect(atRisk).to.be.false;
      expect(currentRatio).to.be.gte(15000); // >= 150%
    });
  });
});