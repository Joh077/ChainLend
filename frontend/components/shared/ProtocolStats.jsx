'use client';
//
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { contractAddress, contractAbi, clTokenAddress, clTokenAbi } from '@/constants';
import { useReadContract } from 'wagmi';
import { formatUnits } from 'viem';

export function ProtocolStats() {
  const [protocolData, setProtocolData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Récupère les stats principales du protocole
  const { data: protocolStats } = useReadContract({
    address: contractAddress,
    abi: contractAbi,
    functionName: 'getProtocolStats',
    query: {
      refetchInterval: 30000,
    }
  });

  // Récupère le total supply des tokens CL
  const { data: clTotalSupply } = useReadContract({
    address: clTokenAddress,
    abi: clTokenAbi,
    functionName: 'totalSupply',
    query: {
      refetchInterval: 30000,
    }
  });

  // Récupère le nombre de demandes en attente
  const { data: pendingCount } = useReadContract({
    address: contractAddress,
    abi: contractAbi,
    functionName: 'getPendingRequestsCount',
    query: {
      refetchInterval: 30000,
    }
  });

  // Calcul et formatage des data
  useEffect(() => {
    if (protocolStats && clTotalSupply !== undefined) {
      const totalRequests = Number(protocolStats[0]);
      const activeRequests = Number(protocolStats[1]);
      const activeLoansCount = Number(protocolStats[2]);
      const totalVolumeUSDC = Number(protocolStats[3]);
      
      // Estimation de la TVL 
      const estimatedTVL = totalVolumeUSDC * 1.5; // 150% de collatéralisation moyenne
      
      // Tokens CL en circulation
      const clInCirculation = formatUnits(clTotalSupply, 18);

      setProtocolData({
        totalValueLocked: estimatedTVL,
        activeLoans: activeLoansCount,
        totalVolume: totalVolumeUSDC,
        clTokens: parseFloat(clInCirculation),
        totalRequests: totalRequests,
        pendingRequests: pendingCount ? Number(pendingCount) : activeRequests
      });

      setIsLoading(false);
    }
  }, [protocolStats, clTotalSupply, pendingCount]);

  if (isLoading) {
    return (
      <Card className="bg-zinc-900 border-zinc-700 mx-4 mt-4 mb-4">
        <CardHeader>
          <CardTitle className="font-rasputin text-white text-xl">Statistiques du Protocole</CardTitle>
          <p className="text-gray-400 text-sm">Données en temps réel de ChainLend</p>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center text-gray-400">
            <div className="animate-spin w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full mx-auto mb-4"></div>
            Chargement des statistiques...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!protocolData) {
    return (
      <Card className="bg-zinc-900 border-zinc-700 mx-4 mt-4 mb-4">
        <CardContent className="p-6">
          <div className="text-center text-red-400">
             Erreur lors du chargement des statistiques
          </div>
        </CardContent>
      </Card>
    );
  }

  const statsItems = [
    {
      id: 1,
      title: "Total Value Lock",
      value: `$${(protocolData.totalValueLocked / 1000000).toFixed(1)}`,
      color: "text-green-400",
    },
    {
      id: 2,
      title: "Prêts Actifs",
      value: protocolData.activeLoans.toString(),
      color: "text-blue-400",
    },
    {
      id: 3,
      title: "Volume Total",
      value: `$${(protocolData.totalVolume / 1000000).toFixed(1)}`,
      color: "text-yellow-400",
    },
    {
      id: 4,
      title: "Tokens CL",
      value: protocolData.clTokens.toString(),
      color: "text-purple-400",
    }
  ];

  const additionalStats = [
    {
      label: "Demandes Totales",
      value: protocolData.totalRequests.toString(),
    },
    {
      label: "En Attente",
      value: protocolData.pendingRequests.toString(),
    },
    {
      label: "Financées",
      value: (protocolData.totalRequests - protocolData.pendingRequests).toString(),
    },
    {
      label: "TVL min/Volume",
      value: `${protocolData.totalVolume > 0 ? ((protocolData.totalValueLocked / protocolData.totalVolume) * 100).toFixed(0) : 0}%`,
    }
  ];

  return (
    <Card className="bg-zinc-900 border-zinc-700 mx-4 mt-4 mb-4">
      <CardHeader>
        <CardTitle className="font-rasputin text-white text-xl"> Statistiques du Protocole</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Stats principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statsItems.map((stat) => (
            <div key={stat.id} className="bg-zinc-800 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div>
                    <h3 className="text-gray-400 text-sm font-medium">{stat.title}</h3>
                    <p className="text-gray-500 text-xs">{stat.subtitle}</p>
                  </div>
                </div>
              </div>
              
              <div className="mb-3">
                <span className={`text-3xl font-bold ${stat.color}`}>
                  {stat.value}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Stats additionnelles */}
        <div className="bg-zinc-800 rounded-lg p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {additionalStats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="flex items-center justify-center space-x-2 mb-2">
                  <span className="text-lg">{stat.icon}</span>
                  <span className="text-white font-bold text-lg">{stat.value}</span>
                </div>
                <p className="text-gray-400 text-sm">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ProtocolStats;