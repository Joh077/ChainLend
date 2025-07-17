'use client'
import { useEffect } from 'react';
import NotConnected from "@/components/shared/NotConnected";
import CreateRequest from '@/components/shared/CreateRequest';
import { useAccount, useReadContract } from "wagmi";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";

export default function CreerDemandePage() {
  const { isConnected } = useAccount();

  return (
    <div className='w-full min-w-400 grid grid-cols-1 md:grid-cols-4 lg:grid-cols-2 gap-18 p-4'>
      <Card className='m-10 bg-zinc-900'>
        <CardHeader>
          <CardTitle className="font-rasputin text-white text-xl">Créer votre demande d'emprunt</CardTitle>
          <CardDescription className="text-gray-400">
            Déposez des ETH pour être visible dans la MarketPlace
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isConnected ? (
            <CreateRequest />
          ) : (
            <NotConnected />
          )}
        </CardContent>
      </Card>
    </div>
  );
}