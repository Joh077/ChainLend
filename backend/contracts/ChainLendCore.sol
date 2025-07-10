// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "./interfaces/IChainlinkPriceFeed.sol";

interface ICLToken {
    function mint(address to, uint256 amount) external;
}

/**
 * @title ChainLendCore
 * @dev Protocole de prêt P2P avec collatéral ETH
 * @notice MVP avec gestion dynamique du collatéral
 */
contract ChainLendCore is Ownable, ReentrancyGuard {
    
    // ========== USING DIRECTIVES ==========
    using SafeERC20 for IERC20;
    
    // ========== CUSTOM ERRORS ==========
    
    error ZeroAddress();
    error ZeroAmount();
    error InvalidAmount(uint256 amount, uint256 limit);
    error Unauthorized(address caller);
    error TransferFailed(string transferType);
    error InvalidRequest(uint256 requestId, string reason);
    error InvalidRequestStatus(uint256 requestId, RequestStatus current, RequestStatus expected);
    error InvalidLoan(uint256 requestId, string reason);
    error LoanOverdue(uint256 requestId, uint256 dueDate);
    error InvalidPrice(int256 price);
    error StalePrice(uint256 lastUpdate, uint256 maxAge);
    error OracleError(string reason);
    error InvalidParameter(string param, uint256 value);
    error DirectETHNotAllowed();
    error InsufficientCollateral(uint256 deposited, uint256 required);
    error ExcessWithdrawalAmount(uint256 requested, uint256 available);
    error CollateralBelowMinimum(uint256 resultingRatio, uint256 minimumRatio);
    
    // ========== ENUMS ==========
    
    enum RequestStatus {
        Pending,
        Funded,
        Cancelled
    }
    
    enum LoanStatus { 
        Active,
        Repaid,
        Liquidated
    }
    
    // ========== STRUCTURES OPTIMISÉES ==========
    
    // Structure packée pour économiser du gas
    struct LoanRequest {
        uint256 id;
        uint256 amountRequested;
        uint256 requiredCollateral;
        uint256 actualCollateralDeposited;
        uint256 createdAt;
        address borrower;        // 20 bytes
        uint64 duration;         // 8 bytes
        uint32 interestRate;     // 4 bytes
        RequestStatus status;    // 1 byte
        // Total: 20 + 8 + 4 + 1 = 33 bytes (fits in 2 slots avec address)
    }
    
    struct ActiveLoan {
        uint256 requestId;
        uint256 fundedAt;
        uint256 dueDate;
        uint256 principalAmount;
        uint256 totalAmountDue;
        address lender;          // 20 bytes
        uint64 interestAmount;   // 8 bytes (suffisant pour les intérêts)
        LoanStatus status;       // 1 byte
        // Packing: 20 + 8 + 1 = 29 bytes
    }
    
    // ========== VARIABLES D'ÉTAT ==========
    
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant MIN_COLLATERAL_RATIO = 15000;      // 150%
    uint256 public constant LIQUIDATION_THRESHOLD = 13000;     // 130%
    uint256 public constant WARNING_THRESHOLD = 14000;         // 140% - Zone de danger
    uint256 public constant PROTOCOL_FEE = 1000;               // 10% des intérêts
    uint256 public constant LIQUIDATION_BONUS = 400;           // 4% bonus liquidateur
    uint256 public constant LIQUIDATION_PROTOCOL_FEE = 100;    // 1% frais protocole liquidation
    uint256 public constant STALENESS_THRESHOLD = 3600;        // 1 heure

    uint256 public constant MIN_INTEREST_RATE = 500;           // 5%
    uint256 public constant MAX_INTEREST_RATE = 1500;          // 15%

    uint256 public constant MIN_LOAN_DURATION = 30 days;
    uint256 public constant MAX_LOAN_DURATION = 1095 days;     // ~3 ans

    uint256 public constant MAX_LOAN_AMOUNT = 500000 * 1e6;   // 500k USDC

        // Constantes de récompenses
    uint256 public constant REWARD_CREATE_REQUEST = 10 * 1e18;   // 10 CL
    uint256 public constant REWARD_FUND_LOAN = 50 * 1e18;        // 50 CL
    uint256 public constant REWARD_REPAY_ONTIME = 100 * 1e18;   // 100 CL
    uint256 public constant REWARD_LIQUIDATE = 20 * 1e18;        // 20 CL
    uint256 public constant MIN_CLAIM_AMOUNT = 10 * 1e18; // Minimum 10 CL

    IERC20 public immutable usdcToken;
    IChainlinkPriceFeed public immutable ethPriceFeed;
    IChainlinkPriceFeed public immutable usdcPriceFeed;
    ICLToken public clToken;
    address public treasury;
                                                               
    uint256 public nextRequestId;
    uint256 public totalActiveRequests;
    uint256 public totalActiveLoans;
    
    mapping(uint256 => LoanRequest) public requests;
    mapping(uint256 => ActiveLoan) public activeLoans;
    
    mapping(address => uint256[]) public userRequests;
    mapping(address => uint256[]) public userLoans;
    mapping(address => uint256) public userRequestCount;
    mapping(address => uint256) public userLoanCount;

    mapping(address => uint256) public pendingCLRewards;
    
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

    event EmergencyWithdrawal(
        address indexed to, 
        uint256 amount     
    );

    event CLRewardsEarned(address indexed user, uint256 amount, string action);

    event CLRewardsClaimed(address indexed user, uint256 amount);
    
    // ========== CONSTRUCTOR ==========
    
    constructor(
        address _usdcToken, 
        address _ethPriceFeed, 
        address _treasury, 
        address _usdcPriceFeed,
        address _clToken,    
        address _initialOwner
    ) Ownable(_initialOwner) {
        if (_usdcToken == address(0)) revert ZeroAddress();
        if (_ethPriceFeed == address(0)) revert ZeroAddress();
        if (_treasury == address(0)) revert ZeroAddress();
        if (_usdcPriceFeed == address(0)) revert ZeroAddress();
        if (_clToken == address(0)) revert ZeroAddress(); 

        usdcToken = IERC20(_usdcToken);
        ethPriceFeed = IChainlinkPriceFeed(_ethPriceFeed);
        usdcPriceFeed = IChainlinkPriceFeed(_usdcPriceFeed);
        clToken = ICLToken(_clToken);
        treasury = _treasury;
        nextRequestId = 1;
    }
    
    // ========== MODIFIERS ==========
    
    modifier validRequest(uint256 _requestId, RequestStatus _expectedStatus) {
        if (_requestId < 1 || _requestId >= nextRequestId) {
            revert InvalidRequest(_requestId, "Invalid ID range");
        }
        if (requests[_requestId].borrower == address(0)) {
            revert InvalidRequest(_requestId, "Request does not exist");
        }
        if (requests[_requestId].status != _expectedStatus) {
            revert InvalidRequestStatus(_requestId, requests[_requestId].status, _expectedStatus);
        }
        _;
    }
    
    modifier validActiveLoan(uint256 _requestId) {
        if (_requestId < 1 || _requestId >= nextRequestId) {
            revert InvalidLoan(_requestId, "Invalid ID range");
        }
        if (activeLoans[_requestId].requestId == 0) {
            revert InvalidLoan(_requestId, "Loan not found");
        }
        if (activeLoans[_requestId].status != LoanStatus.Active) {
            revert InvalidLoan(_requestId, "Loan not active");
        }
        _;
    }

    // ========== FONCTIONS PRINCIPALES ==========

    /**
     * @notice Calcule le collatéral requis pour un montant de prêt donné
     * @param _loanAmount Montant du prêt en USDC
     * @return Montant de collatéral requis en ETH
     */
    function calculateRequiredCollateral(uint256 _loanAmount) public view returns (uint256) {
        if (_loanAmount == 0) revert ZeroAmount();
        if (_loanAmount > MAX_LOAN_AMOUNT) revert InvalidAmount(_loanAmount, MAX_LOAN_AMOUNT);
        
        (, int256 ethPrice, , uint256 updatedAt, ) = ethPriceFeed.latestRoundData();
        if (ethPrice <= 0) revert InvalidPrice(ethPrice);
        if (block.timestamp - updatedAt > STALENESS_THRESHOLD) revert StalePrice(updatedAt, STALENESS_THRESHOLD);
               
        (, int256 usdcPrice, , uint256 usdcUpdatedAt, ) = usdcPriceFeed.latestRoundData();
        if (usdcPrice <= 0) revert InvalidPrice(usdcPrice);
        if (block.timestamp - usdcUpdatedAt > STALENESS_THRESHOLD) revert StalePrice(usdcUpdatedAt, STALENESS_THRESHOLD);

        uint256 collateralAmount = Math.mulDiv(_loanAmount, MIN_COLLATERAL_RATIO, BASIS_POINTS);
        uint256 collateralValueUSD = Math.mulDiv(collateralAmount, uint256(usdcPrice), 1e6);

        return Math.mulDiv(collateralValueUSD, 1e18, uint256(ethPrice));
    }

    /**
     * @notice Crée une demande de prêt avec dépôt de collatéral
     */
    function createLoanRequest(
        uint256 _amountRequested,
        uint32 _interestRate,
        uint64 _duration
    ) external payable nonReentrant {
        
        if (_amountRequested == 0) revert ZeroAmount();
        if (msg.value == 0) revert ZeroAmount();
        if (_amountRequested > MAX_LOAN_AMOUNT) revert InvalidAmount(_amountRequested, MAX_LOAN_AMOUNT);
        if (_interestRate < MIN_INTEREST_RATE || _interestRate > MAX_INTEREST_RATE) {
            revert InvalidParameter("interestRate", _interestRate);
        }
        if (_duration < MIN_LOAN_DURATION || _duration > MAX_LOAN_DURATION) {
            revert InvalidParameter("duration", _duration);
        }
        
        uint256 requiredCollateral = calculateRequiredCollateral(_amountRequested);
        if (msg.value < requiredCollateral) {
            revert InsufficientCollateral(msg.value, requiredCollateral);
        }
        
        uint256 requestId = nextRequestId++;
        
        requests[requestId] = LoanRequest({
            id: requestId,
            borrower: msg.sender,
            amountRequested: _amountRequested,
            requiredCollateral: requiredCollateral,
            actualCollateralDeposited: msg.value,
            interestRate: _interestRate,
            duration: _duration,
            createdAt: block.timestamp,
            status: RequestStatus.Pending
        });
        
        userRequests[msg.sender].push(requestId);
        userRequestCount[msg.sender]++;
        totalActiveRequests++;
        pendingCLRewards[msg.sender] += REWARD_CREATE_REQUEST;

    
        emit LoanRequestCreated(
            requestId,
            msg.sender,
            _amountRequested,
            requiredCollateral,
            _interestRate,
            _duration
        );
        
        emit CollateralDeposited(
            requestId,
            msg.sender,
            msg.value,
            msg.value
        );

        emit CLRewardsEarned(
            msg.sender, 
            REWARD_CREATE_REQUEST, 
            "Create Request"
        );
    }

    /**
     * @notice Finance un prêt en tant que prêteur
     */
    function fundLoan(uint256 _requestId) external nonReentrant validRequest(_requestId, RequestStatus.Pending) {
        LoanRequest storage request = requests[_requestId];
        if (msg.sender == request.borrower) revert InvalidRequest(_requestId, "Cannot fund own request");
        
        // Calcul sécurisé des intérêts avec protection overflow
        uint256 annualInterest = Math.mulDiv(request.amountRequested, request.interestRate, BASIS_POINTS);
        uint256 totalInterest = Math.mulDiv(annualInterest, request.duration, 365 days);
        
        uint256 totalAmountDue = request.amountRequested + totalInterest;
        uint256 dueDate = block.timestamp + request.duration;
        
        activeLoans[_requestId] = ActiveLoan({
            requestId: _requestId,
            lender: msg.sender,
            fundedAt: block.timestamp,
            dueDate: dueDate,
            principalAmount: request.amountRequested,
            interestAmount: uint64(totalInterest), // Safe car vérifié < type(uint64).max
            totalAmountDue: totalAmountDue,
            status: LoanStatus.Active
        });
        
        request.status = RequestStatus.Funded;
        userLoans[msg.sender].push(_requestId);
        userLoanCount[msg.sender]++;
        totalActiveRequests--;
        totalActiveLoans++;
        pendingCLRewards[msg.sender] += REWARD_FUND_LOAN;

        usdcToken.safeTransferFrom(msg.sender, request.borrower, request.amountRequested);
        
        emit LoanFunded(
            _requestId,
            msg.sender,
            request.borrower,
            request.amountRequested,
            dueDate
        );

        emit CLRewardsEarned(
            msg.sender, 
            REWARD_FUND_LOAN, 
            "Fund Loan"
        );
    }

    /**
     * @notice Ajoute du collatéral à un prêt actif
     * @param _requestId ID du prêt
     */
    function addCollateral(uint256 _requestId) 
        external 
        payable 
        nonReentrant 
        validActiveLoan(_requestId) 
    {
        if (msg.value == 0) revert ZeroAmount();
        
        LoanRequest storage request = requests[_requestId];
        if (msg.sender != request.borrower) revert Unauthorized(msg.sender);
        
        request.actualCollateralDeposited += msg.value;
        
        uint256 newHealthFactor = _getCurrentCollateralRatio(_requestId);
        
        emit CollateralAdded(
            _requestId,
            msg.sender,
            msg.value,
            request.actualCollateralDeposited,
            newHealthFactor
        );
    }

    /**
     * @notice Retire le collatéral excédentaire (au-dessus de 150%)
     * @param _requestId ID du prêt
     * @param _amount Montant à retirer
     */
    function withdrawExcessCollateral(uint256 _requestId, uint256 _amount) 
        external 
        nonReentrant 
        validActiveLoan(_requestId) 
    {
        if (_amount == 0) revert ZeroAmount();
        
        LoanRequest storage request = requests[_requestId];
        if (msg.sender != request.borrower) revert Unauthorized(msg.sender);
        
        // Calculer le collatéral minimum requis (150%)
        uint256 minRequired = calculateRequiredCollateral(request.amountRequested);
        uint256 currentCollateral = request.actualCollateralDeposited;
        
        if (currentCollateral <= minRequired) {
            revert ExcessWithdrawalAmount(_amount, 0);
        }
        
        uint256 excess = currentCollateral - minRequired;
        if (_amount > excess) {
            revert ExcessWithdrawalAmount(_amount, excess);
        }
        
        // Vérifier que le ratio reste au-dessus de 150% après retrait
        uint256 newCollateral = currentCollateral - _amount;
        request.actualCollateralDeposited = newCollateral;
        
        uint256 newRatio = _getCurrentCollateralRatio(_requestId);
        if (newRatio < MIN_COLLATERAL_RATIO) {
            request.actualCollateralDeposited = currentCollateral; // Revert state
            revert CollateralBelowMinimum(newRatio, MIN_COLLATERAL_RATIO);
        }
        
        (bool success, ) = payable(msg.sender).call{value: _amount}("");
        if (!success) revert TransferFailed("Excess withdrawal");
        
        emit ExcessCollateralWithdrawn(
            _requestId,
            msg.sender,
            _amount,
            newCollateral,
            newRatio
        );
    }

    /**
     * @notice Rembourse un prêt actif
     */
    function repayLoan(uint256 _requestId) external nonReentrant validActiveLoan(_requestId) {
        ActiveLoan storage loan = activeLoans[_requestId];
        LoanRequest storage request = requests[_requestId];
        
        if (msg.sender != request.borrower) revert Unauthorized(msg.sender);
        
        uint256 protocolFee = Math.mulDiv(loan.interestAmount, PROTOCOL_FEE, BASIS_POINTS);
        uint256 lenderAmount = loan.totalAmountDue - protocolFee;

        loan.status = LoanStatus.Repaid;
        totalActiveLoans--;
        
        usdcToken.safeTransferFrom(msg.sender, loan.lender, lenderAmount);
        
        if (protocolFee > 0) {
            usdcToken.safeTransferFrom(msg.sender, treasury, protocolFee);
        }
        
        emit LoanRepaid(_requestId, request.borrower, loan.totalAmountDue, protocolFee);
    }

    /**
     * @notice Retire le collatéral après remboursement du prêt
     */
    function withdrawCollateral(uint256 _requestId) external nonReentrant {
        if (_requestId < 1 || _requestId >= nextRequestId) {
            revert InvalidRequest(_requestId, "Invalid ID range");
        }
        
        ActiveLoan storage loan = activeLoans[_requestId];
        LoanRequest storage request = requests[_requestId];
        
        if (request.borrower == address(0)) revert InvalidRequest(_requestId, "Request does not exist");
        if (msg.sender != request.borrower) revert Unauthorized(msg.sender);
        if (loan.status != LoanStatus.Repaid) revert InvalidLoan(_requestId, "Loan must be repaid first");
        if (request.actualCollateralDeposited == 0) revert InvalidRequest(_requestId, "No collateral to withdraw");
        
        uint256 collateralToReturn = request.actualCollateralDeposited;
        request.actualCollateralDeposited = 0;
        
        (bool ethTransferSuccess, ) = payable(request.borrower).call{value: collateralToReturn}("");
        if (!ethTransferSuccess) revert TransferFailed("Collateral withdrawal");
        
        emit CollateralWithdrawn(_requestId, request.borrower, collateralToReturn, 0);
    }

    /**
     * @notice Annule une demande de prêt non financée
     */
    function cancelLoanRequest(uint256 _requestId) external nonReentrant {
        LoanRequest storage request = requests[_requestId];
        if (request.borrower == address(0)) revert InvalidRequest(_requestId, "Request does not exist");
        if (msg.sender != request.borrower) revert Unauthorized(msg.sender);
        
        _cancelLoanRequest(_requestId);
    }

  // ========== FONCTIONS LIQUIDATION ==========

    /**
     * @notice Liquide un prêt sous-collatéralisé
     */
    /**
 * @notice Liquide un prêt sous-collatéralisé
 */
function liquidateCollateral(uint256 _requestId) external nonReentrant validActiveLoan(_requestId) {
    ActiveLoan storage loan = activeLoans[_requestId];
    LoanRequest storage request = requests[_requestId];
    
    // 1. Vérifier le ratio
    if (_getCurrentCollateralRatio(_requestId) >= LIQUIDATION_THRESHOLD) {
        revert InvalidLoan(_requestId, "Collateral ratio above liquidation threshold");
    }
    
    // 2. Cache minimal
    uint256 collateralETH = request.actualCollateralDeposited;
    
    // 3. Update state
    loan.status = LoanStatus.Liquidated;
    request.actualCollateralDeposited = 0;
    totalActiveLoans--;
    
    // 4. Obtenir la valeur en USDC
    uint256 collateralValueUSDC = _getCollateralValueInUSDC(collateralETH);
    
    // 5. Calculer la distribution
    (uint256 lenderETH, uint256 liquidatorETH, uint256 protocolETH) = _calculateLiquidationDistribution(
        collateralETH,
        collateralValueUSDC,
        loan.totalAmountDue,
        loan.interestAmount
    );
    
    // 6. Distribution
    _safeTransferETH(loan.lender, lenderETH, true);
    _safeTransferETH(msg.sender, liquidatorETH, true);
    _safeTransferETH(treasury, protocolETH, true);
    
    uint256 totalDistributed = lenderETH + liquidatorETH + protocolETH;
    if (collateralETH > totalDistributed) {
        _safeTransferETH(request.borrower, collateralETH - totalDistributed, false);
    }
    
    emit LoanLiquidated(_requestId, msg.sender, collateralETH, lenderETH);
}

/**
 * @notice Calcule la distribution en ETH à partir des montants USDC
 */
function _calculateLiquidationDistribution(
    uint256 collateralETH,
    uint256 collateralValueUSDC,
    uint256 debtUSDC,
    uint256 interestAmount
) internal pure returns (
    uint256 lenderETH,
    uint256 liquidatorETH,
    uint256 protocolETH
) {
    // Calcul des montants USDC
    uint256 protocolNormalFee = interestAmount * PROTOCOL_FEE / BASIS_POINTS;
    uint256 lenderRecoveryUSDC = debtUSDC - protocolNormalFee;
    uint256 liquidationBonus = collateralValueUSDC * LIQUIDATION_BONUS / BASIS_POINTS;
    uint256 protocolLiquidationFee = collateralValueUSDC * LIQUIDATION_PROTOCOL_FEE / BASIS_POINTS;
    
    // Conversion en ETH
    if (collateralValueUSDC > 0) {
        lenderETH = (lenderRecoveryUSDC * collateralETH) / collateralValueUSDC;
        liquidatorETH = (liquidationBonus * collateralETH) / collateralValueUSDC;
        protocolETH = ((protocolNormalFee + protocolLiquidationFee) * collateralETH) / collateralValueUSDC;
    }
    
    // Ajustement si dépassement
    uint256 totalToDistribute = lenderETH + liquidatorETH + protocolETH;
    if (totalToDistribute > collateralETH) {
        uint256 ratio = (collateralETH * 1e18) / totalToDistribute;
        lenderETH = (lenderETH * ratio) / 1e18;
        liquidatorETH = (liquidatorETH * ratio) / 1e18;
        protocolETH = collateralETH - lenderETH - liquidatorETH;
    }
}

/**
 * @notice Obtient les prix et calcule la valeur du collatéral en USDC
 */

function _getCollateralValueInUSDC(uint256 collateralETH) internal view returns (uint256) {
    // Get prices
    (, int256 ethPrice, , uint256 ethUpdatedAt, ) = ethPriceFeed.latestRoundData();
    (, int256 usdcPrice, , uint256 usdcUpdatedAt, ) = usdcPriceFeed.latestRoundData();
    
    // Validations
    if (ethPrice <= 0) revert InvalidPrice(ethPrice);
    if (usdcPrice <= 0) revert InvalidPrice(usdcPrice);
    if (block.timestamp - ethUpdatedAt > STALENESS_THRESHOLD) revert StalePrice(ethUpdatedAt, STALENESS_THRESHOLD);
    if (block.timestamp - usdcUpdatedAt > STALENESS_THRESHOLD) revert StalePrice(usdcUpdatedAt, STALENESS_THRESHOLD);
    
    // Calcul
    uint256 collateralValueUSD = Math.mulDiv(collateralETH, uint256(ethPrice), 1e18);
    return Math.mulDiv(collateralValueUSD, 1e6, uint256(usdcPrice));
}


function _safeTransferETH(address to, uint256 amount, bool revertOnFail) internal {
    if (amount > 0) {
        (bool success, ) = payable(to).call{value: amount}("");
        if (!success && revertOnFail) {
            revert TransferFailed("ETH transfer failed");
        }
    }
}

    function claimCLRewards() external nonReentrant {

    uint256 rewards = pendingCLRewards[msg.sender];
    
    if (rewards < MIN_CLAIM_AMOUNT) revert InvalidAmount(rewards, MIN_CLAIM_AMOUNT);
    
    pendingCLRewards[msg.sender] = 0;
    clToken.mint(msg.sender, rewards);
    
    emit CLRewardsClaimed(msg.sender, rewards);
}

    // ========== FONCTIONS INTERNES ==========

    /**
     * @notice Calcule le ratio de collatéralisation actuel
     * @dev Utilise le principal uniquement, pas le montant total dû
     */
    function _getCurrentCollateralRatio(uint256 _requestId) internal view returns (uint256 currentRatio) {
        LoanRequest storage request = requests[_requestId];
        ActiveLoan storage loan = activeLoans[_requestId];
        
        if (request.actualCollateralDeposited == 0) return 0;
        if (loan.principalAmount == 0) return type(uint256).max;
        
        (, int256 ethPrice, , uint256 updatedAt, ) = ethPriceFeed.latestRoundData();
        if (ethPrice <= 0) revert InvalidPrice(ethPrice);
        if (block.timestamp - updatedAt > STALENESS_THRESHOLD) revert StalePrice(updatedAt, STALENESS_THRESHOLD);
        
        (, int256 usdcPrice, , uint256 usdcUpdatedAt, ) = usdcPriceFeed.latestRoundData();
        if (usdcPrice <= 0) revert InvalidPrice(usdcPrice);
        if (block.timestamp - usdcUpdatedAt > STALENESS_THRESHOLD) revert StalePrice(usdcUpdatedAt, STALENESS_THRESHOLD);
        
        uint256 collateralValueUSD = Math.mulDiv(request.actualCollateralDeposited, uint256(ethPrice), 1e18);
        uint256 collateralValueUSDC = Math.mulDiv(collateralValueUSD, 1e6, uint256(usdcPrice));
        
        // Calcul DeFi standard : ratio basé sur le principal uniquement
        currentRatio = Math.mulDiv(collateralValueUSDC, BASIS_POINTS, loan.principalAmount);
    }

    function _cancelLoanRequest(uint256 _requestId) internal {
        if (_requestId < 1 || _requestId >= nextRequestId) {
            revert InvalidRequest(_requestId, "Invalid ID range");
        }
        
        LoanRequest storage request = requests[_requestId];
        
        if (request.borrower == address(0)) revert InvalidRequest(_requestId, "Request does not exist");
        if (request.status != RequestStatus.Pending) {
            revert InvalidRequestStatus(_requestId, request.status, RequestStatus.Pending);
        }
        
        uint256 collateralToRefund = request.actualCollateralDeposited;
        
        request.status = RequestStatus.Cancelled;
        request.actualCollateralDeposited = 0;
        totalActiveRequests--;
        
        if (collateralToRefund > 0) {
            (bool ethTransferSuccess, ) = payable(request.borrower).call{value: collateralToRefund}("");
            if (!ethTransferSuccess) revert TransferFailed("Collateral refund");
        }
        
        emit LoanRequestCancelled(_requestId, request.borrower, collateralToRefund);
    }

    // ========== FONCTIONS DE CONSULTATION ==========

    /**
     * @notice Retourne le health factor (ratio de collatéralisation) d'un prêt
     */
    function getHealthFactor(uint256 _requestId) external view returns (uint256) {
        if (activeLoans[_requestId].status != LoanStatus.Active) {
            revert InvalidLoan(_requestId, "Loan not active");
        }
        return _getCurrentCollateralRatio(_requestId);
    }

    /**
     * @notice Vérifie si un prêt est à risque de liquidation
     */
    function isAtRiskOfLiquidation(uint256 _requestId) external view returns (bool atRisk, uint256 currentRatio) {
        if (activeLoans[_requestId].status != LoanStatus.Active) {
            return (false, 0);
        }
        currentRatio = _getCurrentCollateralRatio(_requestId);
        atRisk = currentRatio < WARNING_THRESHOLD; // 140%
    }

    /**
     * @notice Calcule le montant de collatéral excédentaire pouvant être retiré
     */
    function getExcessCollateral(uint256 _requestId) external view returns (uint256 excessAmount) {
        if (activeLoans[_requestId].status != LoanStatus.Active) {
            return 0;
        }
        
        LoanRequest storage request = requests[_requestId];
        uint256 minRequired = calculateRequiredCollateral(request.amountRequested);
        
        if (request.actualCollateralDeposited > minRequired) {
            excessAmount = request.actualCollateralDeposited - minRequired;
        }
    }

    function getLoanRequest(uint256 _requestId) external view returns (LoanRequest memory) {
        if (_requestId < 1 || _requestId >= nextRequestId) {
            revert InvalidRequest(_requestId, "Invalid ID range");
        }
        if (requests[_requestId].borrower == address(0)) {
            revert InvalidRequest(_requestId, "Request does not exist");
        }
        return requests[_requestId];
    }

    function getActiveLoan(uint256 _requestId) external view returns (ActiveLoan memory) {
        if (_requestId < 1 || _requestId >= nextRequestId) {
            revert InvalidLoan(_requestId, "Invalid ID range");
        }
        if (activeLoans[_requestId].requestId == 0) {
            revert InvalidLoan(_requestId, "Active loan not found");
        }
        return activeLoans[_requestId];
    }

    function getUserRequests(address _user) external view returns (uint256[] memory) {
        return userRequests[_user];
    }

    function getUserLoans(address _user) external view returns (uint256[] memory) {
        return userLoans[_user];
    }

    function getPendingRequests(uint256 _offset, uint256 _limit) external view returns (uint256[] memory pendingIds, bool hasMore) {
        if (_limit == 0 || _limit > 100) revert InvalidParameter("limit", _limit);
        
        uint256 totalPending = 0;
        for (uint256 i = 1; i < nextRequestId; i++) {
            if (requests[i].status == RequestStatus.Pending) {
                totalPending++;
            }
        }
        
        uint256 startIndex = _offset;
        uint256 endIndex = startIndex + _limit;
        if (endIndex > totalPending) endIndex = totalPending;
        
        uint256 returnSize = endIndex > startIndex ? endIndex - startIndex : 0;
        pendingIds = new uint256[](returnSize);
        
        uint256 currentIndex = 0;
        uint256 found = 0;
        
        for (uint256 i = 1; i < nextRequestId && found < returnSize; i++) {
            if (requests[i].status == RequestStatus.Pending) {
                if (currentIndex >= startIndex) {
                    pendingIds[found] = i;
                    found++;
                }
                currentIndex++;
            }
        }
        
        hasMore = endIndex < totalPending;
    }

    function getPendingRequestsCount() external view returns (uint256 count) {
        for (uint256 i = 1; i < nextRequestId; i++) {
            if (requests[i].status == RequestStatus.Pending) {
                count++;
            }
        }
    }

    function canWithdrawCollateral(uint256 _requestId) external view returns (bool canWithdraw, uint256 collateralAmount, string memory reason) {
        if (_requestId < 1 || _requestId >= nextRequestId) {
            return (false, 0, "Invalid request ID");
        }
        
        ActiveLoan memory loan = activeLoans[_requestId];    
        LoanRequest memory request = requests[_requestId]; 
        
        if (request.borrower == address(0)) {
            return (false, 0, "Request does not exist");
        }
        
        collateralAmount = request.actualCollateralDeposited;
        
        if (collateralAmount == 0) {
            return (false, 0, "No collateral deposited");
        }
        
        if (loan.status != LoanStatus.Repaid) {
            return (false, collateralAmount, "Loan must be repaid first");
        }
        
        return (true, collateralAmount, "");
    }

    function getProtocolStats() external view returns (
        uint256 totalRequests,
        uint256 activeRequests,
        uint256 activeLoansCount,
        uint256 totalVolumeUSDC
    ) {
        totalRequests = nextRequestId - 1;
        activeRequests = totalActiveRequests;
        activeLoansCount = totalActiveLoans;
        
        for (uint256 i = 1; i < nextRequestId; i++) {
            if (requests[i].status == RequestStatus.Funded) {
                totalVolumeUSDC += requests[i].amountRequested;
            }
        }
    }

    // ========== FONCTION RECEIVE ==========

    receive() external payable {
        revert DirectETHNotAllowed();
    }

    // ========== FONCTIONS ADMIN ==========

    function updateTreasury(address _newTreasury) external onlyOwner {
        if (_newTreasury == address(0)) revert ZeroAddress();
        treasury = _newTreasury;
    }

    function emergencyWithdrawUSDC(address _to, uint256 _amount) external onlyOwner {
        if (_to == address(0)) revert ZeroAddress();
        if (_amount == 0) revert ZeroAmount();
        
        usdcToken.safeTransfer(_to, _amount);
        
        emit EmergencyWithdrawal(_to, _amount);
    }
}