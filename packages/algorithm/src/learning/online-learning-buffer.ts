/**
 * Online Learning Buffer
 * Circular training buffer with engagement score calculation for different signal types
 */

import type { MonolithFeatures } from '../ranker/monolith-inspired-ranker.js';

/**
 * Enhanced training sample with additional metadata
 */
export interface EnhancedTrainingSample {
  features: MonolithFeatures;
  engagement: number;
  engagementType: string;
  timestamp: number;
  weight: number;
  userId: string;
  contentId: string;
  sessionId?: string;
  deviceType?: string;
  communitySize: number;
}

/**
 * Engagement pattern for user behavior analysis
 */
export interface EngagementPattern {
  userId: string;
  totalInteractions: number;
  engagementRate: number;
  averageEngagement: number;
  preferredEngagementTypes: string[];
  peakActivityHours: number[];
  lastActiveTime: number;
}

/**
 * Learning rate adaptation based on community size
 */
export interface AdaptiveLearningConfig {
  baseLearningRate: number;
  communityScalingFactor: number;
  engagementTypeWeights: Record<string, number>;
  temporalDecayFactor: number;
  userAdaptationRate: number;
}

/**
 * Buffer statistics for monitoring
 */
export interface BufferStats {
  totalSamples: number;
  uniqueUsers: number;
  engagementDistribution: Record<string, number>;
  averageEngagementScore: number;
  bufferUtilization: number;
  oldestSampleAge: number;
  newestSampleAge: number;
  learningVelocity: number;
}

/**
 * Circular training buffer with online learning capabilities
 */
export class OnlineLearningBuffer {
  private buffer: EnhancedTrainingSample[] = [];
  private maxSize: number;
  private currentIndex: number = 0;
  private userPatterns: Map<string, EngagementPattern> = new Map();
  private config: AdaptiveLearningConfig;
  
  // Performance tracking
  private stats = {
    totalSamplesProcessed: 0,
    totalEngagementScore: 0,
    engagementCounts: new Map<string, number>(),
    lastUpdateTime: Date.now()
  };
  
  constructor(maxSize: number = 1000, config: Partial<AdaptiveLearningConfig> = {}) {
    this.maxSize = maxSize;
    this.config = {
      baseLearningRate: config.baseLearningRate || 0.01,
      communityScalingFactor: config.communityScalingFactor || 0.1,
      engagementTypeWeights: config.engagementTypeWeights || {
        'view': 1.0,
        'reaction': 2.0,
        'reply': 4.0,
        'renote': 3.0,
        'follow': 5.0,
        'bookmark': 3.5,
        'share': 4.5
      },
      temporalDecayFactor: config.temporalDecayFactor || 0.95,
      userAdaptationRate: config.userAdaptationRate || 0.1
    };
  }
  
  /**
   * Add sample to circular buffer with engagement score calculation
   */
  public addSample(
    features: MonolithFeatures,
    engagementType: string,
    contentId: string,
    sessionId?: string,
    deviceType?: string
  ): void {
    const timestamp = Date.now();
    const engagement = this.calculateEngagementScore(engagementType, features.user_id, timestamp);
    const weight = this.calculateSampleWeight(engagement, engagementType, timestamp, features.community_size_factor);
    
    const sample: EnhancedTrainingSample = {
      features,
      engagement,
      engagementType,
      timestamp,
      weight,
      userId: features.user_id,
      contentId,
      sessionId,
      deviceType,
      communitySize: this.estimateCommunitySize(features.community_size_factor)
    };
    
    // Add to circular buffer
    if (this.buffer.length < this.maxSize) {
      this.buffer.push(sample);
    } else {
      this.buffer[this.currentIndex] = sample;
      this.currentIndex = (this.currentIndex + 1) % this.maxSize;
    }
    
    // Update user patterns
    this.updateUserPattern(sample);
    
    // Update statistics
    this.updateStats(sample);
  }
  
  /**
   * Calculate engagement score for different signal types with user adaptation
   */
  private calculateEngagementScore(engagementType: string, userId: string, timestamp: number): number {
    // Base engagement score
    const baseScore = this.getBaseEngagementScore(engagementType);
    
    // User-specific adaptation
    const userPattern = this.userPatterns.get(userId);
    let userAdaptation = 1.0;
    
    if (userPattern) {
      // Adapt based on user's typical engagement level
      const userEngagementRate = userPattern.engagementRate;
      const globalAvgRate = this.calculateGlobalEngagementRate();
      
      if (userEngagementRate > 0 && globalAvgRate > 0) {
        userAdaptation = Math.sqrt(globalAvgRate / userEngagementRate);
        userAdaptation = Math.max(0.5, Math.min(2.0, userAdaptation)); // Clamp between 0.5 and 2.0
      }
      
      // Boost score for user's preferred engagement types
      if (userPattern.preferredEngagementTypes.includes(engagementType)) {
        userAdaptation *= 1.2;
      }
    }
    
    // Temporal adaptation (recent activity gets slight boost)
    const hoursSinceLastActive = userPattern 
      ? (timestamp - userPattern.lastActiveTime) / (1000 * 60 * 60)
      : 24;
    const temporalBoost = Math.exp(-hoursSinceLastActive / 24); // 24-hour decay
    
    return baseScore * userAdaptation * (1 + temporalBoost * 0.1);
  }
  
  /**
   * Get base engagement score for signal type
   */
  private getBaseEngagementScore(engagementType: string): number {
    const scores: Record<string, number> = {
      'view': 0.1,
      'dwell_short': 0.15,    // <30 seconds
      'dwell_medium': 0.25,   // 30s-2min
      'dwell_long': 0.4,      // >2min
      'reaction_like': 0.3,
      'reaction_love': 0.35,
      'reaction_laugh': 0.32,
      'reaction_angry': 0.28,
      'reaction_sad': 0.25,
      'reply': 0.7,
      'renote': 0.5,
      'renote_with_comment': 0.65,
      'follow': 0.8,
      'bookmark': 0.6,
      'share_external': 0.75,
      'profile_visit': 0.2,
      'media_click': 0.3,
      'link_click': 0.35
    };
    
    return scores[engagementType] || 0.1;
  }
  
  /**
   * Calculate sample weight based on multiple factors
   */
  private calculateSampleWeight(
    engagement: number, 
    engagementType: string, 
    timestamp: number,
    communitySizeFactor: number
  ): number {
    // Base weight from engagement strength
    const engagementWeight = this.config.engagementTypeWeights[engagementType] || 1.0;
    
    // Recency weight (more recent samples are more important)
    const age = Date.now() - timestamp;
    const recencyWeight = Math.exp(-age / (1000 * 60 * 60 * 2)); // 2-hour half-life
    
    // Community size adaptation
    const communityWeight = 1 + communitySizeFactor * this.config.communityScalingFactor;
    
    // Learning rate adaptation based on community size
    const adaptedLearningRate = this.getAdaptedLearningRate(communitySizeFactor);
    
    return engagement * engagementWeight * recencyWeight * communityWeight * adaptedLearningRate;
  }
  
  /**
   * Get learning rate adapted to community size
   */
  private getAdaptedLearningRate(communitySizeFactor: number): number {
    // Smaller communities need higher learning rates for faster adaptation
    // Larger communities can use lower learning rates for stability
    if (communitySizeFactor < 0.3) {
      return this.config.baseLearningRate * 2.0; // Small community: fast learning
    } else if (communitySizeFactor < 0.7) {
      return this.config.baseLearningRate * 1.5; // Medium community: moderate learning
    } else {
      return this.config.baseLearningRate; // Large community: stable learning
    }
  }
  
  /**
   * Update user engagement pattern
   */
  private updateUserPattern(sample: EnhancedTrainingSample): void {
    const userId = sample.userId;
    let pattern = this.userPatterns.get(userId);
    
    if (!pattern) {
      pattern = {
        userId,
        totalInteractions: 0,
        engagementRate: 0,
        averageEngagement: 0,
        preferredEngagementTypes: [],
        peakActivityHours: [],
        lastActiveTime: 0
      };
      this.userPatterns.set(userId, pattern);
    }
    
    // Update interaction count and engagement rate
    pattern.totalInteractions++;
    pattern.averageEngagement = (pattern.averageEngagement * (pattern.totalInteractions - 1) + 
                                sample.engagement) / pattern.totalInteractions;
    
    // Update engagement rate (interactions per hour)
    const hoursSinceFirst = pattern.totalInteractions > 1 
      ? (sample.timestamp - pattern.lastActiveTime) / (1000 * 60 * 60)
      : 1;
    pattern.engagementRate = pattern.totalInteractions / Math.max(hoursSinceFirst, 1);
    
    // Update preferred engagement types
    this.updatePreferredEngagementTypes(pattern, sample.engagementType);
    
    // Update peak activity hours
    this.updatePeakActivityHours(pattern, sample.timestamp);
    
    pattern.lastActiveTime = sample.timestamp;
  }
  
  /**
   * Update user's preferred engagement types
   */
  private updatePreferredEngagementTypes(pattern: EngagementPattern, engagementType: string): void {
    // Count engagement types
    const typeCounts = new Map<string, number>();
    
    // Get recent samples for this user
    const recentSamples = this.getRecentSamplesForUser(pattern.userId, 50);
    for (const sample of recentSamples) {
      const count = typeCounts.get(sample.engagementType) || 0;
      typeCounts.set(sample.engagementType, count + 1);
    }
    
    // Update preferred types (top 3 most frequent)
    const sortedTypes = Array.from(typeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type]) => type);
    
    pattern.preferredEngagementTypes = sortedTypes;
  }
  
  /**
   * Update user's peak activity hours
   */
  private updatePeakActivityHours(pattern: EngagementPattern, timestamp: number): void {
    const hour = new Date(timestamp).getHours();
    
    // Get recent activity hours
    const recentSamples = this.getRecentSamplesForUser(pattern.userId, 100);
    const hourCounts = new Array(24).fill(0);
    
    for (const sample of recentSamples) {
      const sampleHour = new Date(sample.timestamp).getHours();
      hourCounts[sampleHour]++;
    }
    
    // Find peak hours (top 3)
    const peakHours = hourCounts
      .map((count, hour) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(({ hour }) => hour);
    
    pattern.peakActivityHours = peakHours;
  }
  
  /**
   * Get recent samples for a specific user
   */
  private getRecentSamplesForUser(userId: string, maxSamples: number): EnhancedTrainingSample[] {
    return this.buffer
      .filter(sample => sample.userId === userId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, maxSamples);
  }
  
  /**
   * Get all samples from buffer
   */
  public getAllSamples(): EnhancedTrainingSample[] {
    return [...this.buffer];
  }
  
  /**
   * Get samples with minimum weight threshold
   */
  public getHighQualitySamples(minWeight: number = 0.5): EnhancedTrainingSample[] {
    return this.buffer.filter(sample => sample.weight >= minWeight);
  }
  
  /**
   * Get samples for specific time range
   */
  public getSamplesInTimeRange(startTime: number, endTime: number): EnhancedTrainingSample[] {
    return this.buffer.filter(sample => 
      sample.timestamp >= startTime && sample.timestamp <= endTime
    );
  }
  
  /**
   * Get buffer statistics
   */
  public getBufferStats(): BufferStats {
    if (this.buffer.length === 0) {
      return {
        totalSamples: 0,
        uniqueUsers: 0,
        engagementDistribution: {},
        averageEngagementScore: 0,
        bufferUtilization: 0,
        oldestSampleAge: 0,
        newestSampleAge: 0,
        learningVelocity: 0
      };
    }
    
    const uniqueUsers = new Set(this.buffer.map(s => s.userId)).size;
    const engagementDistribution: Record<string, number> = {};
    let totalEngagement = 0;
    
    for (const sample of this.buffer) {
      engagementDistribution[sample.engagementType] = 
        (engagementDistribution[sample.engagementType] || 0) + 1;
      totalEngagement += sample.engagement;
    }
    
    const timestamps = this.buffer.map(s => s.timestamp);
    const oldestSampleAge = Date.now() - Math.min(...timestamps);
    const newestSampleAge = Date.now() - Math.max(...timestamps);
    
    // Learning velocity: samples per hour
    const timeSpan = Math.max(...timestamps) - Math.min(...timestamps);
    const learningVelocity = timeSpan > 0 
      ? (this.buffer.length / (timeSpan / (1000 * 60 * 60)))
      : 0;
    
    return {
      totalSamples: this.buffer.length,
      uniqueUsers,
      engagementDistribution,
      averageEngagementScore: totalEngagement / this.buffer.length,
      bufferUtilization: this.buffer.length / this.maxSize,
      oldestSampleAge,
      newestSampleAge,
      learningVelocity
    };
  }
  
  /**
   * Get user engagement patterns
   */
  public getUserPatterns(): Map<string, EngagementPattern> {
    return new Map(this.userPatterns);
  }
  
  /**
   * Calculate global engagement rate for normalization
   */
  private calculateGlobalEngagementRate(): number {
    if (this.userPatterns.size === 0) return 1.0;
    
    const totalRate = Array.from(this.userPatterns.values())
      .reduce((sum, pattern) => sum + pattern.engagementRate, 0);
    
    return totalRate / this.userPatterns.size;
  }
  
  /**
   * Estimate community size from factor
   */
  private estimateCommunitySize(factor: number): number {
    // Rough estimation based on community size factor
    if (factor < 0.3) return 500;
    if (factor < 0.7) return 5000;
    return 50000;
  }
  
  /**
   * Update internal statistics
   */
  private updateStats(sample: EnhancedTrainingSample): void {
    this.stats.totalSamplesProcessed++;
    this.stats.totalEngagementScore += sample.engagement;
    
    const count = this.stats.engagementCounts.get(sample.engagementType) || 0;
    this.stats.engagementCounts.set(sample.engagementType, count + 1);
    
    this.stats.lastUpdateTime = Date.now();
  }
  
  /**
   * Clear buffer and reset statistics
   */
  public clear(): void {
    this.buffer = [];
    this.currentIndex = 0;
    this.userPatterns.clear();
    this.stats = {
      totalSamplesProcessed: 0,
      totalEngagementScore: 0,
      engagementCounts: new Map(),
      lastUpdateTime: Date.now()
    };
  }
  
  /**
   * Get buffer size and capacity info
   */
  public getCapacityInfo(): {
    currentSize: number;
    maxSize: number;
    utilizationPercent: number;
    isFull: boolean;
  } {
    return {
      currentSize: this.buffer.length,
      maxSize: this.maxSize,
      utilizationPercent: (this.buffer.length / this.maxSize) * 100,
      isFull: this.buffer.length >= this.maxSize
    };
  }
}