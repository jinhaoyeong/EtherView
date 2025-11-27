/**
 * AI Analysis Cache System
 * Provides intelligent caching for AI analysis results
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  key: string;
}

export class AICache {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes default

  set<T>(key: string, data: T, ttl?: number): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
      key
    };

    this.cache.set(key, entry);
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if entry is expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // Clean up expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  // Get cache statistics
  getStats() {
    const now = Date.now();
    let expired = 0;
    let active = 0;

    for (const entry of this.cache.values()) {
      if (now - entry.timestamp > entry.ttl) {
        expired++;
      } else {
        active++;
      }
    }

    return {
      total: this.cache.size,
      active,
      expired,
      size: this.estimateMemoryUsage()
    };
  }

  private estimateMemoryUsage(): number {
    // Rough estimation in bytes
    let size = 0;
    for (const [key, entry] of this.cache.entries()) {
      size += key.length * 2; // String characters
      size += JSON.stringify(entry.data).length * 2;
      size += 64; // Overhead
    }
    return size;
  }
}

// Singleton instance
export const aiCache = new AICache();

// Auto-cleanup every 5 minutes
setInterval(() => {
  aiCache.cleanup();
}, 5 * 60 * 1000);

// Export convenience functions for specific cache types
export const createCacheKey = (type: string, params: Record<string, any>): string => {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}:${params[key]}`)
    .join('|');
  return `${type}:${sortedParams}`;
};

// Predefined cache keys for different AI modules
export const CacheKeys = {
  SCAM_ANALYSIS: (tokenAddress: string) => createCacheKey('scam', { address: tokenAddress.toLowerCase() }),
  SENTIMENT_ANALYSIS: (timeframe?: string) => createCacheKey('sentiment', { timeframe: timeframe || '24h' }),
  WHALE_ANALYSIS: (walletAddress?: string) => createCacheKey('whale', { wallet: walletAddress || 'global' }),
  TOKEN_PRICE: (tokenAddress: string, timestamp: number) => createCacheKey('price', { address: tokenAddress.toLowerCase(), timestamp }),
  HOLDER_DATA: (tokenAddress: string) => createCacheKey('holders', { address: tokenAddress.toLowerCase() })
};