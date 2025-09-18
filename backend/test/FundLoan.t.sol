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

    function test_AccumulateCLRewardForLender() public {
      
      uint256 clBalanceBefore = chainLend.pendingCLRewards(lender);

      vm.prank(lender);
      chainLend.fundLoan(requestId);

      assertEq(chainLend.pendingCLRewards(lender), (clBalanceBefore + (chainLend.REWARD_FUND_LOAN())));
    }

    function test_RevertWhen_BorrowerTriesToFoundOwnRequest() public {
      vm.prank(borrower);
      vm.expectRevert(abi.encodeWithSelector(
        IChainLend.InvalidRequest.selector,
        requestId,
        "Cannot fund own request"
        ));
      chainLend.fundLoan(requestId);
    }

    function test_RevertWhen_FundingNonExistentLoan() public {
      vm.prank(lender);
      vm.expectRevert(abi.encodeWithSelector(
        IChainLend.InvalidRequest.selector,
        999,
        "Invalid ID range"
        ));
      chainLend.fundLoan(999);
    }

    function test_RevertWhen_FundingAlreadyFundLoan() public {

      vm.prank(lender);
      chainLend.fundLoan(requestId);

      vm.expectRevert(abi.encodeWithSelector(
        IChainLend.InvalidRequestStatus.selector,
        requestId,
        IChainLend.RequestStatus.Funded,
        IChainLend.RequestStatus.Pending      
        ));
      vm.prank(lender);
      chainLend.fundLoan(requestId);
    }

    function test_RevertWhen_FundingCancelledLoan() public {

      vm.prank(borrower);
      chainLend.cancelLoanRequest(requestId);

      vm.expectRevert(abi.encodeWithSelector(
        IChainLend.InvalidRequestStatus.selector,
        requestId,
        IChainLend.RequestStatus.Cancelled,
        IChainLend.RequestStatus.Pending      
        ));
      vm.prank(lender);
      chainLend.fundLoan(requestId);
    }

    function test_RevertWhen_LenderHasInsufficientUSDCBalance() public {
      
      address poorLender = makeAddr("poorLender");
      deal(address(usdcToken), poorLender, 100e6, true);

      vm.prank(poorLender);
      usdcToken.approve(address(chainLend), type(uint256).max);

      vm.expectRevert();
      vm.prank(poorLender);
      chainLend.fundLoan(requestId);
    }

    function test_RevertWhen_LenderHasInsufficientUSDCAllowance() public {
      
      address poorLender = makeAddr("poorLender");
      deal(address(usdcToken), poorLender, 1000e6, true);

      vm.prank(poorLender);
      usdcToken.approve(address(chainLend), 100e6);

      vm.expectRevert();
      vm.prank(poorLender);
      chainLend.fundLoan(requestId);
    }

    function test_RevertWhen_InvalidRequestID() public {
    vm.expectRevert(abi.encodeWithSelector(
        IChainLend.InvalidRequest.selector,
        0,
        "Invalid ID range"
    ));
    vm.prank(lender);
    chainLend.fundLoan(0);
}

    function test_HandleMinimumInterestRateAndDuration() public {
        
        uint32 minInterestRate = uint32(chainLend.MIN_INTEREST_RATE());
        uint64 minDuration = uint64(chainLend.MIN_LOAN_DURATION());
        uint256 collateralNeeded = chainLend.calculateRequiredCollateral(requestedAmount);

        vm.prank(borrower);
        chainLend.createLoanRequest{value: collateralNeeded}(
            requestedAmount,
            minInterestRate,
            minDuration
        );

        vm.prank(lender);
        chainLend.fundLoan(2);

        IChainLend.ActiveLoan memory activeLoan = chainLend.getActiveLoan(2);
        assertGt(activeLoan.interestAmount, 0);
    }

    function test_HandleMaximumInterestRateAndDuration() public {
        
        uint256 collateralNeeded = chainLend.calculateRequiredCollateral(requestedAmount);

        vm.deal(borrower, borrower.balance + collateralNeeded);
        vm.prank(borrower);
        chainLend.createLoanRequest{value: collateralNeeded}(
            requestedAmount,
            uint32(chainLend.MAX_INTEREST_RATE()),
            uint64(chainLend.MAX_LOAN_DURATION())
        );

        vm.prank(lender);
        chainLend.fundLoan(2);

        IChainLend.ActiveLoan memory activeLoan = chainLend.getActiveLoan(2);
        assertGt(activeLoan.interestAmount, 0);
        assertGt(activeLoan.totalAmountDue, requestedAmount);
    }

}