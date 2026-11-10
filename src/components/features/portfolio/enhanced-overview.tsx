"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { formatEther } from "ethers";
import {
  ArrowDownUp,
  ArrowRight,
  ArrowUpRight,
  Check,
  CircleHelp,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { WalletAPI } from "@/lib/api/wallet";
import { isWhitelisted } from "@/lib/config/tokenWhitelist";
import { useSettings } from "@/hooks/use-settings";
import { TokenDetailModal } from "./token-detail-modal";
import "./portfolio-premium.css";

type Token = {
  symbol: string;
  name: string;
  address: string;
  balance: string;
  valueUSD: number;
  priceUSD: number;
  change24h: number;
  verified: boolean;
  hasNoPriceData: boolean;
};
type Portfolio = {
  tokens: Token[];
  nativeBalance: number | null;
  nativePrice: number | null;
  partial: boolean;
};
const usd = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
const priceUSD = (value: number) =>
  value > 0 && value < 0.000001
    ? `$${value.toExponential(3)}`
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: value < 1 ? 8 : 2,
      }).format(value);
const number = (value: number) =>
  value > 0 && value < 0.000001
    ? value.toPrecision(6)
    : new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(
        value,
      );
const colors = ["#7194eb", "#b1bfd9", "#b3a390", "#79a5aa", "#707986"];
const nativeAddress = "0x0000000000000000000000000000000000000000";

/** Stop waiting on a slow provider when the query is cancelled or times out. */
function bounded<T>(
  promise: Promise<T>,
  signal: AbortSignal,
  milliseconds = 35_000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let finished = false;
    const finish = (callback: () => void) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      callback();
    };
    const abort = () =>
      finish(() => reject(new DOMException("Aborted", "AbortError")));
    const timer = setTimeout(
      () =>
        finish(() =>
          reject(new Error("The data provider took too long to respond.")),
        ),
      milliseconds,
    );
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
    promise.then(
      (value) => finish(() => resolve(value)),
      (error) => finish(() => reject(error)),
    );
  });
}

async function loadPortfolio(
  address: string,
  signal: AbortSignal,
): Promise<Portfolio> {
  const tokensRequest = bounded(
    WalletAPI.getPortfolioTokens(address, true),
    signal,
  );
  const nativeRequest = bounded(
    WalletAPI.fetchETHBalance(address, signal).then((balanceWei) => {
      const value = Number(formatEther(BigInt(balanceWei)));
      if (!Number.isFinite(value) || value < 0)
        throw new Error("Invalid native balance");
      return value;
    }),
    signal,
  );
  const [tokensResult, nativeResult, priceResult] = await Promise.allSettled([
    tokensRequest,
    nativeRequest,
    bounded(WalletAPI.fetchETHPrice(), signal),
  ]);
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  const nativeBalance =
    nativeResult.status === "fulfilled" ? nativeResult.value : null;
  const nativePrice =
    priceResult.status === "fulfilled" &&
    Number.isFinite(priceResult.value) &&
    priceResult.value > 0
      ? priceResult.value
      : null;
  const map = new Map<string, Token>();
  const raw: unknown[] =
    tokensResult.status === "fulfilled" && Array.isArray(tokensResult.value)
      ? tokensResult.value
      : [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const token = item as Record<string, unknown>;
    const contract =
      typeof token.address === "string" ? token.address.toLowerCase() : "";
    if (
      !/^0x[\da-f]{40}$/.test(contract) ||
      contract === nativeAddress ||
      contract === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
    )
      continue;
    const balance = Number(token.balance);
    const price = Number(token.priceUSD);
    if (!Number.isFinite(balance) || balance <= 0) continue;
    const hasPrice =
      Number.isFinite(price) && price > 0 && Number.isFinite(balance * price);
    const normalized: Token = {
      address: contract,
      symbol:
        typeof token.symbol === "string" && token.symbol
          ? token.symbol
          : "TOKEN",
      name:
        typeof token.name === "string" && token.name
          ? token.name
          : "Unknown token",
      balance: balance.toString(),
      priceUSD: hasPrice ? price : 0,
      valueUSD: hasPrice ? balance * price : 0,
      hasNoPriceData: !hasPrice,
      verified: isWhitelisted(contract),
      change24h: 0,
    };
    const previous = map.get(contract);
    if (!previous || previous.hasNoPriceData || !normalized.hasNoPriceData)
      map.set(contract, normalized);
  }
  if (nativeBalance !== null)
    map.set(nativeAddress, {
      address: nativeAddress,
      name: "Ethereum",
      symbol: "ETH",
      balance: nativeBalance.toString(),
      priceUSD: nativePrice ?? 0,
      valueUSD: nativeBalance * (nativePrice ?? 0),
      hasNoPriceData: nativePrice === null,
      verified: true,
      change24h: 0,
    });
  if (nativeBalance === null && map.size === 0)
    throw new Error(
      "Balances could not be retrieved. Check your connection and try again.",
    );
  return {
    tokens: [...map.values()].sort((a, b) => b.valueUSD - a.valueUSD),
    nativeBalance,
    nativePrice,
    partial: nativeBalance === null || nativePrice === null || raw.length === 0,
  };
}

function TokenIcon({ token }: { token: Token; color?: string }) {
  const address = token.address.toLowerCase();
  const isEther =
    address === nativeAddress ||
    address === "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
  const known: Record<string, { label: string; color: string }> = {
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": {
      label: "$",
      color: "#2775ca",
    },
    "0xdac17f958d2ee523a2206206994597c13d831ec7": {
      label: "₮",
      color: "#26a17b",
    },
    "0x6b175474e89094c44da98b954eedeac495271d0f": {
      label: "◈",
      color: "#e6a942",
    },
  };
  const identity = known[address];
  const hue =
    Array.from(address).reduce((sum, char) => sum + char.charCodeAt(0), 0) %
    360;
  return (
    <span
      className="evp-token-icon"
      aria-hidden="true"
      style={{
        background: isEther
          ? "#7d84b21f"
          : (identity?.color ?? `hsl(${hue} 23% 24% / .6)`),
        color: isEther ? "#b6bde8" : identity ? "white" : `hsl(${hue} 48% 76%)`,
      }}
    >
      {isEther ? (
        <svg width="16" height="25" viewBox="0 0 15 23" fill="none">
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
        (identity?.label ?? token.symbol.slice(0, 2).toUpperCase())
      )}
    </span>
  );
}

export function EnhancedOverview({ walletAddress }: { walletAddress: string }) {
  const { settings } = useSettings();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<Token | null>(null);
  const query = useQuery({
    queryKey: ["portfolio", walletAddress.toLowerCase()],
    queryFn: ({ signal }) => loadPortfolio(walletAddress, signal),
    staleTime: 120_000,
    retry: false,
    refetchInterval: settings?.data.autoRefresh
      ? Math.max(
          30,
          settings.data.isCustomRefreshInterval
            ? settings.data.refreshInterval
            : 60,
        ) * 1000
      : false,
  });
  useEffect(() => {
    setSelected(null);
    setSearch("");
    setFilter("all");
  }, [walletAddress]);
  const tokens = useMemo(() => query.data?.tokens ?? [], [query.data?.tokens]);
  const priced = tokens.filter(
    (token) => !token.hasNoPriceData && token.valueUSD > 0,
  );
  const total = priced.reduce((sum, token) => sum + token.valueUSD, 0);
  const recognized = tokens.filter((token) => token.verified).length;
  const unpriced = tokens.filter((token) => token.hasNoPriceData).length;
  const visible = useMemo(
    () =>
      tokens.filter(
        (token) =>
          (filter !== "recognized" || token.verified) &&
          (filter !== "unpriced" || token.hasNoPriceData) &&
          `${token.symbol} ${token.name} ${token.address}`
            .toLowerCase()
            .includes(search.trim().toLowerCase()),
      ),
    [tokens, filter, search],
  );
  const composition = priced.slice(0, 4).map((token, index) => ({
    id: token.address,
    label: token.symbol,
    value: token.valueUSD,
    color: colors[index],
  }));
  const remaining = priced
    .slice(4)
    .reduce((sum, token) => sum + token.valueUSD, 0);
  if (remaining > 0)
    composition.push({
      id: "other-assets",
      label: "Other assets",
      value: remaining,
      color: colors[4],
    });
  const hasTotal =
    priced.length > 0 ||
    (query.data?.nativeBalance === 0 && query.data.nativePrice !== null);
  const coverage = tokens.length
    ? Math.round(((tokens.length - unpriced) / tokens.length) * 100)
    : 0;
  const segments = composition.map((segment) => {
    const result = {
      ...segment,
      percent: total > 0 ? (segment.value / total) * 100 : 0,
    };
    return result;
  });
  const updatedAt = query.dataUpdatedAt
    ? new Date(query.dataUpdatedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <div className="workspace-page evp-portfolio">
      <div className="page-intro evp-header">
        <div>
          <p className="eyebrow">YOUR ON-CHAIN PERSPECTIVE</p>
          <h1 className="page-heading">Portfolio</h1>
          <p className="page-description">The assets you hold. The context that matters.</p>
        </div>
        <div className="evp-header-actions">
          {updatedAt && <span className="evp-updated">Updated {updatedAt}</span>}
          <button className="secondary-button evp-refresh" onClick={() => query.refetch()} disabled={query.isFetching}>
            <RefreshCw size={14} className={query.isFetching ? "animate-spin" : ""} />
            {query.isFetching ? "Updating" : "Refresh balances"}
          </button>
        </div>
      </div>
      {query.isError && (
        <div
          role="alert"
          className="evp-error flex flex-wrap items-center gap-3 border-y border-destructive/25 bg-destructive/5 px-4 py-4"
        >
          <CircleHelp size={18} className="shrink-0 text-destructive" />
          <div className="flex-1">
            <p className="text-sm font-medium">
              {query.data
                ? "The refresh could not be completed"
                : "Wallet data unavailable"}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {query.error.message}
              {query.data
                ? " The last successful snapshot is shown below."
                : ""}
            </p>
          </div>
          <button
            className="inline-flex items-center gap-2 text-xs font-medium text-primary"
            onClick={() => query.refetch()}
          >
            Try again
            <ArrowRight size={14} />
          </button>
        </div>
      )}

      {query.isPending ? (
        <section
          className="evp-loading"
          role="status"
          aria-label="Loading portfolio"
        >
          <div className="flex items-center gap-3">
            <Loader2 size={18} className="animate-spin text-muted-foreground" />
            <div>
              <h2 className="text-sm font-medium">Loading wallet balances</h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Fetching available assets and market prices. Slow providers are
                limited to 35 seconds.
              </p>
            </div>
          </div>
          <div
            className="mt-10 h-14 max-w-sm animate-pulse rounded bg-muted"
            aria-hidden="true"
          />
          <div
            className="mt-10 space-y-4 border-t border-border pt-7"
            aria-hidden="true"
          >
            {[0, 1, 2, 3].map((index) => (
              <div
                className="h-12 animate-pulse rounded bg-muted/60"
                key={index}
              />
            ))}
          </div>
        </section>
      ) : (
        query.data && (
          <>
            <section className="evp-summary" aria-label="Portfolio summary">
              <div className="evp-balance-card">
                <svg className="evp-etched-ether" viewBox="0 0 120 190" fill="none" aria-hidden="true">
                  <path d="M60 8 109 104 60 132 11 104 60 8Z M60 8v124 M11 104l49-28 49 28 M11 116l49 65 49-65-49 28-49-28Z M60 144v37" stroke="currentColor" strokeWidth=".8" />
                  <path d="m60 8 49 96-49-28V8Z M60 132l49-28-49-28v56Z M60 181l49-65-49 28v37Z" fill="currentColor" fillOpacity=".07" />
                </svg>
                <div className="evp-card-topline">
                  <span className="evp-chain-label"><span className="evp-chain-dot" />Ethereum Mainnet</span>
                  <span className="evp-wallet-id">{walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}</span>
                </div>
                <div className="evp-balance-content">
                  <p className="evp-balance-label">Estimated portfolio value</p>
                  <div className="evp-value-line" key={query.dataUpdatedAt}>
                    <p className="evp-total balance-amount usd-value">{hasTotal ? usd(total) : "—"}</p>
                    <span className="evp-currency">USD</span>
                  </div>
                  <p className="evp-value-caption">
                    {priced.length} priced asset{priced.length === 1 ? "" : "s"}
                    {unpriced > 0 ? ` · ${unpriced} awaiting a quote` : ""}
                  </p>
                  <Link href="/transactions" className="evp-primary-link">
                    Explore activity <ArrowUpRight size={16} />
                  </Link>
                </div>
                <dl className="evp-balance-details">
                  <div><dt>Native balance</dt><dd className="balance-amount">{query.data.nativeBalance === null ? "Unavailable" : `${number(query.data.nativeBalance)} ETH`}</dd></div>
                  <div><dt>ETH spot price</dt><dd className="usd-value">{query.data.nativePrice === null ? "Unavailable" : usd(query.data.nativePrice)}</dd></div>
                  <div><dt>Network</dt><dd>Ethereum <span className="evp-network-symbol">↗</span></dd></div>
                </dl>
              </div>
              <div className="evp-composition-card" aria-labelledby="allocation-heading">
                <div className="evp-card-heading"><h2 id="allocation-heading">Asset composition</h2><span>{tokens.length} asset{tokens.length === 1 ? "" : "s"}</span></div>
                <div className="evp-allocation-highlight">
                  <span className="evp-allocation-number">{segments.length ? `${segments[0].percent.toFixed(1)}%` : "—"}</span>
                  <span className="evp-allocation-caption">{segments.length ? `${segments[0].label} · largest position` : "Awaiting asset prices"}</span>
                </div>
                <div className="evp-allocation-bar" role="img" aria-label={segments.length ? `Allocation: ${segments.map(segment => `${segment.label} ${segment.percent.toFixed(1)}%`).join(", ")}` : "No priced assets available for allocation"}>
                  {segments.map(segment => <span key={segment.id} style={{ flexBasis: `${segment.percent}%`, background: segment.color }} />)}
                </div>
                <div className="evp-allocation-legend">
                  {segments.map(segment => (
                    <div className="evp-legend-row" key={segment.id}>
                      <span className="evp-legend-dot" style={{ background: segment.color }} />
                      <span>{segment.label}</span><span className="usd-value">{usd(segment.value)}</span><strong>{segment.percent.toFixed(1)}%</strong>
                    </div>
                  ))}
                  {!segments.length && <p className="evp-composition-empty">Available market quotes will reveal your portfolio’s composition.</p>}
                </div>
                <div className="evp-coverage"><span>Price coverage</span><span>{coverage}% of discovered assets</span></div>
                <div className="evp-coverage-track" aria-hidden="true"><span style={{ width: `${coverage}%` }} /></div>
              </div>
            </section>
            {query.data.partial && (
              <div className="evp-coverage-note" role="note">
                <CircleHelp size={14} />
                <p>Some providers returned limited data. Unpriced assets are excluded from the total; discovered holdings may be incomplete.</p>
              </div>
            )}
            <div className="evp-detail-grid">
            <section
              className="evp-ledger"
              aria-labelledby="holdings-heading"
            >
              <div className="evp-ledger-toolbar flex flex-wrap items-center justify-between gap-4 pb-4">
                <div className="flex items-baseline gap-3">
                  <h2
                    id="holdings-heading"
                    className="text-lg font-medium tracking-tight"
                  >
                    Holdings
                  </h2>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {tokens.length} asset{tokens.length === 1 ? "" : "s"}
                  </span>
                </div>
                <label className="flex h-9 w-full items-center gap-2 rounded-md border border-border bg-transparent px-3 text-muted-foreground sm:w-60">
                  <Search size={14} />
                  <input
                    className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search name or address"
                    aria-label="Search assets"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      aria-label="Clear asset search"
                      className="flex h-5 w-5 items-center justify-center"
                    >
                      <X size={12} />
                    </button>
                  )}
                </label>
              </div>
              <div
                className="evp-filters flex gap-5 border-b border-border"
                role="group"
                aria-label="Filter assets"
              >
                {[
                  { id: "all", label: "All assets" },
                  { id: "recognized", label: "Recognized" },
                  { id: "unpriced", label: "Unpriced" },
                ].map((item) => (
                  <button
                    key={item.id}
                    aria-pressed={filter === item.id}
                    onClick={() => setFilter(item.id)}
                    className={`border-b-2 pb-3 pt-1 text-xs ${filter === item.id ? "border-foreground font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="evp-table-scroll max-h-[720px] overflow-auto">
                <table className="evp-table w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-card">
                    <tr className="border-b border-border text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      <th className="py-4 pr-4 font-medium">Asset</th>
                      <th className="px-4 py-4 text-right font-medium">
                        Price
                      </th>
                      <th className="px-4 py-4 text-right font-medium">
                        Balance
                      </th>
                      <th className="px-4 py-4 text-right font-medium">
                        Value
                      </th>
                      <th className="px-4 py-4 text-right font-medium">
                        Allocation
                      </th>
                      <th className="w-10 pl-3">
                        <span className="sr-only">Details</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {visible.map((token) => (
                      <tr key={token.address} className="hover:bg-muted/20">
                        <td className="py-4 pr-4">
                          <button
                            className="flex max-w-[290px] items-center gap-3 text-left"
                            onClick={() => setSelected(token)}
                          >
                            <TokenIcon
                              token={token}
                              color="var(--muted-foreground)"
                            />
                            <span className="min-w-0">
                              <span className="flex items-center gap-1.5 text-sm font-medium">
                                <span className="max-w-[220px] truncate">
                                  {token.name}
                                </span>
                                {token.verified && (
                                  <Check
                                    size={11}
                                    className="shrink-0 text-muted-foreground"
                                    aria-label={
                                      token.address === nativeAddress
                                        ? "Native asset"
                                        : "Recognized contract"
                                    }
                                  />
                                )}
                              </span>
                              <span className="mt-1 block text-[11px] text-muted-foreground">
                                {token.symbol}
                              </span>
                            </span>
                          </button>
                        </td>
                        <td className="usd-value whitespace-nowrap px-4 py-4 text-right text-xs tabular-nums">
                          {token.hasNoPriceData ? (
                            <span className="text-muted-foreground">
                              Unavailable
                            </span>
                          ) : (
                            priceUSD(token.priceUSD)
                          )}
                        </td>
                        <td className="balance-amount whitespace-nowrap px-4 py-4 text-right text-xs tabular-nums">
                          {number(Number(token.balance))}
                        </td>
                        <td className="usd-value whitespace-nowrap px-4 py-4 text-right text-sm font-medium tabular-nums">
                          {token.hasNoPriceData ? "—" : usd(token.valueUSD)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right text-xs tabular-nums text-muted-foreground">
                          {token.hasNoPriceData
                            ? "—"
                            : `${total > 0 ? ((token.valueUSD / total) * 100).toFixed(1) : "0.0"}%`}
                        </td>
                        <td className="pl-3">
                          <button
                            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                            onClick={() => setSelected(token)}
                            aria-label={`View ${token.name} details`}
                          >
                            <ArrowUpRight size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!visible.length && (
                  <div className="flex flex-col items-center px-6 py-16 text-center">
                    <Search size={22} className="text-muted-foreground" />
                    <h3 className="mt-4 text-sm font-medium">
                      {search || filter !== "all"
                        ? "No assets match your filters"
                        : "No assets discovered"}
                    </h3>
                    <p className="mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">
                      {search || filter !== "all"
                        ? "Try a different name, symbol, or contract address."
                        : "A provider can return an incomplete list. Verify the address on Etherscan before treating it as an empty wallet."}
                    </p>
                    {(search || filter !== "all") && (
                      <button
                        className="mt-5 text-xs font-medium text-primary"
                        onClick={() => {
                          setSearch("");
                          setFilter("all");
                        }}
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="evp-ledger-footer flex flex-wrap items-center justify-between gap-3 border-t border-border py-4 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <ShieldCheck size={13} />
                  {recognized} of {tokens.length} recognized ·
                  Recognition does not guarantee safety.
                </span>
                <Link
                  href="/scam"
                  className="inline-flex items-center gap-1.5 text-foreground hover:text-primary"
                >
                  Open risk review
                  <ArrowRight size={12} />
                </Link>
              </div>
            </section>
              <aside className="evp-context" aria-label="Portfolio research">
                <Link href="/transactions" className="evp-context-card evp-activity-card">
                  <div className="evp-context-top"><span className="evp-context-icon"><ArrowDownUp size={20} /></span><ArrowUpRight size={17} /></div>
                  <span className="evp-context-kicker">FOLLOW THE MOVEMENT</span>
                  <h2>Every transfer.<br />A clearer picture.</h2>
                  <p>Trace incoming and outgoing assets in this wallet’s history.</p>
                  <span className="evp-context-cta">View transactions <ArrowRight size={14} /></span>
                </Link>
                <div className="evp-context-card evp-risk-card">
                  <div className="evp-context-top"><span className="evp-context-icon"><ShieldCheck size={20} /></span><span className="evp-context-kicker">TOKEN CONTEXT</span></div>
                  <div className="evp-recognized-count">{recognized}<span> / {tokens.length}</span></div>
                  <h2>Recognized assets</h2>
                  <p>Recognition is a starting point. Review the available contract signals before drawing conclusions.</p>
                  <Link href="/scam" className="evp-context-cta">Review token risk <ArrowRight size={14} /></Link>
                </div>
              </aside>
            </div>
            <div className="evp-provenance">
              <span>
                Updated {updatedAt || "—"} · Ethereum Mainnet · Estimates in USD
              </span>
              <a
                href={`https://etherscan.io/address/${walletAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5"
              >
                View source records
                <ExternalLink size={11} />
              </a>
            </div>
          </>
        )
      )}
      <TokenDetailModal
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        token={selected}
      />
    </div>
  );
}
