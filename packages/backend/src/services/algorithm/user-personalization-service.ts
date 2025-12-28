/**
 * User Personalization Service
 * Manages per-user algorithm preferences and learning
 */

import { User } from '@/models/entities/user.js';
import { Note } from '@/models/entities/note.js';
import Logger from '@/services/logger.js';

const logger = new Logger('user-personalization-service');

/**
 * User preference profile
 */
export interface UserPreferenceProfile {
  userId: string;
  preferences: {
    // Content preferences
    topicAffinities: Record<string, number>; // topic -> affinity score (0-1)
    authorAffinities: Record<string, number>; // authorId -> affinity score (0-1)
    contentTypePreferences: Record<string, number>; // type -> preference (0-1)

    // Behavioral preferences
    diversityTolerance: number; // 0-1, how much diversity user wants
    freshnessWeight: number; // 0-1, preference for fresh content
    qualityThreshold: number; // 0-1, minimum quality threshold

    // Engagement patterns
    averageDwellTime: number; // ms
    preferredScrollDepth: number; // 0-1
    activeTimeWindows: number[]; // hours of day when most active

    // Sentiment preferences
    sentimentPreference: 'positive' | 'negative' | 'neutral' | 'mixed';
    emotionalEngagement: number; // 0-1, how much user engages with emotional content
  };

  // Learning metadata
  confidence: number; // 0-1, confidence in preferences
  lastUpdated: Date;
  signalCount: number; // total signals processed
  version: number; // for preference evolution tracking
}

/**
 * Algorithm configuration per user
 */
export interface UserAlgorithmConfig {
  userId: string;

  // Algorithm weights
  relevanceWeight: number; // 0-1
  diversityWeight: number; // 0-1
  freshnessWeight: number; // 0-1
  qualityWeight: number; // 0-1
  personalizedWeight: number; // 0-1

  // Feature flags
  enableMMR: boolean;
  enableQualityFilter: boolean;
  enableMultiSignal: boolean;
  enableSerendipity: boolean;

  // Performance settings
  maxProcessingTime: number; // ms
  cacheEnabled: boolean;

  // A/B test assignments
  experimentGroups: Record<string, string>;

  lastUpdated: Date;
}

/**
 * User Personalization Service
 */
export class UserPersonalizationService {
  private static instance: UserPersonalizationService;
  private userProfiles = new Map<string, UserPreferenceProfile>();
  private userConfigs = new Map<string, UserAlgorithmConfig>();
  private profileCache = new Map<string, { profile: UserPreferenceProfile; expiry: number }>();

  private constructor() {
    // Start periodic profile cleanup
    this.startProfileCleanup();
  }

  public static getInstance(): UserPersonalizationService {
    if (!UserPersonalizationService.instance) {
      UserPersonalizationService.instance = new UserPersonalizationService();
    }
    return UserPersonalizationService.instance;
  }

  /**
   * Get user preference profile
   */
  public async getUserProfile(userId: string): Promise<UserPreferenceProfile> {
    // Check cache first
    const cached = this.profileCache.get(userId);
    if (cached && cached.expiry > Date.now()) {
      return cached.profile;
    }

    // Check memory store
    let profile = this.userProfiles.get(userId);

    if (!profile) {
      // Create default profile for new user
      profile = this.createDefaultProfile(userId);
      this.userProfiles.set(userId, profile);
    }

    // Cache for 5 minutes
    this.profileCache.set(userId, {
      profile,
      expiry: Date.now() + 5 * 60 * 1000
    });

    return profile;
  }

  /**
   * Get user algorithm configuration
   */
  public async getUserConfig(userId: string): Promise<UserAlgorithmConfig> {
    let config = this.userConfigs.get(userId);

    if (!config) {
      config = await this.createUserConfig(userId);
      this.userConfigs.set(userId, config);
    }

    return config;
  }

  /**
   * Update user preferences based on signal
   */
  public async updateUserPreferences(
    userId: string,
    signalType: string,
    contentId: string,
    context: any
  ): Promise<void> {
    try {
      const profile = await this.getUserProfile(userId);

      // Update based on signal type
      switch (signalType) {
        case 'note_reaction':
          await this.updateFromReaction(profile, context);
          break;
        case 'note_view':
          await this.updateFromView(profile, context);
          break;
        case 'dwell_time':
          await this.updateFromDwellTime(profile, context);
          break;
        case 'scroll_depth':
          await this.updateFromScroll(profile, context);
          break;
        default:
          await this.updateFromGenericSignal(profile, signalType, context);
      }

      // Update metadata
      profile.signalCount++;
      profile.lastUpdated = new Date();
      profile.confidence = Math.min(profile.confidence + 0.001, 1.0);

      // Save updated profile
      this.userProfiles.set(userId, profile);

      // Invalidate cache
      this.profileCache.delete(userId);

      logger.debug(`Updated preferences for user ${userId} from ${signalType} signal`);

    } catch (error) {
      logger.error(`Failed to update user preferences for ${userId}:`, error as Error);
    }
  }

  /**
   * Get personalized algorithm weights for user
   */
  public async getPersonalizedWeights(userId: string): Promise<{
    relevance: number;
    diversity: number;
    freshness: number;
    quality: number;
    personalization: number;
  }> {
    const profile = await this.getUserProfile(userId);
    const config = await this.getUserConfig(userId);

    return {
      relevance: config.relevanceWeight,
      diversity: profile.preferences.diversityTolerance * config.diversityWeight,
      freshness: profile.preferences.freshnessWeight * config.freshnessWeight,
      quality: profile.preferences.qualityThreshold * config.qualityWeight,
      personalization: config.personalizedWeight
    };
  }

  /**
   * Calculate content relevance for user
   */
  public async calculateContentRelevance(
    userId: string,
    content: any
  ): Promise<number> {
    const profile = await this.getUserProfile(userId);
    let relevance = 0.5; // Base relevance

    // Topic affinity
    if (content.topics) {
      for (const topic of content.topics) {
        const affinity = profile.preferences.topicAffinities[topic] || 0;
        relevance += affinity * 0.3;
      }
    }

    // Author affinity
    if (content.authorId) {
      const authorAffinity = profile.preferences.authorAffinities[content.authorId] || 0;
      relevance += authorAffinity * 0.2;
    }

    // Content type preference
    if (content.contentType) {
      const typePreference = profile.preferences.contentTypePreferences[content.contentType] || 0.5;
      relevance += (typePreference - 0.5) * 0.2;
    }

    // Freshness preference (less aggressive)
    if (content.createdAt) {
      const ageHours = (Date.now() - new Date(content.createdAt).getTime()) / (1000 * 60 * 60);
      const freshnessScore = Math.exp(-ageHours / 168); // 7-day decay instead of 24-hour
      relevance += freshnessScore * profile.preferences.freshnessWeight * 0.2; // Reduced weight
    }

    return Math.max(0, Math.min(1, relevance));
  }

  /**
   * Create default profile for new user
   */
  private createDefaultProfile(userId: string): UserPreferenceProfile {
    return {
      userId,
      preferences: {
        topicAffinities: {},
        authorAffinities: {},
        contentTypePreferences: {
          text: 0.6,
          image: 0.7,
          video: 0.5,
          poll: 0.4
        },
        diversityTolerance: 0.5,
        freshnessWeight: 0.6,
        qualityThreshold: 0.4,
        averageDwellTime: 3000, // 3 seconds
        preferredScrollDepth: 0.7,
        activeTimeWindows: [], // Will be learned
        sentimentPreference: 'mixed',
        emotionalEngagement: 0.5
      },
      confidence: 0.1, // Low confidence for new users
      lastUpdated: new Date(),
      signalCount: 0,
      version: 1
    };
  }

  /**
   * Create user algorithm configuration with A/B testing
   */
  private async createUserConfig(userId: string): Promise<UserAlgorithmConfig> {
    // Assign to A/B test groups
    const experimentGroups = await this.assignExperimentGroups(userId);

    // Base configuration
    let config: UserAlgorithmConfig = {
      userId,
      relevanceWeight: 0.4,
      diversityWeight: 0.3,
      freshnessWeight: 0.2,
      qualityWeight: 0.1,
      personalizedWeight: 0.7,
      enableMMR: true,
      enableQualityFilter: true,
      enableMultiSignal: true,
      enableSerendipity: false,
      maxProcessingTime: 20,
      cacheEnabled: true,
      experimentGroups,
      lastUpdated: new Date()
    };

    // Apply A/B test variations
    config = this.applyExperimentVariations(config, experimentGroups);

    return config;
  }

  /**
   * Assign user to A/B test groups
   */
  private async assignExperimentGroups(userId: string): Promise<Record<string, string>> {
    const groups: Record<string, string> = {};

    // Hash user ID for consistent assignment
    const userHash = this.hashUserId(userId);

    // Algorithm weight experiment
    groups.algorithm_weights = userHash % 3 === 0 ? 'high_diversity' :
      userHash % 3 === 1 ? 'high_relevance' : 'balanced';

    // MMR lambda experiment
    groups.mmr_lambda = userHash % 2 === 0 ? 'conservative' : 'aggressive';

    // Quality threshold experiment
    groups.quality_threshold = userHash % 4 === 0 ? 'strict' :
      userHash % 4 === 1 ? 'moderate' :
        userHash % 4 === 2 ? 'lenient' : 'adaptive';

    // Serendipity experiment
    groups.serendipity = userHash % 5 === 0 ? 'enabled' : 'disabled';

    return groups;
  }

  /**
   * Apply A/B test variations to config
   */
  private applyExperimentVariations(
    config: UserAlgorithmConfig,
    groups: Record<string, string>
  ): UserAlgorithmConfig {
    // Algorithm weights experiment
    switch (groups.algorithm_weights) {
      case 'high_diversity':
        config.diversityWeight = 0.5;
        config.relevanceWeight = 0.3;
        break;
      case 'high_relevance':
        config.relevanceWeight = 0.6;
        config.diversityWeight = 0.2;
        break;
      // 'balanced' uses default weights
    }

    // Quality threshold experiment
    switch (groups.quality_threshold) {
      case 'strict':
        config.qualityWeight = 0.3;
        break;
      case 'moderate':
        config.qualityWeight = 0.2;
        break;
      case 'lenient':
        config.qualityWeight = 0.05;
        break;
      // 'adaptive' uses default
    }

    // Serendipity experiment
    config.enableSerendipity = groups.serendipity === 'enabled';

    return config;
  }

  /**
   * Update preferences from reaction signal
   */
  private async updateFromReaction(profile: UserPreferenceProfile, context: any): Promise<void> {
    const sentiment = context.sentiment || 'neutral';
    const reactionType = context.reactionType || '';

    // Update sentiment preference
    if (sentiment !== 'neutral') {
      const currentPref = profile.preferences.sentimentPreference;
      if (currentPref === 'mixed' || currentPref === sentiment) {
        // Reinforce preference
        profile.preferences.emotionalEngagement = Math.min(
          profile.preferences.emotionalEngagement + 0.01,
          1.0
        );
      }
    }

    // Update author affinity
    if (context.noteAuthor) {
      const currentAffinity = profile.preferences.authorAffinities[context.noteAuthor] || 0.5;
      const boost = sentiment === 'positive' ? 0.05 : sentiment === 'negative' ? -0.03 : 0.01;
      profile.preferences.authorAffinities[context.noteAuthor] = Math.max(0, Math.min(1, currentAffinity + boost));
    }
  }

  /**
   * Update preferences from view signal
   */
  private async updateFromView(profile: UserPreferenceProfile, context: any): Promise<void> {
    // Update content type preferences based on views
    if (context.contentType) {
      const currentPref = profile.preferences.contentTypePreferences[context.contentType] || 0.5;
      profile.preferences.contentTypePreferences[context.contentType] = Math.min(currentPref + 0.001, 1.0);
    }

    // Update time-based patterns
    const hour = new Date().getHours();
    if (!profile.preferences.activeTimeWindows.includes(hour)) {
      profile.preferences.activeTimeWindows.push(hour);
      // Keep only recent active hours (last 7 unique hours)
      if (profile.preferences.activeTimeWindows.length > 7) {
        profile.preferences.activeTimeWindows.shift();
      }
    }
  }

  /**
   * Update preferences from dwell time signal
   */
  private async updateFromDwellTime(profile: UserPreferenceProfile, context: any): Promise<void> {
    if (context.dwellTimeMs) {
      // Update average dwell time with exponential moving average
      const alpha = 0.1; // Learning rate
      profile.preferences.averageDwellTime =
        alpha * context.dwellTimeMs + (1 - alpha) * profile.preferences.averageDwellTime;

      // If user spent significant time, boost quality threshold
      if (context.dwellTimeMs > 10000) { // 10+ seconds
        profile.preferences.qualityThreshold = Math.min(
          profile.preferences.qualityThreshold + 0.005,
          1.0
        );
      }
    }
  }

  /**
   * Update preferences from scroll signal
   */
  private async updateFromScroll(profile: UserPreferenceProfile, context: any): Promise<void> {
    if (context.scrollDepth !== undefined) {
      // Update preferred scroll depth
      const alpha = 0.05;
      profile.preferences.preferredScrollDepth =
        alpha * context.scrollDepth + (1 - alpha) * profile.preferences.preferredScrollDepth;
    }
  }

  /**
   * Update from generic signal
   */
  private async updateFromGenericSignal(
    profile: UserPreferenceProfile,
    signalType: string,
    context: any
  ): Promise<void> {
    // Handle other signal types
    switch (signalType) {
      case 'search_query':
        // Could extract topics from search queries
        break;
      case 'follow_action':
        // Update social preferences
        break;
    }
  }

  /**
   * Hash user ID for consistent experiment assignment
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
   * Start periodic profile cleanup
   */
  private startProfileCleanup(): void {
    setInterval(() => {
      // Clean up old cache entries
      const now = Date.now();
      for (const [userId, cached] of this.profileCache.entries()) {
        if (cached.expiry < now) {
          this.profileCache.delete(userId);
        }
      }

      // In production, would also persist profiles to database
      logger.debug(`Profile cache cleanup: ${this.profileCache.size} entries remaining`);
    }, 10 * 60 * 1000); // Every 10 minutes
  }

  /**
   * Get user experiment assignment
   */
  public async getUserExperiments(userId: string): Promise<Record<string, string>> {
    const config = await this.getUserConfig(userId);
    return config.experimentGroups;
  }

  /**
   * Get personalization statistics
   */
  public getStats(): {
    totalUsers: number;
    averageConfidence: number;
    averageSignalCount: number;
    cacheHitRate: number;
  } {
    const profiles = Array.from(this.userProfiles.values());

    return {
      totalUsers: profiles.length,
      averageConfidence: profiles.length > 0
        ? profiles.reduce((sum, p) => sum + p.confidence, 0) / profiles.length
        : 0,
      averageSignalCount: profiles.length > 0
        ? profiles.reduce((sum, p) => sum + p.signalCount, 0) / profiles.length
        : 0,
      cacheHitRate: this.profileCache.size / Math.max(this.userProfiles.size, 1)
    };
  }
}

// Export singleton instance
export const userPersonalizationService = UserPersonalizationService.getInstance();