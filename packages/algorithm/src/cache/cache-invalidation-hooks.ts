/**
 * Cache Invalidation Hooks for Algorithm Microservice
 * Simple cache management for algorithm components
 */

export class CacheInvalidationHooks {
  private static cache = new Map<string, any>();
  private static readonly CACHE_TTL = 3600000; // 1 hour in milliseconds

  /**
   * Invalidate cache when user creates a new note
   */
  static async onNoteCreate(userId: string, noteId: string): Promise<void> {
    try {
      // Invalidate user-related caches
      this.invalidateUserCaches(userId);
      
      // Log the invalidation
      console.log(`Cache invalidated for note creation by user ${userId}`);

    } catch (error) {
      console.error('Error in onNoteCreate cache invalidation:', error);
    }
  }

  /**
   * Invalidate cache when user reacts to a note
   */
  static async onNoteReaction(userId: string, noteId: string): Promise<void> {
    try {
      // Invalidate user preferences cache
      this.invalidateUserCaches(userId);
      
      console.log(`Cache invalidated for reaction by user ${userId} on note ${noteId}`);

    } catch (error) {
      console.error('Error in onNoteReaction cache invalidation:', error);
    }
  }

  /**
   * Invalidate cache when user follows someone
   */
  static async onUserFollow(followerId: string, followeeId: string): Promise<void> {
    try {
      // Invalidate both users' caches
      this.invalidateUserCaches(followerId);
      this.invalidateUserCaches(followeeId);
      
      console.log(`Cache invalidated for follow: ${followerId} -> ${followeeId}`);

    } catch (error) {
      console.error('Error in onUserFollow cache invalidation:', error);
    }
  }

  /**
   * Invalidate user-specific caches
   */
  private static invalidateUserCaches(userId: string): void {
    const keysToDelete: string[] = [];
    
    for (const key of this.cache.keys()) {
      if (key.includes(userId)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Set cache entry
   */
  static setCache(key: string, value: any, ttl?: number): void {
    const expiryTime = Date.now() + (ttl || this.CACHE_TTL);
    this.cache.set(key, { value, expiryTime });
  }

  /**
   * Get cache entry
   */
  static getCache(key: string): any | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    if (Date.now() > entry.expiryTime) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value;
  }

  /**
   * Clear all cache
   */
  static clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): {
    totalEntries: number;
    expiredEntries: number;
    memoryUsage: string;
  } {
    let expiredEntries = 0;
    const now = Date.now();
    
    for (const entry of this.cache.values()) {
      if (now > entry.expiryTime) {
        expiredEntries++;
      }
    }
    
    const memoryUsage = `${(this.cache.size * 100 / 1024).toFixed(2)} KB`; // Rough estimate
    
    return {
      totalEntries: this.cache.size,
      expiredEntries,
      memoryUsage
    };
  }
}