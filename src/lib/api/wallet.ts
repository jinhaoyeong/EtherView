import { priceCache } from './priceCache';
import { isWhitelisted, getWhitelistMeta } from '../config/tokenWhitelist';
type EnhancedToken = { symbol: string; decimals: number; address?: string };
type CacheManager = { get: (key: string) => any; set: (key: string, value: any) => void };

export const ETHEREUM_TOKEN_WHITELIST: Record<string, { symbol: string; name: string; decimals: number }> = {
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': { symbol: 'WETH', name: 'Wrapped Ether', decimals: 18 },
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': { symbol: 'USDC', name: 'USD Coin', decimals: 6 },
  '0xdac17f958d2ee523a2206206994597c13d831ec7': { symbol: 'USDT', name: 'Tether USD', decimals: 6 },
  '0x6b175474e89094c44da98b954eedeac495271d0f': { symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18 },
  '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': { symbol: 'WBTC', name: 'Wrapped BTC', decimals: 8 },
  '0x514910771af9ca656af840dff83e8264ecf986ca': { symbol: 'LINK', name: 'Chainlink', decimals: 18 },
  '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984': { symbol: 'UNI', name: 'Uniswap', decimals: 18 },
  '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9': { symbol: 'AAVE', name: 'Aave', decimals: 18 },
  '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2': { symbol: 'MKR', name: 'Maker', decimals: 18 },
  '0xc00e94cb662c3520282e6f5717214004a7f26888': { symbol: 'COMP', name: 'Compound', decimals: 18 },
  '0xd533a949740bb3306d119cc777fa900ba034cd52': { symbol: 'CRV', name: 'Curve DAO', decimals: 18 },
  '0x6b3595068778dd592e39a122f4f5a5cf09c90fe2': { symbol: 'SUSHI', name: 'Sushi', decimals: 18 },
  '0x5a98fcbea516cf06857215779fd812ca3bef1b32': { symbol: 'LDO', name: 'Lido DAO', decimals: 18 },
  '0xc011a73ee8576ffb0ed3d652a66c32b4ec4d8da8': { symbol: 'SNX', name: 'Synthetix', decimals: 18 },
  '0x111111111117dc0aa78b770fa6a738034120c302': { symbol: '1INCH', name: '1inch', decimals: 18 },
  '0xba100000625a3754423978a60c9317c58a424e3d': { symbol: 'BAL', name: 'Balancer', decimals: 18 },
  '0x0bc529c00c6401aef6d220be8c6ea1667f6ad93e': { symbol: 'YFI', name: 'yearn.finance', decimals: 18 },
  '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce': { symbol: 'SHIB', name: 'Shiba Inu', decimals: 18 },
  '0xbbbbca6a901c926f240b89eacb641d8aec7aeafd': { symbol: 'LRC', name: 'Loopring', decimals: 18 },
  '0x0d8775f648430675ee00d3d05e38bffb6992e7b': { symbol: 'BAT', name: 'Basic Attention Token', decimals: 18 },
  '0xe41d2489571d322189246dafa5ebde1f4699f498': { symbol: 'ZRX', name: '0x', decimals: 18 },
  '0x0f5d2fb29fb7d3cfee444a200298f468908cc942': { symbol: 'MANA', name: 'Decentraland', decimals: 18 },
  '0x3845badade8e6dff049820680d1f14bd3903a5d0': { symbol: 'SAND', name: 'The Sandbox', decimals: 18 },
  '0xc944e90c64b2c07662a292be6244bdf05cda44a7': { symbol: 'GRT', name: 'The Graph', decimals: 18 },
  '0xf629cbd94d3791c9250152bd8dfbdf380e2a3b9c': { symbol: 'ENJ', name: 'Enjin Coin', decimals: 18 },
  '0xbb0e17ef65f82ab018d8edd776e8dd940327b28b': { symbol: 'AXS', name: 'Axie Infinity', decimals: 18 },
  '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0': { symbol: 'MATIC', name: 'Polygon', decimals: 18 },
  '0x6982508145454ce325ddbe47a25d4ec3d2311933': { symbol: 'PEPE', name: 'Pepe', decimals: 18 }
  ,
  '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39': { symbol: 'HEX', name: 'HEX', decimals: 8 }
};

export class WalletAPI {
  // Cache storage for API responses
  private static cache = new Map<string, { data: any; expiry: number; cachedAt: number }>();
  private static portfolioTokenCache = new Map<string, { data: any[]; ts: number }>();
  private static inflightPortfolioTokenReq = new Map<string, Promise<any[]>>();

  // Helper function to build proxy URLs
  private static buildProxyUrl(params: Record<string, string>): string {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : WalletAPI.getBaseURL();
    const searchParams = new URLSearchParams(params);
    return `${baseUrl}/api/etherscan-proxy?${searchParams.toString()}`;
  }

  private static getBaseURL(): string {
    const candidates: (string | undefined)[] = [
      process.env.NEXT_PUBLIC_SITE_URL,
      process.env.SITE_URL,
      process.env.APP_URL,
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
      process.env.NEXTAUTH_URL,
      process.env.URL
    ];
    for (const u of candidates) {
      if (u && u.trim() !== '') return u;
    }
    return `http://localhost:${process.env.PORT || 3000}`;
  }

  static getCachedPortfolioTokens(address: string): any[] {
    const key = (address || '').toLowerCase();
    const entry = this.portfolioTokenCache.get(key);
    if (!entry) return [];
    return Array.isArray(entry.data) ? entry.data : [];
  }

  // 🛡️ ERROR MONITORING: Track API performance and errors
  private static errorStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    errorsBySource: {} as { [key: string]: number },
    averageResponseTime: 0,
    lastErrorTime: 0
  };

  // 🛡️ HEALTH CHECK: Monitor API health
  private static updateErrorStats(source: string, success: boolean, responseTime: number) {
    this.errorStats.totalRequests++;
    if (success) {
      this.errorStats.successfulRequests++;
    } else {
      this.errorStats.failedRequests++;
      this.errorStats.errorsBySource[source] = (this.errorStats.errorsBySource[source] || 0) + 1;
      this.errorStats.lastErrorTime = Date.now();
    }

    // Update average response time
    this.errorStats.averageResponseTime =
      (this.errorStats.averageResponseTime * (this.errorStats.totalRequests - 1) + responseTime) /
      this.errorStats.totalRequests;

    // Log concerning patterns
    const errorRate = this.errorStats.failedRequests / this.errorStats.totalRequests;
    if (errorRate > 0.1) { // More than 10% error rate
      console.warn(`🛡️ HIGH ERROR RATE DETECTED: ${(errorRate * 100).toFixed(1)}% - Last error from ${source}`);
    }
  }

  // 🛡️ HEALTH REPORT: Get current system health
  private static getHealthReport() {
    const successRate = this.errorStats.totalRequests > 0
      ? this.errorStats.successfulRequests / this.errorStats.totalRequests
      : 1;

    return {
      successRate: Math.round(successRate * 100),
      totalRequests: this.errorStats.totalRequests,
      averageResponseTime: Math.round(this.errorStats.averageResponseTime),
      errorsBySource: this.errorStats.errorsBySource,
      lastErrorTime: this.errorStats.lastErrorTime,
      status: successRate > 0.9 ? 'healthy' : successRate > 0.7 ? 'degraded' : 'unhealthy'
    };
  }

  // 🛡️ CIRCUIT BREAKER: Prevent cascading failures when APIs are consistently failing
  private static circuitBreaker = {
    failures: 0,
    lastFailureTime: 0,
    isOpen: false,
    threshold: 5, // Open circuit after 5 consecutive failures
    timeout: 60000, // Try again after 1 minute

    shouldSkip(): boolean {
      const now = Date.now();

      // Reset circuit breaker if timeout has passed
      if (this.isOpen && (now - this.lastFailureTime) > this.timeout) {
        console.log('🛡️ CIRCUIT BREAKER: Resetting after timeout');
        this.reset();
        return false;
      }

      // Skip if circuit is open
      if (this.isOpen) {
        console.log('🛡️ CIRCUIT BREAKER: Skipping API calls due to repeated failures');
        return true;
      }

      return false;
    },

    recordFailure(): void {
      this.failures++;
      this.lastFailureTime = Date.now();

      if (this.failures >= this.threshold) {
        this.isOpen = true;
        console.log(`🛡️ CIRCUIT BREAKER: OPENED after ${this.failures} consecutive failures`);
      }
    },

    recordSuccess(): void {
      if (this.failures > 0) {
        console.log(`🛡️ CIRCUIT BREAKER: Reset after success (was ${this.failures} failures)`);
        this.reset();
      }
    },

    reset(): void {
      this.failures = 0;
      this.isOpen = false;
      this.lastFailureTime = 0;
    }
  };

  // 🔍 TOKEN CLASSIFICATION HELPERS
  private static isMajorToken(symbol: string): boolean {
    const majorTokens = [
      'ETH', 'WETH', 'BTC', 'WBTC', 'USDT', 'USDC', 'DAI', 'BUSD',
      'SHIB', 'DOGE', 'LINK', 'UNI', 'AAVE', 'COMP', 'SUSHI', 'CRV',
      'MATIC', 'AVAX', 'FTM', 'SOL', 'ADA', 'DOT', 'ATOM', 'LUNA'
    ];
    return majorTokens.includes(symbol?.toUpperCase() || '');
  }

  private static isDeFiToken(symbol: string): boolean {
    const defiTokens = [
      'UNI', 'SUSHI', 'CRV', '1INCH', 'AAVE', 'COMP', 'MKR', 'SNX',
      'BAL', 'YFI', 'SUSHI', 'LDO', 'FXS', 'GMX', 'GNS', 'RDNT'
    ];
    return defiTokens.includes(symbol?.toUpperCase() || '');
  }

  

  private static findTokenInZapperResponse(data: any, tokenAddress: string, symbol: string): string | null {
    try {
      // Zapper has a complex nested structure
      if (data.products) {
        for (const product of Object.values(data.products)) {
          if (Array.isArray(product)) {
            for (const asset of product) {
              if (asset.symbol === symbol ||
                  (asset.tokens && asset.tokens[0]?.symbol === symbol)) {
                return asset.balance || asset.tokens[0]?.balance;
              }
            }
          }
        }
      }

      // Check in assets array directly
      if (data.assets && Array.isArray(data.assets)) {
        for (const asset of data.assets) {
          if (asset.symbol === symbol ||
              asset.address?.toLowerCase() === tokenAddress.toLowerCase()) {
            return asset.balance;
          }
        }
      }

      return null;
    } catch (error) {
      console.warn(`Error parsing Zapper response for ${symbol}:`, error);
      return null;
    }
  }
  // 🛡️ INTELLIGENT CACHE MANAGEMENT
  private static getCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.expiry) {
      console.log(`🛡️ CACHE HIT: ${key} (${Math.round((cached.expiry - Date.now()) / 1000)}s remaining)`);
      return cached.data;
    }
    if (cached) {
      console.log(`🛡️ CACHE EXPIRED: ${key}`);
      this.cache.delete(key);
    }
    return null;
  }

  private static setCache(key: string, data: any, ttlMs: number): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttlMs,
      cachedAt: Date.now()
    });
    console.log(`🛡️ CACHE SET: ${key} (${Math.round(ttlMs / 1000)}s TTL)`);
  }

  // 🛡️ SMART CACHE TTL: Different TTL for different data types
  private static getSmartCacheTTL(dataType: 'balance' | 'portfolio' | 'transactions', dataSize: number): number {
    switch (dataType) {
      case 'balance':
        // Token balances change frequently for active traders
        return 30 * 1000; // 30 seconds for individual token balances

      case 'portfolio':
        // Portfolio data can be cached longer
        return 2 * 60 * 1000; // 2 minutes for portfolio overview

      case 'transactions':
        // Transaction history is static
        return 5 * 60 * 1000; // 5 minutes for transactions

      default:
        return 60 * 1000; // 1 minute default
    }
  }

  // 🛡️ CACHE VALIDATION: Check if cached data is still reliable
  private static isCacheReliable(cachedData: any, dataType: string): boolean {
    if (!cachedData || !cachedData.cachedAt) return false;

    const age = Date.now() - cachedData.cachedAt;
    const maxAge = this.getSmartCacheTTL(dataType as any, 0);

    // Additional validation for balance data
    if (dataType === 'balance' && cachedData.balanceValidation) {
      const { isSuspiciouslyLarge, isSuspiciouslySmall } = cachedData.balanceValidation;
      if (isSuspiciouslyLarge || isSuspiciouslySmall) {
        console.warn(`🛡️ CACHE INVALIDATION: Suspicious balance detected for ${cachedData.symbol}`);
        return false;
      }
    }

    return age < maxAge;
  }

  // Helper method to get token price using cache system
  private static async getTokenPrice(symbol?: string, contractAddress?: string): Promise<number> {
    if (!symbol) return 0;

    try {
      const sym = symbol.toUpperCase();
      if (sym === 'WETH') {
        const eth = await priceCache.fetchETHPrice();
        return eth;
      }
      const price = await priceCache.fetchTokenPrice(symbol, contractAddress);
      console.log(`💰 Got price for ${symbol}: $${price}`);
      return price;
    } catch (error) {
      console.warn(`Failed to fetch price for ${symbol}, no reliable fallback used:`, error);
      // Only fallback for stablecoins to avoid misleading volatile prices
      const stablePrices: { [key: string]: number } = {
        'USDC': 1.0,
        'USDT': 1.0,
        'DAI': 1.0
      };
      const key = symbol.toUpperCase();
      return stablePrices[key] ?? 0;
    }
  }

  // Synchronous version for immediate use (falls back to cached prices)
  private static estimateTokenPrice(symbol?: string, address?: string): number {
    if (!symbol) return 1.0;

    // Try to get cached price first (with address for better cache hit)
    const cachedPrice = priceCache.getCachedTokenPrice(symbol, address);
    if (cachedPrice !== null) {
      console.log(`✅ ${symbol}: Using cached price $${cachedPrice} (address: ${address?.slice(0, 8)}...)`);
      return cachedPrice;
    }

    const sym = symbol.toUpperCase();
    if (sym === 'WETH') {
      const ethCached = priceCache.getCachedETHPrice();
      if (ethCached !== null) {
        return ethCached;
      }
    }

    console.log(`❌ ${symbol}: No cached price found (address: ${address?.slice(0, 8)}...) - using fallback`);

    // Fallback only for stablecoins to avoid misleading volatile prices
    const stablePrices: { [key: string]: number } = {
      'USDC': 1.0,
      'USDT': 1.0,
      'DAI': 1.0
    };
    const key = symbol.toUpperCase();
    return stablePrices[key] ?? 0;
  }

  static async fetchETHBalance(address: string): Promise<string> {
    try {
      const response = await fetch(
        this.buildProxyUrl({
          chainid: '1',
          module: 'account',
          action: 'balance',
          address
        }),
        {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(15000)
        }
      );

      if (!response.ok) {
        console.warn('Etherscan API responded with status:', response.status);
        return '0';
      }

      const data = await response.json();
      const balance = data.result;
      if (!balance || typeof balance !== 'string' || !/^\d+$/.test(balance)) {
        console.warn('Invalid balance data from Etherscan:', data);
        return '0';
      }
      return balance;
    } catch (error) {
      console.warn('ETH balance fetch failed, using fallback:', error instanceof Error ? error.message : 'Unknown error');
      return '0';
    }
  }

  static async fetchETHPrice(): Promise<number> {
    return await priceCache.fetchETHPrice();
  }

  /**
   * Clear price cache (for manual refresh)
   */
  static clearPriceCache(): void {
    priceCache.clearCache();
    console.log('💰 PRICE CACHE: Cleared all cached prices for manual refresh');
  }

  /**
   * Clear transaction cache for a specific address
   */
  static clearTransactionCache(address: string): void {
    const keysToDelete: string[] = [];
    this.cache.forEach((_, key) => {
      if (key.startsWith(`transactions_${address}_`)) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => {
      this.cache.delete(key);
      console.log(`🗑️ CACHE: Cleared transaction cache ${key}`);
    });
  }

  /**
   * Get price cache statistics
   */
  static getPriceCacheStats() {
    return priceCache.getCacheStats();
  }

  // ⚡ FAST PORTFOLIO SUMMARY: Optimized for speed with early returns
  static async fetchPortfolioSummaryFast(address: string): Promise<{
    totalValueUSD: number;
    ethBalance: string;
    tokens: any[];
    tokenCount: number;
  }> {
    try {
      console.log('⚡ FAST-PORTFOLIO: Starting optimized portfolio fetch...');
      const startTime = performance.now();

      // Step 1: Get ETH balance first (most reliable)
      let ethBalance = '0';
      try {
        const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || 'VMUSQTMBBDUWZJ4VG2FCMAFCMBMRXYSGGH';
        const response = await fetch(
          `https://api.etherscan.io/v2/api?chainid=1&module=account&action=balance&address=${address}&apikey=${ETHERSCAN_API_KEY}`,
          {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(5000) // 5 second timeout
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.status === '1' && data.result) {
            ethBalance = data.result;
          }
        }
      } catch (error) {
        console.warn('⚡ FAST-PORTFOLIO: ETH balance fetch failed:', error);
      }

      // Step 2: Get ETH price quickly
      let ethPrice = 3000; // Fallback price
      try {
        const priceResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd', {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(3000) // 3 second timeout
        });

        if (priceResponse.ok) {
          const priceData = await priceResponse.json();
          ethPrice = priceData.ethereum?.usd || 3000;
        }
      } catch (error) {
        console.warn('⚡ FAST-PORTFOLIO: ETH price fetch failed, using fallback');
      }

      // Step 3: Get tokens with very aggressive timeout and fallbacks
      let tokens: any[] = [];
      try {
        // Try to get tokens but with very short timeout
        tokens = await Promise.race<any[]>([
          this.fetchTopTokensOnly(address),
          new Promise<any[]>(resolve => setTimeout(() => resolve([]), 10000))
        ]);
      } catch (error) {
        console.warn('⚡ FAST-PORTFOLIO: Token fetch timed out, using empty list');
      }

      // Calculate total value (ETH + tokens)
      const ethValueUSD = (parseFloat(ethBalance) / 1e18) * ethPrice;
      const tokensValueUSD = tokens.reduce((sum, token) => sum + (token.valueUSD || 0), 0);
      const totalValueUSD = ethValueUSD + tokensValueUSD;

      console.log(`⚡ FAST-PORTFOLIO: Completed in ${performance.now() - startTime}ms - ${tokens.length} tokens, $${totalValueUSD.toFixed(2)} total value`);

      return {
        totalValueUSD: Math.round(totalValueUSD * 100) / 100,
        ethBalance,
        tokens,
        tokenCount: tokens.length
      };

    } catch (error) {
      console.error('⚡ FAST-PORTFOLIO: Critical error:', error);
      return {
        totalValueUSD: 0,
        ethBalance: '0',
        tokens: [],
        tokenCount: 0
      };
    }
  }

  static async fetchPortfolioSummary(address: string): Promise<any> {
    const startTime = performance.now();
    try {
      console.log('⚡ OVERVIEW: Starting portfolio summary fetch...');

      // ⚡ CACHE CHECK
      const cacheKey = `portfolio_${address}`;
      const cached = this.getCache(cacheKey);
      if (cached) {
        console.log('⚡ OVERVIEW: Using cached portfolio data');
        return cached;
      }

      // ⚡ PARALLEL FETCH: Get ETH balance and price simultaneously
      const [ethBalance, ethPrice] = await Promise.allSettled([
        this.fetchETHBalance(address),
        this.fetchETHPrice()
      ]);

      const balanceWei = ethBalance.status === 'fulfilled' ? ethBalance.value : '0';
      const priceUSD = ethPrice.status === 'fulfilled' ? ethPrice.value : 3000;

      const balanceETH = parseFloat(balanceWei) / Math.pow(10, 18);
      const ethValueUSD = balanceETH * priceUSD;

      // ⚡ FAST TOKENS: Get top 15 tokens only for overview
      const topTokens = await this.fetchTopTokensOnly(address);

      const totalTokenValueUSD = topTokens.reduce((sum, token) => sum + (token.valueUSD || 0), 0);
      const totalValueUSD = ethValueUSD + totalTokenValueUSD;

      const portfolioData = {
        ethBalance: balanceETH.toString(),
        ethValueUSD: Math.round(ethValueUSD * 100) / 100,
        totalValueUSD: Math.round(totalValueUSD * 100) / 100,
        tokens: topTokens,
        tokenCount: topTokens.length,
        timestamp: Date.now(),
        // 24h change calculation (simplified)
        valueChange24h: 0,
        valueChange24hPercent: 0
      };

      // ⚡ CACHE: Store for 2 minutes
      this.setCache(cacheKey, portfolioData, 2 * 60 * 1000);

      console.log(`⚡ OVERVIEW: Portfolio summary ready in ${performance.now() - startTime}ms`);
      return portfolioData;

    } catch (error) {
      console.error('Failed to fetch portfolio summary:', error);
      return {
        ethBalance: '0',
        ethValueUSD: 0,
        totalValueUSD: 0,
        tokens: [],
        tokenCount: 0,
        timestamp: Date.now(),
        valueChange24h: 0,
        valueChange24hPercent: 0
      };
    }
  }

  // Fetch tokens using Alchemy (primary source)
  private static async fetchTokensFromAlchemy(address: string): Promise<any[]> {
    try {
      const baseUrl = typeof window !== 'undefined'
        ? window.location.origin
        : WalletAPI.getBaseURL();
      const url = `${baseUrl}/api/covalent-proxy?addr=${encodeURIComponent(address)}&chainid=1`;
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!res.ok) {
        return [];
      }
      const json = await res.json();
      const items = Array.isArray(json?.tokens)
        ? json.tokens
        : (Array.isArray(json?.data?.items)
            ? json.data.items
            : (Array.isArray(json?.items) ? json.items : []));
      const nonZero = items.filter((it: any) => {
        try {
          const b = BigInt(it.balance || '0');
          return b > BigInt(0);
        } catch {
          return false;
        }
      });

      const tokens: any[] = [];
      for (const it of nonZero) {
        const addressLower = (it.contract_address || '').toLowerCase();
        if (!addressLower) continue;
        const decimals = parseInt(it.contract_decimals ?? it.decimals ?? '18') || 18;
        let rawBig = BigInt(0);
        try {
          rawBig = BigInt(it.balance || '0');
        } catch {}
        const balance = Number(rawBig) / Math.pow(10, decimals);
        const verified = !!ETHEREUM_TOKEN_WHITELIST[addressLower];
        tokens.push({
          symbol: it.contract_ticker_symbol || it.symbol || 'UNKNOWN',
          name: it.contract_name || it.name || 'Unknown Token',
          address: addressLower,
          decimals,
          balance: balance.toString(),
          priceUSD: 0,
          valueUSD: 0,
          verified,
          hasNoPriceData: true
        });
      }

      const addresses = tokens.map(t => t.address).filter(Boolean) as string[];
      const priceMap = await priceCache.fetchTokenPricesByAddress(addresses);
      for (const t of tokens) {
        const priceUSD = priceMap[(t.address || '').toLowerCase()] || 0;
        const balanceNum = parseFloat(t.balance || '0');
        t.priceUSD = priceUSD;
        t.valueUSD = Math.round((balanceNum * priceUSD) * 100) / 100;
        t.hasNoPriceData = priceUSD === 0;
      }

      return tokens
        .sort((a, b) => b.valueUSD - a.valueUSD)
        .slice(0, 60);
    } catch {
      return [];
    }
  }

  private static async fetchTopTokensOnly(address: string): Promise<any[]> {
    try {
      // Primary path: Alchemy balances (independent of transfer history)
      const alchemyTokens = await this.fetchTokensFromAlchemy(address);
      if (alchemyTokens && alchemyTokens.length > 0) {
        console.log(`✅ Alchemy balances returned ${alchemyTokens.length} tokens`);
        return alchemyTokens;
      }

      // Fallback path: Etherscan discovery + per-token balance
      const ETHERSCAN_API_KEY = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY ||
                                process.env.ETHERSCAN_API_KEY ||
                                'VMUSQTMBBDUWZJ4VG2FCMAFCMBMRXYSGGH';

      console.log('🔍 Fetching token balances using Etherscan token balance API...');

      // Step 1: Get transactions from multiple pages to identify token contracts (enhanced for whale wallets)
      console.log('🔍 Fetching token contracts for overview (multi-page for whale wallets)...');

      let allTransactions: any[] = [];
      let page = 1;
      let maxPages = 3; // For overview, default to 3 pages (600 transactions)
      let hasMoreData = true;

      while (hasMoreData && page <= maxPages) {
        try {
          const txResponse = await fetch(
            `https://api.etherscan.io/v2/api?chainid=1&module=account&action=tokentx&address=${address}&page=${page}&offset=200&sort=desc&apikey=${ETHERSCAN_API_KEY}`,
            {
              headers: { 'Accept': 'application/json' },
              signal: AbortSignal.timeout(8000)
            }
          );

          if (!txResponse.ok) {
            console.warn(`Failed to fetch page ${page}:`, txResponse.status);
            break;
          }

          const txData = await txResponse.json();

          if (txData.status !== '1' || !txData.result || !Array.isArray(txData.result)) {
            console.log(`No more data on page ${page}`);
            hasMoreData = false;
            break;
          }

          const pageTransactions = txData.result;
          allTransactions = allTransactions.concat(pageTransactions);

          if (pageTransactions.length < 200) {
            hasMoreData = false;
          }

          page++;
        } catch (error) {
          console.warn(`Error fetching page ${page}:`, error);
          break;
        }
      }

      console.log(`🔍 Overview: Found ${allTransactions.length} total transactions across ${page - 1} pages`);
      if (allTransactions.length < 50) {
        // If discovery is thin, extend to 5 pages
        while (page <= 5) {
          try {
            const txResponse = await fetch(
              `https://api.etherscan.io/v2/api?chainid=1&module=account&action=tokentx&address=${address}&page=${page}&offset=200&sort=desc&apikey=${ETHERSCAN_API_KEY}`,
              { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(8000) }
            );
            if (!txResponse.ok) break;
            const txData = await txResponse.json();
            if (txData.status !== '1' || !Array.isArray(txData.result) || txData.result.length === 0) break;
            allTransactions = allTransactions.concat(txData.result);
            page++;
          } catch { break; }
        }
        console.log(`🔍 Extended overview to ${page - 1} pages, total tx: ${allTransactions.length}`);
      }

      if (allTransactions.length === 0) {
        console.warn('No token transactions found for overview');
        return [];
      }

      const contractCounts = new Map<string, number>();
      allTransactions.forEach((tx: any) => {
        if (tx.contractAddress) {
          const k = tx.contractAddress.toLowerCase();
          contractCounts.set(k, (contractCounts.get(k) || 0) + 1);
        }
      });

      const tokenContracts = new Map<string, any>();
      allTransactions.forEach((tx: any) => {
        if (tx.contractAddress && !tokenContracts.has(tx.contractAddress)) {
          tokenContracts.set(tx.contractAddress, {
            address: tx.contractAddress,
            symbol: tx.tokenSymbol,
            name: tx.tokenName,
            decimals: parseInt(tx.tokenDecimal) || 18,
            txCount: contractCounts.get(tx.contractAddress.toLowerCase()) || 1
          });
        }
      });

      let filteredContracts = Array.from(tokenContracts.values()).filter((t: any) => {
        const sym = (t.symbol || '').toUpperCase();
        const name = (t.name || '').toLowerCase();
        const singleTx = t.txCount <= 1;
        const longSymbol = sym.length > 12;
        const spamName = name.includes('airdrop') || name.includes('claim') || name.includes('reward') || name.includes('gift') || name.includes('test');
        const keepMajor = isWhitelisted(t.address, 1) || WalletAPI.isMajorToken(sym) || WalletAPI.isDeFiToken(sym);
        if (keepMajor) return true;
        if (spamName && singleTx) return false;
        if (longSymbol && singleTx) return false;
        return true;
      });

      filteredContracts = filteredContracts.sort((a: any, b: any) => (b.txCount || 0) - (a.txCount || 0)).slice(0, 60);
      console.log(`🔍 Filtered ${tokenContracts.size} → ${filteredContracts.length} token contracts for balance checks`);

      // Step 3: Fetch current balances for each token contract
      const tokenPromises = filteredContracts.map(async (token: any) => {
        const tokenAddress = token.address;
        try {
          // 🛡️ CIRCUIT BREAKER CHECK: Skip API calls if system is overwhelmed
          if (WalletAPI.circuitBreaker.shouldSkip()) {
            console.log(`⚠️ CIRCUIT BREAKER: Skipping ${token.symbol} balance fetch - API temporarily disabled`);
            return null;
          }

          // 🛡️ COMPREHENSIVE BALANCE FETCHING: Multi-source with validation
          let balanceData = null;
          let dataSource = 'unknown';
          const fetchAttempts = [];
          let allSourcesFailed = true;

          // SOURCE 1: Etherscan V2 (primary) - using V2 to avoid deprecation
          try {
            const response = await fetch(
              this.buildProxyUrl({
                chainid: '1',
                module: 'account',
                action: 'tokenbalance',
                contractaddress: tokenAddress,
                address,
                tag: 'latest'
              }),
              {
                headers: { 'Accept': 'application/json' },
                signal: AbortSignal.timeout(5000) // Reduced to 5 seconds for faster fallback
              }
            );

            if (response.ok) {
              const data = await response.json();
              if (data.status === '1' && data.result) {
                balanceData = data;
                dataSource = 'etherscan_v2_primary';
                fetchAttempts.push({ source: 'etherscan_v2_primary', success: true, result: data.result });
                console.log(`🛡️ PRIMARY SUCCESS (${token.symbol}): Etherscan V2 - ${data.result}`);
                WalletAPI.circuitBreaker.recordSuccess(); // Record success for circuit breaker
                allSourcesFailed = false;
              } else {
                fetchAttempts.push({ source: 'etherscan_v2_primary', success: false, error: data.message });
              }
            } else {
              fetchAttempts.push({ source: 'etherscan_v2_primary', success: false, error: `HTTP ${response.status}` });
            }
          } catch (error: any) {
            fetchAttempts.push({ source: 'etherscan_v2_primary', success: false, error: error.message });
            console.warn(`🛡️ PRIMARY FAILED (${token.symbol}): Etherscan V2 -`, error);
          }

          // SOURCE 2: Etherscan V2 (backup) - second attempt with same V2 API
          if (!balanceData) {
            try {
              const response = await fetch(
                this.buildProxyUrl({
                  chainid: '1',
                  module: 'account',
                  action: 'tokenbalance',
                  contractaddress: tokenAddress,
                  address,
                  tag: 'latest'
                }),
                {
                  headers: { 'Accept': 'application/json' },
                  signal: AbortSignal.timeout(5000) // Reduced to 5 seconds for faster fallback
                }
              );

              if (response.ok) {
                const data = await response.json();
                if (data.status === '1' && data.result) {
                  balanceData = data;
                  dataSource = 'etherscan_v2_backup';
                  fetchAttempts.push({ source: 'etherscan_v2_backup', success: true, result: data.result });
                  console.log(`🛡️ BACKUP SUCCESS (${token.symbol}): Etherscan V2 - ${data.result}`);
                  WalletAPI.circuitBreaker.recordSuccess(); // Record success for circuit breaker
                  allSourcesFailed = false;
                } else {
                  fetchAttempts.push({ source: 'etherscan_v2_backup', success: false, error: data.message });
                }
              } else {
                fetchAttempts.push({ source: 'etherscan_v2_backup', success: false, error: `HTTP ${response.status}` });
              }
            } catch (error: any) {
              fetchAttempts.push({ source: 'etherscan_v2_backup', success: false, error: error.message });
              console.warn(`🛡️ BACKUP FAILED (${token.symbol}): Etherscan V2 -`, error);
            }
          }

          // SOURCE 3: DeBank API - DISABLED due to DNS resolution issues
          // The DeBank API is causing net::ERR_NAME_NOT_RESOLVED errors
          // We'll rely on Etherscan APIs only for token balance fetching
          console.log(`🔍 DEBUG (${token.symbol}): Skipping DeBank API due to DNS resolution issues`);

          // SOURCE 4: Zapper API (for DeFi tokens)
          if (!balanceData && this.isDeFiToken(token.symbol)) {
            try {
              const response = await fetch(
                `https://api.zapper.fi/v2/balances/${address}`,
                {
                  headers: { 'Accept': 'application/json' },
                  signal: AbortSignal.timeout(8000)
                }
              );

              if (response.ok) {
                const data = await response.json();
                // Find token in Zapper response (complex structure)
                const tokenBalance = this.findTokenInZapperResponse(data, tokenAddress, token.symbol);
                if (tokenBalance) {
                  const rawBalance = parseFloat(tokenBalance) * Math.pow(10, token.decimals);
                  balanceData = {
                    status: '1',
                    result: Math.floor(rawBalance).toString()
                  };
                  dataSource = 'zapper';
                  fetchAttempts.push({ source: 'zapper', success: true, result: balanceData.result });
                  console.log(`🛡️ DEFI SUCCESS (${token.symbol}): Zapper - ${balanceData.result}`);
                } else {
                  fetchAttempts.push({ source: 'zapper', success: false, error: 'Token not found' });
                }
              } else {
                fetchAttempts.push({ source: 'zapper', success: false, error: `HTTP ${response.status}` });
              }
            } catch (error: any) {
              fetchAttempts.push({ source: 'zapper', success: false, error: error.message });
              console.warn(`🛡️ DEFI FAILED (${token.symbol}): Zapper -`, error);
            }
          }

          // Log all attempts for debugging
          console.log(`🛡️ BALANCE FETCH SUMMARY (${token.symbol}):`, {
            dataSource,
            attempts: fetchAttempts,
            finalResult: balanceData?.result || 'null'
          });

          if (!balanceData) {
            console.warn(`⚠️ ALL SOURCES FAILED (${token.symbol}): Could not fetch balance - likely zero balance or invalid token`);

            // 🛡️ GRACEFUL HANDLING: Don't fail completely, assume zero balance
            // This prevents the entire operation from failing due to tokens with no balance
            return {
              ...token,
              balance: "0",
              valueUSD: 0,
              verified: false,
              hasNoPriceData: false,
              dataSource: 'fallback_zero',
              lastUpdated: Date.now(),
              balanceValidation: {
                isSuspiciouslyLarge: false,
                isSuspiciouslySmall: false,
                decimals: token.decimals,
                rawBalance: 0,
                fallbackUsed: true
              },
              fetchAttempts
            };
          }

          const balanceResponse = { ok: true, json: async () => balanceData } as any;

          if (!balanceResponse.ok) {
            console.warn(`Failed to fetch balance for ${token.symbol}:`, balanceResponse.status);
            return null;
          }

          const balanceDataResult = await balanceResponse.json();

          // 🔍 DETAILED DEBUG: Log complete API response
          console.log(`🔍 API Response for ${token.symbol}:`, {
            status: balanceDataResult.status,
            message: balanceDataResult.message,
            result: balanceDataResult.result,
            resultType: typeof balanceDataResult.result,
            resultLength: balanceDataResult.result ? balanceDataResult.result.toString().length : 0
          });

          if (balanceDataResult.status !== '1') {
            console.warn(`Invalid balance response for ${token.symbol}:`, balanceDataResult.message);
            return null;
          }

          const rawBalance = parseInt(balanceDataResult.result) || 0;
          let decimals = token.decimals;

          // 🔍 DECIMAL VALIDATION: Common decimals for known tokens
          const knownDecimals: { [key: string]: number } = {
            'USDC': 6,
            'USDT': 6,
            'WBTC': 8,
            'WETH': 18,
            'SHIB': 18,
            'UNI': 18,
            'LINK': 18,
            'AAVE': 18,
            'DAI': 18,
            'DOGE': 8,
            'MATIC': 18,
            'AVAX': 18,
            'SOL': 9, // Wrapped SOL
            'ADA': 6 // Wrapped ADA
          };

          // Use known decimals if available, otherwise use transaction data
          if (knownDecimals[token.symbol]) {
            decimals = knownDecimals[token.symbol];
            console.log(`🔍 Using known decimals for ${token.symbol}: ${decimals}`);
          } else {
            console.log(`🔍 Using transaction decimals for ${token.symbol}: ${decimals}`);
          }

          const balance = rawBalance / Math.pow(10, decimals);

          // 🔍 SANITY CHECK: Catch obviously wrong balances
          const isSuspiciouslyLarge = balance > 1e15; // More than 1 quadrillion tokens
          const isSuspiciouslySmall = balance > 0 && balance < 1e-18; // Very small but non-zero

          if (isSuspiciouslyLarge) {
            console.warn(`🚨 SUSPICIOUSLY LARGE BALANCE for ${token.symbol}: ${balance} - This might indicate a decimal error!`);
          }
          if (isSuspiciouslySmall) {
            console.warn(`🚨 SUSPICIOUSLY SMALL BALANCE for ${token.symbol}: ${balance} - This might indicate a decimal error!`);
          }

          console.log(`💰 ${token.symbol} BALANCE CALCULATION:`, {
            tokenAddress: tokenAddress,
            walletAddress: address,
            rawBalance: rawBalance,
            rawBalanceString: balanceDataResult.result,
            decimals: decimals,
            calculatedBalance: balance,
            balanceString: balance.toString(),
            isSuspiciouslyLarge,
            isSuspiciouslySmall,
            dataSource,
            fetchAttempts
          });

          return {
            ...token,
            balance: balance.toString(),
            valueUSD: 0,
            hasNoPriceData: false,
            // 🛡️ DATA PROVENANCE: Track data source for debugging
            dataSource,
            lastUpdated: Date.now(),
            balanceValidation: {
              isSuspiciouslyLarge,
              isSuspiciouslySmall,
              decimals: decimals,
              rawBalance: rawBalance
            }
          };
        } catch (error) {
          console.warn(`Error fetching balance for ${token.symbol}:`, error);
          return null;
        }
      });

      const chunks: any[][] = [];
      const chunkSize = 10;
      for (let i = 0; i < tokenPromises.length; i += chunkSize) {
        chunks.push(tokenPromises.slice(i, i + chunkSize));
      }
      const settled: PromiseSettledResult<any>[] = [];
      for (const group of chunks) {
        const res = await Promise.allSettled(group);
        settled.push(...res);
      }
      const tokenResults = settled;
      const validTokens = tokenResults
        .filter((result): result is PromiseFulfilledResult<any> =>
          result.status === 'fulfilled' && result.value !== null
        )
        .map(result => result.value)
        .filter(token => {
          const balance = parseFloat(token.balance);
          return balance > 0; // Only include tokens with positive balance
        });

      console.log(`🔍 Found ${validTokens.length} tokens with positive balances`);

      // ⚡ DEDUPLICATE & PRIORITIZE WHITELIST: Ensure unique tokens and prioritize majors
      const uniqueByAddress = new Map<string, any>();
      for (const t of validTokens) {
        const addr = (t.address || '').toLowerCase();
        if (!addr) continue;
        if (!uniqueByAddress.has(addr)) uniqueByAddress.set(addr, t);
      }
      const dedupedTokens = Array.from(uniqueByAddress.values());

      // ⚡ PRE-FETCH PRICES: Prefetch for whitelisted + top by balance
      console.log(`💰 PRE-FETCHING: Preparing ${dedupedTokens.length} tokens for pricing...`);
      const whitelistSet = new Set<string>(Object.keys(ETHEREUM_TOKEN_WHITELIST));
      const verifiedTokens = dedupedTokens.filter(t => whitelistSet.has((t.address || '').toLowerCase()));
      const topByBalance = dedupedTokens
        .slice()
        .sort((a, b) => parseFloat(b.balance || '0') - parseFloat(a.balance || '0'))
        .slice(0, 40);
      const fetchCandidatesMap = new Map<string, any>();
      for (const t of [...verifiedTokens, ...topByBalance]) {
        const addr = (t.address || '').toLowerCase();
        if (!fetchCandidatesMap.has(addr)) fetchCandidatesMap.set(addr, t);
      }
      const tokensToFetch = Array.from(fetchCandidatesMap.values()).slice(0, 60);
      console.log(`💰 PRE-FETCHING: Fetching prices for ${tokensToFetch.length} tokens including: ${tokensToFetch.map(t => t.symbol).slice(0, 5).join(', ')}...`);

      const pricePromises = tokensToFetch.map(async (token) => {
        try {
          const price = await priceCache.fetchTokenPrice(token.symbol, token.address);
          console.log(`💰 PRE-FETCHED ${token.symbol}: $${price}`);
          return { symbol: token.symbol, price, success: true };
        } catch (error) {
          console.warn(`Failed to fetch price for ${token.symbol}:`, error);
          return { symbol: token.symbol, price: 0, success: false };
        }
      });

      const priceResults = await Promise.allSettled(pricePromises);
      const successfulFetches = priceResults.filter(r => r.status === 'fulfilled' && r.value.success).length;
      console.log(`💰 PRE-FETCHING: Successfully fetched ${successfulFetches}/${tokensToFetch.length} token prices`);

      // Calculate USD values and apply filters
      const enriched = await Promise.all(dedupedTokens.map(async (token) => {
        const balance = parseFloat(token.balance);
        let priceUSD = priceCache.getCachedTokenPrice(token.symbol, token.address) ?? 0;
        if (priceUSD === 0) {
          try {
            priceUSD = await priceCache.fetchTokenPrice(token.symbol, token.address);
          } catch {
            priceUSD = 0;
          }
        }
        const valueUSD = balance * priceUSD;
        if (priceUSD === 0) token.hasNoPriceData = true;
        const priceSource = priceCache.getLastSource(token.symbol, token.address) || undefined;
        const priceInfo = priceCache.getPriceInfo(token.symbol, token.address);
        const confidence = priceInfo?.confidence;
        // Apply whitelist metadata
        const wl = getWhitelistMeta(token.address, 1);
        return {
          ...token,
          valueUSD: Math.round(valueUSD * 100) / 100,
          priceUSD,
          priceSource,
          confidence,
          verified: token.verified || !!wl
        };
      }));

      const tokens = enriched
        .sort((a, b) => b.valueUSD - a.valueUSD)
        .slice(0, 30);

      return tokens;

    } catch (error) {
      console.warn('Failed to fetch top tokens:', error);
      return [];
    }
  }

  // ⚡ OPTIMIZED: Fast token fetch with parallel processing and aggressive timeouts
  static async getAllTokens(address: string): Promise<any[]> {
    console.log('⚡ FAST-TOKENS: Getting ALL tokens with optimized parallel processing...');

    try {
      const ETHERSCAN_API_KEY = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY ||
                                process.env.ETHERSCAN_API_KEY ||
                                'VMUSQTMBBDUWZJ4VG2FCMAFCMBMRXYSGGH';
      
      // NOTE: Removed Covalent short-circuit here because getAllTokens is used in parallel with getAllTokensCovalent
      // in getPortfolioTokens. We want this function to focus on Etherscan/Alchemy discovery.

      console.log('⚡ FAST-TOKENS: Fetching token contracts...');
      let allTransactions: any[] = [];

      try {
        const offset = 200;
        const maxPages = 15;
        const batchSize = 6;
        for (let start = 1; start <= maxPages; start += batchSize) {
          const end = Math.min(start + batchSize - 1, maxPages);
          const batchPromises = [] as Promise<number>[];
          for (let page = start; page <= end; page++) {
            const url = typeof window === 'undefined'
              ? `https://api.etherscan.io/v2/api?chainid=1&module=account&action=tokentx&address=${address}&page=${page}&offset=${offset}&sort=desc&apikey=${ETHERSCAN_API_KEY}`
              : `${window.location.origin}/api/etherscan-proxy?chainid=1&module=account&action=tokentx&address=${address}&page=${page}&offset=${offset}&sort=desc`;
            const p = fetch(url, { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(8000) })
              .then(res => res.ok ? res.json() : null)
              .then(data => {
                if (!data || data.status !== '1' || !Array.isArray(data.result)) return -1;
                allTransactions = allTransactions.concat(data.result);
                return data.result.length;
              })
              .catch(() => -1);
            batchPromises.push(p);
          }
          const lengths = await Promise.all(batchPromises);
          const reachedEnd = lengths.some(len => len > -1 && len < offset);
          if (reachedEnd) break;
          await new Promise(resolve => setTimeout(resolve, 150));
        }
      } catch (error) {
        return await this.fetchTopTokensOnlyFast(address);
      }

      // Step 2: Extract unique token contracts
      const tokenContracts = new Map();
      allTransactions.forEach((tx: any) => {
        if (tx.contractAddress) {
          const addr = tx.contractAddress.toLowerCase();
          const wl = ETHEREUM_TOKEN_WHITELIST[addr];
          const symbol = wl ? wl.symbol : tx.tokenSymbol;
          console.log(`🔍 TOKEN DEBUG: Processing contract ${addr} (${symbol})`);
          tokenContracts.set(addr, {
            address: tx.contractAddress,
            symbol: symbol,
            name: wl ? wl.name : tx.tokenName,
            decimals: wl ? wl.decimals : (parseInt(tx.tokenDecimal) || 18),
            logo: null
          });
        }
      });

      console.log(`⚡ FAST-TOKENS: Found ${tokenContracts.size} unique token contracts`);
      console.log(`📋 TOKEN DEBUG: Token contracts:`, Array.from(tokenContracts.keys()));

      const tokens = Array.from(tokenContracts.values());
      const { batchBalanceOf } = await import('../eth/multicall');
      const balanceMap = await batchBalanceOf(address, tokens.map(t => ({ address: t.address, decimals: t.decimals })));

      const withBalance = tokens.map(token => {
        const balStr = balanceMap[token.address.toLowerCase()] || '0';
        const balanceNum = parseFloat(balStr);
        if (isNaN(balanceNum) || balanceNum <= 0) return null;
        return { ...token, balanceNum };
      }).filter(Boolean) as Array<{ address: string; symbol: string; name: string; decimals: number; balanceNum: number }>;

      const needPricing = withBalance.map(t => t.address.toLowerCase());
      let priceByAddr: Record<string, number> = {};
      try {
        priceByAddr = await priceCache.fetchTokenPricesByAddress(needPricing);
      } catch {}

      const validTokens = withBalance.map(t => {
        const priceUSD = priceByAddr[t.address.toLowerCase()] || 0;
        const valueUSD = priceUSD * t.balanceNum;
        const priceInfo = priceCache.getPriceInfo(t.symbol, t.address);
        return {
          symbol: t.symbol,
          name: t.name,
          address: t.address,
          decimals: t.decimals,
          balance: t.balanceNum.toString(),
          priceUSD,
          valueUSD,
          hasNoPriceData: priceUSD === 0,
          verified: !!ETHEREUM_TOKEN_WHITELIST[t.address.toLowerCase()],
          dataSource: 'multicall',
          lastUpdated: Date.now(),
          confidence: priceInfo?.confidence
        };
      }).filter((t: any) => parseFloat(t.balance) > 0);

    console.log(`⚡ FAST-TOKENS: Found ${validTokens.length} tokens with positive balances`);
    console.log(`📋 TOKEN DEBUG: Final token list:`, validTokens.map(t => ({
      symbol: t.symbol,
      balance: t.balance,
      priceUSD: t.priceUSD,
      valueUSD: t.valueUSD
    })));

      if (!validTokens || validTokens.length === 0) {
        try {
          const covalentFallback = await this.getAllTokensCovalent(address);
          if (Array.isArray(covalentFallback) && covalentFallback.length > 0) {
            console.log(`⚡ FAST-TOKENS: Using Covalent fallback with ${covalentFallback.length} tokens`);
            return covalentFallback;
          }
        } catch {}
      }

      return validTokens;

    } catch (error) {
      console.warn('⚡ FAST-TOKENS: Optimized fetch failed, using fallback method:', error);
      return await this.fetchTopTokensOnlyFast(address);
    }
  }

  static async getAllTokensDebank(address: string): Promise<any[]> {
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : WalletAPI.getBaseURL();
      const res = await fetch(`${origin}/api/debank-proxy?addr=${address}`, { headers: { 'Accept': 'application/json' } });
      if (!res.ok) return [];
      const json = await res.json();
      const data: any[] = Array.isArray(json?.tokens) ? json.tokens : Array.isArray(json) ? json : [];

      const tokens = (data || [])
        .filter(Boolean)
        .filter((t: any) => (t.chain || 'eth').toLowerCase() === 'eth')
        .map((t: any) => {
          const addressLower = (t.id || '').toLowerCase();
          const wl = ETHEREUM_TOKEN_WHITELIST[addressLower];
          const symbol = t.symbol || wl?.symbol || 'UNKNOWN';
          const name = t.name || wl?.name || symbol;
          const decimals = t.decimals || wl?.decimals || 18;
          const amount = typeof t.amount === 'number' ? t.amount : parseFloat(t.amount || '0');
          const price = typeof t.price === 'number' ? t.price : 0;
          const valueUSD = price * amount;
          const priceInfo = priceCache.getPriceInfo(symbol, addressLower);
          return {
            symbol,
            name,
            address: t.id || '',
            decimals,
            balance: amount.toString(),
            priceUSD: price,
            valueUSD,
            verified: !!wl,
            hasNoPriceData: price === 0,
            confidence: priceInfo?.confidence,
            chain: (t.chain || 'eth').toLowerCase()
          };
        });

      const unique = new Map<string, any>();
      for (const tok of tokens) {
        const key = tok.address ? tok.address.toLowerCase() : `${(tok.symbol || 'unknown').toLowerCase()}_${tok.chain || 'eth'}`;
        if (!unique.has(key)) unique.set(key, tok);
      }

      const list = Array.from(unique.values());

      const needPricing = list.filter(t => (typeof t.priceUSD !== 'number' || t.priceUSD === 0) && t.address).map(t => t.address.toLowerCase())
      if (needPricing.length > 0) {
        const priceMap = await priceCache.fetchTokenPricesByAddress(needPricing)
        for (const tok of list) {
          const addr = tok.address?.toLowerCase()
          if (addr && typeof tok.priceUSD !== 'number' || tok.priceUSD === 0) {
            const p = priceMap[addr]
            if (typeof p === 'number' && p > 0) {
              tok.priceUSD = p
              tok.valueUSD = p * parseFloat(tok.balance || '0')
              tok.hasNoPriceData = false
              const info = priceCache.getPriceInfo(tok.symbol, tok.address)
              tok.confidence = info?.confidence
            }
          }
        }
      }
      return list
    } catch {
      return [];
    }
  }

  static async getAllTokensEthplorer(address: string): Promise<any[]> {
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : WalletAPI.getBaseURL();
      const res = await fetch(`${origin}/api/ethplorer-proxy?addr=${address}`, { headers: { 'Accept': 'application/json' } });
      if (!res.ok) return [];
      const json = await res.json();
      const data: any[] = Array.isArray(json?.tokens) ? json.tokens : [];

      const tokens = data.map((t: any) => {
        const addr = (t.address || t.id || '').toLowerCase();
        const wl = ETHEREUM_TOKEN_WHITELIST[addr];
        const symbol = t.symbol || wl?.symbol || 'UNKNOWN';
        const name = t.name || wl?.name || symbol;
        const decimals = t.decimals || wl?.decimals || 18;
        const amount = typeof t.amount === 'number' ? t.amount : parseFloat(t.amount || '0');
        const price = typeof t.price === 'number' ? t.price : 0;
        const info = priceCache.getPriceInfo(symbol, addr);
        return {
          symbol,
          name,
          address: addr,
          decimals,
          balance: amount.toString(),
          priceUSD: price,
          valueUSD: price * amount,
          confidence: info?.confidence,
          verified: !!wl,
          hasNoPriceData: price === 0,
          chain: 'eth'
        };
      });

      // Try to enrich pricing for zero-priced tokens
      const needPricing = tokens.filter(t => (typeof t.priceUSD !== 'number' || t.priceUSD === 0) && t.address).map(t => t.address.toLowerCase());
      if (needPricing.length > 0) {
        try {
          const priceMap = await priceCache.fetchTokenPricesByAddress(needPricing);
        for (const tok of tokens) {
          const addr = tok.address?.toLowerCase();
          const p = addr ? priceMap[addr] : 0;
          if (typeof p === 'number' && p > 0) {
            const balNum = parseFloat(tok.balance || '0');
            tok.priceUSD = p;
            tok.valueUSD = p * balNum;
            tok.hasNoPriceData = false;
            const info = priceCache.getPriceInfo(tok.symbol, tok.address);
            tok.confidence = info?.confidence;
          }
        }
      } catch {}
      }

      return tokens;
    } catch {
      return [];
    }
  }

  static async getPortfolioTokens(address: string, forceRefresh: boolean = false): Promise<any[]> {
    try {
      const addrKey = (address || '').toLowerCase();
      const cached = this.portfolioTokenCache.get(addrKey);
      if (!forceRefresh && cached && (Date.now() - cached.ts) < 30000) {
        return cached.data;
      }
      if (forceRefresh && cached) {
        // Clear cache when force refreshing
        this.portfolioTokenCache.delete(addrKey);
      }

      const existing = this.inflightPortfolioTokenReq.get(addrKey);
      if (existing) {
        return await existing;
      }

      const task = (async () => {
        const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T | '__timeout__'> => {
          return Promise.race([p, new Promise(resolve => setTimeout(() => resolve('__timeout__' as any), ms))]) as any;
        };

        const debankP = this.getAllTokensDebank(address);
        const ethplorerP = this.getAllTokensEthplorer(address);
        const fastP = this.getAllTokens(address);
        const zapperP = this.getAllTokensZapper(address);
        const covalentP = this.getAllTokensCovalent(address);

        const merged = new Map<string, any>();
        const addAll = (arr: any[]) => {
          for (const t of arr) {
            const k = t.address ? t.address.toLowerCase() : `${(t.symbol || 'unknown').toLowerCase()}_${(t.chain || 'eth')}`;
            if (!merged.has(k)) {
              merged.set(k, t);
            } else {
              const prev = merged.get(k);
              merged.set(k, {
                ...prev,
                ...t,
                valueUSD: typeof t.valueUSD === 'number' ? t.valueUSD : prev.valueUSD,
                priceUSD: typeof t.priceUSD === 'number' ? t.priceUSD : prev.priceUSD,
                balance: (t.balance || prev.balance || '0').toString()
              });
            }
          }
        };

        const initialResults = await Promise.allSettled([
          withTimeout(debankP, 18000),
          withTimeout(ethplorerP, 18000),
          withTimeout(fastP, 18000),
          withTimeout(zapperP, 18000),
          withTimeout(covalentP, 18000)
        ]);

        let gotAny = false;
        for (const r of initialResults) {
          if (r.status === 'fulfilled' && r.value !== '__timeout__' && Array.isArray(r.value)) {
            if (r.value.length > 0) gotAny = true;
            addAll(r.value);
          }
        }

        if (!gotAny) {
          const fallback = await withTimeout(fastP, 10000);
          if (fallback !== '__timeout__' && Array.isArray(fallback)) {
            addAll(fallback);
          }
        }

        const needPricingAddrs = Array.from(merged.values())
          .map((t: any) => (typeof t.address === 'string' ? t.address.toLowerCase() : ''))
          .filter((addr: string) => !!addr)
          .filter((addr: string, idx: number, arr: string[]) => arr.indexOf(addr) === idx);

        if (needPricingAddrs.length > 0) {
          try {
            const priceMap = await priceCache.fetchTokenPricesByAddress(needPricingAddrs);
            for (const [k, tok] of merged.entries()) {
              const addr = typeof tok.address === 'string' ? tok.address.toLowerCase() : '';
              if (addr) {
                const currentPrice = typeof tok.priceUSD === 'number' ? tok.priceUSD : 0;
                const fetchedPrice = priceMap[addr];
                if ((currentPrice === 0 || !isFinite(currentPrice)) && typeof fetchedPrice === 'number' && fetchedPrice > 0) {
                  const balNum = parseFloat((tok.balance || '0').toString()) || 0;
                  merged.set(k, {
                    ...tok,
                    priceUSD: fetchedPrice,
                    valueUSD: fetchedPrice * balNum,
                    hasNoPriceData: false
                  });
                }
              }
            }
          } catch {}
        }

        const normalized = Array.from(merged.values()).map((t: any) => {
          const symbol = typeof t.symbol === 'string' ? t.symbol : 'UNKNOWN';
          const name = typeof t.name === 'string' ? t.name : symbol;
          const addressLower = typeof t.address === 'string' ? t.address.toLowerCase() : '';
          const decimals = typeof t.decimals === 'number' ? t.decimals : 18;
          const balanceStr = (typeof t.balance === 'string' || typeof t.balance === 'number') ? t.balance.toString() : '0';
          const balanceNum = parseFloat(balanceStr) || 0;
          const priceUSD = typeof t.priceUSD === 'number' ? t.priceUSD : 0;
          const valueUSD = typeof t.valueUSD === 'number' ? t.valueUSD : (priceUSD * balanceNum);
          const verified = !!t.verified;
          const chain = (t.chain || 'eth').toLowerCase();

          return {
            symbol,
            name,
            address: addressLower,
            decimals,
            balance: balanceStr,
            priceUSD,
            valueUSD,
            verified,
            hasNoPriceData: priceUSD === 0,
            chain
          };
        }).filter((t: any) => t.symbol && (t.address || t.chain));

        const ethOnly = normalized.filter((t: any) => ((t.chain || 'eth') === 'eth'));

        for (const tok of ethOnly) {
          if (tok.priceUSD === 0 && tok.symbol) {
            const isWhitelisted = !!ETHEREUM_TOKEN_WHITELIST[(tok.address || '').toLowerCase()];
            const isMajor = WalletAPI.isMajorToken(tok.symbol);
            if (!isWhitelisted && !isMajor) {
              continue;
            }
            try {
              const p = await this.getTokenPrice(tok.symbol, tok.address);
              if (typeof p === 'number' && p > 0) {
                const balNum = parseFloat(tok.balance || '0') || 0;
                tok.priceUSD = p;
                tok.valueUSD = p * balNum;
                tok.hasNoPriceData = false;
              }
            } catch {}
          }
        }

        const result = ethOnly.sort((a: any, b: any) => (b.valueUSD || 0) - (a.valueUSD || 0));
        return result;
      })();

      this.inflightPortfolioTokenReq.set(addrKey, task);
      
      try {
        // ⚡ RELIABLE: Wait for full aggregation instead of racing against fallback
        // The user prefers completeness over speed for the overview
        const res = await task;
        this.inflightPortfolioTokenReq.delete(addrKey);
        this.portfolioTokenCache.set(addrKey, { data: res, ts: Date.now() });
        return res;
      } catch {
        this.inflightPortfolioTokenReq.delete(addrKey);
        return await this.getAllTokens(address);
      }
    } catch {
      return await this.getAllTokens(address);
    }
  }

  static async getAllTokensZapper(address: string): Promise<any[]> {
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : WalletAPI.getBaseURL();
      const res = await fetch(`${origin}/api/zapper-proxy?addr=${address}&network=ethereum`, { headers: { 'Accept': 'application/json' } });
      if (!res.ok) return [];
      const json = await res.json();

      const out: any[] = [];
      if (Array.isArray(json?.tokens)) {
        for (const t of json.tokens) {
          const addr = (t.address || t.id || '').toLowerCase();
          if (!addr) continue;
          const wl = ETHEREUM_TOKEN_WHITELIST[addr];
          const sym = t.symbol || wl?.symbol || 'UNKNOWN';
          const name = t.name || wl?.name || sym;
          const decimals = t.decimals || wl?.decimals || 18;
          const amount = typeof t.balance === 'number' ? t.balance : parseFloat(t.balance || t.amount || '0');
          const price = typeof t.priceUSD === 'number' ? t.priceUSD : typeof t.price?.usd === 'number' ? t.price.usd : typeof t.price === 'number' ? t.price : 0;
          out.push({ symbol: sym, name, address: addr, decimals, balance: amount.toString(), priceUSD: price, valueUSD: price * amount, verified: !!wl, hasNoPriceData: price === 0, chain: 'eth' });
        }
      } else {
        const assets: any[] = Array.isArray(json?.assets) ? json.assets : Array.isArray(json?.data?.assets) ? json.data.assets : [];
        for (const a of assets) {
          const addr = (a.address || a.tokenAddress || a.tokens?.[0]?.address || '').toLowerCase();
          if (!addr) continue;
          const wl = ETHEREUM_TOKEN_WHITELIST[addr];
          const sym = a.symbol || a.tokens?.[0]?.symbol || wl?.symbol || 'UNKNOWN';
          const name = a.name || a.tokens?.[0]?.name || wl?.name || sym;
          const decimals = a.decimals || a.tokens?.[0]?.decimals || wl?.decimals || 18;
          const amountRaw = a.balance || a.tokens?.[0]?.balance || a.quantity || a.amount || 0;
          const amount = typeof amountRaw === 'number' ? amountRaw : parseFloat(amountRaw || '0');
          const priceRaw = a.priceUSD || a.price?.usd || a.price || 0;
          const price = typeof priceRaw === 'number' ? priceRaw : parseFloat(priceRaw || '0');
          out.push({ symbol: sym, name, address: addr, decimals, balance: amount.toString(), priceUSD: price, valueUSD: price * amount, verified: !!wl, hasNoPriceData: price === 0, chain: 'eth' });
        }
        if (out.length === 0 && json?.products) {
          const products = Object.values(json.products) as any[];
          for (const p of products) {
            if (!Array.isArray(p)) continue;
            for (const a of p) {
              const addr = (a.address || a.tokens?.[0]?.address || '').toLowerCase();
              if (!addr) continue;
              const wl = ETHEREUM_TOKEN_WHITELIST[addr];
              const sym = a.symbol || a.tokens?.[0]?.symbol || wl?.symbol || 'UNKNOWN';
              const name = a.name || a.tokens?.[0]?.name || wl?.name || sym;
              const decimals = a.decimals || a.tokens?.[0]?.decimals || wl?.decimals || 18;
              const amountRaw = a.balance || a.tokens?.[0]?.balance || a.quantity || a.amount || 0;
              const amount = typeof amountRaw === 'number' ? amountRaw : parseFloat(amountRaw || '0');
              const priceRaw = a.priceUSD || a.price?.usd || a.price || 0;
              const price = typeof priceRaw === 'number' ? priceRaw : parseFloat(priceRaw || '0');
              out.push({ symbol: sym, name, address: addr, decimals, balance: amount.toString(), priceUSD: price, valueUSD: price * amount, verified: !!wl, hasNoPriceData: price === 0, chain: 'eth' });
            }
          }
        }
      }

      const unique = new Map<string, any>();
      for (const tok of out) {
        const key = tok.address ? tok.address.toLowerCase() : `${(tok.symbol || 'unknown').toLowerCase()}_eth`;
        if (!unique.has(key)) unique.set(key, tok);
      }

      const list = Array.from(unique.values());
      const needPricing = list.filter(t => (typeof t.priceUSD !== 'number' || t.priceUSD === 0) && t.address).map(t => t.address.toLowerCase())
      if (needPricing.length > 0) {
        const priceMap = await priceCache.fetchTokenPricesByAddress(needPricing)
        for (const tok of list) {
          const addr = tok.address?.toLowerCase()
          if (addr && (typeof tok.priceUSD !== 'number' || tok.priceUSD === 0)) {
            const p = priceMap[addr]
            if (typeof p === 'number' && p > 0) {
              tok.priceUSD = p
              tok.valueUSD = p * parseFloat(tok.balance || '0')
              tok.hasNoPriceData = false
            }
          }
        }
      }
      return list
    } catch {
      return [];
    }
  }

  static async getAllTokensCovalent(address: string): Promise<any[]> {
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : WalletAPI.getBaseURL();
      const res = await fetch(`${origin}/api/covalent-proxy?chainid=1&addr=${address}`, { headers: { 'Accept': 'application/json' } });
      if (!res.ok) return [];
      const json = await res.json();
      const items: any[] = Array.isArray(json?.tokens) ? json.tokens : Array.isArray(json?.data?.items) ? json.data.items : [];
      const out: any[] = [];
      for (const it of items) {
        const addr = (it.contract_address || it.address || '').toLowerCase();
        if (!addr) continue;
        const wl = ETHEREUM_TOKEN_WHITELIST[addr];
        const sym = it.contract_ticker_symbol || it.symbol || wl?.symbol || 'UNKNOWN';
        const name = it.contract_name || it.name || wl?.name || sym;
        const decimals = it.contract_decimals || it.decimals || wl?.decimals || 18;
        const balStr = typeof it.balance === 'string' ? it.balance : (it.balance || '0').toString();
        let amount = 0;
        try {
          const num = BigInt(balStr);
          const denom = BigInt(Math.pow(10, decimals));
          amount = Number(num) / Number(denom);
        } catch {
          amount = parseFloat(it.balance || '0') / Math.pow(10, decimals);
        }
        const price = typeof it.quote_rate === 'number' ? it.quote_rate : 0;
        out.push({ symbol: sym, name, address: addr, decimals, balance: amount.toString(), priceUSD: price, valueUSD: price * amount, verified: !!wl, hasNoPriceData: price === 0, chain: 'eth' });
      }

      const unique = new Map<string, any>();
      for (const tok of out) {
        const key = tok.address ? tok.address.toLowerCase() : `${(tok.symbol || 'unknown').toLowerCase()}_eth`;
        if (!unique.has(key)) unique.set(key, tok);
      }

      const list = Array.from(unique.values());
      const needPricing = list.filter(t => (typeof t.priceUSD !== 'number' || t.priceUSD === 0) && t.address).map(t => t.address.toLowerCase())
      if (needPricing.length > 0) {
        const priceMap = await priceCache.fetchTokenPricesByAddress(needPricing)
        for (const tok of list) {
          const addr = tok.address?.toLowerCase()
          if (addr && (typeof tok.priceUSD !== 'number' || tok.priceUSD === 0)) {
            const p = priceMap[addr]
            if (typeof p === 'number' && p > 0) {
              tok.priceUSD = p
              tok.valueUSD = p * parseFloat(tok.balance || '0')
              tok.hasNoPriceData = false
            }
          }
        }
      }
      return list
    } catch {
      return [];
    }
  }

  // ⚡ ULTRA-FAST: Minimal token fetch for emergencies
  static async fetchTopTokensOnlyFast(address: string): Promise<any[]> {
    console.log('⚡ ULTRA-FAST: Using minimal token fetch method...');

    try {
      const HAS_ALCHEMY = !!process.env.ALCHEMY_API_KEY;
      if (!HAS_ALCHEMY) {
        const cov = await this.getAllTokensCovalent(address);
        if (Array.isArray(cov) && cov.length > 0) return cov;
      }

      // Return a comprehensive set of common tokens with basic balance checking
      const commonTokens = [
        // Top stablecoins
        { symbol: 'USDC', address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', decimals: 6 },
        { symbol: 'USDT', address: '0xdac17f958d2ee523a2206206994597c13d831ec7', decimals: 6 },
        { symbol: 'DAI', address: '0x6b175474e89094c44da98b954eedeac495271d0f', decimals: 18 },
        { symbol: 'TUSD', address: '0x0000000000085d4780B73119b644AE5ecd22b376', decimals: 18 },
        { symbol: 'BUSD', address: '0x4Fabb145d64652a948d72533023f6E7A623C7C53', decimals: 18 },

        // Major tokens
        { symbol: 'WETH', address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', decimals: 18 },
        { symbol: 'WBTC', address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', decimals: 8 },
        { symbol: 'LINK', address: '0x514910771af9ca656af840dff83e8264ecf986ca', decimals: 18 },
        { symbol: 'UNI', address: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984', decimals: 18 },
        { symbol: 'AAVE', address: '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9', decimals: 18 },
        { symbol: 'MKR', address: '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2', decimals: 18 },
        { symbol: 'COMP', address: '0xc00e94cb662c3520282e6f5717214004a7f26888', decimals: 18 },

        // DeFi tokens
        { symbol: 'CRV', address: '0xd533a949740bb3306d119cc777fa900ba034cd52', decimals: 18 },
        { symbol: 'SUSHI', address: '0x6b3595068778dd592e39a122f4f5a5cf09c90fe2', decimals: 18 },
        { symbol: 'LDO', address: '0x5a98fcbea516cf06857215779fd812ca3bef1b32', decimals: 18 },
        { symbol: 'SNX', address: '0xc011a73ee8576ffb0ed3d652a66c32b4ec4d8da8', decimals: 18 },
        { symbol: '1INCH', address: '0x111111111117dc0aa78b770fa6a738034120c302', decimals: 18 },
        { symbol: 'BAL', address: '0xba100000625a3754423978a60c9317c58a424e3d', decimals: 18 },

        // Popular gaming/meme tokens
        { symbol: 'SHIB', address: '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce', decimals: 18 },
        { symbol: 'MANA', address: '0x0f5d2fb29fb7d3cfee444a200298f468908cc942', decimals: 18 },
        { symbol: 'SAND', address: '0x3845badade8e6dff049820680d1f14bd3903a5d0', decimals: 18 },
        { symbol: 'GRT', address: '0xc944e90c64b2c07662a292be6244bdf05cda44a7', decimals: 18 },
        { symbol: 'ENJ', address: '0xf629cbd94d3791c9250152bd8dfbdf380e2a3b9c', decimals: 18 },
        { symbol: 'AXS', address: '0xbb0e17ef65f82ab018d8edd776e8dd940327b28b', decimals: 18 },
        { symbol: 'PEPE', address: '0x6982508145454ce325ddbe47a25d4ec3d2311933', decimals: 18 },
        { symbol: 'HEX', address: '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39', decimals: 8 }
      ];

    const { batchBalanceOf } = await import('../eth/multicall');
    const balanceMap = await batchBalanceOf(address, commonTokens.map(t => ({ address: t.address, decimals: t.decimals })));
    const tokenPromises = commonTokens.map(async (token) => {
      const balStr = balanceMap[token.address.toLowerCase()] || '0'
      if (parseFloat(balStr) > 0) {
          // Fetch price for this token with better error handling
          let priceUSD = 0;
          try {
            priceUSD = await this.getTokenPrice(token.symbol, token.address);
          } catch (priceError) {
            console.warn(`⚠️ FAST Price fetch failed for ${token.symbol}, using 0:`, priceError instanceof Error ? priceError.message : 'Unknown error');
            priceUSD = 0;
          }

          const valueUSD = priceUSD * parseFloat(balStr);

          console.log(`💰 FAST-${token.symbol} balance: ${balStr}, price: $${priceUSD.toFixed(4)}, value: $${valueUSD.toFixed(2)}`);

          return {
            symbol: token.symbol,
            address: token.address,
            name: token.symbol,
            balance: balStr,
            priceUSD: priceUSD,
            valueUSD: valueUSD,
            hasNoPriceData: priceUSD === 0,
            verified: true,
            decimals: token.decimals,
            dataSource: 'multicall_fast'
          }
      }
      return null
    });

    const tokens = (await Promise.all(tokenPromises)).filter(Boolean) as any[]

      console.log(`⚡ ULTRA-FAST: Found ${tokens.length} common tokens`);
      console.log(`📋 FAST-TOKEN DEBUG: Fallback tokens:`, tokens.map(t => ({
        symbol: t.symbol,
        balance: t.balance,
        priceUSD: t.priceUSD,
        valueUSD: t.valueUSD
      })));
      if (!tokens || tokens.length === 0) {
        try {
          const covalentFallback = await this.getAllTokensCovalent(address);
          if (Array.isArray(covalentFallback) && covalentFallback.length > 0) {
            console.log(`⚡ ULTRA-FAST: Using Covalent fallback with ${covalentFallback.length} tokens`);
            return covalentFallback;
          }
        } catch {}
      }

      return tokens;

    } catch (error) {
      console.warn('⚡ ULTRA-FAST: Even minimal fetch failed:', error);
      return [];
    }
  }

  // DEPRECATED: Old getAllTokens method - replaced by new batch processing system
  // static async getAllTokens_old(address: string): Promise<any[]> {
  // try {
  //   const ETHERSCAN_API_KEY = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY ||
  //                             process.env.ETHERSCAN_API_KEY ||
  //                             'VMUSQTMBBDUWZJ4VG2FCMAFCMBMRXYSGGH';

      // OLD METHOD REMOVED - This entire section has been replaced by the new batch processing system above
    // The old method was causing timeout errors and has been deprecated
    // console.log('🔧 Using reliable token discovery approach (same as fetchTopTokensOnly)...');
    // let allTransactions: any[] = [];
    // let page = 1;
    // const maxPages = 3; // Use same limit as fetchTopTokensOnly for consistency
    // let hasMoreData = true;

      // while (hasMoreData && page <= maxPages) {
      //   // try {
      //   //   console.log(`📜 Fetching token transactions page ${page}...`);
      //   const txResponse = await fetch(
      //     `https://api.etherscan.io/v2/api?chainid=1&module=account&action=tokentx&address=${address}&page=${page}&offset=200&sort=desc&apikey=${ETHERSCAN_API_KEY}`,
      //     {
      //       headers: { 'Accept': 'application/json' },
      //       signal: AbortSignal.timeout(8000) // Same timeout as fetchTopTokensOnly
      //     }
      //   );

      //   if (!txResponse.ok) {
      //     console.warn(`Failed to fetch page ${page}:`, txResponse.status);
      //     break;
      //   }

      //   const txData = await txResponse.json();

      //   if (txData.status !== '1' || !txData.result || !Array.isArray(txData.result)) {
      //     console.log(`No more data on page ${page}`);
      //     hasMoreData = false;
      //     break;
      //   }

      //   const pageTransactions = txData.result;
      //   allTransactions = allTransactions.concat(pageTransactions);

      //   if (pageTransactions.length < 200) {
      //     hasMoreData = false;
      //   }

      //   page++;
      // } catch (error) {
      //   console.warn(`Error fetching page ${page}:`, error);
      //   break;
      // }
      // }

      // console.log(`🔧 Found ${allTransactions.length} total transactions across ${page - 1} pages`);

      // if (allTransactions.length === 0) {
      //   console.warn('No token transactions found');
      //   return [];
      // }

      // // Step 2: Extract unique token contracts from transactions (same as fetchTopTokensOnly)
      // const tokenContracts = new Map<string, any>();
      // allTransactions.forEach((tx: any) => {
      //   if (tx.contractAddress && !tokenContracts.has(tx.contractAddress)) {
      //     tokenContracts.set(tx.contractAddress, {
      //       address: tx.contractAddress,
      //       symbol: tx.tokenSymbol,
      //       name: tx.tokenName,
      //       decimals: parseInt(tx.tokenDecimal) || 18
      //     });
      //   }
      // });

      // console.log(`🔧 Found ${tokenContracts.size} unique token contracts`);

      // // Step 3: Fetch current balances for each token contract (smart filtering)
      // console.log(`🔧 Starting balance fetch for ${tokenContracts.size} token contracts...`);

      // // 🛡️ SMART FILTERING: Prioritize tokens more likely to have balances
      // const prioritizedTokens = Array.from(tokenContracts.entries()).sort(([addrA, tokenA], [addrB, tokenB]) => {
      //   // Major tokens first
      //   const isMajorA = this.isMajorToken(tokenA.symbol);
      //   const isMajorB = this.isMajorToken(tokenB.symbol);
      //   if (isMajorA !== isMajorB) return isMajorB - isMajorA;

      //   // Then by transaction recency (recent transactions more likely to have balances)
      //   return 0; // Keep original order for now
      // });

      // const tokenPromises = prioritizedTokens.map(async ([tokenAddress, token], index) => {
        // try {
          // // 🛡️ COMPREHENSIVE BALANCE FETCHING: Multi-source with validation
          // let balanceData = null;
          // let dataSource = 'unknown';
          // // const fetchAttempts = [];

          // // SOURCE 1: Etherscan V1 (primary)
          // try {
          //   const response = await fetch(
          //     `https://api.etherscan.io/api?module=account&action=tokenbalance&contractaddress=${tokenAddress}&address=${address}&tag=latest&apikey=${ETHERSCAN_API_KEY}`,
          //     {
          //       headers: { 'Accept': 'application/json' },
          //       signal: AbortSignal.timeout(5000)
          //     }
          //   );

          //   if (response.ok) {
          //     const data = await response.json();
          //     if (data.status === '1' && data.result) {
          //       balanceData = data;
          //       dataSource = 'etherscan_v1';
          //       fetchAttempts.push({ source: 'etherscan_v1', success: true, result: data.result });
          //       console.log(`🛡️ PRIMARY SUCCESS (${token.symbol}): Etherscan V1 - ${data.result}`);
          //     } else {
          //       fetchAttempts.push({ source: 'etherscan_v1', success: false, error: data.message });
          //     }
          //   } else {
          //     fetchAttempts.push({ source: 'etherscan_v1', success: false, error: `HTTP ${response.status}` });
          //   }
          // } catch (error) {
          //   fetchAttempts.push({ source: 'etherscan_v1', success: false, error: error.message });
          //   console.warn(`🛡️ PRIMARY FAILED (${token.symbol}): Etherscan V1 -`, error);
          // }

          // // SOURCE 2: Etherscan V2 (backup)
          // if (!balanceData) {
          //   try {
          //     const response = await fetch(
          //       `https://api.etherscan.io/v2/api?chainid=1&module=account&action=tokenbalance&contractaddress=${tokenAddress}&address=${address}&tag=latest&apikey=${ETHERSCAN_API_KEY}`,
          //       {
          //         headers: { 'Accept': 'application/json' },
          //         signal: AbortSignal.timeout(5000)
          //       }
          //     );

          //     if (response.ok) {
          //       const data = await response.json();
          //       if (data.status === '1' && data.result) {
          //         balanceData = data;
          //         dataSource = 'etherscan_v2';
          //         fetchAttempts.push({ source: 'etherscan_v2', success: true, result: data.result });
          //         console.log(`🛡️ BACKUP SUCCESS (${token.symbol}): Etherscan V2 - ${data.result}`);
          //       } else {
          //         fetchAttempts.push({ source: 'etherscan_v2', success: false, error: data.message });
          //       }
          //     } else {
          //       fetchAttempts.push({ source: 'etherscan_v2', success: false, error: `HTTP ${response.status}` });
          //     }
          //   } catch (error) {
          //     fetchAttempts.push({ source: 'etherscan_v2', success: false, error: error.message });
          //     console.warn(`🛡️ BACKUP FAILED (${token.symbol}): Etherscan V2 -`, error);
          //   }
          // }

          // // SOURCE 3: DeBank API (alternative source for major tokens)
          // if (!balanceData && this.isMajorToken(token.symbol)) {
          //   try {
          //     const response = await fetch(
          //       `https://openapi.debank.com/v1/user/token_list?id=${address}`,
          //       {
          //         headers: { 'Accept': 'application/json' },
          //         signal: AbortSignal.timeout(8000)
          //       }
          //     );

          //     if (response.ok) {
          //       const data = await response.json();
          //       const tokenInfo = data.find((t: any) =>
          //         t.id.toLowerCase() === tokenAddress.toLowerCase() ||
          //         t.symbol === token.symbol
          //       );

          //       if (tokenInfo && tokenInfo.amount) {
          //         // Convert to wei format for consistency
          //         const rawBalance = parseFloat(tokenInfo.amount) * Math.pow(10, tokenInfo.decimals || 18);
          //         balanceData = {
          //           status: '1',
          //           result: Math.floor(rawBalance).toString()
          //         };
          //         dataSource = 'debank';
          //         fetchAttempts.push({ source: 'debank', success: true, result: balanceData.result });
          //         console.log(`🛡️ ALTERNATIVE SUCCESS (${token.symbol}): DeBank - ${balanceData.result}`);
          //       } else {
          //         fetchAttempts.push({ source: 'debank', success: false, error: 'Token not found' });
          //       }
          //     } else {
          //       fetchAttempts.push({ source: 'debank', success: false, error: `HTTP ${response.status}` });
          //     }
          //   } catch (error) {
          //     fetchAttempts.push({ source: 'debank', success: false, error: error.message });
          //     console.warn(`🛡️ ALTERNATIVE FAILED (${token.symbol}): DeBank -`, error);
          //   }
          // }

          // // SOURCE 4: Zapper API (for DeFi tokens)
          // if (!balanceData && this.isDeFiToken(token.symbol)) {
          //   try {
          //     const response = await fetch(
          //       `https://api.zapper.fi/v2/balances/${address}`,
          //       {
          //         headers: { 'Accept': 'application/json' },
          //         signal: AbortSignal.timeout(8000)
          //       }
          //     );

          //     if (response.ok) {
          //       const data = await response.json();
          //       // Find token in Zapper response (complex structure)
          //       const tokenBalance = this.findTokenInZapperResponse(data, tokenAddress, token.symbol);
          //       if (tokenBalance) {
          //         const rawBalance = parseFloat(tokenBalance) * Math.pow(10, decimals);
          //         balanceData = {
          //           status: '1',
          //           result: Math.floor(rawBalance).toString()
          //         };
          //         dataSource = 'zapper';
          //         fetchAttempts.push({ source: 'zapper', success: true, result: balanceData.result });
          //         console.log(`🛡️ DEFI SUCCESS (${token.symbol}): Zapper - ${balanceData.result}`);
          //       } else {
          //         fetchAttempts.push({ source: 'zapper', success: false, error: 'Token not found' });
          //       }
          //     } else {
          //       fetchAttempts.push({ source: 'zapper', success: false, error: `HTTP ${response.status}` });
          //     }
          //   } catch (error) {
          //     fetchAttempts.push({ source: 'zapper', success: false, error: error.message });
          //     console.warn(`🛡️ DEFI FAILED (${token.symbol}): Zapper -`, error);
          //   }
          // }

          // // Log all attempts for debugging
          // console.log(`🛡️ BALANCE FETCH SUMMARY (${token.symbol}):`, {
          //   dataSource,
          //   attempts: fetchAttempts,
          //   finalResult: balanceData?.result || 'null'
          // });

          // if (!balanceData) {
          //   console.warn(`⚠️ ALL SOURCES FAILED (${token.symbol}): Could not fetch balance - likely zero balance or invalid token`);

          //   // 🛡️ GRACEFUL HANDLING: Don't fail completely, assume zero balance
          //   // This prevents the entire operation from failing due to tokens with no balance
          //   return {
          //     ...token,
          //     balance: "0",
          //     valueUSD: 0,
          //     verified: false,
          //     hasNoPriceData: false,
          //     dataSource: 'fallback_zero',
          //     lastUpdated: Date.now(),
          //     balanceValidation: {
          //       isSuspiciouslyLarge: false,
          //       isSuspiciouslySmall: false,
          //       decimals: token.decimals,
          //       rawBalance: 0,
          //       fallbackUsed: true
          //     },
          //     fetchAttempts
          //   };
          // }

          // const balanceResponse = { ok: true, json: async () => balanceData } as any;

          // if (!balanceResponse.ok) {
          //   console.warn(`Failed to fetch balance for ${token.symbol}:`, balanceResponse.status);
          //   return null;
          // }

          // const balanceDataResult = await balanceResponse.json();

          // // 🔍 DETAILED DEBUG: Log complete API response
          // console.log(`🔍 API Response for ${token.symbol}:`, {
          //   status: balanceDataResult.status,
          //   message: balanceDataResult.message,
          //   result: balanceDataResult.result,
          //   resultType: typeof balanceDataResult.result,
          //   resultLength: balanceDataResult.result ? balanceDataResult.result.toString().length : 0
          // });

          // if (balanceDataResult.status !== '1') {
          //   console.warn(`Invalid balance response for ${token.symbol}:`, balanceDataResult.message);
          //   return null;
          // }

          // const rawBalance = parseInt(balanceDataResult.result) || 0;
          // let decimals = token.decimals;

          // // 🔍 DECIMAL VALIDATION: Common decimals for known tokens
          // const knownDecimals: { [key: string]: number } = {
          //   'USDC': 6,
          //   'USDT': 6,
          //   'WBTC': 8,
          //   'WETH': 18,
          //   'SHIB': 18,
          //   'UNI': 18,
          //   'LINK': 18,
          //   'AAVE': 18,
          //   'DAI': 18,
          //   'DOGE': 8,
          //   'MATIC': 18,
          //   'AVAX': 18,
          //   'SOL': 9, // Wrapped SOL
          //   'ADA': 6 // Wrapped ADA
          // };

          // // Use known decimals if available, otherwise use transaction data
          // if (knownDecimals[token.symbol]) {
          //   decimals = knownDecimals[token.symbol];
          //   console.log(`🔍 Using known decimals for ${token.symbol}: ${decimals}`);
          // } else {
          //   console.log(`🔍 Using transaction decimals for ${token.symbol}: ${decimals}`);
          // }

          // const balance = rawBalance / Math.pow(10, decimals);

          // // 🔍 SANITY CHECK: Catch obviously wrong balances
          // const isSuspiciouslyLarge = balance > 1e15; // More than 1 quadrillion tokens
          // const isSuspiciouslySmall = balance > 0 && balance < 1e-18; // Very small but non-zero

          // if (isSuspiciouslyLarge) {
          //   console.warn(`🚨 SUSPICIOUSLY LARGE BALANCE for ${token.symbol}: ${balance} - This might indicate a decimal error!`);
          // }
          // if (isSuspiciouslySmall) {
          //   console.warn(`🚨 SUSPICIOUSLY SMALL BALANCE for ${token.symbol}: ${balance} - This might indicate a decimal error!`);
          // }

          // console.log(`💰 ${token.symbol} BALANCE CALCULATION:`, {
          //   tokenAddress: tokenAddress,
          //   walletAddress: address,
          //   rawBalance: rawBalance,
          //   rawBalanceString: balanceDataResult.result,
          //   decimals: decimals,
          //   calculatedBalance: balance,
          //   balanceString: balance.toString(),
          //   isSuspiciouslyLarge,
          //   isSuspiciouslySmall,
          //   dataSource,
          //   fetchAttempts
          // });

          // // Only include tokens with some balance (even very small amounts for comprehensive analysis)
          // if (balance <= 0) {
          //   return null;
          // }

          // return {
          //   ...token,
          //   balance: balance.toString(),
          //   valueUSD: 0, // Will be calculated later
          //   verified: false, // Will be updated if verification info available
          //   hasNoPriceData: false,
          //   // 🛡️ DATA PROVENANCE: Track data source for debugging
          //   dataSource,
          //   fetchAttempts,
          //   lastUpdated: Date.now(),
          //   balanceValidation: {
          //     isSuspiciouslyLarge,
          //     isSuspiciouslySmall,
          //     decimals: decimals,
          //     rawBalance: rawBalance
          //   }
          // };
        // } catch (error) {
        //   console.warn(`Error fetching balance for ${token.symbol}:`, error);
        //   return null;
        // }
      // });

      // // 🛡️ BATCH PROCESSING: Process tokens in batches to avoid overwhelming APIs
      // const batchSize = 20; // Process 20 tokens at a time
      // const validTokens = [];

      // for (let i = 0; i < prioritizedTokens.length; i += batchSize) {
      //   const batch = prioritizedTokens.slice(i, i + batchSize);
      //   console.log(`🛡️ Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(prioritizedTokens.length/batchSize)} (${batch.length} tokens)`);

      //   const batchPromises = batch.map(([tokenAddress, token], index) => {
      //     return {
      //       tokenAddress,
      //       originalToken: token,
      //       promise: this.fetchSingleTokenBalance(tokenAddress, address, token, cacheManager)
      //     };
      //   });

      //   const batchResults = await Promise.allSettled(batchPromises);

      //   // Process results from this batch
      //   for (const { tokenAddress, originalToken, promise } of batchResults) {
      //     if (promise.status === 'fulfilled' && promise.value !== null) {
      //       const balanceResult = promise.value;

      //       // Convert balance result back to token format
      //       const enhancedToken = {
      //         ...originalToken,
      //         balance: balanceResult.balance,
      //         valueUSD: 0, // Will be calculated later
      //         verified: false, // Will be updated if verification info available
      //         hasNoPriceData: false,
      //         // 🛡️ DATA PROVENANCE: Track data source for debugging
      //         dataSource: balanceResult.source,
      //         lastUpdated: Date.now(),
      //         balanceValidation: {
      //           isSuspiciouslyLarge: parseFloat(balanceResult.balance) > 1e15,
      //           isSuspiciouslySmall: parseFloat(balanceResult.balance) > 0 && parseFloat(balanceResult.balance) < 1e-18,
      //           decimals: originalToken.decimals,
      //           rawBalance: parseFloat(balanceResult.balance) * Math.pow(10, originalToken.decimals)
      //         }
      //       };

      //       validTokens.push(enhancedToken);
      //     } else if (promise.status === 'rejected') {
      //       console.warn(`❌ Batch processing failed for token:`, promise.reason);
      //     }
      //   }

      //   // Small delay between batches to be respectful to APIs
      //   if (i + batchSize < prioritizedTokens.length) {
      //     await new Promise(resolve => setTimeout(resolve, 100));
      //   }
      // }

      // console.log(`🛡️ BATCH PROCESSING COMPLETE: ${validTokens.length} tokens with positive balances found (processed ${prioritizedTokens.length} total)`);

      // // Log suspicious tokens found
      // const suspiciousTokens = validTokens.filter(token => token.isSuspicious);
      // if (suspiciousTokens.length > 0) {
      //   console.log(`⚠️ Found ${suspiciousTokens.length} suspicious tokens:`, suspiciousTokens.map(t => t.symbol));
      // }

      // return validTokens;

    // } catch (error) {
    //   console.error('Failed to fetch all tokens:', error);
    //   return [];
    // }
  // }


  // Legacy method for backward compatibility
  static async fetchERC20Tokens(address: string): Promise<any[]> {
    console.log('⚠️ fetchERC20Tokens called - redirecting to fetchTopTokensOnly for backward compatibility');
    return this.fetchTopTokensOnly(address);
  }

  static async detectWhaleMovements(transactions: any[], minValueUSD: number = 20000): Promise<any[]> {
    try {
      console.log('🐋 Analyzing whale movements from', transactions.length, 'transactions');

      const whaleMovements = transactions
        .filter(tx => tx.valueUSD && tx.valueUSD > minValueUSD)
        .map(tx => ({
          id: tx.hash || `whale_${tx.timestamp}_${tx.from}`,
          hash: tx.hash,
          tokenSymbol: tx.tokenSymbol || 'ETH',
          value: tx.value || '0',
          valueUSD: tx.valueUSD,
          from: tx.from,
          to: tx.to,
          timestamp: tx.timestamp,
          movementType: this.classifyMovement(tx),
          confidence: Math.min(95, 60 + (tx.valueUSD / 100000)), // Confidence based on value
          impactScore: Math.min(100, tx.valueUSD / 50000), // Impact score based on USD value
          reasoning: this.generateWhaleReasoning(tx),
          exchangeName: undefined, // Would be determined by checking exchange addresses
          enhancedData: {
            isWhaleWallet: tx.valueUSD > 5000000, // Simple heuristic
            whaleScore: Math.min(100, tx.valueUSD / 100000),
            hasHistory: false, // Would require additional analysis
            relatedTransactions: 1 // This transaction itself
          },
          dataSource: 'alchemy' as const
        }))
        .sort((a, b) => b.valueUSD - a.valueUSD)
        .slice(0, 50); // Top 50 movements

      console.log(`🐋 Found ${whaleMovements.length} whale movements`);
      return whaleMovements;

    } catch (error) {
      console.error('Failed to detect whale movements:', error);
      return [];
    }
  }

  private static classifyMovement(tx: any): 'deposit' | 'withdrawal' | 'transfer' | 'defi_interaction' {
    const from = tx.from?.toLowerCase() || '';
    const to = tx.to?.toLowerCase() || '';

    // Simple classification - in a real implementation, you'd check exchange addresses
    if (from.startsWith('0x') && to.startsWith('0x')) {
      if (tx.valueUSD > 5000000) return 'transfer';
      return 'transfer';
    }

    // For now, default to 'transfer' - in a real implementation, you'd check exchange addresses
    // to determine if it's a deposit/withdrawal or defi interaction
    return 'transfer';
  }

  private static generateWhaleReasoning(tx: any): string[] {
    const value = tx.valueUSD || 0;
    if (value > 10000000) {
      return ['Massive transfer indicating potential market impact or institutional movement'];
    } else if (value > 5000000) {
      return ['Large whale movement that could affect short-term price action'];
    } else {
      return ['Significant transfer worth monitoring for market impact'];
    }
  }

  static async fetchTransactions(address: string, page: number = 1, offset: number = 10): Promise<any[]> {
    const startTime = performance.now();
    try {
      console.log(`⚡ FAST TX: Starting optimized transaction fetch (page ${page}, offset ${offset})...`);

      // ⚡ CACHE CHECK: Check for cached transactions first (only for first page)
      const cacheKey = `transactions_${address}_page${page}`;
      const cached = this.getCache(cacheKey);
      if (cached && page === 1) {
        console.log('⚡ CACHE HIT: Using cached transaction data');
        return cached;
      }

      // ⚡ REAL ETH PRICE: Fetch actual price from CoinGecko
      const ethPrice = await this.fetchETHPrice();
      console.log('⚡ FAST TX: Using real ETH price:', ethPrice);

      const ETHERSCAN_API_KEY = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY ||
                                process.env.ETHERSCAN_API_KEY ||
                                'VMUSQTMBBDUWZJ4VG2FCMAFCMBMRXYSGGH';

      // ⚡ ULTRA-FAST: Fetch specified number of transactions
      const [normalTxResponse, tokenTxResponse] = await Promise.allSettled([
        fetch(
          `https://api.etherscan.io/v2/api?chainid=1&module=account&action=txlist&address=${address}&page=${page}&offset=${offset}&sort=desc&apikey=${ETHERSCAN_API_KEY}`,
          {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(2000) // 2 second timeout for even faster response
          }
        ),
        fetch(
          `https://api.etherscan.io/v2/api?chainid=1&module=account&action=tokentx&address=${address}&page=${page}&offset=${offset}&sort=desc&apikey=${ETHERSCAN_API_KEY}`,
          {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(2000) // 2 second timeout for even faster response
          }
        )
      ]);

      const allTransactions: any[] = [];

      // Process normal transactions (ETH) - check if Promise was fulfilled
      if (normalTxResponse.status === 'fulfilled' && normalTxResponse.value.ok) {
        try {
          const normalTxData = await normalTxResponse.value.json();
          if (normalTxData.result && Array.isArray(normalTxData.result)) {
            normalTxData.result.forEach((tx: any) => {
              const valueETH = parseFloat(tx.value) / Math.pow(10, 18);
              const valueUSD = valueETH * ethPrice;

              allTransactions.push({
                hash: tx.hash,
                timestamp: parseInt(tx.timeStamp),
                from: tx.from,
                to: tx.to || '',
                value: valueETH.toString(),
                valueUSD: Math.round(valueUSD * 100) / 100,
                gasUsed: tx.gasUsed,
                gasPrice: tx.gasPrice,
                status: tx.isError === '1' ? 'failed' : 'success',
                type: (tx.from?.toLowerCase() || '') === address.toLowerCase() ? 'sent' : 'received',
                tokenSymbol: 'ETH',
                tokenAddress: null
              });
            });
          }
        } catch (error) {
          console.warn('Failed to process normal transactions:', error);
        }
      }

      // Process token transactions - check if Promise was fulfilled
      if (tokenTxResponse.status === 'fulfilled' && tokenTxResponse.value.ok) {
        try {
          const tokenTxData = await tokenTxResponse.value.json();
          if (tokenTxData.result && Array.isArray(tokenTxData.result)) {
            // ⚡ SMART PRICING: Process token transactions with price caching
            const tokenTransactions = tokenTxData.result.slice(0, offset);

            // Collect unique tokens to fetch prices for
            const uniqueTokens = new Map<string, { symbol: string; address: string }>();
            tokenTransactions.forEach((tx: any) => {
              const key = tx.contractAddress?.toLowerCase() || tx.tokenSymbol?.toLowerCase();
              if (key && !uniqueTokens.has(key)) {
                uniqueTokens.set(key, {
                  symbol: tx.tokenSymbol,
                  address: tx.contractAddress
                });
              }
            });

            // Fetch prices for all unique tokens in parallel (but cached)
            const pricePromises = Array.from(uniqueTokens.entries()).map(async ([key, token]) => {
              const price = await this.getTokenPrice(token.symbol, token.address);
              return [key, price] as [string, number];
            });

            const resolvedPrices = await Promise.allSettled(pricePromises);
            const priceMap = new Map<string, number>();

            resolvedPrices.forEach((result) => {
              if (result.status === 'fulfilled') {
                const [key, price] = result.value;
                priceMap.set(key, price);
              }
            });

            // Process transactions with fetched prices (async-safe)
            const processedTxs = await Promise.all(tokenTransactions.map(async (tx: any) => {
              const decimals = parseInt(tx.tokenDecimal) || 18;
              const value = parseFloat(tx.value || '0') / Math.pow(10, decimals);

              const tokenKey = tx.contractAddress?.toLowerCase() || tx.tokenSymbol?.toLowerCase();
              const tokenPrice = priceMap.get(tokenKey) ?? await this.getTokenPrice(tx.tokenSymbol, tx.contractAddress);
              const valueUSD = value * tokenPrice;

              return {
                hash: tx.hash,
                timestamp: parseInt(tx.timeStamp),
                from: tx.from,
                to: tx.to,
                value: value.toString(),
                valueUSD: Math.round(valueUSD * 100) / 100,
                tokenSymbol: tx.tokenSymbol,
                tokenAddress: tx.contractAddress,
                type: (tx.from?.toLowerCase() || '') === address.toLowerCase() ? 'token_sent' : 'token_received',
                gasUsed: tx.gasUsed,
                gasPrice: tx.gasPrice,
                status: 'success',
                riskLevel: 'unknown'
              };
            }));

            allTransactions.push(...processedTxs);
          }
        } catch (error) {
          console.warn('Failed to process token transactions:', error);
        }
      }

      // Remove duplicate transactions by hash
      const uniqueTransactions = allTransactions.reduce((acc: any[], tx: any) => {
        const existingIndex = acc.findIndex((existing: any) => existing.hash === tx.hash);
        if (existingIndex === -1) {
          acc.push(tx);
        } else {
          // Merge information if needed
          const existing = acc[existingIndex];
          // Prefer the one that has more complete information
          if (tx.tokenAddress && !existing.tokenAddress) {
            acc[existingIndex] = tx;
          }
        }
        return acc;
      }, []);

      // Sort transactions by timestamp (newest first) and apply limits
      const sortedTransactions = uniqueTransactions.sort((a, b) => b.timestamp - a.timestamp);

      // ⚡ PAGINATION: Apply limit to return only requested number of transactions
      const limitedTransactions = sortedTransactions.slice(0, offset);

      // ⚡ CACHE: Store for 2 minutes (only first page)
      if (page === 1) {
        this.setCache(cacheKey, limitedTransactions, 2 * 60 * 1000);
      }

      console.log(`⚡ FAST TX: Processed ${limitedTransactions.length} transactions (limited from ${sortedTransactions.length} total) in ${performance.now() - startTime}ms`);

      // Add pagination metadata
      const hasMore = sortedTransactions.length > offset;
      console.log(`⚡ FAST TX: Has more transactions: ${hasMore} (${sortedTransactions.length} total, showing ${limitedTransactions.length})`);

      return limitedTransactions;

    } catch (error) {
      console.error('Failed to fetch transactions:', error);
      return [];
    }
  }

  // Comprehensive wallet analysis method with improved abort handling
  static async analyzeWallet(address: string, timeRange: string = '24h', signal?: AbortSignal, tokens?: any[]): Promise<any> {
    const controller = new AbortController();
    const finalSignal = signal || controller.signal;

    const attempt = async (attemptNum: number = 1) => {
      try {
        console.log(`🧠 Starting wallet analysis attempt ${attemptNum} for address: ${address?.slice(0, 8)}...`);

        // Use dynamic origin to avoid port mismatch issues
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
        const response = await fetch(`${baseUrl}/api/analyze-wallet`, {
          method: 'POST',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          keepalive: false, // Changed to false to avoid abort issues
          signal: finalSignal,
          body: JSON.stringify({ walletAddress: address, timeRange, tokens })
        });

        if (!response.ok) {
          return { success: false, error: `HTTP ${response.status}`, data: null };
        }

        const result = await response.json();
        console.log(`✅ Analysis complete attempt ${attemptNum}`);
        return result;

      } catch (err: any) {
        const isAbort = err?.name === 'AbortError' ||
                       /aborted/i.test(String(err.message)) ||
                       (signal && (signal as any)?.aborted) ||
                       (finalSignal && finalSignal.aborted);

        if (isAbort) {
          console.log(`⏹️ Analysis attempt ${attemptNum} aborted`);
          return { success: false, error: 'aborted', data: null };
        }

        console.warn(`❌ Analysis attempt ${attemptNum} failed:`, err?.message || err);
        throw err;
      }
    };

    try {
      // First attempt
      return await attempt(1);

    } catch (err: any) {
      console.log('🔄 Retrying wallet analysis after failure...');

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000));

      try {
        // Second attempt with fresh controller
        const retryController = new AbortController();
        return await attempt(2);

      } catch (retryErr: any) {
        console.warn('❌ All wallet analysis attempts failed:', retryErr?.message || retryErr);

        return {
          success: false,
          error: retryErr instanceof Error ? retryErr.message : 'Analysis failed after retries',
          data: null
        };
      }
    } finally {
      // Cleanup
      if (!signal) {
        controller.abort();
      }
  }
  }

/**
   * Fetch balance for a single token using multiple sources with graceful fallbacks
   * Used by batch processing to handle individual token balance fetching
   */
  async fetchSingleTokenBalance(
    tokenAddress: string, 
    address: string, 
    token: EnhancedToken, 
    cacheManager: CacheManager
  ): Promise<{
    balance: string;
    source: string;
    confidence: number;
  } | null> {
    console.log(`🔍 BALANCE FETCH: ${token.symbol} (${tokenAddress})`);
    
    // Check cache first for balance data (short TTL)
    const cacheKey = `token-balance-v4-${address}-${tokenAddress}`;
    const cachedBalance = cacheManager.get(cacheKey);
    if (cachedBalance && cachedBalance.timestamp && (Date.now() - cachedBalance.timestamp) < 30000) { // 30 seconds
      console.log(`✅ BALANCE CACHE HIT: ${token.symbol} - ${cachedBalance.balance}`);
      return {
        balance: cachedBalance.balance,
        source: 'cache',
        confidence: 0.95
      };
    }

    // Source: Etherscan V2
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXTAUTH_URL || `http://localhost:${process.env.PORT || 3000}`);
      const response = await fetch(
        `${origin}/api/etherscan-proxy?chainid=1&module=account&action=tokenbalance&contractaddress=${tokenAddress}&address=${address}&tag=latest`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.status === '1' && data.result && data.result !== '0') {
          const balance = (parseInt(data.result) / Math.pow(10, token.decimals)).toString();
          
          // Cache the result
          cacheManager.set(cacheKey, {
            balance,
            timestamp: Date.now(),
            source: 'etherscan-v2'
          });
          
          console.log(`✅ ETHERSCAN V2 SUCCESS: ${token.symbol} - ${balance}`);
          return {
            balance,
            source: 'etherscan-v2',
            confidence: 0.95
          };
      }
    }
    } catch (error) {
      console.log(`❌ Etherscan V2 failed for ${token.symbol}:`, error);
    }

    // Source 3: DeBank
    try {
      const debankResponse = await fetch(
        `https://openapi.debank.com/v1/token/token_list?addr=${address}`
      );
      
      if (debankResponse.ok) {
        const debankData = await debankResponse.json();
        const debankToken = debankData.find((t: any) => 
          t.id.toLowerCase() === tokenAddress.toLowerCase() && 
          t.amount && 
          parseFloat(t.amount) > 0
        );
        
        if (debankToken) {
          const balance = debankToken.amount;
          
          // Cache the result
          cacheManager.set(cacheKey, {
            balance,
            timestamp: Date.now(),
            source: 'debank'
          });
          
          console.log(`✅ DEBANK SUCCESS: ${token.symbol} - ${balance}`);
          return {
            balance,
            source: 'debank',
            confidence: 0.90
          };
        }
      }
    } catch (error) {
      console.log(`❌ DeBank failed for ${token.symbol}:`, error);
    }

    // Source 4: Zapper (for major tokens)
    if (WalletAPI.isMajorToken(token.symbol) || WalletAPI.isDeFiToken(token.symbol)) {
      try {
        // Get supported tokens from Zapper
        const tokensResponse = await fetch('https://api.zapper.xyz/v2/supported/tokens.json');
        if (tokensResponse.ok) {
          const supportedTokens = await tokensResponse.json();
          const ethTokens = supportedTokens['ethereum'] || [];
          const zapperToken = ethTokens.find((t: any) => t.address.toLowerCase() === tokenAddress.toLowerCase());
          
          if (zapperToken) {
            // Use Zapper's API for this token
            const zapResponse = await fetch(
              `https://api.zapper.xyz/v2/balances/tokens?addresses%5B%5D=${address}&api_key=${process.env.ZAPPER_API_KEY}`
            );
            
            if (zapResponse.ok) {
              const zapData = await zapResponse.json();
              const tokenBalance = WalletAPI.findTokenInZapperResponse(zapData, tokenAddress, token.symbol);
              
              if (tokenBalance && parseFloat(tokenBalance) > 0) {
                // Cache the result
                cacheManager.set(cacheKey, {
                  balance: tokenBalance,
                  timestamp: Date.now(),
                  source: 'zapper'
                });
                
                console.log(`✅ ZAPPER SUCCESS: ${token.symbol} - ${tokenBalance}`);
                return {
                  balance: tokenBalance,
                  source: 'zapper',
                  confidence: 0.85
                };
              }
            }
          }
        }
      } catch (error) {
        console.log(`❌ Zapper failed for ${token.symbol}:`, error);
      }
    }

    // All sources failed - record circuit breaker failure and return null
    console.log(`⚠️ ALL SOURCES FAILED: ${token.symbol} - treating as zero balance`);
    WalletAPI.circuitBreaker.recordFailure(); // Record failure for circuit breaker
    return null;
  }
}
