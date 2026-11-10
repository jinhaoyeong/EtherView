"use client";

import {
  useEffect,
  useState,
  useMemo,
  memo,
  useTransition,
  useRef,
  useCallback,
} from "react";
import Link from "next/link";
import { ResearchHeader } from "@/components/shared/research-header";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  ShieldCheck,
  RefreshCw,
  Search,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  LayoutList,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useWallet } from "@/contexts/wallet-context";
import { WalletAPI } from "@/lib/api/wallet";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/use-translation";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FlaggedToken {
  tokenAddress: string;
  symbol: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  score: number;
  reasons?: string[];
  confidencePct?: number;
  evidence?: ScamEvidence;
}

type ScamEvidence = {
  staticCode?: {
    suspiciousFunctions?: string[];
    verified?: boolean;
    hasWeirdChars?: boolean;
    hasLongName?: boolean;
  };
  features?: Record<string, unknown>;
  external?: Record<string, unknown>;
  simulation?: Record<string, unknown>;
  rules?: Record<string, unknown>;
  ml?: { contributions?: Array<{ feature?: string }> } & Record<
    string,
    unknown
  >;
  holderDistribution?: { top1?: number; top5?: number; totalHolders?: number };
  [key: string]: unknown;
};

export default function ScamTokenAlertPage() {
  const { walletAddress, handleDisconnect } = useWallet();
  const { t } = useTranslation();
  const request = useRef(0);
  const [groupedTokens, setGroupedTokens] = useState<{
    all: FlaggedToken[];
    high: FlaggedToken[];
    medium: FlaggedToken[];
    low: FlaggedToken[];
  }>({
    all: [],
    high: [],
    medium: [],
    low: [],
  });
  const [isPending, startTransition] = useTransition();
  const [stats, setStats] = useState({
    highRiskCount: 0,
    mediumRiskCount: 0,
    lowRiskCount: 0,
    totalTokens: 0,
    knownCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [riskFilter, setRiskFilter] = useState<
    "all" | "high" | "medium" | "low"
  >("all");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;
  const [visibleCount, setVisibleCount] = useState(itemsPerPage);

  const loadScamData = useCallback(
    async (address: string, forceRefresh: boolean = false) => {
      const requestId = ++request.current;
      try {
        const t0 =
          typeof performance !== "undefined" ? performance.now() : Date.now();
        setLoading(true);
        setError(null);
        try {
          // Clear cache if forcing refresh
          if (forceRefresh) {
            await WalletAPI.getPortfolioTokens(address, true);
          } else {
            await WalletAPI.getPortfolioTokens(address);
          }
        } catch {}
        const cachedTokens = WalletAPI.getCachedPortfolioTokens(address);
        const result = (await WalletAPI.analyzeWallet(
          address,
          "24h",
          AbortSignal.timeout(45_000),
          cachedTokens,
          "risk",
        )) as {
          success: boolean;
          error?: string;
          data?: {
            scam?: {
              flaggedTokens?: FlaggedToken[];
              highRiskCount?: number;
              mediumRiskCount?: number;
              lowRiskCount?: number;
              totalTokens?: number;
              knownCount?: number;
            };
          };
        };
        if (!result?.success) {
          throw new Error(
            result?.error ||
              "Token risk data could not be loaded. Please try again.",
          );
        }

        const scam = result.data?.scam || {};
        const tokens: FlaggedToken[] = Array.isArray(scam.flaggedTokens)
          ? (scam.flaggedTokens as FlaggedToken[])
          : [];

        // Robust dedup: prefer tokenAddress, fallback to symbol
        const seen = new Set();
        const uniqueTokens = tokens.filter((token) => {
          if (
            !token ||
            !/^0x[0-9a-fA-F]{40}$/.test(token.tokenAddress || "") ||
            !Number.isFinite(token.score)
          )
            return false;
          const key =
            (token.tokenAddress || "").toLowerCase() ||
            (token.symbol || "").toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        // Sort once by score (high to low) and pre-group by risk level
        const sortedTokens = [...uniqueTokens].sort(
          (a, b) => b.score - a.score,
        );
        const highTokens = sortedTokens.filter(
          (t) => t.riskLevel === "high" || t.riskLevel === "critical",
        );
        const mediumTokens = sortedTokens.filter(
          (t) => t.riskLevel === "medium",
        );
        const lowTokens = sortedTokens.filter((t) => t.riskLevel === "low");

        if (requestId !== request.current) return;
        setCurrentPage(1);
        setGroupedTokens({
          all: sortedTokens,
          high: highTokens,
          medium: mediumTokens,
          low: lowTokens,
        });
        setStats({
          highRiskCount: scam.highRiskCount ?? highTokens.length,
          mediumRiskCount: scam.mediumRiskCount ?? mediumTokens.length,
          lowRiskCount: scam.lowRiskCount ?? lowTokens.length,
          totalTokens: scam.totalTokens ?? sortedTokens.length,
          knownCount: scam.knownCount ?? 0,
        });
        const t1 =
          typeof performance !== "undefined" ? performance.now() : Date.now();
        const duration = Math.round(t1 - t0);
        try {
          void fetch("/api/metrics", {
            method: "POST",
            signal: AbortSignal.timeout(3_000),
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: "tab_scam_loaded",
              value: duration,
            }),
          }).catch(() => {});
        } catch {}
      } catch (err) {
        if (requestId !== request.current) return;
        setError(
          err instanceof Error
            ? err.message
            : "Token risk data could not be loaded. Please try again.",
        );
        try {
          void fetch("/api/metrics", {
            method: "POST",
            signal: AbortSignal.timeout(3_000),
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: "tab_scam_failed",
            }),
          }).catch(() => {});
        } catch {}
      } finally {
        if (requestId === request.current) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    setSearchTerm("");
    setRiskFilter("all");
    setSortOrder("desc");
    setCurrentPage(1);
    setVisibleCount(itemsPerPage);
    setRefreshing(false);
    setGroupedTokens({ all: [], high: [], medium: [], low: [] });
    setStats({
      highRiskCount: 0,
      mediumRiskCount: 0,
      lowRiskCount: 0,
      totalTokens: 0,
      knownCount: 0,
    });
    if (walletAddress) void loadScamData(walletAddress);
    else {
      setLoading(false);
      setError(null);
    }
    const lifecycle = request;
    return () => {
      lifecycle.current++;
    };
  }, [walletAddress, loadScamData]);

  const handleRefresh = async () => {
    if (!walletAddress || loading || refreshing) return;
    setRefreshing(true);
    await loadScamData(walletAddress, true);
    setRefreshing(false);
  };

  useAutoRefresh(handleRefresh, !!walletAddress, 300);

  const handleFilterChange = (filter: "all" | "high" | "medium" | "low") => {
    startTransition(() => {
      setRiskFilter(filter);
      setCurrentPage(1);
    });
  };

  const handleSortChange = () => {
    startTransition(() => {
      setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
      setCurrentPage(1);
    });
  };

  const handleSearchChange = (term: string) => {
    setSearchTerm(term);
    setCurrentPage(1);
  };

  const filteredTokens = useMemo(() => {
    const lowerSearch = searchTerm.toLowerCase();

    const baseList =
      riskFilter === "high"
        ? groupedTokens.high
        : riskFilter === "medium"
          ? groupedTokens.medium
          : riskFilter === "low"
            ? groupedTokens.low
            : groupedTokens.all;

    // No search term: just return pre-sorted list (or reversed if asc)
    if (!lowerSearch) {
      if (sortOrder === "asc") {
        return [...baseList].reverse();
      }
      return baseList;
    }

    const searched = baseList.filter((token) => {
      const symbol = token.symbol ? token.symbol.toLowerCase() : "";
      return (
        symbol.includes(lowerSearch) ||
        token.tokenAddress?.toLowerCase().includes(lowerSearch) ||
        (token.reasons?.some(
          (r) => r && r.toLowerCase().includes(lowerSearch),
        ) ??
          false)
      );
    });

    if (sortOrder === "asc") {
      return searched.slice().reverse();
    }
    return searched;
  }, [groupedTokens, riskFilter, searchTerm, sortOrder]);

  const totalPages = Math.ceil(filteredTokens.length / itemsPerPage);
  const paginatedTokens = filteredTokens.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  useEffect(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const maxVisible = Math.min(
      itemsPerPage,
      Math.max(filteredTokens.length - startIndex, 0),
    );
    if (maxVisible <= 0) {
      setVisibleCount(0);
      return;
    }
    let cancelled = false;
    const initial = Math.min(5, maxVisible);
    setVisibleCount(initial);
    if (maxVisible <= initial) {
      return;
    }
    const batchSize = 5;
    const loadBatch = () => {
      if (cancelled) return;
      setVisibleCount((prev) => {
        const next = Math.min(prev + batchSize, maxVisible);
        if (next < maxVisible) {
          requestAnimationFrame(loadBatch);
        }
        return next;
      });
    };
    requestAnimationFrame(loadBatch);
    return () => {
      cancelled = true;
    };
  }, [filteredTokens, currentPage, itemsPerPage]);

  return (
    <DashboardLayout
      walletAddress={walletAddress || ""}
      onDisconnect={handleDisconnect}
    >
      <div className="workspace-page research-page space-y-7">
        <ResearchHeader
          index="04"
          category="Know what you hold"
          title="Token risk review"
          description="Look closer at the contracts behind your assets, with available evidence and risk signals."
          tone="peach"
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                onClick={handleRefresh}
                disabled={!walletAddress || refreshing || loading}
                className="w-full md:w-auto"
              >
                <RefreshCw
                  className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")}
                />

                {t("common.refresh")}
              </Button>
            </TooltipTrigger>

            <TooltipContent>
              <p>{t("scam.refresh_tooltip")}</p>
            </TooltipContent>
          </Tooltip>
        </ResearchHeader>

        {stats.totalTokens > 0 && !error && (
          <div className="space-y-3">
            <dl className="research-statbar research-statbar-five">
              {[
                { label: "Assets assessed", value: stats.totalTokens },
                {
                  label: "Known addresses",
                  value: stats.knownCount,
                },
                { label: "High risk", value: stats.highRiskCount },
                { label: "Medium risk", value: stats.mediumRiskCount },
                { label: "Low risk", value: stats.lowRiskCount },
              ].map((item) => (
                <div key={item.label} className="surface-panel px-5 py-4">
                  <dt className="text-xs text-muted-foreground">
                    {item.label}
                  </dt>
                  <dd className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Limited heuristic screening. Holder concentration, liquidity, tax,
              and sellability data are unavailable. Scores are not a contract
              audit or a safety guarantee. Known addresses are counted
              separately from the heuristic findings below.
            </p>
          </div>
        )}

        {/* Main Content */}

        <div
          className={cn(
            "space-y-6 transition-opacity duration-150",
            isPending ? "opacity-60" : "opacity-100",
          )}
        >
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Contract findings</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Heuristic score, known-address matches, and available findings.
              </p>
            </div>
            <span className="text-xs text-muted-foreground">
              {filteredTokens.length} results
            </span>
          </div>

          <div className="surface-panel flex flex-col gap-4 p-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative w-full xl:w-72 xl:shrink-0">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />

              <Input
                aria-label="Search token risk findings"
                placeholder="Search token, address or finding"
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-8"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto items-start sm:items-center">
              <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 items-center">
                <div className="flex bg-muted rounded-lg p-1 mr-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={viewMode === "list" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setViewMode("list")}
                        aria-label="List view"
                        aria-pressed={viewMode === "list"}
                        className="h-8 w-8 p-0"
                      >
                        <LayoutList className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>

                    <TooltipContent>
                      <p>{t("scam.listView")}</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={viewMode === "grid" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setViewMode("grid")}
                        aria-label="Grid view"
                        aria-pressed={viewMode === "grid"}
                        className="h-8 w-8 p-0"
                      >
                        <LayoutGrid className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>

                    <TooltipContent>
                      <p>{t("scam.gridView")}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSortChange}
                  className="whitespace-nowrap"
                >
                  <ArrowUpDown className="h-4 w-4 mr-2" />

                  {t("scam.sort")}

                  {sortOrder === "desc"
                    ? t("scam.high_risk")
                    : t("scam.low_risk")}
                </Button>

                <div className="h-6 w-px bg-border mx-1 hidden sm:block"></div>

                <FilterButton
                  active={riskFilter === "all"}
                  onClick={() => handleFilterChange("all")}
                  label={t("scam.all_risks")}
                />

                <FilterButton
                  active={riskFilter === "high"}
                  onClick={() => handleFilterChange("high")}
                  label={t("scam.high_risk")}
                  variant="destructive"
                />

                <FilterButton
                  active={riskFilter === "medium"}
                  onClick={() => handleFilterChange("medium")}
                  label={t("scam.medium_risk")}
                  variant="warning"
                />

                <FilterButton
                  active={riskFilter === "low"}
                  onClick={() => handleFilterChange("low")}
                  label={t("scam.low_risk")}
                  variant="success"
                />
              </div>
            </div>
          </div>

          {/* Token List/Grid */}

          <div>
            {!walletAddress ? (
              <div className="border-y border-border px-6 py-14">
                <p className="eyebrow">No address selected</p>
                <h3 className="mt-3 text-lg font-medium">
                  Select a wallet to review its assets.
                </h3>
                <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
                  Available checks use contract identity and reported trading
                  data. The assessment does not guarantee that a token is safe
                  to buy or sell.
                </p>
                <Button asChild variant="outline" className="mt-5">
                  <Link href="/">Select an address</Link>
                </Button>
              </div>
            ) : error ? (
              <Card className="border-border bg-muted/20">
                <CardContent className="flex flex-col items-center justify-center p-6 text-center">
                  <AlertTriangle className="h-5 w-5 text-muted-foreground mb-3" />

                  <p className="text-foreground font-medium">{error}</p>

                  <Button
                    variant="outline"
                    onClick={() => walletAddress && loadScamData(walletAddress)}
                    disabled={!walletAddress}
                    className="mt-4"
                  >
                    {t("common.tryAgain")}
                  </Button>
                </CardContent>
              </Card>
            ) : loading ? (
              <div
                role="status"
                aria-label="Loading token risk review"
                className="space-y-4"
              >
                <p className="text-sm text-muted-foreground">
                  Loading token risk review…
                </p>
                {/* Loading Skeleton */}

                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="h-16 w-full bg-muted/50 animate-pulse rounded-md"
                  />
                ))}
              </div>
            ) : filteredTokens.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                  <div className="mb-4 text-muted-foreground">
                    <ShieldCheck className="h-6 w-6 text-muted-foreground" />
                  </div>

                  <h3 className="text-lg font-semibold">
                    {searchTerm || riskFilter !== "all"
                      ? "No matching tokens"
                      : "No token findings available"}
                  </h3>

                  <p className="text-muted-foreground max-w-sm mt-1">
                    {searchTerm || riskFilter !== "all"
                      ? t("scam.noDataDesc")
                      : stats.totalTokens === 0
                        ? t("scam.scanUnavailable")
                        : "No tokens were flagged by the available checks. Review data coverage before drawing conclusions."}
                  </p>

                  {(searchTerm || riskFilter !== "all") && (
                    <Button
                      variant="link"
                      onClick={() => {
                        setSearchTerm("");
                        handleFilterChange("all");
                      }}
                      className="mt-2"
                    >
                      {t("common.clear_all")}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <div className="surface-panel overflow-hidden">
                  {viewMode === "list" ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[200px]">
                            {t("scam.token")}
                          </TableHead>

                          <TableHead>{t("scam.riskLevel")}</TableHead>

                          <TableHead>{t("scam.score")}</TableHead>

                          <TableHead>Coverage</TableHead>

                          <TableHead>{t("scam.status")}</TableHead>

                          <TableHead className="text-right">
                            {t("scam.action")}
                          </TableHead>
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {paginatedTokens
                          .slice(0, visibleCount)
                          .map((token, index) => (
                            <TokenRiskRow
                              key={`${walletAddress}:${token.tokenAddress || index}`}
                              token={token}
                            />
                          ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="p-4 grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {paginatedTokens
                        .slice(0, visibleCount)
                        .map((token, index) => (
                          <TokenRiskCard
                            key={`${walletAddress}:${token.tokenAddress || index}`}
                            token={token}
                          />
                        ))}
                    </div>
                  )}
                </div>

                {/* Pagination */}

                {totalPages > 1 && (
                  <div className="flex flex-col items-center justify-center gap-3 py-4">
                    <p className="text-sm md:text-base text-muted-foreground text-center">
                      Showing {(currentPage - 1) * itemsPerPage + 1}–
                      {Math.min(
                        currentPage * itemsPerPage,
                        filteredTokens.length,
                      )}{" "}
                      of {filteredTokens.length} tokens
                    </p>

                    <div className="flex items-center space-x-4">
                      <Button
                        variant="outline"
                        size="lg"
                        className="h-9 w-9 rounded-lg"
                        aria-label="Previous risk results page"
                        onClick={() =>
                          setCurrentPage((p) => Math.max(1, p - 1))
                        }
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </Button>

                      <div className="text-base md:text-lg font-semibold min-w-[80px] text-center">
                        {currentPage} / {totalPages}
                      </div>

                      <Button
                        variant="outline"
                        size="lg"
                        className="h-9 w-9 rounded-lg"
                        aria-label="Next risk results page"
                        onClick={() =>
                          setCurrentPage((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={currentPage === totalPages}
                      >
                        <ChevronRight className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

const TokenRiskRow = memo(function TokenRiskRow({
  token,
}: {
  token: FlaggedToken;
}) {
  const [expanded, setExpanded] = useState(false);

  const getRiskColor = (level: string) => {
    switch (level) {
      case "critical":
      case "high":
        return "text-rose-400 bg-rose-400/10 border-rose-400/25";
      case "medium":
        return "text-amber-400 bg-amber-400/10 border-amber-400/25";
      default:
        return "text-emerald-400 bg-emerald-400/10 border-emerald-400/25";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return "bg-red-500";
    if (score >= 40) return "bg-yellow-500";
    return "bg-green-500";
  };

  return (
    <>
      <TableRow
        className={cn(
          "cursor-pointer transition-colors",
          expanded && "bg-muted/50",
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <TableCell>
          <div className="flex flex-col">
            <span className="font-bold">{token.symbol}</span>

            <span
              className="text-xs text-muted-foreground font-mono"
              title={token.tokenAddress}
            >
              {token.tokenAddress.slice(0, 6)}...{token.tokenAddress.slice(-4)}
            </span>
          </div>
        </TableCell>

        <TableCell>
          <Badge
            className={cn("capitalize", getRiskColor(token.riskLevel))}
            variant="outline"
          >
            {token.riskLevel}
          </Badge>
        </TableCell>

        <TableCell>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium w-8">
              {Math.round(Math.max(0, Math.min(100, token.score)))}
            </span>

            <div className="h-2 w-24 bg-secondary rounded-full overflow-hidden hidden sm:block">
              <div
                className={cn("h-full", getScoreColor(token.score))}
                style={{ width: `${Math.max(0, Math.min(100, token.score))}%` }}
              />
            </div>
          </div>
        </TableCell>

        <TableCell>
          <Badge variant="secondary" className="text-[11px] font-normal">
            Heuristic
          </Badge>
        </TableCell>

        <TableCell>
          <div className="flex gap-1 flex-wrap">
            {(token.evidence?.staticCode?.verified ??
            token.evidence?.features?.contractVerified) ? (
              <Badge
                variant="outline"
                className="text-[10px] px-1 h-5 text-emerald-400 border-emerald-400/25"
              >
                Known address
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-[10px] px-1 h-5 text-muted-foreground border-muted"
              >
                Not recognized
              </Badge>
            )}

            {(token.evidence?.external?.coingeckoListed ||
              Number(token.evidence?.features?.externalListings || 0) > 0) && (
              <Badge
                variant="outline"
                className="text-[10px] px-1 h-5 text-primary border-primary/25"
              >
                Price quote
              </Badge>
            )}
          </div>
        </TableCell>

        <TableCell className="text-right">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            aria-label={`Review ${token.symbol} evidence`}
            aria-expanded={expanded}
            onClick={(event) => {
              event.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </TableCell>
      </TableRow>
      <TableRow className="bg-muted/30 hover:bg-muted/30">
        <TableCell colSpan={6} className="p-0">
          <div
            className={cn(
              "transition-all duration-300 overflow-hidden",
              expanded ? "max-h-none opacity-100" : "max-h-0 opacity-0",
            )}
          >
            <div className="p-4 border-t space-y-3">
              <div className="text-xs text-muted-foreground font-mono break-all">
                {token.tokenAddress}
              </div>

              {expanded && <TokenEvidenceDetail token={token} />}
            </div>
          </div>
        </TableCell>
      </TableRow>
    </>
  );
});

const TokenEvidenceDetail = memo(function TokenEvidenceDetail({
  token,
}: {
  token: FlaggedToken;
}) {
  const { t } = useTranslation();
  const ev = (token.evidence || {}) as ScamEvidence;
  const simulation = (ev.simulation || {}) as Record<string, unknown>;

  return (
    <div className="space-y-4">
      <p className="rounded-lg border border-border bg-background p-3 text-xs leading-relaxed text-muted-foreground">
        This is heuristic screening, not a contract audit. Unobserved trading
        and holder metrics are unavailable, not measured zeroes.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground block">
            {t("scam.simulation")}
          </span>

          <div className="flex flex-wrap gap-1">
            <Badge variant="outline" className="text-xs">
              Can sell:{" "}
              {simulation.canSell === true
                ? "Yes"
                : simulation.canSell === false
                  ? "No"
                  : "Not simulated"}
            </Badge>

            {Boolean(
              (simulation as Record<string, unknown>)["revertReason"],
            ) && (
              <Badge variant="outline" className="text-xs text-destructive">
                Revert
              </Badge>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <span className="text-xs text-muted-foreground block">
            {t("scam.trading")}
          </span>

          <div className="flex flex-wrap gap-1">
            {typeof simulation.priceImpactPct !== "number" &&
              typeof simulation.slippagePct !== "number" && (
                <span className="text-xs text-muted-foreground">
                  Not measured
                </span>
              )}
            {typeof (simulation as Record<string, unknown>)[
              "priceImpactPct"
            ] === "number" && (
              <Badge variant="outline" className="text-xs">
                Impact:{" "}
                {Math.round(
                  (simulation as Record<string, unknown>)[
                    "priceImpactPct"
                  ] as number,
                )}
                %
              </Badge>
            )}

            {typeof (simulation as Record<string, unknown>)["slippagePct"] ===
              "number" && (
              <Badge variant="outline" className="text-xs">
                Slip:{" "}
                {Math.round(
                  (simulation as Record<string, unknown>)[
                    "slippagePct"
                  ] as number,
                )}
                %
              </Badge>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <span className="text-xs text-muted-foreground block">
            {t("scam.holders")}
          </span>

          <div className="flex flex-wrap gap-1">
            <Badge variant="outline" className="text-xs">
              Concentration unavailable
            </Badge>

            <Badge variant="outline" className="text-xs">
              Holder count unavailable
            </Badge>
          </div>
        </div>

        <div className="space-y-1">
          <span className="text-xs text-muted-foreground block">
            {t("scam.recommendation")}
          </span>

          {token.riskLevel === "high" || token.riskLevel === "critical" ? (
            <span className="text-xs font-medium text-destructive">
              Investigate before interacting
            </span>
          ) : token.riskLevel === "medium" ? (
            <span className="text-xs font-medium text-amber-400">Caution</span>
          ) : (
            <span className="text-xs font-medium text-emerald-400">
              Lower risk signals
            </span>
          )}
        </div>
      </div>

      {token.reasons && token.reasons.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">
            {t("scam.detectedIssues")}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {token.reasons.map((reason, i) => (
              <div
                key={i}
                className="flex gap-2 items-start text-xs text-muted-foreground bg-background p-2 rounded border"
              >
                <AlertCircle className="h-3 w-3 mt-0.5 shrink-0 text-destructive" />

                <span>{reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">
        The score uses token metadata and known-address matches. A price quote
        establishes valuation coverage only; it does not establish exchange
        listing, liquidity, or sellability.
      </p>
    </div>
  );
});

const TokenRiskCard = memo(function TokenRiskCard({
  token,
}: {
  token: FlaggedToken;
}) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation();

  const getRiskColor = (level: string) => {
    switch (level) {
      case "critical":
      case "high":
        return "text-rose-400 bg-rose-400/10 border-rose-400/25";
      case "medium":
        return "text-amber-400 bg-amber-400/10 border-amber-400/25";
      default:
        return "text-emerald-400 bg-emerald-400/10 border-emerald-400/25";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return "bg-red-500";
    if (score >= 40) return "bg-yellow-500";
    return "bg-green-500";
  };

  return (
    <Card className="overflow-hidden transition-all hover:border-foreground/30 border-muted">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-lg">{token.symbol}</h3>

              <Badge variant="secondary" className="text-[10px] font-normal">
                Heuristic
              </Badge>
            </div>

            <p
              className="text-xs text-muted-foreground truncate max-w-[180px]"
              title={token.tokenAddress}
            >
              {token.tokenAddress.slice(0, 6)}...{token.tokenAddress.slice(-4)}
            </p>
          </div>

          <Badge
            className={cn("capitalize", getRiskColor(token.riskLevel))}
            variant="outline"
          >
            {token.riskLevel}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t("scam.score")}</span>

            <span className="font-medium">
              {Math.round(Math.max(0, Math.min(100, token.score)))}/100
            </span>
          </div>

          <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-500",
                getScoreColor(token.score),
              )}
              style={{ width: `${Math.max(0, Math.min(100, token.score))}%` }}
            />
          </div>
        </div>

        <div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between h-8 text-xs font-normal"
            onClick={() => setExpanded(!expanded)}
            aria-label={`Review ${token.symbol} evidence`}
            aria-expanded={expanded}
          >
            {expanded ? t("scam.hideEvidence") : t("scam.viewEvidence")}

            {expanded ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </Button>

          <div
            className={cn(
              "mt-3 transition-all duration-300 overflow-hidden",
              expanded ? "max-h-none opacity-100" : "max-h-0 opacity-0",
            )}
          >
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground font-mono break-all">
                {token.tokenAddress}
              </div>

              {expanded && <TokenEvidenceDetail token={token} />}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

function FilterButton({
  active,
  onClick,
  label,
  variant = "default",
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  variant?: "default" | "destructive" | "warning" | "success";
}) {
  const getVariantStyles = () => {
    if (!active)
      return "hover:bg-muted text-muted-foreground border-transparent";
    switch (variant) {
      case "destructive":
        return "bg-rose-400/10 text-rose-400 border-rose-400/25";
      case "warning":
        return "bg-amber-400/10 text-amber-400 border-amber-400/25";
      case "success":
        return "bg-green-500/10 text-emerald-400 border-emerald-400/25";
      default:
        return "bg-primary/10 text-primary border-primary/20";
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      aria-pressed={active}
      className={cn("border transition-all", getVariantStyles())}
    >
      {label}
    </Button>
  );
}
