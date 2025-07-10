// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CLToken
 * @dev Token utilitaire du protocole ChainLend
 * @notice Token ERC20 avec mint contrôlé et supply maximum
 */
contract CLToken is ERC20, Ownable {
    
    // ========== CUSTOM ERRORS ==========
    error NotMinter(address caller);
    error MaxSupplyExceeded(uint256 currentSupply, uint256 mintAmount, uint256 maxSupply);
    error ZeroAddress();
    error ZeroAmount();
    error MinterAlreadyAdded(address minter);
    error MinterNotFound(address minter);
    
    // ========== VARIABLES D'ÉTAT ==========
    
    uint256 public constant MAX_SUPPLY = 100_000_000 * 1e18; // 100 millions CL
    
    // Mapping des adresses autorisées à mint (ChainLendCore, Treasury, etc.)
    mapping(address => bool) public minters;
    
    // ========== EVENTS ==========
    
    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);
    event TokensMinted(address indexed to, uint256 amount);
    
    // ========== CONSTRUCTOR ==========
    
    /**
     * @dev Initialise le token avec nom, symbole et owner
     * @param _initialOwner Adresse qui sera propriétaire du contrat
     */
    constructor(address _initialOwner) 
        ERC20("ChainLend Token", "CL") 
        Ownable(_initialOwner) 
    {
        // Le owner peut ajouter des minters mais ne peut pas mint directement
        // Cela force une séparation des responsabilités
    }
    
    // ========== FONCTIONS MINTER ==========
    
    /**
     * @notice Ajoute une adresse autorisée à mint des tokens
     * @dev Seul le owner peut ajouter des minters
     * @param _minter Adresse à autoriser
     */
    function addMinter(address _minter) external onlyOwner {
        if (_minter == address(0)) revert ZeroAddress();
        if (minters[_minter]) revert MinterAlreadyAdded(_minter);
        
        minters[_minter] = true;
        emit MinterAdded(_minter);
    }
    
    /**
     * @notice Retire une adresse de la liste des minters
     * @dev Seul le owner peut retirer des minters
     * @param _minter Adresse à retirer
     */
    function removeMinter(address _minter) external onlyOwner {
        if (!minters[_minter]) revert MinterNotFound(_minter);
        
        minters[_minter] = false;
        emit MinterRemoved(_minter);
    }
    
    // ========== FONCTION MINT ==========
    
    /**
     * @notice Mint de nouveaux tokens CL
     * @dev Seuls les minters autorisés peuvent mint
     * @param _to Adresse qui recevra les tokens
     * @param _amount Quantité de tokens à mint
     */
    function mint(address _to, uint256 _amount) external {
        // Vérifications
        if (!minters[msg.sender]) revert NotMinter(msg.sender);
        if (_to == address(0)) revert ZeroAddress();
        if (_amount == 0) revert ZeroAmount();
        
        // Vérifier que le mint ne dépasse pas le MAX_SUPPLY
        uint256 currentSupply = totalSupply();
        if (currentSupply + _amount > MAX_SUPPLY) {
            revert MaxSupplyExceeded(currentSupply, _amount, MAX_SUPPLY);
        }
        
        // Mint les tokens
        _mint(_to, _amount);
        emit TokensMinted(_to, _amount);
    }
    
    // ========== FONCTIONS DE CONSULTATION ==========
    
    /**
     * @notice Retourne la quantité de tokens qui peuvent encore être mintés
     * @return Nombre de tokens restants avant d'atteindre MAX_SUPPLY
     */
    function remainingMintableSupply() external view returns (uint256) {
        return MAX_SUPPLY - totalSupply();
    }
    
    /**
     * @notice Vérifie si une adresse est un minter autorisé
     * @param _address Adresse à vérifier
     * @return true si l'adresse peut mint, false sinon
     */
    function isMinter(address _address) external view returns (bool) {
        return minters[_address];
    }
    
    /**
     * @notice Calcule le pourcentage de tokens détenus par une adresse
     * @dev Retourne la valeur en basis points (10000 = 100%)
     * @param _holder Adresse du détenteur
     * @return Pourcentage en basis points
     */
    function getHolderPercentage(address _holder) external view returns (uint256) {
        uint256 holderBalance = balanceOf(_holder);
        uint256 totalMinted = totalSupply();
        
        if (totalMinted == 0) return 0;
        
        // Calcul en basis points pour éviter les décimales
        return (holderBalance * 10000) / totalMinted;
    }
}