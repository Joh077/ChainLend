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
    
    
    /**
     * @notice Supply maximum du token CL
     * @return Quantité maximale de tokens pouvant être créés
     */
    function MAX_SUPPLY() external view returns (uint256);
    
    /**
     * @notice Mapping des adresses autorisées à mint
     * @param minter Adresse à vérifier
     * @return true si l'adresse peut mint, false sinon
     */
    function minters(address minter) external view returns (bool);
    
    
    /**
     * @notice Ajoute une adresse autorisée à mint des tokens
     * @dev Seul le owner peut ajouter des minters
     * @param _minter Adresse à autoriser
     */
    function addMinter(address _minter) external;
    
    /**
     * @notice Retire une adresse de la liste des minters
     * @dev Seul le owner peut retirer des minters
     * @param _minter Adresse à retirer
     */
    function removeMinter(address _minter) external;
    
    /**
     * @notice Mint de nouveaux tokens CL
     * @dev Seuls les minters autorisés peuvent mint
     * @param _to Adresse qui recevra les tokens
     * @param _amount Quantité de tokens à mint
     */
    function mint(address _to, uint256 _amount) external;
    
    /**
     * @notice Retourne la quantité de tokens qui peuvent encore être mintés
     * @return Nombre de tokens restants avant d'atteindre MAX_SUPPLY
     */
    function remainingMintableSupply() external view returns (uint256);
    
    /**
     * @notice Vérifie si une adresse est un minter autorisé
     * @param _address Adresse à vérifier
     * @return true si l'adresse peut mint, false sinon
     */
    function isMinter(address _address) external view returns (bool);
    
    /**
     * @notice Calcule le pourcentage de tokens détenus par une adresse
     * @dev Retourne la valeur en basis points (10000 = 100%)
     * @param _holder Adresse du détenteur
     * @return Pourcentage en basis points
     */
    function getHolderPercentage(address _holder) external view returns (uint256);

    /**
     * @notice Retourne l'adresse du propriétaire du contrat
     * @return Adresse du owner
     */
    function owner() external view returns (address);
    
    /**
     * @notice Transfère la propriété du contrat
     * @param newOwner Nouvelle adresse propriétaire
     */
    function transferOwnership(address newOwner) external;
    
    /**
     * @notice Renonce à la propriété du contrat
     */
    function renounceOwnership() external;
}