'use client'

import { useEffect } from 'react';
import NotConnected from "@/components/shared/NotConnected";


import { useAccount, useReadContract } from "wagmi";

export default function MesPretsPage() {

  const { isConnected } = useAccount();

  return (
    <>
     {isConnected ? (
      <div className="space-y-6">
      </div>
    ) : (
      <div className="w-full">
      <NotConnected /> 
      </div>
    )}
    </>
  );
}

