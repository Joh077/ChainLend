// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {BaseTest} from "./Base.t.sol";

contract AdminFunctionsTest is BaseTest {
    
    // ========== EVENTS ==========
    event EmergencyWithdrawal(address indexed to, uint256 amount);

    // ========== TREASURY MANAGEMENT TESTS ==========
    
    function test_UpdateTreasuryAddress() public {
        address newTreasury = makeAddr("newTreasury");
        
        vm.prank(owner);
        chainLend.updateTreasury(newTreasury);
        
        assertEq(chainLend.treasury(), newTreasury);
    }

    function test_RevertWhen_NonOwner_UpdatesTreasury() public {
        address nonOwner = makeAddr("nonOwner");
        address newTreasury = makeAddr("newTreasury");
        
        vm.prank(nonOwner);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", nonOwner));
        chainLend.updateTreasury(newTreasury);
    }

    function test_RevertWhen_UpdateTreasury_ZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSignature("ZeroAddress()"));
        chainLend.updateTreasury(address(0));
    }

    function test_UpdateTreasury_SameAddress() public {
        address currentTreasury = chainLend.treasury();
        
        vm.prank(owner);
        chainLend.updateTreasury(currentTreasury);
        
        assertEq(chainLend.treasury(), currentTreasury);
    }

    // ========== EMERGENCY WITHDRAWAL TESTS ==========

    function test_EmergencyWithdrawUSDC() public {
        uint256 amount = 1000e6;
        
        // Add USDC to contract - using deal on forked state
        deal(address(usdcToken), address(chainLend), amount, true);
        
        vm.prank(owner);
        vm.expectEmit(true, false, false, true);
        emit EmergencyWithdrawal(owner, 500e6);  // ✅ Syntaxe corrigée
        chainLend.emergencyWithdrawUSDC(owner, 500e6);
        
        assertEq(usdcToken.balanceOf(owner), 500e6);
    }

    function test_EmergencyWithdraw_TransfersToSpecifiedAddress() public {
        address recipient = makeAddr("recipient");
        uint256 amount = 1000e6;
        uint256 withdrawAmount = 300e6;
        
        // Add USDC to contract
        deal(address(usdcToken), address(chainLend), amount, true);
        
        uint256 recipientBalanceBefore = usdcToken.balanceOf(recipient);
        
        vm.prank(owner);
        chainLend.emergencyWithdrawUSDC(recipient, withdrawAmount);
        
        uint256 recipientBalanceAfter = usdcToken.balanceOf(recipient);
        assertEq(recipientBalanceAfter - recipientBalanceBefore, withdrawAmount);
    }

    function test_EmergencyWithdraw_ReducesContractBalance() public {
        uint256 amount = 1000e6;
        uint256 withdrawAmount = 400e6;
        
        // Add USDC to contract
        deal(address(usdcToken), address(chainLend), amount, true);
        
        uint256 contractBalanceBefore = usdcToken.balanceOf(address(chainLend));
        
        vm.prank(owner);
        chainLend.emergencyWithdrawUSDC(owner, withdrawAmount);
        
        uint256 contractBalanceAfter = usdcToken.balanceOf(address(chainLend));
        assertEq(contractBalanceBefore - contractBalanceAfter, withdrawAmount);
    }

    function test_RevertWhen_NonOwner_EmergencyWithdraw() public {
        address nonOwner = makeAddr("nonOwner");
        
        vm.prank(nonOwner);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", nonOwner));
        chainLend.emergencyWithdrawUSDC(nonOwner, 100e6);
    }

    function test_RevertWhen_EmergencyWithdraw_ZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSignature("ZeroAddress()"));
        chainLend.emergencyWithdrawUSDC(address(0), 100e6);
    }

    function test_RevertWhen_EmergencyWithdraw_ZeroAmount() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSignature("ZeroAmount()"));
        chainLend.emergencyWithdrawUSDC(owner, 0);
    }

    function test_RevertWhen_EmergencyWithdraw_ExceedsBalance() public {
        uint256 amount = 500e6;
        uint256 excessiveAmount = 1000e6;
        
        // Add limited USDC to contract
        deal(address(usdcToken), address(chainLend), amount, true);
        
        vm.prank(owner);
        vm.expectRevert(); // ERC20 insufficient balance
        chainLend.emergencyWithdrawUSDC(owner, excessiveAmount);
    }

    function test_MultipleEmergencyWithdrawals() public {
        uint256 totalAmount = 1000e6;
        uint256 withdrawal1 = 300e6;
        uint256 withdrawal2 = 200e6;
        uint256 withdrawal3 = 500e6;
        
        // Add USDC to contract
        deal(address(usdcToken), address(chainLend), totalAmount, true);
        
        uint256 ownerBalanceBefore = usdcToken.balanceOf(owner);
        
        // Multiple withdrawals
        vm.startPrank(owner);
        chainLend.emergencyWithdrawUSDC(owner, withdrawal1);
        chainLend.emergencyWithdrawUSDC(owner, withdrawal2);
        chainLend.emergencyWithdrawUSDC(owner, withdrawal3);
        vm.stopPrank();
        
        uint256 ownerBalanceAfter = usdcToken.balanceOf(owner);
        assertEq(ownerBalanceAfter - ownerBalanceBefore, totalAmount);
    }

    function test_EmergencyWithdraw_EmitsCorrectEvent() public {
        address recipient = makeAddr("recipient");
        uint256 amount = 800e6;
        uint256 withdrawAmount = 250e6;
        
        // Add USDC to contract
        deal(address(usdcToken), address(chainLend), amount, true);
        
        vm.prank(owner);
        vm.expectEmit(true, false, false, true);
        emit EmergencyWithdrawal(recipient, withdrawAmount); 
        chainLend.emergencyWithdrawUSDC(recipient, withdrawAmount);
    }

    // ========== OWNERSHIP MANAGEMENT TESTS ==========

    function test_ReturnsCorrectOwner() public view {
        assertEq(chainLend.owner(), owner);
    }

    function test_TransferOwnership() public {
        address newOwner = makeAddr("newOwner");
        
        vm.prank(owner);
        chainLend.transferOwnership(newOwner);
        
        assertEq(chainLend.owner(), newOwner);
    }

    function test_RevertWhen_NonOwner_TransfersOwnership() public {
        address nonOwner = makeAddr("nonOwner");
        address newOwner = makeAddr("newOwner");
        
        vm.prank(nonOwner);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", nonOwner));
        chainLend.transferOwnership(newOwner);
    }
}