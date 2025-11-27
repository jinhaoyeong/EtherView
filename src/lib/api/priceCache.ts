/**
 * Smart Price Cache System for Transactions
 * Avoids repeated API calls by caching prices per session
 */

import { getDexTokenQuote } from '@/lib/providers/dexscreener'

export interface TokenPrice {
  symbol: string;
  address?: string;
  priceUSD: number;
  timestamp: number;
  source: string;
  confidence: number;
  lastUpdated: number;
  expiresAt: number;
}

export interface ProviderInfo {
  name: string;
  confidence: number;
  latency: number;
  success: boolean;
}

export class PriceCache {
  private static instance: PriceCache;
  private prices = new Map<string, TokenPrice>();
  private ethPrice: number | null = null;
  private sessionStartTime: number = Date.now();
  private providerStats = new Map<string, { successCount: number; errorCount: number; avgLatency: number }>();

  // Cache duration varies by source
  private readonly CACHE_DURATION = {
    'cmc': 10 * 60 * 1000,      // 10 minutes for CoinMarketCap
    'coingecko': 5 * 60 * 1000,  // 5 minutes for CoinGecko
    'dexscreener': 5 * 60 * 1000, // 5 minutes for Dexscreener (more volatile)
    'coinbase': 2 * 60 * 1000,   // 2 minutes for Coinbase
    'cryptocompare': 2 * 60 * 1000, // 2 minutes for CryptoCompare
    'fixed': 60 * 60 * 1000       // 1 hour for fixed prices (stablecoins)
  };

  private readonly SESSION_VALID_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  private constructor() {}

  static getInstance(): PriceCache {
    if (!PriceCache.instance) {
      PriceCache.instance = new PriceCache();
    }
    return PriceCache.instance;
  }

  /**
   * Fetch and cache ETH price (only once per session) using proxy API
   */
  async fetchETHPrice(): Promise<number> {
    if (this.ethPrice !== null) {
      console.log('💰 PRICE CACHE: Using cached ETH price:', this.ethPrice);
      return this.ethPrice;
    }

    console.log('💰 PRICE CACHE: Fetching fresh ETH price...');
    try {
      // Use absolute URL for server-side fetch
      const origin = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXTAUTH_URL || `http://localhost:${process.env.PORT || 3000}`);

      const response = await fetch(`${origin}/api/price-proxy?type=eth&ids=ethereum`, {
        headers: {
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        console.warn('Price proxy API responded with status:', response.status);
        // Try alternate providers before final fallback
        const alt = await this.fetchETHPriceAlternate();
        if (alt > 0) {
          this.ethPrice = alt;
          return alt;
        }
        const fallbackPrice = 3000;
        this.ethPrice = fallbackPrice;
        return fallbackPrice;
      }

      const data = await response.json();
      const price = data.ethereum?.usd;

      if (!price || typeof price !== 'number' || price <= 0) {
        console.warn('Invalid price data from proxy:', data);
        const fallbackPrice = 3000;
        this.ethPrice = fallbackPrice;
        return fallbackPrice;
      }

      this.ethPrice = price;
      console.log('💰 PRICE CACHE: Cached new ETH price:', price);
      return price;
    } catch (error) {
      console.warn('ETH price fetch failed, trying alternate:', error instanceof Error ? error.message : 'Unknown error');

      // Final fallback after alternates
      const alt = await this.fetchETHPriceAlternate();
      if (alt > 0) {
        this.ethPrice = alt;
        return alt;
      }
      const fallbackPrice = 3000;
      this.ethPrice = fallbackPrice;
      return fallbackPrice;
    }
  }

  private async fetchETHPriceAlternate(): Promise<number> {
    try {
      const cb = await fetch('https://api.coinbase.com/v2/prices/ETH-USD/spot', {
        headers: { 'Accept': 'application/json', 'User-Agent': 'EtherView/1.0' },
        signal: AbortSignal.timeout(2500)
      });
      if (cb.ok) {
        const data = await cb.json();
        const amount = parseFloat(data?.data?.amount);
        if (!isNaN(amount) && amount > 0) return amount;
      }
    } catch {}
    try {
      const cc = await fetch('https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD', {
        headers: { 'Accept': 'application/json', 'User-Agent': 'EtherView/1.0' },
        signal: AbortSignal.timeout(2500)
      });
      if (cc.ok) {
        const data = await cc.json();
        const usd = data?.USD;
        if (typeof usd === 'number' && usd > 0) return usd;
      }
    } catch {}
    return 0;
  }

  /**
   * Update provider statistics for performance tracking
   */
  private updateProviderStats(provider: string, success: boolean, latency: number): void {
    const current = this.providerStats.get(provider) || { successCount: 0, errorCount: 0, avgLatency: 0 };

    if (success) {
      current.successCount++;
      // Update rolling average latency
      current.avgLatency = (current.avgLatency * (current.successCount - 1) + latency) / current.successCount;
    } else {
      current.errorCount++;
    }

    this.providerStats.set(provider, current);
  }

  /**
   * Get best provider based on recent performance
   */
  private getBestProvider(): string {
    const providers = Array.from(this.providerStats.entries());
    if (providers.length === 0) return 'proxy'; // default

    // Score based on success rate and latency
    const scored = providers.map(([name, stats]) => {
      const totalRequests = stats.successCount + stats.errorCount;
      const successRate = totalRequests > 0 ? stats.successCount / totalRequests : 0.5;
      const latencyScore = Math.max(0, 1 - (stats.avgLatency / 2000)); // lower latency = higher score
      const score = (successRate * 0.7) + (latencyScore * 0.3);
      return { name, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.name || 'proxy';
  }

  /**
   * Check if cached price is still valid based on source and time
   */
  private isPriceValid(cached: TokenPrice): boolean {
    const now = Date.now();
    const cacheDuration = this.CACHE_DURATION[cached.source as keyof typeof this.CACHE_DURATION] || 5 * 60 * 1000;
    return now < cached.expiresAt;
  }

  /**
   * Cache a token price with proper expiration
   */
  private cacheTokenPrice(symbol: string, address: string | undefined, price: number, source: string, confidence: number): void {
    const cacheKey = address ? `${address.toLowerCase()}` : symbol.toLowerCase();
    const now = Date.now();
    const cacheDuration = this.CACHE_DURATION[source as keyof typeof this.CACHE_DURATION] || 5 * 60 * 1000;

    const tokenPrice: TokenPrice = {
      symbol,
      address,
      priceUSD: price,
      timestamp: now,
      source,
      confidence,
      lastUpdated: now,
      expiresAt: now + cacheDuration
    };

    this.prices.set(cacheKey, tokenPrice);
    console.log(`💰 PRICE CACHE: Cached new price for ${symbol} via ${source} (${confidence.toFixed(2)} confidence): $${price}`);
  }

  /**
   * Fetch and cache token price with enhanced provider rotation and confidence tracking
   */
  async fetchTokenPrice(symbol: string, address?: string): Promise<number> {
    const cacheKey = address ? `${address.toLowerCase()}` : symbol.toLowerCase();

    // Check cache first with validity check
    const cached = this.prices.get(cacheKey);
    if (cached && this.isPriceValid(cached)) {
      console.log(`💰 PRICE CACHE: Using cached price for ${symbol} (${cached.source}, ${cached.confidence.toFixed(2)} confidence): $${cached.priceUSD}`);
      return cached.priceUSD;
    }

    console.log(`💰 PRICE CACHE: Fetching fresh price for ${symbol}...`);
    const startTime = Date.now();

    try {
      // Try proxy API first (which includes provider rotation)
      const origin = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXTAUTH_URL || `http://localhost:${process.env.PORT || 3000}`);
      let apiUrl = '';

      if (address) {
        apiUrl = `${origin}/api/price-proxy?type=token&addresses=${address}`;
      } else {
        // Try whitelist first for symbols, then fall back to general
        apiUrl = `${origin}/api/price-proxy?type=whitelist&symbols=${symbol.toUpperCase()}`;
      }

      const response = await fetch(apiUrl, {
        headers: {
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(8000) // Increased timeout for better provider rotation
      });

      const latency = Date.now() - startTime;
      const success = response.ok;

      if (!response.ok) {
        this.updateProviderStats('proxy', false, latency);
        console.warn(`Price proxy API responded with status for ${symbol}:`, response.status);

        // Try dexscreener-based fallback via server for address pricing
        if (address) {
          try {
            const dq = await getDexTokenQuote(address);
            const price = dq?.usd || 0;
            if (price > 0) {
              this.cacheTokenPrice(symbol, address, price, dq?.source || 'dexscreener', dq?.confidence || 0.6);
              this.updateProviderStats('dexscreener', true, latency);
              return price;
            }
          } catch {}
        }
        return 0;
      }

      const ct = response.headers.get('content-type') || ''
      if (!ct.includes('application/json')) {
        this.updateProviderStats('proxy', false, latency);
        // Avoid direct external calls from browser; use dexscreener provider via server
        if (address) {
          try {
            const dq = await getDexTokenQuote(address);
            const price = dq?.usd || 0;
            if (price > 0) {
              this.cacheTokenPrice(symbol, address, price, dq?.source || 'dexscreener', dq?.confidence || 0.6);
              this.updateProviderStats('dexscreener', true, latency);
              return price;
            }
          } catch {}
        }
        return 0;
      }
      const data = await response.json();
      let price = 0;
      let source = 'proxy';
      let confidence = 0.5; // Default confidence

      if (address) {
        // Token price response format: {"0x...": {"usd": 123.45, "source": "coingecko", "confidence": 0.8}}
        const entry = data[address.toLowerCase()]
        price = entry?.usd || 0;
        source = entry?.source || 'proxy';
        confidence = typeof entry?.confidence === 'number' ? entry.confidence : 0.7;
      } else {
        // Whitelist response format: {"ETH": {"usd": 3000, "source": "cmc", "confidence": 0.95}}
        const entry = data[symbol.toUpperCase()]
        price = entry?.usd || 0;
        source = entry?.source || 'proxy';
        confidence = typeof entry?.confidence === 'number' ? entry.confidence : 0.8;
      }

      if (price <= 0) {
        console.warn(`Invalid or zero price for ${symbol}:`, data);
        this.updateProviderStats('proxy', false, latency);

        // Try dexscreener-based fallback via server
        if (address) {
          try {
            const dq = await getDexTokenQuote(address);
            const p = dq?.usd || 0;
            if (p > 0) {
              this.cacheTokenPrice(symbol, address, p, dq?.source || 'dexscreener', dq?.confidence || 0.6);
              this.updateProviderStats('dexscreener', true, latency);
              return p;
            }
          } catch {}
        }
        return 0;
      }

      // Cache the price with enhanced metadata
      this.cacheTokenPrice(symbol, address, price, source, confidence);
      this.updateProviderStats(source, true, latency);

      return price;
    } catch (error) {
      const latency = Date.now() - startTime;
      console.warn(`Failed to fetch price for ${symbol}, using server-side fallback:`, error instanceof Error ? error.message : 'Unknown error');

      // Avoid direct external calls from browser; use dexscreener-based fallback via server
      if (address) {
        try {
          const dq = await getDexTokenQuote(address);
          const price = dq?.usd || 0;
          if (price > 0) {
            this.cacheTokenPrice(symbol, address, price, dq?.source || 'dexscreener', dq?.confidence || 0.6);
            this.updateProviderStats('dexscreener', true, latency);
            return price;
          }
        } catch {}
      }
      return 0;
    }
  }

  /**
   * Fallback method to fetch token price directly from CoinGecko with enhanced fallbacks
   */
  private async fetchTokenPriceDirect(symbol: string, address?: string): Promise<number> {
    const origin = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXTAUTH_URL || `http://localhost:${process.env.PORT || 3000}`);

    // Only use server-side endpoints; avoid direct external calls in browser
    try {
      if (address) {
        const res = await fetch(`${origin}/api/price-proxy?type=token&addresses=${address}`, { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(4000) })
        if (res.ok) {
          const ct = res.headers.get('content-type') || ''
          if (!ct.includes('application/json')) {
            return 0
          }
          const data = await res.json()
          const entry = data[address.toLowerCase()]
          const price = entry?.usd || 0
          if (typeof price === 'number' && price > 0) {
            return price
          }
        }
        // Dexscreener fallback via provider (server calls inside)
        const dq = await getDexTokenQuote(address)
        const price = dq?.usd || 0
        if (price > 0) {
          this.cacheTokenPrice(symbol, address, price, dq?.source || 'dexscreener', dq?.confidence || 0.6)
          return price
        }
      } else {
        const res = await fetch(`${origin}/api/price-proxy?type=whitelist&symbols=${symbol.toUpperCase()}`, { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(4000) })
        if (res.ok) {
          const ct = res.headers.get('content-type') || ''
          if (!ct.includes('application/json')) {
            return 0
          }
          const data = await res.json()
          const entry = data[symbol.toUpperCase()]
          const price = entry?.usd || 0
          if (typeof price === 'number' && price > 0) {
            return price
          }
        }
      }
    } catch (error) {
      console.log(`Proxy/Dex fallback failed for ${symbol}:`, error instanceof Error ? error.message : 'Unknown error')
    }

    return 0;
  }

  async fetchTokenPricesByAddress(addresses: string[]): Promise<Record<string, number>> {
    const normalized = Array.from(new Set(addresses.filter(Boolean).map(a => a.toLowerCase())));
    const result: Record<string, number> = {};
    const missing: string[] = [];

    // Check cache first
    for (const addr of normalized) {
      const cached = this.prices.get(addr);
      if (cached) {
        result[addr] = cached.priceUSD;
      } else {
        missing.push(addr);
      }
    }

    if (missing.length === 0) return result;

    // Process in smaller batches with rate limiting and time budget
    const chunks: string[][] = [];
    const batchSize = 20;
    for (let i = 0; i < missing.length; i += batchSize) {
      chunks.push(missing.slice(i, i + batchSize));
    }

    const start = Date.now();
    const BUDGET_MS = 8000;
    for (const chunk of chunks) {
      try {
        const origin = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXTAUTH_URL || `http://localhost:${process.env.PORT || 3000}`);
        const res = await fetch(`${origin}/api/price-proxy?type=token&addresses=${chunk.join(',')}`, { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(5000) })
        if (res.ok) {
          const data = await res.json()
          for (const addr of chunk) {
            const entry = data[addr.toLowerCase()]
            const p = entry && typeof entry.usd === 'number' ? entry.usd : 0
            if (p > 0) {
              const now = Date.now()
              const src = entry.source || 'proxy'
              const ttl = this.CACHE_DURATION[src as keyof typeof this.CACHE_DURATION] || 5 * 60 * 1000
              this.prices.set(
                addr.toLowerCase(),
                {
                  symbol: '',
                  address: addr.toLowerCase(),
                  priceUSD: p,
                  timestamp: Date.now(),
                  source: src,
                  confidence: typeof entry?.confidence === 'number' ? entry.confidence : 0.5,
                  lastUpdated: now,
                  expiresAt: now + ttl,
                }
              )
              result[addr.toLowerCase()] = p
            } else {
              result[addr.toLowerCase()] = 0
            }
          }
        }
      } catch {}
      if (chunks.indexOf(chunk) < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      if (Date.now() - start > BUDGET_MS) {
        break;
      }
    }
    
    return result;
  }

  getLastSource(symbol: string, address?: string): string | null {
    const key = address ? address.toLowerCase() : symbol.toLowerCase();
    const p = this.prices.get(key);
    return p?.source || null;
  }

  /**
   * Get cached ETH price without fetching
   */
  getCachedETHPrice(): number | null {
    return this.ethPrice;
  }

  /**
   * Get cached token price without fetching
   */
  getCachedTokenPrice(symbol: string, address?: string): number | null {
    const cacheKey = address ? `${address.toLowerCase()}` : symbol.toLowerCase();
    const cached = this.prices.get(cacheKey);
    return cached?.priceUSD || null;
  }

  /**
   * Check if a token price is cached
   */
  hasTokenPrice(symbol: string, address?: string): boolean {
    const cacheKey = address ? `${address.toLowerCase()}` : symbol.toLowerCase();
    return this.prices.has(cacheKey);
  }

  /**
   * Clear all cached prices (for manual refresh)
   */
  clearCache(): void {
    console.log('💰 PRICE CACHE: Clearing all cached prices...');
    this.prices.clear();
    this.ethPrice = null;
    this.sessionStartTime = Date.now();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const now = Date.now();
    const validPrices = Array.from(this.prices.values()).filter(p => this.isPriceValid(p));

    return {
      ethPriceCached: this.ethPrice !== null,
      tokenPricesCount: this.prices.size,
      validPricesCount: validPrices.length,
      sessionDuration: Date.now() - this.sessionStartTime,
      cachedTokens: validPrices.map(p => ({
        symbol: p.symbol,
        source: p.source,
        confidence: p.confidence,
        price: p.priceUSD
      })),
      providerStats: Object.fromEntries(this.providerStats),
      bestProvider: this.getBestProvider()
    };
  }

  /**
   * Get detailed price information including source and confidence
   */
  getPriceInfo(symbol: string, address?: string): TokenPrice | null {
    const cacheKey = address ? `${address.toLowerCase()}` : symbol.toLowerCase();
    const cached = this.prices.get(cacheKey);

    if (!cached || !this.isPriceValid(cached)) {
      return null;
    }

    return cached;
  }

  /**
   * Batch fetch multiple token prices with improved concurrency
   */
  async fetchMultiplePrices(requests: Array<{ symbol: string; address?: string }>): Promise<Array<{ symbol: string; address?: string; price: number; source: string; confidence: number }>> {
    const results: Array<{ symbol: string; address?: string; price: number; source: string; confidence: number }> = [];

    // Check cache first for all requests
    const uncached: Array<{ symbol: string; address?: string; index: number }> = [];

    requests.forEach((req, index) => {
      const priceInfo = this.getPriceInfo(req.symbol, req.address);
      if (priceInfo) {
        results[index] = {
          symbol: req.symbol,
          address: req.address,
          price: priceInfo.priceUSD,
          source: priceInfo.source,
          confidence: priceInfo.confidence
        };
      } else {
        uncached.push({ ...req, index });
      }
    });

    if (uncached.length === 0) {
      return results;
    }

    // Group by address-based vs symbol-based requests
    const addressRequests = uncached.filter(r => r.address);
    const symbolRequests = uncached.filter(r => !r.address);

    // Fetch address-based requests in batches
    if (addressRequests.length > 0) {
      const addresses = addressRequests.map(r => r.address!);
      const addressPrices = await this.fetchTokenPricesByAddress(addresses);

      addressRequests.forEach(req => {
        const price = addressPrices[req.address!.toLowerCase()] || 0;
        if (price > 0) {
          const priceInfo = this.getPriceInfo(req.symbol, req.address);
          results[req.index] = {
            symbol: req.symbol,
            address: req.address,
            price,
            source: priceInfo?.source || 'unknown',
            confidence: priceInfo?.confidence || 0.5
          };
        }
      });
    }

    // Fetch symbol-based requests individually
    for (const req of symbolRequests) {
      try {
        const price = await this.fetchTokenPrice(req.symbol);
        if (price > 0) {
          const priceInfo = this.getPriceInfo(req.symbol);
          results[req.index] = {
            symbol: req.symbol,
            address: req.address,
            price,
            source: priceInfo?.source || 'unknown',
            confidence: priceInfo?.confidence || 0.5
          };
        }
      } catch (error) {
        console.error(`Failed to fetch price for ${req.symbol}:`, error);
      }
    }

    return results;
  }

  /**
   * Clean up expired cache entries
   */
  cleanupExpiredEntries(): void {
    const now = Date.now();
    let removedCount = 0;

    for (const [key, entry] of this.prices.entries()) {
      if (now >= entry.expiresAt) {
        this.prices.delete(key);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      console.log(`💰 PRICE CACHE: Cleaned up ${removedCount} expired cache entries`);
    }
  }

  /**
   * Force refresh of specific tokens
   */
  async forceRefreshTokens(tokens: Array<{ symbol: string; address?: string }>): Promise<void> {
    console.log(`💰 PRICE CACHE: Force refreshing ${tokens.length} tokens...`);

    // Clear existing cache entries
    tokens.forEach(({ symbol, address }) => {
      const cacheKey = address ? `${address.toLowerCase()}` : symbol.toLowerCase();
      this.prices.delete(cacheKey);
    });

    // Fetch fresh prices
    await this.fetchMultiplePrices(tokens);
  }

  /**
   * Helper to get CoinGecko ID for common tokens
   */
  private getCoinGeckoId(symbol: string): string {
    const symbolMap: Record<string, string> = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'USDT': 'tether',
      'USDC': 'usd-coin',
      'BNB': 'binancecoin',
      'SOL': 'solana',
      'ADA': 'cardano',
      'DOT': 'polkadot',
      'MATIC': 'matic-network',
      'LINK': 'chainlink',
      'UNI': 'uniswap',
      'AAVE': 'aave',
      'SHIB': 'shiba-inu',
      'AVAX': 'avalanche-2',
      'CRO': 'crypto-com-chain',
      'LTC': 'litecoin',
      'BCH': 'bitcoin-cash',
      'XLM': 'stellar',
      'XRP': 'ripple'
    };

    return symbolMap[symbol.toUpperCase()] || symbol.toLowerCase();
  }

  getEntry(symbol: string, address?: string): TokenPrice | undefined {
    const key = address ? address.toLowerCase() : symbol.toLowerCase()
    return this.prices.get(key)
  }
}

// Export singleton instance
export const priceCache = PriceCache.getInstance();
