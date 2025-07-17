'use client'

import { useEffect } from 'react';
import NotConnected from "@/components/shared/NotConnected";
import { MyTokens } from "@/components/shared/MyTokens";

import { useAccount, useReadContract } from "wagmi";

export default function MesTokensPage() {

  const { isConnected } = useAccount();

  useEffect(() => {
    document.title = "Mes CL Tokens | ChainLend";
  }, []);

  return (
    <div className="min-h-screen">
      {isConnected ? (
        <div className="space-y-6">
          <div className=" border-b border-zinc-700">
            <div className="max-w-7xl mx-auto px-6 py-4">
              <div className="text-center">
                <h1 className="text-4xl font-bold font-rasputin text-white mb-4">
                  Mes CL Tokens
                </h1>
                <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                  Gérez vos tokens de récompense ChainLend. 
                  Réclamez vos gains et suivez votre participation au protocole.
                </p>
              </div>
            </div>
          </div>

          <MyTokens />
        </div>
      ) : (
        <div className="w-full">
          <NotConnected />
        </div>
      )}
    </div>
  );
}