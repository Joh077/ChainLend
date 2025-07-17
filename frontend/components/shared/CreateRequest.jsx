'use client'; 

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { contractAddress, contractAbi } from '@/constants';
import { useReadContract, useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits, formatEther } from 'viem';
import { toast } from 'sonner';

export default function CreateRequest() {
  // States du formulaire
  const [amount, setAmount] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [duration, setDuration] = useState('');
  const [description, setDescription] = useState('');
  const [requiredCollateral, setRequiredCollateral] = useState('0');
  const [isLoading, setIsLoading] = useState(false);
  
  // States pour les toasts
  const [transactionToastId, setTransactionToastId] = useState(null);
  const [currentRequestData, setCurrentRequestData] = useState(null);

  // States pour les calculs d'intérêts
  const [totalInterest, setTotalInterest] = useState('0');
  const [totalDebt, setTotalDebt] = useState('0');

  const { address, isConnected } = useAccount();

  // Hook pour écrire dans le contrat
  const { data: hash, error: writeError, isPending: isWritePending, writeContract } = useWriteContract();

  // Hook pour attendre la confirmation de transaction
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash, });

  // Lire les constantes du contrat
  const { data: minInterestRate } = useReadContract({ address: contractAddress, abi: contractAbi, functionName: 'MIN_INTEREST_RATE', });

  const { data: maxInterestRate } = useReadContract({ address: contractAddress, abi: contractAbi, functionName: 'MAX_INTEREST_RATE', });

  const { data: maxLoanAmount } = useReadContract({ address: contractAddress, abi: contractAbi, functionName: 'MAX_LOAN_AMOUNT',});

  // Calcul du collatéral requis en temps réel
  const { data: collateralData } = useReadContract({
    address: contractAddress,
    abi: contractAbi,
    functionName: 'calculateRequiredCollateral',
    args: amount ? [parseUnits(amount, 6)] : undefined,
    query: {
      enabled: !!amount && amount > 0,
    }
  });

  // Mettre à jour le collatéral quand le montant change
  useEffect(() => {
    if (collateralData) {
      setRequiredCollateral(formatEther(collateralData));
    } else {
      setRequiredCollateral('0');
    }
  }, [collateralData]);

  // Calcul des intérêts en temps réel
  useEffect(() => {
    if (amount && interestRate && duration) {
      const principal = parseFloat(amount);
      const rate = parseFloat(interestRate);
      const durationDays = parseInt(duration);
      
      if (principal > 0 && rate > 0 && durationDays > 0) {
        // Calcul des intérêts
        const annualInterest = (principal * rate) / 100;
        const totalInterestAmount = (annualInterest * durationDays) / 365;
        const totalDebtAmount = principal + totalInterestAmount;
        
        setTotalInterest(totalInterestAmount.toFixed(2));
        setTotalDebt(totalDebtAmount.toFixed(2));
      } else {
        setTotalInterest('0');
        setTotalDebt('0');
      }
    } else {
      setTotalInterest('0');
      setTotalDebt('0');
    }
  }, [amount, interestRate, duration]);

  // Gestion du succès de la transaction (3 toasts)
  useEffect(() => {
    if (isConfirmed && transactionToastId && currentRequestData) {
      // Fermer le toast "transaction en cours"
      toast.dismiss(transactionToastId);
      setTransactionToastId(null);
      
      // Toast de Transaction confirmée
      toast.success('Transaction confirmée!', {
        description: 'Votre demande de prêt a été traitée avec succès'
      });
      
      // 3. Toast avec détails 
      setTimeout(() => {
        toast.success('Demande de prêt créée!', {
          description: `${currentRequestData.amount} USDC demandés avec ${currentRequestData.collateral} ETH déposé en collatéral`,
          duration: 5000
        });
      }, 1000);
      
      // Reset du formulaire
      setTimeout(() => {
        setAmount('');
        setInterestRate('');
        setDuration('');
        setDescription('');
        setIsLoading(false);
        setCurrentRequestData(null);
      }, 2000);
    }
  }, [isConfirmed, transactionToastId, currentRequestData]);

  // Gestion des erreurs
  useEffect(() => {
    if (writeError && transactionToastId) {
      // Fermer le toast de transaction
      toast.dismiss(transactionToastId);
      setTransactionToastId(null);
      
      // Messages d'erreur spécifiques
      let errorMessage = 'Erreur lors de la création de la demande';
      
      if (writeError.message.includes('insufficient funds')) {
        errorMessage = 'Fonds insuffisants pour la transaction';
      } else if (writeError.message.includes('InsufficientCollateral')) {
        errorMessage = 'Collatéral insuffisant envoyé';
      } else if (writeError.message.includes('InvalidParameter')) {
        errorMessage = 'Paramètres invalides (vérifiez le taux et la durée)';
      } else if (writeError.message.includes('user rejected')) {
        errorMessage = 'Transaction annulée par l\'utilisateur';
      }
      
      toast.error(errorMessage, {
        description: 'Veuillez réessayer ou vérifier vos paramètres'
      });
      
      setIsLoading(false);
      setCurrentRequestData(null);
    }
  }, [writeError, transactionToastId]);

  // Nettoyage en cas de problème
  useEffect(() => {
    // Si on n'est plus en train de confirmer mais qu'il y a encore un toast, le nettoyer
    if (!isConfirming && !isConfirmed && transactionToastId) {
      setTimeout(() => {
        if (transactionToastId) {
          toast.dismiss(transactionToastId);
          setTransactionToastId(null);
          setIsLoading(false);
        }
      }, 10000);
    }
  }, [isConfirming, isConfirmed, transactionToastId]);

  // Validation du formulaire
  const validateForm = () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Veuillez entrer un montant valide');
      return false;
    }

    if (!interestRate || parseFloat(interestRate) < 5 || parseFloat(interestRate) > 15) {
      toast.error('Le taux d\'intérêt doit être entre 5% et 15%');
      return false;
    }

    if (!duration) {
      toast.error('Veuillez sélectionner une durée');
      return false;
    }

    // Vérifier le montant maximum
    if (maxLoanAmount && parseUnits(amount, 6) > maxLoanAmount) {
      toast.error(`Le montant maximum autorisé est ${formatUnits(maxLoanAmount, 6)} USDC`);
      return false;
    }

    return true;
  };

  // Soumission du formulaire
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!isConnected) {
      toast.error('Veuillez connecter votre wallet');
      return;
    }

    if (!validateForm()) return;

    try {
      setIsLoading(true);
      
      // Conversion des valeurs 
      const amountInWei = parseUnits(amount, 6);
      const rateInBasisPoints = Math.round(parseFloat(interestRate) * 100);
      const durationInSeconds = parseInt(duration) * 24 * 3600;
      
      // Vérifications de sécurité Overflow
      // 65535 = limite uint16 (taux en basis points)
      if (rateInBasisPoints > 65535) {
        toast.error('Taux trop élevé pour le contrat');
        setIsLoading(false);
        return;
      }
      
      //4294967295 = limite uint32 (durée en secondes)
      if (durationInSeconds > 4294967295) {
        toast.error('Durée trop longue pour le contrat');
        setIsLoading(false);
        return;
      }

      if (!collateralData) {
        toast.error('Impossible de calculer le collatéral requis');
        setIsLoading(false);
        return;
      }

      // Sauvegarder les données de la demande pour les toasts
      setCurrentRequestData({
        amount: amount,
        collateral: parseFloat(formatEther(collateralData)).toFixed(4),
        rate: interestRate,
        duration: duration
      });

      // TOAST "TRANSACTION EN COURS"
      const toastId = toast.loading('Transaction en cours...', {
        description: 'Veuillez confirmer la transaction dans votre wallet'
      });
      setTransactionToastId(toastId);

      // LANCER LA TRANSACTION
      writeContract({
        address: contractAddress,
        abi: contractAbi,
        functionName: 'createLoanRequest',
        args: [amountInWei, rateInBasisPoints, durationInSeconds],
        value: collateralData,
        gas: 500000n,
      });

    } catch (error) {
      console.error('Erreur lors de la soumission:', error);
      
      // Fermer le toast en cours s'il existe
      if (transactionToastId) {
        toast.dismiss(transactionToastId);
        setTransactionToastId(null);
      }
      
      let errorMessage = 'Erreur lors de la création de la demande';
      
      if (error.message.includes('insufficient funds')) {
        errorMessage = 'Fonds insuffisants pour la transaction';
      } else if (error.message.includes('gas')) {
        errorMessage = 'Erreur de gas - augmentez la limite de gas';
      } else if (error.message.includes('user rejected')) {
        errorMessage = 'Transaction annulée par l\'utilisateur';
      }
      
      toast.error(errorMessage);
      setIsLoading(false);
      setCurrentRequestData(null);
    }
  };

  // État de chargement global
  const isSubmitting = isLoading || isWritePending || isConfirming;

  return (
    <div className="p-6 bg-zinc-900 text-white rounded-lg space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Montant */}
        <div className="space-y-2">
          <Label htmlFor="amount" className="text-gray-300 text-sm">
            Montant (en USDC) *
          </Label>
          <Input
            id="amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="ex : 10000"
            step="0.01"
            min="0"
            max={maxLoanAmount ? formatUnits(maxLoanAmount, 6) : undefined}
            className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 focus:border-gray-500"
            disabled={isSubmitting}
          />
          <p className="text-xs text-gray-400">
            Combien voulez-vous emprunter ? 
            {maxLoanAmount && ` (Max: ${formatUnits(maxLoanAmount, 6)} USDC)`}
          </p>
          {amount && parseFloat(amount) > 0 && (
            <div className="p-2 bg-blue-900/20 border border-blue-800 rounded text-xs">
              <p className="text-blue-300">
                 Collatéral requis: <strong>{parseFloat(requiredCollateral).toFixed(4)} ETH</strong>
              </p>
              <p className="text-blue-400 mt-1">
                (Ratio de collatéralisation: 150%)
              </p>
            </div>
          )}
        </div>

        {/* Taux d'intérêt */}
        <div className="space-y-2">
          <Label htmlFor="interest" className="text-gray-300 text-sm">
            Taux d'intérêt souhaité *
          </Label>
          <Input
            id="interest"
            type="number"
            value={interestRate}
            onChange={(e) => setInterestRate(e.target.value)}
            placeholder="ex : 8"
            step="0.1"
            min="5"
            max="15"
            className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 focus:border-gray-500"
            disabled={isSubmitting}
          />
          <p className="text-xs text-gray-400">
            Taux annuel entre 5% et 15%
          </p>
          {amount && interestRate && duration && parseFloat(amount) > 0 && parseFloat(interestRate) > 0 && (
            <div className="p-2 bg-green-900/20 border border-green-800 rounded text-xs">
              <p className="text-green-300">
                 Intérêts totaux: <strong>{parseFloat(totalInterest).toLocaleString()} USDC</strong>
              </p>
              <p className="text-green-400 mt-1">
                (Sur {duration} jours à {interestRate}% annuel)
              </p>
            </div>
          )}
        </div>

        {/* Durée */}
        <div className="space-y-2">
          <Label htmlFor="duration" className="text-gray-300 text-sm">
            Durée (en jours) *
          </Label>
          <Select value={duration} onValueChange={setDuration} disabled={isSubmitting}>
            <SelectTrigger className="bg-gray-800 border-gray-600 text-white focus:border-gray-500">
              <SelectValue placeholder="Sélectionnez une durée" />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-600">
              <SelectItem value="30" className="text-white hover:bg-gray-700">30 jours</SelectItem>
              <SelectItem value="90" className="text-white hover:bg-gray-700">90 jours</SelectItem>
              <SelectItem value="183" className="text-white hover:bg-gray-700">6 mois (183 jours)</SelectItem>
              <SelectItem value="365" className="text-white hover:bg-gray-700">1 an (365 jours)</SelectItem>
              <SelectItem value="1095" className="text-white hover:bg-gray-700">3 ans (1095 jours)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-400">
            Durée de l'emprunt
          </p>
        </div>

        {/* Résumé avant soumission avec dette totale */}
        {amount && interestRate && duration && (
          <div className="p-4 bg-gray-800 border border-gray-600 rounded space-y-3">
            <h4 className="font-medium text-gray-200">Résumé de votre demande:</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {/* Colonne 1: Détails du prêt */}
              <div className="space-y-2">
                <h5 className="font-medium text-gray-300"> Détails du prêt:</h5>
                <div className="text-gray-300 space-y-1">
                  <p>• Montant: {parseFloat(amount).toLocaleString()} USDC</p>
                  <p>• Taux: {interestRate}% par an</p>
                  <p>• Durée: {duration} jours</p>
                </div>
              </div>
              
              {/* Colonne 2: Calculs financiers */}
              <div className="space-y-2">
                <h5 className="font-medium text-gray-300"> Calculs financiers:</h5>
                <div className="text-gray-300 space-y-1">
                  <p>• Intérêts: {parseFloat(totalInterest).toLocaleString()} USDC</p>
                  <p className="text-yellow-300 font-medium">• Dette totale: {parseFloat(totalDebt).toLocaleString()} USDC</p>
                  <p>• Collatéral: {parseFloat(requiredCollateral).toFixed(4)} ETH</p>
                </div>
              </div>
            </div>
            
            <div className="border-t border-gray-600 pt-3">
              <p className="text-yellow-400 text-sm font-medium">
                À rembourser: {parseFloat(totalDebt).toLocaleString()} USDC ({parseFloat(amount).toLocaleString()} + {parseFloat(totalInterest).toLocaleString()} d'intérêts)
              </p>
              <p className="text-orange-400 text-sm mt-1">
                Assurez-vous d'avoir au moins {parseFloat(requiredCollateral).toFixed(4)} ETH dans votre wallet
              </p>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <Button 
          type="submit"
          className="w-full bg-white text-black hover:bg-gray-200 font-medium py-2 px-4 rounded"
          disabled={isSubmitting || !isConnected}
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
              {isWritePending ? 'Confirmation...' : isConfirming ? 'En cours...' : 'Traitement...'}
            </span>
          ) : (
            'Créer la demande'
          )}
        </Button>

        {!isConnected && (
          <p className="text-center text-yellow-400 text-sm">
            Veuillez connecter votre wallet pour continuer
          </p>
        )}
      </form>
    </div>
  );
}