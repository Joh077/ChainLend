// ============ MOCK CONTRACTS FOR TESTING ============

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockChainlinkPriceFeed
 * @author ChainLend Team  
 * @notice Mock implementation of Chainlink price feed for testing purposes
 * @dev This contract simulates Chainlink's AggregatorV3Interface for testing
 */

contract MockChainlinkPriceFeed {

    int256 private price;
    uint8 private decimals_;
    uint256 private updatedAt;

    /**
     * @notice Initializes the mock price feed
     * @param _price Initial price value
     * @param _decimals Number of decimals for the price
     */
    constructor(int256 _price, uint8 _decimals) {
        price = _price;
        decimals_ = _decimals;
        updatedAt = block.timestamp;
    }
    
    /**
     * @notice Returns the number of decimals used by the price feed
     * @return The number of decimals
     */
    function decimals() external view returns (uint8) {
        return decimals_;
    }
    
    /**
     * @notice Returns the latest round data (mimics Chainlink interface)
     * @return roundId Round identifier (always 1 in mock)
     * @return answer The current price
     * @return startedAt Timestamp when round started (same as updatedAt in mock)
     * @return updatedAt_ Timestamp when price was last updated
     * @return answeredInRound Round in which answer was computed (always 1 in mock)
     */
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt_,
        uint80 answeredInRound
    ) {
        return (1, price, updatedAt, updatedAt, 1);
    }
    
    /**
     * @notice Updates the price in the mock feed
     * @dev This function is only available in the mock for testing purposes
     * @param _newPrice The new price to set
     */
    function updatePrice(int256 _newPrice) external {
        price = _newPrice;
        updatedAt = block.timestamp;
    }
    
    /**
     * @notice Sets a custom timestamp to simulate stale price data
     * @dev This function is only available in the mock for testing purposes
     * @param _pastTimestamp The timestamp to set (should be in the past to simulate staleness)
     */
    function setStalePrice(uint256 _pastTimestamp) external {
        updatedAt = _pastTimestamp;
    }
}