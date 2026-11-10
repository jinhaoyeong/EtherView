"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ResearchHeader } from "@/components/shared/research-header";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useWallet } from "@/contexts/wallet-context";
import { WalletAPI } from "@/lib/api/wallet";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";

type Movement = {
  id: string;
  hash: string;
  timestamp: number;
  from: string;
  to: string;
  value: string;
  valueUSD: number;
  tokenSymbol: string;
  tokenAddress?: string;
  movementType: "deposit" | "withdrawal" | "transfer" | "defi_interaction";
  exchangeName?: string;
  reasoning?: string[];
};
const short = (address: string) =>
  address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Unknown";
const usd = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    notation: value >= 1e6 ? "compact" : "standard",
  }).format(value);
const date = (timestamp: number) =>
  new Date(timestamp < 1e12 ? timestamp * 1000 : timestamp).toLocaleString(
    undefined,
    { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" },
  );

export default function WhaleMovement() {
  const { walletAddress, handleDisconnect } = useWallet();
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threshold, setThreshold] = useState("20000");
  const [direction, setDirection] = useState("all");
  const [scanned, setScanned] = useState(0);
  const request = useRef(0);

  const load = useCallback(async (address: string) => {
    const requestId = ++request.current;
    setLoading(true);
    setError(null);
    try {
      // A single combined request avoids refetching overlapping history prefixes.
      const transactions = await WalletAPI.fetchTransactions(address, 1, 300);
      const result: Movement[] = await WalletAPI.detectWhaleMovements(
        transactions,
        20000,
      );
      if (requestId !== request.current) return;
      setScanned(transactions.length);
      setMovements(result);
    } catch (err) {
      if (requestId === request.current)
        setError(
          err instanceof Error
            ? err.message
            : "Large transfers could not be loaded. Please try again.",
        );
    } finally {
      if (requestId === request.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    setMovements([]);
    setScanned(0);
    if (walletAddress) void load(walletAddress);
    else {
      setLoading(false);
      setError(null);
    }
    const lifecycle = request;
    return () => {
      lifecycle.current++;
    };
  }, [walletAddress, load]);
  const refresh = async () => {
    if (!walletAddress || loading || refreshing) return;
    setRefreshing(true);
    WalletAPI.clearTransactionCache(walletAddress);
    await load(walletAddress);
  };
  useAutoRefresh(refresh, !!walletAddress, 300);

  const incoming = useCallback(
    (movement: Movement) =>
      movement.to?.toLowerCase() === walletAddress?.toLowerCase(),
    [walletAddress],
  );
  const visible = useMemo(
    () =>
      movements.filter(
        (movement) =>
          movement.valueUSD >= Number(threshold) &&
          (direction === "all" ||
            (direction === "in" ? incoming(movement) : !incoming(movement))),
      ),
    [movements, threshold, direction, incoming],
  );
  const inflow = visible
    .filter(incoming)
    .reduce((sum, movement) => sum + movement.valueUSD, 0);
  const outflow = visible
    .filter((movement) => !incoming(movement))
    .reduce((sum, movement) => sum + movement.valueUSD, 0);
  const volume = inflow + outflow;

  return (
    <DashboardLayout
      walletAddress={walletAddress || ""}
      onDisconnect={handleDisconnect}
    >
      <div className="workspace-page research-page space-y-7">
        <ResearchHeader
          index="03"
          category="Follow the flow"
          title="Large transfers"
          description="Track the movements that matter within this wallet’s available history."
          tone="lilac"
        >
          <Button
            variant="outline"
            onClick={refresh}
            disabled={!walletAddress || loading || refreshing}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh history
          </Button>
        </ResearchHeader>

        {scanned > 0 && !error && (
          <dl className="research-statbar">
            {[
              {
                label: "Matching transfers",
                value: visible.length.toLocaleString(),
              },
              { label: "Transfer volume", value: usd(volume) },
              { label: "Incoming volume", value: usd(inflow) },
              { label: "Outgoing volume", value: usd(outflow) },
            ].map((item) => (
              <div key={item.label} className="surface-panel px-5 py-4">
                <dt className="text-xs text-muted-foreground">{item.label}</dt>
                <dd className="balance-amount mt-2 text-2xl font-semibold tracking-tight tabular-nums">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
        )}

        <section className="surface-panel research-ledger whale-ledger overflow-hidden">
          <div className="flex flex-col justify-between gap-4 border-b border-border p-5 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-base font-medium">Large transfer activity</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {scanned
                  ? `${scanned} records checked · ${visible.length} matches`
                  : "Up to 300 available records · USD estimates use current prices"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={threshold} onValueChange={setThreshold}>
                <SelectTrigger
                  className="w-40"
                  aria-label="Minimum transfer value"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20000">Over $20,000</SelectItem>
                  <SelectItem value="100000">Over $100,000</SelectItem>
                  <SelectItem value="1000000">Over $1 million</SelectItem>
                </SelectContent>
              </Select>
              <Select value={direction} onValueChange={setDirection}>
                <SelectTrigger className="w-36" aria-label="Transfer direction">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All directions</SelectItem>
                  <SelectItem value="in">Incoming</SelectItem>
                  <SelectItem value="out">Outgoing</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && (
            <div
              role="status"
              className="flex items-start gap-3 border border-border bg-muted/30 p-5 text-sm"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <h3 className="font-medium">
                  History is temporarily unavailable
                </h3>
                <p className="mt-2 max-w-2xl text-muted-foreground">{error}</p>
                <Button
                  variant="link"
                  onClick={refresh}
                  className="h-auto px-0 py-2"
                >
                  Try again
                </Button>
              </div>
            </div>
          )}

          {!walletAddress ? (
            <div className="research-empty border-b border-border px-6 py-14">
              <p className="eyebrow">No address selected</p>
              <h3 className="mt-3 text-lg font-medium">
                Select a wallet to inspect its transfers.
              </h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                This register follows one public Ethereum address. It does not
                represent a network-wide whale feed.
              </p>
              <Button asChild variant="outline" className="mt-5">
                <Link href="/">
                  Select an address
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          ) : loading && !movements.length ? (
            <div
              role="status"
              aria-label="Scanning large transfers"
              className="space-y-2 p-5"
            >
              {Array.from({ length: 5 }, (_, index) => (
                <div key={index} className="h-12 animate-pulse bg-muted" />
              ))}
              <p className="text-xs text-muted-foreground">
                Reading available transfer records…
              </p>
            </div>
          ) : visible.length === 0 && !error ? (
            <div className="research-empty border-b border-border px-6 py-14">
              <h3 className="font-medium">
                No transfers match these criteria.
              </h3>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
                No transfers above this threshold were found in the available
                history. Try a lower threshold or another direction.
              </p>
            </div>
          ) : (
            visible.length > 0 && (
              <div className="overflow-x-auto border-b border-border">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3 font-medium">Date & time</th>
                      <th className="px-5 py-3 font-medium">
                        Direction / asset
                      </th>
                      <th className="px-5 py-3 font-medium">From</th>
                      <th className="px-5 py-3 font-medium">To</th>
                      <th className="px-5 py-3 text-right font-medium">
                        Amount
                      </th>
                      <th className="px-5 py-3 text-right font-medium">
                        Est. USD
                      </th>
                      <th>
                        <span className="sr-only">Explorer</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {visible.map((movement, index) => {
                      const isIncoming = incoming(movement);
                      return (
                        <tr
                          key={`${movement.id}:${movement.tokenAddress || movement.tokenSymbol}:${index}`}
                          className="hover:bg-muted/30"
                        >
                          <td className="px-5 py-4 text-xs text-muted-foreground">
                            {date(movement.timestamp)}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              {isIncoming ? (
                                <ArrowDownLeft className="h-3.5 w-3.5 text-primary" />
                              ) : (
                                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                              <span>
                                {isIncoming ? "Received" : "Sent"}{" "}
                                {movement.tokenSymbol}
                              </span>
                            </div>
                          </td>
                          <td
                            className="px-5 py-4 font-mono text-xs"
                            title={movement.from}
                          >
                            {short(movement.from)}
                          </td>
                          <td
                            className="px-5 py-4 font-mono text-xs"
                            title={movement.to}
                          >
                            {short(movement.to)}
                          </td>
                          <td className="balance-amount px-5 py-4 text-right font-mono text-xs tabular-nums">
                            {Number(movement.value).toLocaleString("en-US", {
                              maximumSignificantDigits: 8,
                            })}
                          </td>
                          <td className="balance-amount px-5 py-4 text-right font-mono tabular-nums">
                            {usd(movement.valueUSD)}
                          </td>
                          <td className="px-4 py-4">
                            <a
                              href={`https://etherscan.io/tx/${movement.hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`View transfer ${short(movement.hash)} on Etherscan`}
                              className="inline-flex p-2 text-muted-foreground hover:text-primary"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}
        </section>
        <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
          A large transfer does not establish exchange activity, ownership, or
          market direction. Values are current-price estimates, not the value at
          the time of transfer.
        </p>
      </div>
    </DashboardLayout>
  );
}
