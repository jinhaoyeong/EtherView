/**
 * Performance and Rate Limiting Manager for Sentiment Analysis System
 * Provides intelligent caching, rate limiting, and performance optimization
 */

import { aiCache } from '../shared/cache';

interface PerformanceMetrics {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  averageResponseTime: number;
  errorRate: number;
  lastReset: number;
}

interface RateLimitInfo {
  requests: number;
  resetTime: number;
  backoffUntil?: number;
}

interface ServiceHealth {
  isHealthy: boolean;
  lastSuccess: number;
  lastFailure: number;
  consecutiveFailures: number;
  errorDetails?: string;
}

export class PerformanceManager {
  private inflight = new Map<string, Promise<unknown>>();
  private metrics: Map<string, PerformanceMetrics> = new Map();
  private rateLimits: Map<string, RateLimitInfo> = new Map();
  private serviceHealth: Map<string, ServiceHealth> = new Map();

  private readonly DEFAULT_CACHE_TTL = 5 * 60 * 1000;
  private readonly RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
  private readonly MAX_REQUESTS_PER_WINDOW = 100;
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5; // Failures before circuit breaker
  private readonly CIRCUIT_BREAKER_RESET_TIME = 5 * 60 * 1000; // 5 minutes

  async executeWithCaching<T>(
    key: string,
    fn: () => Promise<T>,
    cacheTTL: number = this.DEFAULT_CACHE_TTL,
    forceRefresh: boolean = false
  ): Promise<T> {
    const startTime = performance.now();
    if (!forceRefresh) {
      const cached = aiCache.get<T>(key);
      if (cached !== null) {
        this.recordMetrics(key, true, performance.now() - startTime);
        return cached;
      }
    }
    const existing = this.inflight.get(key);
    if (existing) return existing as Promise<T>;

    // Register before execution begins so simultaneous page loads and manual
    // refreshes share a single analysis/provider request.
    const task = Promise.resolve().then(async () => {
      try {
        if (!await this.canExecute(key)) {
          const cached = aiCache.get<T>(key);
          if (cached !== null) return cached;
          throw new Error(`Service ${key} is rate limited or unhealthy`);
        }
        const result = await fn();
        aiCache.set(key, result, cacheTTL);
        this.recordSuccess(key, performance.now() - startTime);
        return result;
      } catch (error) {
        this.recordFailure(key, error instanceof Error ? error : new Error('Service unavailable'), performance.now() - startTime);
        const cached = aiCache.get<T>(key);
        if (cached !== null) return cached;
        throw error;
      }
    });
    this.inflight.set(key, task);
    try { return await task; }
    finally { if (this.inflight.get(key) === task) this.inflight.delete(key); }
  }

  private async canExecute(serviceKey: string): Promise<boolean> {
    // Check service health (circuit breaker)
    const health = this.serviceHealth.get(serviceKey);
    if (health && !health.isHealthy) {
      const timeSinceFailure = Date.now() - health.lastFailure;
      if (timeSinceFailure < this.CIRCUIT_BREAKER_RESET_TIME) {
        return false;
      }
      // Reset circuit breaker
      health.isHealthy = true;
      health.consecutiveFailures = 0;
    }

    // Check rate limiting
    const rateLimit = this.rateLimits.get(serviceKey);
    const now = Date.now();

    if (!rateLimit || now > rateLimit.resetTime) {
      this.rateLimits.set(serviceKey, {
        requests: 1,
        resetTime: now + this.RATE_LIMIT_WINDOW
      });
      return true;
    }

    if (rateLimit.requests >= this.MAX_REQUESTS_PER_WINDOW) {
      return false;
    }

    rateLimit.requests++;
    return true;
  }

  private recordSuccess(serviceKey: string, responseTime: number): void {
    // Update metrics
    const metrics = this.metrics.get(serviceKey) || {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageResponseTime: 0,
      errorRate: 0,
      lastReset: Date.now()
    };

    metrics.totalRequests++;
    metrics.averageResponseTime = (metrics.averageResponseTime * (metrics.totalRequests - 1) + responseTime) / metrics.totalRequests;

    this.metrics.set(serviceKey, metrics);

    // Update health
    const health = this.serviceHealth.get(serviceKey) || {
      isHealthy: true,
      lastSuccess: 0,
      lastFailure: 0,
      consecutiveFailures: 0
    };

    health.isHealthy = true;
    health.lastSuccess = Date.now();
    health.consecutiveFailures = 0;

    this.serviceHealth.set(serviceKey, health);
  }

  private recordFailure(serviceKey: string, error: Error, responseTime: number): void {
    // Update metrics
    const metrics = this.metrics.get(serviceKey) || {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageResponseTime: 0,
      errorRate: 0,
      lastReset: Date.now()
    };

    metrics.totalRequests++;
    metrics.averageResponseTime = (metrics.averageResponseTime * (metrics.totalRequests - 1) + responseTime) / metrics.totalRequests;
    metrics.errorRate = metrics.errorRate * 0.9 + 0.1; // Exponential decay for error rate

    this.metrics.set(serviceKey, metrics);

    // Update health
    const health = this.serviceHealth.get(serviceKey) || {
      isHealthy: true,
      lastSuccess: 0,
      lastFailure: 0,
      consecutiveFailures: 0
    };

    health.lastFailure = Date.now();
    health.consecutiveFailures++;
    health.errorDetails = error.message;

    // Circuit breaker logic
    if (health.consecutiveFailures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      health.isHealthy = false;
      console.warn(`Circuit breaker opened for ${serviceKey} after ${health.consecutiveFailures} failures`);
    }

    this.serviceHealth.set(serviceKey, health);
  }

  private recordMetrics(serviceKey: string, isCacheHit: boolean, responseTime: number): void {
    const metrics = this.metrics.get(serviceKey) || {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageResponseTime: 0,
      errorRate: 0,
      lastReset: Date.now()
    };

    metrics.totalRequests++;

    if (isCacheHit) {
      metrics.cacheHits++;
    } else {
      metrics.cacheMisses++;
    }

    metrics.averageResponseTime = (metrics.averageResponseTime * (metrics.totalRequests - 1) + responseTime) / metrics.totalRequests;

    this.metrics.set(serviceKey, metrics);
  }

  getMetrics(serviceKey?: string): Record<string, PerformanceMetrics> {
    if (serviceKey) {
      const metrics = this.metrics.get(serviceKey);
      return metrics ? { [serviceKey]: metrics } : {};
    }

    return Object.fromEntries(this.metrics);
  }

  getHealth(serviceKey?: string): Record<string, ServiceHealth> {
    if (serviceKey) {
      const health = this.serviceHealth.get(serviceKey);
      return health ? { [serviceKey]: health } : {};
    }

    return Object.fromEntries(this.serviceHealth);
  }

  getServiceHealthSummary(): {
    healthy: number;
    unhealthy: number;
    total: number;
    details: Record<string, ServiceHealth>;
  } {
    const healthMap = Object.fromEntries(this.serviceHealth);
    const values = Object.values(healthMap);

    return {
      healthy: values.filter(h => h.isHealthy).length,
      unhealthy: values.filter(h => !h.isHealthy).length,
      total: values.length,
      details: healthMap
    };
  }

  // Optimize batch requests with intelligent batching and parallel processing
  async executeBatch<T, R>(
    items: T[],
    processor: (item: T, index: number) => Promise<R>,
    options: {
      batchSize?: number;
      concurrency?: number;
      delayBetweenBatches?: number;
      cacheKey?: (item: T, index: number) => string;
      cacheTTL?: number;
      forceRefresh?: boolean;
    } = {}
  ): Promise<R[]> {
    const {
      batchSize = 5,
      concurrency = 3,
      delayBetweenBatches = 1000,
      cacheKey = (_, index) => `batch_${index}`,
      cacheTTL = this.DEFAULT_CACHE_TTL,
      forceRefresh = false
    } = options;

    const results: R[] = [];
    const safeBatchSize = Math.max(1, Math.floor(batchSize) || 1);
    const safeConcurrency = Math.max(1, Math.floor(concurrency) || 1);
    for (let i = 0; i < items.length; i += safeBatchSize) {
      const batch = items.slice(i, i + safeBatchSize);
      for (let j = 0; j < batch.length; j += safeConcurrency) {
        const group = batch.slice(j, j + safeConcurrency);
        // Preserve every source index. Skipping rejected entries would attach
        // later sentiment results to the wrong article.
        const completed = await Promise.all(group.map((item, groupIndex) => {
          const index = i + j + groupIndex;
          return this.executeWithCaching(cacheKey(item, index), () => processor(item, index), cacheTTL, forceRefresh);
        }));
        results.push(...completed);
      }
      if (i + safeBatchSize < items.length && delayBetweenBatches > 0) await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }

    return results;
  }

  // Clear cache and reset metrics for a service
  resetService(serviceKey: string): void {
    // Clear related cache entries
    // This would need to be implemented based on cache structure
    this.metrics.delete(serviceKey);
    this.rateLimits.delete(serviceKey);

    const health = this.serviceHealth.get(serviceKey);
    if (health) {
      health.isHealthy = true;
      health.consecutiveFailures = 0;
      health.lastFailure = 0;
    }
  }

  // Get cache statistics
  getCacheStats(): {
    hitRate: number;
    totalRequests: number;
    cacheHits: number;
    cacheMisses: number;
  } {
    let totalRequests = 0;
    let totalHits = 0;
    let totalMisses = 0;

    for (const metrics of this.metrics.values()) {
      totalRequests += metrics.totalRequests;
      totalHits += metrics.cacheHits;
      totalMisses += metrics.cacheMisses;
    }

    return {
      hitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
      totalRequests,
      cacheHits: totalHits,
      cacheMisses: totalMisses
    };
  }

  // Cleanup old metrics and cache entries
  cleanup(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    // Clean up old metrics
    for (const [key, metrics] of this.metrics.entries()) {
      if (now - metrics.lastReset > maxAge) {
        this.metrics.delete(key);
      }
    }

    // Clean up old rate limit entries
    for (const [key, rateLimit] of this.rateLimits.entries()) {
      if (now > rateLimit.resetTime) {
        this.rateLimits.delete(key);
      }
    }

    console.log('Performance manager cleanup completed');
  }
}

export const performanceManager = new PerformanceManager();

// Auto-cleanup every hour
setInterval(() => {
  performanceManager.cleanup();
}, 60 * 60 * 1000);