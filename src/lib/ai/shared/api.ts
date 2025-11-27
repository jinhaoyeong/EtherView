/**
 * API Utilities for AI Analysis
 * Provides consistent API calling patterns with error handling and rate limiting
 */

export interface APIResponse<T> {
  data?: T;
  error?: string;
  success: boolean;
  cached?: boolean;
  rateLimited?: boolean;
}

export interface RateLimiter {
  requests: number;
  window: number; // in milliseconds
  maxRequests: number;
}

class APIRateLimiter {
  private requests: number[] = [];

  canMakeRequest(maxRequests: number, window: number): boolean {
    const now = Date.now();
    // Remove old requests outside the window
    this.requests = this.requests.filter(time => now - time < window);

    return this.requests.length < maxRequests;
  }

  recordRequest(): void {
    this.requests.push(Date.now());
  }

  getTimeUntilNextRequest(maxRequests: number, window: number): number {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < window);

    if (this.requests.length < maxRequests) return 0;

    const oldestRequest = Math.min(...this.requests);
    return oldestRequest + window - now;
  }
}

export class APIClient {
  private rateLimiters = new Map<string, APIRateLimiter>();
  private defaultTimeout = 10000; // 10 seconds

  async fetch<T>(
    url: string,
    options: RequestInit & {
      rateLimit?: RateLimiter;
      cacheKey?: string;
      cacheTTL?: number;
      timeoutMs?: number;
    } = {}
  ): Promise<APIResponse<T>> {
    const {
      rateLimit,
      cacheKey,
      cacheTTL,
      timeoutMs,
      ...fetchOptions
    } = options;

    try {
      // Check rate limiting
      if (rateLimit) {
        const limiter = this.getRateLimiter(url);

        if (!limiter.canMakeRequest(rateLimit.maxRequests, rateLimit.window)) {
          const waitTime = limiter.getTimeUntilNextRequest(rateLimit.maxRequests, rateLimit.window);
          return {
            success: false,
            error: `Rate limited. Try again in ${Math.ceil(waitTime / 1000)} seconds.`,
            rateLimited: true
          };
        }

        limiter.recordRequest();
      }

      // Check cache
      if (cacheKey) {
        const { aiCache } = await import('./cache');
        const cached = aiCache.get<T>(cacheKey);
        if (cached) {
          return {
            success: true,
            data: cached,
            cached: true
          };
        }
      }

      // Make request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs ?? this.defaultTimeout);

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Cache result
      if (cacheKey && data) {
        const { aiCache } = await import('./cache');
        aiCache.set(cacheKey, data, cacheTTL);
      }

      return {
        success: true,
        data
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  async fetchText(
    url: string,
    options: RequestInit & {
      rateLimit?: RateLimiter;
      cacheKey?: string;
      cacheTTL?: number;
      timeoutMs?: number;
    } = {}
  ): Promise<APIResponse<string>> {
    const {
      rateLimit,
      cacheKey,
      cacheTTL,
      timeoutMs,
      ...fetchOptions
    } = options;

    try {
      if (rateLimit) {
        const limiter = this.getRateLimiter(url);
        if (!limiter.canMakeRequest(rateLimit.maxRequests, rateLimit.window)) {
          const waitTime = limiter.getTimeUntilNextRequest(rateLimit.maxRequests, rateLimit.window);
          return { success: false, error: `Rate limited. Try again in ${Math.ceil(waitTime / 1000)} seconds.`, rateLimited: true };
        }
        limiter.recordRequest();
      }

      if (cacheKey) {
        const { aiCache } = await import('./cache');
        const cached = aiCache.get<string>(cacheKey);
        if (cached) {
          return { success: true, data: cached, cached: true };
        }
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs ?? this.defaultTimeout);
      const response = await fetch(url, { ...fetchOptions, signal: controller.signal });
      clearTimeout(timeoutId);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const text = await response.text();
      if (cacheKey && text) {
        const { aiCache } = await import('./cache');
        aiCache.set(cacheKey, text, cacheTTL);
      }
      return { success: true, data: text };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error occurred' };
    }
  }

  private getRateLimiter(url: string): APIRateLimiter {
    const key = new URL(url).hostname;

    if (!this.rateLimiters.has(key)) {
      this.rateLimiters.set(key, new APIRateLimiter());
    }

    return this.rateLimiters.get(key)!;
  }

  // Batch API requests
  async fetchBatch<T>(
    requests: Array<{
      url: string;
      options?: Omit<Parameters<typeof this.fetch>[1], 'cacheKey'>;
      cacheKey?: string;
    }>
  ): Promise<APIResponse<T>[]> {
    const promises = requests.map(async (req) => {
      return this.fetch<T>(req.url, {
        ...req.options,
        cacheKey: req.cacheKey
      });
    });

    return Promise.all(promises);
  }

  // Retry failed requests
  async fetchWithRetry<T>(
    url: string,
    options: Parameters<typeof this.fetch>[1] & {
      maxRetries?: number;
      retryDelay?: number;
    } = {}
  ): Promise<APIResponse<T>> {
    const {
      maxRetries = 3,
      retryDelay = 1000,
      ...fetchOptions
    } = options;

    let lastError: APIResponse<T>;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const result = await this.fetch<T>(url, fetchOptions);

      if (result.success) {
        return result;
      }

      lastError = result;

      // Don't retry on rate limiting or client errors (4xx)
      if (result.rateLimited || (result.error && result.error.includes('HTTP 4'))) {
        break;
      }

      // Wait before retry
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
      }
    }

    return lastError!;
  }
}

// Export singleton instance
export const apiClient = new APIClient();

// Common API configurations
export const API_CONFIG = {
  ETHERSCAN: {
    baseURL: 'https://api.etherscan.io/api',
    rateLimit: { maxRequests: 5, window: 1000 }, // 5 requests per second
    timeout: 10000
  },
  COINGECKO: {
    baseURL: 'https://api.coingecko.com/api/v3',
    rateLimit: { maxRequests: 10, window: 60000 }, // 10 requests per minute
    timeout: 15000
  },
  NEWS_API: {
    baseURL: 'https://newsapi.org/v2',
    rateLimit: { maxRequests: 100, window: 3600000 }, // 100 requests per hour
    timeout: 20000
  }
};

// Specific API wrappers
export class EtherscanAPI {
  private apiKey = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY;
  private baseURL = API_CONFIG.ETHERSCAN.baseURL;

  async getTokenBalance(contractAddress: string, walletAddress: string) {
    const url = `${this.baseURL}?module=account&action=tokenbalance&contractaddress=${contractAddress}&address=${walletAddress}&tag=latest&apikey=${this.apiKey}`;

    return apiClient.fetchWithRetry(url, {
      rateLimit: API_CONFIG.ETHERSCAN.rateLimit,
      cacheKey: `etherscan:balance:${contractAddress}:${walletAddress}`,
      cacheTTL: 30000 // 30 seconds
    });
  }

  async getTransactions(walletAddress: string) {
    const url = `${this.baseURL}?module=account&action=txlist&address=${walletAddress}&sort=desc&apikey=${this.apiKey}`;

    return apiClient.fetchWithRetry(url, {
      rateLimit: API_CONFIG.ETHERSCAN.rateLimit,
      cacheKey: `etherscan:txs:${walletAddress}`,
      cacheTTL: 60000 // 1 minute
    });
  }
}

export class CoinGeckoAPI {
  private baseURL = API_CONFIG.COINGECKO.baseURL;

  async getTokenPrice(contractAddress: string) {
    const url = `${this.baseURL}/simple/token_price/ethereum?contract_addresses=${contractAddress}&vs_currencies=usd&include_24hr_change=true`;

    return apiClient.fetchWithRetry(url, {
      rateLimit: API_CONFIG.COINGECKO.rateLimit,
      cacheKey: `coingecko:price:${contractAddress}`,
      cacheTTL: 60000 // 1 minute
    });
  }

  async getMarketData() {
    const url = `${this.baseURL}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false`;

    return apiClient.fetchWithRetry(url, {
      rateLimit: API_CONFIG.COINGECKO.rateLimit,
      cacheKey: 'coingecko:market',
      cacheTTL: 300000 // 5 minutes
    });
  }
}

export class NewsAPI {
  private get apiKey() {
    // Try multiple environment variable names
    return process.env.NEXT_PUBLIC_NEWS_API_KEY ||
           process.env.NEWSAPI_KEY ||
           process.env.REACT_APP_NEWS_API_KEY;
  }
  private baseURL = API_CONFIG.NEWS_API.baseURL;

  async getCryptoNews() {
    if (!this.apiKey) {
      console.warn('⚠️ No NewsAPI key found in environment variables');
      return {
        success: false,
        error: 'NewsAPI key not configured'
      };
    }

    const url = `${this.baseURL}/everything?q=(cryptocurrency OR bitcoin OR ethereum OR blockchain OR "federal reserve" OR "sec" OR etf OR trading OR inflation OR "interest rates")&sortBy=publishedAt&language=en&apiKey=${this.apiKey}&pageSize=50`;

    console.log('📰 Fetching from NewsAPI with key:', this.apiKey.substring(0, 10) + '...');

    return apiClient.fetchWithRetry(url, {
      rateLimit: API_CONFIG.NEWS_API.rateLimit,
      cacheKey: 'news:crypto',
      cacheTTL: 600000 // 10 minutes
    });
  }
}


// Export instances
export const etherscanAPI = new EtherscanAPI();
export const coinGeckoAPI = new CoinGeckoAPI();
export const newsAPI = new NewsAPI();
