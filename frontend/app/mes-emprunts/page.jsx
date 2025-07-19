'use client'

import { useEffect } from 'react';
import NotConnected from "@/components/shared/NotConnected";
import BorrowerPortfolio from '@/components/shared/BorrowerPortfolio';
import { useAccount } from "wagmi";

export default function MesEmpruntsPage() {
  const { isConnected } = useAccount();

  return (
    <div className="min-h-screen w-full">
      {isConnected ? (
        <BorrowerPortfolio />
      ) : (
        <div className="w-full max-w-none mx-auto px-6 py-4">
          <NotConnected /> 
        </div>
      )}
    </div>
  );
}