'use client';
//
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { contractAddress, contractAbi, clTokenAddress, clTokenAbi } from '@/constants';
import { useReadContract, useWriteContract, useAccount, useWaitForTransactionReceipt } from 'wagmi';
import { formatEther, parseEther } from 'viem';
import { toast } from 'sonner';

export function MyTokens() {
  const [isClaimLoading, setIsClaimLoading] = useState(false);
  const [claimHistory, setClaimHistory] = useState([]);

  const { address, isConnected } = useAccount();

  // Lecture des tokens en attente dans le contrat
  const { data: pendingRewards, isError: pendingError, error: pendingErrorMsg, refetch: refetchPending } = useReadContract({
    address: contractAddress,
    abi: contractAbi,
    functionName: 'pendingCLRewards',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 10000, // Refresh toutes les 10 secondes
    }
  });

  // Lecture du solde CLToken dans le wallet
  const { data: walletBalance, isError: balanceError, error: balanceErrorMsg, refetch: refetchBalance } = useReadContract({
    address: clTokenAddress,
    abi: clTokenAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 10000,
    }
  });

  // Lecture du supply total
  const { data: totalSupply } = useReadContract({
    address: clTokenAddress,
    abi: clTokenAbi,
    functionName: 'totalSupply',
    query: {
      refetchInterval: 10000,
    }
  });

  // Hook pour le claim
  const { writeContract: claimRewards, data: claimHash, isPending: isClaimPending, error: claimError } = useWriteContract();

  // Attendre la confirmation de la transaction de claim
  const { isLoading: isClaimConfirming, isSuccess: isClaimSuccess } = useWaitForTransactionReceipt({ hash: claimHash, });

  // Formater les valeurs
  const pendingCL = pendingRewards ? Number(formatEther(pendingRewards)) : 0;
  const walletCL = walletBalance ? Number(formatEther(walletBalance)) : 0;
  const totalCL = totalSupply ? Number(formatEther(totalSupply)) : 0;
  const canClaim = pendingCL >= 10; // MIN_CLAIM_AMOUNT = 10 CL

  // Gérer le succès du claim
  useEffect(() => {
    if (isClaimSuccess) {
      setIsClaimLoading(false);
      toast.success(`${pendingCL.toFixed(2)} CL tokens réclamés avec succès!`);
      
      // Ajouter à l'historique local
      const newClaim = { id: Date.now(), amount: pendingCL, timestamp: new Date(), hash: claimHash };

      setClaimHistory(prev => [newClaim, ...prev.slice(0, 4)]); // Garder max 5 entrées
      
      // Rafraîchir les données
      setTimeout(() => {
        refetchPending();
        refetchBalance();
      }, 2000);
    }
  }, [isClaimSuccess, pendingCL, claimHash, refetchPending, refetchBalance]);

  // Gérer les erreurs de claim
  useEffect(() => {
    if (claimError) {
      setIsClaimLoading(false);
      console.error('Erreur claim:', claimError);
      toast.error(`Erreur lors du claim: ${claimError.message}`);
    }
  }, [claimError]);

  // Fonction pour effectuer le claim
  const handleClaim = async () => {
    if (!canClaim) {
      toast.error('Minimum 10 CL tokens requis pour réclamer');
      return;
    }

    try {
      setIsClaimLoading(true);
      
      await claimRewards({ address: contractAddress, abi: contractAbi, functionName: 'claimCLRewards', });
      
      toast.info('Transaction de claim envoyée, confirmation en cours...');
      
    } catch (error) {
      setIsClaimLoading(false);
      console.error('Erreur envoi claim:', error);
      toast.error('Erreur lors de l\'envoi de la transaction');
    }
  };

  // Fonction pour obtenir le message d'encouragement
  const getEncouragementMessage = () => {
    if (pendingCL >= 100) return "Excellent! Vous êtes un utilisateur très actif!";
    if (pendingCL >= 50) return "Très bien! Continuez comme ça!";
    if (pendingCL >= 10) return "Bien joué! Vous pouvez réclamer vos tokens!";
    return "Utilisez le protocole pour gagner des CL tokens!";
  };

  // Fonction pour obtenir les activités de gains
  const getRewardActivities = () => {
    return [
      { action: "Créer une demande", reward: "10 CL" },
      { action: "Financer un prêt", reward: "50 CL" },
      { action: "Rembourser à temps", reward: "100 CL" },
      { action: "Liquider un prêt", reward: "20 CL" }
    ];
  };

  if (!isConnected) {
    return (
      <Card className="bg-zinc-900 border-zinc-700">
        <CardContent className="p-6">
          <div className="text-center text-gray-400">
            Connectez votre wallet pour voir vos CL tokens
          </div>
        </CardContent>
      </Card>
    );
  }

  if (pendingError || balanceError) {
    return (
      <Card className="bg-zinc-900 border-zinc-700">
        <CardContent className="p-6">
          <div className="text-center text-red-400">
            Erreur lors du chargement de vos tokens
            <p className="text-sm text-gray-400 mt-2">
              {pendingErrorMsg?.message || balanceErrorMsg?.message}
            </p>
            <Button 
              onClick={() => {
                refetchPending();
                refetchBalance();
              }} 
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

  return (
    <div className="w-full max-w-none mx-auto px-6 py-4 space-y-6">
      
      {/* En-tête avec statistiques principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-zinc-900 border-zinc-700">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-gray-400 text-sm">Tokens en Attente</p>
              <p className="text-teal-400 font-bold text-2xl">{pendingCL.toFixed(2)} CL</p>
              <p className="text-gray-500 text-xs">À réclamer</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-zinc-900 border-zinc-700">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-gray-400 text-sm">Dans mon Wallet</p>
              <p className="text-green-400 font-bold text-2xl">{walletCL.toFixed(2)} CL</p>
              <p className="text-gray-500 text-xs">Réclamés</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-zinc-900 border-zinc-700">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-gray-400 text-sm">Total Possédé</p>
              <p className="text-white font-bold text-2xl">{(pendingCL + walletCL).toFixed(2)} CL</p>
              <p className="text-gray-500 text-xs">Cumul</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-zinc-900 border-zinc-700">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-gray-400 text-sm">Supply Total</p>
              <p className="text-blue-400 font-bold text-2xl">{totalCL.toLocaleString()} CL</p>
              <p className="text-gray-500 text-xs">En circulation</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Section principale avec claim et informations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Panneau de réclamation */}
        <Card className="bg-zinc-900 border-zinc-700 shadow-xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-white text-2xl font-bold flex items-center">
              Réclamer mes Tokens
            </CardTitle>
            <p className="text-gray-400">
              {getEncouragementMessage()}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* Affichage du montant à réclamer */}
            <div className="bg-zinc-800 rounded-xl p-6 border border-zinc-700 text-center">
              <div className="text-4xl font-bold text-teal-400 mb-2">
                {pendingCL.toFixed(2)} CL
              </div>
              <p className="text-gray-400 text-sm">
                {canClaim ? "Prêt à être réclamé" : `Minimum 10 CL requis (${(10 - pendingCL).toFixed(2)} manquants)`}
              </p>
            </div>

            {/* Bouton de réclamation */}
            <Button
              onClick={handleClaim}
              disabled={!canClaim || isClaimLoading || isClaimPending || isClaimConfirming}
              className={`w-full py-3 text-lg font-semibold ${
                canClaim 
                  ? 'bg-[#0ec7ca] hover:bg-[#0ec7ca] text-white' 
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isClaimLoading || isClaimPending ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-3"></div>
                  Envoi en cours...
                </div>
              ) : isClaimConfirming ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-3"></div>
                  Confirmation...
                </div>
              ) : canClaim ? (
                "Réclamer mes CL Tokens"
              ) : (
                "Pas assez de tokens"
              )}
            </Button>

            {/* Historique des claims récents */}
            {claimHistory.length > 0 && (
              <div className="mt-6">
                <h4 className="text-white font-semibold mb-3">Claims Récents</h4>
                <div className="space-y-2">
                  {claimHistory.slice(0, 3).map((claim) => (
                    <div key={claim.id} className="bg-zinc-800 rounded-lg p-3 flex justify-between items-center">
                      <div>
                        <p className="text-green-400 font-medium">+{claim.amount.toFixed(2)} CL</p>
                        <p className="text-gray-500 text-xs">{claim.timestamp.toLocaleDateString('fr-FR')}</p>
                      </div>
                      <div className="bg-green-600 w-3 h-3 rounded-full"></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Comment gagner des tokens */}
        <Card className="bg-zinc-900 border-zinc-700 shadow-xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-white text-2xl font-bold flex items-center">
              Comment Gagner des CL
            </CardTitle>
            <p className="text-gray-400">
              Toutes les actions sur ChainLend sont récompensées
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            
            {getRewardActivities().map((activity, index) => (
              <div key={index} className="bg-zinc-800 rounded-xl p-4 border border-zinc-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-teal-400 rounded-full"></div>
                    <div>
                      <p className="text-white font-semibold">{activity.action}</p>
                      <p className="text-gray-400 text-sm">Action du protocole</p>
                    </div>
                  </div>
                  <div className="text-teal-400 font-bold text-lg">
                    +{activity.reward}
                  </div>
                </div>
              </div>
            ))}

            {/* Message d'encouragement */}
            <div className="bg-teal-900/20 border border-teal-700 rounded-xl p-4 mt-6">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-teal-400 rounded-full"></div>
                <div>
                  <p className="text-teal-300 font-semibold">Conseil du jour</p>
                  <p className="text-gray-300 text-sm">
                    Plus vous utilisez ChainLend, plus vous gagnez de CL tokens. 
                    Chaque interaction compte!
                  </p>
                </div>
              </div>
            </div>

            {/* Liens rapides */}
            <div className="grid grid-cols-2 gap-3 mt-6">
              <Button 
                variant="outline" 
                className="border-zinc-600 text-gray-300 hover:bg-zinc-800"
                onClick={() => window.location.href = '/marketplace'}
              >
                Marketplace
              </Button>
              <Button 
                variant="outline" 
                className="border-zinc-600 text-gray-300 hover:bg-zinc-800"
                onClick={() => window.location.href = '/demander'}
              >
                Demander un prêt
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Informations supplémentaires */}
      <Card className="bg-zinc-900 border-zinc-700">
        <CardHeader>
          <CardTitle className="text-white text-xl">À propos des CL Tokens</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-gray-300">
            <div>
              <h4 className="font-semibold text-white mb-2">Sécurité</h4>
              <p>Les CL tokens sont des ERC20 standard sécurisés par les smart contracts auditées de ChainLend.</p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-2">Récompenses</h4>
              <p>Gagnez automatiquement des CL tokens en utilisant le protocole. Chaque action est récompensée.</p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-2">Utilité</h4>
              <p>Les CL tokens représentent votre participation active dans l'écosystème ChainLend.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default MyTokens;