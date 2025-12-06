/**
 * Real Social Media and Influencer Analysis
 * Aggregates real social signals from Twitter, Reddit, and other platforms
 */

import { SentimentAnalysis } from './realSentimentAnalyzer';
import { SocialSentimentSummary } from './types';

export interface SocialPost {
  id: string;
  platform: 'twitter' | 'reddit' | 'telegram' | 'discord';
  author: string;
  username: string;
  followers?: number;
  content: string;
  url: string;
  timestamp: string;
  likes: number;
  shares: number;
  comments: number;
  sentiment: number; // -1 to 1
  mentions: string[];
  keywords: string[];
}

export interface InfluencerSignal {
  handle: string;
  platform: string;
  followers: number;
  verified: boolean;
  sentiment: 'Bullish' | 'Neutral' | 'Bearish';
  confidence: number;
  recentPosts: SocialPost[];
  influenceScore: number;
  engagementRate: number;
  category: 'analyst' | 'trader' | 'developer' | 'media' | 'institutional';
}

// SocialSentimentSummary interface is now imported from types.ts

export class RealSocialAggregator {
  private readonly TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;
  private readonly REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID;
  private readonly REDDIT_CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET;

  private rateLimitCache = new Map<string, { count: number; resetTime: number }>();
  private readonly RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
  private readonly MAX_REQUESTS_PER_WINDOW = 100;

  private async checkRateLimit(apiName: string): Promise<boolean> {
    const now = Date.now();
    const cache = this.rateLimitCache.get(apiName);

    if (!cache || now > cache.resetTime) {
      this.rateLimitCache.set(apiName, { count: 1, resetTime: now + this.RATE_LIMIT_WINDOW });
      return true;
    }

    if (cache.count >= this.MAX_REQUESTS_PER_WINDOW) {
      const waitTime = cache.resetTime - now;
      console.warn(`Rate limit exceeded for ${apiName}, waiting ${waitTime}ms`);
      return false;
    }

    cache.count++;
    return true;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async analyzeInfluencerSignals(
    articles: any[],
    sentimentAnalyses: SentimentAnalysis[]
  ): Promise<SocialSentimentSummary> {
    console.log('👥 Analyzing real social media signals...');

    const [influencerSignals, trendingTopics] = await Promise.all([
      this.fetchInfluencerSignals(),
      this.fetchTrendingTopics()
    ]);

    const platformScores = await this.analyzePlatformSentiments();
    const overallScore = this.calculateOverallSentiment(influencerSignals, platformScores);
    const credibilityWeightedScore = this.calculateCredibilityWeightedScore(influencerSignals);

    const influencerBreakdown = this.categorizeInfluencers(influencerSignals);
    const reach = this.calculateReach(influencerSignals);

    return {
      overallScore,
      influencerBreakdown,
      topInfluencers: influencerSignals.slice(0, 10),
      trendingTopics: trendingTopics.slice(0, 20),
      platformAnalysis: platformScores,
      credibilityWeightedScore,
      reach
    };
  }

  private async fetchInfluencerSignals(): Promise<InfluencerSignal[]> {
    const signals: InfluencerSignal[] = [];

    // Fetch from Twitter
    if (this.TWITTER_BEARER_TOKEN) {
      try {
        const twitterSignals = await this.fetchTwitterInfluencers();
        signals.push(...twitterSignals);
      } catch (error) {
        console.error('Error fetching Twitter influencers:', error);
      }
    }

    // Fetch from Reddit
    try {
      const redditSignals = await this.fetchRedditInfluencers();
      signals.push(...redditSignals);
    } catch (error) {
      console.error('Error fetching Reddit influencers:', error);
    }

    // Sort by influence score
    return signals.sort((a, b) => b.influenceScore - a.influenceScore);
  }

  private async fetchTwitterInfluencers(): Promise<InfluencerSignal[]> {
    const cryptoInfluencers = [
      { handle: 'VitalikButerin', category: 'developer' as const },
      { handle: 'elonmusk', category: 'media' as const },
      { handle: 'cz_binance', category: 'institutional' as const },
      { handle: 'saylor', category: 'institutional' as const },
      { handle: 'balajis', category: 'analyst' as const },
      { handle: 'aantonop', category: 'analyst' as const },
      { handle: 'APompliano', category: 'analyst' as const },
      { handle: 'ercwalton', category: 'developer' as const },
      { handle: 'brian_armstrong', category: 'institutional' as const },
      { handle: 'fredwilson', category: 'analyst' as const },
      { handle: 'bmorris', category: 'analyst' as const },
      { handle: 'twobitidiot', category: 'trader' as const },
      { handle: 'cobie', category: 'trader' as const },
      { handle: 'CryptoGodfather', category: 'analyst' as const },
      { handle: 'TheCryptoDog', category: 'trader' as const }
    ];

    const signals: InfluencerSignal[] = [];

    for (const influencer of cryptoInfluencers) {
      try {
        // Fetch user info
        const userResponse = await fetch(
          `https://api.twitter.com/2/users/by/username/${influencer.handle}?user.fields=public_metrics,verified,description`,
          {
            headers: {
              'Authorization': `Bearer ${this.TWITTER_BEARER_TOKEN}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (userResponse.ok) {
          const userData = await userResponse.json();

          // Fetch recent tweets
          const tweetsResponse = await fetch(
            `https://api.twitter.com/2/users/${userData.data.id}/tweets?tweet_fields=public_metrics,created_at&max_results=10&exclude=retweets`,
            {
              headers: {
                'Authorization': `Bearer ${this.TWITTER_BEARER_TOKEN}`,
                'Content-Type': 'application/json'
              }
            }
          );

          let recentPosts: SocialPost[] = [];
          if (tweetsResponse.ok) {
            const tweetsData = await tweetsResponse.json();
            recentPosts = tweetsData.data?.map((tweet: any) => ({
              id: tweet.id,
              platform: 'twitter' as const,
              author: userData.data.name || influencer.handle,
              username: influencer.handle,
              followers: userData.data.public_metrics?.followers_count || 0,
              content: tweet.text || '',
              url: `https://twitter.com/${influencer.handle}/status/${tweet.id}`,
              timestamp: tweet.created_at,
              likes: tweet.public_metrics?.like_count || 0,
              shares: tweet.public_metrics?.retweet_count || 0,
              comments: tweet.public_metrics?.reply_count || 0,
              sentiment: this.analyzePostSentiment(tweet.text),
              mentions: this.extractMentions(tweet.text),
              keywords: this.extractKeywords(tweet.text)
            })) || [];
          }

          const overallSentiment = this.calculateOverallSentimentFromPosts(recentPosts);
          const engagementRate = this.calculateEngagementRate(recentPosts, userData.data.public_metrics);

          signals.push({
            handle: `@${influencer.handle}`,
            platform: 'twitter',
            followers: userData.data.public_metrics?.followers_count || 0,
            verified: userData.data.verified || false,
            sentiment: overallSentiment,
            confidence: this.calculateConfidence(recentPosts),
            recentPosts,
            influenceScore: this.calculateInfluenceScore(
              userData.data.public_metrics?.followers_count || 0,
              overallSentiment,
              engagementRate,
              influencer.category
            ),
            engagementRate,
            category: influencer.category
          });
        }
      } catch (error) {
        console.warn(`Failed to fetch data for ${influencer.handle}:`, error);
      }

      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return signals;
  }

  private async fetchRedditInfluencers(): Promise<InfluencerSignal[]> {
    const cryptoSubreddits = [
      { name: 'cryptocurrency', category: 'social' as const },
      { name: 'Bitcoin', category: 'social' as const },
      { name: 'ethereum', category: 'social' as const },
      { name: 'CryptoMarkets', category: 'trader' as const },
      { name: 'CryptoCurrencyTrading', category: 'trader' as const }
    ];

    const signals: InfluencerSignal[] = [];

    for (const subreddit of cryptoSubreddits) {
      try {
        const response = await fetch(`https://www.reddit.com/r/${subreddit.name}/hot.json?limit=25`);

        if (response.ok) {
          const data = await response.json();
          const posts = data.data.children;

          // Analyze top posts and commenters
          const sentimentScores: number[] = [];
          let totalEngagement = 0;

          posts.forEach((post: any) => {
            const postData = post.data;
            const sentiment = this.analyzePostSentiment(postData.title + ' ' + postData.selftext);
            sentimentScores.push(sentiment);
            totalEngagement += postData.score + postData.num_comments;
          });

          const overallSentiment = sentimentScores.length > 0 ?
            sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length : 0;

          signals.push({
            handle: `r/${subreddit.name}`,
            platform: 'reddit',
            followers: data.data.subscribers || 0,
            verified: true, // Subreddits are verified communities
            sentiment: this.classifySentiment(overallSentiment),
            confidence: Math.min(0.9, sentimentScores.length / 20),
            recentPosts: posts.slice(0, 5).map((post: any) => ({
              id: post.data.id,
              platform: 'reddit' as const,
              author: post.data.author,
              username: post.data.author,
              content: post.data.title,
              url: `https://reddit.com${post.data.permalink}`,
              timestamp: new Date(post.data.created_utc * 1000).toISOString(),
              likes: post.data.score || 0,
              shares: 0, // Reddit doesn't have shares
              comments: post.data.num_comments || 0,
              sentiment: this.analyzePostSentiment(post.data.title),
              mentions: [],
              keywords: this.extractKeywords(post.data.title)
            })),
            influenceScore: Math.log10(data.data.subscribers || 1) * (totalEngagement / 1000),
            engagementRate: totalEngagement / (data.data.subscribers || 1),
            category: subreddit.category
          });
        }
      } catch (error) {
        console.error(`Error fetching from r/${subreddit.name}:`, error);
      }
    }

    return signals;
  }

  private async fetchTrendingTopics(): Promise<Array<{ topic: string; mentions: number; sentiment: number; growth: number }>> {
    const topics = new Map<string, { mentions: number; sentiment: number; recentMentions: number }>();

    // Fetch trending hashtags from Twitter
    if (this.TWITTER_BEARER_TOKEN) {
      try {
        // Currently Twitter API v2 doesn't have a direct trending endpoint
        // We'll extract trends from recent tweets of influencers
        const cryptoKeywords = ['BTC', 'ETH', 'DeFi', 'NFT', 'Web3', 'metaverse', 'staking', 'yield', 'DAO', 'layer2'];

        cryptoKeywords.forEach(keyword => {
          topics.set(keyword, { mentions: 0, sentiment: 0, recentMentions: 0 });
        });
      } catch (error) {
        console.error('Error fetching trending topics from Twitter:', error);
      }
    }

    // Analyze Reddit trends
    try {
      const subreddits = ['cryptocurrency', 'Bitcoin', 'ethereum'];
      for (const sub of subreddits) {
        const response = await fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=50`);
        if (response.ok) {
          const data = await response.json();
          data.data.children.forEach((post: any) => {
            const title = post.data.title.toLowerCase();

            // Check for mentions of crypto topics
            if (title.includes('bitcoin') || title.includes('btc')) {
              this.updateTopicCount(topics, 'Bitcoin', post.data.score);
            }
            if (title.includes('ethereum') || title.includes('eth')) {
              this.updateTopicCount(topics, 'Ethereum', post.data.score);
            }
            if (title.includes('defi')) {
              this.updateTopicCount(topics, 'DeFi', post.data.score);
            }
            if (title.includes('nft')) {
              this.updateTopicCount(topics, 'NFT', post.data.score);
            }
          });
        }
      }
    } catch (error) {
      console.error('Error analyzing Reddit trends:', error);
    }

    // Convert to array and calculate growth
    return Array.from(topics.entries()).map(([topic, data]) => ({
      topic,
      mentions: data.mentions,
      sentiment: data.mentions > 0 ? data.sentiment / data.mentions : 0,
      growth: data.mentions > 0 ? (data.recentMentions / data.mentions - 1) * 100 : 0
    })).sort((a, b) => b.mentions - a.mentions);
  }

  private updateTopicCount(
    topics: Map<string, { mentions: number; sentiment: number; recentMentions: number }>,
    topic: string,
    score: number
  ) {
    const existing = topics.get(topic) || { mentions: 0, sentiment: 0, recentMentions: 0 };
    const sentiment = this.analyzePostSentiment(topic);

    existing.mentions += 1;
    existing.sentiment += sentiment;
    existing.recentMentions += score > 100 ? 1 : 0.5;

    topics.set(topic, existing);
  }

  private async analyzePlatformSentiments(): Promise<SocialSentimentSummary['platformAnalysis']> {
    const scores: SocialSentimentSummary['platformAnalysis'] = {
      twitter: { score: 0, count: 0 },
      reddit: { score: 0, count: 0 },
      telegram: { score: 0, count: 0 }
    };

    // Analyze sentiment on each platform
    // This would integrate with platform-specific APIs
    // For now, return mock data that would be replaced with real API calls

    return scores;
  }

  private calculateOverallSentiment(
    influencerSignals: InfluencerSignal[],
    platformScores: SocialSentimentSummary['platformAnalysis']
  ): number {
    const influencerWeight = 0.7;
    const platformWeight = 0.3;

    const influencerScore = influencerSignals.length > 0 ?
      influencerSignals.reduce((sum, inf) => {
        const sentimentScore = inf.sentiment === 'Bullish' ? 1 : inf.sentiment === 'Bearish' ? -1 : 0;
        return sum + (sentimentScore * inf.confidence * inf.influenceScore);
      }, 0) / influencerSignals.length : 0;

    const platformScore = (
      platformScores.twitter.score +
      platformScores.reddit.score +
      platformScores.telegram.score
    ) / 3;

    return (influencerScore * influencerWeight) + (platformScore * platformWeight);
  }

  private calculateCredibilityWeightedScore(influencerSignals: InfluencerSignal[]): number {
    if (influencerSignals.length === 0) return 0;

    const weightedSum = influencerSignals.reduce((sum, inf) => {
      const credibility = inf.verified ? 1.2 : 1.0;
      const categoryWeight = {
        'institutional': 1.5,
        'developer': 1.3,
        'analyst': 1.2,
        'media': 1.1,
        'trader': 1.0
      }[inf.category] || 1.0;

      const sentimentScore = inf.sentiment === 'Bullish' ? 1 : inf.sentiment === 'Bearish' ? -1 : 0;

      return sum + (sentimentScore * inf.confidence * credibility * categoryWeight * inf.influenceScore);
    }, 0);

    const totalWeight = influencerSignals.reduce((sum, inf) => sum + inf.influenceScore, 0);

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  private categorizeInfluencers(influencerSignals: InfluencerSignal[]): SocialSentimentSummary['influencerBreakdown'] {
    const breakdown = {
      crypto: 0,
      traditional: 0,
      institutional: 0,
      media: 0
    };

    influencerSignals.forEach(inf => {
      if (inf.category === 'institutional' || inf.category === 'developer') {
        breakdown.institutional += inf.influenceScore;
      } else if (inf.category === 'analyst' || inf.category === 'trader') {
        breakdown.crypto += inf.influenceScore;
      } else if (inf.category === 'media') {
        breakdown.media += inf.influenceScore;
      }
    });

    const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
    if (total > 0) {
      Object.keys(breakdown).forEach(key => {
        breakdown[key as keyof typeof breakdown] /= total;
      });
    }

    return breakdown;
  }

  private calculateReach(influencerSignals: InfluencerSignal[]): number {
    // Calculate estimated unique reach
    const directFollowers = influencerSignals.reduce((sum, inf) => sum + inf.followers, 0);

    // Estimate engagement reach (typically 2-5% of followers see a post)
    const engagementReach = influencerSignals.reduce((sum, inf) => {
      const avgEngagement = inf.recentPosts.reduce((postSum, post) =>
        postSum + post.likes + post.shares + post.comments, 0
      ) / Math.max(inf.recentPosts.length, 1);

      return sum + (avgEngagement * 10); // Assume each engagement reaches 10 more people
    }, 0);

    return Math.round(directFollowers * 0.02 + engagementReach); // 2% of followers plus engagement reach
  }

  private analyzePostSentiment(text: string): number {
    // Simple sentiment analysis - could be enhanced with OpenAI API
    const positiveWords = ['bullish', 'buy', 'up', 'moon', 'pump', 'gain', 'profit', 'strong', 'good'];
    const negativeWords = ['bearish', 'sell', 'down', 'dump', 'crash', 'loss', 'weak', 'bad', 'fear'];

    const lowerText = text.toLowerCase();
    let score = 0;

    positiveWords.forEach(word => {
      if (lowerText.includes(word)) score += 0.1;
    });

    negativeWords.forEach(word => {
      if (lowerText.includes(word)) score -= 0.1;
    });

    return Math.max(-1, Math.min(1, score));
  }

  private calculateOverallSentimentFromPosts(posts: SocialPost[]): 'Bullish' | 'Neutral' | 'Bearish' {
    if (posts.length === 0) return 'Neutral';

    const avgSentiment = posts.reduce((sum, post) => sum + post.sentiment, 0) / posts.length;
    return this.classifySentiment(avgSentiment);
  }

  private classifySentiment(score: number): 'Bullish' | 'Neutral' | 'Bearish' {
    if (score > 0.1) return 'Bullish';
    if (score < -0.1) return 'Bearish';
    return 'Neutral';
  }

  private calculateConfidence(posts: SocialPost[]): number {
    if (posts.length === 0) return 0;

    // Confidence based on number of posts and engagement
    const postCount = Math.min(posts.length / 10, 1);
    const totalEngagement = posts.reduce((sum, post) => sum + post.likes + post.shares + post.comments, 0);
    const engagementScore = Math.min(totalEngagement / 10000, 1);

    return (postCount + engagementScore) / 2;
  }

  private calculateEngagementRate(posts: SocialPost[], publicMetrics?: any): number {
    if (!publicMetrics || publicMetrics.followers_count === 0) return 0;

    const totalEngagement = posts.reduce((sum, post) => sum + post.likes + post.shares + post.comments, 0);
    const followers = publicMetrics.followers_count;

    return (totalEngagement / followers) / posts.length;
  }

  private calculateInfluenceScore(
    followers: number,
    sentiment: string,
    engagementRate: number,
    category: string
  ): number {
    // Logarithmic scale for followers
    const followerScore = Math.log10(Math.max(followers, 1)) / 8; // Normalize by max (~100M followers)

    // Sentiment multiplier
    const sentimentMultiplier = sentiment === 'Bullish' || sentiment === 'Bearish' ? 1.2 : 1.0;

    // Category multiplier
    const categoryMultiplier = {
      'institutional': 2.0,
      'developer': 1.8,
      'analyst': 1.5,
      'media': 1.3,
      'trader': 1.0
    }[category] || 1.0;

    return followerScore * sentimentMultiplier * (1 + engagementRate) * categoryMultiplier;
  }

  private extractMentions(text: string): string[] {
    const mentions = text.match(/@\w+/g) || [];
    return mentions.map(m => m.substring(1));
  }

  private extractKeywords(text: string): string[] {
    const cryptoKeywords = ['BTC', 'ETH', 'DeFi', 'NFT', 'Web3', 'DAO', 'yield', 'staking', 'layer2'];
    const lowerText = text.toLowerCase();

    return cryptoKeywords.filter(keyword =>
      lowerText.includes(keyword.toLowerCase())
    );
  }
}

export const realSocialAggregator = new RealSocialAggregator();