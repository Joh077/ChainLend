'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { contractAddress, contractAbi } from '@/constants';
import { useReadContract, useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits, formatEther } from 'viem';
import { toast } from 'sonner';
import { publicClient } from '@/utils/client';

export function RepaidLoans({ refreshTrigger = 0 }) {
  const [repaidLoans, setRepaidLoans] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [withdrawingLoanId, setWithdrawingLoanId] = useState(null);

  const { address, isConnected } = useAccount();

  // Hook pour les transactions
  const { data: hash, error: writeError, isPending: isWritePending, writeContract } = useWriteContract();

  // Hook pour attendre la confirmation
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash, });

  // Récupérer les IDs des demandes de l'utilisateur
  const { data: userRequestIds, refetch } = useReadContract({
    address: contractAddress,
    abi: contractAbi,
    functionName: 'getUserRequests',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 10000,
    }
  });

  // Fonction pour vérifier si un prêt peut être retiré
  const checkWithdrawEligibility = async (requestId) => {
    try {
      const { readContract } = await import('viem/actions');
      
      const withdrawCheck = await readContract(publicClient, {
        address: contractAddress,
        abi: contractAbi,
        functionName: 'canWithdrawCollateral',
        args: [BigInt(requestId)],
      });

      return {
        canWithdraw: withdrawCheck[0],
        collateralAmount: withdrawCheck[1],
        reason: withdrawCheck[2]
      };
    } catch (error) {
      return null;
    }
  };

  // Fonction pour récupérer les détails d'une demande
  const fetchRequestDetails = async (requestId) => {
    try {
      const { readContract } = await import('viem/actions');
      
      const requestData = await readContract(publicClient, {
        address: contractAddress,
        abi: contractAbi,
        functionName: 'getLoanRequest',
        args: [BigInt(requestId)],
      });

      return requestData;
    } catch (error) {
      return null;
    }
  };

  // Fonction pour récupérer les détails du prêt remboursé
  const fetchLoanDetails = async (requestId) => {
    try {
      const { readContract } = await import('viem/actions');
      
      const loanData = await readContract(publicClient, {
        address: contractAddress,
        abi: contractAbi,
        functionName: 'getActiveLoan',
        args: [BigInt(requestId)],
      });

      // Vérifie que le prêt existe vraiment (requestId != 0)
      if (Number(loanData.requestId) === 0) {
        return null;
      }

      return loanData;
    } catch (error) {
      return null;
    }
  };

  // Formater un prêt remboursé (avec gestion des données manquantes)
  const formatRepaidLoan = (requestId, requestData, loanData, withdrawInfo) => {
    try {
      const collateralDeposited = formatEther(requestData.actualCollateralDeposited);
      
      // Si on n'a pas les détails du prêt, créer un objet minimal
      if (!loanData) {
        return {
          id: Number(requestId),
          principal: 0,
          principalFormatted: 'N/A',
          totalDue: 0,
          totalDueFormatted: 'N/A',
          collateral: `${parseFloat(collateralDeposited).toFixed(4)} ETH`,
          collateralAmount: withdrawInfo.collateralAmount,
          lender: 'N/A',
          fundedAtFormatted: 'N/A',
          dueDateFormatted: 'N/A',
          canWithdraw: withdrawInfo.canWithdraw,
          withdrawReason: withdrawInfo.reason,
          status: 'Remboursé'
        };
      }
      
      const principalAmount = formatUnits(loanData.principalAmount, 6);
      const totalAmountDue = formatUnits(loanData.totalAmountDue, 6);
      
      // Calculs temporels
      const fundedAt = Number(loanData.fundedAt) * 1000;
      const dueDate = Number(loanData.dueDate) * 1000;
      
      return {
        id: Number(requestId),
        principal: parseFloat(principalAmount),
        principalFormatted: `${parseFloat(principalAmount).toLocaleString()} USDC`,
        totalDue: parseFloat(totalAmountDue),
        totalDueFormatted: `${parseFloat(totalAmountDue).toLocaleString()} USDC`,
        collateral: `${parseFloat(collateralDeposited).toFixed(4)} ETH`,
        collateralAmount: withdrawInfo.collateralAmount,
        lender: `${loanData.lender.slice(0, 6)}...${loanData.lender.slice(-4)}`,
        fundedAt: fundedAt,
        dueDate: dueDate,
        fundedAtFormatted: new Date(fundedAt).toLocaleDateString('fr-FR'),
        dueDateFormatted: new Date(dueDate).toLocaleDateString('fr-FR'),
        canWithdraw: withdrawInfo.canWithdraw,
        withdrawReason: withdrawInfo.reason,
        status: withdrawInfo.canWithdraw ? 'Remboursé' : 'Traitement...'
      };
    } catch (error) {
      return null;
    }
  };

  // Fonction pour retirer le collatéral
  const handleWithdrawCollateral = async (loan) => {
    if (!isConnected) {
      toast.error('Veuillez connecter votre wallet');
      return;
    }

    if (!loan.canWithdraw) {
      toast.error('Retrait de collatéral non autorisé');
      return;
    }

    try {
      setWithdrawingLoanId(loan.id);

      const toastId = toast.loading('Retrait du collatéral en cours...', {
        description: `Retrait de ${loan.collateral}`
      });

      await writeContract({
        address: contractAddress,
        abi: contractAbi,
        functionName: 'withdrawCollateral',
        args: [BigInt(loan.id)],
        gas: 300000n,
      });

      toast.dismiss(toastId);

    } catch (error) {
      let errorMessage = 'Erreur lors du retrait de collatéral';
      if (error.message.includes('user rejected')) {
        errorMessage = 'Transaction annulée par l\'utilisateur';
      } else if (error.message.includes('insufficient funds')) {
        errorMessage = 'Fonds insuffisants pour payer les frais de gas';
      } else if (error.message.includes('execution reverted')) {
        errorMessage = 'Collatéral déjà retiré ou prêt non remboursé';
      }
      
      toast.error(errorMessage);
      setWithdrawingLoanId(null);
    }
  };

    // Charger les prêts remboursés
    useEffect(() => {
      const loadRepaidLoans = async () => {
        if (!userRequestIds || userRequestIds.length === 0) {
          setRepaidLoans([]);
          setIsLoading(false);
          return;
        }
  
        try {
          const repaidLoansData = [];
          
          for (let i = 0; i < userRequestIds.length; i++) {
            const requestId = Number(userRequestIds[i]);
            
            try {
              // Vérifier d'abord si le prêt peut être retiré
              const withdrawInfo = await checkWithdrawEligibility(requestId);
              
              // Seulement traiter les prêts qui peuvent vraiment être retirés
              if (withdrawInfo && withdrawInfo.canWithdraw) {
                // Récupérer d'abord les détails de la demande
                const requestData = await fetchRequestDetails(requestId);
                
                if (requestData && Number(requestData.status) === 1) {
                  // Demande financée, essayer de récupérer les détails du prêt
                  const loanData = await fetchLoanDetails(requestId);
                  
                  if (loanData) {
                    const formattedLoan = formatRepaidLoan(requestId, requestData, loanData, withdrawInfo);
                    if (formattedLoan) {
                      repaidLoansData.push(formattedLoan);
                    }
                  } else {
                    // Créer un objet minimal pour permettre le retrait quand même
                    const minimalLoan = {
                      id: Number(requestId),
                      collateral: `${parseFloat(formatEther(withdrawInfo.collateralAmount)).toFixed(4)} ETH`,
                      canWithdraw: true,
                      status: 'Remboursé',
                      principalFormatted: 'N/A',
                      totalDueFormatted: 'N/A',
                      lender: 'N/A',
                      dueDateFormatted: 'N/A'
                    };
                    repaidLoansData.push(minimalLoan);
                  }
                }
              }
            } catch (error) {
              // Ignorer les erreurs individuelles
            }
          }
  
          setRepaidLoans(repaidLoansData);
        } catch (error) {
          toast.error('Erreur lors du chargement des prêts remboursés');
        }
        
        setIsLoading(false);
      };
  
      if (userRequestIds && isConnected) {
        loadRepaidLoans();
      } else if (!isConnected) {
        setIsLoading(false);
      }
    }, [userRequestIds, address, isConnected, refreshTrigger]);

  // Gestion du succès des transactions
  useEffect(() => {
    if (isConfirmed && withdrawingLoanId) {
      toast.success('Collatéral retiré!', {
        description: `Le collatéral du prêt #${withdrawingLoanId} a été retiré avec succès`,
        duration: 5000
      });
      
      // Retirer le prêt de la liste locale immédiatement
      setRepaidLoans(prevLoans => prevLoans.filter(loan => loan.id !== withdrawingLoanId));
      
      setWithdrawingLoanId(null);
      
      // Refresh des données après 3 secondes pour synchroniser
      setTimeout(() => {
        refetch();
      }, 3000);
    }
  }, [isConfirmed, withdrawingLoanId, refetch]);

  // Gestion des erreurs
  useEffect(() => {
    if (writeError && withdrawingLoanId) {
      toast.error('Erreur lors de la transaction');
      setWithdrawingLoanId(null);
    }
  }, [writeError, withdrawingLoanId]);

  if (isLoading) {
    return (
      <Card className="bg-zinc-900 border-zinc-700">
        <CardHeader>
          <CardTitle className="font-rasputin text-white text-xl">Emprunts Remboursés</CardTitle>
          <p className="text-gray-400 text-sm">Chargement...</p>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center text-gray-400">
            <div className="animate-spin w-6 h-6 border-2 border-green-400 border-t-transparent rounded-full mx-auto mb-4"></div>
            Recherche des emprunts remboursés...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (repaidLoans.length === 0) {
    return null;
  }

  return (
    <Card className="bg-zinc-900 border-zinc-700 shadow-xl">
      <CardHeader className="pb-4">
        <CardTitle className="font-rasputin text-white text-xl">
          Emprunts Remboursés ({repaidLoans.length})
        </CardTitle>
        <p className="text-gray-400 text-sm">
          Vos emprunts remboursés - retirez votre collatéral
        </p>
      </CardHeader>
      <CardContent className="space-y-4 px-6 pb-6">
        {repaidLoans.map((loan) => {
          const isWithdrawing = withdrawingLoanId === loan.id && (isWritePending || isConfirming);
          
          return (
            <div key={loan.id} className="bg-zinc-800 rounded-xl p-6 border border-zinc-700">
              <div className="grid grid-cols-12 gap-6 items-center">
                
                {/* Info prêt (4 cols) */}
                <div className="col-span-4 flex items-center space-x-4">
                  <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-black font-bold text-sm">#{loan.id}</span>
                  </div>
                  <div>
                    <p className="text-white font-semibold">Prêt #{loan.id}</p>
                    <p className="text-gray-400 text-sm">Prêteur: {loan.lender}</p>
                    <p className="text-green-400 text-xs">Remboursé le {loan.dueDateFormatted}</p>
                  </div>
                </div>

                {/* Montants (4 cols) */}
                <div className="col-span-4 grid grid-cols-2 gap-4">
                  <div className="text-center bg-zinc-900 rounded-lg p-3">
                    <p className="text-white font-bold">{loan.principalFormatted}</p>
                    <p className="text-gray-400 text-xs">Emprunté</p>
                  </div>
                  <div className="text-center bg-zinc-900 rounded-lg p-3">
                    <p className="text-green-400 font-bold">{loan.totalDueFormatted}</p>
                    <p className="text-gray-400 text-xs">Remboursé</p>
                  </div>
                </div>

                {/* Actions (4 cols) */}
                <div className="col-span-4 text-right">
                  <div className="inline-block px-3 py-1 rounded-full text-white text-sm font-medium mb-2 bg-green-600">
                    {loan.status}
                  </div>
                  <p className="text-blue-400 text-sm font-bold mb-1">{loan.collateral}</p>
                  <p className="text-gray-400 text-xs mb-3">Collatéral disponible</p>
                  
                  {loan.canWithdraw ? (
                    <Button 
                      onClick={() => handleWithdrawCollateral(loan)}
                      disabled={isWithdrawing}
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium"
                    >
                      {isWithdrawing ? (
                        <span className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Retrait...
                        </span>
                      ) : (
                        `Retirer ${loan.collateral}`
                      )}
                    </Button>
                  ) : (
                    <div className="w-full bg-gray-600 text-gray-300 text-center py-2 px-4 rounded font-medium">
                      ⏳ {loan.withdrawReason || 'En attente...'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default RepaidLoans;