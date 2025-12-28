/**
 * Real-Time Learning System
 * Based on ByteDance Monolith approach with incremental parameter synchronization
 */

import { EmbeddingTableManager, type EmbeddingType } from '../embeddings/index.js';
import type { MonolithFeatures } from '../ranker/monolith-inspired-ranker.js';

/**
 * Training sample for online learning
 */
export interface TrainingSample {
  features: MonolithFeatures;
  engagement: number;
  timestamp: number;
  weight: number;
}

/**
 * Parameter update for sparse synchronization
 */
export interface ParameterUpdate {
  type: EmbeddingType;
  id: string;
  embedding: number[];
  gradient: number[];
  timestamp: number;
}

/**
 * Synchronization statistics
 */
export interface SyncStats {
  lastSyncTime: number;
  nextSyncTime: number;
  touchedKeysCount: number;
  sparseUpdatesCount: number;
  denseUpdatesCount: number;
  syncDurationMs: number;
  failureCount: number;
  successCount: number;
}

/**
 * Learning configuration
 */
export interface LearningConfig {
  syncIntervalMs: number;
  maxTrainingBuffer: number;
  learningRate: number;
  momentumDecay: number;
  gradientClipping: number;
  enableSparseUpdates: boolean;
  enableDenseUpdates: boolean;
  snapshotIntervalMs: number;
}

/**
 * Real-time learning system with ByteDance Monolith-inspired parameter sync
 */
export class RealTimeLearningSystem {
  private trainingBuffer: TrainingSample[] = [];
  private touchedKeys: Set<string> = new Set();
  private parameterUpdates: Map<string, ParameterUpdate> = new Map();
  
  // Thread-safety flags
  private syncInProgress = false;
  private bufferLock = false;
  
  // Model weights (dense parameters)
  private modelWeights = {
    user_engagement_rate: 0.25,
    content_length_normalized: 0.15,
    content_age_hours: -0.10,
    social_proof_score: 0.20,
    author_user_affinity: 0.30,
    topic_similarity_score: 0.25,
    temporal_match_score: 0.10,
    community_size_factor: 0.05,
    personalization_strength: 0.15,
    discovery_boost: 0.10
  };
  
  // Momentum for gradient updates
  private momentum: Record<string, number> = {};
  
  // Sync statistics
  private syncStats: SyncStats = {
    lastSyncTime: 0,
    nextSyncTime: 0,
    touchedKeysCount: 0,
    sparseUpdatesCount: 0,
    denseUpdatesCount: 0,
    syncDurationMs: 0,
    failureCount: 0,
    successCount: 0
  };
  
  private config: LearningConfig;
  private embeddingManager: EmbeddingTableManager;
  private syncTimer?: NodeJS.Timeout;
  private snapshotTimer?: NodeJS.Timeout;
  
  constructor(
    embeddingManager: EmbeddingTableManager,
    config: Partial<LearningConfig> = {}
  ) {
    this.embeddingManager = embeddingManager;
    this.config = {
      syncIntervalMs: config.syncIntervalMs || 5 * 60 * 1000, // 5 minutes (vs ByteDance's 1 minute)
      maxTrainingBuffer: config.maxTrainingBuffer || 1000,
      learningRate: config.learningRate || 0.01,
      momentumDecay: config.momentumDecay || 0.9,
      gradientClipping: config.gradientClipping || 1.0,
      enableSparseUpdates: config.enableSparseUpdates ?? true,
      enableDenseUpdates: config.enableDenseUpdates ?? true,
      snapshotIntervalMs: config.snapshotIntervalMs || 24 * 60 * 60 * 1000 // 24 hours
    };
    
    // Initialize momentum
    for (const key of Object.keys(this.modelWeights)) {
      this.momentum[key] = 0;
    }
    
    this.startPeriodicSync();
    this.startPeriodicSnapshots();
  }
  
  /**
   * Record engagement for online learning (ByteDance approach)
   * Thread-safe with buffer locking
   */
  public recordEngagement(features: MonolithFeatures, engagementType: string): void {
    // Wait for buffer lock to be released (simple spin-wait with timeout)
    let attempts = 0;
    while (this.bufferLock && attempts < 100) {
      attempts++;
      // In production, use proper mutex/semaphore
    }
    
    if (this.bufferLock) {
      console.warn('Training buffer locked - dropping engagement record');
      return;
    }
    
    try {
      this.bufferLock = true;
      
      const engagementScore = this.getEngagementScore(engagementType);
      const timestamp = Date.now();
      
      // Calculate sample weight based on recency and engagement strength
      const weight = this.calculateSampleWeight(engagementScore, timestamp);
      
      // Add to training buffer
      const sample: TrainingSample = {
        features,
        engagement: engagementScore,
        timestamp,
        weight
      };
      
      this.trainingBuffer.push(sample);
      
      // Limit buffer size (FIFO)
      if (this.trainingBuffer.length > this.config.maxTrainingBuffer) {
        this.trainingBuffer.shift();
      }
      
      // Track touched keys for incremental sync (ByteDance key insight)
      this.trackTouchedKeys(features);
      
      // Immediate learning for high-value signals
      if (this.isHighValueSignal(engagementType)) {
        this.performImmediateLearning(sample);
      }
      
      // Update sync statistics
      this.syncStats.touchedKeysCount = this.touchedKeys.size;
    } finally {
      this.bufferLock = false;
    }
  }
  
  /**
   * Track touched keys for sparse parameter updates
   */
  private trackTouchedKeys(features: MonolithFeatures): void {
    // Track sparse features that need embedding updates
    this.touchedKeys.add(`user:${features.user_id}`);
    this.touchedKeys.add(`author:${features.author_id}`);
    
    for (const topic of features.content_topics) {
      this.touchedKeys.add(`topic:${topic}`);
    }
  }
  
  /**
   * Perform immediate learning for high-value signals
   */
  private performImmediateLearning(sample: TrainingSample): void {
    // Update embeddings immediately for high-value interactions
    this.updateEmbeddingsFromSample(sample);
    
    // Update dense parameters with single sample
    this.updateDenseParameters([sample]);
  }
  
  /**
   * Update embeddings based on training sample
   */
  private updateEmbeddingsFromSample(sample: TrainingSample): void {
    const { features, engagement } = sample;
    const error = engagement - this.predictEngagementScore(features);
    
    // Update user embedding
    this.updateEmbedding('user', features.user_id, error * 0.1);
    
    // Update author embedding
    this.updateEmbedding('author', features.author_id, error * 0.1);
    
    // Update topic embeddings
    for (const topic of features.content_topics) {
      this.updateEmbedding('topic', topic, error * 0.05);
    }
  }
  
  /**
   * Update a single embedding with gradient
   */
  private updateEmbedding(type: EmbeddingType, id: string, gradient: number): void {
    const embedding = this.embeddingManager.getEmbedding(type, id);
    if (!embedding) return;
    
    // Simple gradient update
    const updatedEmbedding = embedding.map(val => 
      val + this.config.learningRate * gradient * (Math.random() - 0.5) * 0.1
    );
    
    // Store parameter update for sync
    const key = `${type}:${id}`;
    this.parameterUpdates.set(key, {
      type,
      id,
      embedding: updatedEmbedding,
      gradient: new Array(embedding.length).fill(gradient),
      timestamp: Date.now()
    });
    
    // Apply update immediately
    this.embeddingManager.setEmbedding(type, id, updatedEmbedding);
  }
  
  /**
   * Update dense model parameters
   */
  private updateDenseParameters(samples: TrainingSample[]): void {
    if (samples.length === 0) return;
    
    const gradients: Record<string, number> = {};
    
    // Initialize gradients
    for (const key of Object.keys(this.modelWeights)) {
      gradients[key] = 0;
    }
    
    // Compute gradients from samples
    for (const sample of samples) {
      const prediction = this.predictEngagementScore(sample.features);
      const error = sample.engagement - prediction;
      const weightedError = error * sample.weight;
      
      // Compute gradients for each feature
      gradients.user_engagement_rate += weightedError * sample.features.user_engagement_rate;
      gradients.content_length_normalized += weightedError * sample.features.content_length_normalized;
      gradients.content_age_hours += weightedError * sample.features.content_age_hours;
      gradients.social_proof_score += weightedError * sample.features.social_proof_score;
      gradients.author_user_affinity += weightedError * sample.features.author_user_affinity;
      gradients.topic_similarity_score += weightedError * sample.features.topic_similarity_score;
      gradients.temporal_match_score += weightedError * sample.features.temporal_match_score;
      gradients.community_size_factor += weightedError * sample.features.community_size_factor;
      gradients.personalization_strength += weightedError * sample.features.personalization_strength;
      gradients.discovery_boost += weightedError * sample.features.discovery_boost;
    }
    
    // Apply gradients with momentum
    for (const [key, gradient] of Object.entries(gradients)) {
      const avgGradient = gradient / samples.length;
      const clippedGradient = this.clipGradient(avgGradient);
      
      // Update momentum
      this.momentum[key] = this.config.momentumDecay * this.momentum[key] + 
                          (1 - this.config.momentumDecay) * clippedGradient;
      
      // Update weight
      (this.modelWeights as any)[key] += this.config.learningRate * this.momentum[key];
    }
  }
  
  /**
   * Predict engagement score using current model
   */
  private predictEngagementScore(features: MonolithFeatures): number {
    let score = 0;
    score += features.user_engagement_rate * this.modelWeights.user_engagement_rate;
    score += features.content_length_normalized * this.modelWeights.content_length_normalized;
    score += features.content_age_hours * this.modelWeights.content_age_hours;
    score += features.social_proof_score * this.modelWeights.social_proof_score;
    score += features.author_user_affinity * this.modelWeights.author_user_affinity;
    score += features.topic_similarity_score * this.modelWeights.topic_similarity_score;
    score += features.temporal_match_score * this.modelWeights.temporal_match_score;
    score += features.community_size_factor * this.modelWeights.community_size_factor;
    score += features.personalization_strength * this.modelWeights.personalization_strength;
    score += features.discovery_boost * this.modelWeights.discovery_boost;
    
    return this.sigmoid(score);
  }
  
  /**
   * Perform incremental parameter synchronization (ByteDance approach)
   * Thread-safe with sync locking
   */
  public async performIncrementalSync(): Promise<void> {
    // Prevent concurrent sync operations
    if (this.syncInProgress) {
      console.warn('Sync already in progress - skipping');
      return;
    }
    
    this.syncInProgress = true;
    const startTime = Date.now();
    
    try {
      let sparseUpdates = 0;
      let denseUpdates = 0;
      
      // Sync sparse parameters (only touched embeddings)
      if (this.config.enableSparseUpdates && this.touchedKeys.size > 0) {
        sparseUpdates = await this.syncSparseParameters();
      }
      
      // Sync dense parameters if we have training data
      if (this.config.enableDenseUpdates && this.trainingBuffer.length > 0) {
        denseUpdates = await this.syncDenseParameters();
      }
      
      // Update statistics
      const syncDuration = Date.now() - startTime;
      this.syncStats = {
        ...this.syncStats,
        lastSyncTime: startTime,
        nextSyncTime: startTime + this.config.syncIntervalMs,
        sparseUpdatesCount: sparseUpdates,
        denseUpdatesCount: denseUpdates,
        syncDurationMs: syncDuration,
        successCount: this.syncStats.successCount + 1
      };
      
      // Clear touched keys after successful sync
      this.touchedKeys.clear();
      
      console.log(`Incremental sync completed: ${sparseUpdates} sparse + ${denseUpdates} dense updates in ${syncDuration}ms`);
      
    } catch (error) {
      this.syncStats.failureCount++;
      console.error('Incremental sync failed:', error);
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }
  
  /**
   * Sync sparse parameters (embeddings)
   */
  private async syncSparseParameters(): Promise<number> {
    let updateCount = 0;
    
    // Process parameter updates
    for (const [key, update] of this.parameterUpdates.entries()) {
      try {
        // In a real system, this would push to a parameter server
        // For now, we just ensure the embedding is stored
        const success = this.embeddingManager.setEmbedding(
          update.type, 
          update.id, 
          update.embedding
        );
        
        if (success) {
          updateCount++;
        }
      } catch (error) {
        console.warn(`Failed to sync parameter ${key}:`, error);
      }
    }
    
    // Clear processed updates
    this.parameterUpdates.clear();
    
    return updateCount;
  }
  
  /**
   * Sync dense parameters
   */
  private async syncDenseParameters(): Promise<number> {
    // Update dense parameters from training buffer
    this.updateDenseParameters(this.trainingBuffer);
    
    // In a real system, this would push weights to a parameter server
    // For now, we just return the number of weight parameters
    return Object.keys(this.modelWeights).length;
  }
  
  /**
   * Start periodic synchronization
   */
  private startPeriodicSync(): void {
    this.syncTimer = setInterval(() => {
      this.performIncrementalSync().catch(error => {
        console.error('Periodic sync failed:', error);
      });
    }, this.config.syncIntervalMs);
    
    // Set initial next sync time
    this.syncStats.nextSyncTime = Date.now() + this.config.syncIntervalMs;
  }
  
  /**
   * Start periodic snapshots for disaster recovery
   */
  private startPeriodicSnapshots(): void {
    this.snapshotTimer = setInterval(() => {
      this.createSnapshot().catch(error => {
        console.error('Snapshot creation failed:', error);
      });
    }, this.config.snapshotIntervalMs);
  }
  
  /**
   * Create snapshot for disaster recovery
   */
  private async createSnapshot(): Promise<void> {
    const snapshot = {
      timestamp: Date.now(),
      modelWeights: { ...this.modelWeights },
      momentum: { ...this.momentum },
      embeddingStats: this.embeddingManager.getSystemStats(),
      syncStats: { ...this.syncStats }
    };
    
    // In a real system, this would be saved to persistent storage
    console.log('Snapshot created:', {
      timestamp: snapshot.timestamp,
      modelWeights: Object.keys(snapshot.modelWeights).length,
      embeddingTables: Object.keys(snapshot.embeddingStats.tableStats).length
    });
  }
  
  /**
   * Get synchronization statistics
   */
  public getSyncStats(): SyncStats {
    return { ...this.syncStats };
  }
  
  /**
   * Get current model weights
   */
  public getModelWeights(): Record<string, number> {
    return { ...this.modelWeights };
  }
  
  /**
   * Helper methods
   */
  private calculateSampleWeight(engagementScore: number, timestamp: number): number {
    // Higher engagement gets higher weight
    const engagementWeight = 1 + engagementScore;
    
    // More recent samples get higher weight
    const age = Date.now() - timestamp;
    const recencyWeight = Math.exp(-age / (1000 * 60 * 60)); // 1-hour half-life
    
    return engagementWeight * recencyWeight;
  }
  
  private getEngagementScore(engagementType: string): number {
    const scores: Record<string, number> = {
      'view': 0.1,
      'reaction': 0.3,
      'reply': 0.7,
      'renote': 0.5,
      'follow': 0.8,
      'bookmark': 0.6
    };
    return scores[engagementType] || 0.1;
  }
  
  private isHighValueSignal(engagementType: string): boolean {
    return ['reply', 'renote', 'follow', 'bookmark'].includes(engagementType);
  }
  
  private clipGradient(gradient: number): number {
    return Math.max(-this.config.gradientClipping, 
                   Math.min(this.config.gradientClipping, gradient));
  }
  
  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-Math.max(-10, Math.min(10, x))));
  }
  
  /**
   * Cleanup resources
   */
  public destroy(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = undefined;
    }
    
    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
      this.snapshotTimer = undefined;
    }
    
    this.trainingBuffer = [];
    this.touchedKeys.clear();
    this.parameterUpdates.clear();
  }
}