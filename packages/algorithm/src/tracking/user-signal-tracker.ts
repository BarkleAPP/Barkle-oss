/**
 * User Signal Tracker for Algorithm Microservice
 * Simplified version for microservice architecture
 */

export interface UserSignal {
  userId: string;
  contentId: string;
  signalType: SignalType;
  strength: number; // 0-1 scale
  timestamp: Date;
  context?: SignalContext;
}

export type SignalType =
  | 'view' | 'dwell_time' | 'reaction_positive' | 'reaction_negative' | 'reply' | 'renote' | 'quote'
  | 'follow' | 'unfollow' | 'mute' | 'block' | 'report'
  | 'click_profile' | 'click_link' | 'share_external'
  | 'scroll_past' | 'negative_feedback';

export interface SignalContext {
  dwellTimeMs?: number;
  scrollDepth?: number;
  timelinePosition?: number;
  deviceType?: string;
  source?: 'timeline' | 'search' | 'notification' | 'direct';
  reactionType?: string; // The actual emoji/reaction used
  reactionSentiment?: 'positive' | 'negative' | 'neutral';
}

export interface UserPreferences {
  userId: string;
  topicAffinities: Map<string, number>; // topic -> affinity score
  authorAffinities: Map<string, number>; // authorId -> affinity score
  contentTypePreferences: Map<string, number>; // type -> preference score
  engagementPatterns: {
    averageDwellTime: number;
    preferredTimeOfDay: number[];
    engagementRate: number;
    diversityTolerance: number;
  };
  negativeSignals: {
    mutedTopics: Set<string>;
    blockedAuthors: Set<string>;
    reportedContent: Set<string>;
  };
  lastUpdated: Date;
}

export class UserSignalTracker {
  private static signals: Map<string, UserSignal[]> = new Map();
  private static preferences: Map<string, UserPreferences> = new Map();
  private static persistenceCallback: ((userId: string, preferences: UserPreferences) => Promise<void>) | null = null;
  private static loadCallback: ((userId: string) => Promise<UserPreferences | null>) | null = null;

  /**
   * Track a user interaction signal
   */
  static async trackSignal(signal: UserSignal): Promise<void> {
    try {
      // Store signal in memory for microservice
      const userSignals = this.signals.get(signal.userId) || [];
      userSignals.push(signal);

      // Keep only recent signals (last 1000)
      if (userSignals.length > 1000) {
        userSignals.shift();
      }

      this.signals.set(signal.userId, userSignals);

      // Invalidate preferences cache to force recalculation
      this.preferences.delete(signal.userId);

      // Update real-time metrics for hot signals
      if (['reaction_positive', 'reply', 'renote', 'share_external'].includes(signal.signalType)) {
        await this.updateHotSignals(signal);
      }

    } catch (error) {
      console.error('Error tracking signal:', error);
    }
  }

  /**
   * Update hot signals for real-time recommendations
   */
  private static async updateHotSignals(signal: UserSignal): Promise<void> {
    // This method can be used to update real-time recommendation caches
    // For now, it's a placeholder for future enhancement
  }

  /**
   * Get user preferences based on historical signals
   */
  static async getUserPreferences(userId: string): Promise<UserPreferences | null> {
    // Check cache first
    if (this.preferences.has(userId)) {
      return this.preferences.get(userId)!;
    }

    // Try loading from persistent storage
    const loaded = await this.loadPreferences(userId);
    if (loaded) {
      return loaded;
    }

    // Calculate fresh preferences
    const preferences = await this.calculateUserPreferences(userId);
    this.preferences.set(userId, preferences);

    // Save to persistent storage
    await this.savePreferences(userId);

    return preferences;
  }

  /**
   * Calculate user preferences from signals
   */
  private static async calculateUserPreferences(userId: string): Promise<UserPreferences> {
    const userSignals = this.signals.get(userId) || [];

    const topicAffinities = new Map<string, number>();
    const authorAffinities = new Map<string, number>();
    const contentTypePreferences = new Map<string, number>();
    const mutedTopics = new Set<string>();
    const blockedAuthors = new Set<string>();
    const reportedContent = new Set<string>();

    // Calculate engagement metrics
    let totalDwellTime = 0;
    let dwellTimeCount = 0;
    const timeOfDayMap = new Map<number, number>();
    let engagementCount = 0;

    // Analyze signals for preferences
    for (const signal of userSignals) {
      const strength = signal.strength;

      // Process based on signal type
      switch (signal.signalType) {
        case 'reaction_positive':
        case 'reply':
        case 'renote':
        case 'quote':
        case 'share_external':
          // Positive engagement - boost author affinity
          engagementCount++;
          const currentAuthorAffinity = authorAffinities.get(signal.contentId) || 0.5;
          authorAffinities.set(signal.contentId, Math.min(currentAuthorAffinity + (strength * 0.1), 1.0));

          // Track content type preference
          const contentType = this.inferContentType(signal);
          const currentTypePreference = contentTypePreferences.get(contentType) || 0.5;
          contentTypePreferences.set(contentType, Math.min(currentTypePreference + 0.05, 1.0));
          break;

        case 'reaction_negative':
        case 'negative_feedback':
        case 'scroll_past':
          // Negative signal - reduce author affinity
          const negAuthorAffinity = authorAffinities.get(signal.contentId) || 0.5;
          authorAffinities.set(signal.contentId, Math.max(negAuthorAffinity - (strength * 0.05), 0.0));
          break;

        case 'mute':
          // Strong negative signal - mute author
          mutedTopics.add(signal.contentId);
          authorAffinities.set(signal.contentId, 0.0);
          break;

        case 'block':
          // Strongest negative signal - block author
          blockedAuthors.add(signal.contentId);
          authorAffinities.set(signal.contentId, 0.0);
          break;

        case 'report':
          // Report content
          reportedContent.add(signal.contentId);
          break;

        case 'follow':
          // Follow action - strong positive signal
          const followAffinity = authorAffinities.get(signal.contentId) || 0.5;
          authorAffinities.set(signal.contentId, Math.min(followAffinity + 0.3, 1.0));
          break;

        case 'unfollow':
          // Unfollow - negative signal
          const unfollowAffinity = authorAffinities.get(signal.contentId) || 0.5;
          authorAffinities.set(signal.contentId, Math.max(unfollowAffinity - 0.3, 0.0));
          break;

        case 'dwell_time':
          // Track dwell time for engagement patterns
          if (signal.context?.dwellTimeMs) {
            totalDwellTime += signal.context.dwellTimeMs;
            dwellTimeCount++;
          }
          break;

        case 'view':
          // Track time of day patterns
          const hour = signal.timestamp.getHours();
          timeOfDayMap.set(hour, (timeOfDayMap.get(hour) || 0) + 1);
          break;
      }
    }

    // Calculate average dwell time
    const averageDwellTime = dwellTimeCount > 0 ? totalDwellTime / dwellTimeCount : 5000;

    // Calculate preferred time of day (top 4 hours)
    const preferredTimeOfDay = Array.from(timeOfDayMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([hour]) => hour);

    // Calculate engagement rate
    const engagementRate = userSignals.length > 0 ? engagementCount / userSignals.length : 0.1;

    // Calculate diversity tolerance (users who engage with varied content score higher)
    const uniqueAuthors = new Set(Array.from(authorAffinities.keys())).size;
    const diversityTolerance = Math.min(uniqueAuthors / Math.max(userSignals.length, 1) * 2, 1.0);

    return {
      userId,
      topicAffinities,
      authorAffinities,
      contentTypePreferences,
      engagementPatterns: {
        averageDwellTime,
        preferredTimeOfDay: preferredTimeOfDay.length > 0 ? preferredTimeOfDay : [9, 12, 18, 21],
        engagementRate,
        diversityTolerance
      },
      negativeSignals: {
        mutedTopics,
        blockedAuthors,
        reportedContent
      },
      lastUpdated: new Date()
    };
  }

  /**
   * Infer content type from signal context
   */
  private static inferContentType(signal: UserSignal): string {
    if (signal.signalType === 'renote') return 'renote';
    if (signal.signalType === 'reply') return 'reply';
    if (signal.signalType === 'quote') return 'quote';
    return 'post';
  }

  /**
   * Get signal statistics
   */
  static getSignalStats(): {
    totalUsers: number;
    totalSignals: number;
    recentSignals: number;
  } {
    let totalSignals = 0;
    let recentSignals = 0;
    const oneHourAgo = Date.now() - 3600000;

    for (const userSignals of this.signals.values()) {
      totalSignals += userSignals.length;
      recentSignals += userSignals.filter(s => s.timestamp.getTime() > oneHourAgo).length;
    }

    return {
      totalUsers: this.signals.size,
      totalSignals,
      recentSignals
    };
  }

  /**
   * Get user's author affinities for recommendation
   */
  static async getUserAuthorAffinities(userId: string): Promise<Map<string, number>> {
    const preferences = await this.getUserPreferences(userId);
    return preferences ? preferences.authorAffinities : new Map();
  }

  /**
   * Get user's negative signals for filtering
   */
  static async getUserNegativeSignals(userId: string): Promise<{
    mutedTopics: Set<string>;
    blockedAuthors: Set<string>;
    reportedContent: Set<string>;
  }> {
    const preferences = await this.getUserPreferences(userId);
    return preferences ? preferences.negativeSignals : {
      mutedTopics: new Set(),
      blockedAuthors: new Set(),
      reportedContent: new Set()
    };
  }

  /**
   * Check if user has blocked or muted an author
   */
  static async isAuthorFiltered(userId: string, authorId: string): Promise<boolean> {
    const negativeSignals = await this.getUserNegativeSignals(userId);
    return negativeSignals.blockedAuthors.has(authorId) || negativeSignals.mutedTopics.has(authorId);
  }

  /**
   * Get engagement strength for content ranking
   */
  static async getEngagementStrength(userId: string, authorId: string): Promise<number> {
    const affinities = await this.getUserAuthorAffinities(userId);
    return affinities.get(authorId) || 0.5; // Default neutral
  }

  /**
   * Register persistence callback for saving user preferences to database
   */
  static registerPersistenceCallback(
    saveCallback: (userId: string, preferences: UserPreferences) => Promise<void>,
    loadCallback: (userId: string) => Promise<UserPreferences | null>
  ): void {
    this.persistenceCallback = saveCallback;
    this.loadCallback = loadCallback;
  }

  /**
   * Save preferences to persistent storage
   */
  static async savePreferences(userId: string): Promise<void> {
    const preferences = this.preferences.get(userId);
    if (preferences && this.persistenceCallback) {
      try {
        await this.persistenceCallback(userId, preferences);
      } catch (error) {
        console.error(`[UserSignalTracker] Failed to save preferences for ${userId}:`, error);
      }
    }
  }

  /**
   * Load preferences from persistent storage
   */
  static async loadPreferences(userId: string): Promise<UserPreferences | null> {
    if (this.loadCallback) {
      try {
        const stored = await this.loadCallback(userId);
        if (stored) {
          this.preferences.set(userId, stored);
          return stored;
        }
      } catch (error) {
        console.error(`[UserSignalTracker] Failed to load preferences for ${userId}:`, error);
      }
    }
    return null;
  }

  /**
   * Save all user preferences (for batch persistence)
   */
  static async saveAllPreferences(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const userId of this.preferences.keys()) {
      promises.push(this.savePreferences(userId));
    }
    await Promise.all(promises);
  }

  /**
   * Get all preferences for batch saving
   */
  static getAllPreferences(): Map<string, UserPreferences> {
    return new Map(this.preferences);
  }
}