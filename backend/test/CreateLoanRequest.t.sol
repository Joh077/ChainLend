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

}