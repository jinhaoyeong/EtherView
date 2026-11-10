"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ResearchHeader } from "@/components/shared/research-header";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWallet } from "@/contexts/wallet-context";
import { WalletAPI } from "@/lib/api/wallet";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import { useSettings } from "@/hooks/use-settings";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRightLeft,
  ArrowRight,
  Search,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  ListFilter,
  FileText,
} from "lucide-react";

type Transaction = {
  id?: string;
  hash: string;
  timestamp: number;
  from: string;
  to: string;
  value: string;
  valueUSD: number;
  gasUsed: string;
  gasPrice: string;
  status: "success" | "pending" | "failed";
  type: "received" | "sent" | "token_received" | "token_sent" | "trade";
  tokenSymbol?: string;
  tokenAddress?: string;
  isSuspicious?: boolean;
};
const keyFor = (tx: Transaction) =>
  tx.id ||
  `${tx.hash}:${tx.tokenAddress || "eth"}:${tx.from}:${tx.to}:${tx.value}`;
const short = (address: string) =>
  address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Contract creation";
const amount = (value: string) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return number.toLocaleString("en-US", { maximumSignificantDigits: 7 });
};
const fee = (tx: Transaction) => {
  const value = (Number(tx.gasUsed) * Number(tx.gasPrice)) / 1e18;
  return Number.isFinite(value)
    ? `${value.toLocaleString("en-US", { maximumFractionDigits: 9 })} ETH`
    : "Unavailable";
};

export default function Transactions() {
  const { walletAddress, handleDisconnect } = useWallet();
  const { settings } = useSettings();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const request = useRef(0);
  const pageSize = settings?.display.isCustomItemsPerPage
    ? Math.max(1, settings.display.itemsPerPage)
    : 15;

  const load = useCallback(
    async (address: string, nextPage = 1, append = false) => {
      const requestId = ++request.current;
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const result: Transaction[] = await WalletAPI.fetchTransactions(
          address,
          nextPage,
          pageSize,
        );
        if (requestId !== request.current) return;
        setTransactions((previous) => {
          const unique = new Map<string, Transaction>();
          (append ? [...previous, ...result] : result).forEach((tx) =>
            unique.set(keyFor(tx), tx),
          );
          return [...unique.values()].sort((a, b) => b.timestamp - a.timestamp);
        });
        setPage(nextPage);
        // ETH and token transfers may each contribute one page of records.
        setHasMore(result.length >= pageSize);
      } catch (err) {
        if (requestId === request.current)
          setError(
            err instanceof Error
              ? err.message
              : "Activity could not be loaded. Please try again.",
          );
      } finally {
        if (requestId === request.current) {
          setLoading(false);
          setLoadingMore(false);
          setRefreshing(false);
        }
      }
    },
    [pageSize],
  );

  useEffect(() => {
    setTransactions([]);
    setPage(1);
    setHasMore(false);
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
    if (!walletAddress || loading || refreshing || loadingMore) return;
    setRefreshing(true);
    WalletAPI.clearTransactionCache(walletAddress);
    WalletAPI.clearPriceCache();
    await load(walletAddress);
  };
  useAutoRefresh(refresh, !!walletAddress, 300);

  const filtered = useMemo(
    () =>
      transactions.filter((tx) => {
        const query = search.trim().toLowerCase();
        const directionMatches =
          filter === "all" ||
          (filter === "received"
            ? tx.type.includes("received")
            : filter === "sent"
              ? tx.type.includes("sent")
              : tx.status === "failed");
        return (
          directionMatches &&
          (!query ||
            [
              tx.hash,
              tx.from,
              tx.to,
              tx.tokenSymbol || "",
              tx.tokenAddress || "",
            ].some((value) => value.toLowerCase().includes(query)))
        );
      }),
    [transactions, filter, search],
  );
  const received = transactions.filter(
    (tx) => tx.status !== "failed" && tx.type.includes("received"),
  ).length;
  const sent = transactions.filter(
    (tx) => tx.status !== "failed" && tx.type.includes("sent"),
  ).length;

  return (
    <DashboardLayout
      walletAddress={walletAddress || ""}
      onDisconnect={handleDisconnect}
    >
      <div className="workspace-page research-page space-y-7">
        <ResearchHeader
          index="02"
          category="The ledger"
          title="Transaction history"
          description="Every transfer, in context. Follow ETH and token movements through this wallet."
          tone="lime"
        >
          <Button
            variant="outline"
            onClick={refresh}
            disabled={!walletAddress || loading || loadingMore || refreshing}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh activity
          </Button>
        </ResearchHeader>

        {transactions.length > 0 && (
          <dl className="research-statbar">
            {[
              { label: "Transfers loaded", value: transactions.length },
              { label: "Incoming", value: received },
              { label: "Outgoing", value: sent },
              {
                label: "Failed transactions",
                value: transactions.filter((tx) => tx.status === "failed")
                  .length,
              },
            ].map((item) => (
              <div key={item.label} className="surface-panel px-5 py-3.5">
                <dt className="text-xs text-muted-foreground">{item.label}</dt>
                <dd className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">
                  {item.value.toLocaleString()}
                </dd>
              </div>
            ))}
          </dl>
        )}

        <section className="surface-panel research-ledger transactions-ledger overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-border p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-semibold">Transfer activity</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                ETH & ERC-20 transfers · newest first
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  aria-label="Search transactions"
                  className="pl-9 sm:w-72"
                  placeholder="Search asset, address or hash"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger
                  className="w-full sm:w-44"
                  aria-label="Transaction direction"
                >
                  <ListFilter className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All transfers</SelectItem>
                  <SelectItem value="received">Incoming</SelectItem>
                  <SelectItem value="sent">Outgoing</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="m-5 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div>
                <p>{error}</p>
                <Button
                  variant="link"
                  className="h-auto px-0 py-2"
                  onClick={refresh}
                >
                  Try again
                </Button>
              </div>
            </div>
          )}

          {!walletAddress ? (
            <div className="research-empty px-6 py-16 text-center">
              <FileText className="mx-auto mb-4 h-6 w-6 text-muted-foreground" />
              <h3 className="font-semibold">Start with a wallet address</h3>
              <p className="mb-5 mt-2 text-sm text-muted-foreground">
                Explore a public wallet to see its transaction history.
              </p>
              <Button asChild>
                <Link href="/">
                  Explore a wallet
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          ) : loading && !transactions.length ? (
            <div
              role="status"
              aria-label="Loading transactions"
              className="space-y-3 p-5"
            >
              {Array.from({ length: 6 }, (_, index) => (
                <div
                  key={index}
                  className="h-16 animate-pulse rounded-lg bg-muted"
                />
              ))}
            </div>
          ) : filtered.length === 0 && !error ? (
            <div className="research-empty px-6 py-16 text-center">
              <Search className="mx-auto mb-4 h-8 w-8 text-muted-foreground" />
              <h3 className="font-semibold">
                {search || filter !== "all"
                  ? "No matching transfers"
                  : "No transfers found"}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {search || filter !== "all"
                  ? "Try another asset, address or direction."
                  : "There is no activity available for this wallet from the current data source."}
              </p>
              {(search || filter !== "all") && (
                <Button
                  variant="link"
                  onClick={() => {
                    setSearch("");
                    setFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            filtered.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3 font-medium">Transfer</th>
                      <th className="px-5 py-3 font-medium">Counterparty</th>
                      <th className="px-5 py-3 text-right font-medium">
                        Amount
                      </th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3">
                        <span className="sr-only">Explorer</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((tx) => {
                      const incoming = tx.type.includes("received");
                      const Icon =
                        tx.type === "trade"
                          ? ArrowRightLeft
                          : incoming
                            ? ArrowDownLeft
                            : ArrowUpRight;
                      return (
                        <tr
                          key={keyFor(tx)}
                          className="transition-colors hover:bg-muted/30"
                        >
                          <td className="transfer-cell px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <span className="transfer-emblem shrink-0" data-direction={incoming ? "in" : "out"}>
                                <Icon className="h-4 w-4" />
                              </span>
                              <div>
                                <p className="font-medium">
                                  {tx.status === "failed"
                                    ? "Failed transfer"
                                    : tx.type === "trade"
                                      ? "Trade"
                                      : incoming
                                        ? "Received"
                                        : "Sent"}{" "}
                                  {tx.tokenSymbol || "ETH"}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {new Date(tx.timestamp * 1000).toLocaleString(
                                    undefined,
                                    {
                                      month: "short",
                                      day: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    },
                                  )}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="counterparty-cell px-5 py-3.5">
                            <p
                              className="font-mono text-xs"
                              title={incoming ? tx.from : tx.to}
                            >
                              {short(incoming ? tx.from : tx.to)}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {incoming ? "From" : "To"} address
                            </p>
                          </td>
                          <td className="amount-cell px-5 py-3.5 text-right">
                            <p
                              className={`balance-amount font-medium tabular-nums ${incoming ? "text-primary" : ""}`}
                            >
                              {tx.status === "failed"
                                ? ""
                                : incoming
                                  ? "+"
                                  : tx.type === "trade"
                                    ? ""
                                    : "−"}
                              {amount(tx.value)} {tx.tokenSymbol || "ETH"}
                            </p>
                            <p className="usd-value mt-1 text-xs text-muted-foreground">
                              {tx.valueUSD > 0
                                ? `≈ $${tx.valueUSD.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
                                : Number(tx.value) === 0
                                  ? "$0.00"
                                  : "USD value unavailable"}
                            </p>
                            {settings?.display.showTransactionFees && (
                              <p className="transaction-fees mt-1 text-[11px] text-muted-foreground">
                                Network fee: {fee(tx)}
                              </p>
                            )}
                          </td>
                          <td className="status-cell px-5 py-3.5">
                            <Badge
                              variant={
                                tx.status === "failed"
                                  ? "destructive"
                                  : "outline"
                              }
                              className="capitalize text-[10px]"
                            >
                              {tx.status}
                            </Badge>
                            {tx.isSuspicious && (
                              <p className="mt-1 text-xs text-amber-500">
                                Flagged
                              </p>
                            )}
                          </td>
                          <td className="explorer-cell px-5 py-3.5">
                            <a
                              href={`https://etherscan.io/tx/${tx.hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`View transaction ${short(tx.hash)} on Etherscan`}
                              className="inline-flex rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                              <ExternalLink className="h-4 w-4" />
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

          {transactions.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3.5">
              <p className="text-xs text-muted-foreground">
                {filtered.length} of {transactions.length} loaded transfers ·
                page {page}
              </p>
              {hasMore && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={loading || loadingMore || refreshing}
                  onClick={() =>
                    walletAddress && void load(walletAddress, page + 1, true)
                  }
                >
                  <RefreshCw
                    className={`mr-2 h-3.5 w-3.5 ${loadingMore ? "animate-spin" : ""}`}
                  />
                  {loadingMore ? "Loading…" : "Load more"}
                </Button>
              )}
            </div>
          )}
        </section>

        <p className="text-xs text-muted-foreground">
          USD amounts are estimates using available current prices. Explorer
          records provide the original on-chain details.
        </p>
      </div>
    </DashboardLayout>
  );
}
