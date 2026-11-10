"use client";
import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useWallet } from "@/contexts/wallet-context";
export default function NotFound() {
  const { walletAddress, handleDisconnect } = useWallet();
  return (
    <DashboardLayout
      walletAddress={walletAddress ?? ""}
      onDisconnect={handleDisconnect}
    >
      <section className="surface-panel mx-auto flex min-h-[420px] max-w-2xl flex-col items-center justify-center px-6 text-center">
        <SearchX
          size={32}
          strokeWidth={1.4}
          className="mb-5 text-muted-foreground"
        />
        <span className="eyebrow">ERROR 404</span>
        <h1 className="page-heading">Page not found</h1>
        <p className="page-description">
          This page does not exist. Return to the overview to explore a wallet.
        </p>
        <Link
          href="/"
          className="mt-7 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm text-primary-foreground"
        >
          <ArrowLeft size={15} />
          Back to overview
        </Link>
      </section>
    </DashboardLayout>
  );
}
