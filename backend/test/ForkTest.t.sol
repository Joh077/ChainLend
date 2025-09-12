// test/ForkTest.t.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";

contract ForkTest is Test {
    function test_ForkConnection() public {
        console.log("=== BEFORE FORK ===");
        console.log("Chain ID:", block.chainid);
        console.log("Block number:", block.number);
        
        // Test de la variable d'environnement
        string memory apiKey = vm.envOr("INFURA_API_KEY", string("NOT_FOUND"));
        console.log("API Key loaded:", bytes(apiKey).length > 0);
        console.log("API Key length:", bytes(apiKey).length);
        
        // Fork manuel
        string memory rpcUrl;
        if (bytes(apiKey).length > 0 && keccak256(bytes(apiKey)) != keccak256(bytes("NOT_FOUND"))) {
            rpcUrl = string.concat("https://base-mainnet.infura.io/v3/", apiKey);
            console.log("Using Infura URL");
        } else {
            rpcUrl = "https://mainnet.base.org";
            console.log("Using public Base URL");
        }
        
        console.log("Attempting fork...");
        uint256 forkId = vm.createFork(rpcUrl);
        console.log("Fork created with ID:", forkId);
        
        // IMPORTANT: Activer le fork créé
        vm.selectFork(forkId);
        console.log("Fork selected");
        
        console.log("=== AFTER FORK ===");
        console.log("Chain ID:", block.chainid);
        console.log("Block number:", block.number);
        
        // Test simple sans appel de contrat d'abord
        assertTrue(block.chainid == 8453, "Should be on Base mainnet");
        assertGt(block.number, 1000000, "Should be a recent block");
    }
}