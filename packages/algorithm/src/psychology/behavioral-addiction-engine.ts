/**
 * 🧠 Behavioral Addiction Engine
 * 
 * PSYCHOLOGY-BASED ENGAGEMENT OPTIMIZATION
 * Based on research from behavioral psychology, slot machines, social media addiction studies
 * 
 * Key Principles:
 * 1. Variable Interval Reinforcement (most addictive schedule)
 * 2. Unpredictability creates dopamine anticipation
 * 3. FOMO (Fear of Missing Out) drives compulsive checking
 * 4. Social proof amplifies engagement
 * 5. Near-miss events maintain engagement despite lack of reward
 */

export interface PsychologyConfig {
  variableReward: {
    enabled: boolean;
    unpredictabilityLevel: number; // 0-1, higher = more random
    surpriseContentRate: number; // % of content that should be "surprising"
    nearMissRate: number; // % of time to show "almost viral" content (creates FOMO)
  };
  
  dopamineTriggers: {
    enabled: boolean;
    notificationDelay: { min: number; max: number }; // Random delay in ms
    rewardIntensityVariance: number; // 0-1, how much reward sizes vary
    anticipationBuildup: boolean; // Delay gratification for bigger dopamine hit
  };
  
  fomoMechanics: {
    enabled: boolean;
    showTrendingIndicators: boolean; // UI icon, no emoji
    // Removed tacky view counts and urgency signals
  };
  
  socialProof: {
    enabled: boolean;
    // Social proof now triggers NOTIFICATIONS instead of inline badges
    notifyFollowerEngagement: boolean; // Notify: "People you follow liked this"
    notifyPopularityMilestones: boolean; // Notify: "Your post reached 10K reactions"
    notifyNewFollowers: boolean; // Notify: "3 new followers"
    notifySimilarUserActivity: boolean; // Notify: "Users like you are engaging with..."
    notifyNetworkActivity: boolean; // Notify: "5 friends are active now"
  };
  
  intermittentReinforcement: {
    enabled: boolean;
    rewardProbability: number; // % chance of "reward" on any action
    jackpotProbability: number; // % chance of "big win"
    coldStreakProtection: boolean; // Guarantee reward after X non-rewards
    maxColdStreak: number; // Max actions without reward
  };
}

export interface ContentItem {
  id: string;
  score: number;
  viralityScore?: number;
  engagement?: {
    reactions: number;
    shares: number;
    comments: number;
    views?: number;
  };
  author?: {
    id: string;
    followersCount?: number;
  };
  createdAt: Date;
  metadata?: Record<string, any>;
}

export interface PsychologyEnhancedContent extends ContentItem {
  psychologyFlags: {
    isVariableReward?: boolean; // Randomly boosted
    isSurprise?: boolean; // Unexpected content injection
    isNearMiss?: boolean; // Almost viral (creates FOMO)
    isTrending?: boolean; // Currently hot (shows UI icon)
    isJackpot?: boolean; // Big win (viral content)
  };
  enhancedScore: number; // Modified score with psychology boosts
  displayMetadata: {
    showTrendingIcon?: boolean; // Clean UI icon, no emoji or text
  };
  // Social proof triggers notifications separately
  triggeredNotifications?: Array<{
    type: 'follower_engagement' | 'popularity_milestone' | 'network_activity' | 'similar_users';
    priority: number;
    delay: number; // Random delay for dopamine effect
  }>;
}

/**
 * User engagement state for tracking reinforcement schedules
 */
export interface UserEngagementState {
  userId: string;
  actionsSinceLastReward: number;
  lastRewardTime: number;
  totalRewards: number;
  averageRewardInterval: number;
  currentStreak: number;
  longestStreak: number;
  lastActionTime: number;
}

/**
 * Behavioral Addiction Engine
 * Implements psychology-based engagement optimization
 */
export class BehavioralAddictionEngine {
  private config: PsychologyConfig;
  private userStates = new Map<string, UserEngagementState>();
  private rng: () => number; // Seeded random for consistency

  constructor(config: Partial<PsychologyConfig> = {}) {
    this.config = {
      variableReward: {
        enabled: true,
        unpredictabilityLevel: 0.6,
        surpriseContentRate: 0.15,
        nearMissRate: 0.1,
        ...config.variableReward
      },
      dopamineTriggers: {
        enabled: true,
        notificationDelay: { min: 2000, max: 30000 },
        rewardIntensityVariance: 0.4,
        anticipationBuildup: true,
        ...config.dopamineTriggers
      },
      fomoMechanics: {
        enabled: true,
        showTrendingIndicators: true,
        ...config.fomoMechanics
      },
      socialProof: {
        enabled: true,
        notifyFollowerEngagement: true,
        notifyPopularityMilestones: true,
        notifyNewFollowers: true,
        notifySimilarUserActivity: true,
        notifyNetworkActivity: true,
        ...config.socialProof
      },
      intermittentReinforcement: {
        enabled: true,
        rewardProbability: 0.3, // 30% base chance
        jackpotProbability: 0.05, // 5% chance of big win
        coldStreakProtection: true,
        maxColdStreak: 10,
        ...config.intermittentReinforcement
      }
    };

    // Use crypto.getRandomValues for better randomness if available
    this.rng = () => Math.random();
  }

  /**
   * 🎰 VARIABLE INTERVAL REINFORCEMENT
   * The most addictive reinforcement schedule (used in slot machines)
   * 
   * Unpredictable rewards create constant dopamine anticipation
   */
  public applyVariableRewardSchedule<T extends ContentItem>(
    content: T[],
    userId: string
  ): PsychologyEnhancedContent[] {
    if (!this.config.variableReward.enabled) {
      return content.map(item => this.wrapContent(item));
    }

    const state = this.getUserState(userId);
    const enhanced: PsychologyEnhancedContent[] = [];

    for (let i = 0; i < content.length; i++) {
      const item = content[i];
      const wrapped = this.wrapContent(item);

      // 1. SURPRISE CONTENT INJECTION (unpredictability)
      if (this.rng() < this.config.variableReward.surpriseContentRate) {
        wrapped.psychologyFlags.isSurprise = true;
        wrapped.psychologyFlags.isVariableReward = true;
        // Randomly boost surprise content
        wrapped.enhancedScore *= (1 + this.rng() * 2); // 1x to 3x boost
      }

      // 2. NEAR-MISS EVENTS (creates FOMO and "almost won" feeling)
      if (
        this.rng() < this.config.variableReward.nearMissRate &&
        item.viralityScore && 
        item.viralityScore > 0.6 && 
        item.viralityScore < 0.8
      ) {
        wrapped.psychologyFlags.isNearMiss = true;
      }

      // 3. VARIABLE REWARD AMPLIFICATION
      if (this.shouldGiveReward(state)) {
        wrapped.psychologyFlags.isVariableReward = true;
        const intensity = this.calculateRewardIntensity(state);
        wrapped.enhancedScore *= intensity;
        
        if (intensity > 2.0) {
          wrapped.psychologyFlags.isJackpot = true;
        }

        state.actionsSinceLastReward = 0;
        state.lastRewardTime = Date.now();
        state.totalRewards++;
      } else {
        state.actionsSinceLastReward++;
      }

      enhanced.push(wrapped);
    }

    // 4. INJECT HIGH-VALUE CONTENT AT UNPREDICTABLE INTERVALS
    const unpredictabilityBoost = this.config.variableReward.unpredictabilityLevel;
    if (unpredictabilityBoost > 0.5) {
      // Randomly shuffle some items to create unpredictability
      const shuffleCount = Math.floor(enhanced.length * unpredictabilityBoost * 0.3);
      for (let i = 0; i < shuffleCount; i++) {
        const idx1 = Math.floor(this.rng() * enhanced.length);
        const idx2 = Math.floor(this.rng() * enhanced.length);
        [enhanced[idx1], enhanced[idx2]] = [enhanced[idx2], enhanced[idx1]];
      }
    }

    this.updateUserState(userId, state);
    return enhanced;
  }

  /**
   * ⏰ FOMO MECHANICS
   * Shows trending indicators (clean UI icon only, no tacky text)
   */
  public applyFOMOMechanics<T extends PsychologyEnhancedContent>(
    content: T[]
  ): T[] {
    if (!this.config.fomoMechanics.enabled) {
      return content;
    }

    const now = Date.now();

    return content.map(item => {
      // TRENDING INDICATORS (clean UI icon)
      if (this.config.fomoMechanics.showTrendingIndicators) {
        const ageMinutes = (now - item.createdAt.getTime()) / (1000 * 60);
        const engagementRate = item.engagement 
          ? (item.engagement.reactions + item.engagement.shares * 3) / Math.max(ageMinutes, 1)
          : 0;

        // Mark as trending if high engagement rate in last hour
        if (engagementRate > 10 && ageMinutes < 60) {
          item.psychologyFlags.isTrending = true;
          item.displayMetadata.showTrendingIcon = true; // Frontend shows icon
        }
      }

      return item;
    });
  }

  /**
   * 👥 SOCIAL PROOF AMPLIFICATION
   * Triggers notifications instead of inline badges (cleaner UX)
   */
  public applySocialProof<T extends PsychologyEnhancedContent>(
    content: T[],
    userFollowing: string[] = [],
    userMetadata?: { similarUsers?: string[] }
  ): T[] {
    if (!this.config.socialProof.enabled) {
      return content;
    }

    return content.map(item => {
      item.triggeredNotifications = [];

      // FOLLOWER ENGAGEMENT → Trigger notification
      if (this.config.socialProof.notifyFollowerEngagement && userFollowing.length > 0) {
        const friendEngagementChance = 0.2; // 20% of content
        
        if (this.rng() < friendEngagementChance) {
          // Boost score for friend engagement (powerful signal)
          item.enhancedScore *= 1.5;
          
          // Queue notification to be sent
          item.triggeredNotifications.push({
            type: 'follower_engagement',
            priority: 0.8, // High priority
            delay: this.getRandomDelay(5000, 15000) // 5-15s random delay
          });
        }
      }

      // POPULARITY MILESTONES → Trigger notification
      if (this.config.socialProof.notifyPopularityMilestones && item.engagement) {
        const totalEngagement = 
          (item.engagement.reactions || 0) +
          (item.engagement.shares || 0) * 3 +
          (item.engagement.comments || 0) * 2;

        // Notify at milestones (1K, 10K, 100K, etc.)
        if (this.isPopularityMilestone(totalEngagement)) {
          item.triggeredNotifications.push({
            type: 'popularity_milestone',
            priority: 0.7,
            delay: this.getRandomDelay(10000, 30000)
          });
        }
      }

      // SIMILAR USERS → Trigger notification
      if (this.config.socialProof.notifySimilarUserActivity && userMetadata?.similarUsers) {
        if (this.rng() < 0.15) { // 15% of content
          item.enhancedScore *= 1.3;
          
          item.triggeredNotifications.push({
            type: 'similar_users',
            priority: 0.5,
            delay: this.getRandomDelay(15000, 45000)
          });
        }
      }

      return item;
    });
  }

  /**
   * 🎲 INTERMITTENT REINFORCEMENT
   * Implements variable ratio schedule (most resistant to extinction)
   */
  private shouldGiveReward(state: UserEngagementState): boolean {
    if (!this.config.intermittentReinforcement.enabled) {
      return false;
    }

    // COLD STREAK PROTECTION: Guarantee reward after max cold streak
    if (
      this.config.intermittentReinforcement.coldStreakProtection &&
      state.actionsSinceLastReward >= this.config.intermittentReinforcement.maxColdStreak
    ) {
      return true;
    }

    // VARIABLE RATIO: Random chance of reward
    return this.rng() < this.config.intermittentReinforcement.rewardProbability;
  }

  /**
   * Calculate reward intensity with variance
   * Creates unpredictable reward sizes (key to addiction)
   */
  private calculateRewardIntensity(state: UserEngagementState): number {
    const baseIntensity = 1.5;
    const variance = this.config.dopamineTriggers.rewardIntensityVariance;

    // Check for JACKPOT
    if (this.rng() < this.config.intermittentReinforcement.jackpotProbability) {
      return baseIntensity * (3 + this.rng() * 2); // 3x-5x boost
    }

    // Vary reward intensity randomly
    const randomVariance = (this.rng() - 0.5) * 2 * variance; // -variance to +variance
    return baseIntensity * (1 + randomVariance);
  }

  /**
   * 🕐 NOTIFICATION DELAY
   * Random delays create anticipation (dopamine spike on uncertainty)
   */
  public getNotificationDelay(): number {
    if (!this.config.dopamineTriggers.enabled) {
      return 0;
    }

    const { min, max } = this.config.dopamineTriggers.notificationDelay;
    return min + this.rng() * (max - min);
  }

  /**
   * Get or create user engagement state
   */
  private getUserState(userId: string): UserEngagementState {
    let state = this.userStates.get(userId);
    
    if (!state) {
      state = {
        userId,
        actionsSinceLastReward: 0,
        lastRewardTime: Date.now(),
        totalRewards: 0,
        averageRewardInterval: 5, // Average 1 reward per 5 actions
        currentStreak: 0,
        longestStreak: 0,
        lastActionTime: Date.now()
      };
      this.userStates.set(userId, state);
    }

    return state;
  }

  /**
   * Update user engagement state
   */
  private updateUserState(userId: string, state: UserEngagementState): void {
    state.lastActionTime = Date.now();
    this.userStates.set(userId, state);
  }

  /**
   * Wrap content item with psychology metadata
   */
  private wrapContent<T extends ContentItem>(item: T): PsychologyEnhancedContent {
    return {
      ...item,
      psychologyFlags: {},
      enhancedScore: item.score,
      displayMetadata: {}
    };
  }

  /**
   * Get random delay for notification (builds anticipation)
   */
  private getRandomDelay(min: number, max: number): number {
    return min + this.rng() * (max - min);
  }

  /**
   * Check if engagement count hits a milestone
   */
  private isPopularityMilestone(count: number): boolean {
    const milestones = [1000, 5000, 10000, 50000, 100000, 500000, 1000000];
    return milestones.some(m => Math.abs(count - m) < 10); // Within 10 of milestone
  }

  /**
   * Get user engagement statistics
   */
  public getUserStats(userId: string): UserEngagementState | null {
    return this.userStates.get(userId) || null;
  }

  /**
   * Reset user engagement state (for testing)
   */
  public resetUserState(userId: string): void {
    this.userStates.delete(userId);
  }

  /**
   * Update psychology configuration
   */
  public updateConfig(config: Partial<PsychologyConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      variableReward: { ...this.config.variableReward, ...config.variableReward },
      dopamineTriggers: { ...this.config.dopamineTriggers, ...config.dopamineTriggers },
      fomoMechanics: { ...this.config.fomoMechanics, ...config.fomoMechanics },
      socialProof: { ...this.config.socialProof, ...config.socialProof },
      intermittentReinforcement: { ...this.config.intermittentReinforcement, ...config.intermittentReinforcement }
    };
  }

  /**
   * Get current configuration
   */
  public getConfig(): PsychologyConfig {
    return { ...this.config };
  }
}

/**
 * Create default behavioral addiction engine
 */
export function createBehavioralAddictionEngine(
  config?: Partial<PsychologyConfig>
): BehavioralAddictionEngine {
  return new BehavioralAddictionEngine(config);
}
