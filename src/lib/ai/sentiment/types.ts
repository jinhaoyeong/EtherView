/**
 * Type definitions for sentiment analysis system
 */

export interface SentimentResult {
  score: number; // -1 to 1
  confidence: number; // 0 to 1
  reasoning: string[];
  marketEffect: 'positive' | 'negative' | 'neutral';
  volatility: number; // 0 to 1
  keywords: string[];
  timestamp: string;
  meta?: {
    source?: 'GLM' | 'OpenAI' | 'Fallback';
    model?: string;
  };
}

export interface AggregatedMarketSentiment {
  overallIndex: number;
  label: 'Bullish' | 'Neutral' | 'Bearish';
  confidence: number;
  segmentScores: {
    crypto: number;
    traditional: number;
    macro: number;
    regulatory: number;
  };
  entityAnalysis: {
    topEntities: Array<{
      name: string;
      sentiment: number;
      relevance: number;
      mentions: number;
    }>;
    entityTrends: Array<{
      entity: string;
      trend: 'rising' | 'falling' | 'stable';
      sentiment: number;
    }>;
  };
  sourceDistribution: {
    highTrust: number;
    mediumTrust: number;
    lowTrust: number;
  };
  temporalTrend: {
    immediate: number; // Last hour
    recent: number;   // Last 6 hours
    daily: number;    // Last 24 hours
  };
}

export interface SocialSentimentSummary {
  overallScore: number;
  influencerBreakdown: {
    crypto: number;
    traditional: number;
    institutional: number;
    media: number;
  };
  topInfluencers: Array<{
    handle: string;
    platform: string;
    followers: number;
    verified: boolean;
    sentiment: 'Bullish' | 'Neutral' | 'Bearish';
    confidence: number;
    influenceScore: number;
    engagementRate: number;
    category: 'analyst' | 'trader' | 'developer' | 'media' | 'institutional';
  }>;
  trendingTopics: Array<{
    topic: string;
    mentions: number;
    sentiment: number;
    growth: number;
  }>;
  platformAnalysis: {
    reddit: { score: number; count: number };
    youtube: { score: number; count: number };
    twitter?: { score: number; count: number };
    telegram?: { score: number; count: number };
  };
  credibilityWeightedScore: number;
  reach: number;
}

export interface MarketPrediction {
  trend: 'Bullish' | 'Neutral' | 'Bearish';
  confidence: number;
  reasoning: string[];
  timeHorizon: string;
  targetPrice?: number;
  keyFactors: {
    positive: string[];
    negative: string[];
    neutral: string[];
  };
  riskFactors: string[];
  marketSignals: {
    volume: 'High' | 'Medium' | 'Low';
    volatility: 'High' | 'Medium' | 'Low';
    momentum: 'Strong' | 'Moderate' | 'Weak';
  };
  technicalIndicators?: {
    rsi: number;
    macd: number;
    bollinger: 'Upper' | 'Middle' | 'Lower';
    support: number;
    resistance: number;
  };
  correlationScore: number;
}