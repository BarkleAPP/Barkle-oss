/**
 * A/B Testing Service for Algorithm Fine-tuning
 * Manages experiments and timeline mixing configurations
 * 
 * ✅ NOW USES DATABASE for persistence (AlgorithmExperiment, UserAlgorithmExperiment)
 */

import Logger from '@/services/logger.js';
import { AlgorithmExperiments, UserAlgorithmExperiments } from '@/models/index.js';
import { genId } from '@/misc/gen-id.js';
import { In } from 'typeorm';

const logger = new Logger('ab-testing-service');

/**
 * A/B test experiment configuration
 */
export interface ExperimentConfig {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  startDate: Date;
  endDate?: Date;

  // Traffic allocation
  trafficAllocation: number; // 0-1, percentage of users in experiment

  // Experiment variants
  variants: {
    [variantId: string]: {
      name: string;
      description: string;
      allocation: number; // 0-1, percentage within experiment
      config: TimelineMixingConfig;
    };
  };

  // Success metrics
  primaryMetric: string;
  secondaryMetrics: string[];

  // Statistical settings
  minimumSampleSize: number;
  confidenceLevel: number; // 0.95, 0.99, etc.

  // Targeting
  targetingRules?: {
    userSegments?: string[];
    deviceTypes?: string[];
    regions?: string[];
    newUsersOnly?: boolean;
  };
}

/**
 * Timeline mixing configuration for A/B testing
 */
export interface TimelineMixingConfig {
  // Algorithm weights
  weights: {
    relevance: number; // 0-1
    diversity: number; // 0-1
    freshness: number; // 0-1
    quality: number; // 0-1
    personalization: number; // 0-1
    serendipity: number; // 0-1
  };

  // MMR parameters
  mmr: {
    enabled: boolean;
    lambda: number; // 0-1, diversity vs relevance trade-off
    similarityThreshold: number; // 0-1
    maxResults: number;
  };

  // Quality filtering
  quality: {
    enabled: boolean;
    threshold: number; // 0-1
    safetyThreshold: number; // 0-1
    spamThreshold: number; // 0-1
  };

  // Multi-signal injection
  multiSignal: {
    enabled: boolean;
    strategies: {
      trending: { enabled: boolean; weight: number; frequency: number };
      fresh: { enabled: boolean; weight: number; frequency: number };
      crossTopic: { enabled: boolean; weight: number; frequency: number };
      serendipity: { enabled: boolean; weight: number; frequency: number };
    };
  };

  // Performance settings
  performance: {
    maxProcessingTime: number; // ms
    cacheEnabled: boolean;
    precomputationEnabled: boolean;
  };

  // Content mixing ratios
  contentMix: {
    followingContent: number; // 0-1
    discoveryContent: number; // 0-1
    trendingContent: number; // 0-1
    personalizedContent: number; // 0-1
  };

  // Diversity controls (NEW - from timeline-mixer-service)
  diversityControls: {
    maxPostsPerUser: number; // Maximum posts from same user (default: 3 - reduced for better diversity)
    maxSelfPosts: number; // Maximum posts from yourself (default: 1 - prevents timeline spam)
    minimumRetention: number; // Minimum % of posts to retain on refresh (default: 0.4)
    showTimelineReplies: boolean; // Show replies to others (default: true)
  };

  // ✅ NEW: Share-based ranking (Instagram-style)
  shareBoost?: {
    enabled: boolean;
    shareMultiplier: number; // Boost multiplier for shared content
    externalShareMultiplier: number; // Extra boost for external shares
  };

  // ✅ NEW: Recommendation basis configuration
  recommendation?: {
    basis: 'follows' | 'interactions' | 'shares' | 'hybrid';
    followingWeight: number; // Weight for follow graph
    interactionWeight: number; // Weight for interaction history
    shareWeight: number; // Weight for share patterns
  };
}

/**
 * Experiment result data
 */
export interface ExperimentResult {
  experimentId: string;
  variantId: string;
  metrics: {
    [metricName: string]: {
      value: number;
      sampleSize: number;
      confidence: number;
      significantDifference?: boolean;
    };
  };
  userCount: number;
  startDate: Date;
  endDate?: Date;
  status: 'running' | 'completed' | 'inconclusive';
}

/**
 * User experiment assignment
 */
export interface UserExperimentAssignment {
  userId: string;
  experiments: {
    [experimentId: string]: {
      variantId: string;
      assignedAt: Date;
      config: TimelineMixingConfig;
    };
  };
}

/**
 * A/B Testing Service
 */
export class ABTestingService {
  private static instance: ABTestingService;
  // ✅ CHANGED: Remove in-memory storage, use database instead
  private experimentCache = new Map<string, ExperimentConfig>(); // Cache only, loaded from DB
  private userAssignmentCache = new Map<string, UserExperimentAssignment>(); // Cache only
  private experimentResults = new Map<string, Map<string, ExperimentResult>>();
  private defaultConfig: TimelineMixingConfig;
  private initialized = false;

  private constructor() {
    this.defaultConfig = this.createDefaultConfig();
    // ✅ CHANGED: Don't load experiments in constructor, do it async
    // Don't call initializeAsync() here - let it be called when needed
  }

  /**
   * ✅ NEW: Initialize from database asynchronously
   */
  private async initializeAsync(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.loadExperimentsFromDatabase();
      this.initialized = true;
      logger.info('A/B Testing Service initialized from database');
    } catch (error) {
      logger.error('Failed to initialize A/B Testing Service:', error as Error);
      // Fallback to default experiments if database fails
      this.loadDefaultExperiments();
      this.initialized = true;
    }
  }

  /**
   * ✅ NEW: Wait for initialization to complete
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    // Try to initialize now
    await this.initializeAsync();

    if (!this.initialized) {
      logger.warn('A/B Testing Service initialization failed - using defaults');
      this.initialized = true;
    }
  }

  /**
   * ✅ NEW: Load experiments from database
   */
  private async loadExperimentsFromDatabase(): Promise<void> {
    try {
      // Check if AlgorithmExperiments repository is available
      if (!AlgorithmExperiments) {
        logger.warn('AlgorithmExperiments repository not available yet, using defaults');
        this.loadDefaultExperiments();
        return;
      }

      const experiments = await AlgorithmExperiments.find({
        where: {
          status: In(['draft', 'active', 'paused']),
        },
      });

      logger.info(`Loaded ${experiments.length} experiments from database`);

      for (const exp of experiments) {
        const config: ExperimentConfig = {
          id: exp.id,
          name: exp.name,
          description: exp.description || '',
          status: exp.status,
          startDate: exp.startDate,
          endDate: exp.endDate || undefined,
          trafficAllocation: Number(exp.trafficAllocation),
          variants: exp.variants as any,
          primaryMetric: exp.primaryMetric,
          secondaryMetrics: exp.secondaryMetrics,
          minimumSampleSize: exp.minimumSampleSize,
          confidenceLevel: Number(exp.confidenceLevel),
          targetingRules: exp.targetingRules || undefined,
        };

        this.experimentCache.set(exp.id, config);
      }

      // If no experiments in database, create defaults
      if (experiments.length === 0) {
        logger.info('No experiments in database, creating defaults...');
        this.loadDefaultExperiments();
      }
    } catch (error: any) {
      // Check if it's an entity metadata error (database not ready)
      if (error?.message?.includes('No metadata for') || error?.name === 'EntityMetadataNotFoundError') {
        logger.warn('Database not ready yet, using default experiments');
        this.loadDefaultExperiments();
      } else {
        logger.error('Error loading experiments from database:', error as Error);
        throw error;
      }
    }
  }

  public static getInstance(): ABTestingService {
    if (!ABTestingService.instance) {
      ABTestingService.instance = new ABTestingService();
    }
    return ABTestingService.instance;
  }

  /**
   * Get timeline configuration for user (with A/B testing)
   */
  public async getUserTimelineConfig(userId: string): Promise<TimelineMixingConfig> {
    await this.ensureInitialized(); // ✅ NEW: Wait for DB load

    const assignment = await this.getUserAssignment(userId);

    // If user has active experiment assignments, merge configs
    if (assignment && Object.keys(assignment.experiments).length > 0) {
      const config = this.mergeConfigs(assignment.experiments);

      // Log which experiment variant the user is in for debugging
      const experimentInfo = Object.entries(assignment.experiments)
        .map(([expId, data]) => `${expId}:${data.variantId}`)
        .join(', ');
      logger.debug(`User ${userId} timeline config from experiments: ${experimentInfo}`);

      return config;
    }

    logger.debug(`User ${userId} using default timeline config (not in any experiments)`);
    return this.defaultConfig;
  }

  /**
   * Force a user out of all experiments (for debugging)
   */
  public async forceUserToControl(userId: string): Promise<void> {
    // ✅ CHANGED: Delete from database, not just cache
    await UserAlgorithmExperiments.delete({ userId });
    this.userAssignmentCache.delete(userId);
    logger.info(`Forced user ${userId} out of all experiments - will use default config`);
  }

  /**
   * Force a user into a specific experiment variant (for debugging)
   */
  public async forceUserToVariant(userId: string, experimentId: string, variantId: string): Promise<boolean> {
    await this.ensureInitialized(); // ✅ NEW

    const experiment = this.experimentCache.get(experimentId);
    if (!experiment || !experiment.variants[variantId]) {
      logger.error(`Cannot force user to ${experimentId}:${variantId} - not found`);
      return false;
    }

    // ✅ CHANGED: Save to database
    const variantConfig = experiment.variants[variantId].config;

    await UserAlgorithmExperiments.insert({
      id: genId(),
      userId,
      experimentId,
      variantId,
      assignedAt: new Date(),
      config: variantConfig as any, // TypeORM JSONB type casting
      metrics: {},
    });

    // Update cache
    const assignment = this.userAssignmentCache.get(userId) || {
      userId,
      experiments: {}
    };

    assignment.experiments[experimentId] = {
      variantId,
      assignedAt: new Date(),
      config: variantConfig
    };

    this.userAssignmentCache.set(userId, assignment);
    logger.info(`Forced user ${userId} into experiment ${experimentId}, variant ${variantId}`);
    return true;
  }

  /**
   * Get or create user experiment assignment
   */
  public async getUserAssignment(userId: string): Promise<UserExperimentAssignment> {
    await this.ensureInitialized(); // ✅ NEW

    // Check cache first
    let assignment = this.userAssignmentCache.get(userId);

    if (!assignment) {
      // ✅ NEW: Check database
      const dbAssignments = await UserAlgorithmExperiments.findBy({ userId });

      if (dbAssignments.length > 0) {
        // Load from database
        assignment = {
          userId,
          experiments: {}
        };

        for (const dbAssign of dbAssignments) {
          assignment.experiments[dbAssign.experimentId] = {
            variantId: dbAssign.variantId,
            assignedAt: dbAssign.assignedAt,
            config: dbAssign.config as TimelineMixingConfig
          };
        }

        this.userAssignmentCache.set(userId, assignment);
      } else {
        // Create new assignment
        assignment = await this.assignUserToExperiments(userId);
        this.userAssignmentCache.set(userId, assignment);
      }
    }

    return assignment;
  }

  /**
   * Assign user to active experiments
   */
  private async assignUserToExperiments(userId: string): Promise<UserExperimentAssignment> {
    const assignment: UserExperimentAssignment = {
      userId,
      experiments: {}
    };

    const activeExperiments = Array.from(this.experimentCache.values())
      .filter(exp => exp.status === 'active');

    for (const experiment of activeExperiments) {
      // Check if user should be included in this experiment
      if (this.shouldIncludeUserInExperiment(userId, experiment)) {
        const variantId = this.assignUserToVariant(userId, experiment);
        const variant = experiment.variants[variantId];

        if (variant) {
          assignment.experiments[experiment.id] = {
            variantId,
            assignedAt: new Date(),
            config: variant.config
          };

          // ✅ NEW: Save to database
          await UserAlgorithmExperiments.insert({
            id: genId(),
            userId,
            experimentId: experiment.id,
            variantId,
            assignedAt: new Date(),
            config: variant.config as any, // TypeORM JSONB type casting
            metrics: {},
          });

          logger.info(`Assigned user ${userId} to experiment ${experiment.id}, variant ${variantId}`);
        }
      }
    }

    return assignment;
  }

  /**
   * Check if user should be included in experiment
   */
  private shouldIncludeUserInExperiment(userId: string, experiment: ExperimentConfig): boolean {
    // Check traffic allocation
    const userHash = this.hashUserId(userId);
    const trafficBucket = (userHash % 100) / 100;

    if (trafficBucket > experiment.trafficAllocation) {
      return false;
    }

    // Check targeting rules
    if (experiment.targetingRules) {
      // Add targeting logic here (user segments, device types, etc.)
      // For now, include all users that pass traffic allocation
    }

    return true;
  }

  /**
   * Assign user to experiment variant
   */
  private assignUserToVariant(userId: string, experiment: ExperimentConfig): string {
    const userHash = this.hashUserId(userId);
    const variantBucket = (userHash % 1000) / 1000;

    let cumulativeAllocation = 0;
    for (const [variantId, variant] of Object.entries(experiment.variants)) {
      cumulativeAllocation += variant.allocation;
      if (variantBucket <= cumulativeAllocation) {
        return variantId;
      }
    }

    // Fallback to first variant
    return Object.keys(experiment.variants)[0];
  }

  /**
   * Merge multiple experiment configs
   */
  private mergeConfigs(experiments: UserExperimentAssignment['experiments']): TimelineMixingConfig {
    let mergedConfig = { ...this.defaultConfig };

    // Apply experiment configs in order (later experiments override earlier ones)
    for (const experiment of Object.values(experiments)) {
      mergedConfig = this.deepMergeConfigs(mergedConfig, experiment.config);
    }

    return mergedConfig;
  }

  /**
   * Deep merge two timeline configs
   */
  private deepMergeConfigs(base: TimelineMixingConfig, override: TimelineMixingConfig): TimelineMixingConfig {
    return {
      weights: { ...base.weights, ...override.weights },
      mmr: { ...base.mmr, ...override.mmr },
      quality: { ...base.quality, ...override.quality },
      multiSignal: {
        enabled: override.multiSignal.enabled ?? base.multiSignal.enabled,
        strategies: {
          trending: { ...base.multiSignal.strategies.trending, ...override.multiSignal.strategies.trending },
          fresh: { ...base.multiSignal.strategies.fresh, ...override.multiSignal.strategies.fresh },
          crossTopic: { ...base.multiSignal.strategies.crossTopic, ...override.multiSignal.strategies.crossTopic },
          serendipity: { ...base.multiSignal.strategies.serendipity, ...override.multiSignal.strategies.serendipity }
        }
      },
      performance: { ...base.performance, ...override.performance },
      contentMix: { ...base.contentMix, ...override.contentMix },
      diversityControls: { ...base.diversityControls, ...override.diversityControls }
    };
  }

  /**
   * Record experiment metric
   */
  public async recordMetric(
    userId: string,
    metricName: string,
    value: number,
    context?: Record<string, any>
  ): Promise<void> {
    const assignment = await this.getUserAssignment(userId);

    for (const [experimentId, experimentAssignment] of Object.entries(assignment.experiments)) {
      const experiment = this.experimentCache.get(experimentId); // ✅ FIXED: use experimentCache
      if (!experiment || experiment.status !== 'active') continue;

      // Check if this is a tracked metric for the experiment
      if (experiment.primaryMetric === metricName || experiment.secondaryMetrics.includes(metricName)) {
        await this.updateExperimentResult(experimentId, experimentAssignment.variantId, metricName, value);
      }
    }
  }

  /**
   * Update experiment result
   */
  private async updateExperimentResult(
    experimentId: string,
    variantId: string,
    metricName: string,
    value: number
  ): Promise<void> {
    let experimentResults = this.experimentResults.get(experimentId);
    if (!experimentResults) {
      experimentResults = new Map();
      this.experimentResults.set(experimentId, experimentResults);
    }

    let result = experimentResults.get(variantId);
    if (!result) {
      result = {
        experimentId,
        variantId,
        metrics: {},
        userCount: 0,
        startDate: new Date(),
        status: 'running'
      };
      experimentResults.set(variantId, result);
    }

    // Update metric
    if (!result.metrics[metricName]) {
      result.metrics[metricName] = {
        value: 0,
        sampleSize: 0,
        confidence: 0
      };
    }

    const metric = result.metrics[metricName];

    // Update running average
    const newSampleSize = metric.sampleSize + 1;
    metric.value = (metric.value * metric.sampleSize + value) / newSampleSize;
    metric.sampleSize = newSampleSize;

    // Calculate confidence (simplified)
    metric.confidence = Math.min(newSampleSize / 1000, 0.95);
  }

  /**
   * Create new experiment
   */
  public async createExperiment(config: Omit<ExperimentConfig, 'id'>): Promise<string> {
    const experimentId = genId();

    const experiment: ExperimentConfig = {
      id: experimentId,
      ...config
    };

    // ✅ CHANGED: Save to database
    await AlgorithmExperiments.insert({
      id: experimentId,
      name: config.name,
      description: config.description || null,
      status: config.status,
      startDate: config.startDate,
      endDate: config.endDate || null,
      trafficAllocation: config.trafficAllocation,
      variants: config.variants as any,
      primaryMetric: config.primaryMetric,
      secondaryMetrics: config.secondaryMetrics,
      minimumSampleSize: config.minimumSampleSize,
      confidenceLevel: config.confidenceLevel,
      targetingRules: config.targetingRules || null,
    });

    this.experimentCache.set(experimentId, experiment);
    logger.info(`Created experiment: ${experimentId} - ${config.name}`);

    return experimentId;
  }

  /**
   * Get experiment results
   */
  public async getExperimentResults(experimentId: string): Promise<ExperimentResult[]> {
    await this.ensureInitialized(); // ✅ NEW
    const results = this.experimentResults.get(experimentId);
    return results ? Array.from(results.values()) : [];
  }

  /**
   * Get all active experiments
   */
  public async getActiveExperiments(): Promise<ExperimentConfig[]> {
    await this.ensureInitialized(); // ✅ NEW
    return Array.from(this.experimentCache.values())
      .filter(exp => exp.status === 'active');
  }

  /**
   * Update experiment status
   */
  public async updateExperimentStatus(experimentId: string, status: ExperimentConfig['status']): Promise<boolean> {
    await this.ensureInitialized(); // ✅ NEW

    const experiment = this.experimentCache.get(experimentId);
    if (!experiment) return false;

    experiment.status = status;
    if (status === 'completed') {
      experiment.endDate = new Date();
    }

    // ✅ CHANGED: Update database
    await AlgorithmExperiments.update(experimentId, {
      status,
      ...(status === 'completed' && { endDate: new Date() }),
    });

    logger.info(`Updated experiment ${experimentId} status to ${status}`);
    return true;
  }

  /**
   * Create default timeline configuration
   */
  private createDefaultConfig(): TimelineMixingConfig {
    return {
      weights: {
        relevance: 0.4,
        diversity: 0.3,
        freshness: 0.2,
        quality: 0.1,
        personalization: 0.7,
        serendipity: 0.1
      },
      mmr: {
        enabled: true,
        lambda: 0.7,
        similarityThreshold: 0.8,
        maxResults: 100  // Increased from 50 to allow more candidates
      },
      quality: {
        enabled: true,
        threshold: 0.4,
        safetyThreshold: 0.7,
        spamThreshold: 0.3
      },
      multiSignal: {
        enabled: true,
        strategies: {
          trending: { enabled: true, weight: 0.3, frequency: 5 },
          fresh: { enabled: true, weight: 0.25, frequency: 7 },
          crossTopic: { enabled: true, weight: 0.2, frequency: 10 },
          serendipity: { enabled: false, weight: 0.15, frequency: 15 }
        }
      },
      performance: {
        maxProcessingTime: 20,
        cacheEnabled: true,
        precomputationEnabled: false
      },
      contentMix: {
        followingContent: 0.6,
        discoveryContent: 0.2,
        trendingContent: 0.15,
        personalizedContent: 0.05
      },
      diversityControls: {
        maxPostsPerUser: 8,  // Higher for small platforms - more content variety
        maxSelfPosts: 3,     // Allow more self posts - users want to see their own content
        minimumRetention: 0.5,
        showTimelineReplies: true
      }
    };
  }

  /**
   * Load default experiments for testing
   */
  private loadDefaultExperiments(): void {
    // ✅ CHANGED: Make async to save to database
    this.createDefaultExperimentsAsync();
  }

  /**
   * ✅ NEW: Create default experiments asynchronously
   */
  private async createDefaultExperimentsAsync(): Promise<void> {
    // Check if experiments already exist in database to avoid duplicates
    try {
      const existingCount = await AlgorithmExperiments.count();
      if (existingCount > 0) {
        logger.info(`Found ${existingCount} existing experiments in database, skipping default creation`);
        return;
      }
    } catch (error) {
      logger.warn('Could not check existing experiments, proceeding with creation');
    }

    logger.info('Creating default experiments...');

    // Diversity vs Relevance experiment
    await this.createExperiment({
      name: 'Diversity vs Relevance Balance',
      description: 'Test different balance between content diversity and relevance',
      status: 'active',
      startDate: new Date(),
      trafficAllocation: 0.2, // 20% of users
      variants: {
        control: {
          name: 'Control (Balanced)',
          description: 'Current balanced approach',
          allocation: 0.33,
          config: this.createVariantConfig({ diversityWeight: 0.3, relevanceWeight: 0.4 })
        },
        high_diversity: {
          name: 'High Diversity',
          description: 'Prioritize content diversity',
          allocation: 0.33,
          config: this.createVariantConfig({ diversityWeight: 0.5, relevanceWeight: 0.3 })
        },
        high_relevance: {
          name: 'High Relevance',
          description: 'Prioritize content relevance',
          allocation: 0.34,
          config: this.createVariantConfig({ diversityWeight: 0.2, relevanceWeight: 0.5 })
        }
      },
      primaryMetric: 'engagement_rate',
      secondaryMetrics: ['dwell_time', 'diversity_score', 'user_satisfaction'],
      minimumSampleSize: 1000,
      confidenceLevel: 0.95
    });

    // MMR Lambda experiment
    await this.createExperiment({
      name: 'MMR Lambda Optimization',
      description: 'Test different MMR lambda values for optimal diversity-relevance trade-off',
      status: 'active',
      startDate: new Date(),
      trafficAllocation: 0.15, // 15% of users
      variants: {
        conservative: {
          name: 'Conservative (λ=0.8)',
          description: 'Favor relevance over diversity',
          allocation: 0.5,
          config: this.createVariantConfig({ mmrLambda: 0.8 })
        },
        aggressive: {
          name: 'Aggressive (λ=0.6)',
          description: 'Favor diversity over relevance',
          allocation: 0.5,
          config: this.createVariantConfig({ mmrLambda: 0.6 })
        }
      },
      primaryMetric: 'content_discovery_rate',
      secondaryMetrics: ['engagement_rate', 'session_length'],
      minimumSampleSize: 500,
      confidenceLevel: 0.95
    });

    // Serendipity experiment
    await this.createExperiment({
      name: 'Serendipity Content Injection',
      description: 'Test impact of serendipitous content on user engagement',
      status: 'active',
      startDate: new Date(),
      trafficAllocation: 0.1, // 10% of users
      variants: {
        no_serendipity: {
          name: 'No Serendipity',
          description: 'Standard algorithm without serendipity',
          allocation: 0.5,
          config: this.createVariantConfig({ serendipityEnabled: false })
        },
        with_serendipity: {
          name: 'With Serendipity',
          description: 'Algorithm with serendipitous content injection',
          allocation: 0.5,
          config: this.createVariantConfig({ serendipityEnabled: true, serendipityWeight: 0.2 })
        }
      },
      primaryMetric: 'new_content_engagement',
      secondaryMetrics: ['follow_rate', 'content_diversity_score'],
      minimumSampleSize: 300,
      confidenceLevel: 0.95
    });

    // ✅ NEW: Share-Based Ranking (Instagram-style)
    await this.createExperiment({
      name: 'Share-Based Content Boost',
      description: 'Test if boosting shared content (Instagram-style) improves engagement',
      status: 'active',
      startDate: new Date(),
      trafficAllocation: 0.25, // 25% of users
      variants: {
        control: {
          name: 'Standard Ranking',
          description: 'Equal weight for all engagement signals',
          allocation: 0.25,
          config: this.createVariantConfig({
            shareBoostEnabled: false,
            weights: { relevance: 0.4, diversity: 0.3, freshness: 0.2, quality: 0.1 }
          })
        },
        share_medium: {
          name: 'Medium Share Boost',
          description: 'Moderate boost for shared content (2x weight)',
          allocation: 0.25,
          config: this.createVariantConfig({
            shareBoostEnabled: true,
            shareBoostMultiplier: 2.0,
            weights: { relevance: 0.35, diversity: 0.3, freshness: 0.2, quality: 0.15 }
          })
        },
        share_high: {
          name: 'High Share Boost',
          description: 'Strong boost for shared content (3x weight)',
          allocation: 0.25,
          config: this.createVariantConfig({
            shareBoostEnabled: true,
            shareBoostMultiplier: 3.0,
            weights: { relevance: 0.3, diversity: 0.3, freshness: 0.15, quality: 0.25 }
          })
        },
        share_instagram: {
          name: 'Instagram-Style Boost',
          description: 'Very aggressive share boost (5x weight) like Instagram',
          allocation: 0.25,
          config: this.createVariantConfig({
            shareBoostEnabled: true,
            shareBoostMultiplier: 5.0,
            externalShareMultiplier: 10.0, // External shares worth even more
            weights: { relevance: 0.25, diversity: 0.25, freshness: 0.15, quality: 0.35 }
          })
        }
      },
      primaryMetric: 'share_rate',
      secondaryMetrics: ['engagement_rate', 'viral_coefficient', 'external_share_rate', 'follow_rate'],
      minimumSampleSize: 1000,
      confidenceLevel: 0.95
    });

    // ✅ NEW: Recommendation Basis Experiment
    await this.createExperiment({
      name: 'Recommendation Basis',
      description: 'Test what basis works best for recommendations: follows, interactions, shares, or followers',
      status: 'active',
      startDate: new Date(),
      trafficAllocation: 0.3, // 30% of users
      variants: {
        follows_based: {
          name: 'Follow-Based',
          description: 'Recommend based on who you follow (traditional)',
          allocation: 0.25,
          config: this.createVariantConfig({
            recommendationBasis: 'follows',
            followingWeight: 0.7,
            interactionWeight: 0.2,
            shareWeight: 0.1
          })
        },
        interaction_based: {
          name: 'Interaction-Based',
          description: 'Recommend based on who you interact with most',
          allocation: 0.25,
          config: this.createVariantConfig({
            recommendationBasis: 'interactions',
            followingWeight: 0.2,
            interactionWeight: 0.6,
            shareWeight: 0.2
          })
        },
        share_based: {
          name: 'Share-Based',
          description: 'Recommend content from people whose posts get shared',
          allocation: 0.25,
          config: this.createVariantConfig({
            recommendationBasis: 'shares',
            followingWeight: 0.1,
            interactionWeight: 0.2,
            shareWeight: 0.7
          })
        },
        hybrid_weighted: {
          name: 'Hybrid Weighted',
          description: 'Balanced mix of all signals',
          allocation: 0.25,
          config: this.createVariantConfig({
            recommendationBasis: 'hybrid',
            followingWeight: 0.3,
            interactionWeight: 0.4,
            shareWeight: 0.3
          })
        }
      },
      primaryMetric: 'content_discovery_rate',
      secondaryMetrics: ['engagement_rate', 'follow_rate', 'share_rate', 'time_spent', 'content_diversity'],
      minimumSampleSize: 1500,
      confidenceLevel: 0.90
    });
  }

  /**
   * Create variant config with specific overrides
   */
  private createVariantConfig(overrides: {
    diversityWeight?: number;
    relevanceWeight?: number;
    mmrLambda?: number;
    serendipityEnabled?: boolean;
    serendipityWeight?: number;
    // ✅ NEW: Share boost options
    shareBoostEnabled?: boolean;
    shareBoostMultiplier?: number;
    externalShareMultiplier?: number;
    // ✅ NEW: Recommendation basis options
    recommendationBasis?: 'follows' | 'interactions' | 'shares' | 'hybrid';
    followingWeight?: number;
    interactionWeight?: number;
    shareWeight?: number;
    weights?: Partial<TimelineMixingConfig['weights']>;
  }): TimelineMixingConfig {
    const config = { ...this.defaultConfig };

    if (overrides.diversityWeight !== undefined) {
      config.weights.diversity = overrides.diversityWeight;
    }
    if (overrides.relevanceWeight !== undefined) {
      config.weights.relevance = overrides.relevanceWeight;
    }
    if (overrides.weights) {
      config.weights = { ...config.weights, ...overrides.weights };
    }
    if (overrides.mmrLambda !== undefined) {
      config.mmr.lambda = overrides.mmrLambda;
    }
    if (overrides.serendipityEnabled !== undefined) {
      config.multiSignal.strategies.serendipity.enabled = overrides.serendipityEnabled;
    }
    if (overrides.serendipityWeight !== undefined) {
      config.weights.serendipity = overrides.serendipityWeight;
    }

    // ✅ NEW: Apply share boost settings
    if (overrides.shareBoostEnabled !== undefined || overrides.shareBoostMultiplier !== undefined) {
      config.shareBoost = {
        enabled: overrides.shareBoostEnabled ?? true,
        shareMultiplier: overrides.shareBoostMultiplier ?? 2.0,
        externalShareMultiplier: overrides.externalShareMultiplier ?? overrides.shareBoostMultiplier ?? 2.0,
      };
    }

    // ✅ NEW: Apply recommendation basis settings
    if (overrides.recommendationBasis !== undefined) {
      config.recommendation = {
        basis: overrides.recommendationBasis,
        followingWeight: overrides.followingWeight ?? 0.33,
        interactionWeight: overrides.interactionWeight ?? 0.33,
        shareWeight: overrides.shareWeight ?? 0.34,
      };
    }

    return config;
  }

  /**
   * Hash user ID for consistent assignment
   */
  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Get service statistics
   */
  public async getStats(): Promise<{
    totalExperiments: number;
    activeExperiments: number;
    totalUsers: number;
    experimentsWithResults: number;
  }> {
    await this.ensureInitialized(); // ✅ NEW

    const activeExperiments = Array.from(this.experimentCache.values())
      .filter(exp => exp.status === 'active').length;

    return {
      totalExperiments: this.experimentCache.size,
      activeExperiments,
      totalUsers: this.userAssignmentCache.size,
      experimentsWithResults: this.experimentResults.size
    };
  }
}

// Export singleton instance
export const abTestingService = ABTestingService.getInstance();