import { mergeHolding } from './holding-merge';
import { normalizeTokenDecimals, isEthereumAddress } from './request-validation';
import { priceCache } from './priceCache';
import { fetchPublicHistory } from './public-history';
import { WHITELIST_MAINNET, getWhitelistMeta } from '../config/tokenWhitelist';
export const ETHEREUM_TOKEN_WHITELIST: Record<string, { symbol: string; name: string; decimals: number }> = WHITELIST_MAINNET;

/** Expected, recoverable service absence. Consumers render this in the workspace. */
function observedValueUSD(amount: number, price: number): number | undefined {
  if (!Number.isFinite(amount) || !Number.isFinite(price) || price <= 0) return undefined;
  return Math.round(amount * price * 100) / 100;
}

function transferStatus(record: { isError?: string; status?: string }): 'failed' | 'pending' | 'success' {
  if (record.isError === '1' || record.status === 'error' || record.status === 'failed' || record.status === 'reverted') return 'failed';
  if (record.status === 'pending') return 'pending';
  return 'success';
}

export class HistoryUnavailableError extends Error {
  readonly code = 'HISTORY_UNAVAILABLE';
  readonly retryable = true;
  constructor() {
    super('Transaction history is temporarily unavailable. Try again shortly.');
    this.name = 'HistoryUnavailableError';
  }
}

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

  private static async fetchHistoryResponse(action: 'txlist' | 'tokentx', address: string, limit: number): Promise<Response> {
    const params = { chainid: '1', module: 'account', action, address, page: '1', offset: String(limit), sort: 'desc' };
    try {
      const response = await fetch(this.buildProxyUrl(params), {
        headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(30_000),
      });
      if (typeof window === 'undefined' || ![429, 502, 503, 504].includes(response.status)) return response;
    } catch (error) {
      if (typeof window === 'undefined') throw error;
    }
    // Public explorer limits can apply to a hosting provider's shared IP.
    // The same bounded, validated read can recover directly in the browser.
    // No provider credentials are sent to the browser or the public endpoint.
    return Response.json(await fetchPublicHistory(new URLSearchParams(params)));
  }

  private static getBaseURL(): string {
    // Browser reads must stay on the deployed origin, even if a build-time URL
    // is absent or still points at a local development server.
    if (typeof window !== 'undefined') return window.location.origin;
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
      if (sym === 'WETH' && getWhitelistMeta(contractAddress || '')?.symbol === 'WETH') {
        const eth = await priceCache.fetchETHPrice();
        return eth;
      }
      const price = await priceCache.fetchTokenPrice(symbol, contractAddress);
      console.log(`💰 Got price for ${symbol}: $${price}`);
      return price;
    } catch (error) {
      console.warn(`Failed to fetch price for ${symbol}, no reliable fallback used:`, error);
      return 0;
    }
  }

  // Synchronous version for immediate use (falls back to cached prices)
  private static estimateTokenPrice(symbol?: string, address?: string): number {
    if (!symbol) return 0;

    // Try to get cached price first (with address for better cache hit)
    const cachedPrice = priceCache.getCachedTokenPrice(symbol, address);
    if (cachedPrice !== null) {
      console.log(`✅ ${symbol}: Using cached price $${cachedPrice} (address: ${address?.slice(0, 8)}...)`);
      return cachedPrice;
    }

    const sym = symbol.toUpperCase();
    if (sym === 'WETH' && getWhitelistMeta(address || '')?.symbol === 'WETH') {
      const ethCached = priceCache.getCachedETHPrice();
      if (ethCached !== null) {
        return ethCached;
      }
    }

    console.log(`❌ ${symbol}: No cached price found (address: ${address?.slice(0, 8)}...) - using fallback`);

    return 0;
  }

  static async fetchETHBalance(address: string, signal?: AbortSignal): Promise<string> {
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) throw new Error('Invalid Ethereum address');
    signal?.throwIfAborted();
    const requestSignal = (milliseconds: number) => {
      const timeout = AbortSignal.timeout(milliseconds);
      return signal ? AbortSignal.any([signal, timeout]) : timeout;
    };
    const browser = typeof window !== 'undefined';
    const rpcSources = [
      // Allow the default three public providers to fail over at 6s each.
      { url: `${this.getBaseURL()}/api/rpc-proxy`, timeout: 20_000 },
      // Shared hosting IP rate limits can be recovered by a public browser read.
      // This endpoint is fixed and receives no provider credentials.
      ...(browser ? [{ url: 'https://ethereum.publicnode.com', timeout: 6_000 }] : []),
    ];
    for (const source of rpcSources) {
      signal?.throwIfAborted();
      try {
        const response = await fetch(source.url, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [address, 'latest'] }),
          signal: requestSignal(source.timeout),
        });
        if (response.ok) {
          const data = await response.json();
          signal?.throwIfAborted();
          if (!data.error && typeof data.result === 'string' && /^0x[0-9a-fA-F]+$/.test(data.result)) return BigInt(data.result).toString();
        }
      } catch { /* Continue only when the caller has not cancelled. */ }
      signal?.throwIfAborted();
    }
    try {
      const response = await fetch(this.buildProxyUrl({ chainid: '1', module: 'account', action: 'balance', address }), {
        // All attempts together stay within the portfolio's 35s boundary.
        headers: { Accept: 'application/json' }, signal: requestSignal(browser ? 6_000 : 12_000)
      });
      if (response.ok) {
        const data = await response.json();
        signal?.throwIfAborted();
        if (data.status === '1' && typeof data.result === 'string' && /^\d+$/.test(data.result)) return data.result;
      }
    } catch { /* All available balance sources failed. */ }
    signal?.throwIfAborted();
    throw new Error('ETH balance is unavailable. Try refreshing when providers recover.');
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
      if (key.startsWith(`transactions_${address.toLowerCase()}_`)) {
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

  // ⚡ OPTIMIZED: Fast token fetch with parallel processing and aggressive timeouts
  static async getAllTokens(address: string): Promise<any[]> {
    console.log('⚡ FAST-TOKENS: Getting ALL tokens with optimized parallel processing...');

    try {
      
      // NOTE: Removed Covalent short-circuit here because getAllTokens is used in parallel with getAllTokensCovalent
      // in getPortfolioTokens. We want this function to focus on Etherscan/Alchemy discovery.

      console.log('⚡ FAST-TOKENS: Fetching token contracts...');
      let allTransactions: any[] = [];

      try {
        const offset = 100;
        const maxPages = 3;
        const maxRecords = 300;
        const batchSize = 3;
        for (let start = 1; start <= maxPages; start += batchSize) {
          const end = Math.min(start + batchSize - 1, maxPages);
          const batchPromises = [] as Promise<number>[];
          for (let page = start; page <= end; page++) {
            const url = typeof window === 'undefined'
              ? this.buildProxyUrl({ chainid: '1', module: 'account', action: 'tokentx', address, page: String(page), offset: String(offset), sort: 'desc' })
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
          const reachedEnd = lengths.some(len => len > -1 && len < offset) || allTransactions.length >= maxRecords;
          if (reachedEnd) break;
          await new Promise(resolve => setTimeout(resolve, 150));
        }
        allTransactions = allTransactions.slice(0, maxRecords);
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
            decimals: wl ? wl.decimals : (normalizeTokenDecimals(tx.tokenDecimal)),
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
          const decimals = normalizeTokenDecimals(t.decimals ?? wl?.decimals);
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
          if (addr && (typeof tok.priceUSD !== 'number' || tok.priceUSD === 0)) {
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
        const decimals = normalizeTokenDecimals(t.decimals ?? wl?.decimals);
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
              merged.set(k, mergeHolding(merged.get(k), t));
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
          const decimals = normalizeTokenDecimals(t.decimals);
          const balanceStr = (typeof t.balance === 'string' || typeof t.balance === 'number') ? t.balance.toString() : '0';
          const parsedBalance = Number(balanceStr);
          const balanceNum = Number.isFinite(parsedBalance) && parsedBalance >= 0 ? parsedBalance : 0;
          const priceUSD = typeof t.priceUSD === 'number' && Number.isFinite(t.priceUSD) && t.priceUSD > 0 ? t.priceUSD : 0;
          const valueUSD = priceUSD * balanceNum;
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

        const ethOnly = normalized.filter((t: any) =>
          (t.chain || 'eth') === 'eth' && isEthereumAddress(t.address) &&
          !/^0x(0{40}|e{40})$/i.test(t.address)
        );

        for (const tok of ethOnly) {
          if (tok.priceUSD === 0 && tok.symbol) {
            const isWhitelisted = !!ETHEREUM_TOKEN_WHITELIST[(tok.address || '').toLowerCase()];
            if (!isWhitelisted) {
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
          const decimals = normalizeTokenDecimals(t.decimals ?? wl?.decimals);
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
          const decimals = normalizeTokenDecimals(a.decimals ?? a.tokens?.[0]?.decimals ?? wl?.decimals);
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
              const decimals = normalizeTokenDecimals(a.decimals ?? a.tokens?.[0]?.decimals ?? wl?.decimals);
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
        const decimals = normalizeTokenDecimals(it.contract_decimals ?? it.decimals ?? wl?.decimals);
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

  static async detectWhaleMovements(transactions: any[], minValueUSD: number = 20000): Promise<any[]> {
    try {
      console.log('🐋 Analyzing whale movements from', transactions.length, 'transactions');

      const whaleMovements = transactions
        .filter(tx => tx.status !== 'failed' && tx.status !== 'pending' && Number.isFinite(tx.valueUSD) && tx.valueUSD >= minValueUSD)
        .map(tx => ({
          id: tx.id || tx.hash || `whale_${tx.timestamp}_${tx.from}`,
          hash: tx.hash,
          tokenSymbol: tx.tokenSymbol || 'ETH',
          value: tx.value || '0',
          valueUSD: tx.valueUSD,
          from: tx.from,
          to: tx.to,
          timestamp: tx.timestamp,
          movementType: 'transfer' as const,
          dataSource: 'explorer' as const
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

  static async fetchTransactions(address: string, page: number = 1, offset: number = 10): Promise<any[]> {
    if (!/^0x[0-9a-fA-F]{40}$/.test(address) || !Number.isInteger(page) || page < 1 || !Number.isInteger(offset) || offset < 1 || page * offset > 1000) return [];
    const providerLimit = page * offset;
    const startTime = performance.now();
    try {
      console.log(`⚡ FAST TX: Starting optimized transaction fetch (page ${page}, offset ${offset})...`);

      // ⚡ CACHE CHECK: Check for cached transactions first (only for first page)
      const cacheKey = `transactions_${address.toLowerCase()}_page${page}_limit${offset}`;
      const cached = this.getCache(cacheKey);
      if (cached && page === 1) {
        console.log('⚡ CACHE HIT: Using cached transaction data');
        return cached;
      }

      // ⚡ REAL ETH PRICE: Fetch actual price from CoinGecko
      const ethPrice = await this.fetchETHPrice().catch(() => 0);
      console.log('⚡ FAST TX: Using real ETH price:', ethPrice);


      // ⚡ ULTRA-FAST: Fetch specified number of transactions
      const [normalTxResponse, tokenTxResponse] = await Promise.allSettled([
        this.fetchHistoryResponse('txlist', address, providerLimit),
        this.fetchHistoryResponse('tokentx', address, providerLimit),
      ]);

      const allTransactions: any[] = [];
      let successfulSources = 0;

      // Process normal transactions (ETH) - check if Promise was fulfilled
      if (normalTxResponse.status === 'fulfilled' && normalTxResponse.value.ok) {
        try {
          const normalTxData = await normalTxResponse.value.json();
          if (Array.isArray(normalTxData.result)) {
            successfulSources++;
            normalTxData.result.forEach((tx: any) => {
              const valueETH = parseFloat(tx.value) / Math.pow(10, 18);
              const valueUSD = observedValueUSD(valueETH, ethPrice);

              allTransactions.push({
                id: `${tx.hash}:eth`,
                hash: tx.hash,
                timestamp: parseInt(tx.timeStamp),
                from: tx.from,
                to: tx.to || '',
                value: valueETH.toString(),
                ...(valueUSD === undefined ? {} : { valueUSD }),
                gasUsed: tx.gasUsed,
                gasPrice: tx.gasPrice,
                status: transferStatus(tx),
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
          if (Array.isArray(tokenTxData.result)) {
            successfulSources++;
            // ⚡ SMART PRICING: Process token transactions with price caching
            const tokenTransactions = tokenTxData.result.slice(0, providerLimit);

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
              const parsedDecimals = Number(tx.tokenDecimal);
              const decimals = Number.isInteger(parsedDecimals) && parsedDecimals >= 0 && parsedDecimals <= 255 ? parsedDecimals : 18;
              const value = parseFloat(tx.value || '0') / Math.pow(10, decimals);

              const tokenKey = tx.contractAddress?.toLowerCase() || tx.tokenSymbol?.toLowerCase();
              const tokenPrice = priceMap.get(tokenKey) ?? await this.getTokenPrice(tx.tokenSymbol, tx.contractAddress);
              const valueUSD = observedValueUSD(value, tokenPrice);

              return {
                id: `${tx.hash}:${tx.logIndex ?? [tx.contractAddress, tx.from, tx.to, tx.value].join(':')}`,
                hash: tx.hash,
                timestamp: parseInt(tx.timeStamp),
                from: tx.from,
                to: tx.to,
                value: value.toString(),
                ...(valueUSD === undefined ? {} : { valueUSD }),
                tokenSymbol: tx.tokenSymbol,
                tokenAddress: tx.contractAddress,
                type: (tx.from?.toLowerCase() || '') === address.toLowerCase() ? 'token_sent' : 'token_received',
                gasUsed: tx.gasUsed,
                gasPrice: tx.gasPrice,
                status: transferStatus(tx),
                riskLevel: 'unknown'
              };
            }));

            allTransactions.push(...processedTxs);
          }
        } catch (error) {
          console.warn('Failed to process token transactions:', error);
        }
      }

      if (successfulSources === 0) throw new HistoryUnavailableError();

      // A single transaction can emit many transfers. Deduplicate only identical events.
      const tokenHashes = new Set(allTransactions.filter(tx => tx.tokenAddress).map(tx => tx.hash));
      const uniqueTransactions = Array.from(new Map(
        allTransactions
          .filter(tx => tx.tokenAddress || Number(tx.value) > 0 || !tokenHashes.has(tx.hash))
          .map(tx => [tx.id, tx])
      ).values());

      // Sort transactions by timestamp (newest first) and apply limits
      const sortedTransactions = uniqueTransactions.sort((a, b) => b.timestamp - a.timestamp);

      // ⚡ PAGINATION: Apply limit to return only requested number of transactions
      const limitedTransactions = sortedTransactions.slice((page - 1) * offset, page * offset);

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
      // The caller already owns the recoverable error state. Logging here
      // duplicates it and triggers Next's development error overlay.
      throw error instanceof Error ? error : new HistoryUnavailableError();
    }
  }

  // Comprehensive wallet analysis method with improved abort handling
  static async analyzeWallet(address: string, timeRange: string = '24h', signal?: AbortSignal, tokens?: any[], scope: 'risk' = 'risk'): Promise<any> {
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
          body: JSON.stringify({ walletAddress: address, timeRange, tokens, scope })
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
}
