const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const BASE = require("./constants/base");

describe("Integration Tests - Base Fork", function () {
  
  // Increase timeout for fork tests
  this.timeout(120000);

  // ========== SETUP ==========
  
  async function deployOnForkFixture() {
    console.log("🔍 Step 1: Getting signers...");
    const [owner, borrower, lender, liquidator, treasury] = await ethers.getSigners();
    console.log("✅ Signers OK");
    console.log("Owner:", owner.address);
    console.log("Treasury:", treasury.address);

    console.log("🔍 Step 2: Getting USDC contract...");
    const usdcToken = await ethers.getContractAt([
      "function transfer(address to, uint256 amount) returns (bool)",
      "function transferFrom(address from, address to, uint256 amount) returns (bool)", 
      "function approve(address spender, uint256 amount) returns (bool)",
      "function balanceOf(address account) view returns (uint256)",
      "function allowance(address owner, address spender) view returns (uint256)",
      "function decimals() view returns (uint8)"
    ], BASE.USDC);
    console.log("✅ USDC OK");

    console.log("🔍 Step 1.5: Setting up whale accounts...");
    
    // Meilleures whale addresses pour Base mainnet
    const ETH_WHALE = "0x4200000000000000000000000000000000000006"; // WETH contract
    const USDC_WHALE = "0x3c8B650257cFb5f272f799F5e2b4e65093a11a05"; // Coinbase Exchange - gros holder USDC
    
    // Alternatives avec plus de USDC
    const USDC_WHALE_ALT = "0xdAC17F958D2ee523a2206206994597C13D831ec7"; // Tether Treasury
    const USDC_WHALE_ALT2 = "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA"; // BaseBridge

    // Impersonate whale accounts
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [ETH_WHALE]
    });
    
    let usdcWhale, usdcWhaleAddress;
    
    // Try different USDC whales until we find one with enough balance
    const usdcWhales = [USDC_WHALE, USDC_WHALE_ALT, USDC_WHALE_ALT2];
    
    for (const whaleAddr of usdcWhales) {
      try {
        await network.provider.request({
          method: "hardhat_impersonateAccount", 
          params: [whaleAddr]
        });
        
        const testWhale = await ethers.getSigner(whaleAddr);
        const testBalance = await usdcToken.balanceOf(whaleAddr);
        
        console.log(`Testing USDC whale ${whaleAddr}: ${ethers.formatUnits(testBalance, 6)} USDC`);
        
        if (testBalance > ethers.parseUnits("100", 6)) {
          usdcWhale = testWhale;
          usdcWhaleAddress = whaleAddr;
          console.log(`✅ Using USDC whale: ${whaleAddr}`);
          break;
        }
      } catch (error) {
        console.log(`❌ Failed to impersonate ${whaleAddr}: ${error.message}`);
        continue;
      }
    }
    
    if (!usdcWhale) {
      console.log("⚠️ No suitable USDC whale found, tests may fail");
      // Create a dummy whale for the interface
      usdcWhale = await ethers.getSigner(USDC_WHALE);
      usdcWhaleAddress = USDC_WHALE;
    }

    const ethWhale = await ethers.getSigner(ETH_WHALE);

    // Check whale balances
    const whaleETHBalance = await ethers.provider.getBalance(ETH_WHALE);
    console.log(`ETH Whale balance: ${ethers.formatEther(whaleETHBalance)} ETH`);

    // Check USDC whale balance
    const whaleUSDCBalance = await usdcToken.balanceOf(usdcWhaleAddress);
    console.log(`USDC Whale balance: ${ethers.formatUnits(whaleUSDCBalance, 6)} USDC`);

    // Fund test accounts with USDC if whale has enough
    const usdcFundAmount = ethers.parseUnits("1000", 6); // 1000 USDC each
    
    if (whaleUSDCBalance > usdcFundAmount * 3n) {
      console.log("💰 Funding accounts with USDC from whale...");
      
      try {
        // IMPORTANT: Fund whale with ETH first for gas
        const whaleETHBalance = await ethers.provider.getBalance(usdcWhaleAddress);
        console.log(`USDC whale ETH balance: ${ethers.formatEther(whaleETHBalance)} ETH`);
        
        if (whaleETHBalance < ethers.parseEther("0.1")) {
          console.log("💰 Funding USDC whale with ETH for gas...");
          await ethWhale.sendTransaction({
            to: usdcWhaleAddress,
            value: ethers.parseEther("5") // 5 ETH for gas
          });
          console.log("✅ USDC whale funded with ETH");
        }
        
        await usdcToken.connect(usdcWhale).transfer(lender.address, usdcFundAmount);
        console.log("✅ Lender funded with USDC");
        
        await usdcToken.connect(usdcWhale).transfer(borrower.address, usdcFundAmount);
        console.log("✅ Borrower funded with USDC");
        
      } catch (error) {
        console.log("⚠️ USDC funding failed, will use alternative method in tests");
        console.log("Error:", error.message);
      }
    } else {
      console.log("⚠️ Whale doesn't have enough USDC, will handle in individual tests");
    }

    // Fund test accounts with ETH si le whale en a assez
    const fundAmount = ethers.parseEther("10"); // Réduire à 10 ETH
    
    if (whaleETHBalance > fundAmount * 5n) {
      console.log("💰 Funding accounts with ETH from whale...");
      
      try {
        await ethWhale.sendTransaction({
          to: owner.address,
          value: fundAmount
        });
        console.log("✅ Owner funded");
        
        await ethWhale.sendTransaction({
          to: borrower.address,
          value: fundAmount
        });
        console.log("✅ Borrower funded");
        
        await ethWhale.sendTransaction({
          to: lender.address,
          value: fundAmount
        });
        console.log("✅ Lender funded");
        
        await ethWhale.sendTransaction({
          to: liquidator.address,
          value: fundAmount
        });
        console.log("✅ Liquidator funded");
        
        await ethWhale.sendTransaction({
          to: treasury.address,
          value: fundAmount
        });
        console.log("✅ Treasury funded");
        
      } catch (error) {
        console.log("⚠️ ETH funding failed, continuing with available balances...");
        console.log("Error:", error.message);
      }
    } else {
      console.log("⚠️ Whale doesn't have enough ETH, using available balances");
    }

    console.log("🔍 Step 3: Getting price feeds...");
    const ethPriceFeed = await ethers.getContractAt("IChainlinkPriceFeed", BASE.ETH_USD_FEED);
    const usdcPriceFeed = await ethers.getContractAt("IChainlinkPriceFeed", BASE.USDC_USD_FEED);
    console.log("✅ Price feeds OK");

    console.log("🔍 Step 4: Deploying CLToken...");
    const CLToken = await ethers.getContractFactory("CLToken");
    console.log("CLToken factory created");
    
    try {
      const clToken = await CLToken.deploy(owner.address);
      console.log("CLToken deploy transaction sent");
      
      await clToken.waitForDeployment();
      console.log("✅ CLToken deployed");
      
      const clTokenAddress = await clToken.getAddress();
      console.log("CLToken address:", clTokenAddress);
      
      console.log("🔍 Step 5: Deploying ChainLendCore...");
      const ChainLendCore = await ethers.getContractFactory("ChainLendCore");
      const chainLend = await ChainLendCore.deploy(
        BASE.USDC,
        BASE.ETH_USD_FEED,
        treasury.address,
        BASE.USDC_USD_FEED,
        clTokenAddress,
        owner.address
      );
      console.log("✅ ChainLendCore deployed");

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
        treasury,
        ethWhale,
        usdcWhale
      };
      
    } catch (error) {
      console.log("❌ Deployment failed:");
      console.log("Error:", error.message);
      console.log("Full error:", error);
      throw error;
    }
  }

  // ========== REAL PRICE FEEDS TESTS ==========

  describe("Real Chainlink Integration", function () {
    
    it("Should read real ETH price from Chainlink", async function () {
      const { ethPriceFeed } = await loadFixture(deployOnForkFixture);
      
      const [, price, , updatedAt,] = await ethPriceFeed.latestRoundData();
      
      console.log(`Real ETH Price: $${ethers.formatUnits(price, 8)}`);
      console.log(`Last updated: ${new Date(Number(updatedAt) * 1000).toLocaleString()}`);
      
      expect(price).to.be.gt(0);
      expect(updatedAt).to.be.gt(0);
      // ETH should be between $1000 and $10000 (reasonable range)
      expect(price).to.be.gt(1000e8);
      expect(price).to.be.lt(10000e8);
    });

    it("Should read real USDC price from Chainlink", async function () {
      const { usdcPriceFeed } = await loadFixture(deployOnForkFixture);
      
      const [, price, , updatedAt,] = await usdcPriceFeed.latestRoundData();
      
      console.log(`Real USDC Price: $${ethers.formatUnits(price, 8)}`);
      console.log(`Last updated: ${new Date(Number(updatedAt) * 1000).toLocaleString()}`);
      
      expect(price).to.be.gt(0);
      expect(updatedAt).to.be.gt(0);
      // USDC should be between $0.95 and $1.05 (reasonable range)
      expect(price).to.be.gt(95e6); // 0.95 with 8 decimals
      expect(price).to.be.lt(105e6); // 1.05 with 8 decimals
    });

    it("Should calculate collateral with real prices", async function () {
      const { chainLend, ethPriceFeed, usdcPriceFeed } = await loadFixture(deployOnForkFixture);
      
      const loanAmount = ethers.parseUnits("1000", 6); // 1000 USDC
      
      // Get real prices
      const [, ethPrice, , ethUpdatedAt] = await ethPriceFeed.latestRoundData();
      const [, usdcPrice, , usdcUpdatedAt] = await usdcPriceFeed.latestRoundData();
      
      console.log(`Loan: $1000 USDC`);
      console.log(`ETH Price: ${ethers.formatUnits(ethPrice, 8)}`);
      console.log(`USDC Price: ${ethers.formatUnits(usdcPrice, 8)}`);
      console.log(`ETH updated: ${new Date(Number(ethUpdatedAt) * 1000).toLocaleString()}`);
      console.log(`USDC updated: ${new Date(Number(usdcUpdatedAt) * 1000).toLocaleString()}`);
      
      // Check if prices are too stale
      const currentTime = Math.floor(Date.now() / 1000);
      const ethAge = currentTime - Number(ethUpdatedAt);
      const usdcAge = currentTime - Number(usdcUpdatedAt);
      
      console.log(`ETH price age: ${ethAge} seconds`);
      console.log(`USDC price age: ${usdcAge} seconds`);
      
      if (ethAge > 3600 || usdcAge > 3600) {
        console.log("⚠️ Prices are stale, skipping collateral calculation test");
        this.skip();
      }
      
      try {
        const requiredCollateral = await chainLend.calculateRequiredCollateral(loanAmount);
        
        console.log(`Required Collateral: ${ethers.formatEther(requiredCollateral)} ETH`);
        
        expect(requiredCollateral).to.be.gt(0);
        
        // Verify collateral calculation makes sense
        // Should be around (1000 * 1.5) / ETH_PRICE
        const expectedCollateral = (1000n * 150n * 10n**18n) / ethPrice;
        const tolerance = expectedCollateral / 20n; // 5% tolerance
        
        expect(requiredCollateral).to.be.closeTo(expectedCollateral, tolerance);
        
      } catch (error) {
        if (error.message.includes("StalePrice")) {
          console.log("⚠️ Price feed is stale, skipping test");
          this.skip();
        } else {
          throw error;
        }
      }
    });
  });

  // ========== REAL USDC INTEGRATION ==========

  describe("Real USDC Integration", function () {
    
    it("Should handle real USDC transfers", async function () {
      const { usdcToken, usdcWhale, lender, ethWhale } = await loadFixture(deployOnForkFixture);
      
      const whaleBalance = await usdcToken.balanceOf(usdcWhale.address);
      console.log(`Whale USDC Balance: ${ethers.formatUnits(whaleBalance, 6)} USDC`);
      
      if (whaleBalance === 0n) {
        console.log("⚠️ Whale has no USDC, skipping transfer test");
        this.skip();
      }
      
      // CRITICAL: Fund whale with ETH for gas if needed
      const whaleETHBalance = await ethers.provider.getBalance(usdcWhale.address);
      console.log(`USDC whale ETH balance: ${ethers.formatEther(whaleETHBalance)} ETH`);
      
      if (whaleETHBalance < ethers.parseEther("0.01")) {
        console.log("💰 Funding USDC whale with ETH for gas...");
        try {
          await ethWhale.sendTransaction({
            to: usdcWhale.address,
            value: ethers.parseEther("1")
          });
          console.log("✅ USDC whale funded with ETH");
        } catch (error) {
          console.log("❌ Failed to fund whale with ETH:", error.message);
          console.log("⚠️ Cannot proceed without gas funds, skipping test");
          this.skip();
        }
      }
      
      // Transfer USDC from whale to lender
      const transferAmount = ethers.parseUnits("10", 6); // 10 USDC
      
      try {
        await usdcToken.connect(usdcWhale).transfer(lender.address, transferAmount);
        
        const lenderBalance = await usdcToken.balanceOf(lender.address);
        expect(lenderBalance).to.be.gte(transferAmount);
        
        console.log(`✅ Transferred ${ethers.formatUnits(transferAmount, 6)} USDC to lender`);
      } catch (error) {
        console.log("❌ USDC transfer failed:", error.message);
        throw error;
      }
    });

    it("Should approve and check allowances for real USDC", async function () {
      const { usdcToken, usdcWhale, chainLend, ethWhale } = await loadFixture(deployOnForkFixture);
      
      // CRITICAL: Fund whale with ETH for gas if needed
      const whaleETHBalance = await ethers.provider.getBalance(usdcWhale.address);
      console.log(`USDC whale ETH balance: ${ethers.formatEther(whaleETHBalance)} ETH`);
      
      if (whaleETHBalance < ethers.parseEther("0.01")) {
        console.log("💰 Funding USDC whale with ETH for gas...");
        try {
          await ethWhale.sendTransaction({
            to: usdcWhale.address,
            value: ethers.parseEther("1")
          });
          console.log("✅ USDC whale funded with ETH");
        } catch (error) {
          console.log("❌ Failed to fund whale with ETH:", error.message);
          console.log("⚠️ Cannot proceed without gas funds, skipping test");
          this.skip();
        }
      }
      
      const transferAmount = ethers.parseUnits("5", 6); // 5 USDC
      const chainLendAddress = await chainLend.getAddress();
      
      try {
        // Whale approves ChainLend
        await usdcToken.connect(usdcWhale).approve(chainLendAddress, transferAmount);
        
        const allowance = await usdcToken.allowance(usdcWhale.address, chainLendAddress);
        expect(allowance).to.equal(transferAmount);
        
        console.log(`✅ Approved ${ethers.formatUnits(allowance, 6)} USDC for ChainLend`);
      } catch (error) {
        console.log("❌ USDC approval failed:", error.message);
        throw error;
      }
    });
  });

  // ========== END-TO-END SCENARIO ==========

  describe("Complete Loan Lifecycle - Real Contracts", function () {
    
    it("Should complete full loan cycle with real USDC and prices", async function () {
      const { chainLend, usdcToken, usdcWhale, borrower, lender, ethWhale } = await loadFixture(deployOnForkFixture);
      
      // CRITICAL: Fund whale with ETH for gas if needed
      const whaleETHBalance = await ethers.provider.getBalance(usdcWhale.address);
      console.log(`USDC whale ETH balance: ${ethers.formatEther(whaleETHBalance)} ETH`);
      
      if (whaleETHBalance < ethers.parseEther("0.01")) {
        console.log("💰 Funding USDC whale with ETH for gas...");
        try {
          await ethWhale.sendTransaction({
            to: usdcWhale.address,
            value: ethers.parseEther("2") // More ETH for multiple transactions
          });
          console.log("✅ USDC whale funded with ETH");
        } catch (error) {
          console.log("❌ Failed to fund whale with ETH:", error.message);
          console.log("⚠️ Cannot proceed without gas funds, skipping test");
          this.skip();
        }
      }
      
      // Check if we have enough resources
      const whaleUSDCBalance = await usdcToken.balanceOf(usdcWhale.address);
      const borrowerETHBalance = await ethers.provider.getBalance(borrower.address);
      
      console.log(`Available resources:`);
      console.log(`- Whale USDC: ${ethers.formatUnits(whaleUSDCBalance, 6)} USDC`);
      console.log(`- Borrower ETH: ${ethers.formatEther(borrowerETHBalance)} ETH`);
      
      if (whaleUSDCBalance < ethers.parseUnits("50", 6)) {
        console.log("⚠️ Not enough USDC for full lifecycle test, skipping");
        this.skip();
      }
      
      if (borrowerETHBalance < ethers.parseEther("1")) {
        console.log("⚠️ Not enough ETH for collateral, skipping");
        this.skip();
      }
      
      // Setup: Give lender real USDC from whale
      const loanAmount = ethers.parseUnits("10", 6); // 10 USDC loan
      
      try {
        await usdcToken.connect(usdcWhale).transfer(lender.address, loanAmount * 2n); // Extra for interest
        await usdcToken.connect(lender).approve(await chainLend.getAddress(), loanAmount);
        console.log("✅ Lender setup complete");
      } catch (error) {
        console.log("❌ Failed to setup lender:", error.message);
        this.skip();
      }
      
      console.log(`\n=== LOAN CYCLE START ===`);
      
      // Step 1: Calculate required collateral with real prices (with stale price handling)
      let requiredCollateral;
      try {
        requiredCollateral = await chainLend.calculateRequiredCollateral(loanAmount);
        console.log(`Required Collateral: ${ethers.formatEther(requiredCollateral)} ETH`);
      } catch (error) {
        if (error.message.includes("StalePrice")) {
          console.log("⚠️ Price feed is stale, skipping full lifecycle test");
          const match = error.message.match(/StalePrice\((\d+), (\d+)\)/);
          if (match) {
            const [, lastUpdate, stalePeriod] = match;
            const currentTime = Math.floor(Date.now() / 1000);
            const age = currentTime - parseInt(lastUpdate);
            console.log(`Price last updated: ${age}s ago, stale after: ${stalePeriod}s`);
          }
          this.skip();
        } else {
          throw error;
        }
      }
      
      // Ensure borrower has enough ETH
      if (borrowerETHBalance < requiredCollateral + ethers.parseEther("0.1")) {
        console.log("⚠️ Borrower doesn't have enough ETH for collateral + gas");
        this.skip();
      }
      
      // Step 2: Borrower creates loan request
      await chainLend.connect(borrower).createLoanRequest(
        loanAmount,
        1000, // 10% interest
        30 * 24 * 60 * 60, // 30 days
        { value: requiredCollateral }
      );
      
      console.log(`✅ Loan request created`);
      
      // Step 3: Lender funds loan with real USDC
      await chainLend.connect(lender).fundLoan(1);
      
      const borrowerUSDCBalance = await usdcToken.balanceOf(borrower.address);
      expect(borrowerUSDCBalance).to.be.gte(loanAmount);
      console.log(`✅ Loan funded - Borrower received ${ethers.formatUnits(borrowerUSDCBalance, 6)} USDC`);
      
      // Step 4: Borrower repays with real USDC
      const activeLoan = await chainLend.getActiveLoan(1);
      const totalDue = activeLoan.totalAmountDue;
      
      // Give borrower enough USDC to repay (from whale)
      const additionalNeeded = totalDue - borrowerUSDCBalance;
      if (additionalNeeded > 0) {
        await usdcToken.connect(usdcWhale).transfer(borrower.address, additionalNeeded);
      }
      
      await usdcToken.connect(borrower).approve(await chainLend.getAddress(), totalDue);
      
      const lenderBalanceBefore = await usdcToken.balanceOf(lender.address);
      
      await chainLend.connect(borrower).repayLoan(1);
      
      const lenderBalanceAfter = await usdcToken.balanceOf(lender.address);
      console.log(`✅ Loan repaid - Lender received ${ethers.formatUnits(lenderBalanceAfter - lenderBalanceBefore, 6)} USDC`);
      
      // Step 5: Borrower withdraws collateral
      const borrowerETHBefore = await ethers.provider.getBalance(borrower.address);
      await chainLend.connect(borrower).withdrawCollateral(1);
      const borrowerETHAfter = await ethers.provider.getBalance(borrower.address);
      
      console.log(`✅ Collateral withdrawn - Borrower received back ETH`);
      
      console.log(`=== LOAN CYCLE COMPLETE ===\n`);
      
      // Verify final state
      const finalLoan = await chainLend.getActiveLoan(1);
      expect(finalLoan.status).to.equal(1); // Repaid
      
      const request = await chainLend.getLoanRequest(1);
      expect(request.actualCollateralDeposited).to.equal(0); // Withdrawn
    });
  });
});