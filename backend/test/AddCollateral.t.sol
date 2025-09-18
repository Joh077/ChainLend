// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {BaseTest} from "./Base.t.sol";
import {console} from "forge-std/console.sol";
import {ChainLend} from "../src/ChainLend.sol";
import {IChainLend} from "../src/interfaces/IChainLend.sol";

contract AddCollateralTest is BaseTest {

    event CollateralAdded(
        uint256 indexed requestId,
        address indexed borrower,
        uint256 amountAdded,
        uint256 newTotalCollateral,
        uint256 newHealthFactor
    );

    uint256 public requestedAmount;
    uint32 public interestRate;
    uint64 public duration;
    uint256 public requiredCollateral;
    uint256 public requestId;

    function setUp() public override {
      super.setUp(); 

      //Fixtures

      requestedAmount = 1000e6;
      interestRate = 1000;
      duration = 365 * 24 * 60 * 60;
      requiredCollateral = chainLend.calculateRequiredCollateral(requestedAmount);
      requestId = 1;

      vm.prank(borrower);
      chainLend.createLoanRequest{value: requiredCollateral}(requestedAmount, interestRate, duration);

      vm.prank(lender);
      chainLend.fundLoan(requestId);
    }

    function test_AddCollateralSuccessfully() public {
      
      uint256 collateralBalanceBefore = chainLend.getLoanRequest(requestId).actualCollateralDeposited;
      vm.prank(borrower);
      chainLend.addCollateral{value : 1 ether}(requestId);

      uint256 collateralBalanceAfter = chainLend.getLoanRequest(requestId).actualCollateralDeposited;

      assertEq(collateralBalanceAfter, collateralBalanceBefore + 1 ether);
    }

    function test_AddCollateralIncreasesHealthFactor() public {

      uint256 healthBefore = chainLend.getHealthFactor(requestId);
      
      vm.prank(borrower);
      chainLend.addCollateral{value: 1 ether}(requestId);
      
      uint256 healthAfter = chainLend.getHealthFactor(requestId);
      assertGt(healthAfter, healthBefore);
  }

  function test_EmitCollateralAddedEvent() public {
      
      vm.expectEmit(true, true, false, false);
      emit CollateralAdded(requestId, borrower, 0, 0, 0);
      
      vm.prank(borrower);
      chainLend.addCollateral{value: 1 ether}(requestId);
  }

  function test_UpdateBalanceOfBorrower() public {

    uint256 borrowerBalanceBefore = borrower.balance;

    vm.prank(borrower);
    chainLend.addCollateral{value : 2 ether}(requestId);

    uint256 borrowerBalanceAfter = borrower.balance;

    assertEq(borrowerBalanceAfter, borrowerBalanceBefore - 2 ether );

  }

  function test_TransfersETHToContract() public {

    uint256 contractBalanceBefore = address(chainLend).balance;

    vm.prank(borrower);
    chainLend.addCollateral{value : 2 ether}(requestId);

    uint256 contractBalanceAfter = address(chainLend).balance;

    assertEq(contractBalanceAfter, contractBalanceBefore + 2 ether );

  }

  function test_RevertWhen_ZeroAmount() public {

    vm.expectRevert(IChainLend.ZeroAmount.selector);

    vm.prank(borrower);
    chainLend.addCollateral{value : 0}(requestId);
  }

  function test_RevertWhen_Unauthorized() public {

    vm.deal(lender, 10 ether);

    vm.expectRevert(abi.encodeWithSelector(
      IChainLend.Unauthorized.selector,
      lender
      ));

    vm.prank(lender);
    chainLend.addCollateral{value : 1 ether}(requestId);
  }

  function test_RevertWhen_InvalidIdRange() public {
    
    vm.expectRevert(abi.encodeWithSelector(
      IChainLend.InvalidLoan.selector,
      99,
      "Invalid ID range"
      ));

     vm.prank(borrower);
     chainLend.addCollateral{value: 1 ether}(99);
  }

  function test_RevertWhen_LoanNotFound() public {

    vm.prank(borrower);
    chainLend.createLoanRequest{value: requiredCollateral}(
        500e6,  
        800,      
        30 days 
    );

    vm.expectRevert(abi.encodeWithSelector(
        IChainLend.InvalidLoan.selector,
        2, 
        "Loan not found"
    ));
    
    vm.prank(borrower);
    chainLend.addCollateral{value: 1 ether}(2);
}

  function test_RevertWhen_LoanNotActive() public {

    vm.prank(borrower);
    chainLend.repayLoan(requestId);

    vm.expectRevert(abi.encodeWithSelector(
      IChainLend.InvalidLoan.selector,
      requestId,
      "Loan not active"
      ));

    vm.prank(borrower);
    chainLend.addCollateral{value: 3 ether}(requestId);
  }
}