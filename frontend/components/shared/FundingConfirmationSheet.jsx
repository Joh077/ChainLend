'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { contractAddress, usdcAddress, usdcAbi } from '@/constants';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { toast } from 'sonner';

export function FundingConfirmationSheet({ isOpen, onClose, request, onFundingSuccess, contractAbi }) {

  const [currentStep, setCurrentStep] = useState(1); // 1: Approve, 2: Fund
  const [isApproving, setIsApproving] = useState(false);
  const [isFunding, setIsFunding] = useState(false);

  const { address } = useAccount();

  // Hook pour écrire dans les contrats
  const { data: hash, error: writeError, isPending: isWritePending, writeContract } = useWriteContract();

  // Hook pour attendre la confirmation
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash, });

  // Vérifie l'allowance USDC
  const { data: usdcAllowance, refetch: refetchAllowance } = useReadContract({
    address: usdcAddress,
    abi: usdcAbi,
    functionName: 'allowance',
    args: address ? [address, contractAddress] : undefined,
    query: {
      enabled: !!address && isOpen,
      refetchInterval: 3000,
    }
  });

  // Vérifie si l'allowance est suffisante
  const requiredAmount = request ? parseUnits(request.amountRaw.toString(), 6) : 0n;
  const hasEnoughAllowance = usdcAllowance && usdcAllowance >= requiredAmount;

  // Met à jour l'étape basée sur l'allowance
  useEffect(() => {
    if (hasEnoughAllowance) {
      setCurrentStep(2);
    } else {
      setCurrentStep(1);
    }
  }, [hasEnoughAllowance]);

  // Gestion du succès des transactions
  useEffect(() => {
    if (isConfirmed) {
      if (isApproving) {
        // Approbation réussie
        toast.success('USDC approuvés avec succès!', {
          description: 'Vous pouvez maintenant financer le prêt'
        });
        setIsApproving(false);
        setCurrentStep(2);
        
        // Refresh de l'allowance
        setTimeout(() => {
          refetchAllowance();
        }, 1000);
      } 
      
      else if (isFunding) {
        // Financement réussi
        toast.success('Prêt financé avec succès!', {
          description: `Vous avez financé ${request?.amount} avec succès`
        });
        setIsFunding(false);
        onFundingSuccess && onFundingSuccess(request?.id);
        onClose();
      }
    }
  }, [isConfirmed, isApproving, isFunding, request, onFundingSuccess, onClose, refetchAllowance]);

  // Gestion des erreurs
  useEffect(() => {
    if (writeError) {
      let errorMessage = 'Erreur lors de la transaction';
      
      if (writeError.message.includes('user rejected')) {
        errorMessage = 'Transaction annulée par l\'utilisateur';
      } 
      
      else if (writeError.message.includes('insufficient funds')) {
        errorMessage = 'Fonds insuffisants';
      }
      
      toast.error(errorMessage);
      setIsApproving(false);
      setIsFunding(false);
    }
  }, [writeError]);

  // Fonction pour approuver les USDC
  const handleApprove = async () => {
    if (!request) return;

    try {
      setIsApproving(true);
      
      const approveAmount = parseUnits(request.amountRaw.toString(), 6);
      
      await writeContract({
        address: usdcAddress,
        abi: usdcAbi,
        functionName: 'approve',
        args: [contractAddress, approveAmount],
      });
    } catch (error) {
      console.error('Erreur approbation:', error);
      setIsApproving(false);
    }
  };

  // Fonction pour financer le prêt
  const handleFunding = async () => {
    if (!request) return;

    try {
      // Vérifications avant financement
      const requiredAmount = parseUnits(request.amountRaw.toString(), 6);

      if (!hasEnoughAllowance) {
        toast.error('Approbation USDC insuffisante - Veuillez recommencer l\'étape 1');
        return;
      }

      setIsFunding(true);
      
      await writeContract({
        address: contractAddress,
        abi: contractAbi,
        functionName: 'fundLoan',
        args: [BigInt(request.id)],
        gas: 500000n, 
      });
      
    } catch (error) {
      console.error(' Erreur détaillée lors du financement:', {
        error: error.message,
        cause: error.cause,
        code: error.code,
        requestId: request.id
      });
      setIsFunding(false);
      
      // Messages d'erreurs
      let errorMessage = 'Erreur lors du financement';
      
      if (error.message.includes('User rejected')) {
        errorMessage = 'Transaction annulée par l\'utilisateur';
      } else if (error.message.includes('insufficient funds')) {
        errorMessage = 'Fonds insuffisants pour payer les frais de gas';
      } else if (error.message.includes('execution reverted')) {
        errorMessage = 'Transaction rejetée par le contrat - Vérifiez que la demande est toujours valide';
      } else if (error.message.includes('InvalidRequest')) {
        errorMessage = 'Demande invalide - Elle a peut-être déjà été financée';
      } else if (error.message.includes('Unauthorized')) {
        errorMessage = 'Vous ne pouvez pas financer votre propre demande';
      }
      
      toast.error(errorMessage, {
        description: 'Consultez la console pour plus de détails'
      });
    }
  };

  // Reset states quand le sheet est fermé
  useEffect(() => {
    if (!isOpen) {
      setIsApproving(false);
      setIsFunding(false);
    }
  }, [isOpen]);

  if (!request) return null;

  const isProcessing = isApproving || isFunding || isWritePending || isConfirming;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="bg-zinc-900 border-zinc-700 text-white w-[500px] sm:max-w-[500px] overflow-y-auto p-6">
        <SheetHeader className="pb-4">
          <SheetTitle className="font-rasputin text-white text-xl">
             Financer ce prêt
          </SheetTitle>
          <SheetDescription className="text-gray-400 text-sm">
            Récapitulatif et confirmation du financement
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4">
          
          {/* Informations de l'emprunteur */}
          <div className="bg-zinc-800 rounded-lg p-3 border border-zinc-700">
            <h3 className="text-white font-medium mb-2 text-sm">Emprunteur</h3>
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-teal-500 rounded-full flex items-center justify-center">
                <span className="text-black font-bold text-xs">{request.avatar}</span>
              </div>
              <div>
                <p className="text-white font-medium text-sm">#{request.id} {request.name}</p>
                <p className="text-gray-400 text-xs">{request.completedLoans} prêts complétés</p>
              </div>
            </div>
          </div>

          {/* Détails du prêt */}
          <div className="bg-zinc-800 rounded-lg p-3 border border-zinc-700">
            <h3 className="text-white font-medium mb-3 text-sm">Détails du prêt</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-gray-400 text-xs">Montant à prêter</p>
                <p className="text-white font-bold text-sm">{request.amount}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Taux d'intérêt</p>
                <p className="text-green-400 font-bold text-sm">{request.apr}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Durée</p>
                <p className="text-blue-400 font-bold text-sm">{request.demandDays} jours</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Collatéral ETH</p>
                <p className="text-blue-400 font-bold text-sm">{request.collateral}</p>
              </div>
            </div>
          </div>

          {/* Calculs de rendement */}
          <div className="bg-green-900/20 border border-green-700 rounded-lg p-3">
            <h3 className="text-green-400 font-medium mb-2 text-sm">Votre rendement</h3>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-300 text-xs">Montant prêté:</span>
                <span className="text-white font-medium text-xs">{request.amount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300 text-xs">Intérêts bruts:</span>
                <span className="text-green-300 text-xs">+{request.totalInterest} USDC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300 text-xs">Frais protocole (10%):</span>
                <span className="text-red-300 text-xs">-{(parseFloat(request.totalInterest) * 0.1).toFixed(2)} USDC</span>
              </div>
              <div className="flex justify-between border-t border-green-700 pt-1">
                <span className="text-gray-300 text-xs font-medium">Intérêts nets:</span>
                <span className="text-green-400 font-bold text-xs">
                  +{(parseFloat(request.totalInterest) * 0.9).toFixed(2)} USDC
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300 text-xs font-medium">Total remboursé:</span>
                <span className="text-green-400 font-bold text-xs">
                  {(request.amountRaw + parseFloat(request.totalInterest) * 0.9).toLocaleString()} USDC
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300 text-xs">ROI net:</span>
                <span className="text-green-400 font-bold text-xs">
                  {((parseFloat(request.totalInterest) * 0.9 / request.amountRaw) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* Étapes du processus */}
          <div className="bg-zinc-800 rounded-lg p-3 border border-zinc-700">
            <h3 className="text-white font-medium mb-3 text-sm">Processus de financement</h3>
            
            {/* Étape 1 */}
            <div className={`flex items-start space-x-2 mb-3 ${currentStep === 1 ? 'opacity-100' : 'opacity-60'}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                currentStep > 1 ? 'bg-green-600 text-white' : 
                currentStep === 1 ? 'bg-yellow-600 text-white' : 'bg-gray-600 text-gray-300'
              }`}>
                {currentStep > 1 ? '✓' : '1'}
              </div>
              <div className="flex-1">
                <p className="text-white font-medium text-xs">Approuver les USDC</p>
                <p className="text-gray-400 text-xs">
                  Autoriser le contrat ChainLend à transférer vos {request.amount} vers l'emprunteur
                </p>
              </div>
            </div>

            {/* Étape 2 */}
            <div className={`flex items-start space-x-2 ${currentStep === 2 ? 'opacity-100' : 'opacity-60'}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                currentStep === 2 ? 'bg-yellow-600 text-white' : 'bg-gray-600 text-gray-300'
              }`}>
                2
              </div>
              <div className="flex-1">
                <p className="text-white font-medium text-xs">Financer le prêt</p>
                <p className="text-gray-400 text-xs">
                  Transférer les fonds à l'emprunteur et démarrer le prêt
                </p>
              </div>
            </div>
          </div>

          {/* Messages d'information */}
          <div className="bg-blue-900/20 border border-blue-600 rounded-lg p-3">
            <p className="text-blue-300 text-xs">
              <span className="font-semibold">Important:</span>
              {currentStep === 1 ? (
                " Vous devez d'abord approuver le contrat à utiliser vos USDC. Cette transaction ne transfère pas encore vos fonds."
              ) : (
                " L'approbation est validée ! Vous pouvez maintenant finaliser le financement du prêt."
              )}
            </p>
          </div>

          {/* Boutons d'action */}
          <div className="space-y-2 pt-3 border-t border-zinc-700">
            {currentStep === 1 ? (
              <Button 
                onClick={handleApprove}
                disabled={isProcessing}
                className="w-full py-3 bg-yellow-600 hover:bg-yellow-500 text-white font-medium text-sm"
              >
                {isProcessing && isApproving ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    {isWritePending ? 'Confirmation wallet...' : 'Approbation en cours...'}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    
                    Étape 1: Approuver {request.amount}
                  </span>
                )}
              </Button>
            ) : (
              <Button 
                onClick={handleFunding}
                disabled={isProcessing}
                className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-medium text-sm"
              >
                {isProcessing && isFunding ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    {isWritePending ? 'Confirmation wallet...' : 'Financement en cours...'}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">                   
                    Étape 2: Financer le prêt ({request.amount})
                  </span>
                )}
              </Button>
            )}

            <Button 
              onClick={onClose}
              disabled={isProcessing}
              variant="outline"
              className="w-full py-2 border-zinc-600 text-gray-300 hover:bg-zinc-800 text-sm"
            >
              Annuler
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default FundingConfirmationSheet;