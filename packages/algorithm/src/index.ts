/**
 * Barkle Algorithm Microservice
 * ByteDance Monolith-inspired ML ranking system
 * with behavioral psychology optimization for maximum engagement
 */

export { MonolithInspiredRanker } from './ranker/monolith-inspired-ranker.js';
export { ScalableTimelineService } from './timeline/scalable-timeline-service.js';
export { UserSignalTracker } from './tracking/user-signal-tracker.js';
export { DiversificationEngine } from './diversity/diversification-engine.js';
export { CacheInvalidationHooks } from './cache/cache-invalidation-hooks.js';
export { SignalToPreferenceAdapter } from './learning/signal-to-preference-adapter.js';

// 🧠 Psychology-Based Engagement Optimization (NEW!)
export {
  BehavioralAddictionEngine,
  createBehavioralAddictionEngine,
  PsychologyTimelineService,
  getPsychologyTimelineService,
  CONTROL_CONFIG,
  LIGHT_PSYCHOLOGY_CONFIG,
  AGGRESSIVE_PSYCHOLOGY_CONFIG,
  type PsychologyConfig,
  type ContentItem,
  type PsychologyEnhancedContent,
  type UserEngagementState
} from './psychology/index.js';

// Enhanced Tracking System
export {
  EnhancedTrackingService,
  enhancedTrackingService,
  InteractionCategory,
  ContentType,
  EngagementDepth,
  UserIntent,
  ContextSource,
  type EnhancedTrackingEvent,
  type SimpleNote
} from './tracking/enhanced-tracking-service.js';

// MMR Diversification
export {
  MMRDiversification,
  type MMRContentItem,
  type MMRConfig,
  type MMRResult,
  type SimilarityMethod
} from './timeline/mmr-diversification.js';

// Multi-Signal Diversity Injection
export {
  MultiSignalInjection,
  type InjectionSignal,
  type InjectionStrategy,
  type InjectionContext,
  type InjectionResult
} from './timeline/multi-signal-injection.js';

// Quality Assessment Pipeline
export {
  QualityAssessmentPipeline,
  type QualityAssessment,
  type QualityFlag,
  type SafetyAssessment,
  type SpamDetection,
  type UserFeedback,
  type QualityConfig
} from './timeline/quality-assessment.js';

// Intelligent Caching System
export {
  IntelligentCacheSystem,
  defaultCacheConfig,
  type CacheLevel,
  type CacheEntry,
  type CacheStats,
  type WarmingStrategy,
  type InvalidationRule,
  type CacheConfig
} from './cache/intelligent-cache-system.js';

// Timeline Pre-computation
export {
  TimelinePrecomputation,
  defaultPrecomputationConfig,
  type UserActivityPrediction,
  type RefreshTrigger,
  type PrecomputationJob,
  type PrecomputationConfig
} from './timeline/timeline-precomputation.js';

// Collision-free embedding tables
export {
  CuckooEmbeddingTable,
  EmbeddingTableManager,
  getEmbeddingManager,
  initializeEmbeddingManager,
  createEmbeddingTable
} from './embeddings/index.js';

// Real-time learning system
export {
  RealTimeLearningSystem,
  OnlineLearningBuffer,
  FaultTolerantSync
} from './learning/index.js';

// Community-adaptive scaling
export {
  CommunityAdaptiveScaling,
  PerformanceOptimizer
} from './scaling/index.js';

// Core algorithm service (main integration point)
export {
  AlgorithmService,
  initializeAlgorithmService,
  getAlgorithmService,
  destroyAlgorithmService
} from './core/index.js';

// Types
export type { MonolithFeatures } from './ranker/monolith-inspired-ranker.js';
export type { UserPreferences, SignalContext, UserSignal, SignalType } from './tracking/user-signal-tracker.js';
export type { TimelineOptions, TimelineResult } from './timeline/scalable-timeline-service.js';
export type { DiversityMetrics, DiversificationOptions } from './diversity/diversification-engine.js';
export type { AdaptedUserPreferences } from './learning/signal-to-preference-adapter.js';
export type {
  EmbeddingType,
  EmbeddingRequest,
  SystemEmbeddingStats,
  EmbeddingTableStats,
  CuckooTableConfig
} from './embeddings/index.js';

export type {
  TrainingSample,
  ParameterUpdate,
  SyncStats,
  LearningConfig,
  EnhancedTrainingSample,
  EngagementPattern,
  BufferStats,
  ParameterSnapshot,
  SyncOperation,
  SyncHealth
} from './learning/index.js';

export type {
  CommunitySize,
  ScalingStrategy,
  CommunityMetrics,
  AdaptationEvent,
  PerformanceMetrics,
  OptimizationConfig
} from './scaling/index.js';

export type {
  AlgorithmServiceConfig,
  ServiceHealth
} from './core/index.js';

/**
 * Algorithm Service Configuration
 */
export interface AlgorithmConfig {
  communitySize: number;
  redisUrl?: string;
  enableRealTimeLearning?: boolean;
  maxEmbeddingCacheSize?: number;
  modelUpdateIntervalMs?: number;
}

/**
 * Initialize the legacy algorithm service (deprecated - use AlgorithmService class instead)
 */
export async function initializeLegacyAlgorithmService(config: AlgorithmConfig): Promise<void> {
  // Initialize components
  // Future: Initialize Redis connections, ML models, etc.
}

/**
 * Health check for the legacy algorithm service (deprecated - use AlgorithmService.getServiceHealth() instead)
 */
export function getLegacyAlgorithmHealth(): {
  status: 'healthy' | 'degraded' | 'unhealthy';
  components: Record<string, boolean>;
  metrics: Record<string, number>;
} {
  return {
    status: 'healthy',
    components: {
      monolithRanker: true,
      timelineService: true,
      userTracking: true,
      diversityEngine: true
    },
    metrics: {
      uptime: 0,
      memoryUsage: 0,
      timestamp: Date.now()
    }
  };
}