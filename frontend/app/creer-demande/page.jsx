'use client'

import { useEffect } from 'react';
import NotConnected from "@/components/shared/NotConnected";
import CreateForm from '@/components/shared/CreateForm';

import { useAccount, useReadContract } from "wagmi";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { Input } from '@/components/ui/input';

export default function CreerDemandePage() {

  const { isConnected } = useAccount();

  return (
    <div className='w-full min-w-150 grid grid-cols-1 md:grid-cols-4 lg:grid-cols-2 gap-18 p-4'>

      <Card className='m-10 bg-zinc-900'>
      <CardHeader>
        <CardTitle>Créer votre demande d'emprunt</CardTitle>
        <CardDescription>Déposez des ETH pour être visible dans la MarketPlace</CardDescription>
      </CardHeader>
      <CreateForm className='m-5 grow min-w-600' />
      </Card>
      
    </div>
  );
}