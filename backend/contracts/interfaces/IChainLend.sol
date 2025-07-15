// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ICLToken {
    function mint(address to, uint256 amount) external;
}

interface IChainLend {
    
    // ========== ENUMS ==========
    
    enum RequestStatus { Pending, Funded, Cancelled }
    
    enum LoanStatus { Active, Repaid, Liquidated }
    
    // ========== STRUCTS ==========
    
    struct LoanRequest {
        uint256 id;
        uint256 amountRequested;
        uint256 requiredCollateral;
        uint256 actualCollateralDeposited;
        uint256 createdAt;
        address borrower;
        uint64 duration;
        uint32 interestRate;
        RequestStatus status;
    }
    
    struct ActiveLoan {
        uint256 requestId;
        uint256 fundedAt;
        uint256 dueDate;
        uint256 principalAmount;
        uint256 totalAmountDue;
        address lender;
        uint64 interestAmount;
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
    
    event CollateralAdded(
        uint256 indexed requestId,
        address indexed borrower,
        uint256 amountAdded,
        uint256 newTotalCollateral,
        uint256 newHealthFactor
    );
    
    event ExcessCollateralWithdrawn(
        uint256 indexed requestId,
        address indexed borrower,
        uint256 amountWithdrawn,
        uint256 remainingCollateral,
        uint256 newHealthFactor
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

    event EmergencyWithdrawal(address indexed to, uint256 amount);

    event CLRewardsEarned(address indexed user, uint256 amount, string action);

    event CLRewardsClaimed(address indexed user, uint256 amount);
    
    // ========== CONSTANTS ==========
    
    function BASIS_POINTS() external view returns (uint256);
    function MIN_COLLATERAL_RATIO() external view returns (uint256);
    function LIQUIDATION_THRESHOLD() external view returns (uint256);
    function WARNING_THRESHOLD() external view returns (uint256);
    function PROTOCOL_FEE() external view returns (uint256);
    function LIQUIDATION_BONUS() external view returns (uint256);
    function LIQUIDATION_PROTOCOL_FEE() external view returns (uint256);
    function STALENESS_THRESHOLD() external view returns (uint256);
    function MIN_INTEREST_RATE() external view returns (uint256);
    function MAX_INTEREST_RATE() external view returns (uint256);
    function MIN_LOAN_DURATION() external view returns (uint256);
    function MAX_LOAN_DURATION() external view returns (uint256);
    function MAX_LOAN_AMOUNT() external view returns (uint256);
    function REWARD_CREATE_REQUEST() external view returns (uint256);
    function REWARD_FUND_LOAN() external view returns (uint256);
    function REWARD_REPAY_ONTIME() external view returns (uint256);
    function REWARD_LIQUIDATE() external view returns (uint256);
    function MIN_CLAIM_AMOUNT() external view returns (uint256);
    
    // ========== STATE VARIABLES ==========
    
    function usdcToken() external view returns (address);
    function ethPriceFeed() external view returns (address);
    function usdcPriceFeed() external view returns (address);
    function clToken() external view returns (address);
    function treasury() external view returns (address);
    function nextRequestId() external view returns (uint256);
    function totalActiveRequests() external view returns (uint256);
    function totalActiveLoans() external view returns (uint256);
    
    function requests(uint256) external view returns (
        uint256 id,
        uint256 amountRequested,
        uint256 requiredCollateral,
        uint256 actualCollateralDeposited,
        uint256 createdAt,
        address borrower,
        uint64 duration,
        uint32 interestRate,
        RequestStatus status
    );
    
    function activeLoans(uint256) external view returns (
        uint256 requestId,
        uint256 fundedAt,
        uint256 dueDate,
        uint256 principalAmount,
        uint256 totalAmountDue,
        address lender,
        uint64 interestAmount,
        LoanStatus status
    );
    
    function userRequests(address, uint256) external view returns (uint256);
    function userLoans(address, uint256) external view returns (uint256);
    function userRequestCount(address) external view returns (uint256);
    function userLoanCount(address) external view returns (uint256);
    function pendingCLRewards(address) external view returns (uint256);
    
    // ========== MAIN FUNCTIONS ==========
    
    /**
     * @notice Calcule le collatéral requis pour un montant de prêt donné
     * @param _loanAmount Montant du prêt en USDC
     * @return Montant de collatéral requis en ETH
     */
    function calculateRequiredCollateral(uint256 _loanAmount) external view returns (uint256);

    /**
     * @notice Crée une demande de prêt avec dépôt de collatéral
     * @param _amountRequested Montant demandé en USDC
     * @param _interestRate Taux d'intérêt annuel en points de base
     * @param _duration Durée du prêt en secondes
     */
    function createLoanRequest(
        uint256 _amountRequested, 
        uint32 _interestRate, 
        uint64 _duration
    ) external payable;

    /**
     * @notice Finance un prêt en tant que prêteur
     * @param _requestId ID de la demande de prêt
     */
    function fundLoan(uint256 _requestId) external;

    /**
     * @notice Ajoute du collatéral à un prêt actif
     * @param _requestId ID du prêt
     */
    function addCollateral(uint256 _requestId) external payable;

    /**
     * @notice Retire le collatéral excédentaire (au-dessus de 150%)
     * @param _requestId ID du prêt
     * @param _amount Montant à retirer
     */
    function withdrawExcessCollateral(uint256 _requestId, uint256 _amount) external;

    /**
     * @notice Rembourse un prêt actif
     * @param _requestId ID du prêt
     */
    function repayLoan(uint256 _requestId) external;

    /**
     * @notice Retire le collatéral après remboursement du prêt
     * @param _requestId ID du prêt
     */
    function withdrawCollateral(uint256 _requestId) external;

    /**
     * @notice Annule une demande de prêt non financée
     * @param _requestId ID de la demande
     */
    function cancelLoanRequest(uint256 _requestId) external;

    /**
     * @notice Liquide un prêt sous-collatéralisé
     * @param _requestId ID du prêt
     */
    function liquidateCollateral(uint256 _requestId) external;

    /**
     * @notice Réclame les récompenses CL accumulées
     */
    function claimCLRewards() external;
    
    // ========== VIEW FUNCTIONS ==========

    /**
     * @notice Retourne le health factor (ratio de collatéralisation) d'un prêt
     * @param _requestId ID du prêt
     * @return Ratio de collatéralisation en points de base
     */
    function getHealthFactor(uint256 _requestId) external view returns (uint256);

    /**
     * @notice Vérifie si un prêt est à risque de liquidation
     * @param _requestId ID du prêt
     * @return atRisk True si le prêt est à risque
     * @return currentRatio Ratio de collatéralisation actuel
     */
    function isAtRiskOfLiquidation(uint256 _requestId) external view returns (bool atRisk, uint256 currentRatio);

    /**
     * @notice Calcule le montant de collatéral excédentaire pouvant être retiré
     * @param _requestId ID du prêt
     * @return excessAmount Montant excédentaire
     */
    function getExcessCollateral(uint256 _requestId) external view returns (uint256 excessAmount);

    /**
     * @notice Retourne les détails d'une demande de prêt
     * @param _requestId ID de la demande
     * @return LoanRequest struct
     */
    function getLoanRequest(uint256 _requestId) external view returns (LoanRequest memory);

    /**
     * @notice Retourne les détails d'un prêt actif
     * @param _requestId ID du prêt
     * @return ActiveLoan struct
     */
    function getActiveLoan(uint256 _requestId) external view returns (ActiveLoan memory);

    /**
     * @notice Retourne la liste des demandes d'un utilisateur
     * @param _user Adresse de l'utilisateur
     * @return Array des IDs de demandes
     */
    function getUserRequests(address _user) external view returns (uint256[] memory);

    /**
     * @notice Retourne la liste des prêts d'un utilisateur
     * @param _user Adresse de l'utilisateur
     * @return Array des IDs de prêts
     */
    function getUserLoans(address _user) external view returns (uint256[] memory);

    /**
     * @notice Retourne les demandes en attente avec pagination
     * @param _offset Décalage pour la pagination
     * @param _limit Nombre maximum de résultats
     * @return pendingIds Array des IDs en attente
     * @return hasMore True s'il y a plus de résultats
     */
    function getPendingRequests(uint256 _offset, uint256 _limit) 
        external view returns (uint256[] memory pendingIds, bool hasMore);

    /**
     * @notice Retourne le nombre total de demandes en attente
     * @return count Nombre de demandes en attente
     */
    function getPendingRequestsCount() external view returns (uint256 count);

    /**
     * @notice Vérifie si le collatéral peut être retiré
     * @param _requestId ID du prêt
     * @return canWithdraw True si le retrait est possible
     * @return collateralAmount Montant de collatéral disponible
     * @return reason Raison en cas d'impossibilité
     */
    function canWithdrawCollateral(uint256 _requestId) 
        external view returns (bool canWithdraw, uint256 collateralAmount, string memory reason);

    /**
     * @notice Retourne les statistiques globales du protocole
     * @return totalRequests Nombre total de demandes
     * @return activeRequests Nombre de demandes actives
     * @return activeLoansCount Nombre de prêts actifs
     * @return totalVolumeUSDC Volume total en USDC
     */
    function getProtocolStats() external view returns (
        uint256 totalRequests,
        uint256 activeRequests,
        uint256 activeLoansCount,
        uint256 totalVolumeUSDC
    );
    
    // ========== ADMIN FUNCTIONS ==========

    /**
     * @notice Met à jour l'adresse du treasury (admin seulement)
     * @param _newTreasury Nouvelle adresse du treasury
     */
    function updateTreasury(address _newTreasury) external;

    /**
     * @notice Retrait d'urgence d'USDC (admin seulement)
     * @param _to Adresse de destination
     * @param _amount Montant à retirer
     */
    function emergencyWithdrawUSDC(address _to, uint256 _amount) external;
}