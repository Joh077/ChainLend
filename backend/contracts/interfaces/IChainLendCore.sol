// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IChainLendCore
 * @dev Interface pour le protocole ChainLend
 */
interface IChainLendCore {
    
    // ========== ENUMS ==========
    
    enum RequestStatus {
        WaitingForCollateral, 
        Pending,        
        Funded,         
        Cancelled       
    }
    
    enum LoanStatus { 
        Active,         
        Repaid,         
        Liquidated      
    }
    
    // ========== STRUCTURES ==========
    
    struct LoanRequest {
        uint256 id;
        address borrower;
        uint256 amountRequested;            
        uint256 requiredCollateral;         
        uint256 actualCollateralDeposited;  
        uint256 interestRate;               
        uint256 duration;                   
        uint256 createdAt;                  
        RequestStatus status;
    }
    
    struct ActiveLoan {
        uint256 requestId;                  
        address lender;                     
        uint256 fundedAt;                   
        uint256 dueDate;                    
        uint256 totalAmountDue;             
        LoanStatus status;
    }
    
    // ========== EVENTS ==========
    
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
    
    event LoanFunded(
        uint256 indexed requestId,
        address indexed lender,
        address indexed borrower,
        uint256 amount,
        uint256 dueDate
    );
    
    event LoanRepaid(
        uint256 indexed requestId,
        address indexed borrower,
        uint256 totalAmount,
        uint256 protocolFee
    );

    event CollateralWithdrawn(
        uint256 indexed requestId,
        address indexed borrower,
        uint256 amountWithdrawn,
        uint256 remainingCollateral
    );
    
    event LoanLiquidated(
        uint256 indexed requestId,
        address indexed liquidator,
        uint256 collateralLiquidated,
        uint256 amountRecovered
    );
    
    event LoanRequestCancelled(
        uint256 indexed requestId,
        address indexed borrower,
        uint256 collateralRefunded
    );
    
    // ========== FONCTIONS PRINCIPALES ==========
    
    /**
     * @dev Calcule le collatéral ETH requis pour un montant USDT
     */
    function calculateRequiredCollateral(uint256 loanAmount) external view returns (uint256);
    
    /**
     * @dev Crée une nouvelle demande de prêt
     */
    function createLoanRequest(
        uint256 amountRequested, 
        uint256 interestRate, 
        uint256 duration
    ) external;
    
    /**
     * @dev Dépose du collatéral ETH pour une demande
     */
    function depositCollateral(uint256 requestId) external payable;
    
    /**
     * @dev Finance une demande de prêt
     */
    function fundLoan(uint256 requestId) external;
    
    /**
     * @dev Rembourse un prêt actif
     */
    function repayLoan(uint256 requestId) external;
    
    /**
     * @dev Retire le collatéral après remboursement
     */
    function withdrawCollateral(uint256 requestId) external;
    
    /**
     * @dev Annule une demande de prêt
     */
    function cancelLoanRequest(uint256 requestId) external;
    
    // ========== FONCTIONS DE CONSULTATION ==========
    
    /**
     * @dev Retourne les détails d'une demande
     */
    function getLoanRequest(uint256 requestId) external view returns (LoanRequest memory);
    
    /**
     * @dev Retourne les détails d'un prêt actif
     */
    function getActiveLoan(uint256 requestId) external view returns (ActiveLoan memory);
    
    /**
     * @dev Retourne les demandes d'un utilisateur
     */
    function getUserRequests(address user) external view returns (uint256[] memory);
    
    /**
     * @dev Retourne les prêts d'un utilisateur (en tant que lender)
     */
    function getUserLoans(address user) external view returns (uint256[] memory);
    
    /**
     * @dev Retourne les demandes en attente avec pagination
     */
    function getPendingRequests(uint256 offset, uint256 limit) 
        external 
        view 
        returns (uint256[] memory pendingIds, bool hasMore);
    
    /**
     * @dev Compte les demandes en attente
     */
    function getPendingRequestsCount() external view returns (uint256);
    
    /**
     * @dev Vérifie si un utilisateur peut retirer son collatéral
     */
    function canWithdrawCollateral(uint256 requestId) 
        external 
        view 
        returns (bool canWithdraw, uint256 collateralAmount, string memory reason);
    
    /**
     * @dev Statistiques globales du protocole
     */
    function getProtocolStats() 
        external 
        view 
        returns (
            uint256 totalRequests,
            uint256 activeRequests,
            uint256 activeLoansCount,
            uint256 totalVolumeUSD
        );
    
    // ========== FONCTIONS ADMIN ==========
    
    /**
     * @dev Met à jour l'adresse du treasury
     */
    function updateTreasury(address newTreasury) external;
    
    // ========== VARIABLES PUBLIQUES ==========
    
    function BASIS_POINTS() external view returns (uint256);
    function MIN_COLLATERAL_RATIO() external view returns (uint256);
    function LIQUIDATION_THRESHOLD() external view returns (uint256);
    function PROTOCOL_FEE() external view returns (uint256);
    function MIN_INTEREST_RATE() external view returns (uint256);
    function MAX_INTEREST_RATE() external view returns (uint256);
    function MIN_LOAN_DURATION() external view returns (uint256);
    function MAX_LOAN_DURATION() external view returns (uint256);
    function MAX_LOAN_AMOUNT() external view returns (uint256);
    
    function nextRequestId() external view returns (uint256);
    function totalActiveRequests() external view returns (uint256);
    function totalActiveLoans() external view returns (uint256);
    function treasury() external view returns (address);
    
    function userRequestCount(address user) external view returns (uint256);
    function userLoanCount(address user) external view returns (uint256);
}