'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { contractAddress, contractAbi, usdcAddress, usdcAbi } from '@/constants';
import { useReadContract, useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits, formatEther, parseUnits } from 'viem';
import { toast } from 'sonner';
import RepaidLoans from './RepaidLoans';
import { publicClient } from '@/utils/client';

export function BorrowerPortfolio() {
  // États pour les prêts actifs
  const [activeLoans, setActiveLoans] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [repayingLoanId, setRepayingLoanId] = useState(null);
  const [approvingForLoan, setApprovingForLoan] = useState(null);
  const [repaidLoansRefreshTrigger, setRepaidLoansRefreshTrigger] = useState(0);
  
  // Ref pour gérer les toasts
  const currentToastRef = useRef(null);

  // Adresse wallet et statut connexion
  const { address, isConnected } = useAccount();

  // Hook pour les transactions
  const { data: hash, error: writeError, isPending: isWritePending, writeContract } = useWriteContract();

  // Hook pour attendre la confirmation
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash, });

  // Récupération des IDs des demandes de l'utilisateur
  const { data: userRequestIds, isError, error, refetch } = useReadContract({
    address: contractAddress,
    abi: contractAbi,
    functionName: 'getUserRequests',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 15000,
    }
  });

  // Vérification du solde USDC pour les remboursements
  const { data: usdcBalance } = useReadContract({
    address: usdcAddress,
    abi: usdcAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 10000,
    }
  });

  // Vérification de l'allowance USDC pour les remboursements
  const { data: usdcAllowance, refetch: refetchAllowance } = useReadContract({
    address: usdcAddress,
    abi: usdcAbi,
    functionName: 'allowance',
    args: address ? [address, contractAddress] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 5000,
    }
  });

  // Fonction pour récupérer les détails d'un prêt actif
  const fetchActiveLoanDetails = async (requestId) => {
    try {
      const { readContract } = await import('viem/actions');
      
      // Récupérer les détails du prêt
      const loanData = await readContract(publicClient, {
        address: contractAddress,
        abi: contractAbi,
        functionName: 'getActiveLoan',
        args: [BigInt(requestId)],
      });

      // Vérifier que le prêt est bien actif
      if (Number(loanData.status) !== 0) {
        return null;
      }

      // Récupérer le health factor 
      let healthFactor = null;
      try {
        const riskCheck = await readContract(publicClient, {
          address: contractAddress,
          abi: contractAbi,
          functionName: 'isAtRiskOfLiquidation',
          args: [BigInt(requestId)],
        });
        
        healthFactor = riskCheck[1]; // currentRatio
        
      } catch (healthError) {
        // Essayer une autre méthode avec getHealthFactor
        try {
          const directHealthFactor = await readContract(publicClient, {
            address: contractAddress,
            abi: contractAbi,
            functionName: 'getHealthFactor',
            args: [BigInt(requestId)],
          });

          healthFactor = directHealthFactor;
        } catch (directError) {
          // Ignorer si pas disponible
        }
      }

      // Récupérer les détails de la demande
      const requestData = await readContract(publicClient, {
        address: contractAddress,
        abi: contractAbi,
        functionName: 'getLoanRequest',
        args: [BigInt(requestId)],
      });

      return { loanData, healthFactor, requestData };
    } catch (error) {
      return null;
    }
  };

  // Formater un prêt actif
  const formatActiveLoan = (requestId, loanData, healthFactor, requestData) => {
    try {
      const principalAmount = formatUnits(loanData.principalAmount, 6);
      const totalAmountDue = formatUnits(loanData.totalAmountDue, 6);
      const collateralDeposited = formatEther(requestData.actualCollateralDeposited);
      
      // Calculs temporels
      const fundedAt = Number(loanData.fundedAt) * 1000;
      const dueDate = Number(loanData.dueDate) * 1000;
      const now = Date.now();
      const daysRemaining = Math.ceil((dueDate - now) / (24 * 60 * 60 * 1000));
      
      // Health factor et risque
      let healthFactorPercent = null;
      let isAtRisk = false;
      let isDangerous = false;
      
      if (healthFactor) {
        healthFactorPercent = Number(healthFactor) / 100;
        isAtRisk = healthFactorPercent < 140;
        isDangerous = healthFactorPercent < 130;
      }

      const displayStatus = isDangerous ? 'Danger de liquidation' : isAtRisk ? 'À surveiller' : 'Actif';

      return {
        id: Number(requestId),
        principal: parseFloat(principalAmount),
        principalFormatted: `${parseFloat(principalAmount).toLocaleString()} USDC`,
        totalDue: parseFloat(totalAmountDue),
        totalDueFormatted: `${parseFloat(totalAmountDue).toLocaleString()} USDC`,
        collateral: `${parseFloat(collateralDeposited).toFixed(4)} ETH`,
        lender: `${loanData.lender.slice(0, 6)}...${loanData.lender.slice(-4)}`,
        healthFactor: healthFactorPercent,
        isAtRisk: isAtRisk,
        isDangerous: isDangerous,
        fundedAt: fundedAt,
        dueDate: dueDate,
        daysRemaining: daysRemaining,
        fundedAtFormatted: new Date(fundedAt).toLocaleDateString('fr-FR'),
        dueDateFormatted: new Date(dueDate).toLocaleDateString('fr-FR'),
        status: displayStatus
      };
    } catch (error) {
      return null;
    }
  };

  // Fonction pour approuver les USDC
  const handleApproveUSDC = async (loan) => {
    try {
      setApprovingForLoan(loan.id);
      
      const toastId = toast.loading('Approbation USDC en cours...', {
        description: `Approbation pour rembourser ${loan.totalDueFormatted}`
      });
      
      currentToastRef.current = toastId;

      await writeContract({
        address: usdcAddress,
        abi: usdcAbi,
        functionName: 'approve',
        args: [contractAddress, parseUnits(loan.totalDue.toString(), 6)],
        gas: 100000n,
      });

    } catch (error) {
      if (currentToastRef.current) {
        toast.dismiss(currentToastRef.current);
        currentToastRef.current = null;
      }
      toast.error('Erreur lors de l\'approbation USDC');
      setApprovingForLoan(null);
    }
  };

  // Fonction pour rembourser un prêt
  const handleRepayLoan = async (loan) => {
    if (!isConnected) {
      toast.error('Veuillez connecter votre wallet');
      return;
    }

    // Vérifier le solde USDC
    const requiredAmount = parseUnits(loan.totalDue.toString(), 6);
    if (!usdcBalance || usdcBalance < requiredAmount) {
      toast.error(`Solde USDC insuffisant. Il faut ${loan.totalDueFormatted} pour rembourser ce prêt.`);
      return;
    }

    // Vérifier l'allowance USDC
    if (!usdcAllowance || usdcAllowance < requiredAmount) {
      toast.info(`Approbation USDC requise pour ${loan.totalDueFormatted}`);
      await handleApproveUSDC(loan);
      return;
    }

    try {
      setRepayingLoanId(loan.id);
      
      const toastId = toast.loading('Remboursement en cours...', {
        description: `Remboursement de ${loan.totalDueFormatted}`
      });
      
      currentToastRef.current = toastId;

      await writeContract({
        address: contractAddress,
        abi: contractAbi,
        functionName: 'repayLoan',
        args: [BigInt(loan.id)],
        gas: 500000n,
      });

    } catch (error) {
      if (currentToastRef.current) {
        toast.dismiss(currentToastRef.current);
        currentToastRef.current = null;
      }
      
      let errorMessage = 'Erreur lors du remboursement';
      if (error.message.includes('user rejected')) {
        errorMessage = 'Transaction annulée par l\'utilisateur';
      } else if (error.message.includes('insufficient funds')) {
        errorMessage = 'Fonds insuffisants pour payer les frais de gas';
      } else if (error.message.includes('execution reverted')) {
        errorMessage = 'Transaction rejetée par le contrat';
      }
      
      toast.error(errorMessage);
      setRepayingLoanId(null);
    }
  };

  // Fonction pour obtenir la couleur du statut
  const getStatusColor = (loan) => {
    if (loan.isDangerous) return 'bg-red-600';
    if (loan.isAtRisk) return 'bg-yellow-600';
    return 'bg-green-600';
  };

  // Chargement des prêts actifs seulement
  useEffect(() => {
    const loadActiveLoans = async () => {
      if (!userRequestIds || userRequestIds.length === 0) {
        setActiveLoans([]);
        setIsLoading(false);
        return;
      }

      try {
        const activeLoansData = [];
        
        for (let i = 0; i < userRequestIds.length; i++) {
          const requestId = Number(userRequestIds[i]);
          
          try {
            // Vérifier si c'est un prêt actif
            const activeLoanDetails = await fetchActiveLoanDetails(requestId);
            if (activeLoanDetails) {
              const { loanData, healthFactor, requestData } = activeLoanDetails;
              const formattedLoan = formatActiveLoan(requestId, loanData, healthFactor, requestData);
              if (formattedLoan) {
                activeLoansData.push(formattedLoan);
              }
            }
          } catch (error) {
            // Ignorer les erreurs individuelles
          }
        }
        
        setActiveLoans(activeLoansData);
      } catch (error) {
        toast.error('Erreur lors du chargement de vos emprunts');
      }
      
      setIsLoading(false);
    };

    if (userRequestIds && isConnected) {
      loadActiveLoans();
    } else if (!isConnected) {
      setIsLoading(false);
    }
  }, [userRequestIds, address, isConnected]);

  // Gestion du succès des transactions
  useEffect(() => {
    if (isConfirmed) {
      // Dismiss le toast en cours
      if (currentToastRef.current) {
        toast.dismiss(currentToastRef.current);
        currentToastRef.current = null;
      }
      
      if (repayingLoanId) {
        toast.success('Remboursement réussi!', {
          description: `Votre prêt #${repayingLoanId} a été remboursé avec succès`,
          duration: 5000
        });
        
        // Retirer immédiatement le prêt de la liste des prêts actifs
        setActiveLoans(prevLoans => prevLoans.filter(loan => loan.id !== repayingLoanId));
        
        // Déclencher le refresh du composant RepaidLoans
        setRepaidLoansRefreshTrigger(prev => prev + 1);
        
        setRepayingLoanId(null);
        
        // Refresh pour synchroniser
        setTimeout(() => {
          refetch();
        }, 3000);
        
      } else if (approvingForLoan) {
        toast.success('USDC approuvés avec succès!');
        setApprovingForLoan(null);
        
        // Refresh de l'allowance
        setTimeout(() => {
          refetchAllowance();
        }, 1000);
      }
    }
  }, [isConfirmed, repayingLoanId, approvingForLoan, refetch, refetchAllowance]);

  // Gestion des erreurs
  useEffect(() => {
    if (writeError) {
      // Dismiss le toast en cours en cas d'erreur
      if (currentToastRef.current) {
        toast.dismiss(currentToastRef.current);
        currentToastRef.current = null;
      }
      
      toast.error('Erreur lors de la transaction');
      setRepayingLoanId(null);
      setApprovingForLoan(null);
    }
  }, [writeError]);

  // Gestion des erreurs de chargement
  if (isError) {
    return (
      <Card className="bg-zinc-900 border-zinc-700">
        <CardContent className="p-6">
          <div className="text-center text-red-400">
            Erreur lors du chargement de vos emprunts
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

  // État de chargement
  if (isLoading) {
    return (
      <Card className="bg-zinc-900 border-zinc-700">
        <CardHeader>
          <CardTitle className="font-rasputin text-white text-xl">Mes Emprunts</CardTitle>
          <p className="text-gray-400 text-sm">Chargement de vos emprunts...</p>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center text-gray-400">
            <div className="animate-spin w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full mx-auto mb-4"></div>
            Chargement de vos prêts actifs...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-none mx-auto px-6 py-4 space-y-6">
      
      {/* Header avec solde USDC */}
      <Card className="bg-zinc-900 border-zinc-700">
        <CardHeader className="pb-4">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="font-rasputin text-white text-xl">Mes Emprunts</CardTitle>
              <p className="text-gray-400 text-sm mt-1">
                Gérez vos emprunts actifs et remboursements
              </p>
            </div>
            {usdcBalance && (
              <div className="bg-teal-900/30 border border-teal-600 rounded-lg px-4 py-2">
                <p className="text-teal-300 text-sm font-medium">
                  Solde: {parseFloat(formatUnits(usdcBalance, 6)).toLocaleString()} USDC
                </p>
                <p className="text-teal-400 text-xs mt-1">
                  Disponible pour remboursements
                </p>
              </div>
            )}
          </div>
        </CardHeader>
      </Card>
      
      {/* Prêts actifs */}
      {activeLoans.length > 0 && (
        <Card className="bg-zinc-900 border-zinc-700 shadow-xl">
          <CardHeader className="pb-4">
            <CardTitle className="font-rasputin text-white text-xl">
              Emprunts Actifs ({activeLoans.length})
            </CardTitle>
            <p className="text-gray-400 text-sm">
              Vos emprunts en cours - à rembourser avant l'échéance
            </p>
          </CardHeader>
          <CardContent className="space-y-4 px-6 pb-6">
            {activeLoans.map((loan) => {
              const isProcessing = repayingLoanId === loan.id && (isWritePending || isConfirming);
              const isApproving = approvingForLoan === loan.id && (isWritePending || isConfirming);
              
              return (
                <div key={loan.id} className="bg-zinc-800 rounded-xl p-6 border border-zinc-700">
                  <div className="grid grid-cols-12 gap-6 items-center">
                    
                    {/* Info prêt */}
                    <div className="col-span-4 flex items-center space-x-4">
                      <div className="w-12 h-12 bg-teal-500 rounded-full flex items-center justify-center">
                        <span className="text-black font-bold text-sm">#{loan.id}</span>
                      </div>
                      <div>
                        <p className="text-white font-semibold">Prêt #{loan.id}</p>
                        <p className="text-gray-400 text-sm">Prêteur: {loan.lender}</p>
                      </div>
                    </div>

                    {/* Montants */}
                    <div className="col-span-4 grid grid-cols-2 gap-4">
                      <div className="text-center bg-zinc-900 rounded-lg p-3">
                        <p className="text-white font-bold">{loan.principalFormatted}</p>
                        <p className="text-gray-400 text-xs">Reçu</p>
                      </div>
                      <div className="text-center bg-zinc-900 rounded-lg p-3">
                        <p className="text-red-400 font-bold">{loan.totalDueFormatted}</p>
                        <p className="text-gray-400 text-xs">À rembourser</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="col-span-4 text-right">
                      <div className={`inline-block px-3 py-1 rounded-full text-white text-sm font-medium mb-2 ${getStatusColor(loan)}`}>
                        {loan.status}
                      </div>
                      <p className="text-gray-400 text-sm">Échéance: {loan.dueDateFormatted}</p>
                      <p className="text-gray-400 text-sm mb-3">{loan.daysRemaining} jours restants</p>
                      
                      {/* Bouton remboursement */}
                      <Button 
                        onClick={() => handleRepayLoan(loan)}
                        disabled={isProcessing || isApproving}
                        className="w-full bg-green-600 hover:bg-green-500 text-white font-medium"
                      >
                        {isProcessing ? (
                          <span className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Remboursement...
                          </span>
                        ) : isApproving ? (
                          <span className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Approbation...
                          </span>
                        ) : (
                          `Rembourser ${loan.totalDueFormatted}`
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Composant pour les prêts remboursés */}
      <RepaidLoans refreshTrigger={repaidLoansRefreshTrigger} />

      {/* Message si aucun emprunt actif */}
      {activeLoans.length === 0 && (
        <Card className="bg-zinc-900 border-zinc-700 shadow-xl">
          <CardContent className="p-12">
            <div className="text-center">
              <p className="text-gray-400 text-lg">Aucun emprunt actif</p>
              <p className="text-gray-500 mt-3">
                Vous n'avez pas d'emprunts en cours de remboursement.
              </p>
              <Button 
                className="mt-4 bg-teal-600 hover:bg-teal-500"
                onClick={() => window.location.href = '/creer-demande'}
              >
                Créer une demande de prêt
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default BorrowerPortfolio;