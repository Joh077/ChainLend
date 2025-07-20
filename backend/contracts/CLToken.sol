// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CLToken - ChainLend Token
 * @author Johan L.
 * @notice ERC20 token used for rewards and future governance in the ChainLend protocol
 * @dev This token has a maximum supply and only authorized minters can create new tokens
 */
contract CLToken is ERC20, Ownable {
    
    error NotMinter(address caller);
    error MaxSupplyExceeded(uint256 currentSupply, uint256 mintAmount, uint256 maxSupply);
    error ZeroAddress();
    error ZeroAmount();
    error MinterAlreadyAdded(address minter);
    error MinterNotFound(address minter);
    
    uint256 public constant MAX_SUPPLY = 100_000_000 * 1e18;
    
    /// @notice Mapping of addresses authorized to mint tokens
    mapping(address => bool) public minters;
    
    /**
     * @notice Emitted when a new minter is added
     */
    event MinterAdded(address indexed minter);
    
    /**
     * @notice Emitted when a minter is removed
     */
    event MinterRemoved(address indexed minter);
    
    /**
     * @notice Emitted when tokens are minted
     */
    event TokensMinted(address indexed to, uint256 amount);
    
    /**
     * @notice Initializes the CL token
     * @param _initialOwner The address that will own the contract
     */
    constructor(address _initialOwner) ERC20("ChainLend Token", "CL") Ownable(_initialOwner) {}

    /**
     * @notice Adds an address to the list of authorized minters
     * @dev Only the contract owner can add minters
     * @param _minter The address to authorize for minting
     */
    function addMinter(address _minter) external onlyOwner {
        if (_minter == address(0)) revert ZeroAddress();
        if (minters[_minter]) revert MinterAlreadyAdded(_minter);
        
        minters[_minter] = true;
        emit MinterAdded(_minter);
    }
    
    /**
     * @notice Removes an address from the list of authorized minters
     * @dev Only the contract owner can remove minters
     * @param _minter The address to remove from minting authorization
     */
    function removeMinter(address _minter) external onlyOwner {
        if (!minters[_minter]) revert MinterNotFound(_minter);
        
        minters[_minter] = false;
        emit MinterRemoved(_minter);
    }
    
    /**
     * @notice Mints new CL tokens
     * @dev Only authorized minters can call this function
     * @param _to The address to receive the minted tokens
     * @param _amount The amount of tokens to mint
     */
    function mint(address _to, uint256 _amount) external {
        if (!minters[msg.sender]) revert NotMinter(msg.sender);
        if (_to == address(0)) revert ZeroAddress();
        if (_amount == 0) revert ZeroAmount();
        
        uint256 currentSupply = totalSupply();
        if (currentSupply + _amount > MAX_SUPPLY) {
            revert MaxSupplyExceeded(currentSupply, _amount, MAX_SUPPLY);
        }
        
        _mint(_to, _amount);
        emit TokensMinted(_to, _amount);
    }
    
    // ============ GETTERS ============
    
    /**
     * @notice Returns the remaining amount of tokens that can be minted
     * @return The number of tokens that can still be minted before reaching MAX_SUPPLY
     */
    function remainingMintableSupply() external view returns (uint256) {
        return MAX_SUPPLY - totalSupply();
    }
    
    /**
     * @notice Checks if an address is authorized to mint tokens
     * @param _address The address to check
     * @return true if the address can mint tokens, false otherwise
     */
    function isMinter(address _address) external view returns (bool) {
        return minters[_address];
    }
    
    /**
     * @notice Calculates the percentage of total supply held by an address
     * @dev Returns the value in basis points (10000 = 100%)
     * @param _holder The address of the token holder
     * @return The percentage in basis points
     */
    function getHolderPercentage(address _holder) external view returns (uint256) {
        uint256 holderBalance = balanceOf(_holder);
        uint256 totalMinted = totalSupply();
        
        if (totalMinted == 0) return 0;
        
        return (holderBalance * 10000) / totalMinted;
    }
}