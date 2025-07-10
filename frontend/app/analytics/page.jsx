'use client'

import { useEffect } from 'react';
import NotConnected from "@/components/shared/NotConnected";


import { useAccount, useReadContract } from "wagmi";

export default function AnalyticsPage() {

  const { isConnected } = useAccount();

  return (
    <>
     
    </>
  );
}