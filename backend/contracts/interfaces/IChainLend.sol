
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IChainLend Interface
 * @author ChainLend Team
 * @notice Interface for ChainLend P2P Lending Protocol with ETH collateral
 * @dev This interface defines all functions, events, and structures for the ChainLend protocol
 */
interface IChainLend {
    
    // ============ ERRORS ============
    
    error ZeroAddress();
    error ZeroAmount();
    error InvalidAmount(uint256 amount, uint256 limit);
    error Unauthorized(address caller);
    error TransferFailed(string transferType);
    error InvalidRequest(uint256 requestId, string reason);
    error InvalidRequestStatus(uint256 requestId, RequestStatus current, RequestStatus expected);
    error InvalidLoan(uint256 requestId, string reason);
    error InvalidPrice(int256 price);
    error StalePrice(uint256 lastUpdate, uint256 maxAge);
    error InvalidParameter(string param, uint256 value);
    error DirectETHNotAllowed();
    error InsufficientCollateral(uint256 deposited, uint256 required);
    error ExcessWithdrawalAmount(uint256 requested, uint256 available);
    error CollateralBelowMinimum(uint256 resultingRatio, uint256 minimumRatio);

    // ============ ENUMS ============
    
    /// @notice Status of a loan request
    enum RequestStatus { Pending, Funded, Cancelled }
    
    /// @notice Status of an active loan
    enum LoanStatus { Active, Repaid, Liquidated }
    
    // ============ STRUCTS ============
    
    /// @notice Structure representing a loan request
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
    
    /// @notice Structure representing an active loan
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

    // ============ EVENTS ============
    
    /**
     * @notice Emitted when a loan request is created
     * @param requestId The ID of the created request
     * @param borrower The address of the borrower
     * @param amountRequested The amount of USDC requested
     * @param requiredCollateral The minimum required collateral
     * @param interestRate The annual interest rate in basis points
     * @param duration The loan duration in seconds
     */
    event LoanRequestCreated(
        uint256 indexed requestId, 
        address indexed borrower,
        uint256 amountRequested,
        uint256 requiredCollateral,
        uint256 interestRate,
        uint256 duration
    );
    
    /**
     * @notice Emitted when collateral is deposited
     * @param requestId The ID of the request
     * @param borrower The address of the borrower
     * @param amount The amount of collateral deposited
     * @param totalDeposited The total amount of collateral now deposited
     */
    event CollateralDeposited(
        uint256 indexed requestId, 
        address indexed borrower, 
        uint256 amount, 
        uint256 totalDeposited
    );
    
    /**
     * @notice Emitted when additional collateral is added to an active loan
     * @param requestId The ID of the loan
     * @param borrower The address of the borrower
     * @param amountAdded The amount of collateral added
     * @param newTotalCollateral The new total collateral amount
     * @param newHealthFactor The new health factor after addition
     */
    event CollateralAdded(
        uint256 indexed requestId,
        address indexed borrower,
        uint256 amountAdded,
        uint256 newTotalCollateral,
        uint256 newHealthFactor
    );
    
    /**
     * @notice Emitted when excess collateral is withdrawn
     * @param requestId The ID of the loan
     * @param borrower The address of the borrower
     * @param amountWithdrawn The amount of excess collateral withdrawn
     * @param remainingCollateral The remaining collateral amount
     * @param newHealthFactor The new health factor after withdrawal
     */
    event ExcessCollateralWithdrawn(
        uint256 indexed requestId,
        address indexed borrower,
        uint256 amountWithdrawn,
        uint256 remainingCollateral,
        uint256 newHealthFactor
    );
    
    /**
     * @notice Emitted when a loan is funded
     * @param requestId The ID of the funded request
     * @param lender The address of the lender
     * @param borrower The address of the borrower
     * @param amount The amount of USDC lent
     * @param dueDate The due date for loan repayment
     */
    event LoanFunded(
        uint256 indexed requestId,
        address indexed lender,
        address indexed borrower,
        uint256 amount,
        uint256 dueDate
    );
    
    /**
     * @notice Emitted when a loan is repaid
     * @param requestId The ID of the repaid loan
     * @param borrower The address of the borrower
     * @param totalAmount The total amount repaid
     * @param protocolFee The protocol fee deducted
     */
    event LoanRepaid(
        uint256 indexed requestId, 
        address indexed borrower, 
        uint256 totalAmount, 
        uint256 protocolFee
    );

    /**
     * @notice Emitted when collateral is withdrawn after loan repayment
     * @param requestId The ID of the loan
     * @param borrower The address of the borrower
     * @param amountWithdrawn The amount of collateral withdrawn
     * @param remainingCollateral The remaining collateral (should be 0)
     */
    event CollateralWithdrawn(
        uint256 indexed requestId,
        address indexed borrower,
        uint256 amountWithdrawn,
        uint256 remainingCollateral
    );
    
    /**
     * @notice Emitted when a loan request is cancelled
     * @param requestId The ID of the cancelled request
     * @param borrower The address of the borrower
     * @param collateralRefunded The amount of collateral refunded
     */
    event LoanRequestCancelled(
        uint256 indexed requestId, 
        address indexed borrower, 
        uint256 collateralRefunded
    );

    /**
     * @notice Emitted when emergency USDC withdrawal is performed
     * @param to The address receiving the withdrawn USDC
     * @param amount The amount of USDC withdrawn
     */
    event EmergencyWithdrawal(address indexed to, uint256 amount);

    /**
     * @notice Emitted when CL rewards are earned
     * @param user The address earning the rewards
     * @param amount The amount of CL tokens earned
     * @param action The action that triggered the reward
     */
    event CLRewardsEarned(address indexed user, uint256 amount, string action);

    /**
     * @notice Emitted when CL rewards are claimed
     * @param user The address claiming the rewards
     * @param amount The amount of CL tokens claimed
     */
    event CLRewardsClaimed(address indexed user, uint256 amount);

    // ============ MAIN FUNCTIONS ============

    /**
     * @notice Calculates the required collateral for a given loan amount
     * @dev Uses Chainlink price feeds to get current ETH and USDC prices
     * @param _loanAmount The amount of USDC to borrow
     * @return The required collateral amount in ETH (wei)
     */
    function calculateRequiredCollateral(uint256 _loanAmount) external view returns (uint256);

    /**
     * @notice Creates a new loan request with ETH collateral
     * @dev Borrower must send sufficient ETH as collateral (msg.value)
     * @param _amountRequested The amount of USDC to borrow
     * @param _interestRate The annual interest rate in basis points
     * @param _duration The loan duration in seconds
     */
    function createLoanRequest(
        uint256 _amountRequested, 
        uint32 _interestRate, 
        uint64 _duration
    ) external payable;

    /**
     * @notice Funds a loan request as a lender
     * @dev Transfers USDC from lender to borrower and creates an active loan
     * @param _requestId The ID of the request to fund
     */
    function fundLoan(uint256 _requestId) external;

    /**
     * @notice Adds additional collateral to an active loan
     * @dev Only the borrower can add collateral to their loan
     * @param _requestId The ID of the loan to add collateral to
     */
    function addCollateral(uint256 _requestId) external payable;

    /**
     * @notice Withdraws excess collateral (above 150% ratio)
     * @dev Only the borrower can withdraw excess collateral from their active loan
     * @param _requestId The ID of the loan
     * @param _amount The amount of excess collateral to withdraw
     */
    function withdrawExcessCollateral(uint256 _requestId, uint256 _amount) external;

    /**
     * @notice Repays an active loan
     * @dev Only the borrower can repay their loan. Transfers total amount due to lender and protocol fee to treasury
     * @param _requestId The ID of the loan to repay
     */
    function repayLoan(uint256 _requestId) external;

    /**
     * @notice Withdraws collateral after loan repayment
     * @dev Only the borrower can withdraw their collateral after repaying the loan
     * @param _requestId The ID of the repaid loan
     */
    function withdrawCollateral(uint256 _requestId) external;

    /**
     * @notice Cancels a pending loan request
     * @dev Only the borrower can cancel their own pending request. Refunds the collateral
     * @param _requestId The ID of the request to cancel
     */
    function cancelLoanRequest(uint256 _requestId) external;

    /**
     * @notice Claims accumulated CL token rewards
     * @dev Mints CL tokens to the caller if they have sufficient pending rewards
     */
    function claimCLRewards() external;

    // ============ GETTERS ============

    /**
     * @notice Returns the health factor (collateral ratio) of an active loan
     * @param _requestId The ID of the loan
     * @return The current collateral ratio in basis points
     */
    function getHealthFactor(uint256 _requestId) external view returns (uint256);

    /**
     * @notice Checks if a loan is at risk of liquidation
     * @param _requestId The ID of the loan to check
     * @return atRisk True if the loan is below the warning threshold
     * @return currentRatio The current collateral ratio
     */
    function isAtRiskOfLiquidation(uint256 _requestId) external view returns (bool atRisk, uint256 currentRatio);

    /**
     * @notice Calculates the amount of excess collateral that can be withdrawn
     * @param _requestId The ID of the loan
     * @return excessAmount The amount of excess collateral in wei
     */
    function getExcessCollateral(uint256 _requestId) external view returns (uint256 excessAmount);

    /**
     * @notice Returns loan request data
     * @param _requestId The ID of the request
     * @return The loan request struct
     */
    function getLoanRequest(uint256 _requestId) external view returns (LoanRequest memory);

    /**
     * @notice Returns active loan data
     * @param _requestId The ID of the loan
     * @return The active loan struct
     */
    function getActiveLoan(uint256 _requestId) external view returns (ActiveLoan memory);

    /**
     * @notice Returns all request IDs for a user
     * @param _user The address of the user
     * @return Array of request IDs created by the user
     */
    function getUserRequests(address _user) external view returns (uint256[] memory);

    /**
     * @notice Returns all loan IDs where user is the lender
     * @param _user The address of the user
     * @return Array of loan IDs where the user is the lender
     */
    function getUserLoans(address _user) external view returns (uint256[] memory);

    /**
     * @notice Returns pending request IDs with pagination
     * @param _offset The starting index for pagination
     * @param _limit The maximum number of results to return (max 100)
     * @return pendingIds Array of pending request IDs
     * @return hasMore True if there are more results beyond this page
     */
    function getPendingRequests(uint256 _offset, uint256 _limit) external view returns (uint256[] memory pendingIds, bool hasMore);

    /**
     * @notice Returns the total count of pending requests
     * @return count The number of pending requests
     */
    function getPendingRequestsCount() external view returns (uint256 count);

    /**
     * @notice Checks if collateral can be withdrawn for a request
     * @param _requestId The ID of the request
     * @return canWithdraw True if collateral can be withdrawn
     * @return collateralAmount The amount of collateral available
     * @return reason Human-readable reason if withdrawal is not possible
     */
    function canWithdrawCollateral(uint256 _requestId) external view returns (bool canWithdraw, uint256 collateralAmount, string memory reason);

    /**
     * @notice Returns protocol statistics
     * @return totalRequests Total number of requests created
     * @return activeRequests Number of active (pending) requests
     * @return activeLoansCount Number of active loans
     * @return totalVolumeUSDC Total volume of USDC lent through the protocol
     */
    function getProtocolStats() external view returns (
        uint256 totalRequests,
        uint256 activeRequests,
        uint256 activeLoansCount,
        uint256 totalVolumeUSDC
    );

    // ============ ADMIN FUNCTIONS ============

    /**
     * @notice Updates the treasury address
     * @dev Only the contract owner can update the treasury
     * @param _newTreasury The new treasury address
     */
    function updateTreasury(address _newTreasury) external;

    /**
     * @notice Emergency withdrawal of USDC from the contract
     * @dev Only the contract owner can perform emergency withdrawals
     * @param _to The address to send the USDC to
     * @param _amount The amount of USDC to withdraw
     */
    function emergencyWithdrawUSDC(address _to, uint256 _amount) external;
}