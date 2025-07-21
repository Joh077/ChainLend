'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { contractAddress, contractAbi, usdcAddress, usdcAbi } from '@/constants';

import { useReadContract, useAccount } from 'wagmi';
import { formatUnits, formatEther, parseUnits } from 'viem';

import { toast } from 'sonner';
import FundingConfirmationSheet from '@/components/shared/FundingConfirmationSheet';
import { publicClient } from '@/utils/client';

export function HomeMarketPlace() {
  // States pour les demandes et l'affichage
  const [loanRequests, setLoanRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // States pour la sheet de financement
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // Adresse wallet et statut connexion
  const { address, isConnected } = useAccount();

  // Hook pour lire les demandes pending
  const { data: pendingRequests, isError: isPendingError, error: pendingError, refetch } = useReadContract({
    address: contractAddress,
    abi: contractAbi,
    functionName: 'getPendingRequests',
    args: [0, 50],
    query: {
      enabled: isConnected,
      refetchInterval: 15000,
    }
  });

  // Hook pour lire le solde USDC de l'utilisateur
  const { data: usdcBalance } = useReadContract({
    address: usdcAddress,
    abi: usdcAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address, //seulement si wallet connecté
      refetchInterval: 10000,
    }
  });

  // Fonction pour récupérer les détails d'une demande
  const fetchLoanRequestDetails = async (requestId) => {
    try {

      //Hook viem pour itéré par requestId
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

  // Fonction pour formater les données d'une demande
  const formatRequestData = (requestData) => {
    try {
      if (!requestData || !requestData.amountRequested || !requestData.borrower) {
        return null;
      }

      const amountUSDC = formatUnits(requestData.amountRequested, 6);
      const collateralETH = formatEther(requestData.actualCollateralDeposited);
      const interestRatePercent = Number(requestData.interestRate) / 100;
      const durationDays = Number(requestData.duration) / (24 * 3600);
      
      const principal = parseFloat(amountUSDC);
      const annualRate = interestRatePercent / 100;
      const totalInterest = (principal * annualRate * durationDays) / 365;
      
      const borrowerAddress = requestData.borrower;
      const avatar = borrowerAddress.slice(2, 6).toUpperCase();
      const displayName = `${borrowerAddress.slice(0, 6)}...${borrowerAddress.slice(-4)}`;
      
      const canFund = borrowerAddress.toLowerCase() !== address?.toLowerCase();
      
      const formatted = {
        id: Number(requestData.id),
        borrower: borrowerAddress,
        name: displayName,
        avatar: avatar,
        rating: null,
        completedLoans: 0,
        demandDays: Math.round(durationDays),
        amount: `${parseFloat(amountUSDC).toString()} USDC`,
        amountRaw: parseFloat(amountUSDC),
        apr: `${interestRatePercent.toFixed(1)}%`,
        collateral: `${parseFloat(collateralETH).toFixed(4)} ETH`,
        totalInterest: totalInterest.toFixed(2),
        canFund: canFund,
        createdAt: Number(requestData.createdAt),
        isOwnRequest: !canFund
      };

      return formatted;
      
    } catch (error) {
      return null;
    }
  };

  // Vérification de l'éligibilité au financement
  const checkFundingEligibility = (request) => {
    if (!usdcBalance || usdcBalance === undefined) {
      return { canFund: false, reason: 'Chargement du solde...' };
    }
    
    const requiredAmount = parseUnits(request.amountRaw.toString(), 6);
    //bool
    const hasBalance = usdcBalance >= requiredAmount;
    
    if (!hasBalance) {
      return { 
        canFund: false, 
        reason: `Solde insuffisant (${formatUnits(usdcBalance, 6)} USDC disponible, ${formatUnits(requiredAmount, 6)} requis)`
      };
    }
    
    return { canFund: true, reason: '' };
  };

  // Ouvrir la sheet de financement
  const handleOpenFundingSheet = (request) => {
    if (!isConnected) {
      toast.error('Veuillez connecter votre wallet');
      return;
    }

    if (!request.canFund) {
      toast.error('Vous ne pouvez pas financer votre propre demande');
      return;
    }

    const eligibilityCheck = checkFundingEligibility(request);
    
    if (!eligibilityCheck.canFund) {
      toast.error(eligibilityCheck.reason);
      return;
    }

    setSelectedRequest(request);
    setIsSheetOpen(true);
  };

  // Fermer la sheet de financement
  const handleCloseSheet = () => {
    setIsSheetOpen(false);
    setSelectedRequest(null);
  };

  // Callback après financement réussi
  const handleFundingSuccess = (requestId) => {
    setTimeout(() => {
      refetch();
    }, 2000);
  };

  /** 
      Transforme une liste d'IDs récupérée par getPendingRequests en demandes 
      complètes affichables, en appelant individuellement getLoanRequest pour 
      chaque ID
  **/
  useEffect(() => {
    const loadRequestDetails = async () => {
      //Si tableau vide return
      if (!pendingRequests || !pendingRequests[0] || pendingRequests[0].length === 0) {
        setLoanRequests([]);
        setIsLoading(false);
        return;
      }

      try {
        const requestIds = pendingRequests[0];
        const requests = [];
        
        for (let i = 0; i < requestIds.length; i++) {
          const requestId = Number(requestIds[i]);
          
          try {
            // return objet complet si demande existe
            const requestDetails = await fetchLoanRequestDetails(requestId);
            
            if (requestDetails && 
                requestDetails.borrower && 
                requestDetails.borrower !== "0x0000000000000000000000000000000000000000") {
              
              const formattedRequest = formatRequestData(requestDetails); // Transforme données brutes en objet UI-ready
              if (formattedRequest) {
                requests.push(formattedRequest); // Ajoute à la collection
              }
            }
          } catch (error) {
          }
        }

        setLoanRequests(requests);
      } catch (error) {
        setLoanRequests([]);
        toast.error('Erreur lors du chargement des demandes');
      }
      
      setIsLoading(false);
    }; 

    // Conditions d'exécution 
    if (pendingRequests && isConnected) {
      loadRequestDetails();
    }
  }, [pendingRequests, address, isConnected]);

  // Gestion des erreurs de chargement
  if (isPendingError) {
    return (
      <Card className="bg-zinc-900 border-zinc-700 m-4 mt-8">
        <CardContent className="p-6">
          <div className="text-center text-red-400">
            Erreur lors du chargement des demandes
            <p className="text-sm text-gray-400 mt-2">
              {pendingError?.message}
            </p>
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
      <Card className="bg-zinc-900 border-zinc-700 m-4 mt-8">
        <CardHeader>
          <CardTitle className="font-rasputin text-white text-xl">MarketPlace - Nouvelles demandes</CardTitle>
          <p className="text-gray-400 text-sm">
            Chargement des demandes disponibles...
          </p>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center text-gray-400">
            <div className="animate-spin w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full mx-auto mb-4"></div>
            Chargement des demandes depuis la blockchain...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-none mx-auto px-6 py-4">
      <Card className="bg-zinc-900 border-zinc-700 shadow-xl">
        
        {/* Header de la marketplace */}
        <CardHeader className="pb-6">
          <CardTitle className="font-rasputin text-white text-2xl font-bold">
            MarketPlace - Nouvelles demandes
          </CardTitle>
          <div className="flex justify-between items-center mt-4">
            <p className="text-gray-400 text-base">
              {loanRequests.length > 0 
                ? `${loanRequests.length} demande(s) de prêt disponible(s) avec les meilleurs rendements`
                : "Aucune demande disponible pour le moment"
              }
            </p>
            {/* Affichage du solde USDC */}
            {usdcBalance && (
              <div className="bg-teal-900/30 border border-teal-600 rounded-lg px-4 py-2">
                <p className="text-teal-300 text-sm font-medium">
                  Solde: {parseFloat(formatUnits(usdcBalance, 6)).toLocaleString()} USDC
                </p>
              </div>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6 px-6 pb-6">
          {/* Liste des demandes */}
          {loanRequests.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 text-3xl mb-4"></div>
              <p className="text-gray-400 text-lg">Aucune demande de prêt disponible</p>
              <p className="text-gray-500 mt-3">
                Soyez le premier à créer une demande de prêt !
              </p>
            </div>
          ) : (
            loanRequests.map((request) => {
              
              return (
                <div key={request.id} className="flex items-center justify-between py-6 px-6 bg-zinc-800 rounded-lg">
                  
                  {/* Informations de l'emprunteur */}
                  <div className="flex items-center space-x-4 w-80">
                    <div className="w-12 h-12 bg-teal-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-black font-bold text-sm">{request.avatar}</span>
                    </div>
                    
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-white font-semibold">#{request.id} {request.name}</span>
                        {request.isOwnRequest ? (
                          <span className="bg-blue-600 px-2 py-1 rounded text-xs text-white">Votre demande</span>
                        ) : (
                          <span className="text-yellow-400"></span>
                        )}
                      </div>
                      <div className="text-gray-400 text-sm">
                        {request.completedLoans} prêts complétés • {request.demandDays}j demandés
                      </div>
                    </div>
                  </div>

                  {/* Détails financiers de la demande */}
                  <div className="flex items-center space-x-32 flex-1 justify-center mr-16">
                    <div className="text-center">
                      <div className="text-white font-bold text-xl">{request.amount}</div>
                      <div className="text-gray-400 text-sm mt-1">Montant</div>
                    </div>
                    <div className="text-center">
                      <div className="text-green-400 font-bold text-xl">{request.apr}</div>
                      <div className="text-gray-400 text-sm mt-1">APR</div>
                    </div>
                    <div className="text-center">
                      <div className="text-blue-400 font-bold text-xl">{request.collateral}</div>
                      <div className="text-gray-400 text-sm mt-1">Collatéral</div>
                    </div>
                  </div>

                  {/* Actions et rendement */}
                  <div className="w-40 flex flex-col space-y-2">
                    <Button 
                      className={`w-full py-3 rounded-full font-semibold text-sm ${
                        !request.canFund 
                          ? 'bg-blue-600 text-white cursor-not-allowed' 
                          : 'bg-green-600 hover:bg-green-500 text-white'
                      }`}
                      onClick={() => handleOpenFundingSheet(request)}
                      disabled={!request.canFund}
                    >
                      {!request.canFund ? 'Votre demande' : 'Prêter'}
                    </Button>

                    {/* Calcul du rendement net */}
                    {request.canFund && (
                      <div className="text-center mt-2 p-2 bg-green-900/20 border border-green-700/50 rounded-lg">
                        <div className="text-green-400 font-bold text-sm">
                          +{(parseFloat(request.totalInterest) * 0.9).toFixed(2)} USDC
                        </div>
                        <div className="text-green-300 text-xs mt-1">
                          Rendement net en {request.demandDays}j
                        </div>
                        <div className="text-gray-400 text-xs mt-1">
                          {((parseFloat(request.totalInterest) * 0.9 / request.amountRaw) * 100).toFixed(1)}% de retour
                        </div>
                        <div className="text-gray-500 text-xs mt-1">
                          (après frais protocole 10%)
                        </div>
                      </div>
                    )}

                    {/* Message pour ses propres demandes */}
                    {request.isOwnRequest && (
                      <div className="text-center mt-2 p-2 bg-blue-900/20 border border-blue-700/50 rounded-lg">
                        <div className="text-blue-400 text-xs">
                          Votre demande de prêt
                        </div>
                        <div className="text-gray-400 text-xs mt-1">
                          Attendez qu'un prêteur la finance
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Sheet de confirmation de financement */}
      <FundingConfirmationSheet
        isOpen={isSheetOpen}
        onClose={handleCloseSheet}
        request={selectedRequest}
        onFundingSuccess={handleFundingSuccess}
        contractAbi={contractAbi}
      />
    </div>
  );
}

export default HomeMarketPlace;