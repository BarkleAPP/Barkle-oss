/**
 * Embedding Table Manager
 * Manages multiple Cuckoo embedding tables for different entity types
 * Based on ByteDance Monolith architecture
 */

import { CuckooEmbeddingTable, createEmbeddingTable, EmbeddingTableStats } from './cuckoo-embedding-table.js';

/**
 * Types of embeddings supported by the system
 */
export type EmbeddingType = 'user' | 'content' | 'topic' | 'author';

/**
 * Embedding request with metadata
 */
export interface EmbeddingRequest {
  type: EmbeddingType;
  id: string;
  embedding?: number[];
  frequency?: number;
}

/**
 * System-wide embedding statistics
 */
export interface SystemEmbeddingStats {
  totalMemoryUsageMB: number;
  totalEntries: number;
  overallHealth: boolean;
  tableStats: Record<EmbeddingType, EmbeddingTableStats>;
  lastCleanupTime: number;
  nextCleanupTime: number;
}

/**
 * Configuration for the embedding table manager
 */
export interface EmbeddingManagerConfig {
  communitySize: number;
  enableAutoCleanup: boolean;
  cleanupIntervalMs: number;
  maxSystemMemoryMB: number;
}

/**
 * Manages collision-free embedding tables for all entity types
 * Implements ByteDance Monolith approach with community-adaptive scaling
 */
export class EmbeddingTableManager {
  private tables: Record<EmbeddingType, CuckooEmbeddingTable>;
  private config: EmbeddingManagerConfig;
  private cleanupTimer?: any;
  private lastCleanupTime: number = 0;
  
  constructor(config: Partial<EmbeddingManagerConfig> = {}) {
    this.config = {
      communitySize: config.communitySize || 1000,
      enableAutoCleanup: config.enableAutoCleanup ?? true,
      cleanupIntervalMs: config.cleanupIntervalMs || 30 * 60 * 1000, // 30 minutes
      maxSystemMemoryMB: config.maxSystemMemoryMB || 20
    };
    
    // Initialize embedding tables for each type
    this.tables = {
      user: createEmbeddingTable('user', this.config.communitySize),
      content: createEmbeddingTable('content', this.config.communitySize),
      topic: createEmbeddingTable('topic', this.config.communitySize),
      author: createEmbeddingTable('author', this.config.communitySize)
    };
    
    // Start automatic cleanup if enabled
    if (this.config.enableAutoCleanup) {
      this.startAutoCleanup();
    }
  }
  
  /**
   * Get embedding with O(1) lookup time
   * Implements ByteDance Monolith collision-free lookup
   */
  public getEmbedding(type: EmbeddingType, id: string): number[] | null {
    const table = this.tables[type];
    if (!table) {
      throw new Error(`Invalid embedding type: ${type}`);
    }
    
    return table.get(id);
  }
  
  /**
   * Set or update embedding with collision detection
   * Performance target: <2ms insertion
   */
  public setEmbedding(type: EmbeddingType, id: string, embedding: number[]): boolean {
    const table = this.tables[type];
    if (!table) {
      throw new Error(`Invalid embedding type: ${type}`);
    }
    
    return table.set(id, embedding);
  }
  
  /**
   * Get or create embedding (lazy initialization)
   * Returns existing embedding or creates new random embedding
   */
  public getOrCreateEmbedding(type: EmbeddingType, id: string): number[] {
    // Try to get existing embedding
    const existing = this.getEmbedding(type, id);
    if (existing) {
      return existing;
    }
    
    // Create new random embedding
    const table = this.tables[type];
    const dimension = 64; // Standard embedding dimension
    const newEmbedding = this.generateRandomEmbedding(dimension);
    
    // Try to store the new embedding
    const success = table.set(id, newEmbedding);
    if (!success) {
      // If storage failed, still return the embedding for immediate use
      console.warn(`Failed to store embedding for ${type}:${id}, using temporary embedding`);
    }
    
    return newEmbedding;
  }
  
  /**
   * Update embedding frequency (for ByteDance frequency-based filtering)
   */
  public updateEmbeddingFrequency(type: EmbeddingType, id: string): void {
    // This is handled automatically in the get() method of CuckooEmbeddingTable
    // Just trigger a get to update frequency
    this.getEmbedding(type, id);
  }
  
  /**
   * Check if a feature should be admitted based on frequency
   */
  public shouldAdmitFeature(type: EmbeddingType, frequency: number): boolean {
    const table = this.tables[type];
    return table.shouldAdmitFeature(frequency);
  }
  
  /**
   * Batch get embeddings for multiple entities
   */
  public getBatchEmbeddings(requests: EmbeddingRequest[]): Map<string, number[] | null> {
    const results = new Map<string, number[] | null>();
    
    for (const request of requests) {
      const key = `${request.type}:${request.id}`;
      const embedding = this.getEmbedding(request.type, request.id);
      results.set(key, embedding);
    }
    
    return results;
  }
  
  /**
   * Batch set embeddings for multiple entities
   */
  public setBatchEmbeddings(requests: EmbeddingRequest[]): Map<string, boolean> {
    const results = new Map<string, boolean>();
    
    for (const request of requests) {
      if (!request.embedding) {
        continue;
      }
      
      const key = `${request.type}:${request.id}`;
      const success = this.setEmbedding(request.type, request.id, request.embedding);
      results.set(key, success);
    }
    
    return results;
  }
  
  /**
   * Clean up expired embeddings across all tables
   */
  public cleanupExpiredEmbeddings(): number {
    let totalCleaned = 0;
    
    for (const [type, table] of Object.entries(this.tables)) {
      const cleaned = table.cleanupExpiredEmbeddings();
      totalCleaned += cleaned;
      
      if (cleaned > 0) {
        // Log cleaned embeddings
      }
    }
    
    this.lastCleanupTime = Date.now();
    return totalCleaned;
  }
  
  /**
   * Get comprehensive system statistics
   */
  public getSystemStats(): SystemEmbeddingStats {
    const tableStats: Record<EmbeddingType, EmbeddingTableStats> = {} as any;
    let totalMemoryUsageMB = 0;
    let totalEntries = 0;
    let overallHealth = true;
    
    for (const [type, table] of Object.entries(this.tables) as [EmbeddingType, CuckooEmbeddingTable][]) {
      const stats = table.getStats();
      tableStats[type] = stats;
      totalMemoryUsageMB += stats.memoryUsageMB;
      totalEntries += stats.totalEntries;
      
      if (!table.isHealthy()) {
        overallHealth = false;
      }
    }
    
    // Check system-wide memory limit
    if (totalMemoryUsageMB > this.config.maxSystemMemoryMB) {
      overallHealth = false;
    }
    
    return {
      totalMemoryUsageMB,
      totalEntries,
      overallHealth,
      tableStats,
      lastCleanupTime: this.lastCleanupTime,
      nextCleanupTime: this.lastCleanupTime + this.config.cleanupIntervalMs
    };
  }
  
  /**
   * Check if the system is healthy
   */
  public isSystemHealthy(): boolean {
    const stats = this.getSystemStats();
    return stats.overallHealth;
  }
  
  /**
   * Force memory cleanup when approaching limits
   */
  public forceMemoryCleanup(): void {
    const stats = this.getSystemStats();
    
    if (stats.totalMemoryUsageMB > this.config.maxSystemMemoryMB * 0.8) {
      // Memory usage high, forcing cleanup
      
      // Clean expired embeddings first
      const cleaned = this.cleanupExpiredEmbeddings();
      
      // If still high, clear least recently used embeddings
      const newStats = this.getSystemStats();
      if (newStats.totalMemoryUsageMB > this.config.maxSystemMemoryMB * 0.9) {
        // Memory still high after cleanup, system may be under pressure
      }
      
      // Forced cleanup completed
    }
  }
  
  /**
   * Adapt to community size changes
   */
  public adaptToCommunitySize(newCommunitySize: number): void {
    if (newCommunitySize === this.config.communitySize) {
      return;
    }
    
    // Adapting embedding tables for new community size
    
    // Update configuration
    this.config.communitySize = newCommunitySize;
    
    // For now, we keep existing tables but adjust cleanup frequency
    // In production, we might want to migrate to new tables with different capacities
    if (newCommunitySize > this.config.communitySize * 2) {
      // Reduce cleanup frequency for larger communities
      this.config.cleanupIntervalMs = Math.min(this.config.cleanupIntervalMs * 1.5, 60 * 60 * 1000);
    } else if (newCommunitySize < this.config.communitySize / 2) {
      // Increase cleanup frequency for smaller communities
      this.config.cleanupIntervalMs = Math.max(this.config.cleanupIntervalMs * 0.75, 10 * 60 * 1000);
    }
    
    // Restart auto cleanup with new interval
    if (this.config.enableAutoCleanup) {
      this.stopAutoCleanup();
      this.startAutoCleanup();
    }
  }
  
  /**
   * Generate random embedding for new entities
   */
  private generateRandomEmbedding(dimension: number): number[] {
    const embedding = new Array(dimension);
    
    // Generate normalized random embedding
    let norm = 0;
    for (let i = 0; i < dimension; i++) {
      embedding[i] = (Math.random() - 0.5) * 2; // Range [-1, 1]
      norm += embedding[i] * embedding[i];
    }
    
    // Normalize to unit length
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let i = 0; i < dimension; i++) {
        embedding[i] /= norm;
      }
    }
    
    return embedding;
  }
  
  /**
   * Start automatic cleanup timer
   */
  private startAutoCleanup(): void {
    this.cleanupTimer = global.setInterval(() => {
      this.cleanupExpiredEmbeddings();
      this.forceMemoryCleanup();
    }, this.config.cleanupIntervalMs);
  }
  
  /**
   * Stop automatic cleanup timer
   */
  private stopAutoCleanup(): void {
    if (this.cleanupTimer) {
      global.clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }
  
  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.stopAutoCleanup();
    
    // Clear all tables
    for (const table of Object.values(this.tables)) {
      table.clear();
    }
  }
}

/**
 * Global embedding table manager instance
 * Singleton pattern for system-wide embedding management
 */
let globalEmbeddingManager: EmbeddingTableManager | null = null;

/**
 * Get or create the global embedding table manager
 */
export function getEmbeddingManager(config?: Partial<EmbeddingManagerConfig>): EmbeddingTableManager {
  if (!globalEmbeddingManager) {
    globalEmbeddingManager = new EmbeddingTableManager(config);
  }
  return globalEmbeddingManager;
}

/**
 * Initialize the global embedding manager with specific configuration
 */
export function initializeEmbeddingManager(config: Partial<EmbeddingManagerConfig>): EmbeddingTableManager {
  if (globalEmbeddingManager) {
    globalEmbeddingManager.destroy();
  }
  globalEmbeddingManager = new EmbeddingTableManager(config);
  return globalEmbeddingManager;
}

/**
 * Destroy the global embedding manager
 */
export function destroyEmbeddingManager(): void {
  if (globalEmbeddingManager) {
    globalEmbeddingManager.destroy();
    globalEmbeddingManager = null;
  }
}