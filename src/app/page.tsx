"use client";
import { LandingPage } from "@/components/features/landing/landing-page";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Overview } from "@/components/features/portfolio/overview";
import { WalletAnalysisErrorBoundary } from "@/components/error-boundary";
import { useWallet } from "@/contexts/wallet-context";
export default function Home() {
  const { walletAddress, setWalletAddress, handleDisconnect, hydrated } =
    useWallet();
  if (!hydrated)
    return (
      <div className="min-h-screen grid place-items-center" role="status">
        <span className="eyebrow">OPENING ETHERVIEW…</span>
      </div>
    );
  if (!walletAddress) return <LandingPage onWalletConnect={setWalletAddress} />;
  return (
    <WalletAnalysisErrorBoundary>
      <DashboardLayout
        walletAddress={walletAddress}
        onDisconnect={handleDisconnect}
      >
        <Overview walletAddress={walletAddress} />
      </DashboardLayout>
    </WalletAnalysisErrorBoundary>
  );
}
