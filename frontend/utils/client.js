import { createPublicClient, http } from "viem";
import { hardhat, sepolia, base } from 'viem/chains';

export const publicClient = createPublicClient({
  chain: hardhat,
  transport: http(),
})
