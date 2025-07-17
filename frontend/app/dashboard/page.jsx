'use client';

import NotConnected from "@/components/shared/NotConnected";
import ProtocolStats from '@/components/shared/ProtocolStats';
import HomeMarketPlace from "@/components/shared/HomeMarketPlace";
import { useAccount } from "wagmi";
import LenderPortfolio from "@/components/shared/LenderPortfolio";

export default function Dashboard() {
  const { isConnected } = useAccount();

  return (
    <div className="w-full min-h-screen bg-zinc-950 min-w-400">
      {isConnected ? (
      <div className="max-w-full mx-auto">
        <ProtocolStats />
        
        <div className="mx-4 mb-4">
          <LenderPortfolio />
        </div>
        
        <div className="mx-4 mb-4 max-h-2.5">
          <HomeMarketPlace />
        </div>

      </div>
      ) : (
        <div className="w-full max-w-none mx-auto px-6 py-4">
          <NotConnected /> 
        </div>
      )}
    </div>
  );
}

