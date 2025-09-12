const { ethers } = require("hardhat");

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

  // Deploy ChainLend
  const ChainLend = await ethers.getContractFactory("ChainLend");
  const chainLend = await ChainLend.deploy(
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
  await usdcToken.mint(borrower.address, ethers.parseUnits("100000", 6)); // 100k USDC
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

// LOAN LIFECYCLE FIXTURES 

async function createPendingLoanFixture() {
  const contracts = await deployChainLendFixture();
  const { chainLend, borrower } = contracts;

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

  return {
    ...contracts,
    amountRequested,
    interestRate,
    duration,
    requiredCollateral,
    requestId: 1
  };
}

async function createActiveLoanFixture() {
  const contracts = await createPendingLoanFixture();
  const { chainLend, lender } = contracts;

  // Fund the loan
  await chainLend.connect(lender).fundLoan(1);

  return contracts;
}

async function createRepaidLoanFixture() {
  const contracts = await createActiveLoanFixture();
  const { chainLend, borrower } = contracts;

  // Repay the loan
  await chainLend.connect(borrower).repayLoan(1);

  return contracts;
}

async function createLiquidatableLoanFixture() {
  const contracts = await createActiveLoanFixture();
  const { ethPriceFeed } = contracts;

  // Drop ETH price to make loan liquidatable (below 130% threshold)
  await ethPriceFeed.updatePrice(1200e8); // $1200 - should trigger liquidation

  return contracts;
}

// COLLATERAL MANAGEMENT FIXTURES

async function createActiveLoanWithExcessCollateralFixture() {
  const contracts = await deployChainLendFixture();
  const { chainLend, borrower, lender } = contracts;

  const amountRequested = ethers.parseUnits("1000", 6);
  const interestRate = 1000;
  const duration = 30 * 24 * 60 * 60;
  const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);
  const excessCollateral = ethers.parseEther("1"); // Extra 1 ETH

  // Create loan request with excess collateral
  await chainLend.connect(borrower).createLoanRequest(
    amountRequested,
    interestRate,
    duration,
    { value: requiredCollateral + excessCollateral }
  );

  // Fund the loan
  await chainLend.connect(lender).fundLoan(1);

  return {
    ...contracts,
    amountRequested,
    interestRate,
    duration,
    requiredCollateral,
    excessCollateral,
    requestId: 1
  };
}

// REWARDS FIXTURES 

async function createUserWithRewardsFixture() {
  const contracts = await deployChainLendFixture();
  const { chainLend, borrower, lender } = contracts;

  const amountRequested = ethers.parseUnits("1000", 6);
  const requiredCollateral = await chainLend.calculateRequiredCollateral(amountRequested);

  // Create loan request (earns 10 CL for borrower)
  await chainLend.connect(borrower).createLoanRequest(
    amountRequested,
    1000,
    30 * 24 * 60 * 60,
    { value: requiredCollateral }
  );

  // Fund loan (earns 50 CL for lender)
  await chainLend.connect(lender).fundLoan(1);

  return {
    ...contracts,
    amountRequested,
    requiredCollateral,
    requestId: 1
  };
}

// MULTIPLE LOANS FIXTURES 

async function createMultipleLoansFixture() {
  const contracts = await deployChainLendFixture();
  const { chainLend, borrower, lender } = contracts;

  const amounts = [
    ethers.parseUnits("1000", 6), // 1000 USDC
    ethers.parseUnits("500", 6),  // 500 USDC
    ethers.parseUnits("1500", 6)  // 1500 USDC
  ];

  // Create multiple loan requests
  for (let i = 0; i < amounts.length; i++) {
    const requiredCollateral = await chainLend.calculateRequiredCollateral(amounts[i]);
    
    await chainLend.connect(borrower).createLoanRequest(
      amounts[i],
      1000 + (i * 100), // Different interest rates
      (30 + i * 15) * 24 * 60 * 60, // Different durations
      { value: requiredCollateral }
    );
  }

  // Fund first two loans, leave third pending
  await chainLend.connect(lender).fundLoan(1);
  await chainLend.connect(lender).fundLoan(2);

  // Repay first loan
  await chainLend.connect(borrower).repayLoan(1);

  return {
    ...contracts,
    amounts,
    requestIds: [1, 2, 3]
  };
}


module.exports = {
  // Base fixtures
  deployChainLendFixture,
  
  // Loan lifecycle fixtures
  createPendingLoanFixture,
  createActiveLoanFixture,
  createRepaidLoanFixture,
  createLiquidatableLoanFixture,
  
  // Specialized fixtures
  createActiveLoanWithExcessCollateralFixture,
  createUserWithRewardsFixture,
  createMultipleLoansFixture,
};