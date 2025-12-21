/**
 * Comprehensive Market Sentiment Analysis Engine
 * Advanced AI-driven sentiment analysis following CLAUDE.md specifications
 */

import { realNewsAggregator, EnrichedNewsArticle } from './realNewsAggregator';
import { RealSentimentAnalyzer } from './realSentimentAnalyzer';
import type { SentimentAnalysis } from './sentimentAnalyzer';

// Create a single instance to reuse API keys
const realSentimentAnalyzer = new RealSentimentAnalyzer();
import { realPredictiveModel } from './predictiveModel';
import { realSocialAggregator } from './realSocialAggregator';
import { AggregatedMarketSentiment, MarketPrediction, SocialSentimentSummary } from './types';
import { aiCache, CacheKeys } from '../shared/cache';
import { performanceManager } from './performanceManager';

export interface EnhancedSentimentArticle extends EnrichedNewsArticle {
  sentiment: SentimentAnalysis;
  duplicateGroup?: string;
}

// Base market summary used for UI and aggregation
export interface MarketSummary {
  aggregatedIndex: number;
  label: 'Bullish' | 'Neutral' | 'Bearish';
  confidence: number;
  topInfluencers: Array<{ handle: string; weight: number; sentiment: string }>;
  topEntities: Array<{ entity: string; influenceScore: number; recentMentions?: number }>;
  trendIndicator: 'rising' | 'falling' | 'stable';
}

export interface ComprehensiveMarketSummary extends MarketSummary {
  aggregatedSentiment: AggregatedMarketSentiment;
  prediction: MarketPrediction;
  socialSignals: SocialSentimentSummary;
  detailedAnalysis: {
    sourceQuality: {
      highTrust: number;
      mediumTrust: number;
      lowTrust: number;
    };
    contentDepth: {
      averageWordCount: number;
      uniqueEntities: number;
      contentRichness: number;
    };
    temporalPatterns: {
      publishingFrequency: number;
      sentimentVelocity: number;
      trendConsistency: number;
    };
  };
  evidence: {
    reasoning: string[];
    keyFactors: Array<{ type: string; impact: number; description: string }>;
    sources: Array<{ name: string; trust: number; contribution: number }>;
  };
}

export interface SentimentAnalysisResult {
  marketSummary: ComprehensiveMarketSummary;
  articles: EnhancedSentimentArticle[];
  lastUpdated: string;
  sourceCoverage: Record<string, number>;
  metadata: {
    totalSources: number;
    averageConfidence: number;
    processingTime: number;
    cacheStatus: 'fresh' | 'cached';
  };
}

export class SentimentAnalysisEngine {
  private readonly SOURCE_WEIGHTS: Record<string, number> = {
    'wsj.com': 0.95,
    'ft.com': 0.95,
    'bloomberg.com': 0.95,
    'reuters.com': 0.90,
    'coindesk.com': 0.85,
    'cointelegraph.com': 0.85,
    'theblock.co': 0.85,
    'reddit.com': 0.60
  };

  private readonly ENTITY_IMPACT_MULTIPLIER = 1.5;
  private readonly RECENCY_HALF_LIFE_HOURS = 6;

  async analyzeMarketSentiment(walletAddress?: string, forceRefresh: boolean = false, fast: boolean = false): Promise<SentimentAnalysisResult> {
    const startTime = performance.now();
    console.log(`🧠 Starting comprehensive sentiment analysis${forceRefresh ? ' (forced refresh)' : ' (using cache if available)'}${fast ? ' [fast]' : ''}`);

    const cacheKey = CacheKeys.SENTIMENT_ANALYSIS(fast ? 'fast' : 'comprehensive');

    return await performanceManager.executeWithCaching(
      `sentiment_analysis_${cacheKey}`,
      async () => {
        try {
          // Step 1: Aggregate news from multiple real sources with deduplication
          console.log('📰 Step 1: Aggregating news from real sources...');
          const enrichedArticles = await realNewsAggregator.aggregateNews(forceRefresh, fast);

          if (enrichedArticles.length === 0) {
            console.warn('⚠️ No articles found for analysis');
            return this.createEmptyResult(startTime, forceRefresh);
          }

          console.log(`📰 Retrieved ${enrichedArticles.length} unique articles`);
          // Cost saver ON: analyze 5 articles; OFF: analyze up to 10 articles
          const limitedArticles = fast
            ? enrichedArticles.slice(0, 5)
            : enrichedArticles.slice(0, Math.min(10, enrichedArticles.length));

          console.log(`🧠 Analyzing sentiment for ${limitedArticles.length} articles (${fast ? 'cost saver 5' : 'up to 10'} articles)`);

          // Step 2: Parallel processing of sentiment analysis and social signals
          console.log('🧠 Step 2: Performing AI sentiment analysis on articles...');
          const sentimentAnalysesPromise = (async () => {
            const batchSize = limitedArticles.length;
            const delayBetweenBatches = fast ? 0 : 200;
            return performanceManager.executeBatch(
              limitedArticles,
              (article) => realSentimentAnalyzer.analyzeSentiment(article, { mode: fast ? 'fast' : 'normal' }),
              {
                batchSize,
                concurrency: 3,
                delayBetweenBatches,
                cacheKey: (article) => `sentiment_glm_${article.id}_${fast ? 'fast' : 'normal'}`,
                cacheTTL: 30 * 60 * 1000
              }
            );
          })();
          const [sentimentAnalyses, socialSignals] = await Promise.all([
            sentimentAnalysesPromise,
            performanceManager.executeWithCaching(
              `social_signals_${Date.now()}`,
              () => realSocialAggregator.analyzeInfluencerSignals(enrichedArticles, []),
              20 * 60 * 1000, // 20 minutes for social signals
              forceRefresh
            )
          ]);

          // Step 3: Combine articles with sentiment analysis
          const analyzedArticles: EnhancedSentimentArticle[] = limitedArticles.map((article, index) => ({
            ...article,
            sentiment: sentimentAnalyses[index]
          }));

          // Step 4: Generate comprehensive market prediction using ML
          console.log('🔮 Step 3: Generating market predictions using ML and AI...');
          const prediction = await performanceManager.executeWithCaching(
            `market_prediction_${Date.now()}`,
            () => realPredictiveModel.generateMarketPrediction(
              analyzedArticles.map(a => ({ article: a, sentiment: a.sentiment }))
            ),
            60 * 60 * 1000, // 60 minutes for predictions
            forceRefresh
          );

          // Step 5: Create comprehensive market summary
          console.log('📊 Step 4: Creating comprehensive market summary...');
          const marketSummary = this.createComprehensiveMarketSummary(
            analyzedArticles,
            prediction,
            socialSignals
          );

          // Step 6: Generate evidence and reasoning
          console.log('🔍 Step 5: Generating evidence and reasoning...');
          const sourceCoverage = this.calculateSourceCoverage(analyzedArticles);

          const processingTime = performance.now() - startTime;
          console.log(`✅ Comprehensive analysis complete in ${processingTime.toFixed(0)}ms`);

          const result: SentimentAnalysisResult = {
            marketSummary,
            articles: analyzedArticles,
            lastUpdated: new Date().toISOString(),
            sourceCoverage,
            metadata: {
              totalSources: new Set(analyzedArticles.map(a => a.source)).size,
              averageConfidence: sentimentAnalyses.reduce((sum, s) => sum + s.confidence, 0) / sentimentAnalyses.length,
              processingTime,
              cacheStatus: forceRefresh ? 'fresh' : 'cached'
            }
          };

          return result;

        } catch (error) {
          console.error('❌ Comprehensive sentiment analysis failed:', error);
          return this.createEmptyResult(startTime, forceRefresh);
        }
      },
      10 * 60 * 1000, // 10 minutes cache for full analysis
      forceRefresh
    );
  }

  private createEmptyResult(startTime: number, forceRefresh: boolean): SentimentAnalysisResult {
    const processingTime = performance.now() - startTime;

    return {
      marketSummary: this.createEmptyMarketSummary(),
      articles: [],
      lastUpdated: new Date().toISOString(),
      sourceCoverage: {},
      metadata: {
        totalSources: 0,
        averageConfidence: 0,
        processingTime,
        cacheStatus: forceRefresh ? 'fresh' : 'cached'
      }
    };
  }

  private createEmptyMarketSummary(): ComprehensiveMarketSummary {
    return {
      aggregatedIndex: 0,
      label: 'Neutral',
      confidence: 0,
      topInfluencers: [],
      topEntities: [],
      trendIndicator: 'stable',
      aggregatedSentiment: {
        overallIndex: 0,
        label: 'Neutral',
        confidence: 0,
        segmentScores: { crypto: 0, traditional: 0, macro: 0, regulatory: 0 },
        entityAnalysis: { topEntities: [], entityTrends: [] },
        sourceDistribution: { highTrust: 0, mediumTrust: 0, lowTrust: 0 },
        temporalTrend: { immediate: 0, recent: 0, daily: 0 }
      },
      prediction: {
        trend: 'Neutral',
        confidence: 0,
        reasoning: ['Insufficient data for accurate prediction'],
        timeHorizon: 'Short-term (4-24h)',
        keyFactors: { positive: [], negative: [], neutral: [] },
        riskFactors: ['Limited data availability'],
        marketSignals: { volume: 'Low', volatility: 'Low', momentum: 'Weak' },
        correlationScore: 0
      },
      socialSignals: {
        overallScore: 0,
        influencerBreakdown: { crypto: 0, traditional: 0, institutional: 0, media: 0 },
        topInfluencers: [],
        trendingTopics: [],
        platformAnalysis: { reddit: { score: 0, count: 0 }, youtube: { score: 0, count: 0 } },
        credibilityWeightedScore: 0,
        reach: 0
      },
      detailedAnalysis: {
        sourceQuality: { highTrust: 0, mediumTrust: 0, lowTrust: 0 },
        contentDepth: { averageWordCount: 0, uniqueEntities: 0, contentRichness: 0 },
        temporalPatterns: { publishingFrequency: 0, sentimentVelocity: 0, trendConsistency: 0 }
      },
      evidence: {
        reasoning: ['No data available for analysis'],
        keyFactors: [],
        sources: []
      }
    };
  }

  private createComprehensiveMarketSummary(
    articles: EnhancedSentimentArticle[],
    prediction: MarketPrediction,
    socialSignals: SocialSentimentSummary
  ): ComprehensiveMarketSummary {
    // Create base summary following the original structure
    const baseSummary = this.generateMarketSummary(articles);

    // Calculate detailed analysis metrics
    const detailedAnalysis = this.calculateDetailedAnalysis(articles);

    // Generate comprehensive evidence
    const evidence = this.generateComprehensiveEvidence(articles, prediction, socialSignals);

    return {
      ...baseSummary,
      aggregatedSentiment: this.calculateDefaultAggregatedSentiment(),
      prediction,
      socialSignals,
      detailedAnalysis,
      evidence
    };
  }

  private calculateDefaultAggregatedSentiment(): AggregatedMarketSentiment {
    return {
      overallIndex: 0,
      label: 'Neutral',
      confidence: 0,
      segmentScores: { crypto: 0, traditional: 0, macro: 0, regulatory: 0 },
      entityAnalysis: { topEntities: [], entityTrends: [] },
      sourceDistribution: { highTrust: 0, mediumTrust: 0, lowTrust: 0 },
      temporalTrend: { immediate: 0, recent: 0, daily: 0 }
    };
  }

  private calculateDetailedAnalysis(articles: EnhancedSentimentArticle[]): ComprehensiveMarketSummary['detailedAnalysis'] {
    // Source quality analysis
    const sourceQuality = {
      highTrust: articles.filter(a => a.sourceTrust > 0.8).length / articles.length,
      mediumTrust: articles.filter(a => a.sourceTrust > 0.5 && a.sourceTrust <= 0.8).length / articles.length,
      lowTrust: articles.filter(a => a.sourceTrust <= 0.5).length / articles.length
    };

    // Content depth analysis
    const totalWords = articles.reduce((sum, a) => sum + (a.title + ' ' + (a.summary || '')).split(' ').length, 0);
    const totalEntities = articles.reduce((sum, a) => sum + (a.onChainMetadata?.mentionedTokens.length || 0), 0);

    const contentDepth = {
      averageWordCount: totalWords / articles.length,
      uniqueEntities: totalEntities,
      contentRichness: Math.min(1, (totalWords / 100) * 0.5 + (totalEntities / 10) * 0.5)
    };

    // Temporal patterns analysis
    const timestamps = articles.map(a => new Date(a.publishedAt).getTime());
    timestamps.sort((a, b) => a - b);

    let publishingFrequency = 0;
    if (timestamps.length > 1) {
      const avgInterval = timestamps.reduce((sum, time, i, arr) => {
        if (i === 0) return sum;
        return sum + (time - arr[i - 1]);
      }, 0) / (timestamps.length - 1);
      publishingFrequency = Math.max(0, 1 - (avgInterval / (24 * 60 * 60 * 1000))); // Articles per day
    }

    const sentimentVelocity = this.calculateSentimentVelocity(articles);
    const trendConsistency = this.calculateTrendConsistency(articles);

    return {
      sourceQuality,
      contentDepth,
      temporalPatterns: {
        publishingFrequency,
        sentimentVelocity,
        trendConsistency
      }
    };
  }

  private calculateSentimentVelocity(articles: EnhancedSentimentArticle[]): number {
    if (articles.length < 2) return 0;

    const sortedArticles = [...articles].sort((a, b) =>
      new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()
    );

    let velocitySum = 0;
    let velocityCount = 0;

    for (let i = 1; i < Math.min(sortedArticles.length, 10); i++) {
      const timeDiff = (new Date(sortedArticles[i].publishedAt).getTime() -
                       new Date(sortedArticles[i-1].publishedAt).getTime()) / (1000 * 60 * 60); // hours
      if (timeDiff > 0 && timeDiff < 24) {
        const sentimentDiff = sortedArticles[i].sentiment.score - sortedArticles[i-1].sentiment.score;
        velocitySum += sentimentDiff / timeDiff;
        velocityCount++;
      }
    }

    return velocityCount > 0 ? velocitySum / velocityCount : 0;
  }

  private calculateTrendConsistency(articles: EnhancedSentimentArticle[]): number {
    if (articles.length < 3) return 0;

    const sentiments = articles.map(a => a.sentiment.score);
    const mean = sentiments.reduce((a, b) => a + b, 0) / sentiments.length;
    const variance = sentiments.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / sentiments.length;

    // Lower variance = higher consistency
    return Math.max(0, 1 - (variance / 0.25)); // Normalize assuming max variance of 0.5
  }

  private generateComprehensiveEvidence(
    articles: EnhancedSentimentArticle[],
    prediction: MarketPrediction,
    socialSignals: SocialSentimentSummary
  ): ComprehensiveMarketSummary['evidence'] {
    const reasoning = [
      ...prediction.reasoning,
      `Analyzed ${articles.length} articles from ${new Set(articles.map(a => a.source)).size} sources`,
      `Average sentiment confidence: ${(articles.reduce((sum, a) => sum + a.sentiment.confidence, 0) / articles.length * 100).toFixed(1)}%`,
      `Social signal reach: ${socialSignals.reach.toLocaleString()} estimated unique users`
    ];

    const keyFactors: Array<{ type: string; impact: number; description: string }> = [
      ...prediction.keyFactors.positive.map((factor: string) => ({
        type: 'positive',
        impact: 0.8,
        description: factor
      })),
      ...prediction.keyFactors.negative.map((factor: string) => ({
        type: 'negative',
        impact: 0.8,
        description: factor
      }))
    ];

    const sources = Array.from(new Set(articles.map(a => a.source))).map(source => {
      const sourceArticles = articles.filter(a => a.source === source);
      const avgTrust = sourceArticles.reduce((sum, a) => sum + a.sourceTrust, 0) / sourceArticles.length;
      const contribution = sourceArticles.length / articles.length;

      return {
        name: source,
        trust: avgTrust,
        contribution,
      };
    }).sort((a, b) => b.contribution - a.contribution);

    return {
      reasoning: reasoning.slice(0, 6),
      keyFactors: keyFactors.slice(0, 8),
      sources: sources.slice(0, 10)
    };
  }

  private extractEntities(text: string): string[] {
    const entities: string[] = [];
    const knownEntities = [
      'Federal Reserve', 'Fed', 'SEC', 'Ethereum', 'ETH', 'Bitcoin', 'BTC',
      'CPI', 'inflation', 'interest rates', 'ETF', 'DeFi', 'NFT', 'Web3'
    ];

    for (const entity of knownEntities) {
      if (text.toLowerCase().includes(entity.toLowerCase())) {
        entities.push(entity);
      }
    }

    return [...new Set(entities)];
  }

  private getSentimentLabel(score: number): 'Bullish' | 'Neutral' | 'Bearish' {
    if (score > 0.15) return 'Bullish';
    if (score < -0.15) return 'Bearish';
    return 'Neutral';
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return 'unknown';
    }
  }

  private generateMarketSummary(articles: EnhancedSentimentArticle[]): MarketSummary {
    // Calculate weighted sentiment index
    let weightedSum = 0;
    let totalWeight = 0;

    for (const article of articles) {
      const weight = this.SOURCE_WEIGHTS[this.extractDomain(article.url)] || 0.5;
      const recencyWeight = this.calculateRecencyWeight(article.publishedAt);
      const finalWeight = weight * recencyWeight * (1 + (article.entityCount || 0) * 0.1);

      weightedSum += article.sentiment.score * finalWeight;
      totalWeight += finalWeight;
    }

    const aggregatedIndex = totalWeight > 0 ? weightedSum / totalWeight : 0;
    const label = this.getSentimentLabel(aggregatedIndex);

    // Extract top influencers from articles
    const topInfluencers = this.extractTopInfluencers(articles);

    // Extract top entities
    const entityCounts = this.countEntities(articles);
    const topEntities = Object.entries(entityCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([entity, count]) => ({
        entity,
        influenceScore: count / articles.length,
        recentMentions: count
      }));

    return {
      aggregatedIndex,
      label,
      confidence: 0.75,
      topInfluencers,
      topEntities,
      trendIndicator: aggregatedIndex > 0.1 ? 'rising' : aggregatedIndex < -0.1 ? 'falling' : 'stable',
    };
  }

  private calculateRecencyWeight(publishedAt: string): number {
    const ageHours = (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60);
    return Math.exp(-Math.log(2) * ageHours / this.RECENCY_HALF_LIFE_HOURS);
  }

  private countEntities(articles: EnhancedSentimentArticle[]): Record<string, number> {
    const counts: Record<string, number> = {};

    for (const article of articles) {
      const entities = this.extractEntities(article.title + ' ' + (article.summary || ''));
      for (const entity of entities) {
        counts[entity] = (counts[entity] || 0) + 1;
      }
    }

    return counts;
  }


  private calculateSourceCoverage(articles: EnhancedSentimentArticle[]): Record<string, number> {
    const coverage: Record<string, number> = {};

    for (const article of articles) {
      const domain = this.extractDomain(article.url);
      coverage[domain] = (coverage[domain] || 0) + 1;
    }

    return coverage;
  }

  private extractTopInfluencers(articles: EnhancedSentimentArticle[]): Array<{ handle: string; weight: number; sentiment: string }> {
    // Extract mentions of known influencers from article content
    const knownInfluencers = [
      '@VitalikButerin', '@el33th4xor', '@MihailoBjelic', '@Starknet',
      '@SantiAGO03098363', '@boringdeveloper', '@ericwall', '@jessepollak',
      '@cburniske', '@barrysilbert', '@APompliano', '@brian_armstrong',
      '@saylor', '@双子币', '@woonomic', '@cryptovoice', '@chancerasper'
    ];

    const influencerMentions: Record<string, { count: number; totalSentiment: number; weight: number }> = {};

    articles.forEach(article => {
      const text = (article.title + ' ' + (article.summary || '')).toLowerCase();
      const articleWeight = article.sourceTrust * (0.5 + article.recencyWeight * 0.5);

      knownInfluencers.forEach(influencer => {
        const handle = influencer.toLowerCase().replace('@', '');
        if (text.includes(handle) || text.includes(influencer.toLowerCase())) {
          if (!influencerMentions[influencer]) {
            influencerMentions[influencer] = { count: 0, totalSentiment: 0, weight: 0 };
          }
          influencerMentions[influencer].count++;
          influencerMentions[influencer].totalSentiment += article.sentiment.score;
          influencerMentions[influencer].weight += articleWeight;
        }
      });
    });

    // Calculate average sentiment and sort by influence
    const topInfluencers = Object.entries(influencerMentions)
      .map(([handle, data]) => ({
        handle,
        weight: data.weight,
        sentiment: data.totalSentiment / data.count > 0.15 ? 'Bullish' :
                 data.totalSentiment / data.count < -0.15 ? 'Bearish' : 'Neutral'
      }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3);

    // If no influencers found, return empty array instead of mock data
    return topInfluencers;
  }

  // Removed legacy createDefaultAggregatedSentiment in favor of calculateDefaultAggregatedSentiment
}

export const sentimentAnalysisEngine = new SentimentAnalysisEngine();
