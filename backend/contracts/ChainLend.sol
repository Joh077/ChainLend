// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "./interfaces/IChainlinkPriceFeed.sol";
import "./interfaces/IChainLend.sol";

/**
 * @title ChainLend P2P Lending Protocol
 * @author Johan L.
 * @notice A decentralized peer-to-peer lending protocol with ETH collateral
 * @dev This contract enables users to create loan requests with ETH collateral and allows lenders to fund them
 * Features include dynamic collateral management and CL token rewards
 */

interface ICLToken {
    /**
     * @notice Mints CL tokens to a specified address
     * @param to The address to mint tokens to
     * @param amount The amount of tokens to mint
     */
    function mint(address to, uint256 amount) external;
}

contract ChainLend is IChainLend, Ownable, ReentrancyGuard {
    
    using SafeERC20 for IERC20;

    // ============ CONSTANTS ============
    
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant MIN_COLLATERAL_RATIO = 15000;
    uint256 public constant LIQUIDATION_THRESHOLD = 13000;
    uint256 public constant WARNING_THRESHOLD = 14000;
    uint256 public constant PROTOCOL_FEE = 1000;
    uint256 public constant STALENESS_THRESHOLD = 86400;
    uint256 public constant MIN_INTEREST_RATE = 500;
    uint256 public constant MAX_INTEREST_RATE = 1500;
    uint256 public constant MIN_LOAN_DURATION = 30 days;
    uint256 public constant MAX_LOAN_DURATION = 1095 days;
    uint256 public constant MAX_LOAN_AMOUNT = 500000 * 1e6;
    
    // ============ REWARD CONSTANTS ============
    
    uint256 public constant REWARD_CREATE_REQUEST = 10 * 1e18;
    uint256 public constant REWARD_FUND_LOAN = 50 * 1e18;
    uint256 public constant REWARD_REPAY_ONTIME = 100 * 1e18;
    uint256 public constant MIN_CLAIM_AMOUNT = 10 * 1e18;

    // ============ STATE VARIABLES ============
    
    /// @notice USDC token contract
    IERC20 public immutable usdcToken;
    
    /// @notice Chainlink ETH price feed
    IChainlinkPriceFeed public immutable ethPriceFeed;
    
    /// @notice Chainlink USDC price feed
    IChainlinkPriceFeed public immutable usdcPriceFeed;
    
    /// @notice CL token contract for rewards
    ICLToken public immutable clToken;
    
    address public treasury;

    uint256 public nextRequestId;
    uint256 public totalActiveRequests;
    uint256 public totalActiveLoans;
    
    mapping(uint256 => LoanRequest) public requests; /// @notice Mapping of request ID to loan request data
    mapping(uint256 => ActiveLoan) public activeLoans; /// @notice Mapping of request ID to active loan data
    mapping(address => uint256[]) public userRequests; /// @notice Mapping of user address to their request IDs
    mapping(address => uint256[]) public userLoans; /// @notice Mapping of user address to their loan IDs (as lender)
    mapping(address => uint256) public userRequestCount; /// @notice Mapping of user address to their request count
    mapping(address => uint256) public userLoanCount; /// @notice Mapping of user address to their loan count (as lender)
    mapping(address => uint256) public pendingCLRewards; /// @notice Mapping of user address to their pending CL rewards
    
    // ============ CONSTRUCTOR ============
    
    /**
     * @notice Initializes the ChainLend contract
     * @param _usdcToken Address of the USDC token contract
     * @param _ethPriceFeed Address of the Chainlink ETH price feed
     * @param _treasury Address of the treasury for protocol fees
     * @param _usdcPriceFeed Address of the Chainlink USDC price feed
     * @param _clToken Address of the CL token contract
     * @param _initialOwner Address of the initial owner of the contract
     */
    constructor( address _usdcToken, address _ethPriceFeed, address _treasury, address _usdcPriceFeed, address _clToken, address _initialOwner)
     Ownable(_initialOwner) {
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
    
    // ============ MODIFIERS ============
    
    /**
     * @notice Validates request ID and status
     * @param _requestId The request ID to validate
     * @param _expectedStatus The expected status of the request
     */
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
    
    /**
     * @notice Validates that the loan is active
     * @param _requestId The request ID to validate
     */
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

    // ============ MAIN FUNCTIONS ============

    /**
     * @inheritdoc IChainLend
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
     * @inheritdoc IChainLend
     */
    function createLoanRequest( uint256 _amountRequested, uint32 _interestRate, uint64 _duration) external payable nonReentrant {
        
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

        emit LoanRequestCreated(requestId, msg.sender, _amountRequested, requiredCollateral, _interestRate, _duration);
        emit CollateralDeposited(requestId, msg.sender, msg.value, msg.value);
        emit CLRewardsEarned(msg.sender, REWARD_CREATE_REQUEST, "Create Request");
    }

    /**
     * @inheritdoc IChainLend
     */
    function fundLoan(uint256 _requestId) external nonReentrant validRequest(_requestId, RequestStatus.Pending) {
        LoanRequest storage request = requests[_requestId];
        if (msg.sender == request.borrower) revert InvalidRequest(_requestId, "Cannot fund own request");
        
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
            interestAmount: uint64(totalInterest),
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
        
        emit LoanFunded(_requestId, msg.sender, request.borrower, request.amountRequested, dueDate);
        emit CLRewardsEarned(msg.sender, REWARD_FUND_LOAN, "Fund Loan");
    }

    /**
     * @inheritdoc IChainLend
     */
    function addCollateral(uint256 _requestId) external payable nonReentrant validActiveLoan(_requestId) {
        if (msg.value == 0) revert ZeroAmount();
        
        LoanRequest storage request = requests[_requestId];
        if (msg.sender != request.borrower) revert Unauthorized(msg.sender);
        
        request.actualCollateralDeposited += msg.value;
        
        uint256 newHealthFactor = _getCurrentCollateralRatio(_requestId);
        
        emit CollateralAdded(_requestId, msg.sender, msg.value, request.actualCollateralDeposited, newHealthFactor);
    }

    /**
     * @inheritdoc IChainLend
     */
    function withdrawExcessCollateral(uint256 _requestId, uint256 _amount) external nonReentrant validActiveLoan(_requestId) {
        if (_amount == 0) revert ZeroAmount();
        
        LoanRequest storage request = requests[_requestId];
        if (msg.sender != request.borrower) revert Unauthorized(msg.sender);
        
        uint256 minRequired = calculateRequiredCollateral(request.amountRequested);
        uint256 currentCollateral = request.actualCollateralDeposited;
        
        if (currentCollateral <= minRequired) {
            revert ExcessWithdrawalAmount(_amount, 0);
        }
        
        uint256 excess = currentCollateral - minRequired;
        if (_amount > excess) {
            revert ExcessWithdrawalAmount(_amount, excess);
        }
        
        uint256 newCollateral = currentCollateral - _amount;
        request.actualCollateralDeposited = newCollateral;
        
        uint256 newRatio = _getCurrentCollateralRatio(_requestId);

        if (newRatio < MIN_COLLATERAL_RATIO) {
            request.actualCollateralDeposited = currentCollateral; 
            revert CollateralBelowMinimum(newRatio, MIN_COLLATERAL_RATIO);
        }
        
        (bool success, ) = payable(msg.sender).call{value: _amount}("");
        if (!success) revert TransferFailed("Excess withdrawal");
        
        emit ExcessCollateralWithdrawn(_requestId, msg.sender, _amount, newCollateral, newRatio);
    }

    /**
     * @inheritdoc IChainLend
     */
    function repayLoan(uint256 _requestId) external nonReentrant validActiveLoan(_requestId) {
        ActiveLoan storage loan = activeLoans[_requestId];
        LoanRequest storage request = requests[_requestId];
        
        if (msg.sender != request.borrower) revert Unauthorized(msg.sender);
        
        uint256 protocolFee = Math.mulDiv(loan.interestAmount, PROTOCOL_FEE, BASIS_POINTS);
        uint256 lenderAmount = loan.totalAmountDue - protocolFee;

        loan.status = LoanStatus.Repaid;
        totalActiveLoans--;
        pendingCLRewards[msg.sender] += REWARD_REPAY_ONTIME;
        
        usdcToken.safeTransferFrom(msg.sender, loan.lender, lenderAmount);
        
        if (protocolFee > 0) {
            usdcToken.safeTransferFrom(msg.sender, treasury, protocolFee);
        }
        
        emit LoanRepaid(_requestId, request.borrower, loan.totalAmountDue, protocolFee);
        emit CLRewardsEarned(msg.sender, REWARD_REPAY_ONTIME, "Repay Loan");
    }

    /**
     * @inheritdoc IChainLend
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
     * @inheritdoc IChainLend
     */
    function cancelLoanRequest(uint256 _requestId) external nonReentrant {
        LoanRequest storage request = requests[_requestId];
        if (request.borrower == address(0)) revert InvalidRequest(_requestId, "Request does not exist");
        if (msg.sender != request.borrower) revert Unauthorized(msg.sender);
        
        _cancelLoanRequest(_requestId);
    }

    /**
     * @inheritdoc IChainLend
     */
    function claimCLRewards() external nonReentrant {
        uint256 rewards = pendingCLRewards[msg.sender];
        
        if (rewards < MIN_CLAIM_AMOUNT) revert InvalidAmount(rewards, MIN_CLAIM_AMOUNT);
        
        pendingCLRewards[msg.sender] = 0;
        clToken.mint(msg.sender, rewards);
        
        emit CLRewardsClaimed(msg.sender, rewards);
    }

    // ============ GETTERS ============

    /**
     * @inheritdoc IChainLend
     */
    function getHealthFactor(uint256 _requestId) external view returns (uint256) {
        if (activeLoans[_requestId].status != LoanStatus.Active) {
            revert InvalidLoan(_requestId, "Loan not active");
        }
        return _getCurrentCollateralRatio(_requestId);
    }

    /**
     * @inheritdoc IChainLend
     */
    function isAtRiskOfLiquidation(uint256 _requestId) external view returns (bool atRisk, uint256 currentRatio) {
        if (activeLoans[_requestId].status != LoanStatus.Active) {
            return (false, 0);
        }
        currentRatio = _getCurrentCollateralRatio(_requestId);
        atRisk = currentRatio < WARNING_THRESHOLD; 
    }

    /**
     * @inheritdoc IChainLend
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

    /**
     * @inheritdoc IChainLend
     */
    function getLoanRequest(uint256 _requestId) external view returns (LoanRequest memory) {
        if (_requestId < 1 || _requestId >= nextRequestId) {
            revert InvalidRequest(_requestId, "Invalid ID range");
        }
        if (requests[_requestId].borrower == address(0)) {
            revert InvalidRequest(_requestId, "Request does not exist");
        }
        return requests[_requestId];
    }

    /**
     * @inheritdoc IChainLend
     */
    function getActiveLoan(uint256 _requestId) external view returns (ActiveLoan memory) {
        if (_requestId < 1 || _requestId >= nextRequestId) {
            revert InvalidLoan(_requestId, "Invalid ID range");
        }
        if (activeLoans[_requestId].requestId == 0) {
            revert InvalidLoan(_requestId, "Active loan not found");
        }
        return activeLoans[_requestId];
    }

    /**
     * @inheritdoc IChainLend
     */
    function getUserRequests(address _user) external view returns (uint256[] memory) {
        return userRequests[_user];
    }

    /**
     * @inheritdoc IChainLend
     */
    function getUserLoans(address _user) external view returns (uint256[] memory) {
        return userLoans[_user];
    }

    /**
     * @inheritdoc IChainLend
     */
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

    /**
     * @inheritdoc IChainLend
     */
    function getPendingRequestsCount() external view returns (uint256 count) {
        for (uint256 i = 1; i < nextRequestId; i++) {
            if (requests[i].status == RequestStatus.Pending) {
                count++;
            }
        }
    }

    /**
     * @inheritdoc IChainLend
     */
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

    /**
     * @inheritdoc IChainLend
     */
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

    // ============ INTERNAL FUNCTIONS ============

    /**
     * @dev Calculates the current collateral ratio for an active loan
     * @param _requestId The ID of the loan
     * @return currentRatio The collateral ratio in basis points
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
        
        currentRatio = Math.mulDiv(collateralValueUSDC, BASIS_POINTS, loan.principalAmount);
    }

    /**
     * @dev Internal function to cancel a loan request
     * @param _requestId The ID of the request to cancel
     */
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

    // ============ ADMIN FUNCTIONS ============

    /**
     * @inheritdoc IChainLend
     */
    function updateTreasury(address _newTreasury) external onlyOwner {
        if (_newTreasury == address(0)) revert ZeroAddress();
        treasury = _newTreasury;
    }

    /**
     * @inheritdoc IChainLend
     */
    function emergencyWithdrawUSDC(address _to, uint256 _amount) external onlyOwner {
        if (_to == address(0)) revert ZeroAddress();
        if (_amount == 0) revert ZeroAmount();
        
        usdcToken.safeTransfer(_to, _amount);
        
        emit EmergencyWithdrawal(_to, _amount);
    }

    // ============ RECEIVE FUNCTION ============

    /**
     * @notice Prevents direct ETH transfers to the contract
     * @dev All ETH must be sent through proper functions like createLoanRequest
     */
    receive() external payable {
        revert DirectETHNotAllowed();
    }
}