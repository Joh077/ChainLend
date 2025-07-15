// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

interface ICLToken is IERC20 {
    
    error NotMinter(address caller);
    error MaxSupplyExceeded(uint256 currentSupply, uint256 mintAmount, uint256 maxSupply);
    error ZeroAddress();
    error ZeroAmount();
    error MinterAlreadyAdded(address minter);
    error MinterNotFound(address minter);
    
    
    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);
    event TokensMinted(address indexed to, uint256 amount);
    
    
    function MAX_SUPPLY() external view returns (uint256);
    
    function minters(address minter) external view returns (bool);
    
    function addMinter(address _minter) external;
    
    function removeMinter(address _minter) external;
    
    function mint(address _to, uint256 _amount) external;
    
    function remainingMintableSupply() external view returns (uint256);
    
    function isMinter(address _address) external view returns (bool);
    
    function getHolderPercentage(address _holder) external view returns (uint256);

    function owner() external view returns (address);
    
    function transferOwnership(address newOwner) external;
    
    function renounceOwnership() external;
}