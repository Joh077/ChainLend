// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {ChainLend} from "../src/ChainLend.sol";
import {CLToken} from "../src/CLToken.sol";

contract DeployScript is Script {
    // Same addresses as Hardhat deployment
    address constant USDC_BASE = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant ETH_USD_FEED = 0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70;
    address constant USDC_USD_FEED = 0x7e860098F58bBFC8648a4311b374B1D669a2bc6B;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY_BASE");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying with account:", deployer);
        console.log("Account balance:", deployer.balance);
        
        vm.startBroadcast(deployerPrivateKey);
        
        
        // Deploy CLToken (exactly like your Hardhat script)
        CLToken clToken = new CLToken(deployer);
        
        // Deploy ChainLend (exactly like your Hardhat script)
        ChainLend chainLend = new ChainLend(
            USDC_BASE,      // USDC token address
            ETH_USD_FEED,   // ETH/USD price feed
            deployer,       // Treasury address (same as deployer)
            USDC_USD_FEED,  // USDC/USD price feed
            address(clToken), // CL token address
            deployer        // Initial owner (same as deployer)
        );
        
        // Add ChainLend as minter
        clToken.addMinter(address(chainLend));
        
        vm.stopBroadcast();
        
        // Log addresses for verification
        console.log("=== DEPLOYED CONTRACTS ===");
        console.log("CLToken:", address(clToken));
        console.log("ChainLend:", address(chainLend));
        console.log("=== CONFIGURATION ===");
        console.log("USDC:", USDC_BASE);
        console.log("ETH Feed:", ETH_USD_FEED);
        console.log("USDC Feed:", USDC_USD_FEED);
        console.log("Treasury:", deployer);
        console.log("Owner:", deployer);
    }
}