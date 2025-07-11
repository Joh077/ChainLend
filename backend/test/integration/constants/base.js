/**
 * Base Mainnet Contract Addresses
 * Used for fork testing with real contracts
 */

module.exports = {
  // ERC20 Tokens
  USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  WETH: "0x4200000000000000000000000000000000000006",
  
  // Chainlink Price Feeds
  ETH_USD_FEED: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70",
  USDC_USD_FEED: "0x7e860098F58bBFC8648a4311b374B1D669a2bc6B",
  
  // Test Accounts (Whales)
  USDC_WHALE: "0x28C6c06298d514Db089934071355E5743bf21d60", // ~54.9 USDC
  
  // Network Info
  CHAIN_ID: 8453,
  BLOCK_NUMBER: 30000000, // Stable recent block
  BLOCK_TIME: 2,
  
  // Protocol Parameters (same as mainnet deployment will use)
  MIN_COLLATERAL_RATIO: 15000, // 150%
  LIQUIDATION_THRESHOLD: 13000, // 130%
  PROTOCOL_FEE: 1000, // 10%

  // Reliable whale addresses for testing (addresses with confirmed high balances)
  WHALES: {
    ETH: [
      "0x4200000000000000000000000000000000000006", // WETH contract - always has ETH
      "0x49048044D57e1C92A77f79988d21Fa8fAF74E97e", // Base Bridge Multisig
      "0x3304dd20f6Fe094Cb0134a6c8ae07EcE26c7b6A7"  // Large Base wallet
    ],
    USDC: [
      "0x3c8B650257cFb5f272f799F5e2b4e65093a11a05", // Coinbase Exchange Hot Wallet
      "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA", // BaseBridge - main USDC bridge
      "0x49048044D57e1C92A77f79988d21Fa8fAF74E97e", // Base Bridge Multisig
      "0x4200000000000000000000000000000000000010"  // Base L2 Bridge
    ]
  }
};