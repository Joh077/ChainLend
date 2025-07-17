'use client'

import { useEffect } from 'react';
import NotConnected from "@/components/shared/NotConnected";
import LenderPortfolio from '@/components/shared/LenderPortfolio';
import { useAccount } from "wagmi";

export default function MesPretsPage() {
  const { isConnected } = useAccount();

  return (
    <div className="min-h-screen w-full">
      {isConnected ? (
        <LenderPortfolio />
      ) : (
        <div className="w-full max-w-none mx-auto px-6 py-4">
          <NotConnected /> 
        </div>
      )}
    </div>
  );
}