"use client";

import { useEffect, useState } from "react";
import {
  Check,
  CircleHelp,
  ExternalLink,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface TokenDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: {
    symbol: string;
    name: string;
    address: string;
    balance: string;
    valueUSD: number;
    priceUSD: number;
    change24h: number;
    verified: boolean;
    hasNoPriceData?: boolean;
    riskLevel?: "low" | "medium" | "high";
    scamResult?: unknown;
    priceSource?: string;
    confidence?: number;
  } | null;
}

type StatsState = {
  address: string;
  status: "loading" | "ready" | "unavailable";
  holders: number | null;
};
const NATIVE_ADDRESS = "0x0000000000000000000000000000000000000000";
const money = (value: number) =>
  value > 0 && value < 0.000001
    ? `$${value.toExponential(3)}`
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: value < 1 ? 8 : 2,
      }).format(value);
const amount = (value: string) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return value;
  return parsed > 0 && parsed < 0.000001
    ? parsed.toPrecision(6)
    : new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 }).format(
        parsed,
      );
};

export function TokenDetailModal({
  isOpen,
  onClose,
  token,
}: TokenDetailModalProps) {
  const [stats, setStats] = useState<StatsState | null>(null);
  const address = token?.address.toLowerCase() || "";
  const isNative =
    address === NATIVE_ADDRESS ||
    (!address && token?.symbol.toUpperCase() === "ETH");
  const isContract = /^0x[a-f0-9]{40}$/.test(address) && !isNative;

  useEffect(() => {
    if (!isOpen || !isContract) return;
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 8000);
    setStats({ address, status: "loading", holders: null });
    const loadStats = async () => {
      try {
        const response = await fetch(
          `/api/token-stats?address=${encodeURIComponent(address)}`,
          {
            headers: { Accept: "application/json" },
            signal: controller.signal,
          },
        );
        if (!response.ok) throw new Error("Token statistics unavailable");
        const result: unknown = await response.json();
        const value =
          result && typeof result === "object" && "holders" in result
            ? result.holders
            : null;
        const holders =
          typeof value === "number" && Number.isSafeInteger(value) && value >= 0
            ? value
            : null;
        if (active)
          setStats({
            address,
            status: holders === null ? "unavailable" : "ready",
            holders,
          });
      } catch {
        if (active) setStats({ address, status: "unavailable", holders: null });
      } finally {
        clearTimeout(timeout);
      }
    };
    void loadStats();
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [address, isContract, isOpen]);

  if (!token) return null;
  const hasPrice =
    !token.hasNoPriceData &&
    Number.isFinite(token.priceUSD) &&
    token.priceUSD > 0;
  const hasValuation =
    hasPrice && Number.isFinite(token.valueUSD) && token.valueUSD >= 0;
  const currentStats = stats?.address === address ? stats : null;
  const loadingStats =
    isContract && (!currentStats || currentStats.status === "loading");
  const explorerUrl = isNative
    ? "https://etherscan.io/"
    : isContract
      ? `https://etherscan.io/token/${address}`
      : null;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-xl p-0 sm:max-w-[560px]">
        <DialogHeader className="border-b border-border px-6 pb-5 pt-7 text-left">
          <div className="mb-5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Ethereum Mainnet / Asset details
          </div>
          <div className="flex items-center gap-3.5 pr-5">
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-xl font-medium text-primary"
              aria-hidden="true"
            >
              {isNative ? (
                <svg width="18" height="28" viewBox="0 0 15 23" fill="none">
                  <path
                    d="m7.5 0 7.5 12-7.5 4L0 12 7.5 0Z"
                    fill="currentColor"
                    opacity=".85"
                  />
                  <path
                    d="M0 13.5 7.5 23 15 13.5l-7.5 4L0 13.5Z"
                    fill="currentColor"
                    opacity=".6"
                  />
                </svg>
              ) : (
                token.symbol.slice(0, 1)
              )}
            </span>
            <div className="min-w-0">
              <DialogTitle className="break-words text-xl font-semibold tracking-tight">
                {token.name}
              </DialogTitle>
              <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                <span>{token.symbol}</span>
                <span className="h-0.5 w-0.5 rounded-full bg-muted-foreground" />
                <span>{isNative ? "Native asset" : "ERC-20 token"}</span>
                {token.verified && (
                  <span className="inline-flex items-center gap-1 text-primary">
                    <Check size={11} />
                    Recognized
                  </span>
                )}
              </div>
            </div>
          </div>
          <DialogDescription className="mt-4 text-xs leading-relaxed">
            Holdings and available market data for the selected wallet.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 p-6">
          <section
            aria-label="Your position"
            className="rounded-lg border border-border bg-muted/20 p-5"
          >
            <p className="text-xs text-muted-foreground">
              Estimated position value
            </p>
            <p className="usd-value mt-3 text-[32px] font-semibold leading-none tracking-tight tabular-nums">
              {hasValuation ? money(token.valueUSD) : "Unavailable"}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-5 border-t border-border pt-4">
              <div>
                <p className="text-[11px] text-muted-foreground">
                  Token balance
                </p>
                <p
                  className="balance-amount mt-2 break-all text-sm font-medium tabular-nums"
                  title={token.balance}
                >
                  {amount(token.balance)}
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                    {token.symbol}
                  </span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-muted-foreground">
                  Observed price
                </p>
                <p className="usd-value mt-2 text-sm font-medium tabular-nums">
                  {hasPrice ? money(token.priceUSD) : "Unavailable"}
                </p>
              </div>
            </div>
          </section>

          <section aria-labelledby="asset-information-heading">
            <h3
              id="asset-information-heading"
              className="mb-1 text-sm font-semibold"
            >
              Asset information
            </h3>
            <dl className="divide-y divide-border">
              <div className="flex items-center justify-between gap-4 py-3.5 text-xs">
                <dt className="text-muted-foreground">Network</dt>
                <dd>Ethereum</dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3.5 text-xs">
                <dt className="text-muted-foreground">Token holders</dt>
                <dd aria-live="polite">
                  {isNative ? (
                    <span className="text-muted-foreground">
                      Not applicable
                    </span>
                  ) : loadingStats ? (
                    <span className="inline-flex items-center gap-2 text-muted-foreground">
                      <Loader2 size={12} className="animate-spin" />
                      Loading
                    </span>
                  ) : currentStats?.holders !== null &&
                    currentStats?.holders !== undefined ? (
                    currentStats.holders.toLocaleString()
                  ) : (
                    <span className="text-muted-foreground">Unavailable</span>
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3.5 text-xs">
                <dt className="text-muted-foreground">Price source</dt>
                <dd className="text-right">
                  {hasPrice
                    ? token.priceSource || "Available provider quote"
                    : "Unavailable"}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-lg border border-border p-4">
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck size={15} className="text-muted-foreground" />
              <h3 className="text-xs font-medium">
                {isNative ? "Native asset" : "Contract address"}
              </h3>
            </div>
            <p className="break-all font-mono text-[11px] leading-relaxed text-muted-foreground">
              {isNative
                ? "ETH is Ethereum’s native asset. It does not have an ERC-20 contract address."
                : token.address || "Contract address unavailable."}
            </p>
            {explorerUrl && (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="mt-4 h-8 rounded-md text-xs"
              >
                <a href={explorerUrl} target="_blank" rel="noopener noreferrer">
                  {isNative ? "Explore Ethereum" : "View contract on Etherscan"}
                  <ExternalLink className="ml-2 h-3 w-3" />
                </a>
              </Button>
            )}
          </section>
          <div className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
            <CircleHelp size={13} className="mt-0.5 shrink-0" />
            <p>
              Quotes do not establish liquidity or sellability. A recognized
              contract is not a safety guarantee. Missing provider data is
              marked unavailable.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
