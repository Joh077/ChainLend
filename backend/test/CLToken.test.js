const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("CLToken", function () {
  // ========== FIXTURES ==========
  
  async function deployCLTokenFixture() {
    const [owner, minter, user, nonMinter] = await ethers.getSigners();

    const CLToken = await ethers.getContractFactory("CLToken");
    const clToken = await CLToken.deploy(owner.address);

    return {
      clToken,
      owner,
      minter,
      user,
      nonMinter
    };
  }

  async function deployWithMinterFixture() {
    const contracts = await deployCLTokenFixture();
    const { clToken, owner, minter } = contracts;

    await clToken.connect(owner).addMinter(minter.address);

    return contracts;
  }

  // ========== DEPLOYMENT TESTS ==========
  
  describe("Deployment", function () {
    let clToken, owner;

    beforeEach(async function () {
      ({ clToken, owner } = await loadFixture(deployCLTokenFixture));
    });

    it("Should set correct name", async function () {
      expect(await clToken.name()).to.equal("ChainLend Token");
    });

    it("Should set correct symbol", async function () {
      expect(await clToken.symbol()).to.equal("CL");
    });

    it("Should set correct decimals", async function () {
      expect(await clToken.decimals()).to.equal(18);
    });

    it("Should set correct owner", async function () {
      expect(await clToken.owner()).to.equal(owner.address);
    });

    it("Should have zero initial supply", async function () {
      expect(await clToken.totalSupply()).to.equal(0);
    });

    it("Should have correct max supply", async function () {
      expect(await clToken.MAX_SUPPLY()).to.equal(ethers.parseEther("100000000")); // 100M
    });
  });

  // ========== MINTER MANAGEMENT TESTS ==========
  
  describe("Minter Management", function () {
    let clToken, owner, minter, nonMinter;

    beforeEach(async function () {
      ({ clToken, owner, minter, nonMinter } = await loadFixture(deployCLTokenFixture));
    });

    it("Should allow owner to add minter", async function () {
      await expect(clToken.connect(owner).addMinter(minter.address))
        .to.emit(clToken, "MinterAdded")
        .withArgs(minter.address);
    });

    it("Should set minter status to true", async function () {
      await clToken.connect(owner).addMinter(minter.address);
      expect(await clToken.minters(minter.address)).to.be.true;
    });

    it("Should return true for isMinter check", async function () {
      await clToken.connect(owner).addMinter(minter.address);
      expect(await clToken.isMinter(minter.address)).to.be.true;
    });

    it("Should revert when non-owner tries to add minter", async function () {
      await expect(clToken.connect(nonMinter).addMinter(minter.address))
        .to.be.revertedWithCustomError(clToken, "OwnableUnauthorizedAccount");
    });

    it("Should revert when adding zero address as minter", async function () {
      await expect(clToken.connect(owner).addMinter(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(clToken, "ZeroAddress");
    });

    it("Should revert when adding existing minter", async function () {
      await clToken.connect(owner).addMinter(minter.address);
      
      await expect(clToken.connect(owner).addMinter(minter.address))
        .to.be.revertedWithCustomError(clToken, "MinterAlreadyAdded");
    });

    it("Should allow owner to remove minter", async function () {
      await clToken.connect(owner).addMinter(minter.address);
      
      await expect(clToken.connect(owner).removeMinter(minter.address))
        .to.emit(clToken, "MinterRemoved")
        .withArgs(minter.address);
    });

    it("Should set minter status to false after removal", async function () {
      await clToken.connect(owner).addMinter(minter.address);
      await clToken.connect(owner).removeMinter(minter.address);
      
      expect(await clToken.minters(minter.address)).to.be.false;
    });

    it("Should revert when removing non-existent minter", async function () {
      await expect(clToken.connect(owner).removeMinter(minter.address))
        .to.be.revertedWithCustomError(clToken, "MinterNotFound");
    });

    it("Should revert when non-owner tries to remove minter", async function () {
      await clToken.connect(owner).addMinter(minter.address);
      
      await expect(clToken.connect(nonMinter).removeMinter(minter.address))
        .to.be.revertedWithCustomError(clToken, "OwnableUnauthorizedAccount");
    });
  });

  // ========== MINTING TESTS ==========
  
  describe("Minting", function () {
    let clToken, minter, user, nonMinter;

    beforeEach(async function () {
      ({ clToken, minter, user, nonMinter } = await loadFixture(deployWithMinterFixture));
    });

    it("Should allow minter to mint tokens", async function () {
      const amount = ethers.parseEther("1000");
      
      await expect(clToken.connect(minter).mint(user.address, amount))
        .to.emit(clToken, "TokensMinted")
        .withArgs(user.address, amount);
    });

    it("Should increase user balance when minting", async function () {
      const amount = ethers.parseEther("1000");
      
      await clToken.connect(minter).mint(user.address, amount);
      
      expect(await clToken.balanceOf(user.address)).to.equal(amount);
    });

    it("Should increase total supply when minting", async function () {
      const amount = ethers.parseEther("1000");
      
      await clToken.connect(minter).mint(user.address, amount);
      
      expect(await clToken.totalSupply()).to.equal(amount);
    });

    it("Should revert when non-minter tries to mint", async function () {
      const amount = ethers.parseEther("1000");
      
      await expect(clToken.connect(nonMinter).mint(user.address, amount))
        .to.be.revertedWithCustomError(clToken, "NotMinter");
    });

    it("Should revert when minting to zero address", async function () {
      const amount = ethers.parseEther("1000");
      
      await expect(clToken.connect(minter).mint(ethers.ZeroAddress, amount))
        .to.be.revertedWithCustomError(clToken, "ZeroAddress");
    });

    it("Should revert when minting zero amount", async function () {
      await expect(clToken.connect(minter).mint(user.address, 0))
        .to.be.revertedWithCustomError(clToken, "ZeroAmount");
    });

    it("Should revert when minting exceeds max supply", async function () {
      const maxSupply = await clToken.MAX_SUPPLY();
      const excessAmount = maxSupply + 1n;
      
      await expect(clToken.connect(minter).mint(user.address, excessAmount))
        .to.be.revertedWithCustomError(clToken, "MaxSupplyExceeded");
    });

    it("Should allow minting up to max supply", async function () {
      const maxSupply = await clToken.MAX_SUPPLY();
      
      await expect(clToken.connect(minter).mint(user.address, maxSupply))
        .to.not.be.reverted;
    });

    it("Should revert when total minting exceeds max supply", async function () {
      const halfMax = (await clToken.MAX_SUPPLY()) / 2n;
      
      // Mint half the max supply
      await clToken.connect(minter).mint(user.address, halfMax);
      
      // Try to mint more than the remaining supply
      await expect(clToken.connect(minter).mint(user.address, halfMax + 1n))
        .to.be.revertedWithCustomError(clToken, "MaxSupplyExceeded");
    });
  });

  // ========== QUERY FUNCTIONS TESTS ==========
  
  describe("Query Functions", function () {
    let clToken, minter, user;

    beforeEach(async function () {
      ({ clToken, minter, user } = await loadFixture(deployWithMinterFixture));
    });

    it("Should return correct remaining mintable supply", async function () {
      const maxSupply = await clToken.MAX_SUPPLY();
      expect(await clToken.remainingMintableSupply()).to.equal(maxSupply);
    });

    it("Should update remaining supply after minting", async function () {
      const maxSupply = await clToken.MAX_SUPPLY();
      const mintAmount = ethers.parseEther("1000");
      
      await clToken.connect(minter).mint(user.address, mintAmount);
      
      expect(await clToken.remainingMintableSupply()).to.equal(maxSupply - mintAmount);
    });

    it("Should return zero remaining supply when max reached", async function () {
      const maxSupply = await clToken.MAX_SUPPLY();
      
      await clToken.connect(minter).mint(user.address, maxSupply);
      
      expect(await clToken.remainingMintableSupply()).to.equal(0);
    });

    it("Should return correct holder percentage", async function () {
      const totalAmount = ethers.parseEther("10000");
      const userAmount = ethers.parseEther("2500"); // 25%
      
      await clToken.connect(minter).mint(user.address, userAmount);
      await clToken.connect(minter).mint(minter.address, totalAmount - userAmount);
      
      expect(await clToken.getHolderPercentage(user.address)).to.equal(2500); // 25% in basis points
    });

    it("Should return zero percentage when no tokens exist", async function () {
      expect(await clToken.getHolderPercentage(user.address)).to.equal(0);
    });

    it("Should return zero percentage when user has no tokens", async function () {
      await clToken.connect(minter).mint(minter.address, ethers.parseEther("1000"));
      
      expect(await clToken.getHolderPercentage(user.address)).to.equal(0);
    });

    it("Should return 100% when user holds all tokens", async function () {
      await clToken.connect(minter).mint(user.address, ethers.parseEther("1000"));
      
      expect(await clToken.getHolderPercentage(user.address)).to.equal(10000); // 100% in basis points
    });
  });

  // ========== STANDARD ERC20 TESTS ==========
  
  describe("Standard ERC20 Functions", function () {
    let clToken, minter, user, nonMinter;

    beforeEach(async function () {
      ({ clToken, minter, user, nonMinter } = await loadFixture(deployWithMinterFixture));
      
      // Mint some tokens for testing
      await clToken.connect(minter).mint(user.address, ethers.parseEther("1000"));
    });

    it("Should allow token transfers", async function () {
      const amount = ethers.parseEther("100");
      
      await expect(clToken.connect(user).transfer(nonMinter.address, amount))
        .to.emit(clToken, "Transfer")
        .withArgs(user.address, nonMinter.address, amount);
    });

    it("Should update balances after transfer", async function () {
      const amount = ethers.parseEther("100");
      
      await clToken.connect(user).transfer(nonMinter.address, amount);
      
      expect(await clToken.balanceOf(user.address)).to.equal(ethers.parseEther("900"));
      expect(await clToken.balanceOf(nonMinter.address)).to.equal(amount);
    });

    it("Should allow approvals", async function () {
      const amount = ethers.parseEther("100");
      
      await expect(clToken.connect(user).approve(nonMinter.address, amount))
        .to.emit(clToken, "Approval")
        .withArgs(user.address, nonMinter.address, amount);
    });

    it("Should allow transferFrom with approval", async function () {
      const amount = ethers.parseEther("100");
      
      await clToken.connect(user).approve(nonMinter.address, amount);
      
      await expect(clToken.connect(nonMinter).transferFrom(user.address, nonMinter.address, amount))
        .to.emit(clToken, "Transfer")
        .withArgs(user.address, nonMinter.address, amount);
    });
  });
});