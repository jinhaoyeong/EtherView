"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useWallet } from "@/contexts/wallet-context";
import { WalletAPI } from "@/lib/api/wallet";
import { 
  FileText,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRightLeft,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  Search,
  Filter
} from "lucide-react";

interface Transaction {
  hash: string;
  timestamp: number;
  from: string;
  to: string;
  value: string;
  valueUSD: number; // Added USD value field
  gasUsed: string;
  gasPrice: string;
  status: 'success' | 'pending' | 'failed';
  type: 'received' | 'sent' | 'token_received' | 'token_sent' | 'trade';
  tokenSymbol?: string;
  tokenAddress?: string;
  riskNote?: string;
  isSuspicious?: boolean;
}

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const { walletAddress, handleDisconnect } = useWallet();

  useEffect(() => {
    if (walletAddress && walletAddress.trim() !== '') {
      loadTransactions(walletAddress);
    } else {
      setLoading(false);
      setError("Please enter a wallet address to view transactions.");
    }
  }, [walletAddress]);

  const loadTransactions = async (address: string, page: number = 1, append: boolean = false) => {
    try {
      const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (!append) {
        setLoading(true);
        setCurrentPage(1);
        setTransactions([]);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      console.log(`⚡ FAST TX: Loading transactions for wallet: ${address}, page: ${page}`);

      // ⚡ OPTIMIZED: Fetch paginated transaction data from the API
      const realTransactions = await WalletAPI.fetchTransactions(address, page, 15);
      console.log(`⚡ FAST TX: Loaded ${realTransactions.length} transactions for page ${page}`);

      // Transform API data to Transaction interface format
      const transformedTransactions: Transaction[] = realTransactions.map(tx => ({
        hash: tx.hash,
        timestamp: tx.timestamp,
        from: tx.from,
        to: tx.to,
        value: tx.value,
        valueUSD: tx.valueUSD || 0,
        gasUsed: tx.gasUsed,
        gasPrice: tx.gasPrice,
        status: tx.status as 'success' | 'pending' | 'failed',
        type: tx.type as 'received' | 'sent' | 'token_received' | 'token_sent' | 'trade',
        tokenSymbol: tx.tokenSymbol,
        tokenAddress: tx.tokenAddress,
        riskNote: tx.isSuspicious ? 'Suspicious activity detected' : undefined,
        isSuspicious: tx.isSuspicious || false
      }));

      // ⚡ PAGINATION: Append or replace transactions
      if (append) {
        setTransactions(prev => [...prev, ...transformedTransactions]);
        setCurrentPage(page);
      } else {
        setTransactions(transformedTransactions);
      }

      // ⚡ HAS MORE: Check if there are more transactions to load
      // If we got exactly 15 transactions, there might be more available
      setHasMore(realTransactions.length === 15);
      const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const duration = Math.round((t1 - t0));
      try {
        await fetch('/api/metrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: append ? 'tab_transactions_load_more' : 'tab_transactions_loaded',
            metric: append ? 'ui_transactions_load_more_ms' : 'ui_transactions_switch_time_ms',
            value: duration,
            payload: { address, page, count: realTransactions.length }
          })
        })
      } catch {}

    } catch (err) {
      console.error('❌ Failed to load transactions:', err);
      setError(err instanceof Error ? err.message : "Failed to load transactions");
      try {
        await fetch('/api/metrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'tab_transactions_failed', counter: 'ui_tab_load_failed', payload: { address, page } })
        })
      } catch {}
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleRefresh = async () => {
    if (walletAddress) {
      setRefreshing(true);
      setHasMore(true); // Reset hasMore on refresh

      // 💰 Clear price cache to fetch fresh prices
      WalletAPI.clearPriceCache();

      // 💰 Log cache stats for debugging
      const cacheStats = WalletAPI.getPriceCacheStats();
      console.log('💰 PRICE CACHE STATS after clear:', cacheStats);

      await loadTransactions(walletAddress);
      setRefreshing(false);
    }
  };

  const handleLoadMore = async () => {
    if (walletAddress && hasMore && !loadingMore) {
      const nextPage = currentPage + 1;
      console.log(`⚡ Loading more transactions... Page ${nextPage}`);
      await loadTransactions(walletAddress, nextPage, true);
    }
  };

  const filteredTransactions = transactions.filter(tx => {
    const matchesFilter = filter === 'all' || tx.type === filter;
    const matchesSearch = !searchQuery ||
      tx.hash.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tx.tokenSymbol && tx.tokenSymbol.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesFilter && matchesSearch;
  });

  const getTransactionIcon = (type: Transaction['type']) => {
    switch (type) {
      case 'received': return <ArrowDownLeft className="h-4 w-4 text-green-600" />;
      case 'sent': return <ArrowUpRight className="h-4 w-4 text-red-600" />;
      case 'token_received': return <ArrowDownLeft className="h-4 w-4 text-green-600" />;
      case 'token_sent': return <ArrowUpRight className="h-4 w-4 text-red-600" />;
      case 'trade': return <ArrowRightLeft className="h-4 w-4 text-blue-600" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getTransactionTypeColor = (type: Transaction['type']) => {
    switch (type) {
      case 'received':
      case 'token_received': return 'text-green-600';
      case 'sent':
      case 'token_sent': return 'text-red-600';
      case 'trade': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const formatValue = (value: string) => {
    const val = parseFloat(value);
    if (val === 0) return '0.000000';
    if (val < 0.000001) return val.toFixed(12);
    if (val < 0.001) return val.toFixed(9);
    return val.toFixed(6);
  };
const formatGasFee = (gasUsed: string, gasPrice: string): string => {
    const gasUsedNum = parseFloat(gasUsed);
    const gasPriceNum = parseFloat(gasPrice);
    const feeInWei = gasUsedNum * gasPriceNum;
    const feeInETH = feeInWei / Math.pow(10, 18);
    return feeInETH.toFixed(9);
  };

  const formatGasPrice = (gasPrice: string): string => {
    const gasPriceInWei = parseFloat(gasPrice);
    const gasPriceInGwei = gasPriceInWei / Math.pow(10, 9);
    return gasPriceInGwei.toFixed(2);
  };

  

  if (loading) {
    return (
      <DashboardLayout walletAddress={walletAddress || ''} onDisconnect={handleDisconnect}>
        <div className="space-y-6">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-64 mb-6"></div>
            <div className="h-12 bg-muted rounded mb-4"></div>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded mb-4"></div>
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
            <FileText className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Transactions</h1>
              <p className="text-sm text-muted-foreground">
                Complete transaction history with risk labeling
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <Card className="bg-card border-border p-6 shadow-lg">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="h-4 w-4" />
            <h3 className="text-sm font-medium">Filters</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Transaction Type</label>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Transactions</SelectItem>
                  <SelectItem value="received">Received</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="token_received">Token Received</SelectItem>
                  <SelectItem value="token_sent">Token Sent</SelectItem>
                  <SelectItem value="trade">Trade</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by hash or token symbol..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Transactions List */}
        {error ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : filteredTransactions.length === 0 ? (
          <Card className="bg-card border-border p-12 shadow-lg text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {searchQuery || filter !== 'all' ? 'No transactions found' : 'No transactions yet'}
            </h3>
            <p className="text-muted-foreground">
              {searchQuery || filter !== 'all'
                ? 'Try adjusting your filters or search terms'
                : 'Transaction history will appear here once you have activity'
              }
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredTransactions.map((transaction, index) => (
              <Card
                key={`${transaction.hash}-${index}`}
                className="bg-card border-border p-6 shadow-lg hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="mt-1">
                      {getTransactionIcon(transaction.type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className={`font-medium text-foreground ${getTransactionTypeColor(transaction.type)}`}>
                          {transaction.type === 'received' && 'Received'}
                          {transaction.type === 'sent' && 'Sent'}
                          {transaction.type === 'token_received' && `Received ${transaction.tokenSymbol}`}
                          {transaction.type === 'token_sent' && `Sent ${transaction.tokenSymbol}`}
                          {transaction.type === 'trade' && 'Trade'}
                        </h4>

                        {transaction.tokenSymbol && (
                          <Badge variant="outline" className="text-xs">
                            {transaction.tokenSymbol}
                          </Badge>
                        )}

                        {transaction.isSuspicious && (
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Suspicious
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">From:</span>
                          <div className="font-mono text-foreground">
                            {formatAddress(transaction.from)}
                          </div>
                        </div>

                        <div>
                          <span className="text-muted-foreground">To:</span>
                          <div className="font-mono text-foreground">
                            {formatAddress(transaction.to)}
                          </div>
                        </div>

                        <div>
                          <span className="text-muted-foreground">Value:</span>
                          <div className={`font-medium ${transaction.type.includes('received') ? 'text-green-600' : 'text-red-600'}`}>
                            {transaction.tokenSymbol === 'ETH'
                              ? `${formatValue(transaction.value)} ETH`
                              : `${formatValue(transaction.value)} ${transaction.tokenSymbol}`
                            }
                            <span className="ml-2 text-sm text-gray-600">
                              (${transaction.valueUSD ?
                                transaction.valueUSD.toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2
                                }) :
                                '0.00'
                              })
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 text-xs text-muted-foreground">
                        <div>Hash: {formatAddress(transaction.hash)}</div>
                        <div className="mt-1">{formatDate(transaction.timestamp)}</div>
                      </div>

                      {transaction.riskNote && (
                        <div className="mt-2 p-2 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded text-xs text-orange-700 dark:text-orange-300">
                          <AlertTriangle className="inline h-3 w-3 mr-1" />
                          {transaction.riskNote}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`https://etherscan.io/tx/${transaction.hash}`, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Etherscan
                    </Button>

                    <div className="text-xs text-muted-foreground">
                    <div className="font-medium">Transaction Fee:</div>
                    <div>{formatGasFee(transaction.gasUsed, transaction.gasPrice)} ETH (${(parseFloat(formatGasFee(transaction.gasUsed, transaction.gasPrice)) * (transaction.valueUSD / parseFloat(transaction.value))).toFixed(2)})</div>
                    <div className="mt-2 font-medium">Gas Price:</div>
                    <div>{formatGasPrice(transaction.gasPrice)} Gwei ({(parseFloat(transaction.gasPrice) / Math.pow(10, 18)).toFixed(18).replace(/0+$/, '')} ETH)</div>
                  </div>
                  </div>
                </div>
              </Card>
            ))}

            {/* ⚡ LOAD MORE BUTTON */}
            {hasMore && filteredTransactions.length > 0 && (
              <div className="flex justify-center mt-6">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="min-w-32"
                >
                  {loadingMore ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Load More Transactions
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Transaction count indicator */}
            {!loading && transactions.length > 0 && (
              <div className="text-center mt-4 text-sm text-muted-foreground">
                Showing {filteredTransactions.length} of {transactions.length} transactions
                {hasMore && ` (Page ${currentPage})`}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
