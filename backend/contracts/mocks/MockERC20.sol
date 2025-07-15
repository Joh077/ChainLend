// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockERC20
 * @author ChainLend Team
 * @notice Mock ERC20 token for testing purposes (simulates USDC)
 * @dev This contract provides mint and burn functions for testing scenarios
 */
contract MockERC20 is ERC20 {

    /// @notice Number of decimals for this token
    uint8 private _decimals;

    /**
     * @notice Initializes the mock ERC20 token
     * @param name The name of the token
     * @param symbol The symbol of the token  
     * @param decimals_ The number of decimals for the token
     */
    constructor(string memory name, string memory symbol, uint8 decimals_) ERC20(name, symbol) {
        _decimals = decimals_;
    }

    /**
     * @notice Returns the number of decimals used by the token
     * @return The number of decimals
     */
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    /**
     * @notice Mints tokens to a specified address
     * @dev This function is only available in the mock for testing purposes
     * @param to The address to mint tokens to
     * @param amount The amount of tokens to mint
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
    
    /**
     * @notice Burns tokens from a specified address
     * @dev This function is only available in the mock for testing purposes
     * @param from The address to burn tokens from
     * @param amount The amount of tokens to burn
     */
    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }
}