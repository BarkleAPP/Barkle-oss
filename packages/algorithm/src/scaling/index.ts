/**
 * Community-Adaptive Scaling System
 * Automatically adapts algorithm performance based on community size
 */

export {
  CommunityAdaptiveScaling,
  type CommunitySize,
  type ScalingStrategy,
  type CommunityMetrics,
  type AdaptationEvent,
  type AdaptiveScalingConfig
} from './community-adaptive-scaling.js';

export {
  PerformanceOptimizer,
  type PerformanceMetrics,
  type OptimizationConfig,
  type CacheConfig,
  type BatchConfig
} from './performance-optimizer.js';