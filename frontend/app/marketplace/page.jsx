'use client'

import { useEffect } from 'react';
import NotConnected from "@/components/shared/NotConnected";
import HomeMarketPlace from '@/components/shared/HomeMarketPlace';


import { useAccount, useReadContract } from "wagmi";

export default function MarketPlacePage() {

  const { isConnected } = useAccount();

  return (
    <>
     {isConnected ? (
      <div className="space-y-6">
      </div>
    ) : (
      <div className="w-full min-w-400">
      <NotConnected /> 
      <HomeMarketPlace />
      </div>
    )}
    </>
  );
}