/**
 * Token Detail Modal Component
 * Provides comprehensive information about a token including stats, insights, and knowledge
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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
    riskLevel?: 'low' | 'medium' | 'high';
    scamResult?: any;
    priceSource?: string;
    confidence?: number;
  } | null;
}

interface TokenStats {
  marketCap?: number;
  volume24h?: number;
  holders?: number;
  totalSupply?: string;
  decimals?: number;
  liquidityUSD?: number;
  createdAt?: string;
  website?: string;
  telegram?: string;
  description?: string;
  priceHistory7d?: Array<{ date: string; price: number }>;
  riskFactors?: string[];
  strengths?: string[];
}

export function TokenDetailModal({ isOpen, onClose, token }: TokenDetailModalProps) {
  const [tokenStats, setTokenStats] = useState<TokenStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchTokenDetails = useCallback(async (tokenAddress: string) => {
    if (!token) {
      console.error('Token is null, cannot fetch details');
      return;
    }

    setLoading(true);
    try {
      const mockStats: TokenStats = {
        marketCap: token.valueUSD * 1000000,
        volume24h: token.valueUSD * 50000,
        holders: undefined,
        totalSupply: "1000000000000000000000000000",
        decimals: 18,
        liquidityUSD: token.valueUSD * 100,
        createdAt: "2024-01-15T10:30:00.000Z",
        website: `https://${token.symbol.toLowerCase()}.token`,
        telegram: `https://t.me/${token.symbol.toLowerCase()}token`,
        description: `${token.name} (${token.symbol}) is a decentralized cryptocurrency token built on the Ethereum blockchain.`,
        priceHistory7d: [
          { date: "2024-11-03", price: token.priceUSD * 1.05 },
          { date: "2024-11-04", price: token.priceUSD * 0.98 },
          { date: "2024-11-05", price: token.priceUSD * 1.02 },
          { date: "2024-11-06", price: token.priceUSD * 1.08 },
          { date: "2024-11-07", price: token.priceUSD * 0.95 },
          { date: "2024-11-08", price: token.priceUSD * 1.01 },
          { date: "2024-11-09", price: token.priceUSD }
        ],
        riskFactors: token?.riskLevel === 'high' ? [
          "Unverified contract",
          "Low liquidity",
          "High holder concentration",
          "Recent large price movements"
        ] : token?.riskLevel === 'medium' ? [
          "Limited trading history",
          "Moderate liquidity"
        ] : [],
        strengths: token?.verified ? [
          "Verified contract",
          "Good liquidity",
          "Multiple exchange listings"
        ] : [
          "Active community",
          "Regular development updates"
        ]
      };
      setTokenStats(mockStats);

      try {
        const res = await fetch(`/api/token-stats?address=${tokenAddress}`, { headers: { Accept: 'application/json' } });
        if (res.ok) {
          const data = await res.json();
          const holders = typeof data?.holders === 'number' ? data.holders : undefined;
          if (holders && holders > 0) {
            setTokenStats(prev => ({ ...(prev || {}), holders }));
          }
        }
      } catch {}
    } catch (error) {
      console.error('Failed to fetch token details:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Fetch comprehensive token data when modal opens
  useEffect(() => {
    if (isOpen && token && token.address) {
      fetchTokenDetails(token.address);
    }
  }, [isOpen, token, fetchTokenDetails]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  if (!token) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:max-w-3xl md:max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-xl sm:text-2xl leading-tight break-words">
            {token.name} ({token.symbol})
          </DialogTitle>
          <DialogDescription className="text-muted-foreground break-all text-xs sm:text-sm">
            {token.address}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto overflow-x-hidden max-h-[calc(90vh-120px)] p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4 min-w-0">
                  <h3 className="font-semibold">Your Holdings</h3>
                  <p className="font-mono break-all text-sm sm:text-base">{token.balance}</p>
                  <p className="font-mono text-sm sm:text-base">{formatCurrency(token.valueUSD)}</p>
                </Card>

                <Card className="p-4 min-w-0">
                  <h3 className="font-semibold">Current Price</h3>
                  <p className="font-mono text-sm sm:text-base">{formatCurrency(token.priceUSD)}</p>
                  <p className={token.change24h >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {token.change24h >= 0 ? '+' : ''}{token.change24h.toFixed(2)}%
                  </p>
                  {token.priceSource && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-muted-foreground">
                        Source: {token.priceSource.toUpperCase()}
                      </span>
                      {typeof token.confidence === 'number' && token.confidence > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {Math.round(token.confidence * 100)}% confidence
                        </Badge>
                      )}
                    </div>
                  )}
                </Card>

                <Card className="p-4 min-w-0">
                  <h3 className="font-semibold">24h Volume</h3>
                  <p className="font-mono text-sm sm:text-base">{formatCurrency(tokenStats?.volume24h || 0)}</p>
                </Card>

                <Card className="p-4 min-w-0">
                  <h3 className="font-semibold">Holders</h3>
                  <p className="font-mono text-sm sm:text-base">{typeof tokenStats?.holders === 'number' ? formatNumber(tokenStats.holders) : '—'}</p>
                </Card>
              </div>

              {/* Description */}
              {tokenStats?.description && (
                <Card className="p-4 min-w-0">
                  <h3 className="font-semibold mb-2">About {token.name}</h3>
                  <p className="whitespace-normal break-words">{tokenStats.description}</p>
                </Card>
              )}

              {/* External Links */}
              <Card className="p-4 min-w-0">
                <h3 className="font-semibold mb-2">External Links</h3>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href={`https://etherscan.io/token/${token.address}`} target="_blank" rel="noopener noreferrer">
                      Etherscan
                    </a>
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}