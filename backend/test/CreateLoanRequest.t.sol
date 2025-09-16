//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {BaseTest} from "./Base.t.sol";
import {IChainLend} from "../src/interfaces/IChainLend.sol";
import {ChainLend} from "../src/ChainLend.sol";

contract CreateLoanRequest is BaseTest {

  // ========= EVENTS ===========

    event LoanRequestCreated(
          uint256 indexed requestId, 
          address indexed borrower,
          uint256 amountRequested,
          uint256 requiredCollateral,
          uint256 interestRate,
          uint256 duration
      );

    event CollateralDeposited(
          uint256 indexed requestId, 
          address indexed borrower, 
          uint256 amount, 
          uint256 totalDeposited
      );
    
    event CLRewardsEarned(address indexed user, uint256 amount, string action);

    // LOAN REQUEST CREATION 

    function test_CreateLoanRequestSuccesfully() external {
      vm.prank(borrower);
      uint256 amountRequested = 1000 * 1e6;
      uint32 interestRate = 500;
      uint64 duration = 365 * 24 * 60 * 60;
      uint256 requiredCollateral = chainLend.calculateRequiredCollateral(amountRequested);

      chainLend.createLoanRequest{value: requiredCollateral }(amountRequested, interestRate, duration);
    }

    function test_StoreLoanRequestDataCorrectly() public {
      uint256 amountRequested = 1000 * 1e6;
      uint32 interestRate = 500;
      uint64 duration = 365 * 24 * 60 * 60;
      uint256 requiredCollateral = chainLend.calculateRequiredCollateral(amountRequested);
      vm.prank(borrower);
      chainLend.createLoanRequest{value: requiredCollateral }(amountRequested, interestRate, duration);
      
      IChainLend.LoanRequest memory loanRequest = chainLend.getLoanRequest(1);
      assertEq(loanRequest.id, 1);
      assertEq(loanRequest.amountRequested, 1000 * 1e6);
      assertEq(loanRequest.requiredCollateral, requiredCollateral);
      assertEq(loanRequest.actualCollateralDeposited, requiredCollateral);
      assertEq(loanRequest.createdAt, block.timestamp);
      assertEq(loanRequest.borrower, borrower);
      assertEq(loanRequest.duration, 365 * 24 * 60 * 60);
      assertEq(loanRequest.interestRate, 500);
      assertEq(uint256(loanRequest.status), uint256(IChainLend.RequestStatus.Pending));
    }

    function test_EmitLoanRequestCreatedEvent() public {
      
      uint256 amountRequested = 1000 * 1e6;
      uint32 interestRate = 500;
      uint64 duration = 365 * 24 * 60 * 60;
      uint256 requiredCollateral = chainLend.calculateRequiredCollateral(amountRequested);
      vm.prank(borrower);

      vm.expectEmit(true, true, false, true);
      emit LoanRequestCreated(
        1, 
        borrower, 
        amountRequested, 
        requiredCollateral, 
        interestRate, 
        duration
        );

      chainLend.createLoanRequest{value: requiredCollateral }(amountRequested, interestRate, duration);

    }

    function test_EmitCollateralDepositedEvent() public {
      uint256 amountRequested = 1000 * 1e6;
      uint32 interestRate = 500;
      uint64 duration = 365 * 24 * 60 * 60;
      uint256 requiredCollateral = chainLend.calculateRequiredCollateral(amountRequested);
      vm.prank(borrower);

      vm.expectEmit(true, true, false, true);
      emit CollateralDeposited(
        1, 
        borrower, 
        requiredCollateral, 
        requiredCollateral
        );

      chainLend.createLoanRequest{value: requiredCollateral}(amountRequested, interestRate, duration);
    }

    function test_EmitCLRewardsEarnedEvent() public {
      uint256 amountRequested = 1000 * 1e6;
      uint32 interestRate = 500;
      uint64 duration = 365 * 24 * 60 * 60;
      uint256 requiredCollateral = chainLend.calculateRequiredCollateral(amountRequested);
      

      vm.expectEmit(true, false, false, true);
      emit CLRewardsEarned( 
        borrower, 
        chainLend.REWARD_CREATE_REQUEST(), 
        "Create Request"
        );

      vm.prank(borrower);
      chainLend.createLoanRequest{value: requiredCollateral}(amountRequested, interestRate, duration);
    }

    function test_IncrementNextRequestID() public {
      uint256 amountRequested = 1000 * 1e6;
      uint32 interestRate = 500;
      uint64 duration = 365 * 24 * 60 * 60;
      uint256 requiredCollateral = chainLend.calculateRequiredCollateral(amountRequested);
      
      uint256 nextIdBefore = chainLend.nextRequestId();
      assertEq(nextIdBefore, 1);
      vm.prank(borrower);

      chainLend.createLoanRequest{value: requiredCollateral}(amountRequested, interestRate, duration);

      uint256 nextIdAfter = chainLend.nextRequestId();
      assertEq(nextIdAfter, nextIdBefore + 1);
      
      }

    function test_IncrementTotalActiveRequests() public {
      uint256 amountRequested = 1000 * 1e6;
      uint32 interestRate = 500;
      uint64 duration = 365 * 24 * 60 * 60;
      uint256 requiredCollateral = chainLend.calculateRequiredCollateral(amountRequested);
      
      uint256 totalActiveRequestsBefore = chainLend.totalActiveRequests();
      assertEq(totalActiveRequestsBefore, 0);
      vm.prank(borrower);

      chainLend.createLoanRequest{value: requiredCollateral}(amountRequested, interestRate, duration);

      uint256 totalActiveRequestsAfter = chainLend.totalActiveRequests();
      assertEq(totalActiveRequestsAfter, totalActiveRequestsBefore + 1);
     
    }

    function test_UpdateUserRequestCount() public {
      uint256 amountRequested = 1000 * 1e6;
      uint32 interestRate = 500;
      uint64 duration = 365 * 24 * 60 * 60;
      uint256 requiredCollateral = chainLend.calculateRequiredCollateral(amountRequested);
      
      uint256 userRequestCountBefore = chainLend.userRequestCount(borrower);
      assertEq(userRequestCountBefore, 0);
      vm.prank(borrower);

      chainLend.createLoanRequest{value: requiredCollateral}(amountRequested, interestRate, duration);
      
      uint256 userRequestCountAfter = chainLend.userRequestCount(borrower);
      assertEq(userRequestCountAfter, userRequestCountBefore + 1);
     
    }

    function test_AddUserRequestToRequestList() public {    
      uint256 amountRequested = 1000 * 1e6;
      uint32 interestRate = 500;
      uint64 duration = 365 * 24 * 60 * 60;
      uint256 requiredCollateral = chainLend.calculateRequiredCollateral(amountRequested);

      vm.prank(borrower);

      chainLend.createLoanRequest{value: requiredCollateral}(amountRequested, interestRate, duration);
      uint256[] memory userRequests = chainLend.getUserRequests(borrower);
      assertGt(userRequests.length, 0);
      assertEq(userRequests[0], 1);
    }

    function test_AccumulateCLRewards() public {
      uint256 amountRequested = 1000 * 1e6;
      uint32 interestRate = 500;
      uint64 duration = 365 * 24 * 60 * 60;
      uint256 requiredCollateral = chainLend.calculateRequiredCollateral(amountRequested);

      vm.prank(borrower);
      chainLend.createLoanRequest{value: requiredCollateral}(amountRequested, interestRate, duration);

      uint256 clBalance = chainLend.pendingCLRewards(borrower);
      assertEq(clBalance, 10 * 1e18);
    }

    function test_AllowExcessCollateralDeposit() public {
      uint256 amountRequested = 1000 * 1e6;
      uint32 interestRate = 500;
      uint64 duration = 365 * 24 * 60 * 60;
      uint256 requiredCollateral = chainLend.calculateRequiredCollateral(amountRequested);
      uint256 excessCollateral = 1 ether;

      vm.prank(borrower);
      chainLend.createLoanRequest{value: requiredCollateral + excessCollateral}(amountRequested, interestRate, duration);
      
      IChainLend.LoanRequest memory request = chainLend.getLoanRequest(1);
      assertEq(request.actualCollateralDeposited, requiredCollateral + excessCollateral);
    }

    function test_CreateMultipleRequestsFromSameBorrower() public {
      uint256 amountRequested = 1000 * 1e6;
      uint32 interestRate = 500;
      uint64 duration = 365 * 24 * 60 * 60;
      uint256 requiredCollateral = chainLend.calculateRequiredCollateral(amountRequested);

      vm.prank(borrower);
      chainLend.createLoanRequest{value: requiredCollateral}(amountRequested, interestRate, duration);
      
      vm.prank(borrower);
      chainLend.createLoanRequest{value: requiredCollateral}(amountRequested, interestRate, duration);
      
      uint256 userRequestsCount = chainLend.userRequestCount(borrower);
      assertEq(userRequestsCount, 2);

      uint256 requestId = chainLend.nextRequestId();
      assertEq(requestId, 3);

      uint256 totalActiveRequest = chainLend.totalActiveRequests();
      assertEq(totalActiveRequest, 2);
    }

    function test_RevertWhen_AmountRequestedIsZero() public {
      uint256 amountRequested = 0;
      uint32 interestRate = 500;
      uint64 duration = 365 * 24 * 60 * 60;
      uint256 requiredCollateral = 1 ether;

      vm.prank(borrower);
      vm.expectRevert(IChainLend.ZeroAmount.selector);
      chainLend.createLoanRequest{value: requiredCollateral}(amountRequested, interestRate, duration);
    }

    function test_RevertWhen_ZeroCollateral() public {
      uint256 amountRequested = 1000 * 1e6;
      uint32 interestRate = 500;
      uint64 duration = 365 * 24 * 60 * 60;
      uint256 requiredCollateral = 0 ether;

      vm.prank(borrower);
      vm.expectRevert(IChainLend.ZeroAmount.selector);
      chainLend.createLoanRequest{value: requiredCollateral}(amountRequested, interestRate, duration);
    }

    function test_RevertWhen_AmountExceedsMaximum() public {
      uint256 amountRequested = (500000 * 1e6) + 1;
      uint32 interestRate = 500;
      uint64 duration = 365 * 24 * 60 * 60;
      uint256 requiredCollateral = 10 ether;

      vm.prank(borrower);
      vm.expectRevert(abi.encodeWithSelector(
        IChainLend.InvalidAmount.selector,
        amountRequested, 
        chainLend.MAX_LOAN_AMOUNT()
      ));
      chainLend.createLoanRequest{value: requiredCollateral}(amountRequested, interestRate, duration);
    }

    function test_RevertWhen_InterestRateBelowMinimum() public {
      uint256 amountRequested = 500000 * 1e6;
      uint32 interestRate = 400;
      uint64 duration = 365 * 24 * 60 * 60;
      uint256 requiredCollateral = 10 ether;

      vm.prank(borrower);
      vm.expectRevert(abi.encodeWithSelector(
        IChainLend.InvalidParameter.selector,
        "interestRate",
        interestRate
        ));
      chainLend.createLoanRequest{value : requiredCollateral}(amountRequested, interestRate, duration);
    }

    function test_RevertWhen_InterestRateAboveMaximum() public {
      uint256 amountRequested = 500000 * 1e6;
      uint32 interestRate = 1600;
      uint64 duration = 365 * 24 * 60 * 60;
      uint256 requiredCollateral = 10 ether;

      vm.prank(borrower);
      vm.expectRevert(abi.encodeWithSelector(
        IChainLend.InvalidParameter.selector,
        "interestRate",
        interestRate
        ));
      chainLend.createLoanRequest{value : requiredCollateral}(amountRequested, interestRate, duration);
    }

    function test_RevertWhen_DurationAboveMaximum() public {
      uint256 amountRequested = 500000 * 1e6;
      uint32 interestRate = 500;
      uint64 duration = 1460 * 24 * 60 * 60;
      uint256 requiredCollateral = 10 ether;

      vm.prank(borrower);
      vm.expectRevert(abi.encodeWithSelector(
        IChainLend.InvalidParameter.selector,
        "duration",
        duration
        ));
      chainLend.createLoanRequest{value : requiredCollateral}(amountRequested, interestRate, duration);
    }

    function test_RevertWhen_InsufficientCollateral() public {
      uint256 amountRequested = 1000 * 1e6;
      uint32 interestRate = 500;
      uint64 duration = 365 * 24 * 60 * 60;
      uint256 requiredCollateral = chainLend.calculateRequiredCollateral(amountRequested);
      uint256 insufficientValue = requiredCollateral * 99 / 100;

      vm.prank(borrower);
      vm.expectRevert(abi.encodeWithSelector(
        IChainLend.InsufficientCollateral.selector,
        insufficientValue,
        requiredCollateral
        ));
        
      chainLend.createLoanRequest{value : insufficientValue}(amountRequested, interestRate, duration);
    }

    function test_AcceptMaximimValidParameters() public {
      uint256 amountRequested = chainLend.MAX_LOAN_AMOUNT();
      uint32 interestRate = uint32(chainLend.MAX_INTEREST_RATE());
      uint64 duration = uint64(chainLend.MAX_LOAN_DURATION());
      uint256 requiredCollateral = chainLend.calculateRequiredCollateral(amountRequested);

      vm.prank(borrower);
      chainLend.createLoanRequest{value : requiredCollateral}(amountRequested, interestRate, duration);
    }
}