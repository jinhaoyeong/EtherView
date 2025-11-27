/**
 * Influencer Weighting System
 * Social signal analysis with influencer impact scoring
 */

import { EnrichedNewsArticle } from './newsAggregator';
import { SentimentAnalysis } from './sentimentAnalyzer';

export interface InfluencerSignal {
  handle: string;
  name: string;
  platform: 'Reddit' | 'YouTube' | 'LinkedIn' | 'Blog';
  followers: number;
  engagement: number;
  sentiment: number; // -1 to 1
  credibility: number; // 0 to 1
  topic: string;
  timestamp: string;
  url?: string;
  impactScore: number;
}

export interface SocialSentimentSummary {
  overallScore: number;
  influencerBreakdown: {
    crypto: number;
    traditional: number;
    institutional: number;
    media: number;
  };
  topInfluencers: InfluencerSignal[];
  trendingTopics: Array<{ topic: string; mentions: number; sentiment: number }>;
  platformAnalysis: {
    reddit: { score: number; count: number };
    youtube: { score: number; count: number };
  };
  credibilityWeightedScore: number;
  reach: number; // Estimated unique reach
}

export class InfluencerWeighting {
  private readonly PROFILE_SHAPE: { weight?: number; credibility?: number; category?: string } = {};
  private readonly INFLUENCER_WEIGHTS = {
    // Crypto OGs and Founders (Highest credibility)
    'Vitalik Buterin': { weight: 1.0, credibility: 0.95, category: 'crypto' },
    'Brian Armstrong': { weight: 0.9, credibility: 0.90, category: 'crypto' },
    'Changpeng Zhao': { weight: 0.85, credibility: 0.85, category: 'crypto' },
    'Jesse Powell': { weight: 0.8, credibility: 0.80, category: 'crypto' },
    'Satoshi Nakamoto': { weight: 0.95, credibility: 1.0, category: 'crypto' }, // Historical

    // Major Investors (High credibility)
    'Michael Saylor': { weight: 0.9, credibility: 0.85, category: 'institutional' },
    'Cathie Wood': { weight: 0.8, credibility: 0.75, category: 'institutional' },
    'Tyler Winklevoss': { weight: 0.7, credibility: 0.70, category: 'institutional' },
    'Cameron Winklevoss': { weight: 0.7, credibility: 0.70, category: 'institutional' },

    // Traditional Finance (Medium-high credibility in crypto context)
    'Jamie Dimon': { weight: 0.6, credibility: 0.80, category: 'traditional' },
    'Larry Fink': { weight: 0.7, credibility: 0.85, category: 'institutional' },
    'Ray Dalio': { weight: 0.6, credibility: 0.80, category: 'traditional' },

    // Crypto Influencers (Variable credibility)
    'Andreas Antonopoulos': { weight: 0.7, credibility: 0.75, category: 'crypto' },
    'Anthony Pompliano': { weight: 0.5, credibility: 0.60, category: 'crypto' },
    'Max Keiser': { weight: 0.4, credibility: 0.55, category: 'crypto' },
    'PlanB': { weight: 0.6, credibility: 0.65, category: 'crypto' },

    // Media Outlets
    'CoinDesk': { weight: 0.8, credibility: 0.85, category: 'media' },
    'Cointelegraph': { weight: 0.75, credibility: 0.80, category: 'media' },
    'The Block': { weight: 0.75, credibility: 0.80, category: 'media' },
    'Decrypt': { weight: 0.6, credibility: 0.70, category: 'media' }
  };

  private readonly PLATFORM_MULTIPLIERS = {
    Reddit: 0.9,  // Community consensus, niche reach
    YouTube: 1.1, // High engagement, visual content
    LinkedIn: 0.7, // Professional context, slower adoption
    Blog: 0.5      // Thought leadership, limited reach
  };

  async analyzeInfluencerSignals(
    articles: EnrichedNewsArticle[],
    sentimentAnalyses: SentimentAnalysis[]
  ): Promise<SocialSentimentSummary> {
    console.log('👥 Analyzing influencer signals...');

    // Extract influencer mentions from articles
    const influencerSignals = this.extractInfluencerSignals(articles, sentimentAnalyses);

    // Generate mock social signals (in real implementation, fetch from social APIs)
    const mockSocialSignals = this.generateMockSocialSignals();

    // Combine all signals
    const allSignals = [...influencerSignals, ...mockSocialSignals];

    // Calculate weighted sentiment
    const overallScore = this.calculateWeightedSentiment(allSignals);

    // Analyze by category
    const influencerBreakdown = this.analyzeByCategory(allSignals);

    // Get top influencers
    const topInfluencers = this.getTopInfluencers(allSignals);

    // Analyze trending topics
    const trendingTopics = this.analyzeTrendingTopics(allSignals);

    // Platform analysis
    const platformAnalysis = this.analyzePlatforms(allSignals);

    // Calculate credibility-weighted score
    const credibilityWeightedScore = this.calculateCredibilityWeightedScore(allSignals);

    // Estimate reach
    const reach = this.estimateReach(allSignals);

    return {
      overallScore,
      influencerBreakdown,
      topInfluencers,
      trendingTopics,
      platformAnalysis,
      credibilityWeightedScore,
      reach
    };
  }

  private extractInfluencerSignals(
    articles: EnrichedNewsArticle[],
    sentimentAnalyses: SentimentAnalysis[]
  ): InfluencerSignal[] {
    const signals: InfluencerSignal[] = [];

    articles.forEach((article, index) => {
      const sentiment = sentimentAnalyses[index];
      const text = (article.title + ' ' + (article.summary || '')).toLowerCase();

      // Check for influencer mentions
      Object.entries(this.INFLUENCER_WEIGHTS).forEach(([name, profile]) => {
        if (text.includes(name.toLowerCase())) {
          signals.push({
            handle: `@${name.toLowerCase().replace(/\s+/g, '')}`,
            name,
            platform: 'Blog',
            followers: this.estimateFollowers(name),
            engagement: this.estimateEngagement(name),
            sentiment: sentiment.score,
            credibility: profile.credibility,
            topic: article.category || 'general',
            timestamp: article.publishedAt,
            url: article.url,
            impactScore: this.calculateImpactScore(profile, sentiment.score, article.sourceTrust)
          });
        }
      });
    });

    return signals;
  }

  private generateMockSocialSignals(): InfluencerSignal[] {
    const now = new Date().toISOString();

    // Generate realistic mock signals based on current market sentiment
    const mockSignals: InfluencerSignal[] = [
      {
        handle: 'r/CryptoCurrency',
        name: 'r/CryptoCurrency',
        platform: 'Reddit',
        followers: 6200000,
        engagement: 0.25,
        sentiment: -0.1,
        credibility: 0.65,
        topic: 'Market Discussion',
        timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        impactScore: 0.55
      },
      {
        handle: 'Crypto YouTube Analyst',
        name: 'Crypto YouTube Analyst',
        platform: 'YouTube',
        followers: 900000,
        engagement: 0.1,
        sentiment: 0.2,
        credibility: 0.7,
        topic: 'On-chain analysis',
        timestamp: now,
        impactScore: 0.6
      }
    ];

    return mockSignals;
  }

  private calculateWeightedSentiment(signals: InfluencerSignal[]): number {
    if (signals.length === 0) return 0;

    let weightedSum = 0;
    let totalWeight = 0;

    signals.forEach(signal => {
      const weight = signal.impactScore * signal.credibility;
      weightedSum += signal.sentiment * weight;
      totalWeight += weight;
    });

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  private analyzeByCategory(signals: InfluencerSignal[]): SocialSentimentSummary['influencerBreakdown'] {
    const categories = {
      crypto: { sum: 0, count: 0 },
      traditional: { sum: 0, count: 0 },
      institutional: { sum: 0, count: 0 },
      media: { sum: 0, count: 0 }
    };

    signals.forEach(signal => {
      const profile = this.INFLUENCER_WEIGHTS[signal.name];
      const category = profile?.category || 'crypto';

      if (category in categories) {
        const weightedSentiment = signal.sentiment * signal.impactScore;
        categories[category as keyof typeof categories].sum += weightedSentiment;
        categories[category as keyof typeof categories].count++;
      }
    });

    // Calculate averages
    const result = {} as SocialSentimentSummary['influencerBreakdown'];
    Object.entries(categories).forEach(([category, data]) => {
      result[category as keyof typeof result] = data.count > 0 ? data.sum / data.count : 0;
    });

    return result;
  }

  private getTopInfluencers(signals: InfluencerSignal[]): InfluencerSignal[] {
    return signals
      .sort((a, b) => b.impactScore - a.impactScore)
      .slice(0, 10);
  }

  private analyzeTrendingTopics(signals: InfluencerSignal[]): SocialSentimentSummary['trendingTopics'] {
    const topicMap = new Map<string, { mentions: number; sentimentSum: number }>();

    signals.forEach(signal => {
      if (!topicMap.has(signal.topic)) {
        topicMap.set(signal.topic, { mentions: 0, sentimentSum: 0 });
      }
      const topic = topicMap.get(signal.topic)!;
      topic.mentions++;
      topic.sentimentSum += signal.sentiment * signal.impactScore;
    });

    return Array.from(topicMap.entries())
      .map(([topic, data]) => ({
        topic,
        mentions: data.mentions,
        sentiment: data.sentimentSum / data.mentions
      }))
      .sort((a, b) => b.mentions - a.mentions)
      .slice(0, 8);
  }

  private analyzePlatforms(signals: InfluencerSignal[]): SocialSentimentSummary['platformAnalysis'] {
    const platforms = {
      reddit: { score: 0, count: 0 },
      youtube: { score: 0, count: 0 }
    };

    signals.forEach(signal => {
      const platform = signal.platform.toLowerCase();
      if (platform in platforms) {
        platforms[platform as keyof typeof platforms].score += signal.sentiment * signal.impactScore;
        platforms[platform as keyof typeof platforms].count++;
      }
    });

    return platforms;
  }

  private calculateCredibilityWeightedScore(signals: InfluencerSignal[]): number {
    if (signals.length === 0) return 0;

    let weightedSum = 0;
    let totalWeight = 0;

    signals.forEach(signal => {
      const weight = signal.credibility * this.PLATFORM_MULTIPLIERS[signal.platform];
      weightedSum += signal.sentiment * weight;
      totalWeight += weight;
    });

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  private estimateReach(signals: InfluencerSignal[]): number {
    // Simple reach estimation: followers * engagement * platform multiplier
    return signals.reduce((total, signal) => {
      const platformMultiplier = this.PLATFORM_MULTIPLIERS[signal.platform];
      const estimatedReach = signal.followers * signal.engagement * platformMultiplier;
      return total + estimatedReach;
    }, 0);
  }

  private estimateFollowers(name: string): number {
    // Mock follower counts based on known influencers
    const followerEstimates: Record<string, number> = {
      'Vitalik Buterin': 5200000,
      'Brian Armstrong': 1100000,
      'Changpeng Zhao': 8500000,
      'Jesse Powell': 750000,
      'Michael Saylor': 3400000,
      'Cathie Wood': 1800000,
      'Tyler Winklevoss': 500000,
      'Cameron Winklevoss': 500000,
      'Jamie Dimon': 1200000,
      'Larry Fink': 800000,
      'Ray Dalio': 600000,
      'Andreas Antonopoulos': 700000,
      'Anthony Pompliano': 1800000,
      'Max Keiser': 900000,
      'Elon Musk': 180000000
    };

    return followerEstimates[name] || 100000; // Default estimate
  }

  private estimateEngagement(name: string): number {
    // Mock engagement rates based on typical social media patterns
    const engagementRates: Record<string, number> = {
      'Elon Musk': 0.05, // Massive following = lower relative engagement
      'Vitalik Buterin': 0.08,
      'Michael Saylor': 0.12, // High engagement on crypto topics
      'Anthony Pompliano': 0.15, // Very engaged community
      'Max Keiser': 0.10,
      'Cathie Wood': 0.06
    };

    return engagementRates[name] || 0.08; // Default engagement rate
  }

  private calculateImpactScore(
    profile: { weight?: number; credibility?: number; category?: string },
    sentiment: number,
    sourceTrust: number
  ): number {
    const baseWeight = profile.weight || 0.5;
    const sentimentAmplifier = Math.abs(sentiment) > 0.5 ? 1.2 : 1.0;
    const sourceAmplifier = sourceTrust > 0.8 ? 1.1 : 1.0;

    return baseWeight * sentimentAmplifier * sourceAmplifier;
  }
}

export const influencerWeighting = new InfluencerWeighting();