const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Simple Fork Test", function () {
  
  it("Should connect to Base fork", async function () {
    // Test basique de connexion
    const network = await ethers.provider.getNetwork();
    console.log("Network:", network);
    
    const blockNumber = await ethers.provider.getBlockNumber();
    console.log("Block:", blockNumber);
    
    expect(blockNumber).to.be.gt(30000000);
  });

  it("Should access USDC contract", async function () {
    const usdc = await ethers.getContractAt([
      "function symbol() view returns (string)",
      "function balanceOf(address) view returns (uint256)"
    ], "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
    
    const symbol = await usdc.symbol();
    expect(symbol).to.equal("USDC");
  });

  it("Should create basic signers", async function () {
    try {
      const signers = await ethers.getSigners();
      console.log("Signers length:", signers.length);
      console.log("First signer:", signers[0]?.address);
      
      expect(signers.length).to.be.gt(0);
      expect(signers[0]).to.not.be.undefined;
    } catch (error) {
      console.log("Error getting signers:", error.message);
      throw error;
    }
  });
});