/**
 * Comprehensive News Aggregation System
 * Multi-source news collection with deduplication and enrichment
 */

import { apiClient } from '../shared/api';
import { aiCache, CacheKeys } from '../shared/cache';

export interface RawNewsArticle {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  summary?: string;
  content?: string;
  author?: string;
  category?: string;
}

export interface EnrichedNewsArticle extends RawNewsArticle {
  duplicateGroup?: string;
  sourceTrust: number;
  recencyWeight: number;
  entityCount: number;
  marketRelevance: number;
  onChainMetadata?: {
    mentionedTokens: string[];
    mentionedAddresses: string[];
    mentionedProtocols: string[];
  };
  priceContext?: {
    ethPrice: number;
    btcPrice: number;
    marketCap: number;
    timestamp: number;
  };
}


export class NewsAggregator {
  private readonly SOURCE_TRUST_WEIGHTS = {
    // Top-tier financial sources
    'wsj.com': 0.95,
    'ft.com': 0.95,
    'bloomberg.com': 0.95,
    'reuters.com': 0.90,
    'economist.com': 0.90,

    // Crypto specialist sources
    'coindesk.com': 0.85,
    'cointelegraph.com': 0.85,
    'theblock.co': 0.85,
    'decrypt.co': 0.80,
    'theblockcrypto.com': 0.80,

    // Major news outlets
    'cnbc.com': 0.80,
    'forbes.com': 0.75,
    'techcrunch.com': 0.75,
    'wired.com': 0.70,

    // Social/influencer sources
    'reddit.com': 0.55,
    'youtube.com': 0.50,

    // Other sources
    'unknown': 0.40
  };

  private readonly RELEVANCE_KEYWORDS = {
    macroeconomic: [
      'federal reserve', 'fed', 'interest rate', 'inflation', 'cpi', 'pce',
      'gdp', 'employment', 'nfp', 'unemployment', 'recession', 'economy',
      'quantitative easing', 'qt', 'monetary policy', 'central bank'
    ],
    regulatory: [
      'sec', 'securities and exchange commission', 'regulation', 'compliance',
      'etf', 'bitcoin etf', 'ethereum etf', 'approval', 'rejection', 'lawsuit',
      'enforcement', 'guidance', 'rule', 'policy', 'legislation', 'bill'
    ],
    cryptocurrency: [
      'bitcoin', 'btc', 'ethereum', 'eth', 'cryptocurrency', 'crypto',
      'blockchain', 'defi', 'nft', 'web3', 'altcoin', 'stablecoin',
      'mining', 'staking', 'validator', 'smart contract', 'dapp'
    ],
    market: [
      'price', 'market', 'trading', 'volume', 'liquidity', 'exchange',
      'bull market', 'bear market', 'rally', 'crash', 'volatility',
      'correction', 'breakout', 'support', 'resistance', 'analysis'
    ],
    institutional: [
      'institutional', 'institution', 'fund', 'etf', 'mutual fund',
      'hedge fund', 'investment bank', 'goldman sachs', 'jpmorgan',
      'blackrock', 'fidelity', 'microsoft', 'tesla', 'apple'
    ],
    geopolitics: [
      'war', 'conflict', 'escalation', 'sanction', 'sanctions', 'tariff', 'tariffs',
      'russia', 'ukraine', 'israel', 'palestine', 'gaza', 'iran', 'china', 'taiwan', 'middle east'
    ],
    energy: [
      'oil', 'opec', 'wti', 'brent', 'gas prices', 'energy', 'natural gas'
    ],
    elections: [
      'election', 'vote', 'policy', 'legislation', 'budget', 'stimulus'
    ],
    global_markets: [
      'treasury yields', '10-year', 'bond yields', 'bonds', 'dollar index', 'dxy', 'gold', 'commodities'
    ]
  };

  async aggregateNews(forceRefresh: boolean = false, fast: boolean = false): Promise<EnrichedNewsArticle[]> {
    const cacheKey = CacheKeys.SENTIMENT_ANALYSIS(fast ? 'aggregated_fast' : 'aggregated');

    // Check cache first
    if (!forceRefresh) {
      const cached = aiCache.get<EnrichedNewsArticle[]>(cacheKey);
      if (cached) {
        console.log('📰 Using cached aggregated news');
        return cached;
      }
    }

    console.log('📰 Aggregating news from multiple sources...');

    try {
    const [newsApiArticles, cryptoPanicArticles, redditArticles] = await Promise.allSettled([
      this.fetchFromNewsAPI(fast),
      this.fetchFromCryptoPanic(),
      this.fetchFromReddit()
    ]);

      // Collect all successful results
      const allArticles: RawNewsArticle[] = [];

      if (newsApiArticles.status === 'fulfilled') {
        allArticles.push(...newsApiArticles.value);
      }
      if (cryptoPanicArticles.status === 'fulfilled') {
        allArticles.push(...cryptoPanicArticles.value);
      }
      if (redditArticles.status === 'fulfilled') {
        allArticles.push(...redditArticles.value);
      }
      

      console.log(`📰 Raw articles collected: ${allArticles.length}`);

      const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;
      const filtered = allArticles.filter(a => {
        const ts = new Date(a.publishedAt || '').getTime();
        if (!ts) return false;
        return (Date.now() - ts) <= twoWeeksMs;
      });

      const enrichedArticles = await this.enrichArticles(filtered);

      // Cache the results
      aiCache.set(cacheKey, enrichedArticles, fast ? 5 * 60 * 1000 : 15 * 60 * 1000);

      return enrichedArticles;

    } catch (error) {
      console.error('❌ News aggregation failed:', error);
      return [];
    }
  }

  

  

  private async fetchFromNewsAPI(fast: boolean = false): Promise<RawNewsArticle[]> {
    const apiKey = process.env.NEXT_PUBLIC_NEWS_API_KEY;
    if (!apiKey) return [];

    const queries = [
      '(cryptocurrency OR bitcoin OR ethereum OR blockchain) AND (price OR trading OR market)',
      '(federal reserve OR fed OR "interest rates" OR inflation)',
      '(sec OR "securities and exchange commission" OR etf OR regulation)',
      '(defi OR "decentralized finance" OR nft OR web3)',
      '("bear market" OR crash OR sell-off OR downturn OR liquidation) AND (bitcoin OR ethereum OR crypto)',
      '("bull market" OR rally OR breakout OR recovery OR accumulation) AND (bitcoin OR ethereum OR crypto)',
      '(war OR conflict OR escalation OR ceasefire OR invasion OR sanctions OR tariffs) AND (market OR oil OR inflation OR bitcoin OR ethereum OR crypto)',
      '(opec OR oil OR wti OR brent OR "gas prices" OR energy) AND (price OR market OR inflation OR economy)',
      '("dollar index" OR dxy OR "treasury yields" OR "10-year" OR bonds) AND (market OR stocks OR crypto OR risk)',
      '(election OR vote OR policy OR legislation OR bill) AND (market OR regulation OR crypto OR etf)',
      '(ecb OR "bank of england" OR "bank of japan") AND (rates OR policy OR bond OR yield OR yen OR euro)'
    ];

    const selectedQueries = fast ? queries : queries;
    const tasks = selectedQueries.map(query => (async () => {
      const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&language=en&pageSize=20&apiKey=${apiKey}`;
      const response = await apiClient.fetch(url, {
        cacheKey: `newsapi:${query.substring(0, 20)}`,
        cacheTTL: 10 * 60 * 1000,
        timeoutMs: 7000
      });
      if (response.success && response.data?.articles) {
        return (response.data.articles as unknown[]).map((article: unknown, index: number) => {
          const a = article as { title: string; source?: { name?: string }; url: string; publishedAt: string; description?: string; content?: string; author?: string };
          return {
            id: `newsapi_${query.substring(0, 10)}_${Date.now()}_${index}`,
            title: a.title,
            source: a.source?.name || 'Unknown',
            url: a.url,
            publishedAt: a.publishedAt,
            summary: a.description,
            content: a.content,
            author: a.author,
            category: this.categorizeArticle(a.title + ' ' + (a.description || ''))
          };
        });
      }
      return [] as RawNewsArticle[];
    })());

    const settled = await Promise.allSettled(tasks);
    const articles: RawNewsArticle[] = [];
    for (const s of settled) {
      if (s.status === 'fulfilled' && Array.isArray(s.value)) {
        articles.push(...s.value);
      }
    }
    return articles;
  }

  private async fetchFromCryptoPanic(): Promise<RawNewsArticle[]> {
    const disabled = (process.env.DISABLE_CRYPTOPANIC || '').toLowerCase() === '1' || (process.env.DISABLE_CRYPTOPANIC || '').toLowerCase() === 'true';
    if (disabled) return [];
    try {
      const url = 'https://cryptopanic.com/api/v1/posts/?auth_token=free&filter=rated&public=true';

      const response = await apiClient.fetch(url, {
        cacheKey: 'cryptopanic:posts',
        cacheTTL: 5 * 60 * 1000
      });

      if (response.success && response.data?.results) {
        return response.data.results
          .filter((post: unknown) => {
            const p = post as { url: string };
            try {
              const u = new URL(p.url);
              return !(u.hostname.includes('twitter.com') || u.hostname.includes('x.com'));
            } catch {
              return true;
            }
          })
          .map((post: unknown, index: number) => {
            const p = post as { title: string; url: string; published_at: string };
            return {
              id: `cryptopanic_${Date.now()}_${index}`,
              title: p.title,
              source: 'CryptoPanic',
              url: p.url,
              publishedAt: p.published_at,
              summary: p.title,
              category: this.categorizeArticle(p.title)
            };
          });
      }
    } catch (error) {
      console.warn('⚠️ CryptoPanic fetch failed:', error);
    }

    return [];
  }

  

  private async fetchFromReddit(): Promise<RawNewsArticle[]> {
    // Simulate Reddit crypto posts (in real implementation, use Reddit API)
    const mockRedditPosts = [
      {
        id: `reddit_${Date.now()}_1`,
        title: 'Breaking: Major Ethereum Upgrade Successfully Completed',
        source: 'r/ethereum',
        url: 'https://reddit.com/r/ethereum',
        publishedAt: new Date(Date.now() - 3600000).toISOString(),
        summary: 'Community discusses successful network upgrade and its implications',
        category: 'tech'
      },
      {
        id: `reddit_${Date.now()}_2`,
        title: 'Bitcoin Price Analysis: Key Support Levels Watched',
        source: 'r/BitcoinMarkets',
        url: 'https://reddit.com/r/BitcoinMarkets',
        publishedAt: new Date(Date.now() - 7200000).toISOString(),
        summary: 'Technical analysis of current market conditions and price targets',
        category: 'market'
      }
    ];

    return mockRedditPosts;
  }

  private async enrichArticles(articles: RawNewsArticle[]): Promise<EnrichedNewsArticle[]> {
    console.log('📰 Enriching articles with metadata...');

    const enriched = articles.map(article => this.enrichSingleArticle(article));

    // Deduplicate similar articles
    const deduplicated = this.deduplicateArticles(enriched);

    const scored = [...deduplicated].sort((a, b) => {
      const scoreA = a.marketRelevance * a.sourceTrust * (0.5 + a.recencyWeight * 0.5);
      const scoreB = b.marketRelevance * b.sourceTrust * (0.5 + b.recencyWeight * 0.5);
      return scoreB - scoreA;
    });

    return scored.slice(0, 100);
  }

  private enrichSingleArticle(article: RawNewsArticle): EnrichedNewsArticle {
    const sourceTrust = this.calculateSourceTrust(article.source);
    const recencyWeight = this.calculateRecencyWeight(article.publishedAt);
    const entityCount = this.extractEntities(article.title + ' ' + (article.summary || '')).length;
    const marketRelevance = this.calculateMarketRelevance(article);
    const onChainMetadata = this.extractOnChainMetadata(article);

    return {
      ...article,
      sourceTrust,
      recencyWeight,
      entityCount,
      marketRelevance,
      onChainMetadata
    };
  }

  private calculateSourceTrust(source: string): number {
    const domain = this.extractDomain(source);
    return this.SOURCE_TRUST_WEIGHTS[domain] || this.SOURCE_TRUST_WEIGHTS['unknown'];
  }

  private extractDomain(source: string): string {
    try {
      if (source.includes('r/')) return 'reddit.com';
      if (source.includes('CryptoPanic')) return 'cryptopanic.com';

      const url = source.includes('.') ? source : `https://${source}.com`;
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return 'unknown';
    }
  }

  private calculateRecencyWeight(publishedAt: string): number {
    const ageHours = (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60);
    const halfLifeHours = 6;
    return Math.exp(-Math.log(2) * ageHours / halfLifeHours);
  }

  private calculateMarketRelevance(article: RawNewsArticle): number {
    const text = (article.title + ' ' + (article.summary || '')).toLowerCase();
    let relevanceScore = 0;

    // Check relevance against different categories
    Object.entries(this.RELEVANCE_KEYWORDS).forEach(([category, keywords]) => {
      const matches = keywords.filter(keyword => text.includes(keyword)).length;
      relevanceScore += matches * this.getCategoryWeight(category);
    });

    // Boost for high-impact entities
    const highImpactEntities = ['fed', 'sec', 'bitcoin', 'ethereum', 'etf', 'opec', 'oil', 'war', 'sanction', 'tariff', 'russia', 'china', 'israel', 'ukraine', 'dxy', 'treasury', 'yield'];
    highImpactEntities.forEach(entity => {
      if (text.includes(entity)) relevanceScore += 0.3;
    });

    return Math.min(1.0, relevanceScore);
  }

  private getCategoryWeight(category: string): number {
    const weights = {
      macroeconomic: 0.25,
      regulatory: 0.30,
      cryptocurrency: 0.20,
      market: 0.15,
      institutional: 0.25,
      geopolitics: 0.25,
      energy: 0.20,
      elections: 0.20,
      global_markets: 0.25
    };
    return weights[category as keyof typeof weights] || 0.10;
  }

  private extractOnChainMetadata(article: RawNewsArticle): EnrichedNewsArticle['onChainMetadata'] {
    const text = (article.title + ' ' + (article.summary || '')).toLowerCase();

    const mentionedTokens: string[] = [];
    const mentionedAddresses: string[] = [];
    const mentionedProtocols: string[] = [];

    // Extract common token references
    const tokens = ['bitcoin', 'btc', 'ethereum', 'eth', 'usdt', 'usdc', 'bnb', 'sol', 'ada', 'dot'];
    tokens.forEach(token => {
      if (text.includes(token)) mentionedTokens.push(token.toUpperCase());
    });

    // Extract protocol references
    const protocols = ['uniswap', 'compound', 'aave', 'curve', 'sushiswap', 'pancakeswap'];
    protocols.forEach(protocol => {
      if (text.includes(protocol)) mentionedProtocols.push(protocol);
    });

    return {
      mentionedTokens,
      mentionedAddresses,
      mentionedProtocols
    };
  }

  private extractEntities(text: string): string[] {
    const entities: string[] = [];

    // Financial entities
    const financialEntities = [
      'federal reserve', 'fed', 'ecb', 'bank of england', 'bank of japan',
      'sec', 'cftc', 'fca', 'esma', 'mas', 'asic',
      'jpmorgan', 'goldman sachs', 'blackrock', 'fidelity', 'morgan stanley'
    ];

    // Crypto entities
    const cryptoEntities = [
      'bitcoin', 'btc', 'ethereum', 'eth', 'tether', 'usdt', 'usd coin', 'usdc',
      'binance', 'coinbase', 'kraken', 'gemini', 'uniswap', 'compound', 'aave'
    ];

    // Economic indicators
    const economicIndicators = [
      'cpi', 'pce', 'gdp', 'nfp', 'inflation', 'deflation', 'recession',
      'interest rate', 'yield curve', 'quantitative easing', 'qt'
    ];

    [financialEntities, cryptoEntities, economicIndicators].forEach(category => {
      category.forEach(entity => {
        if (text.toLowerCase().includes(entity.toLowerCase())) {
          entities.push(entity);
        }
      });
    });

    return [...new Set(entities)]; // Remove duplicates
  }

  private categorizeArticle(text: string): string {
    const textLower = text.toLowerCase();

    if (this.RELEVANCE_KEYWORDS.regulatory.some(keyword => textLower.includes(keyword))) {
      return 'regulation';
    }
    if (this.RELEVANCE_KEYWORDS.macroeconomic.some(keyword => textLower.includes(keyword))) {
      return 'macro';
    }
    if (this.RELEVANCE_KEYWORDS.institutional.some(keyword => textLower.includes(keyword))) {
      return 'institutional';
    }
    if (this.RELEVANCE_KEYWORDS.market.some(keyword => textLower.includes(keyword))) {
      return 'market';
    }
    if (this.RELEVANCE_KEYWORDS.cryptocurrency.some(keyword => textLower.includes(keyword))) {
      return 'tech';
    }
    if (this.RELEVANCE_KEYWORDS.geopolitics.some(keyword => textLower.includes(keyword))) {
      return 'geopolitics';
    }
    if (this.RELEVANCE_KEYWORDS.energy.some(keyword => textLower.includes(keyword))) {
      return 'energy';
    }
    if (this.RELEVANCE_KEYWORDS.elections.some(keyword => textLower.includes(keyword))) {
      return 'election';
    }
    if (this.RELEVANCE_KEYWORDS.global_markets.some(keyword => textLower.includes(keyword))) {
      return 'macro';
    }

    return 'general';
  }

  private deduplicateArticles(articles: EnrichedNewsArticle[]): EnrichedNewsArticle[] {
    const groups = new Map<string, EnrichedNewsArticle[]>();

    // Group articles by similarity
    articles.forEach(article => {
      const groupKey = this.generateGroupKey(article);

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(article);
    });

    // Select best article from each group
    const deduplicated: EnrichedNewsArticle[] = [];

    groups.forEach(group => {
      // Sort by trust and relevance, then take the best one
      group.sort((a, b) => {
        const scoreA = a.sourceTrust * a.marketRelevance;
        const scoreB = b.sourceTrust * b.marketRelevance;
        return scoreB - scoreA;
      });

      const best = group[0];
      const groupId = `group_${groups.size}`;
      best.duplicateGroup = groupId;
      deduplicated.push(best);


    });

    return deduplicated;
  }

  private generateGroupKey(article: EnrichedNewsArticle): string {
    // Simple grouping based on title similarity
    const title = article.title.toLowerCase();
    const keyWords = title.split(' ').slice(0, 5).join(' ');
    return keyWords.replace(/[^a-z0-9\s]/g, '').trim();
  }
}

export const newsAggregator = new NewsAggregator();
