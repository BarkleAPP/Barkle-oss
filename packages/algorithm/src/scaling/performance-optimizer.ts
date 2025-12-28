/**
 * Performance Optimizer
 * Optimizes algorithm performance based on community size and system load
 */

import type { CommunitySize, ScalingStrategy } from './community-adaptive-scaling.js';
import type { EmbeddingTableManager } from '../embeddings/index.js';

/**
 * Performance metrics for monitoring
 */
export interface PerformanceMetrics {
  cpuUsage: number;
  memoryUsage: number;
  responseTime: number;
  throughput: number;
  errorRate: number;
  cacheHitRate: number;
  embeddingLookupTime: number;
  modelInferenceTime: number;
  timestamp: number;
}

/**
 * Optimization configuration
 */
export interface OptimizationConfig {
  enableDynamicBatching: boolean;
  enableCaching: boolean;
  enablePrefetching: boolean;
  maxBatchSize: number;
  cacheSize: number;
  prefetchThreshold: number;
  performanceTarget: {
    maxResponseTime: number;
    minThroughput: number;
    maxErrorRate: number;
  };
}

/**
 * Cache configuration based on community size
 */
export interface CacheConfig {
  userEmbeddingCacheSize: number;
  contentCacheSize: number;
  modelCacheSize: number;
  ttlSeconds: number;
  evictionPolicy: 'lru' | 'lfu' | 'ttl';
}

/**
 * Batch processing configuration
 */
export interface BatchConfig {
  maxBatchSize: number;
  batchTimeoutMs: number;
  enableParallelProcessing: boolean;
  maxConcurrency: number;
}

/**
 * Performance optimizer that adapts to community size and system load
 */
export class PerformanceOptimizer {
  private metrics: PerformanceMetrics[] = [];
  private config: OptimizationConfig;
  private currentStrategy: ScalingStrategy | null = null;
  private embeddingManager: EmbeddingTableManager;
  
  // Performance caches
  private userEmbeddingCache = new Map<string, { embedding: number[]; timestamp: number }>();
  private modelResultCache = new Map<string, { result: number; timestamp: number }>();
  private contentCache = new Map<string, { content: any; timestamp: number }>();
  
  // Batch processing
  private pendingRequests: Array<{
    id: string;
    request: any;
    resolve: (result: any) => void;
    reject: (error: any) => void;
    timestamp: number;
  }> = [];
  
  private batchTimer?: NodeJS.Timeout;
  private metricsTimer?: NodeJS.Timeout;
  
  constructor(
    embeddingManager: EmbeddingTableManager,
    config: Partial<OptimizationConfig> = {}
  ) {
    this.embeddingManager = embeddingManager;
    this.config = {
      enableDynamicBatching: config.enableDynamicBatching ?? true,
      enableCaching: config.enableCaching ?? true,
      enablePrefetching: config.enablePrefetching ?? true,
      maxBatchSize: config.maxBatchSize || 50,
      cacheSize: config.cacheSize || 10000,
      prefetchThreshold: config.prefetchThreshold || 0.8,
      performanceTarget: {
        maxResponseTime: config.performanceTarget?.maxResponseTime || 100, // 100ms
        minThroughput: config.performanceTarget?.minThroughput || 1000, // 1000 req/s
        maxErrorRate: config.performanceTarget?.maxErrorRate || 0.01 // 1%
      }
    };
    
    this.startMetricsCollection();
  }
  
  /**
   * Adapt performance settings based on community size
   */
  public adaptToCommunitySize(strategy: ScalingStrategy): void {
    this.currentStrategy = strategy;
    
    // Adjust cache configuration
    const cacheConfig = this.getCacheConfigForCommunity(strategy.communitySize);
    this.applyCacheConfig(cacheConfig);
    
    // Adjust batch configuration
    const batchConfig = this.getBatchConfigForCommunity(strategy.communitySize);
    this.applyBatchConfig(batchConfig);
    
    // Adjust optimization settings
    this.adjustOptimizationSettings(strategy);
    
    console.log(`Performance optimizer adapted for ${strategy.communitySize} community`);
  }
  
  /**
   * Get cache configuration for community size
   */
  private getCacheConfigForCommunity(communitySize: CommunitySize): CacheConfig {
    switch (communitySize) {
      case 'small':
        return {
          userEmbeddingCacheSize: 1000,
          contentCacheSize: 5000,
          modelCacheSize: 1000,
          ttlSeconds: 300, // 5 minutes
          evictionPolicy: 'lru'
        };
      
      case 'medium':
        return {
          userEmbeddingCacheSize: 5000,
          contentCacheSize: 20000,
          modelCacheSize: 5000,
          ttlSeconds: 600, // 10 minutes
          evictionPolicy: 'lfu'
        };
      
      case 'large':
        return {
          userEmbeddingCacheSize: 20000,
          contentCacheSize: 100000,
          modelCacheSize: 20000,
          ttlSeconds: 1800, // 30 minutes
          evictionPolicy: 'lfu'
        };
      
      case 'massive':
        return {
          userEmbeddingCacheSize: 100000,
          contentCacheSize: 500000,
          modelCacheSize: 100000,
          ttlSeconds: 3600, // 1 hour
          evictionPolicy: 'lfu'
        };
    }
  }
  
  /**
   * Get batch configuration for community size
   */
  private getBatchConfigForCommunity(communitySize: CommunitySize): BatchConfig {
    switch (communitySize) {
      case 'small':
        return {
          maxBatchSize: 10,
          batchTimeoutMs: 50,
          enableParallelProcessing: false,
          maxConcurrency: 2
        };
      
      case 'medium':
        return {
          maxBatchSize: 25,
          batchTimeoutMs: 100,
          enableParallelProcessing: true,
          maxConcurrency: 4
        };
      
      case 'large':
        return {
          maxBatchSize: 50,
          batchTimeoutMs: 200,
          enableParallelProcessing: true,
          maxConcurrency: 8
        };
      
      case 'massive':
        return {
          maxBatchSize: 100,
          batchTimeoutMs: 500,
          enableParallelProcessing: true,
          maxConcurrency: 16
        };
    }
  }
  
  /**
   * Apply cache configuration
   */
  private applyCacheConfig(config: CacheConfig): void {
    // Clear existing caches if they exceed new size limits
    if (this.userEmbeddingCache.size > config.userEmbeddingCacheSize) {
      this.evictCacheEntries(this.userEmbeddingCache, config.userEmbeddingCacheSize);
    }
    
    if (this.contentCache.size > config.contentCacheSize) {
      this.evictCacheEntries(this.contentCache, config.contentCacheSize);
    }
    
    if (this.modelResultCache.size > config.modelCacheSize) {
      this.evictCacheEntries(this.modelResultCache, config.modelCacheSize);
    }
  }
  
  /**
   * Apply batch configuration
   */
  private applyBatchConfig(config: BatchConfig): void {
    this.config.maxBatchSize = config.maxBatchSize;
    
    // Restart batch timer with new timeout
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }
    
    this.startBatchProcessing(config.batchTimeoutMs);
  }
  
  /**
   * Adjust optimization settings based on strategy
   */
  private adjustOptimizationSettings(strategy: ScalingStrategy): void {
    // Adjust caching aggressiveness
    if (strategy.cacheStrategy === 'aggressive') {
      this.config.enableCaching = true;
      this.config.enablePrefetching = true;
    } else if (strategy.cacheStrategy === 'conservative') {
      this.config.enablePrefetching = false;
    }
    
    // Adjust batching based on update frequency
    if (strategy.updateFrequency === 'high') {
      this.config.enableDynamicBatching = true;
      this.config.maxBatchSize = Math.min(this.config.maxBatchSize, 25);
    } else if (strategy.updateFrequency === 'low') {
      this.config.maxBatchSize = Math.max(this.config.maxBatchSize, 50);
    }
  }
  
  /**
   * Process request with performance optimizations
   */
  public async processRequest<T>(
    requestId: string,
    processor: () => Promise<T>,
    cacheKey?: string
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      // Check cache first
      if (this.config.enableCaching && cacheKey) {
        const cached = this.getCachedResult<T>(cacheKey);
        if (cached) {
          this.recordMetrics(startTime, true);
          return cached;
        }
      }
      
      // Process request
      let result: T;
      
      if (this.config.enableDynamicBatching) {
        result = await this.processBatched(requestId, processor);
      } else {
        result = await processor();
      }
      
      // Cache result
      if (this.config.enableCaching && cacheKey) {
        this.cacheResult(cacheKey, result);
      }
      
      this.recordMetrics(startTime, false);
      return result;
      
    } catch (error) {
      this.recordMetrics(startTime, false, true);
      throw error;
    }
  }
  
  /**
   * Process request in batch
   */
  private async processBatched<T>(
    requestId: string,
    processor: () => Promise<T>
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      this.pendingRequests.push({
        id: requestId,
        request: processor,
        resolve,
        reject,
        timestamp: Date.now()
      });
      
      // Process immediately if batch is full
      if (this.pendingRequests.length >= this.config.maxBatchSize) {
        this.processBatch();
      }
    });
  }
  
  /**
   * Process accumulated batch
   */
  private async processBatch(): Promise<void> {
    if (this.pendingRequests.length === 0) return;
    
    const batch = this.pendingRequests.splice(0, this.config.maxBatchSize);
    
    try {
      // Process all requests in parallel
      const results = await Promise.allSettled(
        batch.map(item => item.request())
      );
      
      // Resolve/reject individual requests
      results.forEach((result, index) => {
        const request = batch[index];
        if (result.status === 'fulfilled') {
          request.resolve(result.value);
        } else {
          request.reject(result.reason);
        }
      });
      
    } catch (error) {
      // Reject all requests in batch
      batch.forEach(request => request.reject(error));
    }
  }
  
  /**
   * Start batch processing timer
   */
  private startBatchProcessing(timeoutMs: number): void {
    const processBatchPeriodically = () => {
      this.processBatch();
      this.batchTimer = setTimeout(processBatchPeriodically, timeoutMs);
    };
    
    this.batchTimer = setTimeout(processBatchPeriodically, timeoutMs);
  }
  
  /**
   * Get cached result
   */
  private getCachedResult<T>(key: string): T | null {
    const cached = this.modelResultCache.get(key);
    if (!cached) return null;
    
    // Check TTL
    const ttl = this.currentStrategy ? this.getCacheConfigForCommunity(this.currentStrategy.communitySize).ttlSeconds * 1000 : 300000;
    if (Date.now() - cached.timestamp > ttl) {
      this.modelResultCache.delete(key);
      return null;
    }
    
    return cached.result as T;
  }
  
  /**
   * Cache result
   */
  private cacheResult<T>(key: string, result: T): void {
    const cacheConfig = this.currentStrategy 
      ? this.getCacheConfigForCommunity(this.currentStrategy.communitySize)
      : { modelCacheSize: 1000, ttlSeconds: 300, evictionPolicy: 'lru' as const };
    
    // Evict if at capacity
    if (this.modelResultCache.size >= cacheConfig.modelCacheSize) {
      this.evictCacheEntries(this.modelResultCache, cacheConfig.modelCacheSize - 1);
    }
    
    this.modelResultCache.set(key, {
      result: result as any,
      timestamp: Date.now()
    });
  }
  
  /**
   * Evict cache entries based on policy
   */
  private evictCacheEntries<T>(cache: Map<string, T>, targetSize: number): void {
    const entriesToRemove = cache.size - targetSize;
    if (entriesToRemove <= 0) return;
    
    // Simple LRU eviction (remove oldest entries)
    const entries = Array.from(cache.entries());
    entries.sort((a, b) => {
      const aTime = (a[1] as any).timestamp || 0;
      const bTime = (b[1] as any).timestamp || 0;
      return aTime - bTime;
    });
    
    for (let i = 0; i < entriesToRemove; i++) {
      cache.delete(entries[i][0]);
    }
  }
  
  /**
   * Record performance metrics
   */
  private recordMetrics(startTime: number, cacheHit: boolean, error: boolean = false): void {
    const responseTime = Date.now() - startTime;
    
    const metrics: PerformanceMetrics = {
      cpuUsage: this.getCpuUsage(),
      memoryUsage: this.getMemoryUsage(),
      responseTime,
      throughput: this.calculateThroughput(),
      errorRate: error ? 1 : 0,
      cacheHitRate: cacheHit ? 1 : 0,
      embeddingLookupTime: this.getEmbeddingLookupTime(),
      modelInferenceTime: responseTime,
      timestamp: Date.now()
    };
    
    this.metrics.push(metrics);
    
    // Keep only recent metrics
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-500);
    }
  }
  
  /**
   * Get current performance metrics
   */
  public getCurrentMetrics(): PerformanceMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }
  
  /**
   * Get average metrics over time window
   */
  public getAverageMetrics(windowMs: number = 60000): Partial<PerformanceMetrics> {
    const cutoff = Date.now() - windowMs;
    const recentMetrics = this.metrics.filter(m => m.timestamp > cutoff);
    
    if (recentMetrics.length === 0) return {};
    
    const sum = recentMetrics.reduce((acc, m) => ({
      cpuUsage: acc.cpuUsage + m.cpuUsage,
      memoryUsage: acc.memoryUsage + m.memoryUsage,
      responseTime: acc.responseTime + m.responseTime,
      throughput: acc.throughput + m.throughput,
      errorRate: acc.errorRate + m.errorRate,
      cacheHitRate: acc.cacheHitRate + m.cacheHitRate,
      embeddingLookupTime: acc.embeddingLookupTime + m.embeddingLookupTime,
      modelInferenceTime: acc.modelInferenceTime + m.modelInferenceTime
    }), {
      cpuUsage: 0, memoryUsage: 0, responseTime: 0, throughput: 0,
      errorRate: 0, cacheHitRate: 0, embeddingLookupTime: 0, modelInferenceTime: 0
    });
    
    const count = recentMetrics.length;
    return {
      cpuUsage: sum.cpuUsage / count,
      memoryUsage: sum.memoryUsage / count,
      responseTime: sum.responseTime / count,
      throughput: sum.throughput / count,
      errorRate: sum.errorRate / count,
      cacheHitRate: sum.cacheHitRate / count,
      embeddingLookupTime: sum.embeddingLookupTime / count,
      modelInferenceTime: sum.modelInferenceTime / count
    };
  }
  
  /**
   * Check if performance targets are being met
   */
  public isPerformanceHealthy(): {
    healthy: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const avgMetrics = this.getAverageMetrics();
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    if (avgMetrics.responseTime && avgMetrics.responseTime > this.config.performanceTarget.maxResponseTime) {
      issues.push(`Response time ${avgMetrics.responseTime.toFixed(1)}ms exceeds target ${this.config.performanceTarget.maxResponseTime}ms`);
      recommendations.push('Consider increasing cache size or enabling more aggressive caching');
    }
    
    if (avgMetrics.throughput && avgMetrics.throughput < this.config.performanceTarget.minThroughput) {
      issues.push(`Throughput ${avgMetrics.throughput.toFixed(0)} req/s below target ${this.config.performanceTarget.minThroughput} req/s`);
      recommendations.push('Consider enabling dynamic batching or increasing batch size');
    }
    
    if (avgMetrics.errorRate && avgMetrics.errorRate > this.config.performanceTarget.maxErrorRate) {
      issues.push(`Error rate ${(avgMetrics.errorRate * 100).toFixed(2)}% exceeds target ${(this.config.performanceTarget.maxErrorRate * 100).toFixed(2)}%`);
      recommendations.push('Check system resources and error logs');
    }
    
    if (avgMetrics.memoryUsage && avgMetrics.memoryUsage > 80) {
      issues.push(`Memory usage ${avgMetrics.memoryUsage.toFixed(1)}% is high`);
      recommendations.push('Consider reducing cache sizes or enabling more aggressive cleanup');
    }
    
    return {
      healthy: issues.length === 0,
      issues,
      recommendations
    };
  }
  
  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsTimer = setInterval(() => {
      // Collect system metrics periodically
      this.recordMetrics(Date.now(), false);
    }, 10000); // Every 10 seconds
  }
  
  /**
   * Utility methods for system metrics
   */
  private getCpuUsage(): number {
    // Simplified CPU usage (would use actual system metrics in production)
    return Math.random() * 100;
  }
  
  private getMemoryUsage(): number {
    // Simplified memory usage (would use actual system metrics in production)
    const embeddingStats = this.embeddingManager.getSystemStats();
    return (embeddingStats.totalMemoryUsageMB / 100) * 100; // Percentage of 100MB limit
  }
  
  private calculateThroughput(): number {
    // Calculate requests per second from recent metrics
    const recentMetrics = this.metrics.slice(-10);
    if (recentMetrics.length < 2) return 0;
    
    const timeSpan = recentMetrics[recentMetrics.length - 1].timestamp - recentMetrics[0].timestamp;
    return timeSpan > 0 ? (recentMetrics.length / timeSpan) * 1000 : 0;
  }
  
  private getEmbeddingLookupTime(): number {
    // Get average embedding lookup time from embedding manager
    const stats = this.embeddingManager.getSystemStats();
    const userStats = stats.tableStats.user;
    return userStats?.averageLookupTimeMs || 0;
  }
  
  /**
   * Cleanup resources
   */
  public destroy(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = undefined;
    }
    
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = undefined;
    }
    
    // Process any remaining batched requests
    this.processBatch();
    
    // Clear caches
    this.userEmbeddingCache.clear();
    this.modelResultCache.clear();
    this.contentCache.clear();
  }
}