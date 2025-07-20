'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { contractAddress, contractAbi } from '@/constants';
import { useReadContract, useAccount } from 'wagmi';
import { formatUnits, formatEther } from 'viem';
import { toast } from 'sonner';
import { publicClient } from '@/utils/client';

export function LenderPortfolio() {
  const [activeLoans, setActiveLoans] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalInvested, setTotalInvested] = useState(0);
  const [totalExpectedReturn, setTotalExpectedReturn] = useState(0);

  const { address, isConnected } = useAccount();

  // Récupère les IDs des prêts du lender
  const { data: userLoanIds, isError, error, refetch } = useReadContract({
    address: contractAddress,
    abi: contractAbi,
    functionName: 'getUserLoans',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 15000, 
    }
  });

  // Fonction pour récupérer les détails d'un prêt actif
  const fetchLoanDetails = async (loanId) => {
    try {
      const { readContract } = await import('viem/actions');
      
      // Récupère les détails du prêt actif
      const activeLoanData = await readContract(publicClient, {
        address: contractAddress,
        abi: contractAbi,
        functionName: 'getActiveLoan',
        args: [BigInt(loanId)],
      });

      // Vérifie que le prêt existe vraiment (requestId != 0)
      if (Number(activeLoanData.requestId) === 0) {
        return null;
      }

      // Récupère les détails de la demande 
      const requestData = await readContract(publicClient, {
        address: contractAddress,
        abi: contractAbi,
        functionName: 'getLoanRequest',
        args: [BigInt(loanId)],
      });

      // Récupère le health factor si le prêt est actif
      let healthFactor = null;
      const loanStatus = Number(activeLoanData.status);
      
      if (loanStatus === 0) { // LoanStatus.Active = 0
        try {
          // isAtRiskOfLiquidation
          const riskCheck = await readContract(publicClient, {
            address: contractAddress,
            abi: contractAbi,
            functionName: 'isAtRiskOfLiquidation',
            args: [BigInt(loanId)],
          });
          
          healthFactor = riskCheck[1]; // currentRatio = health factor
          
        } catch (healthError) {
        }
      } else {
        return null; 
      }
      return { activeLoanData, requestData, healthFactor };  
    } catch (error) {
      return null;
    }
  };

  // On Formate les données 
  const formatLoanData = (loanId, activeLoanData, requestData, healthFactor) => {
    try {
      // Vérifie que le prêt est actif (status = 0 pour LoanStatus.Active)
      if (Number(activeLoanData.status) !== 0) {
        return null; // Prêt non actif
      }

      const principalAmount = formatUnits(activeLoanData.principalAmount, 6);
      const totalAmountDue = formatUnits(activeLoanData.totalAmountDue, 6);
      const interestAmountGross = Number(activeLoanData.interestAmount) / 1e6; // Convertir depuis 6 décimales
      const interestAmountNet = interestAmountGross * 0.9; // Après frais protocole 10%
      const collateralETH = formatEther(requestData.actualCollateralDeposited);
      
      // Calculs Timestamps
      const fundedAt = Number(activeLoanData.fundedAt) * 1000; // Convertir en ms
      const dueDate = Number(activeLoanData.dueDate) * 1000;
      const now = Date.now();
      const daysRemaining = Math.ceil((dueDate - now) / (24 * 60 * 60 * 1000));
      
      // Informations borrower
      const borrowerAddress = requestData.borrower;
      const avatar = borrowerAddress.slice(2, 6).toUpperCase();
      const displayName = `${borrowerAddress.slice(0, 6)}...${borrowerAddress.slice(-4)}`;
      
      // Health factor et statut (avec valeurs par défaut si pas disponible)
      let healthFactorPercent = 0;
      let isAtRisk = false;
      let needsMonitoring = false;
      
      if (healthFactor) {
        healthFactorPercent = Number(healthFactor) / 100; // Convertir de basis points
        isAtRisk = healthFactorPercent < 140; // En dessous de 140%
        needsMonitoring = healthFactorPercent >= 140 && healthFactorPercent < 150; // Entre 140-150%
      }
      
      return {
        id: Number(loanId),
        borrower: {
          address: borrowerAddress,
          name: displayName,
          avatar: avatar
        },
        amounts: {
          principal: parseFloat(principalAmount),
          totalDue: parseFloat(totalAmountDue),
          interest: interestAmountNet, // Intérêts nets après frais protocole
          principalFormatted: `${parseFloat(principalAmount).toLocaleString()} USDC`,
          totalDueFormatted: `${parseFloat(totalAmountDue).toLocaleString()} USDC`,
          interestFormatted: `${interestAmountNet.toLocaleString()} USDC`
        },
        collateral: {
          amount: parseFloat(collateralETH),
          formatted: `${parseFloat(collateralETH).toFixed(4)} ETH`,
          healthFactor: healthFactorPercent,
          isAtRisk: isAtRisk,
          needsMonitoring: needsMonitoring,
          hasHealthFactor: !!healthFactor 
        },
        timing: {
          fundedAt: fundedAt,
          dueDate: dueDate,
          daysRemaining: daysRemaining,
          fundedAtFormatted: new Date(fundedAt).toLocaleDateString('fr-FR'),
          dueDateFormatted: new Date(dueDate).toLocaleDateString('fr-FR')
        },
        status: isAtRisk ? 'at-risk' : needsMonitoring ? 'monitoring' : 'healthy'
      };
      
    } catch (error) {
      return null;
    }
  };

  // Chargement des prêts actifs
  useEffect(() => {
    const loadActiveLoans = async () => {
      if (!userLoanIds || userLoanIds.length === 0) {
        setActiveLoans([]);
        setIsLoading(false);
        return;
      }

      try {
        const loans = [];
        let totalInv = 0;
        let totalRet = 0;
        
        for (let i = 0; i < userLoanIds.length; i++) {
          const loanId = Number(userLoanIds[i]);
          
          try {
            const details = await fetchLoanDetails(loanId);
            
            if (details) {
              const { activeLoanData, requestData, healthFactor } = details;
              const formattedLoan = formatLoanData(loanId, activeLoanData, requestData, healthFactor);
              
              if (formattedLoan) {
                loans.push(formattedLoan);
                totalInv += formattedLoan.amounts.principal;
                totalRet += formattedLoan.amounts.principal + formattedLoan.amounts.interest; // Principal + intérêts nets
              }
            }
          } catch (error) {
          }
        }

        setActiveLoans(loans);
        setTotalInvested(totalInv);
        setTotalExpectedReturn(totalRet);
      } catch (error) {
        toast.error('Erreur lors du chargement de vos prêts');
      }
      
      setIsLoading(false);
    };

    if (userLoanIds && isConnected) {
      loadActiveLoans();
    } else if (!isConnected) {
      setIsLoading(false);
    }
  }, [userLoanIds, address, isConnected]);

  // Fonction pour obtenir la couleur du statut
  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy': return 'bg-green-600';
      case 'monitoring': return 'bg-yellow-600';
      case 'at-risk': return 'bg-red-600';
      default: return 'bg-gray-600';
    }
  };

  // Fonction pour obtenir le texte du statut
  const getStatusText = (loan) => {
    if (!loan.collateral.hasHealthFactor) {
      return 'Health Factor N/A';
    }
    
    if (loan.collateral.isAtRisk) {
      return `Danger (${loan.collateral.healthFactor.toFixed(0)}%)`;
    } else if (loan.collateral.needsMonitoring) {
      return `À surveiller (${loan.collateral.healthFactor.toFixed(0)}%)`;
    } else {
      return `Sain (${loan.collateral.healthFactor.toFixed(0)}%)`;
    }
  };

  if (isError) {
    return (
      <Card className="bg-zinc-900 border-zinc-700">
        <CardContent className="p-6">
          <div className="text-center text-red-400">
             Erreur lors du chargement de vos prêts
            <p className="text-sm text-gray-400 mt-2">{error?.message}</p>
            <Button 
              onClick={() => refetch()} 
              className="mt-4 bg-red-600 hover:bg-red-500"
              size="sm"
            >
              Réessayer
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="bg-zinc-900 border-zinc-700">
        <CardHeader>
          <CardTitle className="font-rasputin text-white text-xl">Mes Prêts Actifs</CardTitle>
          <p className="text-gray-400 text-sm">Chargement de votre portfolio...</p>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center text-gray-400">
            <div className="animate-spin w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full mx-auto mb-4"></div>
            Chargement de vos investissements...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-none mx-auto px-6 py-4 space-y-6">
      
      {/* Statistiques globales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-zinc-900 border-zinc-700">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-gray-400 text-sm">Total Investi</p>
              <p className="text-white font-bold text-2xl">{totalInvested.toLocaleString()} USDC</p>
              <p className="text-gray-500 text-xs">{activeLoans.length} prêt(s) actif(s)</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-zinc-900 border-zinc-700">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-gray-400 text-sm">Retour Attendu</p>
              <p className="text-green-400 font-bold text-2xl">{totalExpectedReturn.toLocaleString()} USDC</p>
              <p className="text-gray-500 text-xs">Capital + intérêts</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-zinc-900 border-zinc-700">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-gray-400 text-sm">Profit Net</p>
              <p className="text-teal-400 font-bold text-2xl">
                +{(totalExpectedReturn - totalInvested).toLocaleString()} USDC
              </p>
              <p className="text-gray-500 text-xs">Après frais protocole</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Liste des prêts */}
      <Card className="bg-zinc-900 border-zinc-700 shadow-xl">
        <CardHeader className="pb-6">
          <CardTitle className="font-rasputin text-white text-xl">
             Mes Prêts Actifs ({activeLoans.length})
          </CardTitle>
          <p className="text-gray-400 text-base">
            Portfolio de vos investissements en cours
          </p>
        </CardHeader>
        <CardContent className="space-y-4 px-6 pb-6">
          {activeLoans.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 text-3xl mb-4"></div>
              <p className="text-gray-400 text-lg">Aucun prêt actif</p>
              <p className="text-gray-500 mt-3">
                Vous n'avez pas encore financé de demandes de prêt.
              </p>
              <Button 
                className="mt-4 bg-teal-600 hover:bg-teal-500"
                onClick={() => window.location.href = '/marketplace'}
              >
                Explorer le marketplace
              </Button>
            </div>
          ) : (
            activeLoans.map((loan) => (
              <div key={loan.id} className="bg-zinc-800 rounded-xl p-6 border border-zinc-700">
                <div className="grid grid-cols-12 gap-6 items-center">
                  
                  {/* Section gauche - Borrowers */}
                  <div className="col-span-3 flex items-center space-x-4">
                    <div className="w-12 h-12 bg-teal-500 rounded-full flex items-center justify-center">
                      <span className="text-black font-bold text-sm">{loan.borrower.avatar}</span>
                    </div>
                    <div>
                      <p className="text-white font-semibold">#{loan.id} {loan.borrower.name}</p>
                      <p className="text-gray-400 text-sm">Emprunteur</p>
                    </div>
                  </div>

                  {/* Section centre - Montants */}
                  <div className="col-span-4 grid grid-cols-2 gap-4">
                    <div className="text-center bg-zinc-900 rounded-lg p-3">
                      <p className="text-white font-bold">{loan.amounts.principalFormatted}</p>
                      <p className="text-gray-400 text-xs">Prêté</p>
                    </div>
                    <div className="text-center bg-zinc-900 rounded-lg p-3">
                      <p className="text-green-400 font-bold">{loan.amounts.totalDueFormatted}</p>
                      <p className="text-gray-400 text-xs">Total dû</p>
                    </div>
                  </div>

                  {/* Section collatéral */}
                  <div className="col-span-2 text-center">
                    <p className="text-blue-400 font-bold">{loan.collateral.formatted}</p>
                    <p className="text-gray-400 text-xs">Collatéral</p>
                    {loan.collateral.hasHealthFactor ? (
                      <div className={`text-xs px-2 py-1 rounded-full mt-1 ${
                        loan.collateral.healthFactor >= 150 ? 'bg-green-900 text-green-300' :
                        loan.collateral.healthFactor >= 140 ? 'bg-yellow-900 text-yellow-300' :
                        'bg-red-900 text-red-300'
                      }`}>
                        {loan.collateral.healthFactor.toFixed(0)}% Health
                      </div>
                    ) : (
                      <div className="text-xs px-2 py-1 rounded-full mt-1 bg-gray-900 text-gray-300">
                        Health N/A
                      </div>
                    )}
                  </div>

                  {/* Section droite - Statut et échéance */}
                  <div className="col-span-3 text-right">
                    <div className={`inline-block px-3 py-1 rounded-full text-white text-sm font-medium mb-2 ${getStatusColor(loan.status)}`}>
                      {getStatusText(loan)}
                    </div>
                    <p className="text-gray-400 text-sm">Échéance: {loan.timing.dueDateFormatted}</p>
                    <p className="text-gray-400 text-sm">{loan.timing.daysRemaining} jours restants</p>
                    <p className="text-teal-400 text-sm font-medium">
                      +{loan.amounts.interestFormatted} profit
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default LenderPortfolio;