//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {BaseTest} from "./Base.t.sol";
import {IChainLend} from "../src/interfaces/IChainLend.sol";
import {ChainLend} from "../src/ChainLend.sol";
import {console} from "forge-std/console.sol";

contract CollateralCalculationTest is BaseTest {

  function test_CalculateCorrectCollateralForStandardLoanAmount() public view {
      uint256 amountRequested = 4600 * 1e6;
      uint256 requiredCollateral = chainLend.calculateRequiredCollateral(amountRequested);

      assertGt(requiredCollateral, 1.5 ether);  
  }

  function test_HandleMinimumLoanAmountCalculations() public view {
    uint256 amountRequested = 1 * 1e6;
    uint256 requiredCollateral = chainLend.calculateRequiredCollateral(amountRequested);

    assertGt(requiredCollateral, 0);
  }

  function test_HandleMaximumLoanAmountCalculations() public view {
    uint256 amountRequested = 500000 * 1e6;
    uint256 requiredCollateral = chainLend.calculateRequiredCollateral(amountRequested);

    (, int256 ethPrice,  ,  , ) = chainLend.ethPriceFeed().latestRoundData();
    (, int256 usdcPrice,  ,  , ) = chainLend.usdcPriceFeed().latestRoundData();

    uint256 expectedMin = (amountRequested * 15000 * uint256(usdcPrice)) / (10000 * uint256(ethPrice)) * 1e12; // approximately 166,1 ETH
    uint256 expectedMax = expectedMin * 101 / 100; // + 1% margin
    
    assertGe(requiredCollateral, expectedMin);
    assertLe(requiredCollateral, expectedMax); 
  }

  function test_CalculateDifferentsAmountForDifferentEthPrices() public {
    uint256 amountRequested = 500000 * 1e6;
    uint256 requiredCollateral = chainLend.calculateRequiredCollateral(amountRequested);

    // Retrieve current data for the mock
    (, int256 currentEthPrice, , uint256 updatedAt, ) = chainLend.ethPriceFeed().latestRoundData();

    // Mock with a higher ETH price (+$1000)
    int256 newEthPrice = currentEthPrice + 1000 * 1e8;

    vm.mockCall(
        address(chainLend.ethPriceFeed()),
        abi.encodeWithSignature("latestRoundData()"),
        abi.encode(0, newEthPrice, 0, updatedAt, 0) // All required settings
    );
    
    uint256 newCollateral = chainLend.calculateRequiredCollateral(amountRequested); // Same amount for comparison purposes
    
    // Higher ETH price = less ETH collateral required
    assertLt(newCollateral, requiredCollateral);
  }

  function test_CalculateDifferentsAmountsForDifferentUSDCPrice() public {
    uint256 amountRequested = 10000 * 1e6;
    uint256 requiredCollateral = chainLend.calculateRequiredCollateral(amountRequested);

    (, int256 currentUsdcPrice, , uint256 updatedAt , ) = chainLend.usdcPriceFeed().latestRoundData();

    int256 newUsdcPrice = currentUsdcPrice - 10 * 1e6;

    vm.mockCall(
      address(chainLend.usdcPriceFeed()), 
      abi.encodeWithSignature("latestRoundData()"), 
      abi.encode(0, newUsdcPrice, 0, updatedAt, 0)
      );

    uint256 newCollateral = chainLend.calculateRequiredCollateral(amountRequested);

    assertLt(newCollateral, requiredCollateral);

  }

  function test_RevertWhen_NegativeEthPrice() public {
    uint256 requestedAmount = 1000 * 1e6;

    int256 negativeEthPrice = - 1 * 1e8; 

    vm.mockCall(
      address(chainLend.ethPriceFeed()),
      abi.encodeWithSignature("latestRoundData()"),
      abi.encode(0, negativeEthPrice, 0, block.timestamp, 0)
      );
    
    vm.expectRevert(abi.encodeWithSelector(
      IChainLend.InvalidPrice.selector,
      negativeEthPrice
      ));

    chainLend.calculateRequiredCollateral(requestedAmount);
  }

  function test_RevertWhen_ZeroEthPrice() public {
    uint256 requestedAmount = 1000 * 1e6;

    int256 zeroEthPrice = 0; 

    vm.mockCall(
      address(chainLend.ethPriceFeed()),
      abi.encodeWithSignature("latestRoundData()"),
      abi.encode(0, zeroEthPrice, 0, block.timestamp, 0)
      );
    
    vm.expectRevert(abi.encodeWithSelector(
      IChainLend.InvalidPrice.selector,
      zeroEthPrice
      ));

    chainLend.calculateRequiredCollateral(requestedAmount);
  }

  function test_RevertWhen_NegativeUsdcPrice() public {
    uint256 requestedAmount = 1000 * 1e6;

    int256 negativeUsdcPrice = -1 * 1e8; 

    vm.mockCall(
      address(chainLend.usdcPriceFeed()),
      abi.encodeWithSignature("latestRoundData()"),
      abi.encode(0, negativeUsdcPrice, 0, block.timestamp, 0)
      );
    
    vm.expectRevert(abi.encodeWithSelector(
      IChainLend.InvalidPrice.selector,
      negativeUsdcPrice
      ));

    chainLend.calculateRequiredCollateral(requestedAmount);
  }

  function test_RevertWhen_ZeroUsdcPrice() public {
    uint256 requestedAmount = 1000 * 1e6;

    int256 zeroUsdcPrice = 0; 

    vm.mockCall(
      address(chainLend.usdcPriceFeed()),
      abi.encodeWithSignature("latestRoundData()"),
      abi.encode(0, zeroUsdcPrice, 0, block.timestamp, 0)
      );
    
    vm.expectRevert(abi.encodeWithSelector(
      IChainLend.InvalidPrice.selector,
      zeroUsdcPrice
      ));

    chainLend.calculateRequiredCollateral(requestedAmount);
  }

  function test_RevertWhen_EthStalePrice() public {

    uint256 requestedAmount = 1000 * 1e6;
    uint256 staleTimeStamp = block.timestamp - 86500; //more than 1 day old

    (, int256 currentEthPrice, , ,  ) = chainLend.ethPriceFeed().latestRoundData();

    vm.mockCall(
      address(chainLend.ethPriceFeed()),
      abi.encodeWithSignature("latestRoundData()"),
      abi.encode(0, currentEthPrice, 0, staleTimeStamp, 0 )
    );

    vm.expectRevert(abi.encodeWithSelector(
      IChainLend.StalePrice.selector,
      staleTimeStamp,
      chainLend.STALENESS_THRESHOLD()
      ));
    
    chainLend.calculateRequiredCollateral(requestedAmount);
  }

  function test_RevertWhen_UsdcStalePrice() public {

    uint256 requestedAmount = 1000 * 1e6;
    uint256 staleTimeStamp = block.timestamp - 86500; //more than 1 day old

    (, int256 currentUsdcPrice, , ,  ) = chainLend.usdcPriceFeed().latestRoundData();

    vm.mockCall(
      address(chainLend.usdcPriceFeed()),
      abi.encodeWithSignature("latestRoundData()"),
      abi.encode(0, currentUsdcPrice, 0, staleTimeStamp, 0 )
    );

    vm.expectRevert(abi.encodeWithSelector(
      IChainLend.StalePrice.selector,
      staleTimeStamp,
      chainLend.STALENESS_THRESHOLD()
      ));
    
    chainLend.calculateRequiredCollateral(requestedAmount);
  }

  function test_RevertWhen_ZeroLoanAmount() public {
      uint256 amountRequested = 0;

      vm.expectRevert(IChainLend.ZeroAmount.selector); 
      chainLend.calculateRequiredCollateral(amountRequested);
  }

  function test_RevertWhen_LoanAmountExceedsMaximum() public {
    uint256 amountRequested = (600000 * 1e6); 

    vm.expectRevert(abi.encodeWithSelector(
      IChainLend.InvalidAmount.selector,
      amountRequested,
      chainLend.MAX_LOAN_AMOUNT()
     ));

   chainLend.calculateRequiredCollateral(amountRequested);
  }

  function test_HandleVerySmallLoanAmounts() public {
    uint256 requestedAmount = 1e4;

    uint256 requiredCollateral = chainLend.calculateRequiredCollateral(requestedAmount);

    assertGt(requiredCollateral, 0);
  }

  function test_HandleCalculationsWithVariousEthPriceLevels() public {
    uint256 requestedAmount = 1000 * 1e6;
    uint256[6] memory prices = [
      uint256(100e8), 
      uint256(500e8), 
      uint256(1000e8), 
      uint256(2000e8),
      uint256(5000e8),
      uint256(10000e8)
      ];

    for (uint256 i = 0; i < prices.length; i++ ) {
      vm.mockCall(
        address(chainLend.ethPriceFeed()),
        abi.encodeWithSignature("latestRoundData()"),
        abi.encode(0, int256(prices[i]), 0, block.timestamp, 0)
        );

        uint256 requiredCollateral = chainLend.calculateRequiredCollateral(requestedAmount);
        assertGt(requiredCollateral, 0);
    }
  }

  function test_MaintainPrecisionInCalculations() public {
      uint256 amountRequired = 999999999; 
      uint256 requiredCollateral = chainLend.calculateRequiredCollateral(amountRequired);

      assertGt(requiredCollateral, 0);
  }

}