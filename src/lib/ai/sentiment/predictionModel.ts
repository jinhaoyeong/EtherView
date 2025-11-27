/**
 * Advanced Market Prediction Model
 * Weighted sentiment aggregation with ETH price prediction
 */

import { EnrichedNewsArticle } from './newsAggregator';
import { SentimentAnalysis } from './sentimentAnalyzer';

export interface MarketPrediction {
  trend: 'Strongly Bullish' | 'Bullish' | 'Neutral' | 'Bearish' | 'Strongly Bearish';
  confidence: number; // 0 to 1
  reasoning: string[];
  timeHorizon: 'Immediate (1-4h)' | 'Short-term (4-24h)' | 'Medium-term (1-3d)' | 'Long-term (3-7d)';
  targetPrice?: {
    eth: number;
    btc: number;
  };
  keyFactors: {
    positive: string[];
    negative: string[];
    neutral: string[];
  };
  riskFactors: string[];
  marketSignals: {
    volume: 'High' | 'Normal' | 'Low';
    volatility: 'High' | 'Normal' | 'Low';
    momentum: 'Strong' | 'Moderate' | 'Weak' | 'Reversing';
  };
}

export interface AggregatedMarketSentiment {
  overallIndex: number; // -1 to 1
  label: 'Bullish' | 'Neutral' | 'Bearish';
  confidence: number;
  segmentScores: {
    crypto: number;
    traditional: number;
    macro: number;
    regulatory: number;
  };
  entityAnalysis: {
    topEntities: Array<{ entity: string; influence: number; sentiment: number }>;
    entityTrends: Array<{ entity: string; trend: 'Improving' | 'Stable' | 'Deteriorating' }>;
  };
  sourceDistribution: {
    highTrust: number;
    mediumTrust: number;
    lowTrust: number;
  };
  temporalTrend: {
    immediate: number; // Last 1 hour
    recent: number;    // Last 6 hours
    daily: number;     // Last 24 hours
  };
}

export class PredictionModel {
  private readonly ENTITY_INFLUENCE_WEIGHTS = {
    // Highest impact entities
    'federal reserve': 1.0,
    'fed': 0.9,
    'sec': 0.9,
    'inflation': 0.8,
    'cpi': 0.8,
    'interest rate': 0.8,

    // High impact crypto entities
    'bitcoin': 0.7,
    'btc': 0.7,
    'ethereum': 0.6,
    'eth': 0.6,
    'etf': 0.8, // Very high impact due to institutional access

    // Medium impact entities
    'ecb': 0.6,
    'bank of england': 0.5,
    'jpmorgan': 0.5,
    'goldman sachs': 0.5,
    'blackrock': 0.6,

    // Lower impact but still relevant
    'defi': 0.4,
    'nft': 0.3,
    'blockchain': 0.4
  };

  generateMarketPrediction(articles: Array<{
    article: EnrichedNewsArticle;
    sentiment: SentimentAnalysis;
  }>): MarketPrediction & { predictionMarketData?: AggregatedMarketSentiment } {
    console.log('🔮 Generating market prediction...');

    // Aggregate sentiment across all articles
    const aggregatedSentiment = this.aggregateSentiment(articles);

    // Generate base prediction
    const basePrediction = this.generateBasePrediction(aggregatedSentiment);

    // Apply market context and historical patterns
    const contextualPrediction = this.applyMarketContext(basePrediction, aggregatedSentiment);

    // Calculate confidence based on data quality and consensus
    const confidence = this.calculatePredictionConfidence(articles, aggregatedSentiment);

    // Generate reasoning
    const reasoning = this.generatePredictionReasoning(aggregatedSentiment, contextualPrediction);

    // Extract key factors
    const keyFactors = this.extractKeyFactors(articles);

    // Identify risk factors
    const riskFactors = this.identifyRiskFactors(articles, aggregatedSentiment);

    // Analyze market signals
    const marketSignals = this.analyzeMarketSignals(articles, aggregatedSentiment);

    return {
      trend: contextualPrediction.trend,
      confidence,
      reasoning,
      timeHorizon: contextualPrediction.timeHorizon,
      targetPrice: this.generateTargetPrice(contextualPrediction, aggregatedSentiment),
      keyFactors,
      riskFactors,
      marketSignals
    };
  }

  private aggregateSentiment(articles: Array<{
    article: EnrichedNewsArticle;
    sentiment: SentimentAnalysis;
  }>): AggregatedMarketSentiment {
    if (articles.length === 0) {
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

    // Calculate weighted sentiment index
    let weightedSum = 0;
    let totalWeight = 0;

    const segmentScores = { crypto: 0, traditional: 0, macro: 0, regulatory: 0 };
    const segmentCounts = { crypto: 0, traditional: 0, macro: 0, regulatory: 0 };

    const sourceDistribution = { highTrust: 0, mediumTrust: 0, lowTrust: 0 };

    // Entity analysis
    const entityMap = new Map<string, { totalSentiment: number; count: number; weights: number[] }>();

    // Temporal analysis
    const temporalBuckets = { immediate: [] as number[], recent: [] as number[], daily: [] as number[] };

    const now = Date.now();

    articles.forEach(({ article, sentiment }) => {
      // Weight by source trust, recency, and market relevance
      const weight = article.sourceTrust * article.recencyWeight * article.marketRelevance * sentiment.confidence;

      weightedSum += sentiment.score * weight;
      totalWeight += weight;

      // Segment scores
      const segment = sentiment.marketSegment.toLowerCase();
      if (segment in segmentScores) {
        segmentScores[segment as keyof typeof segmentScores] += sentiment.score * weight;
        segmentCounts[segment as keyof typeof segmentCounts]++;
      }

      // Source distribution
      if (article.sourceTrust > 0.8) {
        sourceDistribution.highTrust += weight;
      } else if (article.sourceTrust > 0.5) {
        sourceDistribution.mediumTrust += weight;
      } else {
        sourceDistribution.lowTrust += weight;
      }

      // Entity analysis
      const entities = this.extractEntitiesFromArticle(article);
      entities.forEach(entity => {
        const normalizedEntity = entity.toLowerCase();
        if (!entityMap.has(normalizedEntity)) {
          entityMap.set(normalizedEntity, { totalSentiment: 0, count: 0, weights: [] });
        }
        const entityData = entityMap.get(normalizedEntity)!;
        entityData.totalSentiment += sentiment.score * weight;
        entityData.count++;
        entityData.weights.push(weight);
      });

      // Temporal analysis
      const age = now - new Date(article.publishedAt).getTime();
      const ageHours = age / (1000 * 60 * 60);

      if (ageHours <= 1) {
        temporalBuckets.immediate.push(sentiment.score * weight);
      } else if (ageHours <= 6) {
        temporalBuckets.recent.push(sentiment.score * weight);
      } else if (ageHours <= 24) {
        temporalBuckets.daily.push(sentiment.score * weight);
      }
    });

    // Calculate final scores
    const overallIndex = totalWeight > 0 ? weightedSum / totalWeight : 0;

    // Normalize segment scores
    Object.keys(segmentScores).forEach(segment => {
      const seg = segment as keyof typeof segmentScores;
      if (segmentCounts[seg] > 0) {
        segmentScores[seg] /= segmentCounts[seg];
      }
    });

    // Process entity analysis
    const topEntities = Array.from(entityMap.entries())
      .map(([entity, data]) => ({
        entity: this.capitalizeEntity(entity),
        influence: this.ENTITY_INFLUENCE_WEIGHTS[entity] || 0.5,
        sentiment: data.totalSentiment / data.weights.reduce((a, b) => a + b, 0)
      }))
      .sort((a, b) => (b.influence * Math.abs(b.sentiment)) - (a.influence * Math.abs(a.sentiment)))
      .slice(0, 10);

    const entityTrends = topEntities.map(entity => ({
      entity: entity.entity,
      trend: this.determineEntityTrend(entity.sentiment)
    }));

    // Normalize source distribution
    const totalSourceWeight = sourceDistribution.highTrust + sourceDistribution.mediumTrust + sourceDistribution.lowTrust;
    if (totalSourceWeight > 0) {
      sourceDistribution.highTrust /= totalSourceWeight;
      sourceDistribution.mediumTrust /= totalSourceWeight;
      sourceDistribution.lowTrust /= totalSourceWeight;
    }

    // Calculate temporal trends
    const temporalTrend = {
      immediate: this.calculateAverage(temporalBuckets.immediate),
      recent: this.calculateAverage(temporalBuckets.recent),
      daily: this.calculateAverage(temporalBuckets.daily)
    };

    return {
      overallIndex,
      label: overallIndex > 0.15 ? 'Bullish' : overallIndex < -0.15 ? 'Bearish' : 'Neutral',
      confidence: Math.min(0.95, articles.length / 20), // More articles = higher confidence
      segmentScores,
      entityAnalysis: { topEntities, entityTrends },
      sourceDistribution,
      temporalTrend
    };
  }

  private generateBasePrediction(sentiment: AggregatedMarketSentiment): {
    trend: MarketPrediction['trend'];
    timeHorizon: MarketPrediction['timeHorizon'];
  } {
    const { overallIndex, segmentScores, temporalTrend } = sentiment;

    // Determine trend strength
    let trend: MarketPrediction['trend'];
    if (overallIndex > 0.5) {
      trend = 'Strongly Bullish';
    } else if (overallIndex > 0.15) {
      trend = 'Bullish';
    } else if (overallIndex < -0.5) {
      trend = 'Strongly Bearish';
    } else if (overallIndex < -0.15) {
      trend = 'Bearish';
    } else {
      trend = 'Neutral';
    }

    // Determine time horizon based on temporal patterns
    const momentum = temporalTrend.recent - temporalTrend.daily;
    let timeHorizon: MarketPrediction['timeHorizon'];

    if (Math.abs(momentum) > 0.3) {
      timeHorizon = 'Immediate (1-4h)';
    } else if (Math.abs(overallIndex) > 0.3) {
      timeHorizon = 'Short-term (4-24h)';
    } else if (segmentScores.regulatory > 0.3) {
      timeHorizon = 'Medium-term (1-3d)';
    } else {
      timeHorizon = 'Long-term (3-7d)';
    }

    return { trend, timeHorizon };
  }

  private applyMarketContext(basePrediction: any, sentiment: AggregatedMarketSentiment): any {
    // Apply market-specific heuristics
    const { segmentScores, entityAnalysis, sourceDistribution } = sentiment;

    // Regulatory news often has delayed but stronger effects
    if (segmentScores.regulatory > 0.3) {
      // Regulatory positive often leads to sustained gains
      if (basePrediction.trend.includes('Bullish')) {
        basePrediction.timeHorizon = 'Medium-term (1-3d)';
      }
    }

    // High trust sources increase prediction reliability
    if (sourceDistribution.highTrust > 0.7) {
      // Confidence is higher, but trend might be more conservative
      if (Math.abs(sentiment.overallIndex) > 0.4) {
        basePrediction.trend = basePrediction.trend.replace('Strongly ', '');
      }
    }

    // Entity-specific adjustments
    const fedInfluence = entityAnalysis.topEntities.find(e => e.entity.toLowerCase().includes('fed'));
    if (fedInfluence && fedInfluence.sentiment < -0.3) {
      // Fed negativity is strongly bearish for risk assets
      basePrediction.trend = basePrediction.trend.includes('Bullish') ? 'Neutral' : basePrediction.trend;
      if (basePrediction.trend === 'Neutral') {
        basePrediction.trend = 'Bearish';
      }
    }

    const etfInfluence = entityAnalysis.topEntities.find(e => e.entity.toLowerCase().includes('etf'));
    if (etfInfluence && etfInfluence.sentiment > 0.3) {
      // ETF approval/news is strongly bullish
      basePrediction.trend = 'Strongly Bullish';
      basePrediction.timeHorizon = 'Short-term (4-24h)';
    }

    return basePrediction;
  }

  private calculatePredictionConfidence(
    articles: Array<{ article: EnrichedNewsArticle; sentiment: SentimentAnalysis }>,
    sentiment: AggregatedMarketSentiment
  ): number {
    let confidence = 0.5; // Base confidence

    // More articles = higher confidence
    confidence += Math.min(0.3, articles.length / 30);

    // High trust sources = higher confidence
    confidence += sentiment.sourceDistribution.highTrust * 0.2;

    // Consensus among sources = higher confidence
    const sentimentVariance = this.calculateSentimentVariance(articles);
    confidence += Math.max(0, 0.3 - sentimentVariance) * 0.5;

    // Entity consistency = higher confidence
    const entityConsistency = this.calculateEntityConsistency(sentiment.entityAnalysis);
    confidence += entityConsistency * 0.2;

    return Math.min(0.95, confidence);
  }

  private calculateSentimentVariance(
    articles: Array<{ article: EnrichedNewsArticle; sentiment: SentimentAnalysis }>
  ): number {
    if (articles.length < 2) return 0;

    const scores = articles.map(a => a.sentiment.score);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / scores.length;

    return Math.sqrt(variance);
  }

  private calculateEntityConsistency(entityAnalysis: AggregatedMarketSentiment['entityAnalysis']): number {
    const { topEntities } = entityAnalysis;
    if (topEntities.length < 2) return 0;

    const positiveEntities = topEntities.filter(e => e.sentiment > 0.1).length;
    const negativeEntities = topEntities.filter(e => e.sentiment < -0.1).length;
    const total = topEntities.length;

    // Higher consistency when most entities agree
    const agreementRatio = Math.max(positiveEntities, negativeEntities) / total;
    return agreementRatio;
  }

  private generatePredictionReasoning(
    sentiment: AggregatedMarketSentiment,
    prediction: any
  ): string[] {
    const reasoning: string[] = [];

    // Overall sentiment reasoning
    if (sentiment.overallIndex > 0.3) {
      reasoning.push('Strong positive market sentiment detected across multiple sources');
    } else if (sentiment.overallIndex < -0.3) {
      reasoning.push('Strong negative market sentiment detected across multiple sources');
    } else {
      reasoning.push('Mixed market sentiment indicates uncertainty or consolidation phase');
    }

    // Segment-specific reasoning
    if (sentiment.segmentScores.regulatory > 0.3) {
      reasoning.push('Regulatory developments favor market growth');
    } else if (sentiment.segmentScores.regulatory < -0.3) {
      reasoning.push('Regulatory concerns create headwinds for market');
    }

    if (sentiment.segmentScores.macro > 0.3) {
      reasoning.push('Macroeconomic conditions support risk assets');
    } else if (sentiment.segmentScores.macro < -0.3) {
      reasoning.push('Macroeconomic headwinds pressure risk assets');
    }

    // Entity influence reasoning
    const topEntity = sentiment.entityAnalysis.topEntities[0];
    if (topEntity && topEntity.influence > 0.7) {
      reasoning.push(`${topEntity.entity} developments significantly impact market direction`);
    }

    // Temporal trend reasoning
    const { temporalTrend } = sentiment;
    if (temporalTrend.immediate > temporalTrend.daily + 0.2) {
      reasoning.push('Recent positive momentum suggests continued upward movement');
    } else if (temporalTrend.immediate < temporalTrend.daily - 0.2) {
      reasoning.push('Recent negative momentum suggests continued downward pressure');
    }

    // Source quality reasoning
    if (sentiment.sourceDistribution.highTrust > 0.6) {
      reasoning.push('High-confidence signals from trusted sources support prediction');
    }

    return reasoning.slice(0, 4);
  }

  private extractKeyFactors(
    articles: Array<{ article: EnrichedNewsArticle; sentiment: SentimentAnalysis }>
  ): MarketPrediction['keyFactors'] {
    const positive: string[] = [];
    const negative: string[] = [];
    const neutral: string[] = [];

    articles.forEach(({ article, sentiment }) => {
      if (sentiment.score > 0.2) {
        positive.push(`${article.source}: ${article.title.substring(0, 60)}...`);
      } else if (sentiment.score < -0.2) {
        negative.push(`${article.source}: ${article.title.substring(0, 60)}...`);
      } else {
        neutral.push(`${article.source}: ${article.title.substring(0, 60)}...`);
      }
    });

    return {
      positive: positive.slice(0, 5),
      negative: negative.slice(0, 5),
      neutral: neutral.slice(0, 3)
    };
  }

  private identifyRiskFactors(
    articles: Array<{ article: EnrichedNewsArticle; sentiment: SentimentAnalysis }>,
    sentiment: AggregatedMarketSentiment
  ): string[] {
    const risks: string[] = [];

    // High volatility risk
    const variance = this.calculateSentimentVariance(articles);
    if (variance > 0.5) {
      risks.push('High sentiment volatility indicates unpredictable market conditions');
    }

    // Low source trust risk
    if (sentiment.sourceDistribution.lowTrust > 0.4) {
      risks.push('Significant portion of news from low-trust sources reduces reliability');
    }

    // Mixed signals risk
    const positiveSignals = articles.filter(a => a.sentiment.score > 0.2).length;
    const negativeSignals = articles.filter(a => a.sentiment.score < -0.2).length;
    if (Math.abs(positiveSignals - negativeSignals) < 2) {
      risks.push('Mixed signals suggest market uncertainty and potential volatility');
    }

    // Regulatory risk
    if (sentiment.segmentScores.regulatory < -0.2) {
      risks.push('Regulatory concerns may create prolonged market pressure');
    }

    // Temporal inconsistency risk
    const { temporalTrend } = sentiment;
    if (Math.abs(temporalTrend.immediate - temporalTrend.daily) > 0.4) {
      risks.push('Recent sentiment shift may indicate short-term volatility');
    }

    return risks;
  }

  private analyzeMarketSignals(
    articles: Array<{ article: EnrichedNewsArticle; sentiment: SentimentAnalysis }>,
    sentiment: AggregatedMarketSentiment
  ): MarketPrediction['marketSignals'] {
    // Analyze volume proxy (number of articles)
    const volume = articles.length > 20 ? 'High' : articles.length > 10 ? 'Normal' : 'Low';

    // Analyze volatility (sentiment variance)
    const variance = this.calculateSentimentVariance(articles);
    const volatility = variance > 0.5 ? 'High' : variance > 0.2 ? 'Normal' : 'Low';

    // Analyze momentum (temporal trend)
    const momentum = sentiment.temporalTrend.recent - sentiment.temporalTrend.daily;
    let momentumSignal: MarketPrediction['marketSignals']['momentum'];

    if (momentum > 0.3) {
      momentumSignal = 'Strong';
    } else if (momentum > 0.1) {
      momentumSignal = 'Moderate';
    } else if (momentum < -0.3) {
      momentumSignal = 'Reversing';
    } else {
      momentumSignal = 'Weak';
    }

    return { volume, volatility, momentum: momentumSignal };
  }

  private generateTargetPrice(
    prediction: any,
    sentiment: AggregatedMarketSentiment
  ): MarketPrediction['targetPrice'] | undefined {
    // Only generate target prices for high-confidence predictions
    if (prediction.confidence < 0.6) return undefined;

    // Use mock current prices (in real implementation, fetch from API)
    const currentETH = 2000;
    const currentBTC = 45000;

    // Calculate percentage change based on sentiment
    const ethChange = sentiment.overallIndex * 0.08; // Max 8% change
    const btcChange = sentiment.overallIndex * 0.06; // Max 6% change

    // Apply segment-specific adjustments
    let ethMultiplier = 1;
    let btcMultiplier = 1;

    if (sentiment.segmentScores.crypto > 0.3) {
      ethMultiplier *= 1.2; // Crypto-specific news has more impact on ETH
    }
    if (sentiment.segmentScores.macro < -0.3) {
      ethMultiplier *= 0.8; // Macro headwinds reduce impact
    }

    return {
      eth: currentETH * (1 + ethChange * ethMultiplier),
      btc: currentBTC * (1 + btcChange * btcMultiplier)
    };
  }

  private extractEntitiesFromArticle(article: EnrichedNewsArticle): string[] {
    const text = (article.title + ' ' + (article.summary || '')).toLowerCase();
    const entities: string[] = [];

    Object.keys(this.ENTITY_INFLUENCE_WEIGHTS).forEach(entity => {
      if (text.includes(entity)) {
        entities.push(entity);
      }
    });

    return entities;
  }

  private capitalizeEntity(entity: string): string {
    return entity.split(' ').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  private determineEntityTrend(sentiment: number): 'Improving' | 'Stable' | 'Deteriorating' {
    if (sentiment > 0.2) return 'Improving';
    if (sentiment < -0.2) return 'Deteriorating';
    return 'Stable';
  }

  private calculateAverage(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  }
}

export const predictionModel = new PredictionModel();