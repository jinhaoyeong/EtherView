"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  CheckCircle, 
  XCircle, 
  ChevronDown, 
  ChevronUp,
  Filter,
  ArrowUpDown,
  LayoutList,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal
} from "lucide-react";
import { useWallet } from "@/contexts/wallet-context";
import { WalletAPI } from "@/lib/api/wallet";
import { cn } from "@/lib/utils";

interface FlaggedToken {
  tokenAddress: string;
  symbol: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  score: number;
  reasons?: string[];
  confidencePct?: number;
  evidence?: any;
}

export default function ScamTokenAlertPage() {
  const { walletAddress, handleDisconnect } = useWallet();
  const [flaggedTokens, setFlaggedTokens] = useState<FlaggedToken[]>([]);
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
  const itemsPerPage = 100;

  useEffect(() => {
    if (walletAddress && walletAddress.trim() !== '') {
      loadScamData(walletAddress);
    } else {
      setLoading(false);
      setError("Please connect a wallet to view scam alerts.");
    }
  }, [walletAddress]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, riskFilter, sortOrder]);

  const loadScamData = async (address: string) => {
    try {
      setLoading(true);
      setError(null);
      const result = await WalletAPI.analyzeWallet(address, '24h');
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to fetch analysis');
      }

      const scam = result.data?.scam || {};
      let tokens: FlaggedToken[] = Array.isArray(scam.flaggedTokens) ? scam.flaggedTokens : [];

      // Remove duplicates based on tokenAddress to prevent React key errors
      const uniqueTokens = tokens.filter((token, index, arr) =>
        arr.findIndex(t => t.tokenAddress === token.tokenAddress) === index
      );

      if (tokens.length !== uniqueTokens.length) {
        console.log(`⚠️ Removed ${tokens.length - uniqueTokens.length} duplicate tokens from scam results`);
      }

      setFlaggedTokens(uniqueTokens);
      setStats({
        highRiskCount: scam.highRiskCount || 0,
        mediumRiskCount: scam.mediumRiskCount || 0,
        lowRiskCount: scam.lowRiskCount || 0,
        totalTokens: scam.totalTokens || 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scam alerts');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!walletAddress) return;
    setRefreshing(true);
    await loadScamData(walletAddress);
    setRefreshing(false);
  };

  const filteredTokens = flaggedTokens.filter(token => {
    const matchesSearch = token.symbol.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (token.reasons?.some(r => r.toLowerCase().includes(searchTerm.toLowerCase())) ?? false);
    const matchesFilter = riskFilter === "all" || 
                          (riskFilter === "high" && (token.riskLevel === "high" || token.riskLevel === "critical")) ||
                          token.riskLevel === riskFilter;
    return matchesSearch && matchesFilter;
  }).sort((a, b) => {
    return sortOrder === "desc" 
      ? b.score - a.score 
      : a.score - b.score;
  });

  const totalPages = Math.ceil(filteredTokens.length / itemsPerPage);
  const paginatedTokens = filteredTokens.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <DashboardLayout walletAddress={walletAddress || ''} onDisconnect={handleDisconnect}>
      <div className="space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <ShieldCheck className="h-8 w-8 text-primary" />
              Scam Token Shield
            </h1>
            <p className="text-muted-foreground">
              Advanced security analysis and risk detection for your portfolio.
            </p>
          </div>
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing || loading} className="w-full md:w-auto">
            <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
            Refresh Analysis
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard 
            title="Total Scanned" 
            value={stats.totalTokens} 
            icon={Search} 
            color="text-blue-500" 
            bg="bg-blue-500/10"
          />
          <StatCard 
            title="High Risk" 
            value={stats.highRiskCount} 
            icon={AlertTriangle} 
            color="text-red-500" 
            bg="bg-red-500/10"
          />
          <StatCard 
            title="Medium Risk" 
            value={stats.mediumRiskCount} 
            icon={AlertCircle} 
            color="text-yellow-500" 
            bg="bg-yellow-500/10"
          />
          <StatCard 
            title="Low Risk" 
            value={stats.lowRiskCount} 
            icon={CheckCircle} 
            color="text-green-500" 
            bg="bg-green-500/10"
          />
        </div>

        {/* Main Content */}
        <div className="space-y-6">
          {/* Controls */}
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            <div className="relative w-full lg:w-96">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search symbol or reason..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto items-start sm:items-center">
              <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 items-center">
                 <div className="flex bg-muted rounded-lg p-1 mr-2">
                  <Button
                    variant={viewMode === "list" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                    className="h-8 w-8 p-0"
                    title="List View"
                  >
                    <LayoutList className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "grid" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("grid")}
                    className="h-8 w-8 p-0"
                    title="Grid View"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSortOrder(prev => prev === "desc" ? "asc" : "desc")}
                  className="whitespace-nowrap"
                >
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  Sort: {sortOrder === "desc" ? "High" : "Low"}
                </Button>
                
                <div className="h-6 w-px bg-border mx-1 hidden sm:block"></div>
                <FilterButton active={riskFilter === "all"} onClick={() => setRiskFilter("all")} label="All" />
                <FilterButton active={riskFilter === "high"} onClick={() => setRiskFilter("high")} label="High" variant="destructive" />
                <FilterButton active={riskFilter === "medium"} onClick={() => setRiskFilter("medium")} label="Medium" variant="warning" />
                <FilterButton active={riskFilter === "low"} onClick={() => setRiskFilter("low")} label="Low" variant="success" />
              </div>
            </div>
          </div>

          {/* Token List/Grid */}
          {error ? (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="flex flex-col items-center justify-center p-6 text-center">
                <AlertTriangle className="h-10 w-10 text-destructive mb-2" />
                <p className="text-destructive font-medium">{error}</p>
                <Button variant="outline" onClick={() => loadScamData(walletAddress!)} className="mt-4">
                  Try Again
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
                <h3 className="text-lg font-semibold">No tokens found</h3>
                <p className="text-muted-foreground max-w-sm mt-1">
                  {searchTerm || riskFilter !== 'all' 
                    ? "Try adjusting your search or filters to see more results." 
                    : "Great news! We didn't detect any flagged tokens in your portfolio."}
                </p>
                {(searchTerm || riskFilter !== 'all') && (
                  <Button variant="link" onClick={() => { setSearchTerm(""); setRiskFilter("all"); }} className="mt-2">
                    Clear filters
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
                        <TableHead className="w-[200px]">Token</TableHead>
                        <TableHead>Risk Level</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Confidence</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedTokens.map((token, index) => (
                        <TokenRiskRow key={`${token.tokenAddress}-${index}`} token={token} />
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="p-4 grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {paginatedTokens.map((token, index) => (
                      <TokenRiskCard key={`${token.tokenAddress}-${index}`} token={token} />
                    ))}
                  </div>
                )}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-2">
                  <p className="text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredTokens.length)} of {filteredTokens.length} tokens
                  </p>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <div className="text-sm font-medium">
                      Page {currentPage} of {totalPages}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

function TokenRiskRow({ token }: { token: FlaggedToken }) {
  const [expanded, setExpanded] = useState(false);
  
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
              {Math.round(token.confidencePct)}%
            </Badge>
          ) : (
            <span className="text-muted-foreground text-xs">-</span>
          )}
        </TableCell>
        <TableCell>
          <div className="flex gap-1 flex-wrap">
             {(token.evidence?.staticCode?.verified ?? token.evidence?.features?.contractVerified) ? (
               <Badge variant="outline" className="text-[10px] px-1 h-5 text-green-600 border-green-200 dark:border-green-900">Verified</Badge>
             ) : (
               <Badge variant="outline" className="text-[10px] px-1 h-5 text-muted-foreground border-muted">Unverified</Badge>
             )}
             {(token.evidence?.external?.coingeckoListed || token.evidence?.features?.externalListings > 0) && (
               <Badge variant="outline" className="text-[10px] px-1 h-5 text-blue-600 border-blue-200 dark:border-blue-900">Listed</Badge>
             )}
          </div>
        </TableCell>
        <TableCell className="text-right">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={6} className="p-0">
            <div className="p-4 border-t">
               <TokenEvidenceDetail token={token} />
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// Extracted evidence display to reusable component
function TokenEvidenceDetail({ token }: { token: FlaggedToken }) {
  const ev = token.evidence || {};
  const features = ev.features || {};
  const simulation = ev.simulation || {};
  const rules = ev.rules || {};
  const ml = ev.ml || {};
  const holder = ev.holderDistribution || {
    top1: features.holderTop1Pct,
    top5: features.holderTop5Pct,
    totalHolders: features.totalHolders
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground block">Simulation</span>
          <div className="flex flex-wrap gap-1">
             <Badge variant="outline" className="text-xs">Can Sell: {simulation.canSell === false ? 'No' : 'Yes'}</Badge>
             {simulation.revertReason && <Badge variant="outline" className="text-xs text-destructive">Revert</Badge>}
          </div>
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground block">Trading</span>
           <div className="flex flex-wrap gap-1">
            {typeof simulation.priceImpactPct === 'number' && <Badge variant="outline" className="text-xs">Impact: {Math.round(simulation.priceImpactPct)}%</Badge>}
            {typeof simulation.slippagePct === 'number' && <Badge variant="outline" className="text-xs">Slip: {Math.round(simulation.slippagePct)}%</Badge>}
          </div>
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground block">Holders</span>
          <div className="flex flex-wrap gap-1">
            <Badge variant="outline" className="text-xs">Top1: {holder?.top1 ?? 0}%</Badge>
            <Badge variant="outline" className="text-xs">Total: {holder?.totalHolders ?? 0}</Badge>
          </div>
        </div>
        <div className="space-y-1">
           <span className="text-xs text-muted-foreground block">Recommendation</span>
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
          <div className="text-xs font-medium text-muted-foreground">Detected Issues</div>
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
            <div className="text-xs font-medium text-muted-foreground">Rule Signals</div>
            <div className="flex flex-wrap gap-1">
              {Object.entries(rules).map(([k, v]) => (
                <Badge key={k} variant="secondary" className="text-[10px]">{k}: {String(v)}</Badge>
              ))}
            </div>
          </div>
        )}
        
        {Array.isArray(ml?.contributions) && ml.contributions.length > 0 && (
          <div className="space-y-1">
             <div className="text-xs font-medium text-muted-foreground">AI Factors</div>
             <div className="flex flex-wrap gap-1">
              {ml.contributions.slice(0, 3).map((c: any, i: number) => (
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
}

// Retain old card for grid view but use the shared evidence component
function TokenRiskCard({ token }: { token: FlaggedToken }) {
  const [expanded, setExpanded] = useState(false);
  
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
                  {Math.round(token.confidencePct)}%
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate max-w-[140px]" title={token.tokenAddress}>
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
            <span className="text-muted-foreground">Risk Score</span>
            <span className="font-medium">{Math.round(token.score)}/100</span>
          </div>
          <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
            <div className={cn("h-full transition-all duration-500", getScoreColor(token.score))} style={{ width: `${token.score}%` }} />
          </div>
        </div>

        <div>
          <Button variant="ghost" size="sm" className="w-full justify-between h-8 text-xs font-normal" onClick={() => setExpanded(!expanded)}>
            {expanded ? "Hide Evidence" : "View Evidence"}
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>

          {expanded && (
            <div className="mt-3">
              <TokenEvidenceDetail token={token} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StatCard({ title, value, icon: Icon, color, bg }: { title: string, value: number, icon: any, color: string, bg: string }) {
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
