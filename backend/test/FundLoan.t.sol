// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {BaseTest} from "./Base.t.sol";
import {ChainLend} from "../src/ChainLend.sol";
import {IChainLend} from "../src/interfaces/IChainLend.sol";
import {console} from "forge-std/console.sol";

contract FundLoanTest is BaseTest {

    uint256 public requestedAmount;
    uint32 public interestRate;
    uint64 public duration;
    uint256 public requiredCollateral;
    uint256 public requestId;

    function setUp() public override {
      super.setUp();
      //fixtures

      requestedAmount = 1000 * 1e6;
      interestRate = 500;
      duration = 365 * 24 * 60 * 60;
      requiredCollateral = chainLend.calculateRequiredCollateral(requestedAmount);
      requestId = 1;

      vm.prank(borrower);
      chainLend.createLoanRequest{value : requiredCollateral}(requestedAmount, interestRate, duration);
    }

    function test_SetupWorkingForFundLoanFunction() public {

      IChainLend.LoanRequest memory loanRequest = chainLend.getLoanRequest(1);
      assertEq(loanRequest.id, requestId);
      assertEq(loanRequest.amountRequested, requestedAmount);
      assertEq(loanRequest.requiredCollateral, requiredCollateral);
      assertEq(loanRequest.actualCollateralDeposited, requiredCollateral);
      assertEq(loanRequest.createdAt, block.timestamp);
      assertEq(loanRequest.borrower, borrower);
      assertEq(loanRequest.duration, duration);
      assertEq(loanRequest.interestRate, interestRate);
      assertEq(uint256(loanRequest.status), uint256(IChainLend.RequestStatus.Pending));
    }

    function test_FundLoanSuccessfully() public {
      vm.prank(lender);
      chainLend.fundLoan(requestId);

      IChainLend.ActiveLoan memory activeLoan = chainLend.getActiveLoan(requestId);
      assertEq(activeLoan.requestId, requestId);
      assertEq(uint256(activeLoan.status) , uint256(IChainLend.LoanStatus.Active)); 
      assertEq(activeLoan.lender, lender);
      assertEq(activeLoan.principalAmount, requestedAmount);
    }
}