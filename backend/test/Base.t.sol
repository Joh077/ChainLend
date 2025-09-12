// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";

import {ChainLend} from "../src/ChainLend.sol";
import {CLToken} from "../src/CLToken.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IChainlinkPriceFeed} from "../src/interfaces/IChainlinkPriceFeed.sol";

contract BaseTest is Test {
    // ========== ADRESSES BASE MAINNET ==========
    address constant USDC_BASE = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant ETH_USD_FEED = 0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70;
    address constant USDC_USD_FEED = 0x7e860098F58bBFC8648a4311b374B1D669a2bc6B;

    // ========== CONTRATS ==========
    ChainLend public chainLend;
    CLToken public clToken;
    IERC20 public usdcToken;
    IChainlinkPriceFeed public ethPriceFeed;
    IChainlinkPriceFeed public usdcPriceFeed;

    // ========== USERS ==========
    address public owner;
    address public borrower;
    address public lender;
    address public liquidator;
    address public treasury;

    function setUp() public virtual {
        //console.log("=== BASE TEST SETUP START ===");
        
        // Setup fork Base - MÊME LOGIQUE QUE ForkTest qui fonctionne
        _setupBaseFork();
        
        // Create users
        owner = makeAddr("owner");
        borrower = makeAddr("borrower");
        lender = makeAddr("lender");
        liquidator = makeAddr("liquidator");
        treasury = owner;
        
        //console.log("Users created on Chain ID:", block.chainid);

        // Connect to real Base contracts
        usdcToken = IERC20(USDC_BASE);
        ethPriceFeed = IChainlinkPriceFeed(ETH_USD_FEED);
        usdcPriceFeed = IChainlinkPriceFeed(USDC_USD_FEED);
        //console.log("Connected to Base contracts");

        // Deploy contracts as owner
        vm.startPrank(owner);

        //console.log("Deploying CLToken...");
        clToken = new CLToken(owner);

        //console.log("Deploying ChainLend...");
        chainLend = new ChainLend(
            USDC_BASE,      // usdcToken
            ETH_USD_FEED,   // ethPriceFeed
            treasury,       // treasury
            USDC_USD_FEED,  // usdcPriceFeed
            address(clToken), // clToken
            owner           // initialOwner
        );

        //console.log("Adding minter...");
        clToken.addMinter(address(chainLend));

        vm.stopPrank();

        // Deal USDC to users (works with forked state)
        deal(USDC_BASE, lender, 1_000_000e6, true);
        deal(USDC_BASE, borrower, 100_000e6, true);
        //console.log("USDC dealt to users");

        // Setup approvals
        vm.prank(lender);
        usdcToken.approve(address(chainLend), type(uint256).max);

        vm.prank(borrower);
        usdcToken.approve(address(chainLend), type(uint256).max);

        // Give ETH to users
        vm.deal(borrower, 100 ether);
        vm.deal(liquidator, 100 ether);
        
        // Log real prices for verification
        _logRealPrices();
        
        //console.log("=== BASE TEST SETUP END ===");
    }
    
    function _setupBaseFork() internal {
        //console.log("Setting up Base fork...");
        
        // Get API key (same logic as working ForkTest)
        string memory apiKey = vm.envOr("INFURA_API_KEY", string("NOT_FOUND"));
        //console.log("API Key loaded:", bytes(apiKey).length > 0);
        
        // Create RPC URL
        string memory rpcUrl;
        if (bytes(apiKey).length > 0 && keccak256(bytes(apiKey)) != keccak256(bytes("NOT_FOUND"))) {
            rpcUrl = string.concat("https://base-mainnet.infura.io/v3/", apiKey);
            //console.log("Using Infura URL");
        } else {
            rpcUrl = "https://mainnet.base.org";
            //console.log("Using public Base URL");
        }
        
        // Create and select fork (SAME AS WORKING ForkTest)
        //console.log("Creating fork...");
        uint256 forkId = vm.createFork(rpcUrl);
        //console.log("Fork created with ID:", forkId);
        
        vm.selectFork(forkId);
        //console.log("Fork selected - Chain ID:", block.chainid);
        
        // Verify we're on Base
        require(block.chainid == 8453, "Fork failed - not on Base");
        require(USDC_BASE.code.length > 0, "USDC contract not found on Base");
        require(ETH_USD_FEED.code.length > 0, "ETH price feed not found on Base");
        
        //console.log("Base fork setup successful!");
    }

    // ========== HELPER FUNCTIONS ==========
    
    function _createPendingLoan() internal returns (uint256 requestId, uint256 amountRequested, uint256 requiredCollateral) {
        amountRequested = 1000e6; // 1000 USDC
        uint256 interestRate = 1000; // 10%
        uint256 duration = 30 days;
        requiredCollateral = chainLend.calculateRequiredCollateral(amountRequested);

        vm.prank(borrower);
        chainLend.createLoanRequest{value: requiredCollateral}(
            amountRequested, 
            uint32(interestRate), 
            uint64(duration)
        );
        
        return (1, amountRequested, requiredCollateral);
    }

    function _createActiveLoan() internal returns (uint256 requestId) {
        (requestId,,) = _createPendingLoan();
        
        vm.prank(lender);
        chainLend.fundLoan(requestId);
        
        return requestId;
    }

    function _createRepaidLoan() internal returns (uint256 requestId) {
        requestId = _createActiveLoan();
        
        vm.prank(borrower);
        chainLend.repayLoan(requestId);
        
        return requestId;
    }

    // ========== UTILITY FUNCTIONS ==========
    
    function _getLatestPrice(IChainlinkPriceFeed priceFeed) internal view returns (int256) {
        (, int256 price,,,) = priceFeed.latestRoundData();
        return price;
    }

    function _logRealPrices() internal view {
    //console.log("=== REAL BASE PRICES ===");
    
    int256 ethPriceRaw = _getLatestPrice(ethPriceFeed);
    int256 usdcPriceRaw = _getLatestPrice(usdcPriceFeed);
    
    console.log("ETH Price (raw):", uint256(ethPriceRaw));  
    //console.log("ETH Price:", uint256(ethPriceRaw) / 1e8, "USD");
    
    console.log("USDC Price (raw):", uint256(usdcPriceRaw)); 
    //console.log("USDC Price (avec decimales):", uint256(usdcPriceRaw), "/ 1e8");
    
    //console.log("Block number:", block.number);
    //console.log("========================");
}
    // Test simple pour vérifier que le setup fonctionne
    function test_SetupWorking() public view {
        assertEq(chainLend.owner(), owner);
        assertEq(address(chainLend.treasury()), treasury);
        assertGt(usdcToken.balanceOf(lender), 0);
        assertEq(block.chainid, 8453); // Base
        //console.log("Base setup test passed!");
    }
}
