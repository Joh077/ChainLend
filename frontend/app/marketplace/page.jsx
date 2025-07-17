'use client'

import NotConnected from "@/components/shared/NotConnected";
import HomeMarketPlace from '@/components/shared/HomeMarketPlace';
import { useAccount } from "wagmi";

export default function MarketPlacePage() {
  const { isConnected } = useAccount();

  return (
    <div className="min-h-screen w-full min-w-7xl"> 
      {isConnected ? (
        <HomeMarketPlace />
      ) : (
        <div className="w-full max-w-none mx-auto px-6 py-4">
          <NotConnected /> 
        </div>
      )}
    </div>
  );
}