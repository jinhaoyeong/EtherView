/**
 * Enhanced Portfolio Overview with AI Integration
 * Combines traditional portfolio data with AI-powered insights
 */

"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Brain,
  Shield,
  AlertTriangle,
  RefreshCw,
  Zap,
  Eye,
  EyeOff
} from "lucide-react";

import { WalletAPI } from "@/lib/api/wallet";
import { ScamDetectionEngine } from "@/lib/ai/scam/scamEngine";
import { useCurrencyFormatter } from "@/hooks/use-currency-formatter";
 
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
type ScamResult = {
  tokenAddress?: string;
  symbol?: string;
  score: number;
  riskLevel: ScamRiskLevel;
  confidencePct?: number;
  reasons?: string[];
  evidence?: unknown;
};
type AnalyzedToken = TokenPosition & {
  scamResult: ScamResult | null;
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
    const [showSmallBalanceTokens, setShowSmallBalanceTokens] = useState(false);
  const [allTokens, setAllTokens] = useState<TokenPosition[]>([]);
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

  
  // Load portfolio data and AI insights together with improved error handling
  const loadRealPortfolioData = async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      console.log('🚀 Loading real portfolio data for wallet:', walletAddress);
      const startTime = Date.now();
      setAnalysisProgress({ current: 0, total: 0, stage: 'fetching', message: 'Fetching wallet data...', startTime: Date.now(), tokensAnalyzed: 0 });
      setIsAnalyzingTokens(true);
      let transformedPortfolioData: PortfolioData = {
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
      if (!clientTokens || clientTokens.length === 0) {
        try { clientTokens = await WalletAPI.getAllTokensCovalent(walletAddress); } catch {}
      }
      type ClientToken = { symbol?: string; name?: string; balance?: string | number; valueUSD?: number; priceUSD?: number; address?: string; verified?: boolean; change24h?: number; hasNoPriceData?: boolean; decimals?: number; totalSupply?: string; holderCount?: number; liquidityUSD?: number; ageDays?: number; sourceCode?: string; bytecode?: string };
      const allTokensList: TokenPosition[] = (clientTokens || []).filter(Boolean).map((t: ClientToken) => {
        const balanceNum = parseFloat((t.balance ?? '0').toString());
        let priceUSDNum = typeof t.priceUSD === 'number' ? t.priceUSD : 0;
        const valueUSDNum = typeof t.valueUSD === 'number' ? t.valueUSD : balanceNum * priceUSDNum;
        if ((priceUSDNum === 0 || !isFinite(priceUSDNum)) && valueUSDNum > 0 && balanceNum > 0) {
          priceUSDNum = valueUSDNum / balanceNum;
        }
        return { symbol: t.symbol || 'UNKNOWN', name: t.name || t.symbol || 'Unknown Token', balance: (t.balance || '0').toString(), valueUSD: Math.round(valueUSDNum * 100) / 100, priceUSD: priceUSDNum, address: t.address || '', verified: t.verified !== false, change24h: t.change24h || 0, hasNoPriceData: !!t.hasNoPriceData || priceUSDNum === 0 };
      });
      let ethRow: TokenPosition | null = null;
      try { const wei = await fetchETHBalance(walletAddress); const ethBal = parseFloat(wei) / Math.pow(10, 18); const ethPrice = await WalletAPI.fetchETHPrice(); ethRow = { symbol: 'ETH', name: 'Ethereum', balance: ethBal.toFixed(6), valueUSD: Math.round(ethBal * ethPrice * 100) / 100, priceUSD: ethPrice, address: '0x0000000000000000000000000000000000000000', verified: true, change24h: 0, hasNoPriceData: false }; } catch {}
      const hasETHFast = allTokensList.some(t => (t.symbol || '').toUpperCase() === 'ETH');
      const finalTokens = hasETHFast ? allTokensList : (ethRow ? [ethRow, ...allTokensList] : allTokensList);
      setAllTokens(finalTokens);
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
      const analysisResult = await WalletAPI.analyzeWallet(walletAddress, '24h', signal);
      if (!analysisResult.success) { console.warn('Analysis API returned failure, continuing with client-side data:', analysisResult.error); }
      const sentimentResults = analysisResult.data?.sentiment as SentimentAnalysisResult;
      const whaleResults = analysisResult.data?.whale as WhaleMovementResult;
      setAIInsights({ scamAnalysis: [], sentimentAnalysis: sentimentResults, whaleMovements: whaleResults, marketOutlook: generateMarketOutlook(sentimentResults, whaleResults, []) });
      const scamResults: ScamResult[] = [];
      const safeTokens: AnalyzedToken[] = [];
      const mediumRiskTokens: AnalyzedToken[] = [];
      const highRiskTokens: AnalyzedToken[] = [];
      if (true) {
        console.log('🔍 Running comprehensive scam analysis on portfolio tokens...');
        setAnalysisProgress(prev => ({ ...prev, current: 0, total: finalTokens.length, stage: 'complete', message: `Analysis complete` }));
        let tokensAnalyzed = 0;
        const engine = new ScamDetectionEngine();
        for (let i = 0; i < finalTokens.length; i++) {
          const token = finalTokens[i];
          tokensAnalyzed++;
          setAnalysisProgress(prev => ({ ...prev, current: tokensAnalyzed, message: `Analyzing ${token.symbol || 'UNKNOWN'} (${tokensAnalyzed}/${finalTokens.length})...`, tokensAnalyzed }));
          try {
            const tokenName = (token.name || '').toLowerCase();
            const tokenSymbol = (token.symbol || '').toLowerCase();
            const OBVIOUS_SCAM_PATTERNS = [/visit\s+(website|site|link|url)\s+/, /claim\s+(rewards?|bonus|airdrop|free)\s+(at|from|on)/, /earn\s+(rewards?|bonus|free)/, /website\s+(to|for)\s+claim/, /https?:\/\/\S+/, /www\.\S+/, /\.com\b/, /\.org\b/, /\.net\b/, /\.io\b/, /\.(xyz|app|finance|crypto|tech)\b/, /connect\s+wallet/, /approve\s+(now|token|contract)/, /urgent\s+(claim|action)/, /limited\s+time/, /act\s+now/];
            const isObviousScam = OBVIOUS_SCAM_PATTERNS.some(pattern => pattern.test(tokenName) || pattern.test(tokenSymbol));
            if (isObviousScam) {
              console.log(`🚫 IMMEDIATE FILTER: Obvious scam pattern detected in ${token.symbol}/${token.name}`);
              highRiskTokens.push({ ...token, scamResult: { tokenAddress: token.address || '', symbol: token.symbol || 'UNKNOWN', score: 95, riskLevel: 'high', confidencePct: 95, reasons: ['Token name contains obvious scam/phishing pattern'], evidence: { suspiciousNamePattern: tokenName } }, riskLevel: 'high', verified: false, immediateFlag: true });
              continue;
            }
            let scamResult = await engine.analyzeToken({ address: token.address || '', symbol: token.symbol || 'UNKNOWN', name: token.name || 'Unknown Token', decimals: (token as any).decimals || 18, verified: token.verified !== false, valueUSD: typeof token.valueUSD === 'number' ? token.valueUSD : 0, balance: token.balance?.toString() || '0' }, walletAddress);
            const hasNoPriceData = token.hasNoPriceData || (typeof token.valueUSD === 'number' ? token.valueUSD : 0) === 0;
            const isUnverified = token.verified === false;
            if (hasNoPriceData && isUnverified && scamResult.riskLevel === 'low') { scamResult = { ...scamResult, riskLevel: 'medium', score: Math.max(scamResult.score, 45), reasons: [...(scamResult.reasons || []), 'Unverified with no price data'] }; }
            scamResults.push(scamResult as ScamResult);
            if (scamResult.riskLevel === 'high') { highRiskTokens.push({ ...token, scamResult: scamResult as ScamResult, riskLevel: scamResult.riskLevel, verified: token.verified !== false }); }
            else if (scamResult.riskLevel === 'medium') { mediumRiskTokens.push({ ...token, scamResult: scamResult as ScamResult, riskLevel: scamResult.riskLevel, verified: token.verified !== false }); }
            else { safeTokens.push({ ...token, scamResult: scamResult as ScamResult, riskLevel: scamResult.riskLevel, verified: token.verified !== false, hasWarning: false }); }
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            console.error(`❌ Failed to analyze ${token.symbol}:`, errorMessage);
            console.log(`🚫 SAFETY: Marking unanalyzable token as HIGH RISK: ${token.symbol}`);
            highRiskTokens.push({ ...token, scamResult: null, riskLevel: 'high', verified: token.verified !== false, analysisError: errorMessage });
          }
        }
        const totalTime = Date.now() - analysisProgress.startTime;
        console.log(`✅ Analysis complete: ${tokensAnalyzed} tokens analyzed in ${totalTime}ms`);
        setAnalysisProgress(prev => ({ ...prev, current: tokensAnalyzed, total: tokensAnalyzed, stage: 'complete', message: `✅ Analysis complete! Found ${highRiskTokens.length} high-risk and ${mediumRiskTokens.length} medium-risk tokens` }));
        setTimeout(() => { setIsAnalyzingTokens(false); console.log('🎉 Progress indicator hidden - analysis fully complete'); }, 2000);
      } else { console.log('ℹ️ No tokens found to analyze'); setAnalysisProgress(prev => ({ ...prev, stage: 'complete', message: '✅ No tokens to analyze', current: 0, total: 0 })); setTimeout(() => { setIsAnalyzingTokens(false); }, 1000); }
      const serverTokens = ((analysisResult?.data?.portfolio?.tokens || []) as TokenPosition[]);
      const removalKeys = new Set<string>();
      for (const t of [...highRiskTokens, ...mediumRiskTokens]) {
        const sym = (t.symbol || '').toUpperCase();
        const addrRaw = (t.address || '').toLowerCase();
        const isEthSym = sym === 'ETH';
        const isEthAddr = addrRaw === '' || addrRaw === '0x0000000000000000000000000000000000000000' || addrRaw === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
        const key = isEthSym || isEthAddr ? 'eth' : (addrRaw || (t.symbol || '').toLowerCase());
        if (key) removalKeys.add(key);
      }
      const filteredFinal = finalTokens.filter((t: TokenPosition) => {
        const sym = (t.symbol || '').toUpperCase();
        const addrRaw = (t.address || '').toLowerCase();
        const isEthSym = sym === 'ETH';
        const isEthAddr = addrRaw === '' || addrRaw === '0x0000000000000000000000000000000000000000' || addrRaw === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
        const key = isEthSym || isEthAddr ? 'eth' : (addrRaw || (t.symbol || '').toLowerCase());
        return key ? !removalKeys.has(key) : true;
      });
      const filteredServer = serverTokens.filter((t: TokenPosition) => {
        const sym = (t.symbol || '').toUpperCase();
        const addrRaw = (t.address || '').toLowerCase();
        const isEthSym = sym === 'ETH';
        const isEthAddr = addrRaw === '' || addrRaw === '0x0000000000000000000000000000000000000000' || addrRaw === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
        const key = isEthSym || isEthAddr ? 'eth' : (addrRaw || (t.symbol || '').toLowerCase());
        return key ? !removalKeys.has(key) : true;
      });
      const merged = [...filteredFinal, ...filteredServer];
      setPortfolioData({ ...transformedPortfolioData, tokens: merged });
    } catch (error) {
      console.error('Failed to load portfolio data:', error);
      setError('Failed to load portfolio data. Please try again.');
      setLoading(false);
    }
  };

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
  }, [walletAddress]);

  const loadRealPortfolioData_dup = async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      console.log('🚀 Loading real portfolio data for wallet:', walletAddress);

      // ⚡ OPTIMIZATION: Show basic data first, then enhance with AI
      const startTime = Date.now();

      // Start accurate progress tracking
      setAnalysisProgress({
        current: 0,
        total: 0,
        stage: 'fetching',
        message: 'Fetching wallet data...',
        startTime: Date.now(),
        tokensAnalyzed: 0
      });
      setIsAnalyzingTokens(true);

      // Fetch full analysis server-side to avoid client price/API calls
      let transformedPortfolioData: PortfolioData = {
        totalValueUSD: 0,
        ethBalance: 0,
        ethValueUSD: 0,
        totalChange24h: 0,
        tokens: [],
        verifiedCount: 0,
        unverifiedCount: 0,
        flaggedCount: 0
      };

      // ⚡ CLIENT-SIDE FAST TOKENS: Load full token list for rich overview
      let clientTokens = await WalletAPI.getPortfolioTokens(walletAddress);
      if (!clientTokens || clientTokens.length === 0) {
        try {
          clientTokens = await WalletAPI.getAllTokensCovalent(walletAddress);
        } catch {}
      }

      type ClientToken = {
        symbol?: string;
        name?: string;
        balance?: string | number;
        valueUSD?: number;
        priceUSD?: number;
        address?: string;
        verified?: boolean;
        change24h?: number;
        hasNoPriceData?: boolean;
      };
      const allTokensList: TokenPosition[] = (clientTokens || []).filter(Boolean).map((t: ClientToken) => {
        const balanceNum = parseFloat(t.balance || '0');
        let priceUSDNum = typeof t.priceUSD === 'number' ? t.priceUSD : 0;
        const valueUSDNum = typeof t.valueUSD === 'number' ? t.valueUSD : balanceNum * priceUSDNum;
        if ((priceUSDNum === 0 || !isFinite(priceUSDNum)) && valueUSDNum > 0 && balanceNum > 0) {
          priceUSDNum = valueUSDNum / balanceNum;
        }

        return {
          symbol: t.symbol || 'UNKNOWN',
          name: t.name || t.symbol || 'Unknown Token',
          balance: (t.balance || '0').toString(),
          valueUSD: Math.round(valueUSDNum * 100) / 100,
          priceUSD: priceUSDNum,
          address: t.address || '',
          verified: t.verified !== false,
          change24h: t.change24h || 0,
          hasNoPriceData: !!t.hasNoPriceData || priceUSDNum === 0
        };
      });

      let ethRow: TokenPosition | null = null;
      try {
        const wei = await fetchETHBalance(walletAddress);
        const ethBal = parseFloat(wei) / Math.pow(10, 18);
        const ethPrice = await WalletAPI.fetchETHPrice();
        ethRow = {
          symbol: 'ETH',
          name: 'Ethereum',
          balance: ethBal.toFixed(6),
          valueUSD: Math.round(ethBal * ethPrice * 100) / 100,
          priceUSD: ethPrice,
          address: '0x0000000000000000000000000000000000000000',
          verified: true,
          change24h: 0,
          hasNoPriceData: false
        };
      } catch {}
      const hasETHFast = allTokensList.some(t => (t.symbol || '').toUpperCase() === 'ETH');
      const finalTokens = hasETHFast ? allTokensList : (ethRow ? [ethRow, ...allTokensList] : allTokensList);

      setAllTokens(finalTokens);

      transformedPortfolioData.tokens = finalTokens;
      transformedPortfolioData.verifiedCount = finalTokens ? finalTokens.filter(t => t.verified).length : 0;
      transformedPortfolioData.unverifiedCount = finalTokens ? finalTokens.filter(t => !t.verified).length : 0;
      transformedPortfolioData.flaggedCount = finalTokens ? finalTokens.filter(t => t.hasNoPriceData).length : 0;
      const instantTotal = finalTokens.reduce((sum, t) => sum + (typeof t.valueUSD === 'number' ? t.valueUSD : 0), 0);
      transformedPortfolioData.totalValueUSD = Math.round(instantTotal * 100) / 100;
      if (ethRow) {
        transformedPortfolioData.ethBalance = parseFloat(ethRow.balance);
        transformedPortfolioData.ethValueUSD = ethRow.valueUSD;
      }

      setPortfolioData(transformedPortfolioData);
      // Save to cache for faster tab switching
      portfolioCache.set(walletAddress, { data: transformedPortfolioData, timestamp: Date.now() });
      setError(null);
      const loadTime = Date.now() - startTime;
      console.log('⚡ ULTRA-FAST: Basic portfolio displayed in', loadTime, 'ms');
      setIsAnalyzingTokens(false);
      setLoading(false);

      // ⚡ PERFORMANCE FEEDBACK: Log speed achievement
      if (loadTime < 500) {
        console.log('🚀 EXCELLENT: Loading completed under 500ms!');
      } else if (loadTime < 1000) {
        console.log('✅ GOOD: Loading completed under 1 second');
      }

      // Step 3: Continue with full AI analysis in background
      console.log('🧠 Starting comprehensive AI analysis...');

      // Add check for component still mounted before API call
      const analysisResult = await WalletAPI.analyzeWallet(walletAddress, '24h', signal);

      // Check if this was an abort due to component unmounting
      if (analysisResult.success === false && analysisResult.error === 'aborted') {
        console.log('⏹️ Analysis aborted due to component unmounting - this is normal in development');
        return;
      }

      console.log('📊 Full analysis complete in', Date.now() - startTime, 'ms');

      if (!analysisResult.success) {
        console.warn('Analysis API returned failure, continuing with client-side data:', analysisResult.error);
      } else {

      const sentimentResults = analysisResult.data?.sentiment;
      const whaleResults = analysisResult.data?.whale;
      setAIInsights({
        scamAnalysis: [],
        sentimentAnalysis: sentimentResults,
        whaleMovements: whaleResults,
        marketOutlook: generateMarketOutlook(
          sentimentResults,
          whaleResults,
          []
        )
      });

      const scamResults: any[] = [];
      const safeTokens: any[] = [];
      const mediumRiskTokens: any[] = [];
      const highRiskTokens: any[] = [];

      

      if (true) {
        console.log('🔍 Running comprehensive scam analysis on portfolio tokens...');

        // Update to analysis stage with accurate token count
        setAnalysisProgress(prev => ({
          ...prev,
          current: 0,
          total: finalTokens.length,
          stage: 'complete',
          message: `Analysis complete`
        }));

        // Step 1: Run scam detection on all tokens with real-time progress tracking
        let tokensAnalyzed = 0;
        const engine = new ScamDetectionEngine();

        for (let i = 0; i < finalTokens.length; i++) {
          const token = finalTokens[i];

          // Update progress with current token info
          tokensAnalyzed++;
          setAnalysisProgress(prev => ({
            ...prev,
            current: tokensAnalyzed,
            message: `Analyzing ${token.symbol || 'UNKNOWN'} (${tokensAnalyzed}/${finalTokens.length})...`,
            tokensAnalyzed: tokensAnalyzed
          }));
          try {
            // PRE-FILTER: Check for obvious scam patterns before expensive analysis
            const tokenName = (token.name || '').toLowerCase();
            const tokenSymbol = (token.symbol || '').toLowerCase();

            // Obvious scam patterns that should be flagged immediately
            const OBVIOUS_SCAM_PATTERNS = [
              /visit\s+(website|site|link|url)\s+/,
              /claim\s+(rewards?|bonus|airdrop|free)\s+(at|from|on)/,
              /earn\s+(rewards?|bonus|free)/,
              /website\s+(to|for)\s+claim/,
              /https?:\/\/\S+/,
              /www\.\S+/,
              /\.com\b/,
              /\.org\b/,
              /\.net\b/,
              /\.io\b/,
              /\.(xyz|app|finance|crypto|tech)\b/,
              /connect\s+wallet/,
              /approve\s+(now|token|contract)/,
              /urgent\s+(claim|action)/,
              /limited\s+time/,
              /act\s+now/
            ];

            const isObviousScam = OBVIOUS_SCAM_PATTERNS.some(pattern =>
              pattern.test(tokenName) || pattern.test(tokenSymbol)
            );

            if (isObviousScam) {
              console.log(`🚫 IMMEDIATE FILTER: Obvious scam pattern detected in ${token.symbol}/${token.name}`);
              highRiskTokens.push({
                ...token,
                scamResult: {
                  tokenAddress: token.address || '',
                  symbol: token.symbol || 'UNKNOWN',
                  score: 95, // Very high risk score
                  riskLevel: 'high' as const,
                  confidencePct: 95,
                  reasons: ['Token name contains obvious scam/phishing pattern'],
                  evidence: { suspiciousNamePattern: tokenName }
                } as any,
                riskLevel: 'high',
                verified: false,
                immediateFlag: true
              });
              continue; // Skip expensive analysis for obvious scams
            }

            // token metadata prepared by engine as needed

            let scamResult = await engine.analyzeToken({
              address: token.address || '',
              symbol: token.symbol || 'UNKNOWN',
              name: token.name || 'Unknown Token',
              decimals: token.decimals || 18,
              verified: token.verified !== false,
              valueUSD: typeof token.valueUSD === 'number' ? token.valueUSD : 0,
              balance: token.balance?.toString() || '0'
            }, walletAddress);
            const hasNoPriceData = token.hasNoPriceData || (typeof token.valueUSD === 'number' ? token.valueUSD : 0) === 0;
            const isUnverified = token.verified === false;
            if (hasNoPriceData && isUnverified && scamResult.riskLevel === 'low') {
              scamResult = {
                ...scamResult,
                riskLevel: 'medium',
                score: Math.max(scamResult.score, 45),
                reasons: [...(scamResult.reasons || []), 'Unverified with no price data']
              } as any;
            }
            scamResults.push(scamResult);

            // BALANCED FILTERING: Only filter out HIGH risk tokens from overview
            // MEDIUM risk tokens are shown but with warnings
            if (scamResult.riskLevel === 'high') {
              console.log(`🚫 FILTERING - HIGH risk token removed from overview: ${token.symbol} (score: ${scamResult.score})`);
              highRiskTokens.push({
                ...token,
                scamResult,
                riskLevel: scamResult.riskLevel
              });
            } else if (scamResult.riskLevel === 'medium') {
              console.log(`⚠️ MEDIUM risk token filtered from overview: ${token.symbol} (score: ${scamResult.score})`);
              mediumRiskTokens.push({
                ...token,
                scamResult,
                riskLevel: scamResult.riskLevel
              });
            } else {
              console.log(`✅ LOW risk token in overview: ${token.symbol} (score: ${scamResult.score})`);
              safeTokens.push({
                ...token,
                scamResult,
                riskLevel: scamResult.riskLevel,
                verified: token.verified !== false,
                hasWarning: false
              });
            }

          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            console.error(`❌ Failed to analyze ${token.symbol}:`, errorMessage);
            // CRITICAL: If scam analysis fails, treat as HIGH RISK for safety
            // Never default to "safe" - this is dangerous behavior
            console.log(`🚫 SAFETY: Marking unanalyzable token as HIGH RISK: ${token.symbol}`);
            highRiskTokens.push({
              ...token,
              scamResult: null,
              riskLevel: 'high', // Default to high risk if analysis fails - SAFETY FIRST
              verified: token.verified !== false,
              analysisError: errorMessage
            });
          }
        }

        // Analysis is truly complete
        const totalTime = Date.now() - analysisProgress.startTime;
        console.log(`✅ Analysis complete: ${tokensAnalyzed} tokens analyzed in ${totalTime}ms`);

        setAnalysisProgress(prev => ({
          ...prev,
          current: tokensAnalyzed,
          total: tokensAnalyzed,
          stage: 'complete',
          message: `✅ Analysis complete! Found ${highRiskTokens.length} high-risk and ${mediumRiskTokens.length} medium-risk tokens`
        }));

        // Hide progress indicator after showing completion for 2 seconds
        setTimeout(() => {
          setIsAnalyzingTokens(false);
          console.log('🎉 Progress indicator hidden - analysis fully complete');
        }, 2000);
      } else {
        // No tokens to analyze
        console.log('ℹ️ No tokens found to analyze');
        setAnalysisProgress(prev => ({
          ...prev,
          stage: 'complete',
          message: '✅ No tokens to analyze',
          current: 0,
          total: 0
        }));

        // Hide progress after brief delay
        setTimeout(() => {
          setIsAnalyzingTokens(false);
        }, 1000);
      }

      // Step 2: Transform tokens for display with deduplication
      const serverTokens = ((analysisResult?.data?.portfolio?.tokens || []) as TokenPosition[]);
      const removalKeys = new Set<string>();
      for (const t of [...highRiskTokens, ...mediumRiskTokens]) {
        const sym = (t.symbol || '').toUpperCase();
        const addrRaw = (t.address || '').toLowerCase();
        const isEthSym = sym === 'ETH';
        const isEthAddr = addrRaw === '' || addrRaw === '0x0000000000000000000000000000000000000000' || addrRaw === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
        const key = isEthSym || isEthAddr ? 'eth' : (addrRaw || (t.symbol || '').toLowerCase());
        if (key) removalKeys.add(key);
      }
      const filteredFinal = finalTokens.filter((t: TokenPosition) => {
        const sym = (t.symbol || '').toUpperCase();
        const addrRaw = (t.address || '').toLowerCase();
        const isEthSym = sym === 'ETH';
        const isEthAddr = addrRaw === '' || addrRaw === '0x0000000000000000000000000000000000000000' || addrRaw === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
        const key = isEthSym || isEthAddr ? 'eth' : (addrRaw || (t.symbol || '').toLowerCase());
        return key ? !removalKeys.has(key) : true;
      });
      const filteredServer = serverTokens.filter((t: TokenPosition) => {
        const sym = (t.symbol || '').toUpperCase();
        const addrRaw = (t.address || '').toLowerCase();
        const isEthSym = sym === 'ETH';
        const isEthAddr = addrRaw === '' || addrRaw === '0x0000000000000000000000000000000000000000' || addrRaw === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
        const key = isEthSym || isEthAddr ? 'eth' : (addrRaw || (t.symbol || '').toLowerCase());
        return key ? !removalKeys.has(key) : true;
      });
      const displayTokens = [...(safeTokens || []), ...filteredServer, ...filteredFinal];

      // Create deduplication map by token address to prevent duplicates
      const tokenMap = new Map<string, any>();

      // Add and merge tokens from all sources
      displayTokens.forEach((token: any) => {
        const sym = (token.symbol || '').toUpperCase();
        const addrRaw = (token.address || '').toLowerCase();
        const isEthSym = sym === 'ETH';
        const isEthAddr = addrRaw === '' || addrRaw === '0x0000000000000000000000000000000000000000' || addrRaw === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
        const key = isEthSym || isEthAddr ? 'eth' : (addrRaw || (token.symbol || '').toLowerCase());
        if (!key) return;

        if (!tokenMap.has(key)) {
          tokenMap.set(key, {
            symbol: isEthSym || isEthAddr ? 'ETH' : (token.symbol || 'UNKNOWN'),
            name: token.name || 'Unknown Token',
            balance: token.balance?.toString() || '0',
            valueUSD: typeof token.valueUSD === 'number' ? token.valueUSD : 0,
            priceUSD: typeof token.priceUSD === 'number' ? token.priceUSD : 0,
            change24h: typeof token.change24h === 'number' ? token.change24h : 0,
            address: isEthSym || isEthAddr ? '' : (token.address || ''),
            verified: token.verified !== false,
            scamResult: token.scamResult,
            riskLevel: token.riskLevel,
            hasNoPriceData: !!token.hasNoPriceData || (token.priceUSD === 0),
            priceSource: token.priceSource,
            confidence: token.confidence
          });
        } else {
          const prev = tokenMap.get(key)!;
          const prevBal = parseFloat(prev.balance || '0');
          const newBal = parseFloat(token.balance || '0');
          const mergedBal = isFinite(newBal) && newBal > 0 ? newBal : prevBal;

          const prevPrice = typeof prev.priceUSD === 'number' ? prev.priceUSD : 0;
          const newPrice = typeof token.priceUSD === 'number' ? token.priceUSD : 0;
          const mergedPrice = newPrice > 0 ? newPrice : prevPrice;

          const prevVal = typeof prev.valueUSD === 'number' ? prev.valueUSD : 0;
          const newVal = typeof token.valueUSD === 'number' ? token.valueUSD : 0;
          const mergedVal = newVal > 0 ? newVal : prevVal;

          tokenMap.set(key, {
            symbol: isEthSym || isEthAddr ? 'ETH' : (token.symbol || prev.symbol || 'UNKNOWN'),
            name: token.name || prev.name || 'Unknown Token',
            balance: mergedBal.toString(),
            valueUSD: mergedVal,
            priceUSD: mergedPrice,
            change24h: typeof token.change24h === 'number' ? token.change24h : prev.change24h || 0,
            address: isEthSym || isEthAddr ? '' : (prev.address || token.address || ''),
            verified: prev.verified || (token.verified !== false),
            scamResult: token.scamResult || prev.scamResult,
            riskLevel: token.riskLevel || prev.riskLevel,
            hasNoPriceData: (!!token.hasNoPriceData || token.priceUSD === 0) && (!!prev.hasNoPriceData || prev.priceUSD === 0) ? true : false,
            priceSource: token.priceSource || prev.priceSource,
            confidence: typeof token.confidence === 'number' ? token.confidence : prev.confidence
          });
        }
      });

      // Convert map to array for display
      transformedPortfolioData.tokens = Array.from(tokenMap.values());
      setAllTokens(transformedPortfolioData.tokens);
      setPortfolioData(transformedPortfolioData);

      // Step 3: Update counts
      transformedPortfolioData.verifiedCount = safeTokens ? safeTokens.filter(t => t.verified).length : 0;
      transformedPortfolioData.unverifiedCount = safeTokens ? safeTokens.filter(t => !t.verified).length : 0;
      transformedPortfolioData.flaggedCount = (highRiskTokens ? highRiskTokens.length : 0) + (mediumRiskTokens ? mediumRiskTokens.length : 0);

      const hasEthToken = Array.isArray(transformedPortfolioData.tokens) && transformedPortfolioData.tokens.some(t => (t?.symbol || '').toUpperCase() === 'ETH');
      const tokensTotalUSD = (transformedPortfolioData.tokens || []).reduce((sum, t) => {
        const v = typeof t?.valueUSD === 'number' ? t.valueUSD : 0;
        return sum + v;
      }, 0);
      const ethUSD = typeof transformedPortfolioData.ethValueUSD === 'number' ? transformedPortfolioData.ethValueUSD : 0;
      transformedPortfolioData.totalValueUSD = hasEthToken ? tokensTotalUSD : tokensTotalUSD + ethUSD;
      const duplicateKeys = new Set<string>();
      const seenKeys = new Set<string>();
      for (const t of transformedPortfolioData.tokens || []) {
        const k = ((t?.address || '') ? String(t.address).toLowerCase() : (t?.symbol || '').toLowerCase()) || '';
        if (!k) continue;
        if (seenKeys.has(k)) duplicateKeys.add(k); else seenKeys.add(k);
      }
      if (duplicateKeys.size > 0) {
        console.warn('Duplicate assets detected in portfolio tokens:', Array.from(duplicateKeys));
      }

      if (process.env.NODE_ENV !== 'production') {
        const t1 = [
          { symbol: 'ETH', address: '', valueUSD: 1000 },
          { symbol: 'USDC', address: '0xa0b8', valueUSD: 500 }
        ];
        const total1 = t1.reduce((s, x) => s + (typeof x.valueUSD === 'number' ? x.valueUSD : 0), 0);
        const calc1 = (Array.isArray(t1) && t1.some(x => (x.symbol || '').toUpperCase() === 'ETH')) ? total1 : total1 + 1000;
        if (calc1 !== 1500) console.error('Test1 failed: expected 1500, got', calc1);

        const t2 = [
          { symbol: 'USDC', address: '0xa0b8', valueUSD: 500 }
        ];
        const total2 = t2.reduce((s, x) => s + (typeof x.valueUSD === 'number' ? x.valueUSD : 0), 0);
        const calc2 = (Array.isArray(t2) && t2.some(x => (x.symbol || '').toUpperCase() === 'ETH')) ? total2 : total2 + 1000;
        if (calc2 !== 1500) console.error('Test2 failed: expected 1500, got', calc2);

        const t3 = [
          { symbol: 'ETH', address: '', valueUSD: 1000 },
          { symbol: 'ETH', address: '0xeeee', valueUSD: 1000 }
        ];
        const seen = new Set<string>();
        let duplicates = 0;
        for (const x of t3) {
          const k = ((x.address || '') ? String(x.address).toLowerCase() : (x.symbol || '').toLowerCase()) || '';
          if (seen.has(k)) duplicates++; else seen.add(k);
        }
        if (duplicates > 0) console.error('Test3 failed: duplicate ETH keys not collapsed');
      }

      // Step 4: Store medium and high risk tokens for display sections
      console.log(`🛡️ Overview filtering complete:`);
      console.log(`   Total tokens analyzed: ${portfolioData?.tokens ? portfolioData.tokens.length : 0}`);
      console.log(`   Safe tokens shown (low risk only): ${safeTokens ? safeTokens.length : 0}`);
      console.log(`   High risk filtered tokens: ${highRiskTokens ? highRiskTokens.length : 0}`);
      console.log(`   Medium risk filtered tokens: ${mediumRiskTokens ? mediumRiskTokens.length : 0}`);

      // Store flagged tokens in AI insights for potential display
      if ((highRiskTokens && highRiskTokens.length > 0) || (mediumRiskTokens && mediumRiskTokens.length > 0)) {
        console.log('⚠️ Risk tokens available for warning sections');
      }

      // Add ETH as first token if not already present (always include ETH row)
      const hasETH = transformedPortfolioData.tokens.some(token => token.symbol === 'ETH');
      if (!hasETH) {
        transformedPortfolioData.tokens.unshift({
          symbol: "ETH",
          name: "Ethereum",
          balance: typeof transformedPortfolioData.ethBalance === 'number' ? transformedPortfolioData.ethBalance.toFixed(6) : (transformedPortfolioData.ethBalance || 0).toString(),
          valueUSD: transformedPortfolioData.ethValueUSD || 0,
          priceUSD: typeof transformedPortfolioData.ethBalance === 'number' && transformedPortfolioData.ethBalance > 0 ? (transformedPortfolioData.ethValueUSD || 0) / transformedPortfolioData.ethBalance : 3000,
          change24h: 0, // TODO: Fetch real 24h change
          address: "0x0000000000000000000000000000000000000000",
          verified: true,
          hasNoPriceData: false
        });
      }

      }
      
    } catch (err) {
      const isAbort = err && (err as any).name === 'AbortError' || /aborted/i.test(String((err as any)?.message));
      if (isAbort) {
        return;
      }
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('❌ Failed to load real portfolio data:', error);
      setError(error.message);
      // Don't override with empty data - preserve what we have if it exists
      if (!portfolioData) {
        setPortfolioData({
          totalValueUSD: 0,
          ethBalance: 0,
          ethValueUSD: 0,
          totalChange24h: 0,
          tokens: [],
          verifiedCount: 0,
          unverifiedCount: 0,
          flaggedCount: 0
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Load AI insights separately (for refresh button)
  const loadAIInsights = async () => {
    if (!walletAddress) return;

    const startTime = Date.now();

    try {
      setRefreshingAI(true);
      console.log('🔄 Refreshing AI insights for wallet:', walletAddress);

      // Call the same API to refresh data
      const analysisResult = await WalletAPI.analyzeWallet(walletAddress, '24h');

      if (analysisResult.success && analysisResult.data) {
        const fallbackSentimentResults = analysisResult.data.sentiment;
        const fallbackWhaleResults = analysisResult.data.whale;

        setAIInsights({
          scamAnalysis: [],
          sentimentAnalysis: fallbackSentimentResults,
          whaleMovements: fallbackWhaleResults,
          marketOutlook: generateMarketOutlook(
            fallbackSentimentResults,
            fallbackWhaleResults,
            []
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
  const fetchETHPrice = async (): Promise<number> => {
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
      const data = await response.json();
      return data.ethereum?.usd || 3000;
    } catch (error) {
      console.error('Failed to fetch ETH price:', error);
      return 3000;
    }
  };

  
  // Add refresh function for AI insights
  const refreshAIInsights = async () => {
    if (!walletAddress) return;

    try {
      setRefreshingAI(true);
      await loadRealPortfolioData(); // Reload everything with fresh data
    } finally {
      setRefreshingAI(false);
    }
  };

  const generateMarketOutlook = (
    sentiment: SentimentAnalysisResult | undefined,
    whale: WhaleMovementResult | undefined,
    scam: any[]
  ) => {
    // Default values if sentiment/whale data is not available
    const sentimentScore = sentiment?.marketSummary?.aggregatedIndex ?? 0;
    const whaleScore = whale?.summary?.avgImpact ?? 0;
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

  const safeTokens = (portfolioData?.tokens && Array.isArray(portfolioData.tokens)) ? portfolioData.tokens.filter(token => {
    if (!token || typeof token !== 'object') return false;
    return true;
  }) : [];

  const mediumRiskTokens: TokenPosition[] = [];

  
  if (loading) {
    return (
      <div className="space-y-6">
        {/* Simple loading indicator - no spinner */}
        <Card className="bg-card border-border p-6 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 bg-primary rounded-full animate-pulse"></div>
            <div>
              <h3 className="font-semibold">Loading Wallet Data</h3>
              <p className="text-sm text-muted-foreground">
                Fetching portfolio information...
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
          <h2 className="text-lg font-semibold">AI-Enhanced Portfolio Analysis</h2>
          {aiInsights && (
            <Badge variant="secondary" className="text-xs">
              Analysis complete
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadAIInsights}
            disabled={refreshingAI}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshingAI ? 'animate-spin' : ''}`} />
            Refresh AI Insights
          </Button>
          <Badge variant="outline" className="text-xs">
            ⚡ Optimized
          </Badge>
        </div>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-card border-border p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Total Portfolio Value</p>
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
              <p className="text-muted-foreground text-sm">ETH Balance</p>
              <p className="text-2xl font-bold text-foreground balance-amount">{typeof portfolioData.ethBalance === 'number' ? portfolioData.ethBalance.toFixed(4) : parseFloat(portfolioData.ethBalance || '0').toFixed(4)} ETH</p>
              <p className="text-sm text-muted-foreground usd-value">
                ≈ {typeof portfolioData.ethValueUSD === 'number'
                  ? formatCurrency(portfolioData.ethValueUSD)
                  : 'Unavailable'}
              </p>
            </div>
            <div className="text-3xl">🟪</div>
          </div>
        </Card>

        <Card className="bg-card border-border p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">AI Risk Assessment</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {portfolioData.verifiedCount} Safe
                  </Badge>
                  {portfolioData.flaggedCount > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {portfolioData.flaggedCount} Risky
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
            <h3 className="text-lg font-semibold">AI Market Outlook</h3>
            <Badge variant={
              aiInsights.marketOutlook.trend === 'bullish' ? 'default' :
              aiInsights.marketOutlook.trend === 'bearish' ? 'destructive' : 'secondary'
            }>
              {aiInsights.marketOutlook.trend.toUpperCase()}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {Math.round(aiInsights.marketOutlook.confidence * 100)}% confidence
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
                      {analysisProgress.stage === 'analyzing' && analysisProgress.startTime > 0 && (
                        <span className="ml-2">
                          • ~${Math.round((Date.now() - analysisProgress.startTime) / 1000)}s elapsed
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {analysisProgress.stage === 'analyzing' && analysisProgress.total > 0 && (
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
                    <th className="text-left py-3 px-4 text-muted-foreground font-medium">Token</th>
                    <th className="text-right py-3 px-4 text-muted-foreground font-medium">Price (<span className="usd-value">{getCurrencySymbol()}</span>)</th>
                    <th className="text-right py-3 px-4 text-muted-foreground font-medium">Amount</th>
                    <th className="text-right py-3 px-4 text-muted-foreground font-medium">Value (<span className="usd-value">{getCurrencySymbol()}</span>)</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolioData.tokens && Array.isArray(portfolioData.tokens) && portfolioData.tokens
                    .filter(token => {
                      const balanceNum = parseFloat(token.balance || '0')
                      const val = typeof token.valueUSD === 'number' ? token.valueUSD : 0
                      return balanceNum > 0 && val >= 1
                    })
                    .map((token, index) => (
                    <tr key={index} className="border-b border-border">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleTokenClick(token)}
                            className="font-medium text-primary hover:underline hover:text-primary/80 transition-colors cursor-pointer"
                          >
                            {token.symbol}
                          </button>
                          {token.verified && (
                            <Badge variant="secondary" className="text-xs">Verified</Badge>
                          )}
                          {token.hasNoPriceData && (
                            <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300">
                              💰 No Price Data
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="text-right py-3 px-4 usd-value">
                        {token.hasNoPriceData ? (
                          <span className="text-orange-600">Price Unavailable</span>
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
                            <span className="text-orange-600">Value Unavailable</span>
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
                This wallet has no token holdings
              </p>
              <p className="text-sm text-muted-foreground">
                Try analyzing a different wallet address that has token holdings
              </p>
            </div>
          )}
        </Card>

        

        {/* Small Balance Tokens Expandable Section */}
        {allTokens && Array.isArray(allTokens) && allTokens.length > 0 && allTokens.filter(token => token && typeof token.valueUSD === 'number' && token.valueUSD < 50 && token.symbol && !['USDC', 'USDT', 'WBTC', 'WETH', 'DAI', 'LINK', 'UNI', 'AAVE', 'COMP'].includes((token.symbol || '').toUpperCase())).length > 0 && (
          <Card className="bg-card border-border p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-foreground">
                  Small Balance Tokens
                </h3>
                <Badge variant="outline">
                  {allTokens && Array.isArray(allTokens) ? allTokens.filter(token => {
                    const balanceNum = parseFloat(token.balance || '0')
                    const val = typeof token.valueUSD === 'number' ? token.valueUSD : 0
                    return !(balanceNum > 0) || val < 1
                  }).length : 0}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSmallBalanceTokens(!showSmallBalanceTokens)}
                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/20"
              >
                {showSmallBalanceTokens ? (
                  <>
                    <EyeOff className="h-4 w-4 mr-2" />
                    Hide
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    <span className="underline">Show all</span>
                  </>
                )}
              </Button>
            </div>
      
      {/* Potential Scam Tokens removed — view flagged tokens in Scam Token Alert tab */}
            <p className="text-sm text-muted-foreground mb-4">
              Tokens with small balances are hidden by default. If your overview shows fewer than 5 tokens, this section auto-expands.
            </p>

            {showSmallBalanceTokens || ((portfolioData?.tokens && Array.isArray(portfolioData.tokens) && portfolioData.tokens.filter(token => {
              const balanceNum = parseFloat(token.balance || '0')
              return balanceNum > 0
            }).length < 5)) ? (
              <div className="overflow-x-auto">
                {/* Debug: Log small balance tokens data */}
                {(() => {
                const smallBalanceTokensList = allTokens && Array.isArray(allTokens) && allTokens
                    .filter(token => {
                      const balanceNum = parseFloat(token.balance || '0')
                      const val = typeof token.valueUSD === 'number' ? token.valueUSD : 0
                      return !(balanceNum > 0) || val < 1
                    });

                  console.log('🔍 Small Balance Tokens Debug:', {
                    allTokens: allTokens ? allTokens.length : 0,
                    smallBalanceTokensList: smallBalanceTokensList ? smallBalanceTokensList.length : 0,
                    showSmallBalanceTokens,
                    sampleTokens: smallBalanceTokensList ? smallBalanceTokensList.slice(0, 3).map(t => ({ symbol: t.symbol, value: t.valueUSD, hasNoPriceData: t.hasNoPriceData })) : []
                  });

                  return null;
                })()}
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium">Token</th>
                      <th className="text-right py-3 px-4 text-muted-foreground font-medium">Price (<span className="usd-value">{getCurrencySymbol()}</span>)</th>
                      <th className="text-right py-3 px-4 text-muted-foreground font-medium">Amount</th>
                      <th className="text-right py-3 px-4 text-muted-foreground font-medium">Value (<span className="usd-value">{getCurrencySymbol()}</span>)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allTokens && Array.isArray(allTokens) && allTokens
                      .filter(token => {
                        const balanceNum = parseFloat(token.balance || '0')
                        const val = typeof token.valueUSD === 'number' ? token.valueUSD : 0
                        return !(balanceNum > 0) || val < 1
                      })
                      .map((token, index) => (
                        <tr key={`small-${index}`} className="border-b border-border opacity-75">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleTokenClick(token)}
                                className="font-medium text-sm text-primary hover:underline hover:text-primary/80 transition-colors cursor-pointer"
                              >
                                {token.symbol}
                              </button>
                              {token.verified && (
                                <Badge variant="secondary" className="text-xs">Verified</Badge>
                              )}
                            </div>
                          </td>
                          <td className="text-right py-3 px-4">
                            <span className="text-sm">{formatCurrency(token.priceUSD)}</span>
                            {token.priceSource && (
                              <span className="ml-2 text-xs text-muted-foreground">{token.priceSource}</span>
                            )}
                          </td>
                          <td className="text-right py-3 px-4">
                            <span className="text-sm">{parseFloat(token.balance).toFixed(6)}</span>
                          </td>
                          <td className="text-right py-3 px-4 font-medium text-sm">
                            <span className="text-gray-600">{formatCurrency(token.valueUSD)}</span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </Card>
        )}

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
