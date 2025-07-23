'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { contractAddress, usdcAddress, usdcAbi } from '@/constants';

import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { parseUnits } from 'viem';

import { toast } from 'sonner';

export function FundingConfirmationSheet({ isOpen, onClose, request, onFundingSuccess, contractAbi }) {
  // États pour les étapes du processus
  const [currentStep, setCurrentStep] = useState(1); // 1: Approve, 2: Fund
  const [isApproving, setIsApproving] = useState(false);
  const [isFunding, setIsFunding] = useState(false);

  // Adresse wallet
  const { address } = useAccount();

  // Hook pour écrire dans les contrats
  const { data: hash, error: writeError, isPending: isWritePending, writeContract } = useWriteContract();

  // Hook pour attendre la confirmation
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash, });

  // Vérification de l'allowance USDC
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

  // Calcul si l'allowance est suffisante
  const requiredAmount = request ? parseUnits(request.amountRaw.toString(), 6) : 0n;
  const hasEnoughAllowance = usdcAllowance && usdcAllowance >= requiredAmount;

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
      console.error('Erreur lors du financement:', error);
      setIsFunding(false);
      toast.error('Erreur lors du financement');
    }
  };

  // Mise à jour de l'étape basée sur l'allowance
  useEffect(() => {
    if (hasEnoughAllowance) {
      setCurrentStep(2); // passer directement au financement
    } else {
      setCurrentStep(1); // commencer par l'approbation
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
          refetchAllowance(); //Vérification que l'approval a bien été enregistrée
        }, 1000);
      } 
      else if (isFunding) {
        // Financement réussi
        toast.success('Prêt financé avec succès!', {
          description: `Vous avez financé ${request?.amount} avec succès`
        });
        setIsFunding(false);
        onFundingSuccess && onFundingSuccess(request?.id); //Callback vers le parent
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

  // Reset des états quand le sheet est fermé
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
      <SheetContent className="bg-zinc-900 border-zinc-700 text-white w-[400px] sm:max-w-[400px] p-6">
        
        {/* Titre du sheet */}
        <SheetHeader className="pb-6">
          <SheetTitle className="font-rasputin text-white text-xl">
            Financer ce prêt
          </SheetTitle>
          <SheetDescription className="text-gray-400 text-sm">
            Processus en 2 étapes pour financer le prêt
          </SheetDescription>
        </SheetHeader>

        {/* Boutons d'action */}
        <div className="space-y-4">
          
          {/* Étape 1 : Approbation */}
          {currentStep === 1 ? (
            <Button 
              onClick={handleApprove}
              disabled={isProcessing}
              className="w-full py-3 bg-yellow-600 hover:bg-yellow-500 text-white font-medium"
            >
              {isProcessing && isApproving ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  {isWritePending ? 'Confirmation wallet...' : 'Approbation en cours...'}
                </span>
              ) : (
                `Étape 1: Approuver ${request.amount}`
              )}
            </Button>
          ) : (
            
            /* Étape 2 : Financement */
            <Button 
              onClick={handleFunding}
              disabled={isProcessing}
              className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-medium"
            >
              {isProcessing && isFunding ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  {isWritePending ? 'Confirmation wallet...' : 'Financement en cours...'}
                </span>
              ) : (
                `Étape 2: Financer le prêt (${request.amount})`
              )}
            </Button>
          )}

          {/* Bouton Annuler */}
          <Button 
            onClick={onClose}
            disabled={isProcessing}
            variant="outline"
            className="w-full py-2 border-zinc-600 text-gray-300 hover:bg-zinc-800"
          >
            Annuler
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default FundingConfirmationSheet;