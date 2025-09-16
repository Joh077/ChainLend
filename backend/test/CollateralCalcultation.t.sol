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

}