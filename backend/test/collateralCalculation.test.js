const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

const { deployChainLendFixture } = require("./fixtures");

describe("Collateral Calculation", function () {
  
  // COLLATERAL CALCULATION TESTS 
  
  describe("Collateral Calculation", function () {
    let chainLend, ethPriceFeed, usdcPriceFeed;

    beforeEach(async function () {
      ({ chainLend, ethPriceFeed, usdcPriceFeed } = await loadFixture(deployChainLendFixture));
    });

    it("Should calculate correct collateral for standard loan amount", async function () {
      const loanAmount = ethers.parseUnits("1000", 6); // 1000 USDC
      const requiredCollateral = await chainLend.calculateRequiredCollateral(loanAmount);
      
      // At $2000 ETH and 150% collateral ratio
      // 1000 USDC * 1.5 = 1500 USDC value needed
      // 1500 USDC / $2000 per ETH = 0.75 ETH
      const expectedCollateral = ethers.parseEther("0.75");
      expect(requiredCollateral).to.equal(expectedCollateral);
    });

    it("Should revert with zero loan amount", async function () {
      await expect(chainLend.calculateRequiredCollateral(0))
        .to.be.revertedWithCustomError(chainLend, "ZeroAmount");
    });

    it("Should revert when loan amount exceeds maximum", async function () {
      const maxLoanAmount = await chainLend.MAX_LOAN_AMOUNT();
      const excessAmount = maxLoanAmount + 1n;
      
      await expect(chainLend.calculateRequiredCollateral(excessAmount))
        .to.be.revertedWithCustomError(chainLend, "InvalidAmount");
    });

    it("Should handle minimum loan amount calculations", async function () {
      const minAmount = ethers.parseUnits("1", 6); // 1 USDC
      const requiredCollateral = await chainLend.calculateRequiredCollateral(minAmount);
      
      expect(requiredCollateral).to.be.gt(0);
    });

    it("Should handle maximum loan amount calculations", async function () {
      const maxAmount = await chainLend.MAX_LOAN_AMOUNT();
      const requiredCollateral = await chainLend.calculateRequiredCollateral(maxAmount);
      
      expect(requiredCollateral).to.be.gt(0);
    });

    it("Should calculate different amounts for different ETH prices", async function () {
      const loanAmount = ethers.parseUnits("1000", 6);
      
      // Test with original price ($2000)
      const collateral1 = await chainLend.calculateRequiredCollateral(loanAmount);
      
      // Update to higher price ($4000)
      await ethPriceFeed.updatePrice(4000e8);
      const collateral2 = await chainLend.calculateRequiredCollateral(loanAmount);
      
      // Higher ETH price should require less ETH as collateral
      expect(collateral2).to.be.lt(collateral1);
    });

    it("Should calculate different amounts for different USDC prices", async function () {
      const loanAmount = ethers.parseUnits("1000", 6);
      
      // Test with original USDC price ($1)
      const collateral1 = await chainLend.calculateRequiredCollateral(loanAmount);
      
      // Update USDC price to $1.05 (slight depeg)
      await usdcPriceFeed.updatePrice(105000000); // $1.05 with 8 decimals
      const collateral2 = await chainLend.calculateRequiredCollateral(loanAmount);
      
      // Higher USDC price should require more ETH as collateral
      expect(collateral2).to.be.gt(collateral1);
    });
  });

  // PRICE REVERT TESTS 
  
  describe("Price Revert", function () {
    let chainLend, ethPriceFeed, usdcPriceFeed;

    beforeEach(async function () {
      ({ chainLend, ethPriceFeed, usdcPriceFeed } = await loadFixture(deployChainLendFixture));
    });

    it("Should revert with negative ETH price", async function () {
      await ethPriceFeed.updatePrice(-1);
      const loanAmount = ethers.parseUnits("1000", 6);
      
      await expect(chainLend.calculateRequiredCollateral(loanAmount))
        .to.be.revertedWithCustomError(chainLend, "InvalidPrice");
    });

    it("Should revert with zero ETH price", async function () {
      await ethPriceFeed.updatePrice(0);
      const loanAmount = ethers.parseUnits("1000", 6);
      
      await expect(chainLend.calculateRequiredCollateral(loanAmount))
        .to.be.revertedWithCustomError(chainLend, "InvalidPrice");
    });

    it("Should revert with negative USDC price", async function () {
      await usdcPriceFeed.updatePrice(-1);
      const loanAmount = ethers.parseUnits("1000", 6);
      
      await expect(chainLend.calculateRequiredCollateral(loanAmount))
        .to.be.revertedWithCustomError(chainLend, "InvalidPrice");
    });

    it("Should revert with zero USDC price", async function () {
      await usdcPriceFeed.updatePrice(0);
      const loanAmount = ethers.parseUnits("1000", 6);
      
      await expect(chainLend.calculateRequiredCollateral(loanAmount))
        .to.be.revertedWithCustomError(chainLend, "InvalidPrice");
    });

    it("Should revert with stale ETH price", async function () {
      const staleTimestamp = (await time.latest()) - 86500; // More than 1 day old
      await ethPriceFeed.setStalePrice(staleTimestamp);
      
      const loanAmount = ethers.parseUnits("1000", 6);
      
      await expect(chainLend.calculateRequiredCollateral(loanAmount))
        .to.be.revertedWithCustomError(chainLend, "StalePrice");
    });

    it("Should revert with stale USDC price", async function () {
      const staleTimestamp = (await time.latest()) - 86500; // More than 1 day old
      await usdcPriceFeed.setStalePrice(staleTimestamp);
      
      const loanAmount = ethers.parseUnits("1000", 6);
      
      await expect(chainLend.calculateRequiredCollateral(loanAmount))
        .to.be.revertedWithCustomError(chainLend, "StalePrice");
    });
  });

  // CALCULATION FOR SPECIAL CASES
  
  describe("Calculation For Special Cases", function () {
    let chainLend, ethPriceFeed, usdcPriceFeed;

    beforeEach(async function () {
      ({ chainLend, ethPriceFeed, usdcPriceFeed } = await loadFixture(deployChainLendFixture));
    });

    it("Should handle very small loan amounts", async function () {
      const loanAmount = ethers.parseUnits("0.01", 6); // 1 cent
      const requiredCollateral = await chainLend.calculateRequiredCollateral(loanAmount);
      
      expect(requiredCollateral).to.be.gt(0);
    });

    it("Should handle calculations with various ETH price levels", async function () {
      const loanAmount = ethers.parseUnits("1000", 6);
      const prices = [100e8, 500e8, 1000e8, 2000e8, 5000e8, 10000e8];
      
      for (const price of prices) {
        await ethPriceFeed.updatePrice(price);
        const requiredCollateral = await chainLend.calculateRequiredCollateral(loanAmount);
        expect(requiredCollateral).to.be.gt(0);
      }
    });

    it("Should maintain precision in calculations", async function () {
      const loanAmount = ethers.parseUnits("999.999999", 6); // Maximum USDC precision
      const requiredCollateral = await chainLend.calculateRequiredCollateral(loanAmount);
      
      expect(requiredCollateral).to.be.gt(0);
    });
  });
});