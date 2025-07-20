// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ICLToken {
    function mint(address to, uint256 amount) external;
}

interface IChainLend {
    
    enum RequestStatus { Pending, Funded, Cancelled }
    
    enum LoanStatus { Active, Repaid, Liquidated }
    
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
    
    
    event LoanRequestCancelled(
        uint256 indexed requestId, 
        address indexed borrower, 
        uint256 collateralRefunded
    );

    event EmergencyWithdrawal(address indexed to, uint256 amount);

    event CLRewardsEarned(address indexed user, uint256 amount, string action);

    event CLRewardsClaimed(address indexed user, uint256 amount);
    

    function BASIS_POINTS() external view returns (uint256);
    function MIN_COLLATERAL_RATIO() external view returns (uint256);
    function LIQUIDATION_THRESHOLD() external view returns (uint256);
    function WARNING_THRESHOLD() external view returns (uint256);
    function PROTOCOL_FEE() external view returns (uint256);
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
    
    function calculateRequiredCollateral(uint256 _loanAmount) external view returns (uint256);

    function createLoanRequest(
        uint256 _amountRequested, 
        uint32 _interestRate, 
        uint64 _duration
    ) external payable;

    function fundLoan(uint256 _requestId) external;

    function addCollateral(uint256 _requestId) external payable;

    function withdrawExcessCollateral(uint256 _requestId, uint256 _amount) external;

    function repayLoan(uint256 _requestId) external;

    function withdrawCollateral(uint256 _requestId) external;

    function cancelLoanRequest(uint256 _requestId) external;

    function claimCLRewards() external;
    
    // ========== VIEW FUNCTIONS ==========

    function getHealthFactor(uint256 _requestId) external view returns (uint256);

    function isAtRiskOfLiquidation(uint256 _requestId) external view returns (bool atRisk, uint256 currentRatio);

    function getExcessCollateral(uint256 _requestId) external view returns (uint256 excessAmount);

    function getLoanRequest(uint256 _requestId) external view returns (LoanRequest memory);

    function getActiveLoan(uint256 _requestId) external view returns (ActiveLoan memory);

    function getUserRequests(address _user) external view returns (uint256[] memory);

    function getUserLoans(address _user) external view returns (uint256[] memory);

    function getPendingRequests(uint256 _offset, uint256 _limit) 
        external view returns (uint256[] memory pendingIds, bool hasMore);

    function getPendingRequestsCount() external view returns (uint256 count);

    function canWithdrawCollateral(uint256 _requestId) 
        external view returns (bool canWithdraw, uint256 collateralAmount, string memory reason);


    function getProtocolStats() external view returns (
        uint256 totalRequests,
        uint256 activeRequests,
        uint256 activeLoansCount,
        uint256 totalVolumeUSDC
    );
    
    // ========== ADMIN FUNCTIONS ==========

    function updateTreasury(address _newTreasury) external;


    function emergencyWithdrawUSDC(address _to, uint256 _amount) external;
}