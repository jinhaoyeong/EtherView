"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useState, useEffect, useRef } from "react";
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
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import { useTranslation } from "@/hooks/use-translation";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
    entities?: Array<{ name: string; sentiment: number; relevance: number }>;
    meta?: { source?: string; model?: string };
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
  riskFactors?: string[];
  keyFactorsDetailed?: { positive: string[]; negative: string[]; neutral: string[] };
  marketSignals?: { volume: 'High' | 'Medium' | 'Low'; volatility: 'High' | 'Medium' | 'Low'; momentum: 'Strong' | 'Moderate' | 'Weak' };
  technicalIndicators?: { rsi?: number; macd?: number; bollinger?: 'Upper' | 'Middle' | 'Lower'; support?: number; resistance?: number };
}

const newsCache = new Map<string, { data: { marketSummary: MarketSummary | null; newsArticles: NewsArticle[]; prediction: Prediction | null }; timestamp: number }>();
const NEWS_CACHE_DURATION = 120000;

export default function NewsSentiment() {
  const { walletAddress, handleDisconnect } = useWallet();
  const { t } = useTranslation();
  const [marketSummary, setMarketSummary] = useState<MarketSummary | null>(null);
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDataCached, setIsDataCached] = useState(false);
  const [useFastMode, setUseFastMode] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sentimentFilter, setSentimentFilter] = useState<string>('all');
  const [expandedArticles, setExpandedArticles] = useState<Set<string>>(new Set());
  const hasLoadedData = useRef(false);

  useEffect(() => {
    // Only load if we haven't loaded data yet
    if (!hasLoadedData.current) {
      // Add a small delay to ensure wallet context is loaded
      const timer = setTimeout(() => {
        console.log('📰 News page useEffect - walletAddress:', walletAddress);
        if (walletAddress && walletAddress.trim() !== '') {
          loadNewsSentiment(walletAddress);
        } else {
          // Try to get wallet from localStorage as fallback
          const storedWallet = localStorage.getItem("etherview_wallet");
          console.log('📰 News page - checking localStorage wallet:', storedWallet);
          if (storedWallet && storedWallet.trim() !== '') {
            loadNewsSentiment(storedWallet);
          } else {
            // Use a default wallet address for demo purposes when no wallet is connected
            const demoAddress = "0x075e72a5edf65f0a5f44699c7654c1a76941ddc8";
            console.log('📰 No wallet connected, using demo address:', demoAddress);
            loadNewsSentiment(demoAddress);
          }
        }
      }, 100); // 100ms delay to ensure context is loaded

      return () => clearTimeout(timer);
    }
  }, [walletAddress]);

  // Mark data as loaded once we have articles
  useEffect(() => {
    if (newsArticles.length > 0) {
      hasLoadedData.current = true;
    }
  }, [newsArticles]);

  const loadNewsSentiment = async (address: string, forceRefresh: boolean = false) => {
    try {
      const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
      setError(null);

      const cacheKey = `${address}_${useFastMode ? 'fast' : 'full'}`;
      if (!forceRefresh) {
        const cached = newsCache.get(cacheKey);
        const now = Date.now();
        if (cached && (now - cached.timestamp) < NEWS_CACHE_DURATION) {
          setMarketSummary(cached.data.marketSummary);
          setNewsArticles(cached.data.newsArticles);
          setPrediction(cached.data.prediction);
          setIsDataCached(true);
          setLoading(false);
          return;
        }
      }

      setLoading(true);

      console.log(`📰 Loading news sentiment analysis${forceRefresh ? ' (forced refresh)' : ' (using cache if available)'}...`);

      const res = await fetch(`/api/news-sentiment?walletAddress=${encodeURIComponent(address)}&forceRefresh=${forceRefresh ? 1 : 0}&fast=${useFastMode ? 1 : 0}`)
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const apiResponse = await res.json()

      console.log('📰 Sentiment analysis result:', apiResponse);

      // Handle the new API response structure with success/data wrapper
      const sentimentResult = apiResponse.success ? apiResponse.data : apiResponse;

      const transformedArticles: NewsArticle[] = (sentimentResult.articles || [])
        .filter((article: { publishedAt?: string }) => {
          const ts = new Date(article.publishedAt || '').getTime();
          const oneMonthMs = 30 * 24 * 60 * 60 * 1000;
          return ts && (Date.now() - ts) <= oneMonthMs;
        })
        .map((article: { id: string; title?: string; source?: string; url?: string; publishedAt?: string; summary?: string; content?: string; sentiment?: { score?: number; label?: string; confidence?: number; reasoning?: string[] | string; keyPhrases?: string[]; emotionalIndicators?: unknown; impactLevel?: 'Low' | 'Medium' | 'High' | 'Critical'; marketSegment?: 'Crypto' | 'Traditional' | 'Macro' | 'Regulatory' }; onChainMetadata?: { mentionedTokens?: string[] }; entities?: string[]; category?: string; author?: string }) => ({
        id: article.id,
        title: article.title || 'Untitled',
        source: article.source || 'Unknown',
        url: article.url || '#',
        timestamp: new Date(article.publishedAt || '').getTime(),
        summary: article.summary || 'No summary available',
        content: article.content || undefined,
        sentimentScore: typeof article.sentiment?.score === 'number' ? article.sentiment.score : 0,
        sentimentLabel: ((article.sentiment?.label || 'Neutral').toLowerCase() as 'bullish' | 'neutral' | 'bearish'),
        confidence: typeof article.sentiment?.confidence === 'number' ? article.sentiment.confidence : 0.5,
        entities: (article.onChainMetadata?.mentionedTokens && article.onChainMetadata.mentionedTokens.length > 0)
          ? article.onChainMetadata.mentionedTokens
          : (article.entities || []),
        category: normalizeCategory(article.category as string, article.title, article.summary, article.content, article.source),
        author: article.author || undefined,
        analysis: article.sentiment ? {
          reasoning: Array.isArray(article.sentiment.reasoning) ? article.sentiment.reasoning : (article.sentiment.reasoning ? [article.sentiment.reasoning] : []),
          keyPhrases: Array.isArray(article.sentiment.keyPhrases) ? article.sentiment.keyPhrases : [],
          emotionalIndicators: article.sentiment.emotionalIndicators,
          impactLevel: article.sentiment.impactLevel,
          marketSegment: article.sentiment.marketSegment,
          entities: Array.isArray((article.sentiment as any).entities) ? (article.sentiment as any).entities : [],
          meta: (article.sentiment as any).meta
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
        aggregatedIndex: typeof sentimentResult.marketSummary?.aggregatedIndex === 'number' && sentimentResult.marketSummary.aggregatedIndex !== 0
          ? sentimentResult.marketSummary.aggregatedIndex
          : derivedAggregatedIndex,
        label: (sentimentResult.marketSummary?.label || labelFallback).toUpperCase() as 'BULLISH' | 'NEUTRAL' | 'BEARISH',
        confidence: Math.max(Math.round((sentimentResult.marketSummary?.confidence || 0) * 100), avgConfidence),
        topInfluencers: sentimentResult.marketSummary?.topInfluencers || [],
        topEntities: (sentimentResult.marketSummary?.topEntities || []).length > 0
          ? (sentimentResult.marketSummary?.topEntities || []).map((entity: { entity: string; influenceScore: number }) => ({ entity: entity.entity, influenceScore: entity.influenceScore }))
          : derivedTopEntities,
        recentTrend: (() => {
          if (sentimentResult.marketSummary?.trendIndicator === 'rising') return 'up';
          if (sentimentResult.marketSummary?.trendIndicator === 'falling') return 'down';
          if (derivedAggregatedIndex <= -0.03 || bearRatioLocal - bullRatioLocal >= 0.2) return 'down';
          if (derivedAggregatedIndex >= 0.03 || bullRatioLocal - bearRatioLocal >= 0.2) return 'up';
          return derivedTrend;
        })(),
        newsCount: transformedArticles.length,
        lastUpdated: Date.now()
      };

      const predictionTrend: 'bullish' | 'neutral' | 'bearish' =
        (derivedAggregatedIndex <= -0.03 || bearRatioLocal - bullRatioLocal >= 0.2)
          ? 'bearish'
          : (derivedAggregatedIndex >= 0.03 || bullRatioLocal - bearRatioLocal >= 0.2)
            ? 'bullish'
            : 'neutral';

      const timeHorizon: 'short' | 'medium' | 'long' = predictionTrend !== 'neutral' ? 'short' : 'medium';

      const apiPred = sentimentResult.marketSummary?.prediction;
      const transformedPrediction: Prediction = apiPred ? {
        trend: (apiPred.trend || 'Neutral').toLowerCase() as 'bullish' | 'neutral' | 'bearish',
        confidence: Math.round((apiPred.confidence || 0) * 100),
        reasoning: apiPred.reasoning || [],
        timeHorizon: (apiPred.timeHorizon || 'Short-term (4-24h)').toLowerCase().includes('short') ? 'short' : 'medium',
        targetPrice: apiPred.targetPrice,
        keyFactors: [...(apiPred.keyFactors?.positive || []), ...(apiPred.keyFactors?.neutral || []), ...(apiPred.keyFactors?.negative || [])],
        riskFactors: apiPred.riskFactors || [],
        keyFactorsDetailed: apiPred.keyFactors || { positive: [], negative: [], neutral: [] },
        marketSignals: apiPred.marketSignals,
        technicalIndicators: apiPred.technicalIndicators
      } : {
        trend: predictionTrend,
        confidence: avgConfidence,
        reasoning: [
          `Aggregated index ${derivedAggregatedIndex.toFixed(2)}`,
          `Bull/Bear ratio ${Math.round(bullRatioLocal * 100)}%/${Math.round(bearRatioLocal * 100)}%`
        ],
        timeHorizon,
        keyFactors: ["Market sentiment", "News flow", "Entity analysis", "Trading patterns"]
      };

      console.log(`📰 Transformed ${transformedArticles.length} articles for display`);

      setMarketSummary(transformedMarketSummary);
      setNewsArticles(transformedArticles);
      setPrediction(transformedPrediction);
      setIsDataCached(!forceRefresh && transformedArticles.length > 0);

      newsCache.set(cacheKey, {
        data: {
          marketSummary: transformedMarketSummary,
          newsArticles: transformedArticles,
          prediction: transformedPrediction
        },
        timestamp: Date.now()
      });
      const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const duration = Math.round((t1 - t0));
      try {
        fetch('/api/metrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'tab_news_loaded',
            counter: 'ui_news_load_time_ms',
            value: duration,
            payload: { address, forceRefresh, articles: transformedArticles.length }
          })
        }).catch(() => {});
      } catch {}
      
    } catch (err) {
      console.error('❌ Failed to load news sentiment:', err);
      setError(err instanceof Error ? err.message : t('news.loadError'));
      try {
        fetch('/api/metrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'tab_news_failed', counter: 'ui_tab_load_failed', payload: { address, forceRefresh } })
        }).catch(() => {});
      } catch {}
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (walletAddress) {
      setRefreshing(true);
      setIsDataCached(false); // Reset cache status
      hasLoadedData.current = false; // Reset the loaded flag
      console.log('🔄 User triggered refresh - forcing new data fetch');
      await loadNewsSentiment(walletAddress, true); // Force refresh
      setRefreshing(false);
    }
  };

  // 5 minutes default for news
  useAutoRefresh(handleRefresh, !!walletAddress, 300);

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

  const filteredArticles = newsArticles
    .filter(article => {
      const matchesSearch = !searchQuery ||
        (article.title && article.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (article.summary && article.summary.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (article.entities && article.entities.some(entity => entity.toLowerCase().includes(searchQuery.toLowerCase())));

      const matchesCategory = categoryFilter === 'all' || article.category === categoryFilter;
      const matchesSentiment = sentimentFilter === 'all' || article.sentimentLabel === sentimentFilter;

      return matchesSearch && matchesCategory && matchesSentiment;
    });

  const decodeHTMLEntities = (text: string) => {
    const element = document.createElement('textarea');
    element.innerHTML = text;
    return element.value;
  };

  const cleanContent = (text?: string) => {
    if (!text) return '';
    // First decode HTML entities, then remove trailing char counts
    return decodeHTMLEntities(text).replace(/\s*\[\+\d+\s+chars\]$/i, '');
  };


  const getShortPreview = (article: NewsArticle) => {
    const source = article.summary || article.content || '';
    const text = cleanContent(source);
    const sentences = text.split(/(?<=[.!?])\s+/);
    return sentences.slice(0, 3).join(' ');
  };

  const normalizeCategory = (
    category?: string,
    title?: string,
    summary?: string,
    content?: string,
    source?: string
  ): NewsArticle['category'] => {
    const c = (category || '').toLowerCase();
    const allowed: Array<NewsArticle['category']> = ['macro','geopolitical','regulation','tech','social','market'];
    if (allowed.includes(c as any)) return c as NewsArticle['category'];
    if (c === 'general' || c === 'business' || c === 'finance') return 'market';
    if (c === 'economy' || c === 'economic') return 'macro';
    if (c === 'policy' || c === 'regulatory') return 'regulation';
    return inferCategory(title, summary, content, source);
  };

  const inferCategory = (title?: string, summary?: string, content?: string, source?: string): NewsArticle['category'] => {
    const t = ((title || '') + ' ' + (summary || '') + ' ' + (content || '') + ' ' + (source || '')).toLowerCase();
    const score: Record<string, number> = { macro: 0, geopolitical: 0, regulation: 0, tech: 0, social: 0, market: 0 };
    const inc = (k: keyof typeof score, w = 1) => { score[k] = (score[k] || 0) + w };
    const has = (kw: string) => t.includes(kw);
    if (has('inflation') || has('interest rate') || has('gdp') || has('unemployment') || has('cpi') || has('ppi') || has('economy')) inc('macro', 2);
    if (has('fed') || has('ecb') || has('bank of england')) inc('macro', 1);
    if (has('sanction') || has('election') || has('war') || has('conflict') || has('geopolitical') || has('china') || has('russia')) inc('geopolitical', 2);
    if (has('sec') || has('cftc') || has('fca') || has('esma') || has('lawsuit') || has('ban') || has('regulation') || has('policy') || has('approval')) inc('regulation', 2);
    if (has('upgrade') || has('fork') || has('merge') || has('release') || has('protocol') || has('bug') || has('vulnerability') || has('ai') || has('technology')) inc('tech', 2);
    if (has('twitter') || has('reddit') || has('influencer') || has('community') || has('social')) inc('social', 2);
    if (has('price') || has('rally') || has('surge') || has('selloff') || has('trading') || has('volatility') || has('volume') || has('market')) inc('market', 2);
    const best = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
    return (best && best[1] > 0 ? (best[0] as NewsArticle['category']) : 'market');
  };

  const getAnalysisNarrative = (article: NewsArticle) => {
    const sentiment = article.sentimentLabel;
    const conf = Math.round((article.confidence || 0) * 100);
    const phrases = (article.analysis?.keyPhrases || []).slice(0, 2).join(', ');
    const entities = (article.analysis?.entities || []).slice(0, 2).map(e => e.name).join(', ');
    const impact = article.analysis?.impactLevel || 'Medium';
    const segment = getCategoryLabel(article.category);
    let text = `Assessment: ${sentiment} (${conf}% confidence).`;
    if (phrases) text += ` Key themes: ${phrases}.`;
    if (entities) text += ` Entities: ${entities}.`;
    text += ` Impact: ${impact} in ${segment} segment.`;
    return text;
  };

  const getAnalysisParagraph = (article: NewsArticle) => {
    const sentiment = article.sentimentLabel;
    const conf = Math.round((article.confidence || 0) * 100);
    const impact = article.analysis?.impactLevel || 'Medium';
    const segment = getCategoryLabel(article.category);
    const source = article.source || 'Unknown';
    const time = formatTimestamp(article.timestamp);
    const phrases = (article.analysis?.keyPhrases || []).slice(0, 2);
    const entities = (article.analysis?.entities || []).slice(0, 3).map(e => e.name);
    const reasons = (article.analysis?.reasoning || []).filter(r => !/parse error|unstructured/i.test(r)).slice(0, 3);

    // Build a comprehensive paragraph
    let paragraph = `${source} (${time}) analysis shows ${sentiment} sentiment with ${impact} impact in the ${segment} sector. `;

    // Add confidence and model info
    const modelInfo = formatModelMeta(article.analysis?.meta);
    paragraph += `With ${conf}% confidence (${modelInfo}), `;

    // Add key insights
    if (reasons.length > 0) {
      paragraph += `the article ${reasons[0].toLowerCase()}`;
      if (reasons.length > 1) {
        paragraph += `. Additionally, ${reasons[1].toLowerCase()}`;
      }
      paragraph += `. `;
    } else {
      paragraph += `the market sentiment appears neutral. `;
    }

    // Add key themes
    if (phrases.length > 0) {
      paragraph += `Key themes include ${phrases.join(' and ')}. `;
    }

    // Add entities if available
    if (entities.length > 0) {
      paragraph += `Notable entities: ${entities.join(', ')}.`;
    }

    return paragraph;
  };

  const formatModelMeta = (meta?: { source?: string; model?: string }) => {
    if (!meta) return 'Unknown';
    if (meta.source === 'Fallback') return 'Local Analyzer';
    if (meta.model && meta.source) return `${meta.model} (${meta.source})`;
    return meta.model || meta.source || 'Unknown';
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

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'macro': return 'Macroeconomic';
      case 'geopolitical': return 'Geopolitical';
      case 'regulation': return 'Regulation';
      case 'tech': return 'Technology';
      case 'social': return 'Social';
      case 'market': return 'Market';
      default: return 'General';
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
              <h1 className="text-2xl font-bold text-foreground">{t('news.title')}</h1>
              <p className="text-sm text-muted-foreground">
                {t('news.subtitle')}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  onClick={handleRefresh}
                  disabled={refreshing}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                  {t('common.refresh')}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('news.refresh_tooltip')}</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  onClick={() => setUseFastMode((v) => !v)}
                  title="Toggle cost saver mode"
                >
                  {t('news.costSaver')}: {useFastMode ? '5' : '10'} {t('news.articles')}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Toggle cost saver mode</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        <Alert className="mt-3">
          <AlertDescription className="text-xs">
            Cost Saver: ON analyzes 5 articles with AI (rest use keyword analysis). OFF analyzes 10 articles with AI. Always uses GLM AI for analysis - only falls back to local heuristics if API fails. Toggle to manage     
  API costs and rate limits.
          </AlertDescription>
        </Alert>

        {/* Market Summary Cards */}
        {marketSummary && marketSummary.aggregatedIndex !== undefined && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Overall Market Sentiment */}
            <Card className="bg-card border-border p-4 shadow-md">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" />
                  <h3 className="text-base font-semibold">{t('news.marketSentiment')}</h3>
                </div>
                <Badge
                  variant="outline"
                  className={`${getMarketSummaryColor(marketSummary.label)} border-current`}
                >
                  {marketSummary.confidence}% {t('news.confidence')}
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
                <h3 className="text-base font-semibold">{t('news.recentTrend')}</h3>
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
                  <div>{t('news.articles')}: {filteredArticles.length} total</div>
                  <div>AI Analysis: {useFastMode ? '5' : '10'} articles analyzed ({useFastMode ? 'Cost Saver ON' : 'Full Analysis'})</div>
                  {filteredArticles.length < newsArticles.length && (
                    <div className="text-xs text-green-600">
                      Showing {filteredArticles.length} of {newsArticles.length} total articles (filtered)
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Key Entities */}
            <Card className="bg-card border-border p-4 shadow-md">
              <div className="flex items-center gap-2 mb-4">
                <Hash className="h-5 w-5 text-primary" />
                <h3 className="text-base font-semibold">{t('news.trendingEntities')}</h3>
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
                <h3 className="text-base font-semibold">{t('news.analysisQuality')}</h3>
              </div>
              <div className="text-sm text-muted-foreground space-y-2">
                <div>Weighted Index: {aggregatedIndexLocal.toFixed(2)}</div>
                <div>Average {t('news.confidence')}: {Math.round((newsArticles.reduce((s, a) => s + (a.confidence ?? 0.5), 0) / newsArticles.length) * 100)}%</div>
                <div>Recent Coverage (6h): {recentCoverageLocal}%</div>
                <div>Source Diversity: {new Set(newsArticles.map(a => a.source)).size}</div>
              </div>
            </Card>

            <Card className="bg-card border-border p-4 shadow-md">
              <div className="flex items-center gap-2 mb-4">
                <Globe className="h-5 w-5 text-primary" />
                <h3 className="text-base font-semibold">{t('news.sourceCoverage')}</h3>
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
                <h3 className="text-base font-semibold">{t('news.controversyIndex')}</h3>
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
              <h3 className="text-lg font-semibold">{t('news.aiPrediction')}</h3>
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
                    {prediction.confidence}% {t('news.confidence')}
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
                <h4 className="font-medium mb-2">{t('news.keyFactors')}</h4>
                <div className="text-sm text-muted-foreground space-y-1 mb-4">
                  {prediction.keyFactorsDetailed ? (
                    <>
                      {(prediction.keyFactorsDetailed.positive || []).map((f, i) => (<div key={`p-${i}`} className="text-green-600">• {f}</div>))}
                      {(prediction.keyFactorsDetailed.neutral || []).map((f, i) => (<div key={`n-${i}`} className="text-yellow-600">• {f}</div>))}
                      {(prediction.keyFactorsDetailed.negative || []).map((f, i) => (<div key={`m-${i}`} className="text-red-600">• {f}</div>))}
                    </>
                  ) : (
                    (prediction.keyFactors || []).map((factor, index) => (
                      <div key={index}>• {factor}</div>
                    ))
                  )}
                </div>
                {prediction.riskFactors && prediction.riskFactors.length > 0 && (
                  <div className="mt-2">
                    <h4 className="font-medium mb-2">{t('news.riskFactors')}</h4>
                    <div className="text-sm text-muted-foreground space-y-1">
                      {prediction.riskFactors.map((risk, i) => (<div key={`r-${i}`}>• {risk}</div>))}
                    </div>
                  </div>
                )}
              </div>

              {/* Column 3: Segment Breakdown */}
              <div>
                <h4 className="font-medium mb-2">{t('news.segmentBreakdown')}</h4>
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
              {prediction.marketSignals && (
                <div>
                  <h4 className="font-medium mb-2">{t('news.marketSignals')}</h4>
                  <div className="text-sm text-muted-foreground grid grid-cols-3 gap-3">
                    <div><div className="font-medium">Volume</div><div>{prediction.marketSignals.volume}</div></div>
                    <div><div className="font-medium">Volatility</div><div>{prediction.marketSignals.volatility}</div></div>
                    <div><div className="font-medium">Momentum</div><div>{prediction.marketSignals.momentum}</div></div>
                  </div>
                </div>
              )}
            </div>

            {/* Row 2: Top Headlines */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-muted/40 border-border p-4">
                <h4 className="font-medium mb-2">{t('news.topPositive')}</h4>
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
                <h4 className="font-medium mb-2">{t('news.topNegative')}</h4>
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
              <h4 className="font-medium mb-2">{t('news.aiReasoning')}</h4>
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
            <h3 className="text-sm font-medium">{t('common.filters')}</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('common.search')}</label>
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
              <label className="text-sm font-medium">{t('news.category')}</label>
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
              <label className="text-sm font-medium">{t('news.sentiment')}</label>
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
                ? t('news.noArticles')
                : t('news.noData')
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
                <h3 className="text-lg font-semibold">{t('news.topHeadlines')}</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">{t('news.positive')}</h4>
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
                  <h4 className="font-medium mb-2">{t('news.negative')}</h4>
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
                        {Math.round((article.confidence || 0) * 100)}% {t('news.confidence')}
                      </Badge>

                      <span className="text-xs text-muted-foreground">
                        {formatTimestamp(article.timestamp)}
                      </span>
                    </div>

                    <div className="text-sm text-muted-foreground mb-3">
                      {article.author && <span>By: {article.author}</span>}
                    </div>

                    <p className="text-sm text-muted-foreground mb-3">
                      {expandedArticles.has(article.id)
                        ? getShortPreview(article)
                        : `${getShortPreview(article).substring(0, 100)}${getShortPreview(article).length > 100 ? '...' : ''}`
                      }
                    </p>


                    {expandedArticles.has(article.id) && (
                      <div className="mt-4 p-4 bg-muted/50 rounded-lg space-y-4">
                        <div className="space-y-2">
                          <div className="font-medium text-sm">{t('news.fullSummary')}:</div>
                          <div className="text-sm text-muted-foreground">
                            {cleanContent(article.content) || article.summary}
                          </div>
                        </div>

                        {article.entities && article.entities.length > 0 && (
                          <div className="space-y-2">
                            <div className="font-medium text-sm">{t('news.keyEntities')}:</div>
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
                            <div className="font-medium text-sm">{t('news.ai_analysis')}:</div>
                            <div className="text-xs text-muted-foreground">
                              Model: {formatModelMeta(article.analysis?.meta)} · {t('news.confidence')}: {Math.round((article.confidence || 0) * 100)}%
                            </div>
                            <p className="text-sm text-foreground mt-2 leading-relaxed">
                              {getAnalysisParagraph(article)}
                            </p>

                            {(article.analysis.keyPhrases || []).length > 0 && (
                              <div className="space-y-2">
                                <div className="font-medium text-sm">{t('news.keyPhrases')}:</div>
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
                                <div className="font-medium text-sm">{t('news.emotionalIndicators')}:</div>
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
                              <div className="font-medium text-sm">{t('news.impact')}:</div>
                              <div className="text-sm text-muted-foreground">
                                <div>Level: {article.analysis.impactLevel || 'Unknown'}</div>
                                <div>Segment: {getCategoryLabel(article.category)}</div>
                                <div className="flex items-center gap-2">
                                  Direction: {getSentimentIcon(article.sentimentLabel)}
                                  <span className="capitalize">{article.sentimentLabel}</span>
                                  <span className="text-xs">({Math.round((article.confidence || 0) * 100)}% {t('news.confidence')})</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleArticleExpansion(article.id)}
                        >
                          {expandedArticles.has(article.id) ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                          {expandedArticles.has(article.id) ? t('news.hideDetails') : t('news.showDetails')}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{expandedArticles.has(article.id) ? t('news.hideDetails') : t('news.showDetails')}</p>
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button asChild variant="outline" size="sm">
                          <a href={article.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            {t('news.read_more')}
                          </a>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t('news.read_more')}</p>
                      </TooltipContent>
                    </Tooltip>
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
