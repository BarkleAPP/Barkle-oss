/**
 * Intelligent Caching System
 * Multi-level cache with warming strategies and smart invalidation
 */

import type { MMRContentItem } from '../timeline/mmr-diversification.js';
import type { TimelineResult } from '../timeline/scalable-timeline-service.js';

/**
 * Cache levels
 */
export type CacheLevel = 'L1' | 'L2' | 'L3';

/**
 * Cache entry with metadata
 */
export interface CacheEntry<T = any> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number; // Time to live in ms
  accessCount: number;
  lastAccessed: number;
  size: number; // Estimated size in bytes
  tags: string[]; // For smart invalidation
  priority: number; // 0-1, higher is more important
}

/**
 * Cache statistics
 */
export interface CacheStats {
  level: CacheLevel;
  hitRate: number;
  missRate: number;
  totalHits: number;
  totalMisses: number;
  totalRequests: number;
  memoryUsage: number; // bytes
  entryCount: number;
  averageAccessTime: number; // ms
  evictionCount: number;
}

/**
 * Cache warming strategy
 */
export interface WarmingStrategy {
  name: string;
  enabled: boolean;
  priority: number;
  frequency: number; // ms between warming cycles
  batchSize: number;
  targetHitRate: number;
  predictiveWindow: number; // ms to predict future needs
}

/**
 * Cache invalidation rule
 */
export interface InvalidationRule {
  name: string;
  pattern: string | RegExp;
  tags: string[];
  condition: (entry: CacheEntry) => boolean;
  cascade: boolean; // Invalidate related entries
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  l1: {
    maxSize: number; // bytes
    maxEntries: number;
    defaultTtl: number; // ms
    evictionPolicy: 'LRU' | 'LFU' | 'FIFO' | 'TTL';
  };
  l2: {
    maxSize: number;
    maxEntries: number;
    defaultTtl: number;
    evictionPolicy: 'LRU' | 'LFU' | 'FIFO' | 'TTL';
    persistToDisk: boolean;
  };
  warming: WarmingStrategy[];
  invalidation: InvalidationRule[];
  monitoring: {
    enableMetrics: boolean;
    metricsInterval: number; // ms
    alertThresholds: {
      hitRate: number;
      memoryUsage: number;
      responseTime: number;
    };
  };
}

/**
 * L1 Memory Cache (Fastest)
 */
class L1MemoryCache {
  private cache = new Map<string, CacheEntry>();
  private accessOrder: string[] = []; // For LRU
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalAccessTime: 0
  };
  
  constructor(private config: CacheConfig['l1']) {}
  
  get(key: string): CacheEntry | null {
    const startTime = Date.now();
    const entry = this.cache.get(key);
    
    if (entry && this.isValid(entry)) {
      // Update access metadata
      entry.accessCount++;
      entry.lastAccessed = Date.now();
      
      // Update LRU order
      this.updateAccessOrder(key);
      
      this.stats.hits++;
      this.stats.totalAccessTime += Date.now() - startTime;
      return entry;
    }
    
    if (entry) {
      // Expired entry
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
    }
    
    this.stats.misses++;
    this.stats.totalAccessTime += Date.now() - startTime;
    return null;
  }
  
  set(key: string, value: any, ttl?: number, tags: string[] = [], priority = 0.5): void {
    const entry: CacheEntry = {
      key,
      value,
      timestamp: Date.now(),
      ttl: ttl || this.config.defaultTtl,
      accessCount: 0,
      lastAccessed: Date.now(),
      size: this.estimateSize(value),
      tags,
      priority
    };
    
    // Check if we need to evict
    this.ensureCapacity(entry.size);
    
    this.cache.set(key, entry);
    this.updateAccessOrder(key);
  }
  
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.removeFromAccessOrder(key);
    }
    return deleted;
  }
  
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }
  
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    const memoryUsage = Array.from(this.cache.values())
      .reduce((sum, entry) => sum + entry.size, 0);
    
    return {
      level: 'L1',
      hitRate: totalRequests > 0 ? this.stats.hits / totalRequests : 0,
      missRate: totalRequests > 0 ? this.stats.misses / totalRequests : 0,
      totalHits: this.stats.hits,
      totalMisses: this.stats.misses,
      totalRequests,
      memoryUsage,
      entryCount: this.cache.size,
      averageAccessTime: totalRequests > 0 ? this.stats.totalAccessTime / totalRequests : 0,
      evictionCount: this.stats.evictions
    };
  }
  
  private isValid(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp < entry.ttl;
  }
  
  private ensureCapacity(newEntrySize: number): void {
    const currentSize = Array.from(this.cache.values())
      .reduce((sum, entry) => sum + entry.size, 0);
    
    while (
      (currentSize + newEntrySize > this.config.maxSize || 
       this.cache.size >= this.config.maxEntries) &&
      this.cache.size > 0
    ) {
      this.evictOne();
    }
  }
  
  private evictOne(): void {
    let keyToEvict: string;
    
    switch (this.config.evictionPolicy) {
      case 'LRU':
        keyToEvict = this.accessOrder[0];
        break;
      case 'LFU':
        keyToEvict = this.findLFUKey();
        break;
      case 'FIFO':
        keyToEvict = this.cache.keys().next().value;
        break;
      case 'TTL':
        keyToEvict = this.findExpiredKey();
        break;
      default:
        keyToEvict = this.accessOrder[0];
    }
    
    if (keyToEvict) {
      this.cache.delete(keyToEvict);
      this.removeFromAccessOrder(keyToEvict);
      this.stats.evictions++;
    }
  }
  
  private updateAccessOrder(key: string): void {
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }
  
  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }
  
  private findLFUKey(): string {
    let minAccess = Infinity;
    let lfuKey = '';
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.accessCount < minAccess) {
        minAccess = entry.accessCount;
        lfuKey = key;
      }
    }
    
    return lfuKey;
  }
  
  private findExpiredKey(): string {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        return key;
      }
    }
    return this.cache.keys().next().value; // Fallback to first entry
  }
  
  private estimateSize(value: any): number {
    // Simple size estimation
    const json = JSON.stringify(value);
    return json.length * 2; // Rough estimate for UTF-16
  }
}

/**
 * L2 Redis Cache (Network-based)
 */
class L2RedisCache {
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalAccessTime: 0
  };
  
  constructor(private config: CacheConfig['l2']) {}
  
  async get(key: string): Promise<CacheEntry | null> {
    const startTime = Date.now();
    
    try {
      // Simulate Redis get operation
      // In production, this would use actual Redis client
      const serialized = await this.simulateRedisGet(key);
      
      if (serialized) {
        const entry = JSON.parse(serialized) as CacheEntry;
        
        if (this.isValid(entry)) {
          entry.accessCount++;
          entry.lastAccessed = Date.now();
          
          // Update in Redis
          await this.simulateRedisSet(key, JSON.stringify(entry), entry.ttl);
          
          this.stats.hits++;
          this.stats.totalAccessTime += Date.now() - startTime;
          return entry;
        } else {
          // Expired
          await this.simulateRedisDel(key);
        }
      }
      
      this.stats.misses++;
      this.stats.totalAccessTime += Date.now() - startTime;
      return null;
      
    } catch (error) {
      this.stats.misses++;
      this.stats.totalAccessTime += Date.now() - startTime;
      return null;
    }
  }
  
  async set(key: string, value: any, ttl?: number, tags: string[] = [], priority = 0.5): Promise<void> {
    const entry: CacheEntry = {
      key,
      value,
      timestamp: Date.now(),
      ttl: ttl || this.config.defaultTtl,
      accessCount: 0,
      lastAccessed: Date.now(),
      size: this.estimateSize(value),
      tags,
      priority
    };
    
    try {
      await this.simulateRedisSet(key, JSON.stringify(entry), entry.ttl);
    } catch (error) {
      // Handle Redis errors
      console.error('L2 Cache set error:', error);
    }
  }
  
  async delete(key: string): Promise<boolean> {
    try {
      return await this.simulateRedisDel(key);
    } catch (error) {
      return false;
    }
  }
  
  async clear(): Promise<void> {
    // Simulate Redis flush
    await this.simulateRedisFlush();
  }
  
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    
    return {
      level: 'L2',
      hitRate: totalRequests > 0 ? this.stats.hits / totalRequests : 0,
      missRate: totalRequests > 0 ? this.stats.misses / totalRequests : 0,
      totalHits: this.stats.hits,
      totalMisses: this.stats.misses,
      totalRequests,
      memoryUsage: 0, // Redis manages its own memory
      entryCount: 0, // Would need Redis INFO command
      averageAccessTime: totalRequests > 0 ? this.stats.totalAccessTime / totalRequests : 0,
      evictionCount: this.stats.evictions
    };
  }
  
  private isValid(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp < entry.ttl;
  }
  
  private estimateSize(value: any): number {
    return JSON.stringify(value).length * 2;
  }
  
  // Simulation methods (replace with actual Redis client in production)
  private async simulateRedisGet(key: string): Promise<string | null> {
    // Simulate network latency
    await new Promise(resolve => setTimeout(resolve, 1));
    
    // Simulate cache miss rate
    return Math.random() > 0.3 ? JSON.stringify({ 
      key, 
      value: `cached-${key}`, 
      timestamp: Date.now() - 1000,
      ttl: 300000,
      accessCount: 1,
      lastAccessed: Date.now(),
      size: 100,
      tags: [],
      priority: 0.5
    }) : null;
  }
  
  private async simulateRedisSet(key: string, value: string, ttl: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 1));
  }
  
  private async simulateRedisDel(key: string): Promise<boolean> {
    await new Promise(resolve => setTimeout(resolve, 1));
    return true;
  }
  
  private async simulateRedisFlush(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 5));
  }
}

/**
 * Intelligent Multi-Level Cache System
 */
export class IntelligentCacheSystem {
  private l1Cache: L1MemoryCache;
  private l2Cache: L2RedisCache;
  private warmingStrategies: Map<string, WarmingStrategy>;
  private invalidationRules: InvalidationRule[];
  private isWarming = false;
  private warmingInterval?: NodeJS.Timeout;
  
  constructor(private config: CacheConfig) {
    this.l1Cache = new L1MemoryCache(config.l1);
    this.l2Cache = new L2RedisCache(config.l2);
    this.warmingStrategies = new Map(
      config.warming.map(strategy => [strategy.name, strategy])
    );
    this.invalidationRules = config.invalidation;
    
    this.startCacheWarming();
  }
  
  /**
   * Get value from cache (L1 -> L2 -> miss)
   */
  async get<T = any>(key: string): Promise<T | null> {
    // Try L1 first
    let entry = this.l1Cache.get(key);
    if (entry) {
      return entry.value as T;
    }
    
    // Try L2
    entry = await this.l2Cache.get(key);
    if (entry) {
      // Promote to L1
      this.l1Cache.set(key, entry.value, entry.ttl, entry.tags, entry.priority);
      return entry.value as T;
    }
    
    return null;
  }
  
  /**
   * Set value in cache (both L1 and L2)
   */
  async set(
    key: string, 
    value: any, 
    ttl?: number, 
    tags: string[] = [], 
    priority = 0.5
  ): Promise<void> {
    // Set in both levels
    this.l1Cache.set(key, value, ttl, tags, priority);
    await this.l2Cache.set(key, value, ttl, tags, priority);
  }
  
  /**
   * Delete from all cache levels
   */
  async delete(key: string): Promise<boolean> {
    const l1Deleted = this.l1Cache.delete(key);
    const l2Deleted = await this.l2Cache.delete(key);
    return l1Deleted || l2Deleted;
  }
  
  /**
   * Clear all caches
   */
  async clear(): Promise<void> {
    this.l1Cache.clear();
    await this.l2Cache.clear();
  }
  
  /**
   * Smart cache invalidation based on tags and patterns
   */
  async invalidate(pattern: string | RegExp, tags?: string[]): Promise<number> {
    let invalidatedCount = 0;
    
    // Find matching invalidation rules
    const matchingRules = this.invalidationRules.filter(rule => {
      if (typeof pattern === 'string') {
        return rule.pattern === pattern || 
               (rule.pattern instanceof RegExp && rule.pattern.test(pattern));
      } else {
        return rule.pattern instanceof RegExp && 
               rule.pattern.source === pattern.source;
      }
    });
    
    // Apply invalidation rules
    for (const rule of matchingRules) {
      // This would iterate through cache entries and apply rule conditions
      // Simplified implementation for demo
      invalidatedCount += await this.applyInvalidationRule(rule);
    }
    
    return invalidatedCount;
  }
  
  /**
   * Cache warming based on strategies
   */
  async warmCache(): Promise<void> {
    if (this.isWarming) return;
    
    this.isWarming = true;
    
    try {
      for (const strategy of this.warmingStrategies.values()) {
        if (!strategy.enabled) continue;
        
        await this.executeWarmingStrategy(strategy);
      }
    } finally {
      this.isWarming = false;
    }
  }
  
  /**
   * Get comprehensive cache statistics
   */
  getStats(): {
    overall: {
      hitRate: number;
      totalRequests: number;
      memoryUsage: number;
    };
    levels: CacheStats[];
  } {
    const l1Stats = this.l1Cache.getStats();
    const l2Stats = this.l2Cache.getStats();
    
    const totalRequests = l1Stats.totalRequests + l2Stats.totalRequests;
    const totalHits = l1Stats.totalHits + l2Stats.totalHits;
    
    return {
      overall: {
        hitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
        totalRequests,
        memoryUsage: l1Stats.memoryUsage + l2Stats.memoryUsage
      },
      levels: [l1Stats, l2Stats]
    };
  }
  
  /**
   * Cache timeline results with smart tagging
   */
  async cacheTimeline(
    userId: string, 
    timeline: TimelineResult, 
    options: any = {}
  ): Promise<void> {
    const key = `timeline:${userId}:${this.hashOptions(options)}`;
    const tags = [
      'timeline',
      `user:${userId}`,
      'content',
      `diversity:${timeline.metadata.diversityScore.toFixed(1)}`
    ];
    
    // Higher priority for personalized timelines
    const priority = options.personalized ? 0.8 : 0.5;
    
    await this.set(key, timeline, 300000, tags, priority); // 5 minute TTL
  }
  
  /**
   * Cache content items with metadata tagging
   */
  async cacheContent(items: MMRContentItem[]): Promise<void> {
    for (const item of items) {
      const key = `content:${item.id}`;
      const tags = [
        'content',
        `author:${item.authorId}`,
        `type:${item.metadata?.contentType || 'text'}`,
        ...(item.tags || []).map(tag => `tag:${tag}`)
      ];
      
      await this.set(key, item, 600000, tags, 0.6); // 10 minute TTL
    }
  }
  
  /**
   * Predictive cache warming for user timelines
   */
  async warmUserTimelines(userIds: string[]): Promise<void> {
    const warmingPromises = userIds.map(async userId => {
      const key = `timeline:${userId}:default`;
      
      // Check if already cached
      const cached = await this.get(key);
      if (cached) return;
      
      // Generate and cache timeline
      // This would call the actual timeline service
      const mockTimeline: TimelineResult = {
        notes: [],
        metadata: {
          totalProcessed: 0,
          diversityScore: 0.7,
          personalizedCount: 0,
          freshCount: 0,
          processingTimeMs: 50
        }
      };
      
      await this.cacheTimeline(userId, mockTimeline);
    });
    
    await Promise.all(warmingPromises);
  }
  
  private startCacheWarming(): void {
    if (this.warmingInterval) {
      clearInterval(this.warmingInterval);
    }
    
    // Find the most frequent warming strategy
    const frequencies = Array.from(this.warmingStrategies.values())
      .filter(s => s.enabled)
      .map(s => s.frequency);
    
    if (frequencies.length > 0) {
      const minFrequency = Math.min(...frequencies);
      
      this.warmingInterval = setInterval(() => {
        this.warmCache().catch(console.error);
      }, minFrequency);
    }
  }
  
  private async executeWarmingStrategy(strategy: WarmingStrategy): Promise<void> {
    switch (strategy.name) {
      case 'user_timelines': {
        // Warm popular user timelines
        const popularUsers = await this.getPredictedActiveUsers();
        await this.warmUserTimelines(popularUsers.slice(0, strategy.batchSize));
        break;
      }
      case 'trending_content': {
        // Warm trending content
        await this.warmTrendingContent(strategy.batchSize);
        break;
      }
      case 'personalized_feeds': {
        // Warm personalized feeds for likely active users
        const activeUsers = await this.getPredictedActiveUsers();
        await this.warmPersonalizedFeeds(activeUsers.slice(0, strategy.batchSize));
        break;
      }
    }
  }
  
  private async applyInvalidationRule(rule: InvalidationRule): Promise<number> {
    // Simplified implementation
    // In production, this would iterate through actual cache entries
    return Math.floor(Math.random() * 10); // Simulate invalidation count
  }
  
  private async getPredictedActiveUsers(): Promise<string[]> {
    // Simulate user activity prediction
    // In production, this would use ML models or analytics
    return Array.from({ length: 50 }, (_, i) => `user-${i}`);
  }
  
  private async warmTrendingContent(batchSize: number): Promise<void> {
    // Simulate trending content warming
    const trendingIds = Array.from({ length: batchSize }, (_, i) => `trending-${i}`);
    
    for (const id of trendingIds) {
      const key = `trending:${id}`;
      const mockContent: MMRContentItem = {
        id,
        userId: `user-${Math.floor(Math.random() * 100)}`,
        authorId: `author-${Math.floor(Math.random() * 50)}`,
        text: `Trending content ${id}`,
        tags: [`#trending`, `#popular`],
        createdAt: new Date(),
        relevanceScore: 0.8 + Math.random() * 0.2
      };
      
      await this.set(key, mockContent, 180000, ['trending', 'content'], 0.9); // 3 min TTL, high priority
    }
  }
  
  private async warmPersonalizedFeeds(userIds: string[]): Promise<void> {
    for (const userId of userIds) {
      const key = `feed:${userId}:personalized`;
      
      // Check if already cached
      const cached = await this.get(key);
      if (cached) continue;
      
      // Generate personalized feed
      const mockFeed = {
        userId,
        items: Array.from({ length: 20 }, (_, i) => `item-${i}`),
        generatedAt: new Date(),
        personalizedScore: 0.8
      };
      
      await this.set(key, mockFeed, 600000, [`user:${userId}`, 'personalized'], 0.7); // 10 min TTL
    }
  }
  
  private hashOptions(options: any): string {
    // Simple hash of options for cache key
    const str = JSON.stringify(options);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
  
  /**
   * Cleanup and shutdown
   */
  destroy(): void {
    if (this.warmingInterval) {
      clearInterval(this.warmingInterval);
    }
  }
}

/**
 * Default cache configuration
 */
export const defaultCacheConfig: CacheConfig = {
  l1: {
    maxSize: 50 * 1024 * 1024, // 50MB
    maxEntries: 10000,
    defaultTtl: 300000, // 5 minutes
    evictionPolicy: 'LRU'
  },
  l2: {
    maxSize: 500 * 1024 * 1024, // 500MB
    maxEntries: 100000,
    defaultTtl: 1800000, // 30 minutes
    evictionPolicy: 'LRU',
    persistToDisk: true
  },
  warming: [
    {
      name: 'user_timelines',
      enabled: true,
      priority: 0.8,
      frequency: 60000, // 1 minute
      batchSize: 20,
      targetHitRate: 0.9,
      predictiveWindow: 300000 // 5 minutes
    },
    {
      name: 'trending_content',
      enabled: true,
      priority: 0.9,
      frequency: 30000, // 30 seconds
      batchSize: 10,
      targetHitRate: 0.95,
      predictiveWindow: 180000 // 3 minutes
    }
  ],
  invalidation: [
    {
      name: 'user_content_update',
      pattern: /^content:.*$/,
      tags: ['content'],
      condition: (entry) => entry.tags.includes('content'),
      cascade: true
    },
    {
      name: 'timeline_refresh',
      pattern: /^timeline:.*$/,
      tags: ['timeline'],
      condition: (entry) => entry.tags.includes('timeline'),
      cascade: false
    }
  ],
  monitoring: {
    enableMetrics: true,
    metricsInterval: 60000, // 1 minute
    alertThresholds: {
      hitRate: 0.8,
      memoryUsage: 0.9,
      responseTime: 100 // ms
    }
  }
};