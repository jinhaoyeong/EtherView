"use client";

import { useEffect, useState, useMemo, memo, useTransition } from "react";
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
  TableRow 
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
  CheckCircle
} from "lucide-react";
import { useWallet } from "@/contexts/wallet-context";
import { WalletAPI } from "@/lib/api/wallet";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import { useSettings } from "@/hooks/use-settings";
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
  ml?: { contributions?: Array<{ feature?: string }> } & Record<string, unknown>;
  holderDistribution?: { top1?: number; top5?: number; totalHolders?: number };
  [key: string]: unknown;
}

export default function ScamTokenAlertPage() {
  const { walletAddress, handleDisconnect } = useWallet();
  const { t } = useTranslation();
  const { settings } = useSettings();
  const [flaggedTokens, setFlaggedTokens] = useState<FlaggedToken[]>([]);
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
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [riskFilter, setRiskFilter] = useState<"all" | "high" | "medium" | "low">("all");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;
  const [visibleCount, setVisibleCount] = useState(itemsPerPage);

  useEffect(() => {
    if (walletAddress && walletAddress.trim() !== '') {
      loadScamData(walletAddress);
    } else {
      setLoading(false);
      setError(t('scam.enterAddress'));
    }
  }, [walletAddress]);

  // Reset page when filters change - REMOVED useEffect as it's now handled in event handlers
  /*
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, riskFilter, sortOrder, itemsPerPage]);
  */

  const loadScamData = async (address: string, forceRefresh: boolean = false) => {
    try {
      const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
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
      // Add cache buster to avoid cached API responses
      const cacheBuster = forceRefresh ? `?t=${Date.now()}` : '';
      const result = (await WalletAPI.analyzeWallet(address, '24h', undefined, cachedTokens)) as {
        success: boolean;
        error?: string;
        data?: {
          scam?: {
            flaggedTokens?: FlaggedToken[];
            highRiskCount?: number;
            mediumRiskCount?: number;
            lowRiskCount?: number;
            totalTokens?: number;
          };
        };
      };
      console.log('🛡️ Scam API Result:', {
        success: result?.success,
        flaggedCount: Array.isArray(result?.data?.scam?.flaggedTokens) ? result.data.scam.flaggedTokens.length : 0,
        stats: {
          high: result?.data?.scam?.highRiskCount,
          medium: result?.data?.scam?.mediumRiskCount,
          low: result?.data?.scam?.lowRiskCount,
          total: result?.data?.scam?.totalTokens
        }
      });
      if (!result?.success) {
        throw new Error(result?.error || t('scam.loadError'));
      }

      const scam = result.data?.scam || {};
      const tokens: FlaggedToken[] = Array.isArray(scam.flaggedTokens) ? scam.flaggedTokens as FlaggedToken[] : [];

      // Robust dedup: prefer tokenAddress, fallback to symbol
      const seen = new Set();
      const uniqueTokens = tokens.filter(token => {
        const key = (token.tokenAddress || '').toLowerCase() || (token.symbol || '').toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      if (tokens.length !== uniqueTokens.length) {
        console.log(`⚠️ Removed ${tokens.length - uniqueTokens.length} duplicate tokens from scam results`);
      }

      // Sort once by score (high to low) and pre-group by risk level
      const sortedTokens = [...uniqueTokens].sort((a, b) => b.score - a.score);
      const highTokens = sortedTokens.filter(
        (t) => t.riskLevel === "high" || t.riskLevel === "critical"
      );
      const mediumTokens = sortedTokens.filter((t) => t.riskLevel === "medium");
      const lowTokens = sortedTokens.filter((t) => t.riskLevel === "low");

      setFlaggedTokens(sortedTokens);
      setGroupedTokens({
        all: sortedTokens,
        high: highTokens,
        medium: mediumTokens,
        low: lowTokens,
      });
      setStats({
        highRiskCount: scam.highRiskCount || highTokens.length,
        mediumRiskCount: scam.mediumRiskCount || mediumTokens.length,
        lowRiskCount: scam.lowRiskCount || lowTokens.length,
        totalTokens: scam.totalTokens || sortedTokens.length,
      });
      const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const duration = Math.round((t1 - t0));
      try {
        await fetch('/api/metrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'tab_scam_loaded',
            metric: 'ui_scam_switch_time_ms',
            value: duration,
            payload: { address, flagged: uniqueTokens.length, stats: { high: scam.highRiskCount || 0, medium: scam.mediumRiskCount || 0, low: scam.lowRiskCount || 0 } }
          })
        })
      } catch {}
    } catch (err) {
      setError(err instanceof Error ? err.message : t('scam.loadError'));
      try {
        await fetch('/api/metrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'tab_scam_failed', counter: 'ui_tab_load_failed', payload: { address } })
        })
      } catch {}
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!walletAddress) return;
    setRefreshing(true);
    await loadScamData(walletAddress, true);
    setRefreshing(false);
  };

  const handleFilterChange = (filter: "all" | "high" | "medium" | "low") => {
    startTransition(() => {
      setRiskFilter(filter);
      setCurrentPage(1);
    });
  };

  const handleSortChange = () => {
    startTransition(() => {
      setSortOrder(prev => (prev === "desc" ? "asc" : "desc"));
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
        (token.reasons?.some((r) => r && r.toLowerCase().includes(lowerSearch)) ??
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
    currentPage * itemsPerPage
  );

  useEffect(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const maxVisible = Math.min(itemsPerPage, Math.max(filteredTokens.length - startIndex, 0));
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
      setVisibleCount(prev => {
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
    <DashboardLayout walletAddress={walletAddress || ''} onDisconnect={handleDisconnect}>
      <div className="space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <ShieldCheck className="h-8 w-8 text-primary" />
              {t('scam.title')}
            </h1>
            <p className="text-muted-foreground">
              {t('scam.subtitle')}
            </p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" onClick={handleRefresh} disabled={refreshing || loading} className="w-full md:w-auto">
                <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
                {t('common.refresh')}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('scam.refresh_tooltip')}</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard 
            title={t('scam.totalScanned')} 
            value={stats.totalTokens} 
            icon={Search} 
            color="text-blue-500" 
            bg="bg-blue-500/10"
          />
          <StatCard 
            title={t('scam.high_risk')} 
            value={stats.highRiskCount} 
            icon={AlertTriangle} 
            color="text-red-500" 
            bg="bg-red-500/10"
          />
          <StatCard 
            title={t('scam.medium_risk')} 
            value={stats.mediumRiskCount} 
            icon={AlertCircle} 
            color="text-yellow-500" 
            bg="bg-yellow-500/10"
          />
          <StatCard 
            title={t('scam.low_risk')} 
            value={stats.lowRiskCount} 
            icon={CheckCircle} 
            color="text-green-500" 
            bg="bg-green-500/10"
          />
        </div>

        {/* Main Content */}
        <div className={cn("space-y-6 transition-opacity duration-150", isPending ? "opacity-60" : "opacity-100")}>
          {/* Controls */}
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            <div className="relative w-full lg:w-96">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('scam.search_placeholder')}
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
                        className="h-8 w-8 p-0"
                      >
                        <LayoutList className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>{t('scam.listView')}</p></TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={viewMode === "grid" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setViewMode("grid")}
                        className="h-8 w-8 p-0"
                      >
                        <LayoutGrid className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>{t('scam.gridView')}</p></TooltipContent>
                  </Tooltip>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSortChange}
                  className="whitespace-nowrap"
                >
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  {t('scam.sort')} {sortOrder === "desc" ? t('scam.high_risk') : t('scam.low_risk')}
                </Button>
                
                <div className="h-6 w-px bg-border mx-1 hidden sm:block"></div>
                <FilterButton active={riskFilter === "all"} onClick={() => handleFilterChange("all")} label={t('scam.all_risks')} />
                <FilterButton active={riskFilter === "high"} onClick={() => handleFilterChange("high")} label={t('scam.high_risk')} variant="destructive" />
                <FilterButton active={riskFilter === "medium"} onClick={() => handleFilterChange("medium")} label={t('scam.medium_risk')} variant="warning" />
                <FilterButton active={riskFilter === "low"} onClick={() => handleFilterChange("low")} label={t('scam.low_risk')} variant="success" />
              </div>
            </div>
          </div>

          {/* Token List/Grid */}
          <div>
          {error ? (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="flex flex-col items-center justify-center p-6 text-center">
                <AlertTriangle className="h-10 w-10 text-destructive mb-2" />
                <p className="text-destructive font-medium">{error}</p>
                <Button variant="outline" onClick={() => loadScamData(walletAddress!)} className="mt-4">
                  {t('common.tryAgain')}
                </Button>
              </CardContent>
            </Card>
          ) : loading ? (
            <div className="space-y-4">
               {/* Loading Skeleton */}
               {[...Array(5)].map((_, i) => (
                 <div key={i} className="h-16 w-full bg-muted/50 animate-pulse rounded-md" />
               ))}
            </div>
          ) : filteredTokens.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                <div className="rounded-full bg-primary/10 p-4 mb-4">
                  <ShieldCheck className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">{t('scam.noData')}</h3>
                <p className="text-muted-foreground max-w-sm mt-1">
                  {searchTerm || riskFilter !== 'all'
                    ? t('scam.noDataDesc')
                    : (stats.totalTokens === 0
                        ? t('scam.scanUnavailable')
                        : t('scam.greatNews'))}
                </p>
                {(searchTerm || riskFilter !== 'all') && (
                  <Button variant="link" onClick={() => { setSearchTerm(""); handleFilterChange("all"); }} className="mt-2">
                    {t('common.clear_all')}
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md border bg-card">
                {viewMode === "list" ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]">{t('scam.token')}</TableHead>
                        <TableHead>{t('scam.riskLevel')}</TableHead>
                        <TableHead>{t('scam.score')}</TableHead>
                        <TableHead>{t('scam.confidence')}</TableHead>
                        <TableHead>{t('scam.status')}</TableHead>
                        <TableHead className="text-right">{t('scam.action')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedTokens.slice(0, visibleCount).map((token, index) => (
                        <TokenRiskRow key={token.tokenAddress || index} token={token} />
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="p-4 grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {paginatedTokens.slice(0, visibleCount).map((token, index) => (
                      <TokenRiskCard key={token.tokenAddress || index} token={token} />
                    ))}
                  </div>
                )}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex flex-col items-center justify-center gap-3 py-4">
                  <p className="text-sm md:text-base text-muted-foreground text-center">
                    {t('transactions.showing')
                      .replace(
                        '{count}',
                        String(((currentPage - 1) * itemsPerPage) + 1) +
                          '-' +
                          String(Math.min(currentPage * itemsPerPage, filteredTokens.length))
                      )
                      .replace('{total}', String(filteredTokens.length))}
                  </p>
                  <div className="flex items-center space-x-4">
                    <Button
                      variant="outline"
                      size="lg"
                      className="h-11 w-11 rounded-full"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
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
                      className="h-11 w-11 rounded-full"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
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

const TokenRiskRow = memo(function TokenRiskRow({ token }: { token: FlaggedToken }) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation();
  
  const getRiskColor = (level: string) => {
    switch (level) {
      case "critical":
      case "high": return "text-red-500 bg-red-500/10 border-red-200 dark:border-red-900";
      case "medium": return "text-yellow-500 bg-yellow-500/10 border-yellow-200 dark:border-yellow-900";
      default: return "text-green-500 bg-green-500/10 border-green-200 dark:border-green-900";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return "bg-red-500";
    if (score >= 40) return "bg-yellow-500";
    return "bg-green-500";
  };

  return (
    <>
      <TableRow className={cn("cursor-pointer transition-colors", expanded && "bg-muted/50")} onClick={() => setExpanded(!expanded)}>
        <TableCell>
          <div className="flex flex-col">
            <span className="font-bold">{token.symbol}</span>
            <span className="text-xs text-muted-foreground font-mono" title={token.tokenAddress}>
              {token.tokenAddress.slice(0, 6)}...{token.tokenAddress.slice(-4)}
            </span>
          </div>
        </TableCell>
        <TableCell>
          <Badge className={cn("capitalize", getRiskColor(token.riskLevel))} variant="outline">
            {token.riskLevel}
          </Badge>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium w-8">{Math.round(token.score)}</span>
            <div className="h-2 w-24 bg-secondary rounded-full overflow-hidden hidden sm:block">
              <div className={cn("h-full", getScoreColor(token.score))} style={{ width: `${token.score}%` }} />
            </div>
          </div>
        </TableCell>
        <TableCell>
          {typeof token.confidencePct === 'number' ? (
            <Badge variant="secondary" className="text-xs">
              {Math.round((token.confidencePct <= 1 ? token.confidencePct * 100 : token.confidencePct))}%
            </Badge>
          ) : (
            <span className="text-muted-foreground text-xs">-</span>
          )}
        </TableCell>
        <TableCell>
          <div className="flex gap-1 flex-wrap">
             {(token.evidence?.staticCode?.verified ?? token.evidence?.features?.contractVerified) ? (
               <Badge variant="outline" className="text-[10px] px-1 h-5 text-green-600 border-green-200 dark:border-green-900">{t('scam.verified')}</Badge>
             ) : (
               <Badge variant="outline" className="text-[10px] px-1 h-5 text-muted-foreground border-muted">{t('scam.unverified')}</Badge>
             )}
            {(token.evidence?.external?.coingeckoListed || Number(token.evidence?.features?.externalListings || 0) > 0) && (
              <Badge variant="outline" className="text-[10px] px-1 h-5 text-blue-600 border-blue-200 dark:border-blue-900">{t('scam.listed')}</Badge>
            )}
          </div>
        </TableCell>
        <TableCell className="text-right">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </TableCell>
      </TableRow>
      <TableRow className="bg-muted/30 hover:bg-muted/30">
        <TableCell colSpan={6} className="p-0">
          <div className={cn("transition-all duration-300 overflow-hidden", expanded ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0")}> 
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

const TokenEvidenceDetail = memo(function TokenEvidenceDetail({ token }: { token: FlaggedToken }) {
  const { t } = useTranslation();
  const ev = (token.evidence || {}) as ScamEvidence;
  const features = (ev.features || {}) as Record<string, unknown>;
  const simulation = (ev.simulation || {}) as Record<string, unknown>;
  const rules = (ev.rules || {}) as Record<string, unknown>;
  const ml = (ev.ml || {}) as { contributions?: Array<{ feature?: string }> };
  const holder: { top1?: number; top5?: number; totalHolders?: number } = ev.holderDistribution || {
    top1: typeof (features as Record<string, unknown>)['holderTop1Pct'] === 'number' ? ((features as Record<string, unknown>)['holderTop1Pct'] as number) : undefined,
    top5: typeof (features as Record<string, unknown>)['holderTop5Pct'] === 'number' ? ((features as Record<string, unknown>)['holderTop5Pct'] as number) : undefined,
    totalHolders: typeof (features as Record<string, unknown>)['totalHolders'] === 'number' ? ((features as Record<string, unknown>)['totalHolders'] as number) : undefined
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground block">{t('scam.simulation')}</span>
          <div className="flex flex-wrap gap-1">
             <Badge variant="outline" className="text-xs">Can Sell: {simulation.canSell === false ? t('common.no') || 'No' : t('common.yes') || 'Yes'}</Badge>
             {Boolean((simulation as Record<string, unknown>)['revertReason']) && <Badge variant="outline" className="text-xs text-destructive">Revert</Badge>}
          </div>
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground block">{t('scam.trading')}</span>
           <div className="flex flex-wrap gap-1">
            {typeof (simulation as Record<string, unknown>)['priceImpactPct'] === 'number' && <Badge variant="outline" className="text-xs">Impact: {Math.round(((simulation as Record<string, unknown>)['priceImpactPct'] as number))}%</Badge>}
            {typeof (simulation as Record<string, unknown>)['slippagePct'] === 'number' && <Badge variant="outline" className="text-xs">Slip: {Math.round(((simulation as Record<string, unknown>)['slippagePct'] as number))}%</Badge>}
          </div>
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground block">{t('scam.holders')}</span>
          <div className="flex flex-wrap gap-1">
            <Badge variant="outline" className="text-xs">Top1: {String(holder?.top1 ?? 0)}%</Badge>
            <Badge variant="outline" className="text-xs">Total: {String(holder?.totalHolders ?? 0)}</Badge>
          </div>
        </div>
        <div className="space-y-1">
           <span className="text-xs text-muted-foreground block">{t('scam.recommendation')}</span>
           {token.riskLevel === 'high' || token.riskLevel === 'critical' ? (
              <span className="text-xs font-medium text-destructive">Avoid / Revoke</span>
            ) : token.riskLevel === 'medium' ? (
              <span className="text-xs font-medium text-yellow-600">Caution</span>
            ) : (
              <span className="text-xs font-medium text-green-600">Safe</span>
            )}
        </div>
      </div>

      {token.reasons && token.reasons.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">{t('scam.detectedIssues')}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {token.reasons.map((reason, i) => (
              <div key={i} className="flex gap-2 items-start text-xs text-muted-foreground bg-background p-2 rounded border">
                <AlertCircle className="h-3 w-3 mt-0.5 shrink-0 text-destructive" />
                <span>{reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Advanced Details (ML & Rules) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.keys(rules).length > 0 && (
          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground">{t('scam.ruleSignals')}</div>
            <div className="flex flex-wrap gap-1">
              {Object.entries(rules).map(([k, v]) => (
                <Badge key={k} variant="secondary" className="text-[10px]">{k}: {String(v)}</Badge>
              ))}
            </div>
          </div>
        )}
        
        {Array.isArray(ml?.contributions) && ml.contributions.length > 0 && (
          <div className="space-y-1">
             <div className="text-xs font-medium text-muted-foreground">{t('scam.aiFactors')}</div>
             <div className="flex flex-wrap gap-1">
              {ml.contributions.slice(0, 3).map((c: { feature?: string }, i: number) => (
                <Badge key={i} variant="secondary" className="text-[10px]">{c.feature}</Badge>
              ))}
              {ml.contributions.length > 3 && (
                <Badge variant="secondary" className="text-[10px]">+{ml.contributions.length - 3} more</Badge>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

const TokenRiskCard = memo(function TokenRiskCard({ token }: { token: FlaggedToken }) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation();
  
  const getRiskColor = (level: string) => {
    switch (level) {
      case "critical":
      case "high": return "text-red-500 bg-red-500/10 border-red-200 dark:border-red-900";
      case "medium": return "text-yellow-500 bg-yellow-500/10 border-yellow-200 dark:border-yellow-900";
      default: return "text-green-500 bg-green-500/10 border-green-200 dark:border-green-900";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return "bg-red-500";
    if (score >= 40) return "bg-yellow-500";
    return "bg-green-500";
  };

  return (
    <Card className="overflow-hidden transition-all hover:shadow-md border-muted">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-lg">{token.symbol}</h3>
              {typeof token.confidencePct === 'number' && (
                <Badge variant="outline" className="text-xs">
                  {Math.round((token.confidencePct <= 1 ? token.confidencePct * 100 : token.confidencePct))}%
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate max-w-[180px]" title={token.tokenAddress}>
              {token.tokenAddress.slice(0, 6)}...{token.tokenAddress.slice(-4)}
            </p>
          </div>
          <Badge className={cn("capitalize", getRiskColor(token.riskLevel))} variant="outline">
            {token.riskLevel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('scam.score')}</span>
            <span className="font-medium">{Math.round(token.score)}/100</span>
          </div>
          <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
            <div className={cn("h-full transition-all duration-500", getScoreColor(token.score))} style={{ width: `${token.score}%` }} />
          </div>
        </div>

        <div>
          <Button variant="ghost" size="sm" className="w-full justify-between h-8 text-xs font-normal" onClick={() => setExpanded(!expanded)}>
            {expanded ? t('scam.hideEvidence') : t('scam.viewEvidence')}
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>

          <div className={cn("mt-3 transition-all duration-300 overflow-hidden", expanded ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0")}> 
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground font-mono break-all">{token.tokenAddress}</div>
              {expanded && <TokenEvidenceDetail token={token} />}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

function StatCard({ title, value, icon: Icon, color, bg }: { title: string, value: number, icon: React.ElementType, color: string, bg: string }) {
  return (
    <Card>
      <CardContent className="p-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="text-2xl font-bold">{value}</div>
        </div>
        <div className={cn("p-3 rounded-full", bg)}>
          <Icon className={cn("h-5 w-5", color)} />
        </div>
      </CardContent>
    </Card>
  );
}

function FilterButton({ active, onClick, label, variant = "default" }: { active: boolean, onClick: () => void, label: string, variant?: "default" | "destructive" | "warning" | "success" }) {
  const getVariantStyles = () => {
    if (!active) return "hover:bg-muted text-muted-foreground border-transparent";
    switch (variant) {
      case "destructive": return "bg-red-500/10 text-red-600 border-red-200 dark:border-red-900";
      case "warning": return "bg-yellow-500/10 text-yellow-600 border-yellow-200 dark:border-yellow-900";
      case "success": return "bg-green-500/10 text-green-600 border-green-200 dark:border-green-900";
      default: return "bg-primary/10 text-primary border-primary/20";
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className={cn(
        "border transition-all",
        getVariantStyles()
      )}
    >
      {label}
    </Button>
  );
}
