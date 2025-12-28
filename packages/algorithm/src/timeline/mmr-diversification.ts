/**
 * MMR (Maximal Marginal Relevance) Algorithm
 * Implements diversification for timeline generation with real-time performance
 */

/**
 * Content item for MMR processing
 */
export interface MMRContentItem {
  id: string;
  userId: string;
  authorId: string;
  text?: string;
  tags?: string[];
  createdAt: Date;
  relevanceScore: number;
  embedding?: number[];
  metadata?: {
    contentType: 'text' | 'image' | 'video' | 'poll';
    language?: string;
    topics?: string[];
    sentiment?: number;
  };
}

/**
 * MMR configuration parameters
 */
export interface MMRConfig {
  lambda: number; // Diversity vs relevance trade-off (0-1)
  maxResults: number; // Maximum items to return
  similarityThreshold: number; // Minimum similarity to consider as duplicate
  performanceTarget: number; // Target processing time in ms
  enableCaching: boolean;
  cacheSize: number;
}

/**
 * MMR processing result
 */
export interface MMRResult {
  selectedItems: MMRContentItem[];
  diversityScore: number;
  averageRelevance: number;
  processingTimeMs: number;
  cacheHitRate: number;
  similarityMatrix?: number[][];
}

/**
 * Similarity calculation methods
 */
export type SimilarityMethod = 'cosine' | 'jaccard' | 'semantic' | 'hybrid';

/**
 * MMR Algorithm Implementation
 * Optimized for real-time timeline generation with <20ms target
 */
export class MMRDiversification {
  private config: MMRConfig;
  private similarityCache = new Map<string, number>();
  private embeddingCache = new Map<string, number[]>();
  private processingStats = {
    totalProcessed: 0,
    totalTime: 0,
    cacheHits: 0,
    cacheMisses: 0
  };
  
  constructor(config: Partial<MMRConfig> = {}) {
    this.config = {
      lambda: config.lambda || 0.7, // 70% relevance, 30% diversity
      maxResults: config.maxResults || 20,
      similarityThreshold: config.similarityThreshold || 0.8,
      performanceTarget: config.performanceTarget || 20, // 20ms
      enableCaching: config.enableCaching ?? true,
      cacheSize: config.cacheSize || 10000
    };
  }
  
  /**
   * Apply MMR algorithm to diversify content selection
   * Performance target: <20ms for 100 items
   */
  public diversifyContent(
    candidates: MMRContentItem[],
    method: SimilarityMethod = 'hybrid'
  ): MMRResult {
    const startTime = Date.now();
    
    if (candidates.length === 0) {
      return this.createEmptyResult(startTime);
    }
    
    // Sort candidates by relevance score (descending)
    const sortedCandidates = [...candidates].sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    // Initialize result with highest relevance item
    const selectedItems: MMRContentItem[] = [sortedCandidates[0]];
    const remainingCandidates = sortedCandidates.slice(1);
    
    // Pre-compute embeddings for performance
    this.precomputeEmbeddings(sortedCandidates);
    
    // MMR selection loop
    while (selectedItems.length < this.config.maxResults && remainingCandidates.length > 0) {
      let bestItem: MMRContentItem | null = null;
      let bestScore = -Infinity;
      let bestIndex = -1;
      
      // Find item with highest MMR score
      for (let i = 0; i < remainingCandidates.length; i++) {
        const candidate = remainingCandidates[i];
        const mmrScore = this.calculateMMRScore(candidate, selectedItems, method);
        
        if (mmrScore > bestScore) {
          bestScore = mmrScore;
          bestItem = candidate;
          bestIndex = i;
        }
      }
      
      // Add best item and remove from candidates
      if (bestItem) {
        selectedItems.push(bestItem);
        remainingCandidates.splice(bestIndex, 1);
      } else {
        break; // No more suitable items
      }
      
      // Performance check - break if taking too long
      if (Date.now() - startTime > this.config.performanceTarget) {
        break;
      }
    }
    
    const processingTime = Date.now() - startTime;
    this.updateStats(processingTime);
    
    return {
      selectedItems,
      diversityScore: this.calculateDiversityScore(selectedItems),
      averageRelevance: this.calculateAverageRelevance(selectedItems),
      processingTimeMs: processingTime,
      cacheHitRate: this.getCacheHitRate()
    };
  }
  
  /**
   * Calculate MMR score for a candidate item
   * MMR = λ * Relevance - (1-λ) * max(Similarity to selected items)
   */
  private calculateMMRScore(
    candidate: MMRContentItem,
    selectedItems: MMRContentItem[],
    method: SimilarityMethod
  ): number {
    const relevanceScore = candidate.relevanceScore;
    
    if (selectedItems.length === 0) {
      return relevanceScore;
    }
    
    // Find maximum similarity to any selected item
    let maxSimilarity = 0;
    for (const selectedItem of selectedItems) {
      const similarity = this.calculateSimilarity(candidate, selectedItem, method);
      maxSimilarity = Math.max(maxSimilarity, similarity);
    }
    
    // MMR formula
    return this.config.lambda * relevanceScore - (1 - this.config.lambda) * maxSimilarity;
  }
  
  /**
   * Calculate similarity between two content items
   */
  private calculateSimilarity(
    item1: MMRContentItem,
    item2: MMRContentItem,
    method: SimilarityMethod
  ): number {
    const cacheKey = `${item1.id}-${item2.id}-${method}`;
    
    // Check cache first
    if (this.config.enableCaching && this.similarityCache.has(cacheKey)) {
      this.processingStats.cacheHits++;
      return this.similarityCache.get(cacheKey)!;
    }
    
    this.processingStats.cacheMisses++;
    
    let similarity: number;
    
    switch (method) {
      case 'cosine':
        similarity = this.calculateCosineSimilarity(item1, item2);
        break;
      case 'jaccard':
        similarity = this.calculateJaccardSimilarity(item1, item2);
        break;
      case 'semantic':
        similarity = this.calculateSemanticSimilarity(item1, item2);
        break;
      case 'hybrid':
        similarity = this.calculateHybridSimilarity(item1, item2);
        break;
      default:
        similarity = 0;
    }
    
    // Cache result
    if (this.config.enableCaching) {
      this.cacheResult(cacheKey, similarity);
    }
    
    return similarity;
  }
  
  /**
   * Calculate cosine similarity using embeddings
   */
  private calculateCosineSimilarity(item1: MMRContentItem, item2: MMRContentItem): number {
    const embedding1 = this.getEmbedding(item1);
    const embedding2 = this.getEmbedding(item2);
    
    if (!embedding1 || !embedding2 || embedding1.length !== embedding2.length) {
      return 0;
    }
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }
    
    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    return magnitude > 0 ? dotProduct / magnitude : 0;
  }
  
  /**
   * Calculate Jaccard similarity using tags/topics
   */
  private calculateJaccardSimilarity(item1: MMRContentItem, item2: MMRContentItem): number {
    const tags1 = new Set([
      ...(item1.tags || []),
      ...(item1.metadata?.topics || [])
    ]);
    
    const tags2 = new Set([
      ...(item2.tags || []),
      ...(item2.metadata?.topics || [])
    ]);
    
    if (tags1.size === 0 && tags2.size === 0) {
      return 0;
    }
    
    const intersection = new Set([...tags1].filter(tag => tags2.has(tag)));
    const union = new Set([...tags1, ...tags2]);
    
    return intersection.size / union.size;
  }
  
  /**
   * Calculate semantic similarity using text content
   */
  private calculateSemanticSimilarity(item1: MMRContentItem, item2: MMRContentItem): number {
    // Author similarity (same author = high similarity)
    if (item1.authorId === item2.authorId) {
      return 0.8;
    }
    
    // Content type similarity
    const type1 = item1.metadata?.contentType || 'text';
    const type2 = item2.metadata?.contentType || 'text';
    
    if (type1 !== type2) {
      return 0.2; // Different content types are less similar
    }
    
    // Time-based similarity (recent posts are more similar)
    const timeDiff = Math.abs(item1.createdAt.getTime() - item2.createdAt.getTime());
    const hoursDiff = timeDiff / (1000 * 60 * 60);
    const timeSimilarity = Math.exp(-hoursDiff / 24); // 24-hour decay
    
    // Simple text similarity (word overlap)
    const textSimilarity = this.calculateTextSimilarity(item1.text || '', item2.text || '');
    
    return (timeSimilarity * 0.3 + textSimilarity * 0.7);
  }
  
  /**
   * Calculate hybrid similarity combining multiple methods
   */
  private calculateHybridSimilarity(item1: MMRContentItem, item2: MMRContentItem): number {
    const cosine = this.calculateCosineSimilarity(item1, item2);
    const jaccard = this.calculateJaccardSimilarity(item1, item2);
    const semantic = this.calculateSemanticSimilarity(item1, item2);
    
    // Weighted combination
    return cosine * 0.4 + jaccard * 0.3 + semantic * 0.3;
  }
  
  /**
   * Simple text similarity using word overlap
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    if (!text1 || !text2) return 0;
    
    const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
    const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 2));
    
    if (words1.size === 0 && words2.size === 0) return 0;
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }
  
  /**
   * Get or generate embedding for content item
   */
  private getEmbedding(item: MMRContentItem): number[] | null {
    // Use provided embedding if available
    if (item.embedding) {
      return item.embedding;
    }
    
    // Check cache
    if (this.embeddingCache.has(item.id)) {
      return this.embeddingCache.get(item.id)!;
    }
    
    // Generate simple embedding based on content features
    const embedding = this.generateSimpleEmbedding(item);
    this.embeddingCache.set(item.id, embedding);
    
    return embedding;
  }
  
  /**
   * Generate simple embedding from content features
   */
  private generateSimpleEmbedding(item: MMRContentItem): number[] {
    const embedding = new Array(64).fill(0);
    
    // Author ID hash
    const authorHash = this.hashString(item.authorId);
    embedding[0] = (authorHash % 1000) / 1000;
    
    // Content length
    const textLength = item.text?.length || 0;
    embedding[1] = Math.min(textLength / 1000, 1);
    
    // Tag features
    if (item.tags) {
      for (let i = 0; i < Math.min(item.tags.length, 10); i++) {
        const tagHash = this.hashString(item.tags[i]);
        embedding[2 + i] = (tagHash % 1000) / 1000;
      }
    }
    
    // Time features
    const hour = item.createdAt.getHours();
    embedding[12] = hour / 24;
    
    // Content type
    const contentType = item.metadata?.contentType || 'text';
    embedding[13] = contentType === 'text' ? 0.2 : contentType === 'image' ? 0.4 : 0.6;
    
    // Relevance score
    embedding[14] = item.relevanceScore;
    
    // Normalize embedding
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (norm > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= norm;
      }
    }
    
    return embedding;
  }
  
  /**
   * Pre-compute embeddings for performance
   */
  private precomputeEmbeddings(items: MMRContentItem[]): void {
    for (const item of items) {
      if (!item.embedding && !this.embeddingCache.has(item.id)) {
        this.getEmbedding(item);
      }
    }
  }
  
  /**
   * Calculate diversity score for selected items
   */
  private calculateDiversityScore(items: MMRContentItem[]): number {
    if (items.length <= 1) return 1;
    
    let totalSimilarity = 0;
    let pairCount = 0;
    
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        totalSimilarity += this.calculateSimilarity(items[i], items[j], 'hybrid');
        pairCount++;
      }
    }
    
    const averageSimilarity = pairCount > 0 ? totalSimilarity / pairCount : 0;
    return 1 - averageSimilarity; // Higher diversity = lower average similarity
  }
  
  /**
   * Calculate average relevance of selected items
   */
  private calculateAverageRelevance(items: MMRContentItem[]): number {
    if (items.length === 0) return 0;
    
    const totalRelevance = items.reduce((sum, item) => sum + item.relevanceScore, 0);
    return totalRelevance / items.length;
  }
  
  /**
   * Cache similarity result with size management
   */
  private cacheResult(key: string, similarity: number): void {
    if (this.similarityCache.size >= this.config.cacheSize) {
      // Simple LRU: remove oldest entries
      const keysToRemove = Array.from(this.similarityCache.keys()).slice(0, this.config.cacheSize * 0.1);
      keysToRemove.forEach(k => this.similarityCache.delete(k));
    }
    
    this.similarityCache.set(key, similarity);
  }
  
  /**
   * Get cache hit rate
   */
  private getCacheHitRate(): number {
    const total = this.processingStats.cacheHits + this.processingStats.cacheMisses;
    return total > 0 ? this.processingStats.cacheHits / total : 0;
  }
  
  /**
   * Update processing statistics
   */
  private updateStats(processingTime: number): void {
    this.processingStats.totalProcessed++;
    this.processingStats.totalTime += processingTime;
  }
  
  /**
   * Get processing statistics
   */
  public getStats(): {
    totalProcessed: number;
    averageProcessingTime: number;
    cacheHitRate: number;
    cacheSize: number;
  } {
    return {
      totalProcessed: this.processingStats.totalProcessed,
      averageProcessingTime: this.processingStats.totalProcessed > 0 
        ? this.processingStats.totalTime / this.processingStats.totalProcessed 
        : 0,
      cacheHitRate: this.getCacheHitRate(),
      cacheSize: this.similarityCache.size
    };
  }
  
  /**
   * Clear caches and reset statistics
   */
  public clearCache(): void {
    this.similarityCache.clear();
    this.embeddingCache.clear();
    this.processingStats = {
      totalProcessed: 0,
      totalTime: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }
  
  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<MMRConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
  
  /**
   * Utility methods
   */
  private createEmptyResult(startTime: number): MMRResult {
    return {
      selectedItems: [],
      diversityScore: 0,
      averageRelevance: 0,
      processingTimeMs: Date.now() - startTime,
      cacheHitRate: 0
    };
  }
  
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}