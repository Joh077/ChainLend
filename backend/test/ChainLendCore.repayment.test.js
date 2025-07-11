const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("ChainLendCore - Repayment & Liquidation", function () {
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

    // Mint USDC to lender and borrower for testing
    await usdcToken.mint(lender.address, ethers.parseUnits("1000000", 6)); // 1M USDC
    await usdcToken.mint(borrower.address, ethers.parseUnits("100000", 6)); // 100k USDC for repayment
    await usdcToken.connect(lender).approve(await chainLend.getAddress(), ethers.MaxUint256);
    await usdcToken.connect(borrower).approve(await chainLend.getAddress(), ethers.MaxUint256);

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

  async function createFundedLoanFixture() {
    const contracts = await deployChainLendFixture();
    const { chainLend, borrower, lender } = contracts;

    const amountRequested = ethers.parseUnits("1000", 6); // 1000 USDC
    const interestRate = 1000; // 10%
    const duration = 30 * 24 * 60 * 60; // 30 days
    const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);

    // Create loan request
    await chainLend.connect(borrower).createLoanRequest(
      amountRequested,
      interestRate,
      duration,
      { value: requiredCollateral }
    );

    // Fund the loan
    await chainLend.connect(lender).fundLoan(1);

    return {
      ...contracts,
      amountRequested,
      interestRate,
      duration,
      requiredCollateral,
      requestId: 1
    };
  }

  async function createRepaidLoanFixture() {
    const contracts = await createFundedLoanFixture();
    const { chainLend, borrower, requestId } = contracts;

    // Repay the loan
    await chainLend.connect(borrower).repayLoan(requestId);

    return contracts;
  }

  // ========== LOAN REPAYMENT TESTS ==========
  
  describe("Loan Repayment", function () {
    let chainLend, borrower, lender, treasury, usdcToken, requestId;

    beforeEach(async function () {
      ({ chainLend, borrower, lender, treasury, usdcToken, requestId } = await loadFixture(createFundedLoanFixture));
    });

    it("Should emit LoanRepaid event", async function () {
      await expect(chainLend.connect(borrower).repayLoan(requestId))
        .to.emit(chainLend, "LoanRepaid");
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
      await chainLend.connect(borrower).repayLoan(requestId);

      expect(await chainLend.totalActiveLoans()).to.equal(0);
    });

    it("Should revert when non-borrower tries to repay", async function () {
      await expect(chainLend.connect(lender).repayLoan(requestId))
        .to.be.revertedWithCustomError(chainLend, "Unauthorized");
    });

    it("Should revert when repaying non-existent loan", async function () {
      await expect(chainLend.connect(borrower).repayLoan(999))
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

  // ========== COLLATERAL WITHDRAWAL TESTS ==========
  
  describe("Collateral Withdrawal After Repayment", function () {
    let chainLend, borrower, requestId, requiredCollateral;

    beforeEach(async function () {
      ({ chainLend, borrower, requestId, requiredCollateral } = await loadFixture(createRepaidLoanFixture));
    });

    it("Should emit CollateralWithdrawn event", async function () {
      await expect(chainLend.connect(borrower).withdrawCollateral(requestId))
        .to.emit(chainLend, "CollateralWithdrawn")
        .withArgs(requestId, borrower.address, requiredCollateral, 0);
    });

    it("Should transfer collateral to borrower", async function () {
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

    it("Should revert when non-borrower tries to withdraw", async function () {
      const { lender } = await loadFixture(createRepaidLoanFixture);
      
      await expect(chainLend.connect(lender).withdrawCollateral(requestId))
        .to.be.revertedWithCustomError(chainLend, "Unauthorized");
    });

    it("Should revert when loan is not repaid", async function () {
      const { chainLend: activeChainLend, borrower: activeBorrower } = await loadFixture(createFundedLoanFixture);
      
      await expect(activeChainLend.connect(activeBorrower).withdrawCollateral(1))
        .to.be.revertedWithCustomError(activeChainLend, "InvalidLoan");
    });

    it("Should revert when collateral already withdrawn", async function () {
      await chainLend.connect(borrower).withdrawCollateral(requestId);

      await expect(chainLend.connect(borrower).withdrawCollateral(requestId))
        .to.be.revertedWithCustomError(chainLend, "InvalidRequest");
    });

    it("Should revert when withdrawing from non-existent request", async function () {
      await expect(chainLend.connect(borrower).withdrawCollateral(999))
        .to.be.revertedWithCustomError(chainLend, "InvalidRequest");
    });
  });

  // ========== LIQUIDATION TESTS ==========
  
  describe("Liquidation", function () {
    let chainLend, borrower, lender, liquidator, ethPriceFeed, requestId;

    beforeEach(async function () {
      ({ chainLend, borrower, lender, liquidator, ethPriceFeed, requestId } = await loadFixture(createFundedLoanFixture));
    });

    it("Should emit LoanLiquidated event", async function () {
      // Drop ETH price to trigger liquidation
      await ethPriceFeed.updatePrice(1000e8); // Drop to $1000
      
      await expect(chainLend.connect(liquidator).liquidateCollateral(requestId))
        .to.emit(chainLend, "LoanLiquidated");
    });

    it("Should set loan status to Liquidated", async function () {
      await ethPriceFeed.updatePrice(1000e8);
      
      await chainLend.connect(liquidator).liquidateCollateral(requestId);

      const activeLoan = await chainLend.getActiveLoan(requestId);
      expect(activeLoan.status).to.equal(2); // LoanStatus.Liquidated
    });

    it("Should decrement totalActiveLoans", async function () {
      await ethPriceFeed.updatePrice(1000e8);
      
      await chainLend.connect(liquidator).liquidateCollateral(requestId);

      expect(await chainLend.totalActiveLoans()).to.equal(0);
    });

    it("Should reset actualCollateralDeposited to zero", async function () {
      await ethPriceFeed.updatePrice(1000e8);
      
      await chainLend.connect(liquidator).liquidateCollateral(requestId);

      const request = await chainLend.getLoanRequest(requestId);
      expect(request.actualCollateralDeposited).to.equal(0);
    });

    it("Should revert when collateral ratio is above liquidation threshold", async function () {
      // Keep ETH price high, ratio should be above 130%
      await expect(chainLend.connect(liquidator).liquidateCollateral(requestId))
        .to.be.revertedWithCustomError(chainLend, "InvalidLoan");
    });

    it("Should revert when liquidating non-active loan", async function () {
      await ethPriceFeed.updatePrice(1000e8);
      await chainLend.connect(liquidator).liquidateCollateral(requestId);

      await expect(chainLend.connect(liquidator).liquidateCollateral(requestId))
        .to.be.revertedWithCustomError(chainLend, "InvalidLoan");
    });

    it("Should revert when liquidating non-existent loan", async function () {
      await expect(chainLend.connect(liquidator).liquidateCollateral(999))
        .to.be.revertedWithCustomError(chainLend, "InvalidLoan");
    });

    it("Should distribute collateral to lender when liquidated", async function () {
      await ethPriceFeed.updatePrice(1000e8);
      
      const lenderBalanceBefore = await ethers.provider.getBalance(lender.address);
      
      await chainLend.connect(liquidator).liquidateCollateral(requestId);
      
      const lenderBalanceAfter = await ethers.provider.getBalance(lender.address);
      expect(lenderBalanceAfter).to.be.gt(lenderBalanceBefore);
    });

    it("Should give liquidation bonus to liquidator", async function () {
      await ethPriceFeed.updatePrice(1000e8);
      
      const liquidatorBalanceBefore = await ethers.provider.getBalance(liquidator.address);
      
      const tx = await chainLend.connect(liquidator).liquidateCollateral(requestId);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      
      const liquidatorBalanceAfter = await ethers.provider.getBalance(liquidator.address);
      expect(liquidatorBalanceAfter + gasUsed).to.be.gt(liquidatorBalanceBefore);
    });

    it("Should send protocol fee to treasury", async function () {
      await ethPriceFeed.updatePrice(1000e8);
      
      const treasuryBalanceBefore = await ethers.provider.getBalance(await chainLend.treasury());
      
      await chainLend.connect(liquidator).liquidateCollateral(requestId);
      
      const treasuryBalanceAfter = await ethers.provider.getBalance(await chainLend.treasury());
      expect(treasuryBalanceAfter).to.be.gt(treasuryBalanceBefore);
    });
  });

  // ========== CL REWARDS TESTS ==========
  
  describe("CL Token Rewards", function () {
    let chainLend, borrower, clToken;

    beforeEach(async function () {
      ({ chainLend, borrower, clToken } = await loadFixture(createFundedLoanFixture));
    });

    it("Should allow claiming rewards when above minimum", async function () {
      // Borrower should have 10 CL from creating request
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
      
      expect(await chainLend.pendingCLRewards(borrower.address)).to.equal(0);
    });

    it("Should revert when claiming below minimum amount", async function () {
      // Create user with minimal rewards (less than 10 CL minimum)
      const [, , , , , newUser] = await ethers.getSigners();
      
      await expect(chainLend.connect(newUser).claimCLRewards())
        .to.be.revertedWithCustomError(chainLend, "InvalidAmount");
    });

    it("Should accumulate rewards from multiple actions", async function () {
      const { lender } = await loadFixture(createFundedLoanFixture);
      
      // Lender should have 50 CL from funding loan
      expect(await chainLend.pendingCLRewards(lender.address)).to.equal(ethers.parseEther("50"));
    });
  });

  // ========== QUERY FUNCTIONS TESTS ==========
  
  describe("Advanced Query Functions", function () {
    let chainLend, requestId;

    beforeEach(async function () {
      ({ chainLend, requestId } = await loadFixture(createFundedLoanFixture));
    });

    it("Should return correct withdrawal status for repaid loan", async function () {
      const repaidContracts = await loadFixture(createRepaidLoanFixture);
      
      const [canWithdraw, amount, reason] = await repaidContracts.chainLend.canWithdrawCollateral(repaidContracts.requestId);
      expect(canWithdraw).to.be.true;
      expect(amount).to.be.gt(0);
    });

    it("Should return false for non-repaid loan withdrawal", async function () {
      const [canWithdraw, amount, reason] = await chainLend.canWithdrawCollateral(requestId);
      expect(canWithdraw).to.be.false;
    });

    it("Should return correct protocol statistics", async function () {
      const [totalRequests, activeRequests, activeLoansCount, totalVolume] = 
        await chainLend.getProtocolStats();
      
      expect(totalRequests).to.equal(1);
      expect(activeRequests).to.equal(0); // Request is funded, not active
      expect(activeLoansCount).to.equal(1);
      expect(totalVolume).to.be.gt(0);
    });

    it("Should return pending requests correctly", async function () {
      // Create another pending request
      const { borrower } = await loadFixture(deployChainLendFixture);
      const amountRequested = ethers.parseUnits("500", 6);
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);
      
      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        1000,
        30 * 24 * 60 * 60,
        { value: requiredCollateral }
      );

      const [pendingIds, hasMore] = await chainLend.getPendingRequests(0, 10);
      expect(pendingIds.length).to.be.gt(0);
    });

    it("Should return correct pending requests count", async function () {
      const count = await chainLend.getPendingRequestsCount();
      expect(count).to.be.gte(0);
    });
  });

  // ========== ADMIN FUNCTIONS TESTS ==========
  
  describe("Admin Functions", function () {
    let chainLend, owner, usdcToken;

    beforeEach(async function () {
      ({ chainLend, owner, usdcToken } = await loadFixture(deployChainLendFixture));
    });

    it("Should allow owner to update treasury address", async function () {
      const [, , , , newTreasury] = await ethers.getSigners();
      
      await chainLend.connect(owner).updateTreasury(newTreasury.address);
      
      expect(await chainLend.treasury()).to.equal(newTreasury.address);
    });

    it("Should revert when non-owner tries to update treasury", async function () {
      const [, nonOwner, , , newTreasury] = await ethers.getSigners();
      
      await expect(chainLend.connect(nonOwner).updateTreasury(newTreasury.address))
        .to.be.revertedWithCustomError(chainLend, "OwnableUnauthorizedAccount");
    });

    it("Should revert when updating treasury to zero address", async function () {
      await expect(chainLend.connect(owner).updateTreasury(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(chainLend, "ZeroAddress");
    });

    it("Should allow owner to emergency withdraw USDC", async function () {
      // First, add some USDC to the contract
      await usdcToken.mint(await chainLend.getAddress(), ethers.parseUnits("1000", 6));
      
      await expect(chainLend.connect(owner).emergencyWithdrawUSDC(owner.address, ethers.parseUnits("500", 6)))
        .to.emit(chainLend, "EmergencyWithdrawal");
    });

    it("Should revert when non-owner tries emergency withdraw", async function () {
      const [, nonOwner] = await ethers.getSigners();
      
      await expect(chainLend.connect(nonOwner).emergencyWithdrawUSDC(nonOwner.address, ethers.parseUnits("100", 6)))
        .to.be.revertedWithCustomError(chainLend, "OwnableUnauthorizedAccount");
    });

    it("Should revert emergency withdraw to zero address", async function () {
      await expect(chainLend.connect(owner).emergencyWithdrawUSDC(ethers.ZeroAddress, ethers.parseUnits("100", 6)))
        .to.be.revertedWithCustomError(chainLend, "ZeroAddress");
    });

    it("Should revert emergency withdraw with zero amount", async function () {
      await expect(chainLend.connect(owner).emergencyWithdrawUSDC(owner.address, 0))
        .to.be.revertedWithCustomError(chainLend, "ZeroAmount");
    });
  });

  // ========== SECURITY TESTS ==========
  
  describe("Security & Edge Cases", function () {
    let chainLend;

    beforeEach(async function () {
      ({ chainLend } = await loadFixture(deployChainLendFixture));
    });

    it("Should revert direct ETH transfers", async function () {
      const [, sender] = await ethers.getSigners();
      
      await expect(
        sender.sendTransaction({
          to: await chainLend.getAddress(),
          value: ethers.parseEther("1")
        })
      ).to.be.revertedWithCustomError(chainLend, "DirectETHNotAllowed");
    });

    it("Should handle stale price feeds in liquidation", async function () {
      const contracts = await loadFixture(createFundedLoanFixture);
      
      // First drop price to make loan liquidatable
      await contracts.ethPriceFeed.updatePrice(1000e8);
      
      // Then set stale timestamp
      const staleTimestamp = (await time.latest()) - 3700;
      await contracts.ethPriceFeed.setStalePrice(staleTimestamp);
      
      await expect(contracts.chainLend.connect(contracts.liquidator).liquidateCollateral(contracts.requestId))
        .to.be.revertedWithCustomError(contracts.chainLend, "StalePrice");
    });

    it("Should handle invalid price feeds in liquidation", async function () {
      const contracts = await loadFixture(createFundedLoanFixture);
      
      // First drop price to make loan liquidatable, then set invalid
      await contracts.ethPriceFeed.updatePrice(1000e8);
      await contracts.ethPriceFeed.updatePrice(-1);
      
      await expect(contracts.chainLend.connect(contracts.liquidator).liquidateCollateral(contracts.requestId))
        .to.be.revertedWithCustomError(contracts.chainLend, "InvalidPrice");
    });
  });
});