// constants/index.js

// Adresses des contrats déployés sur localhost persistant (ETH à 3000$)
export const contractAddress = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";
export const usdcAddress = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
export const clTokenAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
export const ethPriceFeedAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
export const usdcPriceFeedAddress = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";

// ABI COMPLET pour ChainLendCore (toutes les fonctions nécessaires)
export const contractAbi = [
  {
    "inputs": [
      {"internalType": "uint256", "name": "_amountRequested", "type": "uint256"},
      {"internalType": "uint32", "name": "_interestRate", "type": "uint32"},
      {"internalType": "uint64", "name": "_duration", "type": "uint64"}
    ],
    "name": "createLoanRequest",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "_requestId", "type": "uint256"}
    ],
    "name": "fundLoan",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "_loanAmount", "type": "uint256"}
    ],
    "name": "calculateRequiredCollateral",
    "outputs": [
      {"internalType": "uint256", "name": "", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "_requestId", "type": "uint256"}
    ],
    "name": "getLoanRequest",
    "outputs": [
      {
        "components": [
          {"internalType": "uint256", "name": "id", "type": "uint256"},
          {"internalType": "uint256", "name": "amountRequested", "type": "uint256"},
          {"internalType": "uint256", "name": "requiredCollateral", "type": "uint256"},
          {"internalType": "uint256", "name": "actualCollateralDeposited", "type": "uint256"},
          {"internalType": "uint256", "name": "createdAt", "type": "uint256"},
          {"internalType": "address", "name": "borrower", "type": "address"},
          {"internalType": "uint64", "name": "duration", "type": "uint64"},
          {"internalType": "uint32", "name": "interestRate", "type": "uint32"},
          {"internalType": "enum ChainLendCore.RequestStatus", "name": "status", "type": "uint8"}
        ],
        "internalType": "struct ChainLendCore.LoanRequest",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "_offset", "type": "uint256"},
      {"internalType": "uint256", "name": "_limit", "type": "uint256"}
    ],
    "name": "getPendingRequests",
    "outputs": [
      {"internalType": "uint256[]", "name": "pendingIds", "type": "uint256[]"},
      {"internalType": "bool", "name": "hasMore", "type": "bool"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getPendingRequestsCount",
    "outputs": [
      {"internalType": "uint256", "name": "count", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "_user", "type": "address"}
    ],
    "name": "getUserRequests",
    "outputs": [
      {"internalType": "uint256[]", "name": "", "type": "uint256[]"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "_user", "type": "address"}
    ],
    "name": "getUserLoans",
    "outputs": [
      {"internalType": "uint256[]", "name": "", "type": "uint256[]"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "_requestId", "type": "uint256"}
    ],
    "name": "getActiveLoan",
    "outputs": [
      {
        "components": [
          {"internalType": "uint256", "name": "requestId", "type": "uint256"},
          {"internalType": "uint256", "name": "fundedAt", "type": "uint256"},
          {"internalType": "uint256", "name": "dueDate", "type": "uint256"},
          {"internalType": "uint256", "name": "principalAmount", "type": "uint256"},
          {"internalType": "uint256", "name": "totalAmountDue", "type": "uint256"},
          {"internalType": "address", "name": "lender", "type": "address"},
          {"internalType": "uint64", "name": "interestAmount", "type": "uint64"},
          {"internalType": "enum ChainLendCore.LoanStatus", "name": "status", "type": "uint8"}
        ],
        "internalType": "struct ChainLendCore.ActiveLoan",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "_requestId", "type": "uint256"}
    ],
    "name": "getHealthFactor",
    "outputs": [
      {"internalType": "uint256", "name": "", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "_requestId", "type": "uint256"}
    ],
    "name": "isAtRiskOfLiquidation",
    "outputs": [
      {"internalType": "bool", "name": "atRisk", "type": "bool"},
      {"internalType": "uint256", "name": "currentRatio", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "_requestId", "type": "uint256"}
    ],
    "name": "getExcessCollateral",
    "outputs": [
      {"internalType": "uint256", "name": "excessAmount", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "_requestId", "type": "uint256"}
    ],
    "name": "canWithdrawCollateral",
    "outputs": [
      {"internalType": "bool", "name": "canWithdraw", "type": "bool"},
      {"internalType": "uint256", "name": "collateralAmount", "type": "uint256"},
      {"internalType": "string", "name": "reason", "type": "string"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "_requestId", "type": "uint256"}
    ],
    "name": "repayLoan",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "_requestId", "type": "uint256"}
    ],
    "name": "withdrawCollateral",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "_requestId", "type": "uint256"}
    ],
    "name": "cancelLoanRequest",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "_requestId", "type": "uint256"}
    ],
    "name": "addCollateral",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "_requestId", "type": "uint256"},
      {"internalType": "uint256", "name": "_amount", "type": "uint256"}
    ],
    "name": "withdrawExcessCollateral",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "_requestId", "type": "uint256"}
    ],
    "name": "liquidateCollateral",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "claimCLRewards",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getProtocolStats",
    "outputs": [
      {"internalType": "uint256", "name": "totalRequests", "type": "uint256"},
      {"internalType": "uint256", "name": "activeRequests", "type": "uint256"},
      {"internalType": "uint256", "name": "activeLoansCount", "type": "uint256"},
      {"internalType": "uint256", "name": "totalVolumeUSDC", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  // Constantes du contrat
  {
    "inputs": [],
    "name": "MIN_INTEREST_RATE",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "MAX_INTEREST_RATE", 
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "MIN_LOAN_DURATION",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "MAX_LOAN_DURATION",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "MAX_LOAN_AMOUNT",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "MIN_COLLATERAL_RATIO",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "LIQUIDATION_THRESHOLD",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "nextRequestId",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "user", "type": "address"}],
    "name": "pendingCLRewards",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
];

// ABI pour les events qu'on veut écouter
export const contractEvents = [
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "uint256", "name": "requestId", "type": "uint256"},
      {"indexed": true, "internalType": "address", "name": "borrower", "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "amountRequested", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "requiredCollateral", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "interestRate", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "duration", "type": "uint256"}
    ],
    "name": "LoanRequestCreated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "uint256", "name": "requestId", "type": "uint256"},
      {"indexed": true, "internalType": "address", "name": "lender", "type": "address"},
      {"indexed": true, "internalType": "address", "name": "borrower", "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "dueDate", "type": "uint256"}
    ],
    "name": "LoanFunded",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "uint256", "name": "requestId", "type": "uint256"},
      {"indexed": true, "internalType": "address", "name": "borrower", "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "totalAmount", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "protocolFee", "type": "uint256"}
    ],
    "name": "LoanRepaid",
    "type": "event"
  }
];

// ABI pour USDC (ERC20)
export const usdcAbi = [
  {
    "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "owner", "type": "address"},
      {"internalType": "address", "name": "spender", "type": "address"}
    ],
    "name": "allowance",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "spender", "type": "address"},
      {"internalType": "uint256", "name": "amount", "type": "uint256"}
    ],
    "name": "approve",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "to", "type": "address"},
      {"internalType": "uint256", "name": "amount", "type": "uint256"}
    ],
    "name": "mint",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

// ABI pour CLToken
export const clTokenAbi = [
  {
    "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalSupply",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
];