"use client";

import { useEffect, useState } from "react";
import { LandingPage } from "@/components/features/landing/landing-page";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Overview } from "@/components/features/portfolio/overview";
import { WalletAnalysisErrorBoundary } from "@/components/error-boundary";
import { useWallet } from "@/contexts/wallet-context";

export default function Home() {
  const { walletAddress, setWalletAddress, handleDisconnect } = useWallet();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show landing page if no wallet is connected
  if (!walletAddress) {
    return <LandingPage onWalletConnect={setWalletAddress} />;
  }

  // Show dashboard if wallet is connected
  return (
    <WalletAnalysisErrorBoundary>
      <DashboardLayout walletAddress={walletAddress || ''} onDisconnect={handleDisconnect}>
        <Overview walletAddress={walletAddress || ''} />
      </DashboardLayout>
    </WalletAnalysisErrorBoundary>
  );
}