"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  ExternalLink,
  Clock,
  MessageCircle,
  Hash,
  Brain,
  Zap,
  Eye,
  EyeOff,
  Search,
  Filter,
  BarChart3,
  Activity,
  Globe,
  Newspaper,
  Star,
  AlertTriangle
} from "lucide-react";
import { useWallet } from "@/contexts/wallet-context";

interface NewsArticle {
  id: string;
  title: string;
  source: string;
  url: string;
  timestamp: number;
  summary: string;
  content?: string;
  sentimentScore: number; // -1 to 1
  sentimentLabel: 'bullish' | 'neutral' | 'bearish';
  confidence: number; // 0 to 1
  entities: string[];
  category: 'macro' | 'geopolitical' | 'regulation' | 'tech' | 'social' | 'market';
  author?: string;
  isExpanded?: boolean;
  analysis?: {
    reasoning: string[];
    keyPhrases: string[];
    emotionalIndicators?: {
      fear: number;
      greed: number;
      uncertainty: number;
      optimism: number;
    };
    impactLevel?: 'Low' | 'Medium' | 'High' | 'Critical';
    marketSegment?: 'Crypto' | 'Traditional' | 'Macro' | 'Regulatory';
  };
}

interface MarketSummary {
  aggregatedIndex: number; // -1 to 1
  label: 'BULLISH' | 'NEUTRAL' | 'BEARISH';
  confidence: number; // 0 to 100
  topInfluencers: Array<{
    handle: string;
    weight: number;
    sentiment: string;
  }>;
  topEntities: Array<{
    entity: string;
    influenceScore: number;
  }>;
  recentTrend: 'up' | 'down' | 'stable';
  newsCount: number;
  lastUpdated: number;
}

interface Prediction {
  trend: 'bullish' | 'neutral' | 'bearish';
  confidence: number;
  reasoning: string[];
  timeHorizon: 'short' | 'medium' | 'long';
  targetPrice?: number;
  keyFactors: string[];
}

export default function NewsSentiment() {
  const { walletAddress, handleDisconnect } = useWallet();
  const [marketSummary, setMarketSummary] = useState<MarketSummary | null>(null);
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDataCached, setIsDataCached] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sentimentFilter, setSentimentFilter] = useState<string>('all');
  const [expandedArticles, setExpandedArticles] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (walletAddress && walletAddress.trim() !== '') {
      loadNewsSentiment(walletAddress);
    } else {
      setLoading(false);
      setError("Please enter a wallet address to view news sentiment.");
    }
  }, [walletAddress]);

  const loadNewsSentiment = async (address: string, forceRefresh: boolean = false) => {
    try {
      setLoading(true);
      setError(null);

      console.log(`📰 Loading news sentiment analysis${forceRefresh ? ' (forced refresh)' : ' (using cache if available)'}...`);

      const res = await fetch(`/api/news-sentiment?walletAddress=${encodeURIComponent(address)}&forceRefresh=${forceRefresh ? 1 : 0}`)
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const sentimentResult = await res.json()

      console.log('📰 Sentiment analysis result:', sentimentResult);

      const transformedArticles: NewsArticle[] = (sentimentResult.articles || [])
        .filter(article => {
          const ts = new Date(article.publishedAt).getTime();
          const oneMonthMs = 30 * 24 * 60 * 60 * 1000;
          return ts && (Date.now() - ts) <= oneMonthMs;
        })
        .map(article => ({
        id: article.id,
        title: article.title,
        source: article.source,
        url: article.url,
        timestamp: new Date(article.publishedAt).getTime(),
        summary: article.summary || 'No summary available',
        content: article.content || undefined,
        sentimentScore: typeof article.sentiment?.score === 'number' ? article.sentiment.score : 0,
        sentimentLabel: ((article.sentiment?.label || 'Neutral').toLowerCase()) as 'bullish' | 'neutral' | 'bearish',
        confidence: typeof article.sentiment?.confidence === 'number' ? article.sentiment.confidence : 0.5,
        entities: (article.onChainMetadata?.mentionedTokens && article.onChainMetadata.mentionedTokens.length > 0)
          ? article.onChainMetadata.mentionedTokens
          : (article.entities || []),
        category: article.category || 'market',
        author: article.author || undefined,
        analysis: article.sentiment ? {
          reasoning: Array.isArray(article.sentiment.reasoning) ? article.sentiment.reasoning : (article.sentiment.reasoning ? [article.sentiment.reasoning] : []),
          keyPhrases: Array.isArray(article.sentiment.keyPhrases) ? article.sentiment.keyPhrases : [],
          emotionalIndicators: article.sentiment.emotionalIndicators,
          impactLevel: article.sentiment.impactLevel,
          marketSegment: article.sentiment.marketSegment
        } : undefined
      }));

      const recencyWeight = (ts: number) => {
        const ageHours = (Date.now() - ts) / (1000 * 60 * 60);
        const halfLifeHours = 6;
        return Math.exp(-Math.log(2) * ageHours / halfLifeHours);
      };

      const weighted = transformedArticles.map(a => {
        const baseScore = typeof a.sentimentScore === 'number'
          ? a.sentimentScore
          : a.sentimentLabel === 'bullish' ? 0.25 : a.sentimentLabel === 'bearish' ? -0.25 : 0;
        const conf = Math.min(Math.max(a.confidence ?? 0.5, 0), 1);
        const w = conf * (0.5 + recencyWeight(a.timestamp) * 0.5) * (1 + (a.entities?.length || 0) * 0.05);
        return { score: baseScore, weight: w };
      });

      const totalWeight = weighted.reduce((s, x) => s + x.weight, 0);
      const derivedAggregatedIndex = totalWeight > 0 ? weighted.reduce((s, x) => s + x.score * x.weight, 0) / totalWeight : 0;

      const last6h = transformedArticles.filter(a => (Date.now() - a.timestamp) < 6 * 60 * 60 * 1000);
      const prev6h = transformedArticles.filter(a => (Date.now() - a.timestamp) >= 6 * 60 * 60 * 1000 && (Date.now() - a.timestamp) < 12 * 60 * 60 * 1000);
      const avg = (arr: NewsArticle[]) => {
        const data = arr.map(a => {
          const baseScore = typeof a.sentimentScore === 'number' ? a.sentimentScore : a.sentimentLabel === 'bullish' ? 0.25 : a.sentimentLabel === 'bearish' ? -0.25 : 0;
          const conf = Math.min(Math.max(a.confidence ?? 0.5, 0), 1);
          const w = conf * (0.5 + recencyWeight(a.timestamp) * 0.5);
          return { score: baseScore, weight: w };
        });
        const tw = data.reduce((s, x) => s + x.weight, 0);
        return tw > 0 ? data.reduce((s, x) => s + x.score * x.weight, 0) / tw : 0;
      };
      const lastAvg = avg(last6h);
      const prevAvg = avg(prev6h);
      const derivedTrend: 'up' | 'down' | 'stable' = lastAvg - prevAvg > 0.03 ? 'up' : lastAvg - prevAvg < -0.03 ? 'down' : 'stable';

      const extractEntitiesLocal = (text: string): string[] => {
        const t = text.toLowerCase();
        const financialEntities = ['federal reserve','fed','ecb','bank of england','sec','cftc','fca','esma','mas','asic','blackrock','fidelity','goldman sachs','jpmorgan'];
        const cryptoEntities = ['bitcoin','btc','ethereum','eth','tether','usdt','usdc','binance','coinbase','kraken','gemini','uniswap','compound','aave'];
        const tokens = [...financialEntities, ...cryptoEntities];
        const found: string[] = [];
        tokens.forEach(e => { if (t.includes(e)) found.push(e.toUpperCase()); });
        return Array.from(new Set(found)).slice(0, 12);
      };
      const entityCounts: Record<string, number> = {};
      transformedArticles.forEach(a => {
        const text = (a.title + ' ' + (a.summary || '')).toLowerCase();
        const ents = (a.entities && a.entities.length > 0) ? a.entities.map(e => e.toUpperCase()) : extractEntitiesLocal(text);
        ents.forEach(e => {
          const conf = Math.min(Math.max(a.confidence ?? 0.5, 0), 1);
          const inc = conf * (0.5 + recencyWeight(a.timestamp) * 0.5);
          entityCounts[e] = (entityCounts[e] || 0) + inc;
        });
      });
      const entityEntries = Object.entries(entityCounts).sort(([, a], [, b]) => b - a).slice(0, 6);
      const sumEntities = entityEntries.reduce((s, [, v]) => s + v, 0) || 1;
      const derivedTopEntities = entityEntries.map(([entity, v]) => ({ entity, influenceScore: Math.min(1, v / sumEntities) }));

      const avgConfidence = transformedArticles.length > 0
        ? Math.round((transformedArticles.reduce((s, a) => s + (a.confidence ?? 0.5), 0) / transformedArticles.length) * 100)
        : 0;

      const bullWeightLocal = weighted.filter(x => x.score > 0.1).reduce((s, x) => s + x.weight, 0);
      const bearWeightLocal = weighted.filter(x => x.score < -0.1).reduce((s, x) => s + x.weight, 0);
      const bullRatioLocal = totalWeight > 0 ? bullWeightLocal / totalWeight : 0;
      const bearRatioLocal = totalWeight > 0 ? bearWeightLocal / totalWeight : 0;
      const labelFallback = (() => {
        if (derivedAggregatedIndex <= -0.03 || (bearRatioLocal - bullRatioLocal) >= 0.2) return 'BEARISH';
        if (derivedAggregatedIndex >= 0.03 || (bullRatioLocal - bearRatioLocal) >= 0.2) return 'BULLISH';
        return 'NEUTRAL';
      })();

      const transformedMarketSummary: MarketSummary = {
        aggregatedIndex: typeof sentimentResult.marketSummary.aggregatedIndex === 'number' && sentimentResult.marketSummary.aggregatedIndex !== 0
          ? sentimentResult.marketSummary.aggregatedIndex
          : derivedAggregatedIndex,
        label: (sentimentResult.marketSummary.label || labelFallback).toUpperCase() as 'BULLISH' | 'NEUTRAL' | 'BEARISH',
        confidence: Math.max(Math.round((sentimentResult.marketSummary.confidence || 0) * 100), avgConfidence),
        topInfluencers: sentimentResult.marketSummary.topInfluencers || [],
        topEntities: (sentimentResult.marketSummary.topEntities || []).length > 0
          ? (sentimentResult.marketSummary.topEntities || []).map(entity => ({ entity: entity.entity, influenceScore: entity.influenceScore }))
          : derivedTopEntities,
        recentTrend: (() => {
          if (sentimentResult.marketSummary.trendIndicator === 'rising') return 'up';
          if (sentimentResult.marketSummary.trendIndicator === 'falling') return 'down';
          if (derivedAggregatedIndex <= -0.03 || bearRatioLocal - bullRatioLocal >= 0.2) return 'down';
          if (derivedAggregatedIndex >= 0.03 || bullRatioLocal - bearRatioLocal >= 0.2) return 'up';
          return derivedTrend;
        })(),
        newsCount: transformedArticles.length,
        lastUpdated: Date.now()
      };

      const predictionTrend = (() => {
        const engineTrend = (sentimentResult.marketSummary.prediction?.shortTerm || 'neutral').toLowerCase();
        if (derivedAggregatedIndex <= -0.03 || bearRatioLocal - bullRatioLocal >= 0.2) return 'bearish';
        if (derivedAggregatedIndex >= 0.03 || bullRatioLocal - bearRatioLocal >= 0.2) return 'bullish';
        return engineTrend as 'bullish' | 'neutral' | 'bearish';
      })();

      const transformedPrediction: Prediction = {
        trend: predictionTrend,
        confidence: Math.round((sentimentResult.marketSummary.prediction?.confidence || 0) * 100),
        reasoning: [sentimentResult.marketSummary.prediction.reasoning],
        timeHorizon: 'short',
        keyFactors: ["Market sentiment", "News flow", "Entity analysis", "Trading patterns"]
      };

      console.log(`📰 Transformed ${transformedArticles.length} articles for display`);

      setMarketSummary(transformedMarketSummary);
      setNewsArticles(transformedArticles);
      setPrediction(transformedPrediction);
      setIsDataCached(!forceRefresh && transformedArticles.length > 0);
      
    } catch (err) {
      console.error('❌ Failed to load news sentiment:', err);
      setError(err instanceof Error ? err.message : "Failed to load news sentiment");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (walletAddress) {
      setRefreshing(true);
      setIsDataCached(false); // Reset cache status
      console.log('🔄 User triggered refresh - forcing new data fetch');
      await loadNewsSentiment(walletAddress, true); // Force refresh
      setRefreshing(false);
    }
  };

  const toggleArticleExpansion = (articleId: string) => {
    setExpandedArticles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(articleId)) {
        newSet.delete(articleId);
      } else {
        newSet.add(articleId);
      }
      return newSet;
    });
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'bullish': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'bearish': return <TrendingDown className="h-4 w-4 text-red-600" />;
      default: return <Minus className="h-4 w-4 text-gray-600" />;
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'bullish': return 'text-green-600 bg-green-50 dark:bg-green-950/20';
      case 'bearish': return 'text-red-600 bg-red-50 dark:bg-red-950/20';
      default: return 'text-gray-600 bg-gray-50 dark:bg-gray-950/20';
    }
  };

  const getMarketSummaryColor = (label: string) => {
    switch (label) {
      case 'BULLISH': return 'text-green-600';
      case 'BEARISH': return 'text-red-600';
      default: return 'text-yellow-600';
    }
  };

  const getSourceIcon = (source: string, category: string) => {
    // First try to match specific news sources
    const sourceLower = source.toLowerCase();
    if (sourceLower.includes('reuters') || sourceLower.includes('bloomberg') || sourceLower.includes('ft')) {
      return <BarChart3 className="h-4 w-4" />;
    }
    if (sourceLower.includes('coindesk') || sourceLower.includes('cointelegraph') || sourceLower.includes('theblock')) {
      return <Zap className="h-4 w-4" />;
    }
    if (sourceLower.includes('sec') || sourceLower.includes('regulation')) {
      return <Star className="h-4 w-4" />;
    }
    if (sourceLower.includes('reddit')) {
      return <MessageCircle className="h-4 w-4" />;
    }

    // Fall back to category-based icons
    switch (category) {
      case 'macro': return <BarChart3 className="h-4 w-4" />;
      case 'geopolitical': return <Globe className="h-4 w-4" />;
      case 'regulation': return <Star className="h-4 w-4" />;
      case 'tech': return <Zap className="h-4 w-4" />;
      case 'social': return <MessageCircle className="h-4 w-4" />;
      case 'market': return <Activity className="h-4 w-4" />;
      default: return <Newspaper className="h-4 w-4" />;
    }
  };

  const filteredArticles = newsArticles.filter(article => {
    const matchesSearch = !searchQuery ||
      (article.title && article.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (article.summary && article.summary.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (article.entities && article.entities.some(entity => entity.toLowerCase().includes(searchQuery.toLowerCase())));

    const matchesCategory = categoryFilter === 'all' || article.category === categoryFilter;
    const matchesSentiment = sentimentFilter === 'all' || article.sentimentLabel === sentimentFilter;

    return matchesSearch && matchesCategory && matchesSentiment;
  });

  const cleanContent = (text?: string) => {
    if (!text) return '';
    return text.replace(/\s*\[\+\d+\s+chars\]$/i, '');
  };

  const getPreviewText = (article: NewsArticle) => {
    const base = cleanContent(article.content) || article.summary || '';
    return base;
  };

  const formatTimestamp = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (hours < 1) {
      const minutes = Math.floor(diff / (1000 * 60));
      return `${minutes}m ago`;
    } else if (hours < 24) {
      return `${hours}h ago`;
    } else {
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    }
  };

  const recencyWeightLocal = (ts: number) => {
    const ageHours = (Date.now() - ts) / (1000 * 60 * 60);
    const halfLifeHours = 6;
    return Math.exp(-Math.log(2) * ageHours / halfLifeHours);
  };

  const weightedLocal = newsArticles.map(a => {
    const baseScore = typeof a.sentimentScore === 'number' ? a.sentimentScore : a.sentimentLabel === 'bullish' ? 0.25 : a.sentimentLabel === 'bearish' ? -0.25 : 0;
    const conf = Math.min(Math.max(a.confidence ?? 0.5, 0), 1);
    const w = conf * (0.5 + recencyWeightLocal(a.timestamp) * 0.5) * (1 + (a.entities?.length || 0) * 0.05);
    return { score: baseScore, weight: w, source: a.source };
  });

  const totalWLocal = weightedLocal.reduce((s, x) => s + x.weight, 0);
  const aggregatedIndexLocal = totalWLocal > 0 ? weightedLocal.reduce((s, x) => s + x.score * x.weight, 0) / totalWLocal : 0;
  const sourceCoverageLocal = Array.from(new Set(newsArticles.map(a => a.source))).map(src => {
    const count = newsArticles.filter(a => a.source === src).length;
    const pct = Math.round((count / Math.max(newsArticles.length, 1)) * 100);
    return { source: src, pct };
  }).sort((a, b) => b.pct - a.pct).slice(0, 5);
  const controversyIndexLocal = (() => {
    if (weightedLocal.length === 0) return 0;
    // Measure disagreement across articles (weighted standard deviation)
    const mean = aggregatedIndexLocal;
    const varArticles = weightedLocal.reduce((sum, x) => sum + x.weight * Math.pow(x.score - mean, 2), 0) / Math.max(totalWLocal, 1);
    const stdArticles = Math.sqrt(varArticles);
    const normStd = Math.max(0, Math.min(1, stdArticles / 0.5));

    // Measure disagreement across sources
    const bySource: Record<string, { s: number; w: number }> = {};
    weightedLocal.forEach(x => {
      const key = x.source;
      if (!bySource[key]) bySource[key] = { s: 0, w: 0 };
      bySource[key].s += x.score * x.weight;
      bySource[key].w += x.weight;
    });
    const avgs = Object.values(bySource).map(v => v.w > 0 ? v.s / v.w : mean);
    const meanSrc = avgs.reduce((a, b) => a + b, 0) / Math.max(avgs.length, 1);
    const varSrc = avgs.reduce((sum, val) => sum + Math.pow(val - meanSrc, 2), 0) / Math.max(avgs.length, 1);
    const normVarSrc = Math.max(0, Math.min(1, Math.sqrt(varSrc) / 0.5));

    // Mix score: higher when bull and bear both present
    const bullW = weightedLocal.filter(x => x.score > 0.1).reduce((s, x) => s + x.weight, 0);
    const bearW = weightedLocal.filter(x => x.score < -0.1).reduce((s, x) => s + x.weight, 0);
    const mix = (bullW > 0 && bearW > 0) ? 1 - Math.abs(bullW - bearW) / Math.max(totalWLocal, 1) : 0;

    return Math.max(normStd, normVarSrc, mix * 0.8);
  })();
  const recentCoverageLocal = Math.round((newsArticles.filter(a => (Date.now() - a.timestamp) < 6 * 60 * 60 * 1000).length / Math.max(newsArticles.length, 1)) * 100);
  const topPositiveLocal = [...newsArticles].sort((a, b) => (b.sentimentScore ?? 0) - (a.sentimentScore ?? 0)).slice(0, 3);
  const topNegativeLocal = [...newsArticles].sort((a, b) => (a.sentimentScore ?? 0) - (b.sentimentScore ?? 0)).slice(0, 3);

  const weightedSentimentsLocal = newsArticles.map(a => {
    const baseScore = typeof a.sentimentScore === 'number' ? a.sentimentScore : a.sentimentLabel === 'bullish' ? 0.25 : a.sentimentLabel === 'bearish' ? -0.25 : 0;
    const conf = Math.min(Math.max(a.confidence ?? 0.5, 0), 1);
    const w = conf * (0.5 + recencyWeightLocal(a.timestamp) * 0.5);
    return { score: baseScore, weight: w, category: a.category };
  });
  const totalWSent = weightedSentimentsLocal.reduce((s, x) => s + x.weight, 0) || 1;
  const bullPctLocal = Math.round((weightedSentimentsLocal.filter(x => x.score > 0.1).reduce((s, x) => s + x.weight, 0) / totalWSent) * 100);
  const bearPctLocal = Math.round((weightedSentimentsLocal.filter(x => x.score < -0.1).reduce((s, x) => s + x.weight, 0) / totalWSent) * 100);
  const neutralPctLocal = Math.max(0, 100 - bullPctLocal - bearPctLocal);
  const segmentWeightsLocal: Record<string, number> = {};
  weightedSentimentsLocal.forEach(x => { const key = x.category || 'general'; segmentWeightsLocal[key] = (segmentWeightsLocal[key] || 0) + x.weight; });
  const segmentEntriesLocal = Object.entries(segmentWeightsLocal).map(([k, v]) => ({ seg: k, pct: Math.round((v / totalWSent) * 100) })).sort((a, b) => b.pct - a.pct).slice(0, 5);

  if (loading) {
    return (
      <DashboardLayout walletAddress={walletAddress || ''} onDisconnect={handleDisconnect}>
        <div className="space-y-6">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-64 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="h-32 bg-muted rounded"></div>
              <div className="h-32 bg-muted rounded"></div>
              <div className="h-32 bg-muted rounded"></div>
            </div>
            <div className="h-64 bg-muted rounded mb-6"></div>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded mb-4"></div>
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
            <Newspaper className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">News Sentiment</h1>
              <p className="text-sm text-muted-foreground">
                AI-powered market analysis and news sentiment tracking
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

        {/* Market Summary Cards */}
        {marketSummary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Overall Market Sentiment */}
            <Card className="bg-card border-border p-4 shadow-md">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" />
                  <h3 className="text-base font-semibold">Market Sentiment</h3>
                </div>
                <Badge
                  variant="outline"
                  className={`${getMarketSummaryColor(marketSummary.label)} border-current`}
                >
                  {marketSummary.confidence}% confidence
                </Badge>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  {getSentimentIcon((marketSummary.label || 'NEUTRAL').toLowerCase())}
                  <span className={`text-xl font-bold ${getMarketSummaryColor(marketSummary.label)}`}>
                    {marketSummary.label}
                  </span>
                </div>

                <div className="text-sm text-muted-foreground">
                  <div>Aggregated Index: {(marketSummary.aggregatedIndex || 0).toFixed(2)}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className="h-3 w-3" />
                    Updated {formatTimestamp(marketSummary.lastUpdated)}
                    {isDataCached && (
                      <Badge variant="secondary" className="text-xs ml-2">
                        Cached
                      </Badge>
                    )}
                    
                  </div>
                </div>
              </div>
            </Card>

            {/* Trend Direction */}
            <Card className="bg-card border-border p-4 shadow-md">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="h-5 w-5 text-primary" />
                <h3 className="text-base font-semibold">Recent Trend</h3>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  {marketSummary.recentTrend === 'up' && <TrendingUp className="h-6 w-6 text-green-600" />}
                  {marketSummary.recentTrend === 'down' && <TrendingDown className="h-6 w-6 text-red-600" />}
                  {marketSummary.recentTrend === 'stable' && <Minus className="h-6 w-6 text-yellow-600" />}
                  <span className={`text-base font-bold capitalize ${
                    marketSummary.recentTrend === 'up' ? 'text-green-600' :
                    marketSummary.recentTrend === 'down' ? 'text-red-600' : 'text-yellow-600'
                  }`}>
                    {marketSummary.recentTrend}
                  </span>
                </div>

                <div className="text-sm text-muted-foreground">
                  <div>News Articles: {marketSummary.newsCount}</div>
                </div>
              </div>
            </Card>

            {/* Key Entities */}
            <Card className="bg-card border-border p-4 shadow-md">
              <div className="flex items-center gap-2 mb-4">
                <Hash className="h-5 w-5 text-primary" />
                <h3 className="text-base font-semibold">Trending Entities</h3>
              </div>

              <div className="space-y-2">
                {(marketSummary.topEntities || []).map((entity, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{entity.entity}</span>
                    <div className="flex items-center gap-1">
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full"
                          style={{ width: `${entity.influenceScore * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-muted-foreground w-10">
                        {Math.round(entity.influenceScore * 100)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {newsArticles.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-card border-border p-4 shadow-md">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="h-5 w-5 text-primary" />
                <h3 className="text-base font-semibold">Analysis Quality</h3>
              </div>
              <div className="text-sm text-muted-foreground space-y-2">
                <div>Weighted Index: {aggregatedIndexLocal.toFixed(2)}</div>
                <div>Average Confidence: {Math.round((newsArticles.reduce((s, a) => s + (a.confidence ?? 0.5), 0) / newsArticles.length) * 100)}%</div>
                <div>Recent Coverage (6h): {recentCoverageLocal}%</div>
                <div>Source Diversity: {new Set(newsArticles.map(a => a.source)).size}</div>
              </div>
            </Card>

            <Card className="bg-card border-border p-4 shadow-md">
              <div className="flex items-center gap-2 mb-4">
                <Globe className="h-5 w-5 text-primary" />
                <h3 className="text-base font-semibold">Source Coverage</h3>
              </div>
              <div className="space-y-2">
                {sourceCoverageLocal.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{item.source}</span>
                    <Badge variant="outline" className="text-xs">{item.pct}%</Badge>
                  </div>
                ))}
                
              </div>
            </Card>

            <Card className="bg-card border-border p-4 shadow-md">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="h-5 w-5 text-primary" />
                <h3 className="text-base font-semibold">Controversy Index</h3>
              </div>
              <div className="space-y-2">
                <div className="text-xl font-bold">{Math.round(controversyIndexLocal * 100)}%</div>
                <div className="text-sm text-muted-foreground">Higher values indicate mixed sentiment across sources</div>
              </div>
            </Card>
          </div>
        )}

        {/* AI Prediction Card */}
        {prediction && (
          <Card className="bg-card border-border p-6 shadow-lg">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">AI Market Prediction</h3>
              <Badge variant="outline" className="text-xs">
                {prediction.timeHorizon} term
              </Badge>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Column 1: Trend & Distribution */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  {getSentimentIcon(prediction?.trend || 'neutral')}
                  <span className={`text-xl font-bold capitalize ${getMarketSummaryColor((prediction?.trend || 'neutral').toUpperCase())}`}>
                    {prediction?.trend || 'neutral'}
                  </span>
                  <Badge variant="outline">
                    {prediction.confidence}% confidence
                  </Badge>
                </div>
                {prediction.targetPrice && (
                  <div className="text-sm text-muted-foreground mb-3">
                    Target Price: ${prediction.targetPrice.toLocaleString()}
                  </div>
                )}
                <div className="grid grid-cols-3 gap-3 text-sm text-muted-foreground">
                  <div>
                    <div className="font-medium">Bullish</div>
                    <div>{bullPctLocal}%</div>
                  </div>
                  <div>
                    <div className="font-medium">Bearish</div>
                    <div>{bearPctLocal}%</div>
                  </div>
                  <div>
                    <div className="font-medium">Neutral</div>
                    <div>{neutralPctLocal}%</div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Key Factors</h4>
                <div className="text-sm text-muted-foreground space-y-1 mb-4">
                  {(prediction.keyFactors || []).map((factor, index) => (
                    <div key={index}>• {factor}</div>
                  ))}
                </div>
              </div>

              {/* Column 3: Segment Breakdown */}
              <div>
                <h4 className="font-medium mb-2">Segment Breakdown</h4>
                <div className="space-y-2">
                  {segmentEntriesLocal.map((s, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs capitalize w-24">{s.seg}</span>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-primary h-2 rounded-full" style={{ width: `${s.pct}%` }}></div>
                      </div>
                      <span className="text-xs w-10">{s.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Row 2: Top Headlines */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-muted/40 border-border p-4">
                <h4 className="font-medium mb-2">Top Positive Headlines</h4>
                <div className="space-y-2">
                  {topPositiveLocal.map(item => (
                    <div key={item.id} className="flex items-center justify-between">
                      <span className="text-sm truncate">{item.title}</span>
                      <Badge variant="outline" className="text-xs">{Math.round((item.confidence ?? 0.5) * 100)}%</Badge>
                    </div>
                  ))}
                </div>
              </Card>
              <Card className="bg-muted/40 border-border p-4">
                <h4 className="font-medium mb-2">Top Negative Headlines</h4>
                <div className="space-y-2">
                  {topNegativeLocal.map(item => (
                    <div key={item.id} className="flex items-center justify-between">
                      <span className="text-sm truncate">{item.title}</span>
                      <Badge variant="outline" className="text-xs">{Math.round((item.confidence ?? 0.5) * 100)}%</Badge>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Row 3: Reasoning */}
            <div className="mt-6 pt-4 border-t border-border">
              <h4 className="font-medium mb-2">AI Reasoning</h4>
              <div className="text-sm text-muted-foreground space-y-1">
                {(prediction.reasoning || []).map((reason, index) => (
                  <div key={index}>• {reason}</div>
                ))}
              </div>
            </div>
          </Card>
        )}

        {/* Filters */}
        <Card className="bg-card border-border p-6 shadow-lg">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="h-4 w-4" />
            <h3 className="text-sm font-medium">Filters</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search articles, entities..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="macro">Macroeconomic</SelectItem>
                  <SelectItem value="geopolitical">Geopolitical</SelectItem>
                  <SelectItem value="regulation">Regulation</SelectItem>
                  <SelectItem value="tech">Technology</SelectItem>
                  <SelectItem value="social">Social</SelectItem>
                  <SelectItem value="market">Market</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Sentiment</label>
              <Select value={sentimentFilter} onValueChange={setSentimentFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Select sentiment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sentiments</SelectItem>
                  <SelectItem value="bullish">Bullish</SelectItem>
                  <SelectItem value="neutral">Neutral</SelectItem>
                  <SelectItem value="bearish">Bearish</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* News Feed */}
        {error ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : filteredArticles.length === 0 ? (
          <Card className="bg-card border-border p-12 shadow-lg text-center">
            <Newspaper className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {searchQuery || categoryFilter !== 'all' || sentimentFilter !== 'all'
                ? 'No articles found'
                : 'No news articles available'
              }
            </h3>
            <p className="text-muted-foreground">
              {searchQuery || categoryFilter !== 'all' || sentimentFilter !== 'all'
                ? 'Try adjusting your filters or search terms'
                : 'News articles will appear here as they become available'
              }
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            <Card className="bg-card border-border p-6 shadow-lg">
              <div className="flex items-center gap-2 mb-4">
                <Star className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Top Headlines</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Positive</h4>
                  <div className="space-y-2">
                    {topPositiveLocal.map(item => (
                      <div key={item.id} className="flex items-center justify-between">
                        <span className="text-sm truncate">{item.title}</span>
                        <Badge variant="outline" className="text-xs">{Math.round((item.confidence ?? 0.5) * 100)}%</Badge>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Negative</h4>
                  <div className="space-y-2">
                    {topNegativeLocal.map(item => (
                      <div key={item.id} className="flex items-center justify-between">
                        <span className="text-sm truncate">{item.title}</span>
                        <Badge variant="outline" className="text-xs">{Math.round((item.confidence ?? 0.5) * 100)}%</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
            {(filteredArticles || []).map((article) => (
              <Card
                key={article.id}
                className="bg-card border-border p-6 shadow-lg hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      {getSourceIcon(article.source, article.category)}
                      <h4 className="font-medium text-foreground truncate">{article.title}</h4>
                    </div>

                    <div className="flex items-center gap-3 mb-3">
                      <Badge variant="secondary" className="text-xs">
                        {article.source}
                      </Badge>

                      <Badge
                        variant="outline"
                        className={`text-xs ${getSentimentColor(article.sentimentLabel)}`}
                      >
                        {getSentimentIcon(article.sentimentLabel)}
                        <span className="ml-1 capitalize">{article.sentimentLabel}</span>
                      </Badge>

                      <Badge variant="outline" className="text-xs">
                        {Math.round((article.confidence || 0) * 100)}% confidence
                      </Badge>

                      <span className="text-xs text-muted-foreground">
                        {formatTimestamp(article.timestamp)}
                      </span>
                    </div>

                    <div className="text-sm text-muted-foreground mb-3">
                      {article.author && <span>By: {article.author}</span>}
                    </div>

                    <p className="text-sm text-muted-foreground mb-3">
                      {getPreviewText(article)}
                    </p>

                    {expandedArticles.has(article.id) && (
                      <div className="mt-4 p-4 bg-muted/50 rounded-lg space-y-4">
                        <div className="space-y-2">
                          <div className="font-medium text-sm">Full Content:</div>
                          <div className="text-sm text-muted-foreground">
                            {cleanContent(article.content) || article.summary}
                          </div>
                        </div>

                        {article.entities && article.entities.length > 0 && (
                          <div className="space-y-2">
                            <div className="font-medium text-sm">Key Entities:</div>
                            <div className="flex flex-wrap gap-1">
                              {(article.entities || []).map((entity, index) => (
                                <Badge key={index} variant="secondary" className="text-xs">
                                  <Hash className="h-3 w-3 mr-1" />
                                  {entity}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {article.analysis && (
                          <div className="space-y-3">
                            <div className="font-medium text-sm">AI Analysis:</div>
                            {(article.analysis.reasoning || []).length > 0 && (
                              <div className="text-sm text-muted-foreground space-y-1">
                                {(article.analysis.reasoning || []).map((reason, idx) => (
                                  <div key={idx}>• {reason}</div>
                                ))}
                              </div>
                            )}

                            {(article.analysis.keyPhrases || []).length > 0 && (
                              <div className="space-y-2">
                                <div className="font-medium text-sm">Key Phrases:</div>
                                <div className="flex flex-wrap gap-1">
                                  {article.analysis.keyPhrases.map((phrase, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      {phrase}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {article.analysis.emotionalIndicators && (
                              <div className="space-y-2">
                                <div className="font-medium text-sm">Emotional Indicators:</div>
                                <div className="space-y-2">
                                  {(['fear','greed','uncertainty','optimism'] as const).map((k) => (
                                    <div key={k} className="flex items-center gap-2">
                                      <span className="text-xs capitalize w-24">{k}</span>
                                      <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div className="bg-primary h-2 rounded-full" style={{ width: `${Math.round((article.analysis!.emotionalIndicators![k] || 0) * 100)}%` }}></div>
                                      </div>
                                      <span className="text-xs w-10">{Math.round((article.analysis!.emotionalIndicators![k] || 0) * 100)}%</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="space-y-2">
                              <div className="font-medium text-sm">Impact:</div>
                              <div className="text-sm text-muted-foreground">
                                <div>Level: {article.analysis.impactLevel || 'Unknown'}</div>
                                <div>Segment: {article.analysis.marketSegment || 'General'}</div>
                                <div className="flex items-center gap-2">
                                  Direction: {getSentimentIcon(article.sentimentLabel)}
                                  <span className="capitalize">{article.sentimentLabel}</span>
                                  <span className="text-xs">({Math.round((article.confidence || 0) * 100)}% confidence)</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleArticleExpansion(article.id)}
                    >
                      {expandedArticles.has(article.id) ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                      {expandedArticles.has(article.id) ? 'Hide' : 'Show'} Details
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(article.url, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Read More
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
