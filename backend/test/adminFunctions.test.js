const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

const { deployChainLendFixture } = require("./fixtures");

describe("Test Admin Functions", function () {
  
  // TREASURY MANAGEMENT TESTS
  
  describe("Treasury Management", function () {
    let chainLend, owner, treasury;

    beforeEach(async function () {
      ({ chainLend, owner, treasury } = await loadFixture(deployChainLendFixture));
    });

    it("Should allow owner to update treasury address", async function () {
      const [, , , , newTreasury] = await ethers.getSigners();
      
      await chainLend.connect(owner).updateTreasury(newTreasury.address);
      
      expect(await chainLend.treasury()).to.equal(newTreasury.address);
    });

    it("Should revert when non-owner tries to update treasury", async function () {
      const [, nonOwner, , , newTreasury] = await ethers.getSigners();
      
      await expect(chainLend.connect(nonOwner).updateTreasury(newTreasury.address))
        .to.be.revertedWithCustomError(chainLend, "OwnableUnauthorizedAccount")
        .withArgs(nonOwner.address);
    });

    it("Should revert when updating treasury to zero address", async function () {
      await expect(chainLend.connect(owner).updateTreasury(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(chainLend, "ZeroAddress");
    });

    it("Should allow updating treasury to same address", async function () {
      const currentTreasury = await chainLend.treasury();
      
      await expect(chainLend.connect(owner).updateTreasury(currentTreasury))
        .to.not.be.reverted;
      
      expect(await chainLend.treasury()).to.equal(currentTreasury);
    });

  // EMERGENCY WITHDRAWAL TESTS 
  
  describe("Emergency USDC Withdrawal", function () {
    let chainLend, owner, usdcToken;

    beforeEach(async function () {
      ({ chainLend, owner, usdcToken } = await loadFixture(deployChainLendFixture));
    });

    it("Should allow owner to emergency withdraw USDC", async function () {
      // First, we add some USDC to the contract
      const amount = ethers.parseUnits("1000", 6);
      await usdcToken.mint(await chainLend.getAddress(), amount);
      
      await expect(chainLend.connect(owner).emergencyWithdrawUSDC(owner.address, ethers.parseUnits("500", 6)))
        .to.emit(chainLend, "EmergencyWithdrawal")
        .withArgs(owner.address, ethers.parseUnits("500", 6));
    });

    it("Should transfer USDC to specified address during emergency withdrawal", async function () {
      const [, , , , recipient] = await ethers.getSigners();
      const amount = ethers.parseUnits("1000", 6);
      const withdrawAmount = ethers.parseUnits("300", 6);
      
      // Add USDC to contract
      await usdcToken.mint(await chainLend.getAddress(), amount);
      
      const recipientBalanceBefore = await usdcToken.balanceOf(recipient.address);
      
      await chainLend.connect(owner).emergencyWithdrawUSDC(recipient.address, withdrawAmount);
      
      const recipientBalanceAfter = await usdcToken.balanceOf(recipient.address);
      expect(recipientBalanceAfter - recipientBalanceBefore).to.equal(withdrawAmount);
    });

    it("Should reduce contract USDC balance during emergency withdrawal", async function () {
      const amount = ethers.parseUnits("1000", 6);
      const withdrawAmount = ethers.parseUnits("400", 6);
      
      // Add USDC to contract
      await usdcToken.mint(await chainLend.getAddress(), amount);
      
      const contractBalanceBefore = await usdcToken.balanceOf(await chainLend.getAddress());
      
      await chainLend.connect(owner).emergencyWithdrawUSDC(owner.address, withdrawAmount);
      
      const contractBalanceAfter = await usdcToken.balanceOf(await chainLend.getAddress());
      expect(contractBalanceBefore - contractBalanceAfter).to.equal(withdrawAmount);
    });

    it("Should revert when non-owner tries emergency withdrawal", async function () {
      const [, nonOwner] = await ethers.getSigners();
      
      await expect(chainLend.connect(nonOwner).emergencyWithdrawUSDC(nonOwner.address, ethers.parseUnits("100", 6)))
        .to.be.revertedWithCustomError(chainLend, "OwnableUnauthorizedAccount")
        .withArgs(nonOwner.address);
    });

    it("Should revert emergency withdrawal to zero address", async function () {
      await expect(chainLend.connect(owner).emergencyWithdrawUSDC(ethers.ZeroAddress, ethers.parseUnits("100", 6)))
        .to.be.revertedWithCustomError(chainLend, "ZeroAddress");
    });

    it("Should revert emergency withdrawal with zero amount", async function () {
      await expect(chainLend.connect(owner).emergencyWithdrawUSDC(owner.address, 0))
        .to.be.revertedWithCustomError(chainLend, "ZeroAmount");
    });

    it("Should revert when withdrawing more than contract balance", async function () {
      const amount = ethers.parseUnits("500", 6);
      const excessiveAmount = ethers.parseUnits("1000", 6);
      
      // Add limited USDC to contract
      await usdcToken.mint(await chainLend.getAddress(), amount);
      
      await expect(chainLend.connect(owner).emergencyWithdrawUSDC(owner.address, excessiveAmount))
        .to.be.reverted; // ERC20 insufficient balance
    });

    it("Should allow multiple emergency withdrawals", async function () {
      const totalAmount = ethers.parseUnits("1000", 6);
      const withdrawal1 = ethers.parseUnits("300", 6);
      const withdrawal2 = ethers.parseUnits("200", 6);
      const withdrawal3 = ethers.parseUnits("500", 6);
      
      // Add USDC to contract
      await usdcToken.mint(await chainLend.getAddress(), totalAmount);
      
      const ownerBalanceBefore = await usdcToken.balanceOf(owner.address);
      
      // Multiple withdrawals
      await chainLend.connect(owner).emergencyWithdrawUSDC(owner.address, withdrawal1);
      await chainLend.connect(owner).emergencyWithdrawUSDC(owner.address, withdrawal2);
      await chainLend.connect(owner).emergencyWithdrawUSDC(owner.address, withdrawal3);
      
      const ownerBalanceAfter = await usdcToken.balanceOf(owner.address);
      expect(ownerBalanceAfter - ownerBalanceBefore).to.equal(totalAmount);
    });

    it("Should emit correct event data for emergency withdrawal", async function () {
      const [, , , , recipient] = await ethers.getSigners();
      const amount = ethers.parseUnits("800", 6);
      const withdrawAmount = ethers.parseUnits("250", 6);
      
      // Add USDC to contract
      await usdcToken.mint(await chainLend.getAddress(), amount);
      
      await expect(chainLend.connect(owner).emergencyWithdrawUSDC(recipient.address, withdrawAmount))
        .to.emit(chainLend, "EmergencyWithdrawal")
        .withArgs(recipient.address, withdrawAmount);
    });
  });

  // ========== OWNERSHIP MANAGEMENT TESTS ==========
  
  describe("Ownership Management", function () {
    let chainLend, owner, usdcToken;

    beforeEach(async function () {
      ({ chainLend, owner, usdcToken } = await loadFixture(deployChainLendFixture));
    });

    it("Should return correct owner", async function () {
      expect(await chainLend.owner()).to.equal(owner.address);
    });

    it("Should allow owner to transfer ownership", async function () {
      const [, , , , newOwner] = await ethers.getSigners();
      
      await chainLend.connect(owner).transferOwnership(newOwner.address);
      
      expect(await chainLend.owner()).to.equal(newOwner.address);
    });

    it("Should prevent non-owner from transferring ownership", async function () {
      const [, nonOwner, , , newOwner] = await ethers.getSigners();
      
      await expect(chainLend.connect(nonOwner).transferOwnership(newOwner.address))
        .to.be.revertedWithCustomError(chainLend, "OwnableUnauthorizedAccount")
        .withArgs(nonOwner.address);
    });
  });
});
});