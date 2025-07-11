const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("ChainLendCore", function () {
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

  // ========== DEPLOYMENT TESTS ==========
  
  describe("Deployment", function () {
    let chainLend, usdcToken, clToken, ethPriceFeed, usdcPriceFeed, treasury;

    beforeEach(async function () {
      ({ chainLend, usdcToken, clToken, ethPriceFeed, usdcPriceFeed, treasury } = await loadFixture(deployChainLendFixture));
    });

    it("Should set correct USDC token address", async function () {
      expect(await chainLend.usdcToken()).to.equal(await usdcToken.getAddress());
    });

    it("Should set correct ETH price feed address", async function () {
      expect(await chainLend.ethPriceFeed()).to.equal(await ethPriceFeed.getAddress());
    });

    it("Should set correct USDC price feed address", async function () {
      expect(await chainLend.usdcPriceFeed()).to.equal(await usdcPriceFeed.getAddress());
    });

    it("Should set correct CL token address", async function () {
      expect(await chainLend.clToken()).to.equal(await clToken.getAddress());
    });

    it("Should set correct treasury address", async function () {
      expect(await chainLend.treasury()).to.equal(treasury.address);
    });
  });

  // ========== CONSTANTS TESTS ==========
  
  describe("Constants", function () {
    let chainLend;

    beforeEach(async function () {
      ({ chainLend } = await loadFixture(deployChainLendFixture));
    });

    it("Should have correct BASIS_POINTS value", async function () {
      expect(await chainLend.BASIS_POINTS()).to.equal(10000);
    });

    it("Should have correct MIN_COLLATERAL_RATIO value", async function () {
      expect(await chainLend.MIN_COLLATERAL_RATIO()).to.equal(15000);
    });

    it("Should have correct LIQUIDATION_THRESHOLD value", async function () {
      expect(await chainLend.LIQUIDATION_THRESHOLD()).to.equal(13000);
    });

    it("Should have correct PROTOCOL_FEE value", async function () {
      expect(await chainLend.PROTOCOL_FEE()).to.equal(1000);
    });

    it("Should have correct MIN_INTEREST_RATE value", async function () {
      expect(await chainLend.MIN_INTEREST_RATE()).to.equal(500);
    });

    it("Should have correct MAX_INTEREST_RATE value", async function () {
      expect(await chainLend.MAX_INTEREST_RATE()).to.equal(1500);
    });

    it("Should have correct MIN_LOAN_DURATION value", async function () {
      expect(await chainLend.MIN_LOAN_DURATION()).to.equal(30 * 24 * 60 * 60);
    });

    it("Should have correct MAX_LOAN_DURATION value", async function () {
      expect(await chainLend.MAX_LOAN_DURATION()).to.equal(1095 * 24 * 60 * 60);
    });

    it("Should have correct MAX_LOAN_AMOUNT value", async function () {
      expect(await chainLend.MAX_LOAN_AMOUNT()).to.equal(ethers.parseUnits("500000", 6));
    });
  });

  // ========== INITIAL STATE TESTS ==========
  
  describe("Initial State", function () {
    let chainLend;

    beforeEach(async function () {
      ({ chainLend } = await loadFixture(deployChainLendFixture));
    });

    it("Should initialize nextRequestId to 1", async function () {
      expect(await chainLend.nextRequestId()).to.equal(1);
    });

    it("Should initialize totalActiveRequests to 0", async function () {
      expect(await chainLend.totalActiveRequests()).to.equal(0);
    });

    it("Should initialize totalActiveLoans to 0", async function () {
      expect(await chainLend.totalActiveLoans()).to.equal(0);
    });
  });

  // ========== COLLATERAL CALCULATION TESTS ==========
  
  describe("Collateral Calculation", function () {
    let chainLend;

    beforeEach(async function () {
      ({ chainLend } = await loadFixture(deployChainLendFixture));
    });

    it("Should calculate correct collateral for standard loan amount", async function () {
      const loanAmount = ethers.parseUnits("1000", 6); // 1000 USDC
      const requiredCollateral = await chainLend.calculateRequiredCollateral(loanAmount);
      
      // With ETH at $2000 and 150% ratio: 1000 * 1.5 / 2000 = 0.75 ETH
      const expectedCollateral = ethers.parseEther("0.75");
      expect(requiredCollateral).to.equal(expectedCollateral);
    });

    it("Should revert when loan amount is zero", async function () {
      await expect(chainLend.calculateRequiredCollateral(0))
        .to.be.revertedWithCustomError(chainLend, "ZeroAmount");
    });

    it("Should revert when loan amount exceeds maximum", async function () {
      const maxAmount = ethers.parseUnits("500000", 6);
      const overMaxAmount = maxAmount + 1n;
      
      await expect(chainLend.calculateRequiredCollateral(overMaxAmount))
        .to.be.revertedWithCustomError(chainLend, "InvalidAmount");
    });

    it("Should handle updated ETH price correctly", async function () {
      const { ethPriceFeed } = await loadFixture(deployChainLendFixture);
      
      const loanAmount = ethers.parseUnits("1000", 6);
      
      await ethPriceFeed.updatePrice(3000e8); // Update to $3000
      const newRequiredCollateral = await chainLend.calculateRequiredCollateral(loanAmount);
      
      // With ETH at $3000: 1500 USD / 3000 USD per ETH = 0.5 ETH
      const expectedCollateral = ethers.parseEther("0.5");
      expect(newRequiredCollateral).to.equal(expectedCollateral);
    });

    it("Should revert with stale ETH price", async function () {
      const { ethPriceFeed } = await loadFixture(deployChainLendFixture);
      
      const staleTimestamp = (await time.latest()) - 86400 ; // Older than 86400 threshold
      await ethPriceFeed.setStalePrice(staleTimestamp);
      
      await expect(chainLend.calculateRequiredCollateral(ethers.parseUnits("1000", 6)))
        .to.be.revertedWithCustomError(chainLend, "StalePrice");
    });

    it("Should revert with stale USDC price", async function () {
      const { usdcPriceFeed } = await loadFixture(deployChainLendFixture);
      
      const staleTimestamp = (await time.latest()) - 3700;
      await usdcPriceFeed.setStalePrice(staleTimestamp);
      
      await expect(chainLend.calculateRequiredCollateral(ethers.parseUnits("1000", 6)))
        .to.be.revertedWithCustomError(chainLend, "StalePrice");
    });

    it("Should revert with negative ETH price", async function () {
      const { ethPriceFeed } = await loadFixture(deployChainLendFixture);
      
      await ethPriceFeed.updatePrice(-1);
      
      await expect(chainLend.calculateRequiredCollateral(ethers.parseUnits("1000", 6)))
        .to.be.revertedWithCustomError(chainLend, "InvalidPrice");
    });

    it("Should revert with zero ETH price", async function () {
      const { ethPriceFeed } = await loadFixture(deployChainLendFixture);
      
      await ethPriceFeed.updatePrice(0);
      
      await expect(chainLend.calculateRequiredCollateral(ethers.parseUnits("1000", 6)))
        .to.be.revertedWithCustomError(chainLend, "InvalidPrice");
    });

    it("Should revert with negative USDC price", async function () {
      const { usdcPriceFeed } = await loadFixture(deployChainLendFixture);
      
      await usdcPriceFeed.updatePrice(-1);
      
      await expect(chainLend.calculateRequiredCollateral(ethers.parseUnits("1000", 6)))
        .to.be.revertedWithCustomError(chainLend, "InvalidPrice");
    });

    it("Should revert with zero USDC price", async function () {
      const { usdcPriceFeed } = await loadFixture(deployChainLendFixture);
      
      await usdcPriceFeed.updatePrice(0);
      
      await expect(chainLend.calculateRequiredCollateral(ethers.parseUnits("1000", 6)))
        .to.be.revertedWithCustomError(chainLend, "InvalidPrice");
    });
  });

  // ========== LOAN REQUEST CREATION TESTS ==========
  
  describe("Loan Request Creation", function () {
    let chainLend, borrower;
    let amountRequested, interestRate, duration, requiredCollateral;

    beforeEach(async function () {
      ({ chainLend, borrower } = await loadFixture(deployChainLendFixture));
      
      amountRequested = ethers.parseUnits("1000", 6); // 1000 USDC
      interestRate = 1000; // 10%
      duration = 30 * 24 * 60 * 60; // 30 days
      requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);
    });

    it("Should emit LoanRequestCreated event", async function () {
      await expect(
        chainLend.connect(borrower).createLoanRequest(
          amountRequested,
          interestRate,
          duration,
          { value: requiredCollateral }
        )
      ).to.emit(chainLend, "LoanRequestCreated")
        .withArgs(1, borrower.address, amountRequested, requiredCollateral, interestRate, duration);
    });

    it("Should emit CollateralDeposited event", async function () {
      await expect(
        chainLend.connect(borrower).createLoanRequest(
          amountRequested,
          interestRate,
          duration,
          { value: requiredCollateral }
        )
      ).to.emit(chainLend, "CollateralDeposited")
        .withArgs(1, borrower.address, requiredCollateral, requiredCollateral);
    });

    it("Should emit CLRewardsEarned event", async function () {
      await expect(
        chainLend.connect(borrower).createLoanRequest(
          amountRequested,
          interestRate,
          duration,
          { value: requiredCollateral }
        )
      ).to.emit(chainLend, "CLRewardsEarned")
        .withArgs(borrower.address, ethers.parseEther("10"), "Create Request");
    });

    it("Should increment nextRequestId", async function () {
      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        interestRate,
        duration,
        { value: requiredCollateral }
      );

      expect(await chainLend.nextRequestId()).to.equal(2);
    });

    it("Should increment totalActiveRequests", async function () {
      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        interestRate,
        duration,
        { value: requiredCollateral }
      );

      expect(await chainLend.totalActiveRequests()).to.equal(1);
    });

    it("Should increment userRequestCount", async function () {
      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        interestRate,
        duration,
        { value: requiredCollateral }
      );

      expect(await chainLend.userRequestCount(borrower.address)).to.equal(1);
    });

    it("Should store request ID in userRequests array", async function () {
      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        interestRate,
        duration,
        { value: requiredCollateral }
      );

      const userRequests = await chainLend.getUserRequests(borrower.address);
      expect(userRequests[0]).to.equal(1);
    });

    it("Should store correct request ID", async function () {
      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        interestRate,
        duration,
        { value: requiredCollateral }
      );

      const request = await chainLend.getLoanRequest(1);
      expect(request.id).to.equal(1);
    });

    it("Should store correct borrower address", async function () {
      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        interestRate,
        duration,
        { value: requiredCollateral }
      );

      const request = await chainLend.getLoanRequest(1);
      expect(request.borrower).to.equal(borrower.address);
    });

    it("Should store correct amount requested", async function () {
      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        interestRate,
        duration,
        { value: requiredCollateral }
      );

      const request = await chainLend.getLoanRequest(1);
      expect(request.amountRequested).to.equal(amountRequested);
    });

    it("Should store correct required collateral", async function () {
      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        interestRate,
        duration,
        { value: requiredCollateral }
      );

      const request = await chainLend.getLoanRequest(1);
      expect(request.requiredCollateral).to.equal(requiredCollateral);
    });

    it("Should store correct actual collateral deposited", async function () {
      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        interestRate,
        duration,
        { value: requiredCollateral }
      );

      const request = await chainLend.getLoanRequest(1);
      expect(request.actualCollateralDeposited).to.equal(requiredCollateral);
    });

    it("Should store correct interest rate", async function () {
      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        interestRate,
        duration,
        { value: requiredCollateral }
      );

      const request = await chainLend.getLoanRequest(1);
      expect(request.interestRate).to.equal(interestRate);
    });

    it("Should store correct duration", async function () {
      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        interestRate,
        duration,
        { value: requiredCollateral }
      );

      const request = await chainLend.getLoanRequest(1);
      expect(request.duration).to.equal(duration);
    });

    it("Should set status to Pending", async function () {
      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        interestRate,
        duration,
        { value: requiredCollateral }
      );

      const request = await chainLend.getLoanRequest(1);
      expect(request.status).to.equal(0); // RequestStatus.Pending
    });

    it("Should accept excess collateral", async function () {
      const excessCollateral = requiredCollateral + ethers.parseEther("0.1");
      
      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        interestRate,
        duration,
        { value: excessCollateral }
      );

      const request = await chainLend.getLoanRequest(1);
      expect(request.actualCollateralDeposited).to.equal(excessCollateral);
    });

    it("Should add CL rewards to pending balance", async function () {
      await chainLend.connect(borrower).createLoanRequest(
        amountRequested,
        interestRate,
        duration,
        { value: requiredCollateral }
      );

      expect(await chainLend.pendingCLRewards(borrower.address)).to.equal(ethers.parseEther("10"));
    });
  });

  // ========== LOAN REQUEST VALIDATION TESTS ==========
  
  describe("Loan Request Validation", function () {
    let chainLend, borrower;
    let interestRate, duration, requiredCollateral;

    beforeEach(async function () {
      ({ chainLend, borrower } = await loadFixture(deployChainLendFixture));
      
      interestRate = 1000; // 10%
      duration = 30 * 24 * 60 * 60; // 30 days
      requiredCollateral = ethers.parseEther("1");
    });

    it("Should revert when amount requested is zero", async function () {
      await expect(
        chainLend.connect(borrower).createLoanRequest(0, interestRate, duration, { value: requiredCollateral })
      ).to.be.revertedWithCustomError(chainLend, "ZeroAmount");
    });

    it("Should revert when collateral value is zero", async function () {
      await expect(
        chainLend.connect(borrower).createLoanRequest(
          ethers.parseUnits("1000", 6),
          interestRate,
          duration,
          { value: 0 }
        )
      ).to.be.revertedWithCustomError(chainLend, "ZeroAmount");
    });

    it("Should revert when amount exceeds maximum", async function () {
      const maxAmount = ethers.parseUnits("500000", 6);
      const overMaxAmount = maxAmount + 1n;
      
      await expect(
        chainLend.connect(borrower).createLoanRequest(overMaxAmount, interestRate, duration, { value: requiredCollateral })
      ).to.be.revertedWithCustomError(chainLend, "InvalidAmount");
    });

    it("Should revert when interest rate is too low", async function () {
      await expect(
        chainLend.connect(borrower).createLoanRequest(
          ethers.parseUnits("1000", 6),
          400, // Below MIN_INTEREST_RATE (500)
          duration,
          { value: requiredCollateral }
        )
      ).to.be.revertedWithCustomError(chainLend, "InvalidParameter");
    });

    it("Should revert when interest rate is too high", async function () {
      await expect(
        chainLend.connect(borrower).createLoanRequest(
          ethers.parseUnits("1000", 6),
          1600, // Above MAX_INTEREST_RATE (1500)
          duration,
          { value: requiredCollateral }
        )
      ).to.be.revertedWithCustomError(chainLend, "InvalidParameter");
    });

    it("Should revert when duration is too short", async function () {
      await expect(
        chainLend.connect(borrower).createLoanRequest(
          ethers.parseUnits("1000", 6),
          interestRate,
          29 * 24 * 60 * 60, // Below MIN_LOAN_DURATION (30 days)
          { value: requiredCollateral }
        )
      ).to.be.revertedWithCustomError(chainLend, "InvalidParameter");
    });

    it("Should revert when duration is too long", async function () {
      await expect(
        chainLend.connect(borrower).createLoanRequest(
          ethers.parseUnits("1000", 6),
          interestRate,
          1096 * 24 * 60 * 60, // Above MAX_LOAN_DURATION (1095 days)
          { value: requiredCollateral }
        )
      ).to.be.revertedWithCustomError(chainLend, "InvalidParameter");
    });

    it("Should revert when collateral is insufficient", async function () {
      const amountRequested = ethers.parseUnits("1000", 6);
      const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);
      const insufficientCollateral = requiredCollateral - 1n;
      
      await expect(
        chainLend.connect(borrower).createLoanRequest(
          amountRequested,
          interestRate,
          duration,
          { value: insufficientCollateral }
        )
      ).to.be.revertedWithCustomError(chainLend, "InsufficientCollateral");
    });
  });
});