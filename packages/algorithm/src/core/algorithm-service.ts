/**
 * Algorithm Service - Main Integration Point
 * Integrates all Phase 1 components: Cuckoo embeddings, real-time learning, and community scaling
 */

import { EmbeddingTableManager, initializeEmbeddingManager } from '../embeddings/index.js';
import { RealTimeLearningSystem } from '../learning/real-time-learning-system.js';
import { OnlineLearningBuffer } from '../learning/online-learning-buffer.js';
import { FaultTolerantSync } from '../learning/fault-tolerant-sync.js';
import { CommunityAdaptiveScaling } from '../scaling/community-adaptive-scaling.js';
import { PerformanceOptimizer } from '../scaling/performance-optimizer.js';
import { MonolithInspiredRanker } from '../ranker/monolith-inspired-ranker.js';
import type { MonolithFeatures } from '../ranker/monolith-inspired-ranker.js';

/**
 * Algorithm service configuration
 */
export interface AlgorithmServiceConfig {
  communitySize: number;
  enableRealTimeLearning: boolean;
  enableCommunityAdaptation: boolean;
  enablePerformanceOptimization: boolean;
  maxEmbeddingCacheSize: number;
  modelUpdateIntervalMs: number;
  redisUrl?: string;
}

/**
 * Service health status
 */
export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    embeddings: boolean;
    learning: boolean;
    scaling: boolean;
    performance: boolean;
    ranker: boolean;
  };
  metrics: {
    memoryUsageMB: number;
    responseTimeMs: number;
    throughputRps: number;
    errorRate: number;
    uptime: number;
  };
  issues: string[];
  recommendations: string[];
}

/**
 * Main Algorithm Service
 * Orchestrates all ByteDance Monolith-inspired components
 */
export class AlgorithmService {
  private embeddingManager: EmbeddingTableManager;
  private learningSystem: RealTimeLearningSystem;
  private learningBuffer: OnlineLearningBuffer;
  private faultTolerantSync: FaultTolerantSync;
  private communityScaling: CommunityAdaptiveScaling;
  private performanceOptimizer: PerformanceOptimizer;
  private config: AlgorithmServiceConfig;
  private startTime: number;
  
  constructor(config: AlgorithmServiceConfig) {
    this.config = config;
    this.startTime = Date.now();
    
    // Initialize embedding manager with community-adaptive configuration
    this.embeddingManager = initializeEmbeddingManager({
      communitySize: config.communitySize,
      enableAutoCleanup: true,
      cleanupIntervalMs: 30 * 60 * 1000, // 30 minutes
      maxSystemMemoryMB: config.maxEmbeddingCacheSize || 20
    });
    
    // Initialize learning buffer
    this.learningBuffer = new OnlineLearningBuffer(1000, {
      baseLearningRate: 0.01,
      communityScalingFactor: 0.1,
      temporalDecayFactor: 0.95
    });
    
    // Initialize real-time learning system
    this.learningSystem = new RealTimeLearningSystem(this.embeddingManager, {
      syncIntervalMs: config.modelUpdateIntervalMs || 5 * 60 * 1000,
      maxTrainingBuffer: 1000,
      learningRate: 0.01,
      enableSparseUpdates: true,
      enableDenseUpdates: true
    });
    
    // Initialize fault-tolerant sync
    this.faultTolerantSync = new FaultTolerantSync(
      this.embeddingManager,
      this.learningSystem,
      {
        maxRetries: 3,
        snapshotIntervalMs: 24 * 60 * 60 * 1000, // 24 hours
        enableAutoRollback: true
      }
    );
    
    // Initialize community scaling
    this.communityScaling = new CommunityAdaptiveScaling(
      { totalUsers: config.communitySize },
      {
        enableAutoAdaptation: config.enableCommunityAdaptation,
        enablePredictiveScaling: true,
        adaptationThreshold: 0.2
      }
    );
    
    // Initialize performance optimizer
    this.performanceOptimizer = new PerformanceOptimizer(this.embeddingManager, {
      enableDynamicBatching: config.enablePerformanceOptimization,
      enableCaching: true,
      enablePrefetching: true,
      maxBatchSize: 50
    });
    
    // Initialize ranker
    MonolithInspiredRanker.initialize(config.communitySize);
    
    // Set up community adaptation
    if (config.enableCommunityAdaptation) {
      this.setupCommunityAdaptation();
    }
  }
  
  /**
   * Extract features for content ranking
   */
  public async extractFeatures(
    noteData: {
      id: string;
      text?: string;
      tags?: string[];
      fileIds?: string[];
      userId: string;
      createdAt: Date;
    },
    userId: string,
    userPreferences: any | null
  ): Promise<MonolithFeatures> {
    return this.performanceOptimizer.processRequest(
      `extract-${noteData.id}-${userId}`,
      () => MonolithInspiredRanker.extractFeatures(
        noteData,
        userId,
        userPreferences,
        this.config.communitySize
      ),
      `features-${noteData.id}-${userId}`
    );
  }
  
  /**
   * Predict engagement score for content
   */
  public async predictEngagement(features: MonolithFeatures): Promise<number> {
    const cacheKey = `engagement-${features.user_id}-${features.author_id}-${features.content_topics.join(',')}`;
    
    return this.performanceOptimizer.processRequest(
      `predict-${Date.now()}`,
      () => MonolithInspiredRanker.predictEngagement(features),
      cacheKey
    );
  }
  
  /**
   * Record user engagement for online learning
   */
  public recordEngagement(
    features: MonolithFeatures,
    engagementType: string,
    contentId: string,
    sessionId?: string
  ): void {
    // Record in learning buffer
    this.learningBuffer.addSample(features, engagementType, contentId, sessionId);
    
    // Record in learning system
    this.learningSystem.recordEngagement(features, engagementType);
    
    // Update ranker
    MonolithInspiredRanker.recordEngagement(features, engagementType);
  }
  
  /**
   * Update community metrics and trigger adaptation
   */
  public updateCommunityMetrics(metrics: {
    totalUsers?: number;
    activeUsers24h?: number;
    dailyActiveUsers?: number;
    growthRate?: number;
    engagementRate?: number;
  }): void {
    this.communityScaling.updateMetrics(metrics);
    
    // Update config if community size changed significantly
    if (metrics.totalUsers && Math.abs(metrics.totalUsers - this.config.communitySize) > this.config.communitySize * 0.2) {
      this.config.communitySize = metrics.totalUsers;
      this.adaptToCommunitySize(metrics.totalUsers);
    }
  }
  
  /**
   * Adapt system to new community size
   */
  private adaptToCommunitySize(newSize: number): void {
    // Adapt embedding manager
    this.embeddingManager.adaptToCommunitySize(newSize);
    
    // Adapt performance optimizer
    const newStrategy = this.communityScaling.determineStrategy(newSize);
    this.performanceOptimizer.adaptToCommunitySize(newStrategy);
    
    console.log(`Algorithm service adapted to community size: ${newSize}`);
  }
  
  /**
   * Set up community adaptation monitoring
   */
  private setupCommunityAdaptation(): void {
    // Monitor community changes and adapt performance
    setInterval(() => {
      const prediction = this.communityScaling.predictAndAdapt();
      if (prediction.adapted) {
        const newStrategy = this.communityScaling.getCurrentStrategy();
        this.performanceOptimizer.adaptToCommunitySize(newStrategy);
      }
    }, 5 * 60 * 1000); // Check every 5 minutes
  }
  
  /**
   * Get comprehensive service health
   */
  public getServiceHealth(): ServiceHealth {
    const embeddingStats = this.embeddingManager.getSystemStats();
    const learningStats = this.learningSystem.getSyncStats();
    const performanceMetrics = this.performanceOptimizer.getCurrentMetrics();
    const rankerStatus = MonolithInspiredRanker.getSystemStatus();
    const communityHealth = this.communityScaling.calculateCommunityHealth();
    const performanceHealth = this.performanceOptimizer.isPerformanceHealthy();
    
    const components = {
      embeddings: embeddingStats.overallHealth,
      learning: learningStats.successCount > learningStats.failureCount,
      scaling: communityHealth.score > 0.7,
      performance: performanceHealth.healthy,
      ranker: rankerStatus.systemHealth
    };
    
    const allHealthy = Object.values(components).every(healthy => healthy);
    const someHealthy = Object.values(components).some(healthy => healthy);
    
    const status = allHealthy ? 'healthy' : someHealthy ? 'degraded' : 'unhealthy';
    
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    if (!components.embeddings) {
      issues.push('Embedding system unhealthy');
      recommendations.push('Check memory usage and cleanup expired embeddings');
    }
    
    if (!components.learning) {
      issues.push('Learning system experiencing sync failures');
      recommendations.push('Check parameter sync and consider rollback');
    }
    
    if (!components.performance) {
      issues.push(...performanceHealth.issues);
      recommendations.push(...performanceHealth.recommendations);
    }
    
    return {
      status,
      components,
      metrics: {
        memoryUsageMB: embeddingStats.totalMemoryUsageMB,
        responseTimeMs: performanceMetrics?.responseTime || 0,
        throughputRps: performanceMetrics?.throughput || 0,
        errorRate: performanceMetrics?.errorRate || 0,
        uptime: (Date.now() - this.startTime) / 1000
      },
      issues,
      recommendations
    };
  }
  
  /**
   * Get service statistics
   */
  public getServiceStats(): {
    embeddings: any;
    learning: any;
    community: any;
    performance: any;
    ranker: any;
  } {
    return {
      embeddings: this.embeddingManager.getSystemStats(),
      learning: {
        sync: this.learningSystem.getSyncStats(),
        buffer: this.learningBuffer.getBufferStats()
      },
      community: {
        metrics: this.communityScaling.getCurrentMetrics(),
        strategy: this.communityScaling.getCurrentStrategy(),
        health: this.communityScaling.calculateCommunityHealth()
      },
      performance: {
        current: this.performanceOptimizer.getCurrentMetrics(),
        average: this.performanceOptimizer.getAverageMetrics(),
        health: this.performanceOptimizer.isPerformanceHealthy()
      },
      ranker: MonolithInspiredRanker.getSystemStatus()
    };
  }
  
  /**
   * Perform manual sync (for testing/debugging)
   */
  public async performManualSync(): Promise<void> {
    await this.learningSystem.performIncrementalSync();
  }
  
  /**
   * Create manual snapshot (for backup)
   */
  public async createSnapshot(description?: string): Promise<void> {
    await this.faultTolerantSync.createSnapshot(description);
  }
  
  /**
   * Clean up resources
   */
  public destroy(): void {
    this.learningSystem.destroy();
    this.faultTolerantSync.destroy();
    this.communityScaling.destroy();
    this.performanceOptimizer.destroy();
    this.embeddingManager.destroy();
  }
}

/**
 * Global service instance
 */
let globalAlgorithmService: AlgorithmService | null = null;

/**
 * Initialize the global algorithm service
 */
export function initializeAlgorithmService(config: AlgorithmServiceConfig): AlgorithmService {
  if (globalAlgorithmService) {
    globalAlgorithmService.destroy();
  }
  
  globalAlgorithmService = new AlgorithmService(config);
  return globalAlgorithmService;
}

/**
 * Get the global algorithm service
 */
export function getAlgorithmService(): AlgorithmService | null {
  return globalAlgorithmService;
}

/**
 * Destroy the global algorithm service
 */
export function destroyAlgorithmService(): void {
  if (globalAlgorithmService) {
    globalAlgorithmService.destroy();
    globalAlgorithmService = null;
  }
}