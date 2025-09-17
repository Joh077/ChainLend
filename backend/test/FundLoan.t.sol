// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {BaseTest} from "./Base.t.sol";
import {ChainLend} from "../src/ChainLend.sol";
import {IChainLend} from "../src/interfaces/IChainLend.sol";
import {console} from "forge-std/console.sol";

contract FundLoanTest is BaseTest {

    event LoanFunded(
        uint256 indexed requestId,
        address indexed lender,
        address indexed borrower,
        uint256 amount,
        uint256 dueDate
    );

    event CLRewardsEarned(address indexed user, uint256 amount, string action);


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
      duration = 30 * 24 * 60 * 60;
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

    function test_CalculateInterestCorrectly() public {
      vm.prank(lender);
      chainLend.fundLoan(requestId);

      IChainLend.ActiveLoan memory activeLoan = chainLend.getActiveLoan(requestId);

      uint256 expectedAnnualInterest = requestedAmount * interestRate / 10000;
      uint256 expectedInterest = expectedAnnualInterest * duration / (365 days);

      assertEq(activeLoan.interestAmount, expectedInterest);
      assertEq(activeLoan.totalAmountDue, (requestedAmount + expectedInterest));
    }

    function test_EmitLoanFundedEvent() public {
      vm.prank(lender);
      vm.expectEmit(true, true, true, true);
      emit LoanFunded(
        requestId,
        lender,
        borrower,
        requestedAmount,
        (block.timestamp + duration)
      );
      chainLend.fundLoan(requestId);
    }

    function test_EmitCLRewardEarnedEvent() public {
      vm.expectEmit(true, false, false, true);
      emit CLRewardsEarned(
        lender, 
        chainLend.REWARD_FUND_LOAN(),
        "Fund Loan"
      );
      vm.prank(lender);
      chainLend.fundLoan(requestId);
    }

    function test_TransferUSDCFromLenderToBorrower() public {

      uint256 lenderBalanceBefore = usdcToken.balanceOf(lender);
      uint256 borrowerBalanceBefore = usdcToken.balanceOf(borrower);

      vm.prank(lender);
      chainLend.fundLoan(requestId);

      uint256 lenderBalanceAfter = usdcToken.balanceOf(lender);
      uint256 borrowerBalanceAfter = usdcToken.balanceOf(borrower);

      assertEq((lenderBalanceBefore - lenderBalanceAfter), requestedAmount);
      assertEq((borrowerBalanceAfter - borrowerBalanceBefore), requestedAmount);
    }

    function test_SetTheCorrectDueDate() public {
      
      vm.prank(lender);
      chainLend.fundLoan(requestId);

      IChainLend.ActiveLoan memory activeLoan = chainLend.getActiveLoan(requestId);

      assertEq(activeLoan.dueDate, (activeLoan.fundedAt + uint256(duration)));
    }

    function test_UpdateRequestStatusToFunded() public {
      vm.prank(lender);
      chainLend.fundLoan(requestId);

      IChainLend.LoanRequest memory loanRequest = chainLend.getLoanRequest(requestId);

      assertEq(uint256(loanRequest.status), uint256(IChainLend.RequestStatus.Funded));
    }

    function test_DecrementTotalActiveRequests() public {

      uint256 totalActiveRequestsBefore = chainLend.totalActiveRequests();

      vm.prank(lender);
      chainLend.fundLoan(requestId);

      uint256 totalActiveRequestAfter = chainLend.totalActiveRequests();

      assertLt(totalActiveRequestAfter, totalActiveRequestsBefore);
    }

    function test_IncrementTotalActiveLoan() public {

      uint256 totalActiveLoanBefore = chainLend.totalActiveLoans();

      vm.prank(lender);
      chainLend.fundLoan(requestId);

      uint256 totalActiveLoanAfter = chainLend.totalActiveLoans();

      assertGt(totalActiveLoanAfter, totalActiveLoanBefore);
    }

    function test_UpdateUserLoanCountForLender() public {
      
      uint256 countBefore = chainLend.userLoanCount(lender);

      vm.prank(lender);
      chainLend.fundLoan(requestId);

      assertEq(chainLend.userLoanCount(lender), countBefore + 1);
    }

    function test_AddLoanToLendersLoanList() public {
      vm.prank(lender);
      chainLend.fundLoan(requestId);

      uint256[] memory userLoanList = chainLend.getUserLoans(lender);

      bool found = false; 

      for (uint i=0 ; i<userLoanList.length ; i ++) {
        if(userLoanList[i] == requestId){
          found = true;
          break;
        }
      }

      assertTrue(found, "Request ID not found in lender's loan list");
    }

    
}