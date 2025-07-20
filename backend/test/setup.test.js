const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

const { deployChainLendFixture } = require("./fixtures");

describe("Setup & Configuration", function () {
  
  // DEPLOYMENT TESTS 
  
  describe("Deployment", function () {
    let chainLend, usdcToken, ethPriceFeed, usdcPriceFeed, clToken, treasury, owner;

    beforeEach(async function () {
      ({ chainLend, usdcToken, ethPriceFeed, usdcPriceFeed, clToken, treasury, owner } = await loadFixture(deployChainLendFixture));
    });

    it("Should set correct contract addresses", async function () {
      expect(await chainLend.usdcToken()).to.equal(await usdcToken.getAddress());
      expect(await chainLend.ethPriceFeed()).to.equal(await ethPriceFeed.getAddress());
      expect(await chainLend.usdcPriceFeed()).to.equal(await usdcPriceFeed.getAddress());
      expect(await chainLend.clToken()).to.equal(await clToken.getAddress());
      expect(await chainLend.treasury()).to.equal(treasury.address);
    });

    it("Should set correct owner", async function () {
      expect(await chainLend.owner()).to.equal(owner.address);
    });

    it("Should revert deployment with zero address for USDC token", async function () {
      const ChainLend = await ethers.getContractFactory("ChainLend");
      
      await expect(ChainLend.deploy(
        ethers.ZeroAddress,
        await ethPriceFeed.getAddress(),
        treasury.address,
        await usdcPriceFeed.getAddress(),
        await clToken.getAddress(),
        owner.address
      )).to.be.revertedWithCustomError(ChainLend, "ZeroAddress");
    });

    it("Should revert deployment with zero address for ETH price feed", async function () {
      const ChainLend = await ethers.getContractFactory("ChainLend");
      
      await expect(ChainLend.deploy(
        await usdcToken.getAddress(),
        ethers.ZeroAddress,
        treasury.address,
        await usdcPriceFeed.getAddress(),
        await clToken.getAddress(),
        owner.address
      )).to.be.revertedWithCustomError(ChainLend, "ZeroAddress");
    });

    it("Should revert deployment with zero address for treasury", async function () {
      const ChainLend = await ethers.getContractFactory("ChainLend");
      
      await expect(ChainLend.deploy(
        await usdcToken.getAddress(),
        await ethPriceFeed.getAddress(),
        ethers.ZeroAddress,
        await usdcPriceFeed.getAddress(),
        await clToken.getAddress(),
        owner.address
      )).to.be.revertedWithCustomError(ChainLend, "ZeroAddress");
    });

    it("Should revert deployment with zero address for USDC price feed", async function () {
      const ChainLend = await ethers.getContractFactory("ChainLend");
      
      await expect(ChainLend.deploy(
        await usdcToken.getAddress(),
        await ethPriceFeed.getAddress(),
        treasury.address,
        ethers.ZeroAddress,
        await clToken.getAddress(),
        owner.address
      )).to.be.revertedWithCustomError(ChainLend, "ZeroAddress");
    });

    it("Should revert deployment with zero address for CL token", async function () {
      const ChainLend = await ethers.getContractFactory("ChainLend");
      
      await expect(ChainLend.deploy(
        await usdcToken.getAddress(),
        await ethPriceFeed.getAddress(),
        treasury.address,
        await usdcPriceFeed.getAddress(),
        ethers.ZeroAddress,
        owner.address
      )).to.be.revertedWithCustomError(ChainLend, "ZeroAddress");
    });
  });

  // CONSTANTS TESTS
  
  describe("Constants", function () {
    let chainLend;

    beforeEach(async function () {
      ({ chainLend } = await loadFixture(deployChainLendFixture));
    });

    it("Should have correct BASIS_POINTS", async function () {
      expect(await chainLend.BASIS_POINTS()).to.equal(10000);
    });

    it("Should have correct MIN_COLLATERAL_RATIO", async function () {
      expect(await chainLend.MIN_COLLATERAL_RATIO()).to.equal(15000); // 150%
    });

    it("Should have correct LIQUIDATION_THRESHOLD", async function () {
      expect(await chainLend.LIQUIDATION_THRESHOLD()).to.equal(13000); // 130%
    });

    it("Should have correct WARNING_THRESHOLD", async function () {
      expect(await chainLend.WARNING_THRESHOLD()).to.equal(14000); // 140%
    });

    it("Should have correct PROTOCOL_FEE", async function () {
      expect(await chainLend.PROTOCOL_FEE()).to.equal(1000); // 10%
    });

    it("Should have correct STALENESS_THRESHOLD", async function () {
      expect(await chainLend.STALENESS_THRESHOLD()).to.equal(86400); // 24 hours
    });

    it("Should have correct MIN_INTEREST_RATE", async function () {
      expect(await chainLend.MIN_INTEREST_RATE()).to.equal(500); // 5%
    });

    it("Should have correct MAX_INTEREST_RATE", async function () {
      expect(await chainLend.MAX_INTEREST_RATE()).to.equal(1500); // 15%
    });

    it("Should have correct MIN_LOAN_DURATION", async function () {
      expect(await chainLend.MIN_LOAN_DURATION()).to.equal(30 * 24 * 60 * 60); // 30 days
    });

    it("Should have correct MAX_LOAN_DURATION", async function () {
      expect(await chainLend.MAX_LOAN_DURATION()).to.equal(1095 * 24 * 60 * 60); // ~3 years
    });

    it("Should have correct MAX_LOAN_AMOUNT", async function () {
      expect(await chainLend.MAX_LOAN_AMOUNT()).to.equal(ethers.parseUnits("500000", 6)); // 500k USDC
    });

    it("Should have correct reward constants", async function () {
      expect(await chainLend.REWARD_CREATE_REQUEST()).to.equal(ethers.parseEther("10"));
      expect(await chainLend.REWARD_FUND_LOAN()).to.equal(ethers.parseEther("50"));
      expect(await chainLend.REWARD_REPAY_ONTIME()).to.equal(ethers.parseEther("100"));
      expect(await chainLend.MIN_CLAIM_AMOUNT()).to.equal(ethers.parseEther("10"));
    });
  });

  // INITIAL STATE 
  
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

    it("Should have no pending CL rewards initially", async function () {
      const [, user] = await ethers.getSigners();
      expect(await chainLend.pendingCLRewards(user.address)).to.equal(0);
    });

    it("Should have zero user request count initially", async function () {
      const [, user] = await ethers.getSigners();
      expect(await chainLend.userRequestCount(user.address)).to.equal(0);
    });

    it("Should have zero user loan count initially", async function () {
      const [, user] = await ethers.getSigners();
      expect(await chainLend.userLoanCount(user.address)).to.equal(0);
    });

    it("Should return empty array for user requests initially", async function () {
      const [, user] = await ethers.getSigners();
      const userRequests = await chainLend.getUserRequests(user.address);
      expect(userRequests.length).to.equal(0);
    });

    it("Should return empty array for user loans initially", async function () {
      const [, user] = await ethers.getSigners();
      const userLoans = await chainLend.getUserLoans(user.address);
      expect(userLoans.length).to.equal(0);
    });

    it("Should return zero pending requests count initially", async function () {
      expect(await chainLend.getPendingRequestsCount()).to.equal(0);
    });

    it("Should return correct initial protocol stats", async function () {
      const [totalRequests, activeRequests, activeLoansCount, totalVolume] = 
        await chainLend.getProtocolStats();
      
      expect(totalRequests).to.equal(0);
      expect(activeRequests).to.equal(0);
      expect(activeLoansCount).to.equal(0);
      expect(totalVolume).to.equal(0);
    });
  });
});