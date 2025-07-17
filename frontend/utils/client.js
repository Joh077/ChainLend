import { createPublicClient, http } from "viem";
import { hardhat, sepolia, base, baseSepolia } from 'viem/chains';

// Configuration basée sur l'environnement
const getChainConfig = () => {
  const env = process.env.NEXT_PUBLIC_NETWORK;
  
  switch (env) {
    case 'sepolia':
      return {
        chain: sepolia,
        transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC)
      };
    
    // POUR BASE TESTNET 
    // case 'base-testnet':
    //   return {
    //     chain: baseSepolia, // Base Sepolia (testnet)
    //     transport: http(process.env.NEXT_PUBLIC_BASE_TESTNET_RPC)
    //   };
    
    // POUR BASE MAINNET 
    // case 'base':
    //   return {
    //     chain: base,
    //     transport: http(process.env.NEXT_PUBLIC_BASE_RPC)
    //   };
    
    default:
      // Configuration par défaut pour localhost/hardhat
      return {
        chain: hardhat,
        transport: http('http://127.0.0.1:8545')
      };
  }
};

export const publicClient = createPublicClient(getChainConfig());
