/**
 * CoinMarketCap Provider
 * Provides whitelist pricing and metadata for top 100 cryptocurrencies
 */

export interface CMCQuote {
  symbol: string;
  name: string;
  quote: {
    USD: {
      price: number;
      volume_24h: number;
      market_cap: number;
      percent_change_1h: number;
      percent_change_24h: number;
      percent_change_7d: number;
      last_updated: string;
    };
  };
  cmc_rank: number;
  circulating_supply: number;
  total_supply: number;
  max_supply: number | null;
  date_added: string;
  tags: string[];
  platform: {
    id: number;
    name: string;
    symbol: string;
    token_address: string | null;
  } | null;
}

export interface CMCResponse {
  status: {
    timestamp: string;
    error_code: number;
    error_message: string | null;
    elapsed: number;
    credit_count: number;
    notice: string | null;
  };
  data: {
    [key: string]: CMCQuote;
  };
}

export interface NormalizedCMCQuote {
  symbol: string;
  name: string;
  price: number;
  volume24h: number;
  marketCap: number;
  change1h: number;
  change24h: number;
  change7d: number;
  source: 'cmc';
  confidence: number;
  rank: number;
  circulatingSupply: number;
  totalSupply: number;
  maxSupply: number | null;
  dateAdded: string;
  tags: string[];
  platform?: {
    id: number;
    name: string;
    symbol: string;
    tokenAddress: string | null;
  };
}

export interface CMCCacheEntry {
  quote: NormalizedCMCQuote;
  timestamp: number;
  expiresAt: number;
}

class CoinMarketCapProvider {
  private readonly API_KEY: string;
  private readonly BASE_URL = 'https://pro-api.coinmarketcap.com/v1';
  private readonly CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
  private cache = new Map<string, CMCCacheEntry>();
  private readonly MAX_REQUESTS_PER_MINUTE = 30;
  private requestCount = 0;
  private lastRequestReset = Date.now();

  constructor() {
    this.API_KEY = process.env.COINMARKETCAP_API_KEY || '';
    if (!this.API_KEY) {
      console.warn('⚠️ COINMARKETCAP_API_KEY not found in environment variables');
    }
  }

  /**
   * Check rate limits and wait if necessary
   */
  private async checkRateLimit(): Promise<void> {
    const now = Date.now();

    // Reset counter every minute
    if (now - this.lastRequestReset > 60000) {
      this.requestCount = 0;
      this.lastRequestReset = now;
    }

    // Wait if we're approaching the limit
    if (this.requestCount >= this.MAX_REQUESTS_PER_MINUTE - 2) {
      const waitTime = 60000 - (now - this.lastRequestReset);
      if (waitTime > 0) {
        console.log(`⏳ CMC Rate limit reached, waiting ${Math.ceil(waitTime / 1000)}s`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  /**
   * Get cached quotes or return null if expired/not found
   */
  private getCachedQuotes(symbols: string[]): Map<string, NormalizedCMCQuote> | null {
    const cached = new Map<string, NormalizedCMCQuote>();
    const allFound = symbols.every(symbol => {
      const cacheKey = symbol.toUpperCase();
      const entry = this.cache.get(cacheKey);

      if (!entry || Date.now() > entry.expiresAt) {
        return false;
      }

      cached.set(cacheKey, entry.quote);
      return true;
    });

    return allFound ? cached : null;
  }

  /**
   * Cache quotes with timestamp
   */
  private setCachedQuotes(quotes: NormalizedCMCQuote[]): void {
    quotes.forEach(quote => {
      const cacheKey = quote.symbol.toUpperCase();
      this.cache.set(cacheKey, {
        quote,
        timestamp: Date.now(),
        expiresAt: Date.now() + this.CACHE_DURATION
      });
    });
  }

  /**
   * Normalize CMC response to our format
   */
  private normalizeCMCData(cmcData: { [key: string]: CMCQuote }): NormalizedCMCQuote[] {
    return Object.values(cmcData).map(item => ({
      symbol: item.symbol,
      name: item.name,
      price: item.quote.USD.price,
      volume24h: item.quote.USD.volume_24h || 0,
      marketCap: item.quote.USD.market_cap || 0,
      change1h: item.quote.USD.percent_change_1h || 0,
      change24h: item.quote.USD.percent_change_24h || 0,
      change7d: item.quote.USD.percent_change_7d || 0,
      source: 'cmc' as const,
      confidence: 0.95, // High confidence for CMC whitelist data
      rank: item.cmc_rank,
      circulatingSupply: item.circulating_supply || 0,
      totalSupply: item.total_supply || 0,
      maxSupply: item.max_supply,
      dateAdded: item.date_added,
      tags: item.tags || [],
      platform: item.platform ? {
        id: item.platform.id,
        name: item.platform.name,
        symbol: item.platform.symbol,
        tokenAddress: item.platform.token_address
      } : undefined
    }));
  }

  /**
   * Fetch quotes for multiple symbols from CoinMarketCap
   */
  async getWhitelistQuotes(symbols: string[]): Promise<Map<string, NormalizedCMCQuote>> {
    if (!this.API_KEY) {
      throw new Error('CMC_API_KEY not configured');
    }

    if (symbols.length === 0) {
      return new Map();
    }

    // Normalize symbols
    const normalizedSymbols = symbols.map(s => s.toUpperCase().replace(/\s+/g, ''));

    // Check cache first
    const cached = this.getCachedQuotes(normalizedSymbols);
    if (cached) {
      console.log(`📦 CMC Cache hit for ${cached.size} symbols`);
      return cached;
    }

    await this.checkRateLimit();
    this.requestCount++;

    console.log(`🔍 Fetching ${normalizedSymbols.length} symbols from CMC`);

    try {
      const response = await fetch(
        `${this.BASE_URL}/cryptocurrency/quotes/latest?symbol=${normalizedSymbols.join(',')}&convert=USD`,
        {
          method: 'GET',
          headers: {
            'X-CMC_PRO_API_KEY': this.API_KEY,
            'Accept': 'application/json',
            'User-Agent': 'EtherView/1.0'
          }
        }
      );

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('CMC rate limit exceeded');
        }
        throw new Error(`CMC API error: ${response.status} ${response.statusText}`);
      }

      const data: CMCResponse = await response.json();

      if (data.status.error_code !== 0) {
        throw new Error(`CMC API error: ${data.status.error_message}`);
      }

      const normalizedQuotes = this.normalizeCMCData(data.data);

      // Cache the results
      this.setCachedQuotes(normalizedQuotes);

      const result = new Map<string, NormalizedCMCQuote>();
      normalizedQuotes.forEach(quote => {
        result.set(quote.symbol.toUpperCase(), quote);
      });

      console.log(`✅ CMC fetched ${result.size} quotes successfully`);
      return result;

    } catch (error) {
      console.error('❌ CMC API error:', error);

      // Return partial cache if available
      const partialCache = new Map<string, NormalizedCMCQuote>();
      normalizedSymbols.forEach(symbol => {
        const entry = this.cache.get(symbol);
        if (entry && entry.timestamp) {
          partialCache.set(symbol, entry.quote);
        }
      });

      if (partialCache.size > 0) {
        console.log(`📦 CMC Partial cache fallback: ${partialCache.size} symbols`);
        return partialCache;
      }

      throw error;
    }
  }

  /**
   * Get top 100 cryptocurrency quotes
   */
  async getTop100Quotes(): Promise<Map<string, NormalizedCMCQuote>> {
    if (!this.API_KEY) {
      throw new Error('CMC_API_KEY not configured');
    }

    await this.checkRateLimit();
    this.requestCount++;

    console.log('🔍 Fetching top 100 cryptocurrencies from CMC');

    try {
      const response = await fetch(
        `${this.BASE_URL}/cryptocurrency/listings/latest?limit=100&convert=USD`,
        {
          method: 'GET',
          headers: {
            'X-CMC_PRO_API_KEY': this.API_KEY,
            'Accept': 'application/json',
            'User-Agent': 'EtherView/1.0'
          }
        }
      );

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('CMC rate limit exceeded');
        }
        throw new Error(`CMC API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data.status.error_code !== 0) {
        throw new Error(`CMC API error: ${data.status.error_message}`);
      }

      const normalizedQuotes: NormalizedCMCQuote[] = data.data.map((item: any) => ({
        symbol: item.symbol,
        name: item.name,
        price: item.quote.USD.price,
        volume24h: item.quote.USD.volume_24h || 0,
        marketCap: item.quote.USD.market_cap || 0,
        change1h: item.quote.USD.percent_change_1h || 0,
        change24h: item.quote.USD.percent_change_24h || 0,
        change7d: item.quote.USD.percent_change_7d || 0,
        source: 'cmc' as const,
        confidence: 0.95,
        rank: item.cmc_rank,
        circulatingSupply: item.circulating_supply || 0,
        totalSupply: item.total_supply || 0,
        maxSupply: item.max_supply,
        dateAdded: item.date_added,
        tags: item.tags || [],
        platform: item.platform ? {
          id: item.platform.id,
          name: item.platform.name,
          symbol: item.platform.symbol,
          tokenAddress: item.platform.token_address
        } : undefined
      }));

      // Cache the results
      this.setCachedQuotes(normalizedQuotes);

      const result = new Map<string, NormalizedCMCQuote>();
      normalizedQuotes.forEach(quote => {
        result.set(quote.symbol.toUpperCase(), quote);
      });

      console.log(`✅ CMC fetched top ${result.size} quotes successfully`);
      return result;

    } catch (error) {
      console.error('❌ CMC API error:', error);
      throw error;
    }
  }

  /**
   * Get provider statistics
   */
  getStats() {
    return {
      name: 'CoinMarketCap',
      cacheSize: this.cache.size,
      requestsThisMinute: this.requestCount,
      maxRequestsPerMinute: this.MAX_REQUESTS_PER_MINUTE,
      cacheDuration: this.CACHE_DURATION,
      apiKeyConfigured: !!this.API_KEY
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('🗑️ CMC cache cleared');
  }
}

export const cmcProvider = new CoinMarketCapProvider();

// Legacy export for compatibility
export interface CMCQuoteLegacy {
  usd: number;
  source: string;
  confidence: number;
}

export async function getWhitelistQuotes(symbols: string[]): Promise<Record<string, CMCQuoteLegacy>> {
  try {
    const quotes = await cmcProvider.getWhitelistQuotes(symbols);
    const result: Record<string, CMCQuoteLegacy> = {};

    quotes.forEach((quote, symbol) => {
      result[symbol] = {
        usd: quote.price,
        source: quote.source,
        confidence: quote.confidence
      };
    });

    return result;
  } catch (error) {
    console.error('❌ CMC getWhitelistQuotes error:', error);
    return {};
  }
}