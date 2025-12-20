/**
 * Dexscreener Provider
 * Provides token pricing and liquidity data from DEX pools
 */

export interface DexPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative: string;
  priceUsd: string;
  txns: {
    m5: { buys: number; sells: number };
    h1: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
  volume: {
    h24: number;
    h6: number;
    h1: number;
    m5: number;
  };
  priceChange: {
    m5: number;
    h1: number;
    h24: number;
  };
  liquidity: {
    usd: number;
    base: number;
    quote: number;
  };
  pairCreatedAt: number;
  fdv?: number;
  marketCap?: number;
}

export interface DexResponse {
  schemaVersion: string;
  pairs: DexPair[];
}

export interface TokenPriceInfo {
  symbol: string;
  address: string;
  price: number;
  priceNative: number;
  volume24h: number;
  change24h: number;
  change1h: number;
  liquidityUsd: number;
  liquidityBase: number;
  liquidityQuote: number;
  pairAge: number; // in days
  pairAddress: string;
  dexName: string;
  chainId: string;
  source: 'dexscreener';
  confidence: number;
  isLocked?: boolean;
  lockSchedule?: string;
}

export interface DexCacheEntry {
  priceInfo: TokenPriceInfo;
  timestamp: number;
  expiresAt: number;
}

export interface DexPairInfo {
  usd: number;
  liquidityUSD: number;
  source: string;
  confidence: number;
}

class DexscreenerProvider {
  private readonly BASE_URL = 'https://api.dexscreener.com/latest/dex';
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes for DEX data
  private cache = new Map<string, DexCacheEntry>();
  private readonly MAX_REQUESTS_PER_MINUTE = 30;
  private requestCount = 0;
  private lastRequestReset = Date.now();
  private blockedUntil = 0;
  private consecutiveZeroBatches = 0;

  /**
   * Check rate limits and wait if necessary
   */
  private async checkRateLimit(): Promise<boolean> {
    const now = Date.now();
    if (now - this.lastRequestReset > 60000) {
      this.requestCount = 0;
      this.lastRequestReset = now;
    }
    if (this.requestCount >= this.MAX_REQUESTS_PER_MINUTE - 2) {
      return false;
    }
    return true;
  }

  isBlocked(): boolean {
    return Date.now() < this.blockedUntil;
  }

  /**
   * Get cached price info or return null if expired/not found
   */
  private getCachedPrice(address: string): TokenPriceInfo | null {
    if (!address) {
      console.warn('⚠️ Dexscreener: getCachedPrice called with undefined address');
      return null;
    }

    const entry = this.cache.get(address.toLowerCase());

    if (!entry || Date.now() > entry.expiresAt) {
      return null;
    }

    return entry.priceInfo;
  }

  /**
   * Cache price info with timestamp
   */
  private setCachedPrice(address: string, priceInfo: TokenPriceInfo): void {
    const cacheKey = address.toLowerCase();
    this.cache.set(cacheKey, {
      priceInfo,
      timestamp: Date.now(),
      expiresAt: Date.now() + this.CACHE_DURATION
    });
  }

  /**
   * Find the best pair with highest liquidity for a token
   */
  private findBestPair(pairs: DexPair[], tokenAddress: string): DexPair | null {
    // Filter pairs that include our token
    const validPairs = pairs.filter(pair =>
      pair.baseToken.address.toLowerCase() === tokenAddress.toLowerCase() ||
      pair.quoteToken.address.toLowerCase() === tokenAddress.toLowerCase()
    );

    if (validPairs.length === 0) {
      return null;
    }

    const basePairs = validPairs.filter(p => p.baseToken.address.toLowerCase() === tokenAddress.toLowerCase());
    const candidates = basePairs.length > 0 ? basePairs : validPairs;
    candidates.sort((a, b) => {
      const aLiquidity = a.liquidity?.usd || 0;
      const bLiquidity = b.liquidity?.usd || 0;
      return bLiquidity - aLiquidity;
    });

    return candidates[0];
  }

  /**
   * Calculate confidence based on liquidity and other factors
   */
  private calculateConfidence(pair: DexPair): number {
    let confidence = 0.5; // Base confidence

    const liquidity = pair.liquidity.usd;
    const volume24h = pair.volume.h24;
    const pairAge = Date.now() - pair.pairCreatedAt;

    // Liquidity confidence (higher liquidity = higher confidence)
    if (liquidity > 1000000) confidence += 0.3; // $1M+
    else if (liquidity > 100000) confidence += 0.2; // $100K+
    else if (liquidity > 10000) confidence += 0.1; // $10K+

    // Volume confidence
    if (volume24h > liquidity * 0.5) confidence += 0.1;

    // Age confidence (older pairs are more reliable)
    const pairAgeDays = pairAge / (1000 * 60 * 60 * 24);
    if (pairAgeDays > 30) confidence += 0.1;
    else if (pairAgeDays > 7) confidence += 0.05;

    // Prefer pairs with established quote tokens (WETH, USDC, USDT)
    const establishedQuoteTokens = ['WETH', 'USDC', 'USDT', 'DAI', 'WBTC', 'BUSD'];
    if (establishedQuoteTokens.includes(pair.quoteToken.symbol) ||
        establishedQuoteTokens.includes(pair.baseToken.symbol)) {
      confidence += 0.1;
    }

    return Math.min(1.0, confidence);
  }

  /**
   * Normalize pair data to our TokenPriceInfo format
   */
  private normalizePairData(pair: DexPair, tokenAddress: string): TokenPriceInfo {
    const isBaseToken = pair.baseToken.address.toLowerCase() === tokenAddress.toLowerCase();
    const token = isBaseToken ? pair.baseToken : pair.quoteToken;

    const price = parseFloat(pair.priceUsd);
    const priceNative = parseFloat(pair.priceNative);
    const pairAge = (Date.now() - pair.pairCreatedAt) / (1000 * 60 * 60 * 24); // days

    return {
      symbol: token.symbol,
      address: token.address,
      price,
      priceNative,
      volume24h: pair.volume.h24,
      change24h: pair.priceChange.h24,
      change1h: pair.priceChange.h1,
      liquidityUsd: pair.liquidity.usd,
      liquidityBase: pair.liquidity.base,
      liquidityQuote: pair.liquidity.quote,
      pairAge,
      pairAddress: pair.pairAddress,
      dexName: pair.dexId,
      chainId: pair.chainId,
      source: 'dexscreener' as const,
      confidence: this.calculateConfidence(pair)
    };
  }

  /**
   * Get token pairs and price for a specific token address
   */
  async getTokenPairs(address: string): Promise<TokenPriceInfo | null> {
    if (this.isBlocked()) {
      return null;
    }
    // If running in the browser, use the server proxy to avoid CORS/HTML errors
    if (typeof window !== 'undefined') {
      try {
        const origin = window.location.origin
        const res = await fetch(`${origin}/api/price-proxy?type=token&addresses=${address}`, {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(7000)
        })
        if (!res.ok) return null
        const data = await res.json()
        const entry = data[address.toLowerCase()]
        const usd = entry?.usd || 0
        if (typeof usd === 'number' && usd > 0) {
          const info: TokenPriceInfo = {
            symbol: entry.symbol || '',
            address: address.toLowerCase(),
            price: usd,
            priceNative: 0,
            volume24h: 0,
            change24h: 0,
            change1h: 0,
            liquidityUsd: 0,
            liquidityBase: 0,
            liquidityQuote: 0,
            pairAge: 0,
            pairAddress: address,
            dexName: 'dexscreener',
            chainId: 'ethereum',
            source: 'dexscreener',
            confidence: entry.confidence || 0.6
          }
          this.setCachedPrice(address, info)
          return info
        }
        return null
      } catch {
        return null
      }
    }
    const ok = await this.checkRateLimit();
    if (!ok) {
      return null;
    }
    this.requestCount++;

    // Check cache first
    const cached = this.getCachedPrice(address);
    if (cached) {
      console.log(`📦 Dexscreener Cache hit for ${address.slice(0, 8)}...`);
      return cached;
    }

    console.log(`🔍 Fetching Dexscreener data for ${address.slice(0, 8)}...`);

    try {
      const response = await fetch(
        `${this.BASE_URL}/search?q=${address}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'EtherView/1.0'
          },
          signal: AbortSignal.timeout(10000) // 10 second timeout
        }
      );

      if (!response.ok) {
        if (response.status === 429) {
          return null;
        }
        return null;
      }

      const data: DexResponse = await response.json();

      if (!data.pairs || data.pairs.length === 0) {
        console.log(`ℹ️ No pairs found for token ${address.slice(0, 8)}...`);
        return null;
      }

      const bestPair = this.findBestPair(data.pairs, address);
      if (!bestPair) {
        console.log(`ℹ️ No valid pairs found for token ${address.slice(0, 8)}...`);
        return null;
      }

      const priceInfo = this.normalizePairData(bestPair, address);

      // Cache the result
      this.setCachedPrice(address, priceInfo);

      console.log(`✅ Dexscreener found pair: ${priceInfo.symbol} on ${priceInfo.dexName} with $${priceInfo.liquidityUsd.toFixed(2)} liquidity`);

      return priceInfo;

    } catch {
      return null;
    }
  }

  /**
   * Get multiple token prices in batch
   */
  async getBatchTokenPrices(addresses: string[]): Promise<Map<string, TokenPriceInfo>> {
    const results = new Map<string, TokenPriceInfo>();
    const batchSize = 20; // Process in batches to avoid overwhelming the API

    for (let i = 0; i < addresses.length; i += batchSize) {
      if (this.isBlocked()) {
        break;
      }
      const batch = addresses.slice(i, i + batchSize);
      console.log(`🔄 Processing Dexscreener batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(addresses.length/batchSize)}`);

      // Process batch concurrently with rate limiting
      const promises = batch.map(async (address) => {
        const priceInfo = await this.getTokenPairs(address);
        return { address, priceInfo };
      });

      const batchResults = await Promise.all(promises);
      let failCount = 0;

      batchResults.forEach(({ address, priceInfo }) => {
        if (priceInfo) {
          results.set(address, priceInfo);
        } else {
          failCount++;
        }
      });

      if (failCount === batch.length && batch.length >= 5) {
        this.consecutiveZeroBatches++;
      } else {
        this.consecutiveZeroBatches = 0;
      }

      if (this.consecutiveZeroBatches >= 6) {
        this.blockedUntil = Date.now() + 20_000;
        break;
      }

      // Add delay between batches to respect rate limits
      if (i + batchSize < addresses.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (failCount > 0) {
        console.log(`⚠️ Dexscreener partial batch: ${batch.length - failCount}/${batch.length} priced`);
      }
    }

    console.log(`✅ Dexscreener batch complete: ${results.size}/${addresses.length} tokens priced`);
    return results;
  }

  /**
   * Get liquidity information for a token (detailed)
   */
  async getLiquidityInfo(address: string): Promise<{
    liquidityUsd: number;
    liquidityBase: number;
    liquidityQuote: number;
    volume24h: number;
    pairAge: number;
    isLocked: boolean;
    lockSchedule?: string;
    confidence: number;
  } | null> {
    const priceInfo = await this.getTokenPairs(address);

    if (!priceInfo) {
      return null;
    }

    return {
      liquidityUsd: priceInfo.liquidityUsd,
      liquidityBase: priceInfo.liquidityBase,
      liquidityQuote: priceInfo.liquidityQuote,
      volume24h: priceInfo.volume24h,
      pairAge: priceInfo.pairAge,
      isLocked: false, // Would need additional API calls for lock verification
      confidence: priceInfo.confidence
    };
  }

  /**
   * Get provider statistics
   */
  getStats() {
    return {
      name: 'Dexscreener',
      cacheSize: this.cache.size,
      requestsThisMinute: this.requestCount,
      maxRequestsPerMinute: this.MAX_REQUESTS_PER_MINUTE,
      cacheDuration: this.CACHE_DURATION
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('🗑️ Dexscreener cache cleared');
  }

  /**
   * Check if a token has sufficient liquidity
   */
  hasSufficientLiquidity(address: string, minLiquidityUSD: number = 10000): boolean {
    const cached = this.getCachedPrice(address);
    if (!cached) {
      return false;
    }

    return cached.liquidityUsd >= minLiquidityUSD;
  }

  /**
   * Get the best trading pair for a token
   */
  async getBestPair(address: string): Promise<{
    pairAddress: string;
    dexName: string;
    chainId: string;
    liquidityUsd: number;
    confidence: number;
  } | null> {
    const priceInfo = await this.getTokenPairs(address);

    if (!priceInfo) {
      return null;
    }

    return {
      pairAddress: priceInfo.pairAddress,
      dexName: priceInfo.dexName,
      chainId: priceInfo.chainId,
      liquidityUsd: priceInfo.liquidityUsd,
      confidence: priceInfo.confidence
    };
  }
}

export const dexscreenerProvider = new DexscreenerProvider();

// Legacy exports for compatibility
import { fetchDexscreenerToken } from '@/lib/ai/shared/fetcher'

export async function getDexTokenQuote(address: string): Promise<DexPairInfo | null> {
  try {
    // Try new provider first
    const priceInfo = await dexscreenerProvider.getTokenPairs(address);
    if (priceInfo) {
      return {
        usd: priceInfo.price,
        liquidityUSD: priceInfo.liquidityUsd,
        source: priceInfo.source,
        confidence: priceInfo.confidence
      };
    }
  } catch (error) {
    console.error('❌ New Dexscreener provider failed, falling back to fetcher:', error);
  }

  // Fallback to legacy fetcher
  const info = await fetchDexscreenerToken(address);
  if (!info) return null;
  return {
    usd: info.usd,
    liquidityUSD: info.liquidityUSD,
    source: info.source,
    confidence: info.confidence
  };
}
