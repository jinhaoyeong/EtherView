"use client";

import { ResearchHeader } from "@/components/shared/research-header";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useState, useEffect, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  BarChart3,
  Activity,
  Globe,
  Newspaper,
  Star,
  AlertTriangle,
} from "lucide-react";
import { useWallet } from "@/contexts/wallet-context";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";

interface NewsArticle {
  id: string;
  title: string;
  source: string;
  url: string;
  timestamp: number;
  summary: string;
  content?: string;
  sentimentScore: number; // -1 to 1
  sentimentLabel: "bullish" | "neutral" | "bearish";
  confidence: number; // 0 to 1
  entities: string[];
  category:
    "macro" | "geopolitical" | "regulation" | "tech" | "social" | "market";
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
    impactLevel?: "Low" | "Medium" | "High" | "Critical";
    marketSegment?: "Crypto" | "Traditional" | "Macro" | "Regulatory";
    entities?: Array<{ name: string; sentiment: number; relevance: number }>;
    meta?: { source?: string; model?: string };
  };
}

interface MarketSummary {
  aggregatedIndex: number; // -1 to 1
  label: "BULLISH" | "NEUTRAL" | "BEARISH";
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
  recentTrend: "up" | "down" | "stable";
  newsCount: number;
  lastUpdated: number;
}

interface Prediction {
  trend: "bullish" | "neutral" | "bearish";
  confidence: number;
  reasoning: string[];
  timeHorizon: "short" | "medium" | "long";
  targetPrice?: number;
  keyFactors: string[];
  riskFactors?: string[];
  keyFactorsDetailed?: {
    positive: string[];
    negative: string[];
    neutral: string[];
  };
  marketSignals?: {
    volume: "High" | "Medium" | "Low";
    volatility: "High" | "Medium" | "Low";
    momentum: "Strong" | "Moderate" | "Weak";
  };
  technicalIndicators?: {
    rsi?: number;
    macd?: number;
    bollinger?: "Upper" | "Middle" | "Lower";
    support?: number;
    resistance?: number;
  };
}

const newsCache = new Map<
  string,
  {
    data: {
      marketSummary: MarketSummary | null;
      newsArticles: NewsArticle[];
      prediction: Prediction | null;
    };
    timestamp: number;
  }
>();
const NEWS_CACHE_DURATION = 120000;
const confidenceRatio = (value: unknown, fallback = 0) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value > 1 ? value / 100 : value))
    : fallback;

const normalizeCategory = (
  category?: string,
  title?: string,
  summary?: string,
  content?: string,
  source?: string,
): NewsArticle["category"] => {
  const c = (category || "").toLowerCase();
  const allowed: Array<NewsArticle["category"]> = [
    "macro",
    "geopolitical",
    "regulation",
    "tech",
    "social",
    "market",
  ];
  if (allowed.includes(c as NewsArticle["category"]))
    return c as NewsArticle["category"];
  if (c === "general" || c === "business" || c === "finance") return "market";
  if (c === "economy" || c === "economic") return "macro";
  if (c === "policy" || c === "regulatory") return "regulation";
  return inferCategory(title, summary, content, source);
};

const inferCategory = (
  title?: string,
  summary?: string,
  content?: string,
  source?: string,
): NewsArticle["category"] => {
  const t = (
    (title || "") +
    " " +
    (summary || "") +
    " " +
    (content || "") +
    " " +
    (source || "")
  ).toLowerCase();
  const score: Record<string, number> = {
    macro: 0,
    geopolitical: 0,
    regulation: 0,
    tech: 0,
    social: 0,
    market: 0,
  };
  const inc = (k: keyof typeof score, w = 1) => {
    score[k] = (score[k] || 0) + w;
  };
  const has = (kw: string) => t.includes(kw);
  if (
    has("inflation") ||
    has("interest rate") ||
    has("gdp") ||
    has("unemployment") ||
    has("cpi") ||
    has("ppi") ||
    has("economy")
  )
    inc("macro", 2);
  if (has("fed") || has("ecb") || has("bank of england")) inc("macro", 1);
  if (
    has("sanction") ||
    has("election") ||
    has("war") ||
    has("conflict") ||
    has("geopolitical") ||
    has("china") ||
    has("russia")
  )
    inc("geopolitical", 2);
  if (
    has("sec") ||
    has("cftc") ||
    has("fca") ||
    has("esma") ||
    has("lawsuit") ||
    has("ban") ||
    has("regulation") ||
    has("policy") ||
    has("approval")
  )
    inc("regulation", 2);
  if (
    has("upgrade") ||
    has("fork") ||
    has("merge") ||
    has("release") ||
    has("protocol") ||
    has("bug") ||
    has("vulnerability") ||
    has("ai") ||
    has("technology")
  )
    inc("tech", 2);
  if (
    has("twitter") ||
    has("reddit") ||
    has("influencer") ||
    has("community") ||
    has("social")
  )
    inc("social", 2);
  if (
    has("price") ||
    has("rally") ||
    has("surge") ||
    has("selloff") ||
    has("trading") ||
    has("volatility") ||
    has("volume") ||
    has("market")
  )
    inc("market", 2);
  const best = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] > 0 ? (best[0] as NewsArticle["category"]) : "market";
};

export default function NewsSentiment() {
  const { walletAddress, handleDisconnect } = useWallet();
  const [marketSummary, setMarketSummary] = useState<MarketSummary | null>(
    null,
  );
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDataCached, setIsDataCached] = useState(false);
  const [useFastMode, setUseFastMode] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sentimentFilter, setSentimentFilter] = useState<string>("all");
  const [expandedArticles, setExpandedArticles] = useState<Set<string>>(
    new Set(),
  );
  const request = useRef(0);

  const loadNewsSentiment = useCallback(
    async (address: string, forceRefresh: boolean = false) => {
      const requestId = ++request.current;
      try {
        const t0 =
          typeof performance !== "undefined" ? performance.now() : Date.now();
        setError(null);

        const cacheKey = `${address}_${useFastMode ? "fast" : "full"}`;
        if (!forceRefresh) {
          const cached = newsCache.get(cacheKey);
          const now = Date.now();
          if (cached && now - cached.timestamp < NEWS_CACHE_DURATION) {
            setMarketSummary(cached.data.marketSummary);
            setNewsArticles(cached.data.newsArticles);
            setPrediction(cached.data.prediction);
            setIsDataCached(true);
            setLoading(false);
            return;
          }
        }

        setLoading(true);
        setIsDataCached(false);

        const res = await fetch(
          `/api/news-sentiment?${address ? `walletAddress=${encodeURIComponent(address)}&` : ""}forceRefresh=${forceRefresh ? 1 : 0}&fast=${useFastMode ? 1 : 0}`,
          { signal: AbortSignal.timeout(30_000) },
        );
        if (!res.ok) {
          throw new Error(
            "News providers are temporarily unavailable. Retry to load the briefing.",
          );
        }
        const apiResponse = await res.json();

        // Handle the new API response structure with success/data wrapper
        if (apiResponse.success === false)
          throw new Error(
            "The news provider could not return a briefing. Please try again.",
          );
        const sentimentResult = apiResponse.success
          ? apiResponse.data
          : apiResponse;

        const transformedArticles: NewsArticle[] = (
          Array.isArray(sentimentResult?.articles)
            ? sentimentResult.articles
            : []
        )
          .filter((article: { publishedAt?: string; url?: string }) => {
            const ts = new Date(article.publishedAt || "").getTime();
            const oneMonthMs = 30 * 24 * 60 * 60 * 1000;
            return (
              /^https?:\/\//i.test(article.url || "") &&
              ts &&
              ts <= Date.now() &&
              Date.now() - ts <= oneMonthMs
            );
          })
          .map(
            (article: {
              id: string;
              title?: string;
              source?: string;
              url?: string;
              publishedAt?: string;
              summary?: string;
              content?: string;
              sentiment?: {
                score?: number;
                label?: string;
                confidence?: number;
                reasoning?: string[] | string;
                keyPhrases?: string[];
                emotionalIndicators?: NonNullable<
                  NewsArticle["analysis"]
                >["emotionalIndicators"];
                entities?: Array<{
                  name: string;
                  sentiment: number;
                  relevance: number;
                }>;
                meta?: { source?: string; model?: string };
                impactLevel?: "Low" | "Medium" | "High" | "Critical";
                marketSegment?:
                  "Crypto" | "Traditional" | "Macro" | "Regulatory";
              };
              onChainMetadata?: { mentionedTokens?: string[] };
              entities?: string[];
              category?: string;
              author?: string;
            }) => ({
              id: article.id,
              title: article.title || "Untitled",
              source: article.source || "Unknown",
              url: article.url || "#",
              timestamp: new Date(article.publishedAt || "").getTime(),
              summary: article.summary || "No summary available",
              content: article.content || undefined,
              sentimentScore:
                typeof article.sentiment?.score === "number"
                  ? article.sentiment.score
                  : 0,
              sentimentLabel: (
                article.sentiment?.label || "Neutral"
              ).toLowerCase() as "bullish" | "neutral" | "bearish",
              confidence: confidenceRatio(article.sentiment?.confidence),
              entities:
                article.onChainMetadata?.mentionedTokens &&
                article.onChainMetadata.mentionedTokens.length > 0
                  ? article.onChainMetadata.mentionedTokens
                  : article.entities || [],
              category: normalizeCategory(
                article.category as string,
                article.title,
                article.summary,
                article.content,
                article.source,
              ),
              author: article.author || undefined,
              analysis: article.sentiment
                ? {
                    reasoning: Array.isArray(article.sentiment.reasoning)
                      ? article.sentiment.reasoning
                      : article.sentiment.reasoning
                        ? [article.sentiment.reasoning]
                        : [],
                    keyPhrases: Array.isArray(article.sentiment.keyPhrases)
                      ? article.sentiment.keyPhrases
                      : [],
                    emotionalIndicators: article.sentiment.emotionalIndicators,
                    impactLevel: article.sentiment.impactLevel,
                    marketSegment: article.sentiment.marketSegment,
                    entities: Array.isArray(article.sentiment.entities)
                      ? article.sentiment.entities
                      : [],
                    meta: article.sentiment.meta,
                  }
                : undefined,
            }),
          );

        const recencyWeight = (ts: number) => {
          const ageHours = (Date.now() - ts) / (1000 * 60 * 60);
          const halfLifeHours = 6;
          return Math.exp((-Math.log(2) * ageHours) / halfLifeHours);
        };

        const weighted = transformedArticles.map((a) => {
          const baseScore =
            typeof a.sentimentScore === "number"
              ? a.sentimentScore
              : a.sentimentLabel === "bullish"
                ? 0.25
                : a.sentimentLabel === "bearish"
                  ? -0.25
                  : 0;
          const conf = Math.min(Math.max(a.confidence ?? 0.5, 0), 1);
          const w =
            conf *
            (0.5 + recencyWeight(a.timestamp) * 0.5) *
            (1 + (a.entities?.length || 0) * 0.05);
          return { score: baseScore, weight: w };
        });

        const totalWeight = weighted.reduce((s, x) => s + x.weight, 0);
        const derivedAggregatedIndex =
          totalWeight > 0
            ? weighted.reduce((s, x) => s + x.score * x.weight, 0) / totalWeight
            : 0;

        const last6h = transformedArticles.filter(
          (a) => Date.now() - a.timestamp < 6 * 60 * 60 * 1000,
        );
        const prev6h = transformedArticles.filter(
          (a) =>
            Date.now() - a.timestamp >= 6 * 60 * 60 * 1000 &&
            Date.now() - a.timestamp < 12 * 60 * 60 * 1000,
        );
        const avg = (arr: NewsArticle[]) => {
          const data = arr.map((a) => {
            const baseScore =
              typeof a.sentimentScore === "number"
                ? a.sentimentScore
                : a.sentimentLabel === "bullish"
                  ? 0.25
                  : a.sentimentLabel === "bearish"
                    ? -0.25
                    : 0;
            const conf = Math.min(Math.max(a.confidence ?? 0.5, 0), 1);
            const w = conf * (0.5 + recencyWeight(a.timestamp) * 0.5);
            return { score: baseScore, weight: w };
          });
          const tw = data.reduce((s, x) => s + x.weight, 0);
          return tw > 0
            ? data.reduce((s, x) => s + x.score * x.weight, 0) / tw
            : 0;
        };
        const lastAvg = avg(last6h);
        const prevAvg = avg(prev6h);
        const derivedTrend: "up" | "down" | "stable" =
          lastAvg - prevAvg > 0.03
            ? "up"
            : lastAvg - prevAvg < -0.03
              ? "down"
              : "stable";

        const extractEntitiesLocal = (text: string): string[] => {
          const t = text.toLowerCase();
          const financialEntities = [
            "federal reserve",
            "fed",
            "ecb",
            "bank of england",
            "sec",
            "cftc",
            "fca",
            "esma",
            "mas",
            "asic",
            "blackrock",
            "fidelity",
            "goldman sachs",
            "jpmorgan",
          ];
          const cryptoEntities = [
            "bitcoin",
            "btc",
            "ethereum",
            "eth",
            "tether",
            "usdt",
            "usdc",
            "binance",
            "coinbase",
            "kraken",
            "gemini",
            "uniswap",
            "compound",
            "aave",
          ];
          const tokens = [...financialEntities, ...cryptoEntities];
          const found: string[] = [];
          tokens.forEach((e) => {
            if (t.includes(e)) found.push(e.toUpperCase());
          });
          return Array.from(new Set(found)).slice(0, 12);
        };
        const entityCounts: Record<string, number> = {};
        transformedArticles.forEach((a) => {
          const text = (a.title + " " + (a.summary || "")).toLowerCase();
          const ents =
            a.entities && a.entities.length > 0
              ? a.entities.map((e) => e.toUpperCase())
              : extractEntitiesLocal(text);
          ents.forEach((e) => {
            const conf = Math.min(Math.max(a.confidence ?? 0.5, 0), 1);
            const inc = conf * (0.5 + recencyWeight(a.timestamp) * 0.5);
            entityCounts[e] = (entityCounts[e] || 0) + inc;
          });
        });
        const entityEntries = Object.entries(entityCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 6);
        const sumEntities = entityEntries.reduce((s, [, v]) => s + v, 0) || 1;
        const derivedTopEntities = entityEntries.map(([entity, v]) => ({
          entity,
          influenceScore: Math.min(1, v / sumEntities),
        }));

        const avgConfidence =
          transformedArticles.length > 0
            ? Math.round(
                (transformedArticles.reduce(
                  (s, a) => s + (a.confidence ?? 0.5),
                  0,
                ) /
                  transformedArticles.length) *
                  100,
              )
            : 0;

        const bullWeightLocal = weighted
          .filter((x) => x.score > 0.1)
          .reduce((s, x) => s + x.weight, 0);
        const bearWeightLocal = weighted
          .filter((x) => x.score < -0.1)
          .reduce((s, x) => s + x.weight, 0);
        const bullRatioLocal =
          totalWeight > 0 ? bullWeightLocal / totalWeight : 0;
        const bearRatioLocal =
          totalWeight > 0 ? bearWeightLocal / totalWeight : 0;
        const labelFallback = (() => {
          if (
            derivedAggregatedIndex <= -0.03 ||
            bearRatioLocal - bullRatioLocal >= 0.2
          )
            return "BEARISH";
          if (
            derivedAggregatedIndex >= 0.03 ||
            bullRatioLocal - bearRatioLocal >= 0.2
          )
            return "BULLISH";
          return "NEUTRAL";
        })();

        const transformedMarketSummary: MarketSummary = {
          aggregatedIndex:
            typeof sentimentResult.marketSummary?.aggregatedIndex ===
              "number" && sentimentResult.marketSummary.aggregatedIndex !== 0
              ? sentimentResult.marketSummary.aggregatedIndex
              : derivedAggregatedIndex,
          label: (
            sentimentResult.marketSummary?.label || labelFallback
          ).toUpperCase() as "BULLISH" | "NEUTRAL" | "BEARISH",
          confidence:
            sentimentResult.marketSummary?.confidence != null
              ? Math.round(
                  confidenceRatio(sentimentResult.marketSummary.confidence) *
                    100,
                )
              : avgConfidence,
          topInfluencers: sentimentResult.marketSummary?.topInfluencers || [],
          topEntities:
            (sentimentResult.marketSummary?.topEntities || []).length > 0
              ? (sentimentResult.marketSummary?.topEntities || []).map(
                  (entity: { entity: string; influenceScore: number }) => ({
                    entity: entity.entity,
                    influenceScore: entity.influenceScore,
                  }),
                )
              : derivedTopEntities,
          recentTrend: (() => {
            if (sentimentResult.marketSummary?.trendIndicator === "rising")
              return "up";
            if (sentimentResult.marketSummary?.trendIndicator === "falling")
              return "down";
            if (
              derivedAggregatedIndex <= -0.03 ||
              bearRatioLocal - bullRatioLocal >= 0.2
            )
              return "down";
            if (
              derivedAggregatedIndex >= 0.03 ||
              bullRatioLocal - bearRatioLocal >= 0.2
            )
              return "up";
            return derivedTrend;
          })(),
          newsCount: transformedArticles.length,
          lastUpdated: Date.now(),
        };

        const predictionTrend: "bullish" | "neutral" | "bearish" =
          derivedAggregatedIndex <= -0.03 ||
          bearRatioLocal - bullRatioLocal >= 0.2
            ? "bearish"
            : derivedAggregatedIndex >= 0.03 ||
                bullRatioLocal - bearRatioLocal >= 0.2
              ? "bullish"
              : "neutral";

        const timeHorizon: "short" | "medium" | "long" =
          predictionTrend !== "neutral" ? "short" : "medium";

        const apiPred = sentimentResult.marketSummary?.prediction;
        const transformedPrediction: Prediction = apiPred
          ? {
              trend: (apiPred.trend || "Neutral").toLowerCase() as
                "bullish" | "neutral" | "bearish",
              confidence: Math.round(confidenceRatio(apiPred.confidence) * 100),
              reasoning: apiPred.reasoning || [],
              timeHorizon: (apiPred.timeHorizon || "Short-term (4-24h)")
                .toLowerCase()
                .includes("short")
                ? "short"
                : "medium",
              targetPrice: apiPred.targetPrice,
              keyFactors: [
                ...(apiPred.keyFactors?.positive || []),
                ...(apiPred.keyFactors?.neutral || []),
                ...(apiPred.keyFactors?.negative || []),
              ],
              riskFactors: apiPred.riskFactors || [],
              keyFactorsDetailed: apiPred.keyFactors || {
                positive: [],
                negative: [],
                neutral: [],
              },
              marketSignals: apiPred.marketSignals,
              technicalIndicators: apiPred.technicalIndicators,
            }
          : {
              trend: predictionTrend,
              confidence: avgConfidence,
              reasoning: [
                `Aggregated index ${derivedAggregatedIndex.toFixed(2)}`,
                `Bull/Bear ratio ${Math.round(bullRatioLocal * 100)}%/${Math.round(bearRatioLocal * 100)}%`,
              ],
              timeHorizon,
              keyFactors: [
                "Market sentiment",
                "News flow",
                "Entity analysis",
                "Trading patterns",
              ],
            };

        if (requestId !== request.current) return;
        const observedSummary = transformedArticles.length
          ? transformedMarketSummary
          : null;
        const observedPrediction = transformedArticles.length
          ? transformedPrediction
          : null;
        setMarketSummary(observedSummary);
        setNewsArticles(transformedArticles);
        setPrediction(observedPrediction);
        setIsDataCached(false);

        newsCache.set(cacheKey, {
          data: {
            marketSummary: observedSummary,
            newsArticles: transformedArticles,
            prediction: observedPrediction,
          },
          timestamp: Date.now(),
        });
        const t1 =
          typeof performance !== "undefined" ? performance.now() : Date.now();
        const duration = Math.round(t1 - t0);
        try {
          fetch("/api/metrics", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: "tab_news_loaded",
              value: duration,
            }),
          }).catch(() => {});
        } catch {}
      } catch (err) {
        if (requestId !== request.current) return;
        setError(
          err instanceof Error &&
            (err.name === "TimeoutError" || err.name === "AbortError")
            ? "The news request timed out. Try again in a moment."
            : err instanceof Error
              ? err.message
              : "Market coverage could not be loaded. Please try again.",
        );
        try {
          fetch("/api/metrics", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: "tab_news_failed",
            }),
          }).catch(() => {});
        } catch {}
      } finally {
        if (requestId === request.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [useFastMode],
  );

  useEffect(() => {
    setExpandedArticles(new Set());
    void loadNewsSentiment(walletAddress || "");
    const lifecycle = request;
    return () => {
      lifecycle.current++;
    };
  }, [walletAddress, loadNewsSentiment]);

  const handleRefresh = async () => {
    if (loading || refreshing) return;
    setRefreshing(true);
    setIsDataCached(false);
    await loadNewsSentiment(walletAddress || "", true);
  };

  useAutoRefresh(handleRefresh, true, 300);

  const toggleArticleExpansion = (articleId: string) => {
    setExpandedArticles((prev) => {
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
      case "bullish":
        return <TrendingUp className="h-4 w-4 text-emerald-500" />;
      case "bearish":
        return <TrendingDown className="h-4 w-4 text-rose-400" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case "bullish":
        return "text-emerald-500 bg-emerald-500/10";
      case "bearish":
        return "text-rose-400 bg-rose-400/10";
      default:
        return "text-muted-foreground bg-muted/50";
    }
  };

  const getMarketSummaryColor = (label: string) => {
    switch (label) {
      case "BULLISH":
        return "text-emerald-500";
      case "BEARISH":
        return "text-rose-400";
      default:
        return "text-primary";
    }
  };

  const getSourceIcon = (source: string, category: string) => {
    // First try to match specific news sources
    const sourceLower = source.toLowerCase();
    if (
      sourceLower.includes("reuters") ||
      sourceLower.includes("bloomberg") ||
      sourceLower.includes("ft")
    ) {
      return <BarChart3 className="h-4 w-4" />;
    }
    if (
      sourceLower.includes("coindesk") ||
      sourceLower.includes("cointelegraph") ||
      sourceLower.includes("theblock")
    ) {
      return <Zap className="h-4 w-4" />;
    }
    if (sourceLower.includes("sec") || sourceLower.includes("regulation")) {
      return <Star className="h-4 w-4" />;
    }
    if (sourceLower.includes("reddit")) {
      return <MessageCircle className="h-4 w-4" />;
    }

    // Fall back to category-based icons
    switch (category) {
      case "macro":
        return <BarChart3 className="h-4 w-4" />;
      case "geopolitical":
        return <Globe className="h-4 w-4" />;
      case "regulation":
        return <Star className="h-4 w-4" />;
      case "tech":
        return <Zap className="h-4 w-4" />;
      case "social":
        return <MessageCircle className="h-4 w-4" />;
      case "market":
        return <Activity className="h-4 w-4" />;
      default:
        return <Newspaper className="h-4 w-4" />;
    }
  };

  const filteredArticles = newsArticles.filter((article) => {
    const matchesSearch =
      !searchQuery ||
      (article.title &&
        article.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (article.summary &&
        article.summary.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (article.entities &&
        article.entities.some((entity) =>
          entity.toLowerCase().includes(searchQuery.toLowerCase()),
        ));

    const matchesCategory =
      categoryFilter === "all" || article.category === categoryFilter;
    const matchesSentiment =
      sentimentFilter === "all" || article.sentimentLabel === sentimentFilter;

    return matchesSearch && matchesCategory && matchesSentiment;
  });

  const decodeHTMLEntities = (text: string) => {
    const element = document.createElement("textarea");
    element.innerHTML = text;
    return element.value;
  };

  const cleanContent = (text?: string) => {
    if (!text) return "";
    // First decode HTML entities, then remove trailing char counts
    return decodeHTMLEntities(text).replace(/\s*\[\+\d+\s+chars\]$/i, "");
  };

  const getShortPreview = (article: NewsArticle) => {
    const source = article.summary || article.content || "";
    const text = cleanContent(source);
    const sentences = text.split(/(?<=[.!?])\s+/);
    return sentences.slice(0, 3).join(" ");
  };

  const formatModelMeta = (meta?: { source?: string; model?: string }) => {
    if (!meta) return "Unknown";
    if (meta.source === "Fallback") return "Local Analyzer";
    if (meta.model && meta.source) return `${meta.model} (${meta.source})`;
    return meta.model || meta.source || "Unknown";
  };

  const formatTimestamp = (timestamp: number) => {
    const now = Date.now();
    const diff = Math.max(0, now - timestamp);
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
      case "macro":
        return "Macroeconomic";
      case "geopolitical":
        return "Geopolitical";
      case "regulation":
        return "Regulation";
      case "tech":
        return "Technology";
      case "social":
        return "Social";
      case "market":
        return "Market";
      default:
        return "General";
    }
  };

  const recencyWeightLocal = (ts: number) => {
    const ageHours = (Date.now() - ts) / (1000 * 60 * 60);
    const halfLifeHours = 6;
    return Math.exp((-Math.log(2) * ageHours) / halfLifeHours);
  };

  const weightedLocal = newsArticles.map((a) => {
    const baseScore =
      typeof a.sentimentScore === "number"
        ? a.sentimentScore
        : a.sentimentLabel === "bullish"
          ? 0.25
          : a.sentimentLabel === "bearish"
            ? -0.25
            : 0;
    const conf = Math.min(Math.max(a.confidence ?? 0.5, 0), 1);
    const w =
      conf *
      (0.5 + recencyWeightLocal(a.timestamp) * 0.5) *
      (1 + (a.entities?.length || 0) * 0.05);
    return { score: baseScore, weight: w, source: a.source };
  });

  const totalWLocal = weightedLocal.reduce((s, x) => s + x.weight, 0);
  const aggregatedIndexLocal =
    totalWLocal > 0
      ? weightedLocal.reduce((s, x) => s + x.score * x.weight, 0) / totalWLocal
      : 0;
  const sourceCoverageLocal = Array.from(
    new Set(newsArticles.map((a) => a.source)),
  )
    .map((src) => {
      const count = newsArticles.filter((a) => a.source === src).length;
      const pct = Math.round((count / Math.max(newsArticles.length, 1)) * 100);
      return { source: src, pct };
    })
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 5);
  const controversyIndexLocal = (() => {
    if (weightedLocal.length === 0) return 0;
    // Measure disagreement across articles (weighted standard deviation)
    const mean = aggregatedIndexLocal;
    const varArticles =
      weightedLocal.reduce(
        (sum, x) => sum + x.weight * Math.pow(x.score - mean, 2),
        0,
      ) / Math.max(totalWLocal, 1);
    const stdArticles = Math.sqrt(varArticles);
    const normStd = Math.max(0, Math.min(1, stdArticles / 0.5));

    // Measure disagreement across sources
    const bySource: Record<string, { s: number; w: number }> = {};
    weightedLocal.forEach((x) => {
      const key = x.source;
      if (!bySource[key]) bySource[key] = { s: 0, w: 0 };
      bySource[key].s += x.score * x.weight;
      bySource[key].w += x.weight;
    });
    const avgs = Object.values(bySource).map((v) =>
      v.w > 0 ? v.s / v.w : mean,
    );
    const meanSrc = avgs.reduce((a, b) => a + b, 0) / Math.max(avgs.length, 1);
    const varSrc =
      avgs.reduce((sum, val) => sum + Math.pow(val - meanSrc, 2), 0) /
      Math.max(avgs.length, 1);
    const normVarSrc = Math.max(0, Math.min(1, Math.sqrt(varSrc) / 0.5));

    // Mix score: higher when bull and bear both present
    const bullW = weightedLocal
      .filter((x) => x.score > 0.1)
      .reduce((s, x) => s + x.weight, 0);
    const bearW = weightedLocal
      .filter((x) => x.score < -0.1)
      .reduce((s, x) => s + x.weight, 0);
    const mix =
      bullW > 0 && bearW > 0
        ? 1 - Math.abs(bullW - bearW) / Math.max(totalWLocal, 1)
        : 0;

    return Math.max(normStd, normVarSrc, mix * 0.8);
  })();
  const recentCoverageLocal = Math.round(
    (newsArticles.filter((a) => Date.now() - a.timestamp < 6 * 60 * 60 * 1000)
      .length /
      Math.max(newsArticles.length, 1)) *
      100,
  );

  const weightedSentimentsLocal = newsArticles.map((a) => {
    const baseScore =
      typeof a.sentimentScore === "number"
        ? a.sentimentScore
        : a.sentimentLabel === "bullish"
          ? 0.25
          : a.sentimentLabel === "bearish"
            ? -0.25
            : 0;
    const conf = Math.min(Math.max(a.confidence ?? 0.5, 0), 1);
    const w = conf * (0.5 + recencyWeightLocal(a.timestamp) * 0.5);
    return { score: baseScore, weight: w, category: a.category };
  });
  const totalWSent =
    weightedSentimentsLocal.reduce((s, x) => s + x.weight, 0) || 1;
  const bullPctLocal = Math.round(
    (weightedSentimentsLocal
      .filter((x) => x.score > 0.1)
      .reduce((s, x) => s + x.weight, 0) /
      totalWSent) *
      100,
  );
  const bearPctLocal = Math.round(
    (weightedSentimentsLocal
      .filter((x) => x.score < -0.1)
      .reduce((s, x) => s + x.weight, 0) /
      totalWSent) *
      100,
  );
  const neutralPctLocal = Math.max(0, 100 - bullPctLocal - bearPctLocal);
  const segmentWeightsLocal: Record<string, number> = {};
  weightedSentimentsLocal.forEach((x) => {
    const key = x.category || "general";
    segmentWeightsLocal[key] = (segmentWeightsLocal[key] || 0) + x.weight;
  });
  const segmentEntriesLocal = Object.entries(segmentWeightsLocal)
    .map(([k, v]) => ({ seg: k, pct: Math.round((v / totalWSent) * 100) }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 5);

  return (
    <DashboardLayout
      walletAddress={walletAddress || ""}
      onDisconnect={handleDisconnect}
    >
      <div className="workspace-page research-page space-y-7">
        <ResearchHeader
          index="05"
          category="Beyond the numbers"
          title="Ethereum briefing"
          description="The stories, sources, and sentiment shaping the Ethereum conversation."
          tone="lilac"
        >
          <div className="flex flex-wrap gap-2">
            <Select
              value={useFastMode ? "fast" : "full"}
              onValueChange={(value) => setUseFastMode(value === "fast")}
            >
              <SelectTrigger className="w-44" aria-label="Analysis depth">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fast">Brief · 5 articles</SelectItem>
                <SelectItem value="full">Extended · 10 articles</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={loading || refreshing}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
              Refresh briefing
            </Button>
          </div>
        </ResearchHeader>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-5 text-sm"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <p>{error}</p>
              <Button
                variant="link"
                onClick={handleRefresh}
                className="h-auto px-0 py-2"
              >
                Try again
              </Button>
            </div>
          </div>
        )}

        {loading && newsArticles.length === 0 ? (
          <div
            role="status"
            aria-label="Loading market briefing"
            className="space-y-4"
          >
            <div className="h-52 animate-pulse rounded-lg bg-muted" />
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
              {Array.from({ length: 2 }, (_, index) => (
                <div
                  key={index}
                  className="h-64 animate-pulse rounded-lg bg-muted"
                />
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Gathering recent coverage and analyzing sentiment…
            </p>
          </div>
        ) : (
          <>
            {newsArticles.length > 0 && marketSummary && (
              <Card className="surface-panel gap-0 overflow-hidden p-0">
                <div className="grid lg:grid-cols-[1.4fr_1fr]">
                  <div className="border-b border-border p-6 lg:border-b-0 lg:border-r">
                    <div className="flex items-center gap-2">
                      <span className="h-1 w-3 bg-primary" />
                      <p className="eyebrow">Coverage sentiment</p>
                      {isDataCached && (
                        <Badge
                          variant="outline"
                          className="ml-auto text-[10px]"
                        >
                          Cached briefing
                        </Badge>
                      )}
                    </div>
                    <div className="mt-5 flex items-center gap-3">
                      <span
                        className={`text-2xl font-medium capitalize tracking-tight sm:text-3xl ${getMarketSummaryColor(marketSummary.label)}`}
                      >
                        {marketSummary.label.toLowerCase()}
                      </span>
                      {getSentimentIcon(marketSummary.label.toLowerCase())}
                    </div>
                    <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
                      A snapshot of sentiment across {newsArticles.length}{" "}
                      recent stories from{" "}
                      {
                        new Set(newsArticles.map((article) => article.source))
                          .size
                      }{" "}
                      sources.
                    </p>
                    <div
                      className="mt-6 flex h-2 overflow-hidden rounded-full bg-muted"
                      aria-label={`Sentiment distribution: ${bullPctLocal}% bullish, ${neutralPctLocal}% neutral, ${bearPctLocal}% bearish`}
                    >
                      <span
                        className="bg-emerald-400"
                        style={{ width: `${bullPctLocal}%` }}
                      />
                      <span
                        className="bg-slate-400"
                        style={{ width: `${neutralPctLocal}%` }}
                      />
                      <span
                        className="bg-rose-400"
                        style={{ width: `${bearPctLocal}%` }}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
                      <span>Bullish {bullPctLocal}%</span>
                      <span>Neutral {neutralPctLocal}%</span>
                      <span>Bearish {bearPctLocal}%</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-5 p-6 sm:p-8">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Weighted sentiment
                      </p>
                      <p className="mt-2 text-2xl font-semibold tabular-nums">
                        {aggregatedIndexLocal > 0 ? "+" : ""}
                        {aggregatedIndexLocal.toFixed(2)}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Scale: −1 bearish to +1 bullish
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Average confidence
                      </p>
                      <p className="mt-2 text-2xl font-semibold tabular-nums">
                        {Math.round(
                          (newsArticles.reduce(
                            (sum, article) => sum + article.confidence,
                            0,
                          ) /
                            newsArticles.length) *
                            100,
                        )}
                        %
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Reported by the analysis method
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Source disagreement
                      </p>
                      <p className="mt-2 text-2xl font-semibold tabular-nums">
                        {Math.round(controversyIndexLocal * 100)}%
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Higher means more mixed coverage
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Stories from last 6h
                      </p>
                      <p className="mt-2 text-2xl font-semibold tabular-nums">
                        {recentCoverageLocal}%
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Updated {formatTimestamp(marketSummary.lastUpdated)}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_290px]">
              <section className="min-w-0 space-y-4">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">Recent stories</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Published coverage with source links and analysis notes.
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {filteredArticles.length} stories
                  </span>
                </div>

                <div className="surface-panel grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-[1.4fr_1fr_1fr]">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      aria-label="Search news"
                      placeholder="Search stories or entities"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select
                    value={categoryFilter}
                    onValueChange={setCategoryFilter}
                  >
                    <SelectTrigger
                      className="w-full"
                      aria-label="News category"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      <SelectItem value="macro">Macroeconomic</SelectItem>
                      <SelectItem value="geopolitical">Geopolitical</SelectItem>
                      <SelectItem value="regulation">Regulation</SelectItem>
                      <SelectItem value="tech">Technology</SelectItem>
                      <SelectItem value="social">Social</SelectItem>
                      <SelectItem value="market">Market</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={sentimentFilter}
                    onValueChange={setSentimentFilter}
                  >
                    <SelectTrigger
                      className="w-full"
                      aria-label="News sentiment"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All sentiment</SelectItem>
                      <SelectItem value="bullish">Bullish</SelectItem>
                      <SelectItem value="neutral">Neutral</SelectItem>
                      <SelectItem value="bearish">Bearish</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {filteredArticles.length === 0 ? (
                  <Card className="surface-panel items-center px-6 py-14 text-center">
                    <Newspaper className="mb-4 h-6 w-6 text-muted-foreground" />
                    <h3 className="font-semibold">
                      {searchQuery ||
                      categoryFilter !== "all" ||
                      sentimentFilter !== "all"
                        ? "No stories match these filters"
                        : "No recent coverage available"}
                    </h3>
                    <p className="mt-2 max-w-md text-sm text-muted-foreground">
                      {searchQuery ||
                      categoryFilter !== "all" ||
                      sentimentFilter !== "all"
                        ? "Try another topic, category or sentiment."
                        : "Recent stories will appear here when a news source is available. Refresh to try again."}
                    </p>
                    {(searchQuery ||
                      categoryFilter !== "all" ||
                      sentimentFilter !== "all") && (
                      <Button
                        variant="link"
                        className="mt-2"
                        onClick={() => {
                          setSearchQuery("");
                          setCategoryFilter("all");
                          setSentimentFilter("all");
                        }}
                      >
                        Clear filters
                      </Button>
                    )}
                  </Card>
                ) : (
                  filteredArticles.map((article) => (
                    <Card
                      key={article.id}
                      className="surface-panel gap-0 overflow-hidden p-0"
                    >
                      <article className="p-5 sm:p-6">
                        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5 text-primary">
                            {getSourceIcon(article.source, article.category)}
                            {getCategoryLabel(article.category)}
                          </span>
                          <span>·</span>
                          <span>{article.source}</span>
                          <span className="ml-auto flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatTimestamp(article.timestamp)}
                          </span>
                        </div>
                        <h3 className="max-w-3xl text-lg font-semibold leading-snug tracking-tight">
                          {cleanContent(article.title)}
                        </h3>
                        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                          {getShortPreview(article)}
                        </p>
                        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant="outline"
                              className={`capitalize ${getSentimentColor(article.sentimentLabel)}`}
                            >
                              {getSentimentIcon(article.sentimentLabel)}
                              <span className="ml-1">
                                {article.sentimentLabel}
                              </span>
                            </Badge>
                            <span className="text-[11px] text-muted-foreground">
                              {Math.round(article.confidence * 100)}% confidence
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleArticleExpansion(article.id)}
                              aria-expanded={expandedArticles.has(article.id)}
                            >
                              {expandedArticles.has(article.id) ? (
                                <EyeOff className="mr-1.5 h-3.5 w-3.5" />
                              ) : (
                                <Eye className="mr-1.5 h-3.5 w-3.5" />
                              )}
                              {expandedArticles.has(article.id)
                                ? "Hide context"
                                : "Inspect context"}
                            </Button>
                            {/^https?:\/\//i.test(article.url) && (
                              <Button asChild variant="outline" size="sm">
                                <a
                                  href={article.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  Read source
                                  <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                                </a>
                              </Button>
                            )}
                          </div>
                        </div>

                        {expandedArticles.has(article.id) && (
                          <div className="mt-5 space-y-4 border-t border-border pt-5">
                            <div>
                              <p className="eyebrow">Story summary</p>
                              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                {cleanContent(article.content) ||
                                  cleanContent(article.summary)}
                              </p>
                            </div>
                            {article.analysis && (
                              <div className="rounded-lg bg-muted/50 p-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <h4 className="text-sm font-medium">
                                    Analysis evidence
                                  </h4>
                                  <span className="text-[11px] text-muted-foreground">
                                    {formatModelMeta(article.analysis.meta)}
                                  </span>
                                </div>
                                <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
                                  {article.analysis.reasoning
                                    .filter(
                                      (reason) =>
                                        !/parse error|unstructured/i.test(
                                          reason,
                                        ),
                                    )
                                    .map((reason, index) => (
                                      <li key={index}>{reason}</li>
                                    ))}
                                </ul>
                                {article.analysis.keyPhrases.length > 0 && (
                                  <div className="mt-3 flex flex-wrap gap-1.5">
                                    {article.analysis.keyPhrases.map(
                                      (phrase, index) => (
                                        <Badge
                                          key={index}
                                          variant="outline"
                                          className="text-[10px]"
                                        >
                                          {phrase}
                                        </Badge>
                                      ),
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                            {article.entities.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {article.entities.map((entity, index) => (
                                  <Badge
                                    key={index}
                                    variant="secondary"
                                    className="text-[10px]"
                                  >
                                    <Hash className="mr-1 h-3 w-3" />
                                    {entity}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </article>
                    </Card>
                  ))
                )}
              </section>

              <aside className="space-y-4 xl:pt-14">
                <Card className="surface-panel p-5">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-primary" />
                    <h2 className="text-sm font-semibold">Source mix</h2>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    Where the current briefing comes from.
                  </p>
                  <div className="mt-5 space-y-4">
                    {sourceCoverageLocal.length ? (
                      sourceCoverageLocal.map((item) => (
                        <div key={item.source}>
                          <div className="flex justify-between gap-2 text-xs">
                            <span>{item.source}</span>
                            <span className="text-muted-foreground">
                              {item.pct}%
                            </span>
                          </div>
                          <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary/70"
                              style={{ width: `${item.pct}%` }}
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No source coverage in the current results.
                      </p>
                    )}
                  </div>
                </Card>

                {marketSummary &&
                  marketSummary.topEntities.length > 0 &&
                  newsArticles.length > 0 && (
                    <Card className="surface-panel p-5">
                      <div className="flex items-center gap-2">
                        <Hash className="h-4 w-4 text-primary" />
                        <h2 className="text-sm font-semibold">
                          In the conversation
                        </h2>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {marketSummary.topEntities.map((entity) => (
                          <Badge key={entity.entity} variant="outline">
                            {entity.entity}
                          </Badge>
                        ))}
                      </div>
                    </Card>
                  )}

                {prediction && newsArticles.length > 0 && (
                  <Card className="surface-panel p-5">
                    <div className="flex items-center gap-2">
                      <Brain className="h-4 w-4 text-primary" />
                      <h2 className="text-sm font-semibold">Signal notes</h2>
                    </div>
                    <div className="mt-4 space-y-3 text-xs leading-relaxed text-muted-foreground">
                      {prediction.reasoning.slice(0, 3).map((reason, index) => (
                        <p key={index}>{reason}</p>
                      ))}
                    </div>
                    {segmentEntriesLocal.length > 0 && (
                      <div className="mt-5 border-t border-border pt-4">
                        <p className="eyebrow">Topic mix</p>
                        <div className="mt-3 space-y-2">
                          {segmentEntriesLocal.map((item) => (
                            <div
                              key={item.seg}
                              className="flex justify-between gap-2 text-xs"
                            >
                              <span>{getCategoryLabel(item.seg)}</span>
                              <span className="text-muted-foreground">
                                {item.pct}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                )}

                <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
                  Sentiment summarizes the coverage available to this app. It is
                  not a price forecast. Analysis may use local heuristics when a
                  model provider is unavailable.
                </p>
              </aside>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
