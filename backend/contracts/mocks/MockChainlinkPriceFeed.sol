// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockChainlinkPriceFeed
 * @dev Mock Chainlink price feed for testing
 */
contract MockChainlinkPriceFeed {
    int256 private price;
    uint8 private decimals_;
    uint256 private updatedAt;
    
    constructor(int256 _price, uint8 _decimals) {
        price = _price;
        decimals_ = _decimals;
        updatedAt = block.timestamp;
    }
    
    function decimals() external view returns (uint8) {
        return decimals_;
    }
    
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt_,
            uint80 answeredInRound
        )
    {
        return (
            1,
            price,
            updatedAt,
            updatedAt,
            1
        );
    }
    
    // Fonction pour modifier le prix dans les tests
    function updatePrice(int256 _newPrice) external {
        price = _newPrice;
        updatedAt = block.timestamp;
    }
    
    // Fonction pour simuler un prix obsolète
    function setStalePrice(uint256 _pastTimestamp) external {
        updatedAt = _pastTimestamp;
    }
}