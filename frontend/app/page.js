'use client'

import { useEffect } from 'react';
import NotConnected from "@/components/shared/NotConnected";
import ProtocolStats  from "@/components/shared/ProtocolStats";
import ActiveLoans from '@/components/shared/ActiveLoans';
import HomeMarketPlace from '@/components/shared/HomeMarketPlace';
import { redirect } from 'next/navigation';

import { useAccount, useReadContract } from "wagmi";

export default function Home() {
  redirect('/dashboard')
  const { isConnected } = useAccount();

  return (
    <>
     {isConnected ? (
      <div className="space-y-6">
      </div>
    ) : (
      <div className="w-full">
      <NotConnected /> 
      <ProtocolStats /> 
      <ActiveLoans />
      <HomeMarketPlace />
      </div>
    )}
    </>
  );
}
