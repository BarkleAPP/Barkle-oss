/**
 * Community-Adaptive Scaling System
 * Automatically adapts algorithm behavior based on community size and growth patterns
 */

/**
 * Community size categories with different scaling strategies
 */
export type CommunitySize = 'small' | 'medium' | 'large' | 'massive';

/**
 * Scaling strategy configuration for different community sizes
 */
export interface ScalingStrategy {
  communitySize: CommunitySize;
  userRange: { min: number; max: number };
  personalizationStrength: number;
  discoveryBoost: number;
  diversityTarget: number;
  cacheStrategy: 'aggressive' | 'balanced' | 'conservative';
  updateFrequency: 'high' | 'medium' | 'low';
  learningRate: number;
  memoryAllocation: number; // MB
  syncIntervalMs: number;
  cleanupIntervalMs: number;
}

/**
 * Community metrics for size detection and adaptation
 */
export interface CommunityMetrics {
  totalUsers: number;
  activeUsers24h: number;
  activeUsers7d: number;
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  growthRate: number; // users per day
  engagementRate: number;
  contentVelocity: number; // posts per hour
  interactionDensity: number; // interactions per user per day
  lastUpdated: number;
}

/**
 * Adaptation event for tracking scaling changes
 */
export interface AdaptationEvent {
  timestamp: number;
  previousSize: CommunitySize;
  newSize: CommunitySize;
  previousStrategy: ScalingStrategy;
  newStrategy: ScalingStrategy;
  trigger: 'growth' | 'decline' | 'manual' | 'periodic';
  metrics: CommunityMetrics;
}

/**
 * Community-adaptive scaling configuration
 */
export interface AdaptiveScalingConfig {
  detectionIntervalMs: number;
  adaptationThreshold: number; // Percentage change to trigger adaptation
  stabilityPeriodMs: number; // Wait period before adapting again
  enableAutoAdaptation: boolean;
  enablePredictiveScaling: boolean;
  growthPredictionHours: number;
}

/**
 * Community-adaptive scaling system
 */
export class CommunityAdaptiveScaling {
  private currentMetrics: CommunityMetrics;
  private currentStrategy: ScalingStrategy;
  private adaptationHistory: AdaptationEvent[] = [];
  private config: AdaptiveScalingConfig;
  private detectionTimer?: NodeJS.Timeout;
  private lastAdaptationTime: number = 0;
  
  // Predefined scaling strategies
  private readonly strategies: Record<CommunitySize, ScalingStrategy> = {
    small: {
      communitySize: 'small',
      userRange: { min: 0, max: 1000 },
      personalizationStrength: 0.3,
      discoveryBoost: 0.8,
      diversityTarget: 0.9,
      cacheStrategy: 'aggressive',
      updateFrequency: 'high',
      learningRate: 0.02,
      memoryAllocation: 5,
      syncIntervalMs: 2 * 60 * 1000, // 2 minutes
      cleanupIntervalMs: 10 * 60 * 1000 // 10 minutes
    },
    medium: {
      communitySize: 'medium',
      userRange: { min: 1000, max: 10000 },
      personalizationStrength: 0.6,
      discoveryBoost: 0.5,
      diversityTarget: 0.7,
      cacheStrategy: 'balanced',
      updateFrequency: 'medium',
      learningRate: 0.015,
      memoryAllocation: 10,
      syncIntervalMs: 5 * 60 * 1000, // 5 minutes
      cleanupIntervalMs: 20 * 60 * 1000 // 20 minutes
    },
    large: {
      communitySize: 'large',
      userRange: { min: 10000, max: 100000 },
      personalizationStrength: 0.9,
      discoveryBoost: 0.2,
      diversityTarget: 0.5,
      cacheStrategy: 'conservative',
      updateFrequency: 'low',
      learningRate: 0.01,
      memoryAllocation: 20,
      syncIntervalMs: 10 * 60 * 1000, // 10 minutes
      cleanupIntervalMs: 60 * 60 * 1000 // 60 minutes
    },
    massive: {
      communitySize: 'massive',
      userRange: { min: 100000, max: Infinity },
      personalizationStrength: 0.95,
      discoveryBoost: 0.1,
      diversityTarget: 0.4,
      cacheStrategy: 'conservative',
      updateFrequency: 'low',
      learningRate: 0.005,
      memoryAllocation: 50,
      syncIntervalMs: 30 * 60 * 1000, // 30 minutes
      cleanupIntervalMs: 2 * 60 * 60 * 1000 // 2 hours
    }
  };
  
  constructor(
    initialMetrics: Partial<CommunityMetrics> = {},
    config: Partial<AdaptiveScalingConfig> = {}
  ) {
    this.config = {
      detectionIntervalMs: config.detectionIntervalMs || 5 * 60 * 1000, // 5 minutes
      adaptationThreshold: config.adaptationThreshold || 0.2, // 20% change
      stabilityPeriodMs: config.stabilityPeriodMs || 30 * 60 * 1000, // 30 minutes
      enableAutoAdaptation: config.enableAutoAdaptation ?? true,
      enablePredictiveScaling: config.enablePredictiveScaling ?? true,
      growthPredictionHours: config.growthPredictionHours || 24
    };
    
    // Initialize metrics
    this.currentMetrics = {
      totalUsers: initialMetrics.totalUsers || 1000,
      activeUsers24h: initialMetrics.activeUsers24h || 100,
      activeUsers7d: initialMetrics.activeUsers7d || 300,
      dailyActiveUsers: initialMetrics.dailyActiveUsers || 100,
      weeklyActiveUsers: initialMetrics.weeklyActiveUsers || 300,
      monthlyActiveUsers: initialMetrics.monthlyActiveUsers || 500,
      newUsersToday: initialMetrics.newUsersToday || 10,
      newUsersThisWeek: initialMetrics.newUsersThisWeek || 50,
      growthRate: initialMetrics.growthRate || 5,
      engagementRate: initialMetrics.engagementRate || 0.3,
      contentVelocity: initialMetrics.contentVelocity || 10,
      interactionDensity: initialMetrics.interactionDensity || 2.5,
      lastUpdated: Date.now()
    };
    
    // Set initial strategy
    this.currentStrategy = this.determineStrategy(this.currentMetrics.totalUsers);
    
    // Start automatic detection if enabled
    if (this.config.enableAutoAdaptation) {
      this.startAutomaticDetection();
    }
  }
  
  /**
   * Update community metrics and trigger adaptation if needed
   */
  public updateMetrics(newMetrics: Partial<CommunityMetrics>): void {
    // Validate input metrics
    if (newMetrics.totalUsers !== undefined && newMetrics.totalUsers < 0) {
      console.error('Invalid totalUsers: cannot be negative');
      return;
    }
    
    if (newMetrics.growthRate !== undefined && !Number.isFinite(newMetrics.growthRate)) {
      console.error('Invalid growthRate: must be a finite number');
      return;
    }
    
    if (newMetrics.engagementRate !== undefined) {
      if (newMetrics.engagementRate < 0 || newMetrics.engagementRate > 1) {
        console.error('Invalid engagementRate: must be between 0 and 1');
        return;
      }
    }
    
    const previousMetrics = { ...this.currentMetrics };
    
    // Update metrics
    this.currentMetrics = {
      ...this.currentMetrics,
      ...newMetrics,
      lastUpdated: Date.now()
    };
    
    // Validate updated metrics for consistency
    if (this.currentMetrics.activeUsers24h > this.currentMetrics.totalUsers) {
      console.warn('Active users 24h exceeds total users - capping at total');
      this.currentMetrics.activeUsers24h = this.currentMetrics.totalUsers;
    }
    
    if (this.currentMetrics.dailyActiveUsers > this.currentMetrics.totalUsers) {
      console.warn('Daily active users exceeds total users - capping at total');
      this.currentMetrics.dailyActiveUsers = this.currentMetrics.totalUsers;
    }
    
    // Calculate growth rate if not provided
    if (!newMetrics.growthRate && newMetrics.totalUsers) {
      const timeDiff = (Date.now() - previousMetrics.lastUpdated) / (1000 * 60 * 60 * 24); // days
      if (timeDiff > 0 && timeDiff < 30) { // Only calculate if reasonable time period
        this.currentMetrics.growthRate = 
          (newMetrics.totalUsers - previousMetrics.totalUsers) / timeDiff;
      }
    }
    
    // Check if adaptation is needed
    if (this.config.enableAutoAdaptation) {
      this.checkAdaptationNeeded(previousMetrics);
    }
  }
  
  /**
   * Determine appropriate scaling strategy based on community size
   */
  public determineStrategy(userCount: number): ScalingStrategy {
    // Validate input
    if (!Number.isFinite(userCount) || userCount < 0) {
      console.error(`Invalid userCount: ${userCount} - using default strategy`);
      return { ...this.strategies.small };
    }
    
    // Find matching strategy
    for (const strategy of Object.values(this.strategies)) {
      if (userCount >= strategy.userRange.min && userCount < strategy.userRange.max) {
        return { ...strategy };
      }
    }
    
    // Default to massive if over all ranges
    return { ...this.strategies.massive };
  }
  
  /**
   * Get current scaling strategy
   */
  public getCurrentStrategy(): ScalingStrategy {
    return { ...this.currentStrategy };
  }
  
  /**
   * Get current community metrics
   */
  public getCurrentMetrics(): CommunityMetrics {
    return { ...this.currentMetrics };
  }
  
  /**
   * Manually trigger adaptation to new community size
   */
  public adaptToCommunitySize(newUserCount: number, trigger: 'manual' | 'growth' | 'decline' = 'manual'): boolean {
    const newStrategy = this.determineStrategy(newUserCount);
    
    if (newStrategy.communitySize !== this.currentStrategy.communitySize) {
      this.performAdaptation(newStrategy, trigger);
      return true;
    }
    
    return false;
  }
  
  /**
   * Predict future community size and preemptively adapt
   */
  public predictAndAdapt(): { prediction: number; adapted: boolean; timeToAdaptation?: number } {
    if (!this.config.enablePredictiveScaling) {
      return { prediction: this.currentMetrics.totalUsers, adapted: false };
    }
    
    const prediction = this.predictFutureSize(this.config.growthPredictionHours);
    const currentSize = this.currentMetrics.totalUsers;
    const predictedStrategy = this.determineStrategy(prediction);
    
    // Check if we should preemptively adapt
    const growthRate = this.currentMetrics.growthRate;
    const timeToReachPrediction = growthRate > 0 
      ? (prediction - currentSize) / growthRate 
      : Infinity;
    
    // Adapt if we'll cross a threshold within the prediction window
    if (predictedStrategy.communitySize !== this.currentStrategy.communitySize && 
        timeToReachPrediction <= this.config.growthPredictionHours / 24) {
      
      console.log(`Predictive scaling: adapting from ${this.currentStrategy.communitySize} to ${predictedStrategy.communitySize}`);
      this.performAdaptation(predictedStrategy, 'growth');
      
      return { 
        prediction, 
        adapted: true, 
        timeToAdaptation: timeToReachPrediction 
      };
    }
    
    return { 
      prediction, 
      adapted: false, 
      timeToAdaptation: timeToReachPrediction 
    };
  }
  
  /**
   * Predict future community size based on current growth trends
   */
  private predictFutureSize(hours: number): number {
    const currentSize = this.currentMetrics.totalUsers;
    const growthRate = this.currentMetrics.growthRate; // users per day
    const days = hours / 24;
    
    // Simple linear prediction (could be enhanced with more sophisticated models)
    const linearPrediction = currentSize + (growthRate * days);
    
    // Apply growth decay factor for more realistic prediction
    const decayFactor = Math.exp(-days / 30); // Growth slows over time
    const adjustedGrowth = growthRate * decayFactor;
    
    return Math.max(currentSize, currentSize + (adjustedGrowth * days));
  }
  
  /**
   * Check if adaptation is needed based on metrics change
   */
  private checkAdaptationNeeded(previousMetrics: CommunityMetrics): void {
    const currentSize = this.currentMetrics.totalUsers;
    const previousSize = previousMetrics.totalUsers;
    
    // Validate metrics
    if (!Number.isFinite(currentSize) || !Number.isFinite(previousSize)) {
      console.error('Invalid metrics for adaptation check');
      return;
    }
    
    // Check if enough time has passed since last adaptation
    const timeSinceLastAdaptation = Date.now() - this.lastAdaptationTime;
    if (timeSinceLastAdaptation < this.config.stabilityPeriodMs) {
      return;
    }
    
    // Avoid division by zero
    if (previousSize === 0) {
      console.warn('Previous size is 0 - skipping adaptation check');
      return;
    }
    
    // Calculate percentage change
    const changePercent = Math.abs(currentSize - previousSize) / previousSize;
    
    // Validate threshold
    if (!Number.isFinite(changePercent)) {
      console.error('Invalid change percentage calculated');
      return;
    }
    
    // Check if change exceeds threshold
    if (changePercent >= this.config.adaptationThreshold) {
      const newStrategy = this.determineStrategy(currentSize);
      
      if (newStrategy.communitySize !== this.currentStrategy.communitySize) {
        const trigger = currentSize > previousSize ? 'growth' : 'decline';
        this.performAdaptation(newStrategy, trigger);
      }
    }
  }
  
  /**
   * Perform adaptation to new scaling strategy
   */
  private performAdaptation(newStrategy: ScalingStrategy, trigger: AdaptationEvent['trigger']): void {
    const previousStrategy = { ...this.currentStrategy };
    const previousSize = this.currentStrategy.communitySize;
    
    // Create adaptation event
    const event: AdaptationEvent = {
      timestamp: Date.now(),
      previousSize,
      newSize: newStrategy.communitySize,
      previousStrategy,
      newStrategy: { ...newStrategy },
      trigger,
      metrics: { ...this.currentMetrics }
    };
    
    // Update current strategy
    this.currentStrategy = newStrategy;
    this.lastAdaptationTime = Date.now();
    
    // Record event
    this.adaptationHistory.push(event);
    
    // Limit history size
    if (this.adaptationHistory.length > 100) {
      this.adaptationHistory = this.adaptationHistory.slice(-50);
    }
    
    console.log(`Community adaptation: ${previousSize} → ${newStrategy.communitySize} (${trigger})`);
    console.log(`New strategy:`, {
      personalization: newStrategy.personalizationStrength,
      discovery: newStrategy.discoveryBoost,
      diversity: newStrategy.diversityTarget,
      cache: newStrategy.cacheStrategy,
      memory: newStrategy.memoryAllocation
    });
  }
  
  /**
   * Get adaptation history
   */
  public getAdaptationHistory(limit: number = 20): AdaptationEvent[] {
    return this.adaptationHistory
      .slice(-limit)
      .sort((a, b) => b.timestamp - a.timestamp);
  }
  
  /**
   * Get scaling recommendations based on current metrics
   */
  public getScalingRecommendations(): {
    currentOptimal: boolean;
    recommendations: string[];
    predictedChanges: string[];
  } {
    const recommendations: string[] = [];
    const predictedChanges: string[] = [];
    
    const currentSize = this.currentMetrics.totalUsers;
    const optimalStrategy = this.determineStrategy(currentSize);
    const currentOptimal = optimalStrategy.communitySize === this.currentStrategy.communitySize;
    
    if (!currentOptimal) {
      recommendations.push(`Consider adapting to ${optimalStrategy.communitySize} community strategy`);
    }
    
    // Check growth trends
    if (this.currentMetrics.growthRate > 50) {
      recommendations.push('High growth rate detected - consider preemptive scaling');
      predictedChanges.push('May need larger community strategy within days');
    }
    
    // Check engagement patterns
    if (this.currentMetrics.engagementRate < 0.1) {
      recommendations.push('Low engagement - increase discovery boost');
    } else if (this.currentMetrics.engagementRate > 0.8) {
      recommendations.push('High engagement - can reduce discovery boost');
    }
    
    // Check content velocity
    if (this.currentMetrics.contentVelocity > 100) {
      recommendations.push('High content velocity - consider more aggressive caching');
    }
    
    return {
      currentOptimal,
      recommendations,
      predictedChanges
    };
  }
  
  /**
   * Start automatic community size detection
   */
  private startAutomaticDetection(): void {
    this.detectionTimer = setInterval(() => {
      // In a real system, this would fetch fresh metrics from the database
      // For now, we just check if predictive scaling should trigger
      if (this.config.enablePredictiveScaling) {
        this.predictAndAdapt();
      }
    }, this.config.detectionIntervalMs);
  }
  
  /**
   * Calculate community health score
   */
  public calculateCommunityHealth(): {
    score: number;
    factors: Record<string, number>;
    recommendations: string[];
  } {
    const factors: Record<string, number> = {};
    const recommendations: string[] = [];
    
    // Growth health (0-1)
    const growthHealth = Math.min(Math.max(this.currentMetrics.growthRate / 10, 0), 1);
    factors.growth = growthHealth;
    
    // Engagement health (0-1)
    const engagementHealth = Math.min(this.currentMetrics.engagementRate / 0.5, 1);
    factors.engagement = engagementHealth;
    
    // Activity health (DAU/MAU ratio)
    const activityRatio = this.currentMetrics.dailyActiveUsers / this.currentMetrics.monthlyActiveUsers;
    const activityHealth = Math.min(activityRatio / 0.3, 1); // 30% is good DAU/MAU
    factors.activity = activityHealth;
    
    // Content health (posts per active user)
    const contentPerUser = this.currentMetrics.contentVelocity / this.currentMetrics.activeUsers24h;
    const contentHealth = Math.min(contentPerUser / 0.5, 1); // 0.5 posts per user per day
    factors.content = contentHealth;
    
    // Overall score (weighted average)
    const score = (
      growthHealth * 0.3 +
      engagementHealth * 0.3 +
      activityHealth * 0.25 +
      contentHealth * 0.15
    );
    
    // Generate recommendations
    if (growthHealth < 0.5) recommendations.push('Focus on user acquisition');
    if (engagementHealth < 0.5) recommendations.push('Improve content discovery and personalization');
    if (activityHealth < 0.5) recommendations.push('Increase user retention efforts');
    if (contentHealth < 0.5) recommendations.push('Encourage more content creation');
    
    return { score, factors, recommendations };
  }
  
  /**
   * Cleanup resources
   */
  public destroy(): void {
    if (this.detectionTimer) {
      clearInterval(this.detectionTimer);
      this.detectionTimer = undefined;
    }
  }
}