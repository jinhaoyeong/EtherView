"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useState, useEffect } from "react";
import { useWallet } from "@/contexts/wallet-context";
import { WalletAPI } from "@/lib/api/wallet";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Fish,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  ExternalLink,
  Activity,
  BarChart3,
  Zap,
  AlertTriangle,
  DollarSign,
  Wallet,
  Building
} from "lucide-react";

interface WhaleMovement {
  id: string;
  hash: string;
  timestamp: number;
  from: string;
  to: string;
  value: string;
  valueUSD: number;
  tokenSymbol: string;
  tokenAddress?: string;
  movementType: 'deposit' | 'withdrawal' | 'transfer' | 'defi_interaction';
  exchangeName?: string;
  confidence: number;
  reasoning: string[];
  impactScore: number;
  enhancedData: {
    isWhaleWallet: boolean;
    whaleScore: number;
    hasHistory: boolean;
    relatedTransactions: number;
  };
  dataSource: 'alchemy' | 'etherscan' | 'combined';
}

interface WhaleSummary {
  totalEvents: number;
  exchangeInflows: number;
  exchangeOutflows: number;
  avgImpact: number;
  totalVolumeUSD: number;
}

export default function WhaleMovement() {
  const { walletAddress, handleDisconnect, isConnected } = useWallet();

  // Debug logging
  console.log('🐋 Whale page - Wallet state from useWallet:', {
    walletAddress,
    isConnected,
    hasAddress: !!walletAddress,
    addressLength: walletAddress?.length,
    localStorage: typeof window !== 'undefined' ? localStorage.getItem("etherview_wallet") : 'N/A'
  });
  const [whaleMovements, setWhaleMovements] = useState<WhaleMovement[]>([]);
  const [summary, setSummary] = useState<WhaleSummary>({
    totalEvents: 0,
    exchangeInflows: 0,
    exchangeOutflows: 0,
    avgImpact: 0,
    totalVolumeUSD: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (walletAddress && walletAddress.trim() !== '') {
      loadWhaleMovements(walletAddress);
    } else {
      setLoading(false);
      setError("Please enter a wallet address to view whale movements.");
    }
  }, [walletAddress]);

  const loadWhaleMovements = async (address: string) => {
    try {
      setLoading(true);
      setError(null);

      console.log('🐋 Loading whale movements for wallet:', address);

      let transactions: unknown[] = [];
      const pageCount = 3;
      const offset = 200;
      for (let page = 1; page <= pageCount; page++) {
        const txs = await WalletAPI.fetchTransactions(address, page, offset);
        transactions = transactions.concat(txs);
      }
      const realWhaleMovements = await WalletAPI.detectWhaleMovements(transactions, 20000);

      console.log('🐋 Found whale movements:', realWhaleMovements.length);

      // Calculate summary statistics
      const whaleSummary = {
        totalEvents: realWhaleMovements.length,
        exchangeInflows: realWhaleMovements.filter(m => m.movementType === 'deposit').length,
        exchangeOutflows: realWhaleMovements.filter(m => m.movementType === 'withdrawal').length,
        avgImpact: realWhaleMovements.length > 0
          ? Math.round(realWhaleMovements.reduce((sum, m) => sum + m.impactScore, 0) / realWhaleMovements.length)
          : 0,
        totalVolumeUSD: realWhaleMovements.reduce((sum, m) => sum + m.valueUSD, 0)
      };

      setWhaleMovements(realWhaleMovements);
      setSummary(whaleSummary);
    } catch (err) {
      console.error('❌ Failed to load whale movements:', err);
      setError(err instanceof Error ? err.message : "Failed to load whale movements");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (walletAddress) {
      setRefreshing(true);
      await loadWhaleMovements(walletAddress);
      setRefreshing(false);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getMovementIcon = (type: WhaleMovement['movementType']) => {
    switch (type) {
      case 'deposit': return <ArrowDownLeft className="h-4 w-4 text-green-600" />;
      case 'withdrawal': return <ArrowUpRight className="h-4 w-4 text-red-600" />;
      case 'transfer': return <Wallet className="h-4 w-4 text-blue-600" />;
      case 'defi_interaction': return <Activity className="h-4 w-4 text-purple-600" />;
      default: return <Fish className="h-4 w-4" />;
    }
  };

  const getMovementTypeColor = (type: WhaleMovement['movementType']) => {
    switch (type) {
      case 'deposit': return 'text-green-600';
      case 'withdrawal': return 'text-red-600';
      case 'transfer': return 'text-blue-600';
      case 'defi_interaction': return 'text-purple-600';
      default: return 'text-gray-600';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600';
    if (confidence >= 60) return 'text-yellow-600';
    if (confidence >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getImpactColor = (impact: number) => {
    if (impact >= 70) return 'text-red-600';
    if (impact >= 50) return 'text-orange-600';
    if (impact >= 30) return 'text-yellow-600';
    return 'text-blue-600';
  };

  if (loading) {
    return (
      <DashboardLayout walletAddress={walletAddress || ''} onDisconnect={handleDisconnect}>
        <div className="space-y-6">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-64 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div className="h-24 bg-muted rounded"></div>
              <div className="h-24 bg-muted rounded"></div>
              <div className="h-24 bg-muted rounded"></div>
              <div className="h-24 bg-muted rounded"></div>
            </div>
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded mb-4"></div>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout walletAddress={walletAddress || ''} onDisconnect={handleDisconnect}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Fish className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Whale Movement</h1>
              <p className="text-sm text-muted-foreground">
                Large transfers linked to potential market impact
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh Analysis
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-card border-border p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Total Events</p>
                <p className="text-2xl font-bold text-foreground">{summary.totalEvents}</p>
              </div>
              <Fish className="text-3xl text-blue-600" />
            </div>
          </Card>

          <Card className="bg-card border-border p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Exchange Inflows</p>
                <p className="text-2xl font-bold text-green-600">{summary.exchangeInflows}</p>
              </div>
              <ArrowDownLeft className="text-3xl text-green-600" />
            </div>
          </Card>

          <Card className="bg-card border-border p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Exchange Outflows</p>
                <p className="text-2xl font-bold text-red-600">{summary.exchangeOutflows}</p>
              </div>
              <ArrowUpRight className="text-3xl text-red-600" />
            </div>
          </Card>

          <Card className="bg-card border-border p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Avg Impact</p>
                <p className="text-2xl font-bold">{summary.avgImpact.toFixed(0)}</p>
              </div>
              <BarChart3 className="text-3xl text-purple-600" />
            </div>
          </Card>
        </div>

        {/* Volume Summary */}
        <Card className="bg-card border-border p-6 shadow-lg">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="h-5 w-5 text-green-600" />
            <h3 className="text-lg font-semibold">Total Volume Tracked</h3>
          </div>
          <p className="text-3xl font-bold text-green-600">
            ${summary.totalVolumeUSD.toLocaleString()}
          </p>
        </Card>

        {/* Whale Events List */}
        {error ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : whaleMovements.length === 0 ? (
          <Card className="bg-card border-border p-12 shadow-lg text-center">
            <Fish className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Whale Movements Detected</h3>
            <p className="text-muted-foreground">
            Large transfers (≥$20k) will appear here as they&apos;re detected in real-time.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {whaleMovements.map((movement) => (
              <Card
                key={movement.id}
                className="bg-card border-border p-6 shadow-lg hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="mt-1">
                      {getMovementIcon(movement.movementType)}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Header */}
                      <div className="flex items-center gap-3 mb-3">
                        <h4 className="font-medium text-foreground">
                          {movement.tokenSymbol} Whale Movement
                        </h4>

                        <Badge
                          variant="outline"
                          className={getMovementTypeColor(movement.movementType)}
                        >
                          {movement.movementType === 'deposit' && 'Exchange Deposit'}
                          {movement.movementType === 'withdrawal' && 'Exchange Withdrawal'}
                          {movement.movementType === 'transfer' && 'Whale Transfer'}
                          {movement.movementType === 'defi_interaction' && 'DeFi Interaction'}
                        </Badge>

                        {movement.exchangeName && (
                          <Badge variant="secondary" className="text-xs">
                            <Building className="h-3 w-3 mr-1" />
                            {movement.exchangeName}
                          </Badge>
                        )}

                        <div className="ml-auto">
                          <Badge
                            variant="outline"
                            className={`text-xs ${getImpactColor(movement.impactScore)}`}
                          >
                            Impact: {movement.impactScore}
                          </Badge>
                        </div>
                      </div>

                      {/* Transaction Details */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
                        <div>
                          <span className="text-muted-foreground">From:</span>
                          <div className="font-mono text-foreground">
                            {formatAddress(movement.from)}
                          </div>
                        </div>

                        <div>
                          <span className="text-muted-foreground">To:</span>
                          <div className="font-mono text-foreground">
                            {formatAddress(movement.to)}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
                        <div>
                          <span className="text-muted-foreground">Value:</span>
                          <div className="font-medium text-foreground">
                            {movement.tokenSymbol}: {parseFloat(movement.value).toLocaleString()}
                            <span className="ml-2 text-green-600">
                              (${movement.valueUSD.toLocaleString()})
                            </span>
                          </div>
                        </div>

                        <div>
                          <span className="text-muted-foreground">Confidence:</span>
                          <div className="flex items-center gap-2">
                            <div className={`font-medium ${getConfidenceColor(movement.confidence)}`}>
                              {movement.confidence}%
                            </div>
                            <div className="w-20 bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${getConfidenceColor(movement.confidence).replace('text-', 'bg-')}`}
                                style={{ width: `${movement.confidence}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Why It Matters Section */}
                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Zap className="h-4 w-4 text-primary" />
                          <span className="font-medium text-sm">Why it matters:</span>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          {movement.reasoning.map((reason, index) => (
                            <div key={index}>• {reason}</div>
                          ))}
                        </div>
                      </div>

                      {/* Enhanced Data */}
                      {movement.enhancedData && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-muted-foreground mb-4">
                          <div>
                            <span>Whale Wallet:</span>
                            <Badge variant={movement.enhancedData.isWhaleWallet ? "default" : "secondary"}>
                              {movement.enhancedData.isWhaleWallet ? 'Yes' : 'No'}
                            </Badge>
                          </div>
                          <div>
                            <span>Whale Score:</span>
                            <Badge variant="outline">{movement.enhancedData.whaleScore}/100</Badge>
                          </div>
                          <div>
                            <span>Related TX:</span>
                            <span>{movement.enhancedData.relatedTransactions}</span>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Hash: {formatAddress(movement.hash)}</span>
                        <span>{formatDate(movement.timestamp)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`https://etherscan.io/tx/${movement.hash}`, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View on Etherscan
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}