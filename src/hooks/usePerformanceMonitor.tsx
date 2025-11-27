/**
 * Performance monitoring hook for tracking component load times and API performance
 */

import { useEffect, useRef, useState } from 'react';

interface PerformanceMetrics {
  componentLoadTime: number;
  apiCallTimes: Record<string, number>;
  renderCount: number;
  lastUpdated: number;
  averageLoadTime: number;
  cacheHitRate: number;
}

interface PerformanceEntry {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
}

export function usePerformanceMonitor(componentName: string) {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    componentLoadTime: 0,
    apiCallTimes: {},
    renderCount: 0,
    lastUpdated: 0,
    averageLoadTime: 0,
    cacheHitRate: 0
  });

  const entriesRef = useRef<Map<string, PerformanceEntry>>(new Map());
  const loadTimesRef = useRef<number[]>([]);
  const cacheHitsRef = useRef({ hits: 0, total: 0 });

  // Start timing an operation
  const startTiming = (name: string) => {
    const entry: PerformanceEntry = {
      name,
      startTime: performance.now()
    };
    entriesRef.current.set(name, entry);
  };

  // End timing an operation
  const endTiming = (name: string): number => {
    const entry = entriesRef.current.get(name);
    if (!entry) {
      console.warn(`No timer found for ${name}`);
      return 0;
    }

    const endTime = performance.now();
    const duration = endTime - entry.startTime;
    entry.endTime = endTime;
    entry.duration = duration;

    entriesRef.current.set(name, entry);

    // Update metrics
    setMetrics(prev => ({
      ...prev,
      apiCallTimes: {
        ...prev.apiCallTimes,
        [name]: duration
      }
    }));

    return duration;
  };

  // Record a cache hit or miss
  const recordCacheHit = (hit: boolean) => {
    cacheHitsRef.current.total++;
    if (hit) {
      cacheHitsRef.current.hits++;
    }

    const rate = cacheHitsRef.current.hits / cacheHitsRef.current.total;
    setMetrics(prev => ({
      ...prev,
      cacheHitRate: rate
    }));
  };

  // Measure component load time
  const measureComponentLoad = (callback: () => Promise<void> | void) => {
    startTiming('componentLoad');
    const result = callback();

    if (result instanceof Promise) {
      return result.then(() => {
        const duration = endTiming('componentLoad');
        recordLoadTime(duration);
      });
    } else {
      const duration = endTiming('componentLoad');
      recordLoadTime(duration);
      return result;
    }
  };

  // Record load time for average calculation
  const recordLoadTime = (duration: number) => {
    loadTimesRef.current.push(duration);

    // Keep only last 10 measurements
    if (loadTimesRef.current.length > 10) {
      loadTimesRef.current.shift();
    }

    const average = loadTimesRef.current.reduce((a, b) => a + b, 0) / loadTimesRef.current.length;

    setMetrics(prev => ({
      ...prev,
      componentLoadTime: duration,
      averageLoadTime: average,
      lastUpdated: Date.now()
    }));
  };

  // Track renders
  useEffect(() => {
    setMetrics(prev => ({
      ...prev,
      renderCount: prev.renderCount + 1
    }));
  });

  // Get performance summary
  const getPerformanceSummary = () => {
    const apiEntries = Array.from(entriesRef.current.values())
      .filter(entry => entry.duration !== undefined)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0));

    return {
      componentName,
      ...metrics,
      slowestApiCall: apiEntries[0]?.name || 'N/A',
      slowestApiTime: apiEntries[0]?.duration || 0,
      totalApiCalls: apiEntries.length,
      recommendations: generateRecommendations(metrics, apiEntries)
    };
  };

  // Generate performance recommendations
  const generateRecommendations = (metrics: PerformanceMetrics, apiEntries: PerformanceEntry[]) => {
    const recommendations: string[] = [];

    if (metrics.componentLoadTime > 1000) {
      recommendations.push('Component load time is above 1 second. Consider optimizing data fetching.');
    }

    if (metrics.cacheHitRate < 0.5) {
      recommendations.push('Cache hit rate is below 50%. Implement better caching strategies.');
    }

    const slowApis = apiEntries.filter(entry => (entry.duration || 0) > 500);
    if (slowApis.length > 0) {
      recommendations.push(`${slowApis.length} API calls are taking more than 500ms. Consider batching or optimization.`);
    }

    if (metrics.averageLoadTime > 2000) {
      recommendations.push('Average load time is above 2 seconds. Review overall performance strategy.');
    }

    return recommendations;
  };

  // Log performance metrics (in development)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && metrics.componentLoadTime > 0) {
      console.group(`🚀 Performance Metrics - ${componentName}`);
      console.log('Component Load Time:', `${metrics.componentLoadTime.toFixed(2)}ms`);
      console.log('Average Load Time:', `${metrics.averageLoadTime.toFixed(2)}ms`);
      console.log('Cache Hit Rate:', `${(metrics.cacheHitRate * 100).toFixed(1)}%`);
      console.log('API Call Times:', metrics.apiCallTimes);
      console.log('Render Count:', metrics.renderCount);
      console.groupEnd();
    }
  }, [metrics, componentName]);

  // Performance badge component
  const PerformanceBadge = () => {
    if (process.env.NODE_ENV !== 'development') {
      return null;
    }

    const getColor = () => {
      if (metrics.averageLoadTime < 500) return 'bg-green-500';
      if (metrics.averageLoadTime < 1000) return 'bg-yellow-500';
      return 'bg-red-500';
    };

    return (
      <div className={`fixed bottom-4 right-4 px-3 py-2 rounded-full text-white text-xs font-mono ${getColor()} z-50`}>
        {componentName}: {metrics.averageLoadTime.toFixed(0)}ms
      </div>
    );
  };

  return {
    startTiming,
    endTiming,
    recordCacheHit,
    measureComponentLoad,
    getPerformanceSummary,
    metrics,
    PerformanceBadge
  };
}