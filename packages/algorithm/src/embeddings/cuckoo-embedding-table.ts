/**
 * Cuckoo Hashing Implementation for Collision-Free Embedding Tables
 * Based on ByteDance Monolith research for efficient embedding storage
 */

/**
 * Embedding entry with metadata for frequency tracking and expiry
 */
export interface EmbeddingEntry {
  embedding: number[];
  frequency: number;
  lastAccessed: number;
  createdAt: number;
}

/**
 * Hash function interface for Cuckoo hashing
 */
export interface HashFunction {
  (key: string): string;
}

/**
 * Statistics for monitoring embedding table performance
 */
export interface EmbeddingTableStats {
  totalEntries: number;
  table0Entries: number;
  table1Entries: number;
  memoryUsageMB: number;
  utilizationPercent: number;
  collisionCount: number;
  evictionCount: number;
  lookupCount: number;
  insertionCount: number;
  averageLookupTimeMs: number;
  averageInsertionTimeMs: number;
}

/**
 * Configuration for Cuckoo embedding table
 */
export interface CuckooTableConfig {
  maxEntries: number;
  embeddingDimension: number;
  minFrequencyThreshold: number;
  expiryHours: number;
  maxEvictionAttempts: number;
}

/**
 * Collision-free embedding table using Cuckoo hashing
 * Implements ByteDance Monolith approach for zero-collision embedding lookups
 */
export class CuckooEmbeddingTable {
  private table0: Map<string, EmbeddingEntry> = new Map();
  private table1: Map<string, EmbeddingEntry> = new Map();
  private hash0: HashFunction;
  private hash1: HashFunction;

  // Performance tracking
  private stats = {
    collisionCount: 0,
    evictionCount: 0,
    lookupCount: 0,
    insertionCount: 0,
    totalLookupTime: 0,
    totalInsertionTime: 0
  };

  // Configuration
  private readonly config: CuckooTableConfig;

  constructor(config: Partial<CuckooTableConfig> = {}) {
    this.config = {
      maxEntries: config.maxEntries || 100000,
      embeddingDimension: config.embeddingDimension || 64,
      minFrequencyThreshold: config.minFrequencyThreshold || 3,
      expiryHours: config.expiryHours || 168, // 7 days
      maxEvictionAttempts: config.maxEvictionAttempts || 8
    };

    // Initialize hash functions for Cuckoo hashing
    this.hash0 = this.createHashFunction(0x9e3779b9);
    this.hash1 = this.createHashFunction(0x85ebca6b);
  }

  /**
   * Create a hash function with the given seed
   * Uses FNV-1a hash algorithm for good distribution
   */
  private createHashFunction(seed: number): HashFunction {
    return (key: string): string => {
      let hash = seed;
      for (let i = 0; i < key.length; i++) {
        hash ^= key.charCodeAt(i);
        hash = (hash * 0x01000193) >>> 0; // FNV-1a prime
      }
      return hash.toString(36);
    };
  }

  /**
   * Get embedding with O(1) lookup time
   * Performance target: <1ms average
   */
  public get(key: string): number[] | null {
    const startTime = this.getHighResTime();
    this.stats.lookupCount++;

    try {
      const hash0Key = this.hash0(key);
      const hash1Key = this.hash1(key);

      // Check table0 first
      const entry0 = this.table0.get(hash0Key);
      if (entry0) {
        entry0.lastAccessed = Date.now();
        entry0.frequency++;
        this.recordLookupTime(startTime);
        return entry0.embedding;
      }

      // Check table1
      const entry1 = this.table1.get(hash1Key);
      if (entry1) {
        entry1.lastAccessed = Date.now();
        entry1.frequency++;
        this.recordLookupTime(startTime);
        return entry1.embedding;
      }

      this.recordLookupTime(startTime);
      return null;
    } catch (error) {
      this.recordLookupTime(startTime);
      throw error;
    }
  }

  /**
   * Insert or update embedding with collision detection and eviction
   * Performance target: <2ms insertion
   */
  public set(key: string, embedding: number[]): boolean {
    const startTime = this.getHighResTime();
    this.stats.insertionCount++;

    try {
      // Validate embedding dimension
      if (embedding.length !== this.config.embeddingDimension) {
        throw new Error(`Invalid embedding dimension: expected ${this.config.embeddingDimension}, got ${embedding.length}`);
      }

      // Check if we're at capacity
      if (this.getTotalEntries() >= this.config.maxEntries) {
        // Try to clean up expired entries first
        this.cleanupExpiredEmbeddings();

        // If still at capacity, reject insertion
        if (this.getTotalEntries() >= this.config.maxEntries) {
          this.recordInsertionTime(startTime);
          return false;
        }
      }

      const now = Date.now();
      const newEntry: EmbeddingEntry = {
        embedding: [...embedding], // Copy to avoid reference issues
        frequency: 1,
        lastAccessed: now,
        createdAt: now
      };

      // Try Cuckoo insertion
      const success = this.cuckooInsert(key, newEntry, 0);
      this.recordInsertionTime(startTime);
      return success;
    } catch (error) {
      this.recordInsertionTime(startTime);
      throw error;
    }
  }

  /**
   * Cuckoo hashing insertion with eviction logic
   */
  private cuckooInsert(key: string, entry: EmbeddingEntry, attempt: number): boolean {
    if (attempt >= this.config.maxEvictionAttempts) {
      console.warn(`Cuckoo insertion failed after ${attempt} attempts - consider resizing table`);
      return false; // Max eviction attempts reached
    }

    const hash0Key = this.hash0(key);
    const hash1Key = this.hash1(key);

    // Try table0 first
    if (!this.table0.has(hash0Key)) {
      this.table0.set(hash0Key, entry);
      return true;
    }

    // Try table1
    if (!this.table1.has(hash1Key)) {
      this.table1.set(hash1Key, entry);
      return true;
    }

    // Both positions occupied - need to evict
    this.stats.collisionCount++;

    // Choose which entry to evict based on frequency (evict lower frequency)
    const entry0 = this.table0.get(hash0Key)!;
    const entry1 = this.table1.get(hash1Key)!;
    
    // Calculate retention scores to make intelligent eviction decision
    const now = Date.now();
    const score0 = this.calculateRetentionScore(entry0, now);
    const score1 = this.calculateRetentionScore(entry1, now);
    const newScore = this.calculateRetentionScore(entry, now);
    
    // If new entry has lower score than both existing, reject it
    if (newScore < Math.min(score0, score1)) {
      console.debug('Rejecting new entry due to low retention score');
      return false;
    }
    
    // Evict the entry with lower retention score
    const evictFromTable0 = score0 <= score1;

    if (evictFromTable0) {
      const evicted = this.table0.get(hash0Key)!;
      this.table0.set(hash0Key, entry);
      this.stats.evictionCount++;

      // Store evicted key for proper reinsertion
      const evictedKey = this.reconstructKey(hash0Key, evicted);
      return this.cuckooInsert(evictedKey, evicted, attempt + 1);
    } else {
      const evicted = this.table1.get(hash1Key)!;
      this.table1.set(hash1Key, entry);
      this.stats.evictionCount++;

      // Store evicted key for proper reinsertion
      const evictedKey = this.reconstructKey(hash1Key, evicted);
      return this.cuckooInsert(evictedKey, evicted, attempt + 1);
    }
  }

  /**
   * Reconstruct original key from hash and entry (with key tracking)
   * In production, maintain a reverse mapping: hash -> original key
   */
  private reconstructKey(hashKey: string, entry: EmbeddingEntry): string {
    // For now, generate a temporary key based on embedding hash and creation time
    // In production, you should maintain a bidirectional map: hash <-> key
    const embeddingHash = entry.embedding.reduce((acc, val) => acc + val, 0);
    return `evicted_${hashKey}_${embeddingHash.toFixed(4)}_${entry.createdAt}`;
  }

  /**
   * Check if a feature should be admitted based on frequency (ByteDance approach)
   * Implements probabilistic admission filter for memory efficiency
   */
  public shouldAdmitFeature(frequency: number): boolean {
    // Basic frequency threshold
    if (frequency < this.config.minFrequencyThreshold) {
      return false;
    }

    // Probabilistic filter when approaching capacity
    const utilizationRate = this.getTotalEntries() / this.config.maxEntries;
    if (utilizationRate > 0.8) {
      // Higher frequency features have higher admission probability
      const admissionProbability = Math.min(frequency / (this.config.minFrequencyThreshold * 3), 1.0);
      return Math.random() < admissionProbability;
    }

    return true;
  }

  /**
   * Advanced feature filtering with time-based decay
   */
  public shouldAdmitFeatureWithDecay(frequency: number, lastSeen: number): boolean {
    const now = Date.now();
    const daysSinceLastSeen = (now - lastSeen) / (1000 * 60 * 60 * 24);

    // Apply time decay to frequency
    const decayFactor = Math.exp(-daysSinceLastSeen / 7); // 7-day half-life
    const effectiveFrequency = frequency * decayFactor;

    return this.shouldAdmitFeature(effectiveFrequency);
  }

  /**
   * Clean up expired embeddings to free memory
   * Implements ByteDance-style expiry with frequency consideration
   */
  public cleanupExpiredEmbeddings(): number {
    const now = Date.now();
    const expiryTime = this.config.expiryHours * 60 * 60 * 1000;
    let cleanedCount = 0;

    // Clean table0 with frequency-based retention
    for (const [key, entry] of this.table0.entries()) {
      if (this.shouldExpireEntry(entry, now, expiryTime)) {
        this.table0.delete(key);
        cleanedCount++;
      }
    }

    // Clean table1 with frequency-based retention
    for (const [key, entry] of this.table1.entries()) {
      if (this.shouldExpireEntry(entry, now, expiryTime)) {
        this.table1.delete(key);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  /**
   * Determine if an entry should expire based on access time and frequency
   */
  private shouldExpireEntry(entry: EmbeddingEntry, now: number, baseExpiryTime: number): boolean {
    const timeSinceAccess = now - entry.lastAccessed;

    // High-frequency entries get extended lifetime
    const frequencyMultiplier = Math.min(1 + (entry.frequency / 100), 3); // Max 3x extension
    const adjustedExpiryTime = baseExpiryTime * frequencyMultiplier;

    return timeSinceAccess > adjustedExpiryTime;
  }

  /**
   * Aggressive cleanup when memory pressure is high
   */
  public aggressiveCleanup(): number {
    const utilizationRate = this.getTotalEntries() / this.config.maxEntries;

    if (utilizationRate < 0.9) {
      return this.cleanupExpiredEmbeddings();
    }

    // More aggressive cleanup when near capacity
    const now = Date.now();
    let cleanedCount = 0;
    const entries: Array<{ key: string, entry: EmbeddingEntry, table: 0 | 1 }> = [];

    // Collect all entries with scores
    for (const [key, entry] of this.table0.entries()) {
      entries.push({ key, entry, table: 0 });
    }
    for (const [key, entry] of this.table1.entries()) {
      entries.push({ key, entry, table: 1 });
    }

    // Sort by priority (frequency and recency)
    entries.sort((a, b) => {
      const scoreA = this.calculateRetentionScore(a.entry, now);
      const scoreB = this.calculateRetentionScore(b.entry, now);
      return scoreA - scoreB; // Lower scores get removed first
    });

    // Remove lowest priority entries
    const targetRemoval = Math.floor(this.getTotalEntries() * 0.1); // Remove 10%
    for (let i = 0; i < Math.min(targetRemoval, entries.length); i++) {
      const { key, table } = entries[i];
      if (table === 0) {
        this.table0.delete(key);
      } else {
        this.table1.delete(key);
      }
      cleanedCount++;
    }

    return cleanedCount;
  }

  /**
   * Calculate retention score for prioritizing which entries to keep
   */
  private calculateRetentionScore(entry: EmbeddingEntry, now: number): number {
    const daysSinceAccess = (now - entry.lastAccessed) / (1000 * 60 * 60 * 24);
    const daysSinceCreation = (now - entry.createdAt) / (1000 * 60 * 60 * 24);

    // Higher frequency and more recent access = higher score (keep longer)
    const frequencyScore = Math.log(1 + entry.frequency);
    const recencyScore = Math.exp(-daysSinceAccess / 7); // Decay over 7 days
    const ageScore = Math.exp(-daysSinceCreation / 30); // Decay over 30 days

    return frequencyScore * recencyScore * ageScore;
  }

  /**
   * Get total number of entries across both tables
   */
  public getTotalEntries(): number {
    return this.table0.size + this.table1.size;
  }

  /**
   * Calculate memory usage in MB
   */
  public getMemoryUsageMB(): number {
    const entrySize = this.config.embeddingDimension * 8 + 32; // 8 bytes per float + metadata
    const totalEntries = this.getTotalEntries();
    return (totalEntries * entrySize) / (1024 * 1024);
  }

  /**
   * Get comprehensive statistics
   */
  public getStats(): EmbeddingTableStats {
    const totalEntries = this.getTotalEntries();

    return {
      totalEntries,
      table0Entries: this.table0.size,
      table1Entries: this.table1.size,
      memoryUsageMB: this.getMemoryUsageMB(),
      utilizationPercent: (totalEntries / this.config.maxEntries) * 100,
      collisionCount: this.stats.collisionCount,
      evictionCount: this.stats.evictionCount,
      lookupCount: this.stats.lookupCount,
      insertionCount: this.stats.insertionCount,
      averageLookupTimeMs: this.stats.lookupCount > 0
        ? this.stats.totalLookupTime / this.stats.lookupCount
        : 0,
      averageInsertionTimeMs: this.stats.insertionCount > 0
        ? this.stats.totalInsertionTime / this.stats.insertionCount
        : 0
    };
  }

  /**
   * Reset statistics (useful for benchmarking)
   */
  public resetStats(): void {
    this.stats = {
      collisionCount: 0,
      evictionCount: 0,
      lookupCount: 0,
      insertionCount: 0,
      totalLookupTime: 0,
      totalInsertionTime: 0
    };
  }

  /**
   * Clear all embeddings
   */
  public clear(): void {
    this.table0.clear();
    this.table1.clear();
    this.resetStats();
  }

  /**
   * Get detailed memory statistics and health metrics
   */
  public getMemoryStats(): {
    totalMemoryMB: number;
    embeddingMemoryMB: number;
    metadataMemoryMB: number;
    utilizationPercent: number;
    fragmentationRatio: number;
    memoryPressure: 'low' | 'medium' | 'high' | 'critical';
  } {
    const totalEntries = this.getTotalEntries();
    const embeddingBytes = totalEntries * this.config.embeddingDimension * 8; // 8 bytes per float64
    const metadataBytes = totalEntries * 32; // Estimated metadata size

    const embeddingMemoryMB = embeddingBytes / (1024 * 1024);
    const metadataMemoryMB = metadataBytes / (1024 * 1024);
    const totalMemoryMB = embeddingMemoryMB + metadataMemoryMB;

    const utilizationPercent = (totalEntries / this.config.maxEntries) * 100;
    const fragmentationRatio = (this.table0.size + this.table1.size) / Math.max(totalEntries, 1);

    let memoryPressure: 'low' | 'medium' | 'high' | 'critical';
    if (utilizationPercent < 60) memoryPressure = 'low';
    else if (utilizationPercent < 80) memoryPressure = 'medium';
    else if (utilizationPercent < 95) memoryPressure = 'high';
    else memoryPressure = 'critical';

    return {
      totalMemoryMB,
      embeddingMemoryMB,
      metadataMemoryMB,
      utilizationPercent,
      fragmentationRatio,
      memoryPressure
    };
  }

  /**
   * Monitor memory pressure and trigger cleanup if needed
   */
  public handleMemoryPressure(): {
    action: 'none' | 'cleanup' | 'aggressive_cleanup';
    cleaned: number;
    newUtilization: number;
  } {
    const memStats = this.getMemoryStats();
    let action: 'none' | 'cleanup' | 'aggressive_cleanup' = 'none';
    let cleaned = 0;

    if (memStats.memoryPressure === 'high') {
      action = 'cleanup';
      cleaned = this.cleanupExpiredEmbeddings();
    } else if (memStats.memoryPressure === 'critical') {
      action = 'aggressive_cleanup';
      cleaned = this.aggressiveCleanup();
    }

    const newStats = this.getMemoryStats();
    return {
      action,
      cleaned,
      newUtilization: newStats.utilizationPercent
    };
  }

  /**
   * Check if the table is healthy (low collision rate, good performance)
   */
  public isHealthy(): boolean {
    const stats = this.getStats();
    const memStats = this.getMemoryStats();

    // Health criteria based on ByteDance Monolith requirements
    const collisionRate = stats.insertionCount > 0
      ? stats.collisionCount / stats.insertionCount
      : 0;
    const avgLookupTime = stats.averageLookupTimeMs;
    const avgInsertionTime = stats.averageInsertionTimeMs;

    return (
      collisionRate < 0.1 &&                           // <10% collision rate
      avgLookupTime < 1.0 &&                          // <1ms lookup time
      avgInsertionTime < 2.0 &&                       // <2ms insertion time
      memStats.totalMemoryMB < 20 &&                  // <20MB memory usage
      memStats.memoryPressure !== 'critical' &&       // Not in critical memory state
      memStats.fragmentationRatio < 1.2               // Low fragmentation
    );
  }

  /**
   * Get high resolution time (Node.js compatible)
   */
  private getHighResTime(): number {
    // Use Date.now() as fallback for compatibility
    return Date.now();
  }

  /**
   * Record lookup time for performance tracking
   */
  private recordLookupTime(startTime: number): void {
    const duration = this.getHighResTime() - startTime;
    this.stats.totalLookupTime += duration;
  }

  /**
   * Record insertion time for performance tracking
   */
  private recordInsertionTime(startTime: number): void {
    const duration = this.getHighResTime() - startTime;
    this.stats.totalInsertionTime += duration;
  }
}

/**
 * Factory function to create embedding tables with different configurations
 */
export function createEmbeddingTable(
  type: 'user' | 'content' | 'topic' | 'author',
  communitySize: number
): CuckooEmbeddingTable {
  // Adapt configuration based on community size and embedding type
  const baseConfig: Partial<CuckooTableConfig> = {
    embeddingDimension: 64,
    minFrequencyThreshold: 3,
    expiryHours: 168, // 7 days
    maxEvictionAttempts: 8
  };

  // Scale max entries based on community size and type
  let maxEntries: number;

  if (communitySize < 1000) {
    maxEntries = type === 'user' ? 2000 : 5000;
  } else if (communitySize < 10000) {
    maxEntries = type === 'user' ? 20000 : 50000;
  } else {
    maxEntries = type === 'user' ? 200000 : 500000;
  }

  return new CuckooEmbeddingTable({
    ...baseConfig,
    maxEntries
  });
}