/**
 * Enhanced Portfolio Overview with AI Integration
 * Combines traditional portfolio data with AI-powered insights
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Brain,
  Shield,
  AlertTriangle,
  RefreshCw,
  Zap
} from "lucide-react";

import { WalletAPI } from "@/lib/api/wallet";
import { ScamDetectionEngine } from "@/lib/ai/scam/scamEngine";
import type { ScamDetectionResult } from "@/lib/ai/scam/scamEngine";
import { useCurrencyFormatter } from "@/hooks/use-currency-formatter";
import { useTranslation } from "@/hooks/use-translation";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { TokenDetailModal } from "./token-detail-modal";
// price cache removed due to unused reference

// Import types

interface SentimentAnalysisResult {
  marketSummary: {
    aggregatedIndex: number;
    label: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    confidence: number;
    topInfluencers: unknown[];
    topEntities: unknown[];
  };
  articles: unknown[];
  predictions: {
    shortTermTrend: 'bullish' | 'bearish' | 'neutral';
    confidence: number;
    reasoning: string;
  };
}

interface WhaleMovementResult {
  events: unknown[];
  summary: {
    totalEvents: number;
    exchangeInflows: number;
    exchangeOutflows: number;
    avgImpact: number;
  };
  correlations: unknown[];
}

interface TokenPosition {
  symbol: string;
  name: string;
  balance: string;
  valueUSD: number;
  priceUSD: number;
  change24h: number;
  address: string;
  verified: boolean;
  hasNoPriceData?: boolean; // New field to track tokens with no pricing
  priceSource?: string;
  confidence?: number;
}

interface PortfolioData {
  totalValueUSD: number;
  ethBalance: number;
  ethValueUSD: number;
  totalChange24h: number;
  tokens: TokenPosition[];
  verifiedCount: number;
  unverifiedCount: number;
  flaggedCount: number;
}

interface AIInsights {
  scamAnalysis: unknown[];
  sentimentAnalysis: SentimentAnalysisResult;
  whaleMovements: WhaleMovementResult;
  marketOutlook: {
    trend: 'bullish' | 'neutral' | 'bearish';
    confidence: number;
    keyFactors: string[];
    recommendation: string;
  };
}

type ScamRiskLevel = 'low' | 'medium' | 'high' | 'critical';
type AnalyzedToken = TokenPosition & {
  scamResult: ScamDetectionResult | null;
  riskLevel: ScamRiskLevel;
  verified: boolean;
  hasWarning?: boolean;
  immediateFlag?: boolean;
  analysisError?: string;
};

// Cache to store portfolio data and prevent re-fetching when switching tabs
const portfolioCache = new Map<string, { data: PortfolioData | null; timestamp: number }>();
const CACHE_DURATION = 30000; // 30 seconds cache

export function EnhancedOverview({ walletAddress }: { walletAddress: string }) {
  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null);
  const [aiInsights, setAIInsights] = useState<AIInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshingAI, setRefreshingAI] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedToken, setSelectedToken] = useState<TokenPosition | null>(null);
  const [showTokenModal, setShowTokenModal] = useState(false);

  // Analysis progress states - real-time tracking
  const [isAnalyzingTokens, setIsAnalyzingTokens] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState({
    current: 0,
    total: 0,
    stage: 'idle' as 'idle' | 'fetching' | 'complete',
    message: '',
    startTime: 0,
    tokensAnalyzed: 0
  });

  const { formatCurrency, getCurrencySymbol } = useCurrencyFormatter();
  const { t } = useTranslation();

  
  // Load portfolio data and AI insights together with improved error handling
  const loadRealPortfolioData = useCallback(async (signal?: AbortSignal) => {
    try {
      
      setLoading(true);
      console.log('🚀 Loading real portfolio data for wallet:', walletAddress);
      const startTime = Date.now();
      setAnalysisProgress({ current: 0, total: 0, stage: 'fetching', message: 'Fetching wallet data...', startTime: Date.now(), tokensAnalyzed: 0 });
      setIsAnalyzingTokens(true);
      const transformedPortfolioData: PortfolioData = {
        totalValueUSD: 0,
        ethBalance: 0,
        ethValueUSD: 0,
        totalChange24h: 0,
        tokens: [],
        verifiedCount: 0,
        unverifiedCount: 0,
        flaggedCount: 0
      };
      let clientTokens = await WalletAPI.getPortfolioTokens(walletAddress);
      if (!Array.isArray(clientTokens)) clientTokens = [];

      // Always try to fetch from multiple sources to get comprehensive token data
      try {
        console.log('🔄 Fetching tokens from multiple sources for comprehensive data...');
        const [covalent, zapper, debank, fast] = await Promise.allSettled([
          WalletAPI.getAllTokensCovalent(walletAddress),
          WalletAPI.getAllTokensZapper(walletAddress),
          WalletAPI.getAllTokensDebank(walletAddress),
          WalletAPI.fetchTopTokensOnlyFast(walletAddress)
        ]);

        const mergeArr: ClientToken[] = [];

        // Always merge results from all successful sources
        if (covalent.status === 'fulfilled' && Array.isArray(covalent.value)) {
          console.log(`✅ Covalent returned ${covalent.value.length} tokens`);
          mergeArr.push(...covalent.value);
        }
        if (zapper.status === 'fulfilled' && Array.isArray(zapper.value)) {
          console.log(`✅ Zapper returned ${zapper.value.length} tokens`);
          mergeArr.push(...zapper.value);
        }
        if (debank.status === 'fulfilled' && Array.isArray(debank.value)) {
          console.log(`✅ Debank returned ${debank.value.length} tokens`);
          mergeArr.push(...debank.value);
        }
        if (fast.status === 'fulfilled' && Array.isArray(fast.value)) {
          console.log(`✅ Fast returned ${fast.value.length} tokens`);
          mergeArr.push(...fast.value);
        }

        // If we got additional tokens from other sources, merge them
        if (mergeArr.length > 0) {
          console.log(`📊 Total tokens before merge: ${clientTokens.length}, Additional tokens: ${mergeArr.length}`);

          // Create a map for deduplication
          const tokenMap = new Map<string, ClientToken>();

          // Add existing tokens first
          clientTokens.forEach(token => {
            const key = token.address?.toLowerCase() || `${token.symbol?.toLowerCase()}_eth`;
            tokenMap.set(key, token);
          });

          // Add/overwrite with new tokens if they have better data
          mergeArr.forEach(token => {
            const key = token.address?.toLowerCase() || `${token.symbol?.toLowerCase()}_eth`;
            const existing = tokenMap.get(key);

            // Prefer token with price data or higher value
            if (!existing ||
                (token.priceUSD && token.priceUSD > 0 && (!existing.priceUSD || existing.priceUSD === 0)) ||
                (token.valueUSD && token.valueUSD > 0 && (!existing.valueUSD || existing.valueUSD === 0))) {
              tokenMap.set(key, token);
            }
          });

          clientTokens = Array.from(tokenMap.values());
          console.log(`✅ Final merged token count: ${clientTokens.length}`);
        }
      } catch (error) {
        console.error('❌ Error fetching from multiple sources:', error);
      }
      type ClientToken = { symbol?: string; name?: string; balance?: string | number; valueUSD?: number; priceUSD?: number; address?: string; verified?: boolean; change24h?: number; hasNoPriceData?: boolean; decimals?: number; totalSupply?: string; holderCount?: number; liquidityUSD?: number; ageDays?: number; sourceCode?: string; bytecode?: string };

      console.log('📋 Processing ALL client tokens without filtering:', clientTokens.length);

      // Process ALL tokens without any filtering - show everything
      const allTokensList: TokenPosition[] = (clientTokens || []).map((t: ClientToken) => {
          const balanceNum = parseFloat((t.balance ?? '0').toString());
          let priceUSDNum = typeof t.priceUSD === 'number' ? t.priceUSD : 0;
          const valueUSDNum = typeof t.valueUSD === 'number' ? t.valueUSD : balanceNum * priceUSDNum;

          // Calculate price if missing but value exists
          if ((priceUSDNum === 0 || !isFinite(priceUSDNum)) && valueUSDNum > 0 && balanceNum > 0) {
            priceUSDNum = valueUSDNum / balanceNum;
          }

          const token = {
            symbol: t.symbol || 'UNKNOWN',
            name: t.name || t.symbol || 'Unknown Token',
            balance: balanceNum.toString(),
            valueUSD: Math.round(valueUSDNum * 100) / 100,
            priceUSD: priceUSDNum,
            address: t.address || '',
            verified: t.verified === true,
            change24h: t.change24h || 0,
            hasNoPriceData: !!t.hasNoPriceData || (priceUSDNum === 0 && valueUSDNum === 0)
          };

          // Log every single token for debugging
          console.log(`🪙 Processing token: ${token.symbol} - Balance: ${token.balance} - Value: $${token.valueUSD} - Address: ${token.address || 'N/A'}`);

          return token;
        });

      console.log(`✅ Processed ALL ${allTokensList.length} tokens (including zero balance tokens)`);
      let ethRow: TokenPosition | null = null;
      try { const wei = await fetchETHBalance(walletAddress); const ethBal = parseFloat(wei) / Math.pow(10, 18); const ethPrice = await WalletAPI.fetchETHPrice(); ethRow = { symbol: 'ETH', name: 'Ethereum', balance: ethBal.toFixed(6), valueUSD: Math.round(ethBal * ethPrice * 100) / 100, priceUSD: ethPrice, address: '0x0000000000000000000000000000000000000000', verified: true, change24h: 0, hasNoPriceData: false }; } catch {}
      const hasETHFast = allTokensList.some(t => (t.symbol || '').toUpperCase() === 'ETH');
      const finalTokensRaw = hasETHFast ? allTokensList : (ethRow ? [ethRow, ...allTokensList] : allTokensList);
      const dedupMap = new Map<string, TokenPosition>();
      for (const t of finalTokensRaw) {
        const addr = (t.address || '').toLowerCase();
        const sym = (t.symbol || '').toLowerCase();
        const key = addr && addr.length > 0 ? addr : sym;
        if (!key) continue;
        if (!dedupMap.has(key)) dedupMap.set(key, t);
      }
      const sanitized = Array.from(dedupMap.values()).map((t) => {
        const price = typeof t.priceUSD === 'number' ? t.priceUSD : 0;
        const val = typeof t.valueUSD === 'number' ? t.valueUSD : 0;
        const isUnverified = t.verified === false;
        const lowConfidence = typeof t.confidence === 'number' ? t.confidence < 0.6 : true;
        const isDex = (t.priceSource || '').toLowerCase() === 'dexscreener';
        const veryHighPrice = price > 10000;
        const hugeVal = val > 100_000_000;
        const unrealistic = ((veryHighPrice || hugeVal) && isUnverified && (lowConfidence || isDex)) || (isDex && lowConfidence && val > 5_000_000);
        if (unrealistic) {
          return { ...t, priceUSD: 0, valueUSD: 0, hasNoPriceData: true };
        }
        return t;
      });
      const finalTokens = sanitized
        .sort((a, b) => (b.valueUSD || 0) - (a.valueUSD || 0)); // Sort by Value (USD) Descending

      console.log('📊 Final tokens ready to display:', finalTokens.length);
      console.log(`💰 Total portfolio value before final aggregation: $${finalTokens.reduce((sum, t) => sum + (t.valueUSD || 0), 0).toFixed(2)}`);

      // Log summary by token type
      const tokenSummary = {
        total: finalTokens.length,
        withValue: finalTokens.filter(t => t.valueUSD > 0).length,
        zeroBalance: finalTokens.filter(t => parseFloat(t.balance) === 0).length,
        noPrice: finalTokens.filter(t => t.hasNoPriceData).length,
        verified: finalTokens.filter(t => t.verified).length
      };
      console.log('📈 Token Summary:', tokenSummary);

      transformedPortfolioData.tokens = finalTokens;
      transformedPortfolioData.verifiedCount = finalTokens ? finalTokens.filter(t => t.verified).length : 0;
      transformedPortfolioData.unverifiedCount = finalTokens ? finalTokens.filter(t => !t.verified).length : 0;
      transformedPortfolioData.flaggedCount = finalTokens ? finalTokens.filter(t => t.hasNoPriceData).length : 0;
      const instantTotal = finalTokens.reduce((sum, t) => sum + (typeof t.valueUSD === 'number' ? t.valueUSD : 0), 0);
      transformedPortfolioData.totalValueUSD = Math.round(instantTotal * 100) / 100;
      if (ethRow) { transformedPortfolioData.ethBalance = parseFloat(ethRow.balance); transformedPortfolioData.ethValueUSD = ethRow.valueUSD; }
      setPortfolioData(transformedPortfolioData);
      // Save to cache for faster tab switching
      portfolioCache.set(walletAddress, { data: transformedPortfolioData, timestamp: Date.now() });
      setError(null);
      const loadTime = Date.now() - startTime;
      console.log('⚡ ULTRA-FAST: Basic portfolio displayed in', loadTime, 'ms');
      setIsAnalyzingTokens(false);
      setLoading(false);
      
      if (loadTime < 500) { console.log('🚀 EXCELLENT: Loading completed under 500ms!'); } else if (loadTime < 1000) { console.log('✅ GOOD: Loading completed under 1 second'); }
      console.log('🧠 Starting comprehensive AI analysis...');
      const analysisResult = (await WalletAPI.analyzeWallet(walletAddress, '24h', signal)) as {
        success: boolean;
        error?: string;
        data?: {
          sentiment?: SentimentAnalysisResult;
          whale?: WhaleMovementResult;
          portfolio?: { tokens: TokenPosition[] };
        };
      };
      if (!analysisResult.success) { console.warn('Analysis API returned failure, continuing with client-side data:', analysisResult.error); }
      const sentimentResults = analysisResult.data?.sentiment as SentimentAnalysisResult | undefined;
      const whaleResults = analysisResult.data?.whale as WhaleMovementResult | undefined;
      const defaultSentiment: SentimentAnalysisResult = {
        marketSummary: { aggregatedIndex: 0, label: 'NEUTRAL', confidence: 0, topInfluencers: [], topEntities: [] },
        articles: [],
        predictions: { shortTermTrend: 'neutral', confidence: 0, reasoning: '' }
      };
      const defaultWhale: WhaleMovementResult = {
        events: [],
        summary: { totalEvents: 0, exchangeInflows: 0, exchangeOutflows: 0, avgImpact: 0 },
        correlations: []
      };
      setAIInsights({ scamAnalysis: [], sentimentAnalysis: sentimentResults ?? defaultSentiment, whaleMovements: whaleResults ?? defaultWhale, marketOutlook: generateMarketOutlook(sentimentResults ?? defaultSentiment, whaleResults ?? defaultWhale) });
      const scamResults: ScamDetectionResult[] = [];
      const mediumRiskTokens: AnalyzedToken[] = [];
      const highRiskTokens: AnalyzedToken[] = [];
      if (false) { // DISABLED - Skip scam analysis to show all tokens
        console.log('🔍 Running comprehensive scam analysis on portfolio tokens...');
        setAnalysisProgress(prev => ({ ...prev, current: 0, total: finalTokens.length, stage: 'complete', message: `Analysis complete` }));
        let tokensAnalyzed = 0;
        const engine = new ScamDetectionEngine();
        const concurrency = 6;
        const tasks: Promise<void>[] = [];
        for (let i = 0; i < finalTokens.length; i++) {
          const token = finalTokens[i];
          const p = (async () => {
            try {
              const tokenName = (token.name || '').toLowerCase();
              const tokenSymbol = (token.symbol || '').toLowerCase();
              const OBVIOUS_SCAM_PATTERNS = [/visit\s+(website|site|link|url)\s+/, /claim\s+(rewards?|bonus|airdrop|free)\s+(at|from|on)/, /earn\s+(rewards?|bonus|free)/, /website\s+(to|for)\s+claim/, /https?:\/\/\S+/, /www\.\S+/, /\.com\b/, /\.org\b/, /\.net\b/, /\.io\b/, /\.(xyz|app|finance|crypto|tech)\b/, /connect\s+wallet/, /approve\s+(now|token|contract)/, /urgent\s+(claim|action)/, /limited\s+time/, /act\s+now/];
              const isObviousScam = OBVIOUS_SCAM_PATTERNS.some(pattern => pattern.test(tokenName) || pattern.test(tokenSymbol));
              if (isObviousScam) {
                highRiskTokens.push({ ...token, scamResult: { tokenAddress: token.address || '', symbol: token.symbol || 'UNKNOWN', score: 95, riskLevel: 'high', confidencePct: 95, reasons: ['Token name contains obvious scam/phishing pattern'], evidence: { suspiciousNamePattern: tokenName } }, riskLevel: 'high', verified: false, immediateFlag: true });
                return;
              }
              let scamResult = await engine.analyzeToken({ address: token.address || '', symbol: token.symbol || 'UNKNOWN', name: token.name || 'Unknown Token', decimals: ((): number => { const d = (token as { decimals?: number }).decimals; return typeof d === 'number' ? d : 18 })(), verified: token.verified !== false, valueUSD: typeof token.valueUSD === 'number' ? token.valueUSD : 0, balance: token.balance?.toString() || '0' }, walletAddress);
              const hasNoPriceData = token.hasNoPriceData || (typeof token.valueUSD === 'number' ? token.valueUSD : 0) === 0;
              const isUnverified = token.verified === false;
              if (hasNoPriceData && isUnverified && scamResult.riskLevel === 'low') {
                scamResult = {
                  ...scamResult,
                  riskLevel: 'medium',
                  score: Math.max(scamResult.score, 45),
                  reasons: [...(scamResult.reasons || []), 'Unverified with no price data']
                };
              }
              scamResults.push(scamResult);
              if (scamResult.riskLevel === 'high') {
                highRiskTokens.push({ ...token, scamResult, riskLevel: scamResult.riskLevel, verified: token.verified !== false });
              }
              else if (scamResult.riskLevel === 'medium') {
                mediumRiskTokens.push({ ...token, scamResult, riskLevel: scamResult.riskLevel, verified: token.verified !== false });
              }
              
            } catch (err) {
              const errorMessage = err instanceof Error ? err.message : 'Unknown error';
              highRiskTokens.push({ ...token, scamResult: null, riskLevel: 'high', verified: token.verified !== false, analysisError: errorMessage });
            } finally {
              tokensAnalyzed++;
              setAnalysisProgress(prev => ({ ...prev, current: tokensAnalyzed, message: `Analyzing ${token.symbol || 'UNKNOWN'} (${tokensAnalyzed}/${finalTokens.length})...`, tokensAnalyzed }));
            }
          })();
          tasks.push(p);
          if (tasks.length >= concurrency) {
            await Promise.all(tasks);
            tasks.length = 0;
          }
        }
        if (tasks.length > 0) {
          await Promise.all(tasks);
        }
      const totalTime = Date.now() - startTime;
      console.log(`✅ Analysis complete: ${tokensAnalyzed} tokens analyzed in ${totalTime}ms`);
      
        setAnalysisProgress(prev => ({ ...prev, current: tokensAnalyzed, total: tokensAnalyzed, stage: 'complete', message: `✅ Analysis complete! Found ${highRiskTokens.length} high-risk and ${mediumRiskTokens.length} medium-risk tokens` }));
        setTimeout(() => { setIsAnalyzingTokens(false); console.log('🎉 Progress indicator hidden - analysis fully complete'); }, 2000);
      } else { console.log('ℹ️ No tokens found to analyze'); setAnalysisProgress(prev => ({ ...prev, stage: 'complete', message: '✅ No tokens to analyze', current: 0, total: 0 })); setTimeout(() => { setIsAnalyzingTokens(false); }, 1000); }
      // Skip scam filtering - show ALL tokens
      // const serverTokens = ((analysisResult?.data?.portfolio?.tokens || []) as TokenPosition[]);
      // const removalKeys = new Set<string>();
      // for (const t of highRiskTokens.filter(x => x.immediateFlag || x.riskLevel === 'high' || x.riskLevel === 'critical')) {
      //   const sym = (t.symbol || '').toUpperCase();
      //   const addrRaw = (t.address || '').toLowerCase();
      //   const isEthSym = sym === 'ETH';
      //   const isEthAddr = addrRaw === '' || addrRaw === '0x0000000000000000000000000000000000000000' || addrRaw === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
      //   const key = isEthSym || isEthAddr ? 'eth' : (addrRaw || (t.symbol || '').toLowerCase());
      //   if (key && key !== 'eth') removalKeys.add(key);
      // }
      // const filteredFinal = finalTokens.filter((t: TokenPosition) => {
      //   const sym = (t.symbol || '').toUpperCase();
      //   const addrRaw = (t.address || '').toLowerCase();
      //   const isEthSym = sym === 'ETH';
      //   const isEthAddr = addrRaw === '' || addrRaw === '0x0000000000000000000000000000000000000000' || addrRaw === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
      //   const key = isEthSym || isEthAddr ? 'eth' : (addrRaw || (t.symbol || '').toLowerCase());
      //   return key ? !removalKeys.has(key) : true;
      // });
      // const filteredServer = serverTokens.filter((t: TokenPosition) => {
      //   const sym = (t.symbol || '').toUpperCase();
      //   const addrRaw = (t.address || '').toLowerCase();
      //   const isEthSym = sym === 'ETH';
      //   const isEthAddr = addrRaw === '' || addrRaw === '0x0000000000000000000000000000000000000000' || addrRaw === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
      //   const key = isEthSym || isEthAddr ? 'eth' : (addrRaw || (t.symbol || '').toLowerCase());
      //   return key ? !removalKeys.has(key) : true;
      // });
      // const mergedRaw = [...filteredFinal, ...filteredServer];

      // Use all tokens without filtering
      const mergedRaw = [...finalTokens];
      const mergedDedup = new Map<string, TokenPosition>();
      for (const t of mergedRaw) {
        const addr = (t.address || '').toLowerCase();
        const sym = (t.symbol || '').toLowerCase();
        const key = addr && addr.length > 0 ? addr : sym;
        if (!key) continue;
        if (!mergedDedup.has(key)) mergedDedup.set(key, t);
      }
      const merged = Array.from(mergedDedup.values());
      setPortfolioData({ ...transformedPortfolioData, tokens: merged });
      } catch (error) {
        console.error('Failed to load portfolio data:', error);
        setError('Failed to load portfolio data. Please try again.');
        setLoading(false);
      }
  }, [walletAddress]);

  useEffect(() => {
    if (!walletAddress) return;

    // Check cache first to prevent unnecessary re-fetches
    const cached = portfolioCache.get(walletAddress);
    const now = Date.now();

    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      console.log('⚡ Using cached portfolio data for faster navigation');
      setPortfolioData(cached.data);
      setLoading(false);
      return;
    }

    let mounted = true;
    const controller = new AbortController();
    const safeLoadData = async () => {
      try {
        if (!mounted) return;
        await loadRealPortfolioData(controller.signal);
      } catch (error) {
        if (!mounted) return;
        console.error('Failed to load portfolio data:', error);
        setError('Failed to load portfolio data. Please try again.');
        setLoading(false);
      }
    };
    safeLoadData();
 return () => { mounted = false; controller.abort(); };
 }, [walletAddress, loadRealPortfolioData]);



  // Load AI insights separately (for refresh button)
  const loadAIInsights = async () => {
    if (!walletAddress) return;

    const startTime = Date.now();

    try {
      setRefreshingAI(true);
      console.log('🔄 Refreshing AI insights for wallet:', walletAddress);

      // Call the same API to refresh data
      const analysisResult = (await WalletAPI.analyzeWallet(walletAddress, '24h')) as {
        success: boolean;
        error?: string;
        data?: {
          sentiment?: SentimentAnalysisResult;
          whale?: WhaleMovementResult;
          portfolio?: { tokens: TokenPosition[] };
        };
      };

      if (analysisResult.success && analysisResult.data) {
        const fallbackSentimentResults = analysisResult.data.sentiment as SentimentAnalysisResult | undefined;
        const fallbackWhaleResults = analysisResult.data.whale as WhaleMovementResult | undefined;
        const defaultSentiment: SentimentAnalysisResult = {
          marketSummary: { aggregatedIndex: 0, label: 'NEUTRAL', confidence: 0, topInfluencers: [], topEntities: [] },
          articles: [],
          predictions: { shortTermTrend: 'neutral', confidence: 0, reasoning: '' }
        };
        const defaultWhale: WhaleMovementResult = {
          events: [],
          summary: { totalEvents: 0, exchangeInflows: 0, exchangeOutflows: 0, avgImpact: 0 },
          correlations: []
        };
        setAIInsights({
          scamAnalysis: [],
          sentimentAnalysis: fallbackSentimentResults ?? defaultSentiment,
          whaleMovements: fallbackWhaleResults ?? defaultWhale,
          marketOutlook: generateMarketOutlook(
            fallbackSentimentResults ?? defaultSentiment,
            fallbackWhaleResults ?? defaultWhale
          )
        });
      }

      const totalTime = Date.now() - startTime;
      console.log('✅ AI insights refreshed successfully');
      console.log('⚡ TOTAL ANALYSIS TIME:', totalTime, 'ms');

      // ⚡ PERFORMANCE SUMMARY
      if (totalTime < 2000) {
        console.log('🚀 OUTSTANDING: Complete analysis under 2 seconds!');
      } else if (totalTime < 5000) {
        console.log('👍 EXCELLENT: Complete analysis under 5 seconds');
      } else {
        console.log('⚠️ SLOW: Analysis took', totalTime, 'ms - consider further optimization');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('❌ Failed to refresh AI insights:', message);
    } finally {
      setRefreshingAI(false);
    }
  };

  // Helper function to fetch ETH balance
  const fetchETHBalance = async (address: string): Promise<string> => {
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXTAUTH_URL || `http://localhost:${process.env.PORT || 3000}`);
      const response = await fetch(`${origin}/api/etherscan-proxy?chainid=1&module=account&action=balance&address=${address}`);
      const data = await response.json();
      return data.result || '0';
    } catch (error) {
      console.error('Failed to fetch ETH balance:', error);
      return '0';
    }
  };

  // Helper function to fetch ETH price
  

  
  // Add refresh function for AI insights
  

  const generateMarketOutlook = (
    sentiment: SentimentAnalysisResult | undefined,
    whale: WhaleMovementResult | undefined
  ) => {
    // Default values if sentiment/whale data is not available
    const sentimentScore = sentiment?.marketSummary?.aggregatedIndex ?? 0;
    
    const scamRisk = 0;

    let trend: 'bullish' | 'neutral' | 'bearish' = 'neutral';
    let confidence = 0.5;
    const keyFactors: string[] = [];

    if (sentimentScore > 0.2) {
      trend = 'bullish';
      confidence += 0.2;
      keyFactors.push("Positive market sentiment detected");
    } else if (sentimentScore < -0.2) {
      trend = 'bearish';
      confidence += 0.2;
      keyFactors.push("Negative market sentiment detected");
    }

    // Check whale movements if data is available
    if (whale?.summary) {
      if (whale.summary.exchangeInflows > whale.summary.exchangeOutflows) {
        if (trend !== 'bearish') {
          trend = 'bullish';
          confidence += 0.15;
        }
        keyFactors.push("Net whale accumulation observed");
      } else if (whale.summary.exchangeOutflows > whale.summary.exchangeInflows) {
        if (trend !== 'bullish') {
          trend = 'bearish';
          confidence += 0.15;
        }
        keyFactors.push("Net whale distribution observed");
      }
    }

    if (scamRisk > 0.3) {
      confidence -= 0.1;
      keyFactors.push("High proportion of risky tokens detected");
    }

    let recommendation = "";
    if (trend === 'bullish' && confidence > 0.6) {
      recommendation = "Market conditions appear favorable for holding positions. Consider strategic entries on dips.";
    } else if (trend === 'bearish' && confidence > 0.6) {
      recommendation = "Caution advised. Consider reducing exposure and implementing stop-loss strategies.";
    } else {
      recommendation = "Mixed signals detected. Maintain current positions and monitor for clearer directional indicators.";
    }

    return {
      trend,
      confidence: Math.max(0.3, Math.min(0.95, confidence)),
      keyFactors,
      recommendation
    };
  };

  // Handler for opening token details modal
  const handleTokenClick = (token: TokenPosition) => {
    setSelectedToken(token);
    setShowTokenModal(true);
  };

  const handleRefresh = async () => {
    if (walletAddress) {
      setRefreshingAI(true);
      await loadRealPortfolioData();
      await loadAIInsights();
      setRefreshingAI(false);
    }
  };

  // Enable auto-refresh (60s default for portfolio)
  useAutoRefresh(handleRefresh, !!walletAddress, 60);

  

  
  if (loading) {
    return (
      <div className="space-y-6">
        {/* Simple loading indicator - no spinner */}
        <Card className="bg-card border-border p-6 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 bg-primary rounded-full animate-pulse"></div>
            <div>
              <h3 className="font-semibold">{t('common.loading')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('portfolio.fetching')}
              </p>
            </div>
          </div>
        </Card>

        {/* Show skeleton cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="animate-pulse">
            <Card className="bg-card border-border p-6 shadow-lg h-32">
              <div className="h-4 bg-muted rounded w-24 mb-2"></div>
              <div className="h-8 bg-muted rounded w-32"></div>
            </Card>
          </div>
          <div className="animate-pulse" style={{ animationDelay: '100ms' }}>
            <Card className="bg-card border-border p-6 shadow-lg h-32">
              <div className="h-4 bg-muted rounded w-20 mb-2"></div>
              <div className="h-8 bg-muted rounded w-28"></div>
            </Card>
          </div>
          <div className="animate-pulse" style={{ animationDelay: '200ms' }}>
            <Card className="bg-card border-border p-6 shadow-lg h-32">
              <div className="h-4 bg-muted rounded w-32 mb-2"></div>
              <div className="h-8 bg-muted rounded w-36"></div>
            </Card>
          </div>
        </div>

        {/* Token table skeleton */}
        <div className="animate-pulse" style={{ animationDelay: '300ms' }}>
          <Card className="bg-card border-border p-6 shadow-lg h-64"></Card>
        </div>
      </div>
    );
  }

  if (!portfolioData) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          {error || "No portfolio data available"}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
      )}
      {/* AI Insights Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">{t('portfolio.analysis_title')}</h2>
          {aiInsights && (
            <Badge variant="secondary" className="text-xs">
              {t('portfolio.analysis_complete')}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={loadAIInsights}
                disabled={refreshingAI}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshingAI ? 'animate-spin' : ''}`} />
                {t('portfolio.refresh_ai')}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('portfolio.refresh_ai')}</p>
            </TooltipContent>
          </Tooltip>
          <Badge variant="outline" className="text-xs">
            ⚡ {t('portfolio.optimized')}
          </Badge>
        </div>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-card border-border p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">{t('portfolio.total_value')}</p>
              <p className="text-2xl font-bold text-foreground balance-amount">
                {portfolioData.totalValueUSD < 0.01
                  ? "~$0.00"
                  : formatCurrency(portfolioData.totalValueUSD)}
              </p>
              <p className={`text-sm change-24h ${portfolioData.totalChange24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {portfolioData.totalChange24h >= 0 ? '+' : ''}{portfolioData.totalChange24h.toFixed(2)}%
              </p>
            </div>
            <div className="text-3xl">💰</div>
          </div>
        </Card>

        <Card className="bg-card border-border p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">{t('portfolio.eth_balance')}</p>
              <p className="text-2xl font-bold text-foreground balance-amount">{typeof portfolioData.ethBalance === 'number' ? portfolioData.ethBalance.toFixed(4) : parseFloat(portfolioData.ethBalance || '0').toFixed(4)} ETH</p>
              <p className="text-sm text-muted-foreground usd-value">
                ≈ {typeof portfolioData.ethValueUSD === 'number'
                  ? formatCurrency(portfolioData.ethValueUSD)
                  : t('common.unavailable')}
              </p>
            </div>
            <div className="text-3xl">🟪</div>
          </div>
        </Card>

        <Card className="bg-card border-border p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">{t('portfolio.risk_assessment')}</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {portfolioData.verifiedCount} {t('common.safe')}
                  </Badge>
                  {portfolioData.flaggedCount > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {portfolioData.flaggedCount} {t('common.risky')}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="text-3xl">
              {portfolioData.flaggedCount > 0 ? '⚠️' : '🛡️'}
            </div>
          </div>
        </Card>
      </div>

      {/* AI Market Outlook */}
      {aiInsights && (
        <Card className="bg-card border-border p-6 shadow-lg">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">{t('portfolio.market_outlook')}</h3>
            <Badge variant={
              aiInsights.marketOutlook.trend === 'bullish' ? 'default' :
              aiInsights.marketOutlook.trend === 'bearish' ? 'destructive' : 'secondary'
            }>
              {aiInsights.marketOutlook.trend.toUpperCase()}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {Math.round(aiInsights.marketOutlook.confidence * 100)}% {t('whale.confidence')}
            </Badge>
          </div>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {aiInsights.marketOutlook.recommendation}
            </p>

            <div className="flex flex-wrap gap-2">
              {aiInsights.marketOutlook?.keyFactors && aiInsights.marketOutlook.keyFactors.length > 0 && aiInsights.marketOutlook.keyFactors.map((factor, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {factor}
                </Badge>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Token Positions Section */}
      <div className="space-y-4">
        {/* All Tokens (Safe + Medium Risk with Warnings) */}
        <Card className="bg-card border-border p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-600" />
            Token Positions
            <Badge variant="outline">{portfolioData?.tokens ? portfolioData.tokens.length : 0}</Badge>
            
          </h3>

          {/* Analysis Progress Indicator - REAL-TIME */}
          {isAnalyzingTokens && (
            <div className={`mb-4 p-3 rounded-lg border ${
              analysisProgress.stage === 'complete'
                ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
                : 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`${analysisProgress.stage === 'complete' ? '' : 'animate-pulse'}`}>
                  <Shield className={`h-4 w-4 ${
                    analysisProgress.stage === 'complete' ? 'text-green-600' : 'text-blue-600'
                  }`} />
                </div>
                <div className="flex-1">
                  <div className={`text-sm font-medium ${
                    analysisProgress.stage === 'complete'
                      ? 'text-green-800 dark:text-green-200'
                      : 'text-blue-800 dark:text-blue-200'
                  }`}>
                    {analysisProgress.message || (
                      analysisProgress.stage === 'complete'
                        ? '✅ Analysis complete!'
                        : `🔍 ${analysisProgress.stage === 'fetching' ? 'Fetching wallet data...' : 'Analyzing tokens for safety...'}`
                    )}
                  </div>
                  {analysisProgress.total > 0 && (
                    <div className={`text-xs mt-1 ${
                      analysisProgress.stage === 'complete'
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-blue-600 dark:text-blue-400'
                    }`}>
                      {analysisProgress.stage === 'complete'
                        ? `All ${analysisProgress.total} tokens analyzed successfully`
                        : `${analysisProgress.current} of ${analysisProgress.total} tokens analyzed (${Math.round((analysisProgress.current / analysisProgress.total) * 100)}%)`
                      }
                      {analysisProgress.stage !== 'complete' && analysisProgress.startTime > 0 && (
                        <span className="ml-2">
                          • ~${Math.round((Date.now() - analysisProgress.startTime) / 1000)}s elapsed
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {analysisProgress.stage !== 'complete' && analysisProgress.total > 0 && (
                <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-1.5 mt-2">
                  <div
                    className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${(analysisProgress.current / analysisProgress.total) * 100}%` }}
                  ></div>
                </div>
              )}
            </div>
          )}

          {isAnalyzingTokens && (!portfolioData?.tokens || portfolioData.tokens.length === 0) ? (
            // Initial loading skeleton
            <div className="space-y-3">
              <div className="text-center py-8">
                <div className="h-2 w-2 bg-blue-600 rounded-full animate-pulse mx-auto mb-4"></div>
                <div className="text-sm text-muted-foreground">
                  🔍 Analyzing your tokens for safety...
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  This may take a few moments
                </div>
              </div>
              {/* Token skeleton rows */}
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center space-x-4 p-4 border-b border-border">
                  <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 animate-pulse"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/6 animate-pulse"></div>
                  </div>
                  <div className="text-right space-y-2">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16 animate-pulse"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-12 animate-pulse"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : portfolioData?.tokens && Array.isArray(portfolioData.tokens) && portfolioData.tokens.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium">{t('table.token')}</th>
                    <th className="text-right py-3 px-4 text-muted-foreground font-medium">{t('table.price')} (<span className="usd-value">{getCurrencySymbol()}</span>)</th>
                    <th className="text-right py-3 px-4 text-muted-foreground font-medium">{t('table.amount')}</th>
                    <th className="text-right py-3 px-4 text-muted-foreground font-medium">{t('table.value')} (<span className="usd-value">{getCurrencySymbol()}</span>)</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolioData.tokens && Array.isArray(portfolioData.tokens) && portfolioData.tokens
                    // Show ALL tokens without any filtering
                    .map((token, index) => (
                      <tr key={index} className="border-b border-border">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => handleTokenClick(token)}
                                className="font-medium text-primary hover:underline hover:text-primary/80 transition-colors cursor-pointer"
                              >
                                {token.symbol}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{t('portfolio.view_token_details')}</p>
                            </TooltipContent>
                          </Tooltip>
                          {token.verified && (
                            <Badge variant="secondary" className="text-xs">{t('common.verified')}</Badge>
                          )}
                          {token.hasNoPriceData && (
                            <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300">
                              💰 {t('portfolio.no_price')}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="text-right py-3 px-4 usd-value">
                        {token.hasNoPriceData ? (
                          <span className="text-orange-600">{t('portfolio.price_unavailable')}</span>
                        ) : (
                          <span>
                            {formatCurrency(token.priceUSD)}
                            {token.priceSource && (
                              <span className="ml-2 text-xs text-muted-foreground">{token.priceSource}</span>
                            )}
                            {typeof token.confidence === 'number' && token.confidence > 0 && (
                              <span className="ml-1 text-xs text-muted-foreground">{Math.round(token.confidence * 100)}%</span>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="text-right py-3 px-4">{parseFloat(token.balance || '0').toFixed(6)}</td>
                      <td className="text-right py-3 px-4 font-medium">
                        <span className="usd-value">
                          {token.hasNoPriceData ? (
                            <span className="text-orange-600">{t('portfolio.value_unavailable')}</span>
                          ) : (
                            formatCurrency(token.valueUSD)
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-2">
                {t('portfolio.no_holdings')}
              </p>
              <p className="text-sm text-muted-foreground">
                {t('portfolio.try_different_wallet')}
              </p>
            </div>
          )}
        </Card>

        

        </div>

      {/* Token Detail Modal */}
      <TokenDetailModal
        isOpen={showTokenModal}
        onClose={() => {
          setShowTokenModal(false);
          setSelectedToken(null);
        }}
        token={selectedToken}
      />
    </div>
  );
}
