/**
 * Timeline Mixer Service - Ensures Fresh Content on Each Refresh
 * Integrates with A/B Testing for Dynamic Algorithm Configuration
 */

import Logger from '@/services/logger.js';
import { abTestingService } from './ab-testing-service.js';
import { Note } from '@/models/entities/note.js';

const logger = new Logger('timeline-mixer');

export interface TimelineMixerOptions {
  userId: string;
  limit: number;
  diversityLevel?: number;
  enableFreshness?: boolean;
  enableSerendipity?: boolean;
  cacheBypass?: boolean;
  sessionId?: string;
  legacyMode?: boolean;
  showTimelineReplies?: boolean; // User preference for showing replies
  maxPostsPerUser?: number; // Maximum posts from same user
  maxSelfPosts?: number; // Maximum posts from yourself
  minimumRetention?: number; // Minimum % of posts to retain on refresh
  followingIds?: string[]; // User's following list for proper filtering
}

export interface MixedTimelineResult {
  notes: Note[];
  metadata: {
    mixingStrategy: string;
    freshnessScore: number;
    diversityScore: number;
    experimentVariant?: string;
    cacheHit: boolean;
    processingTimeMs: number;
    totalCandidates: number;
    mixedCount: number;
  };
}

/**
 * Timeline Mixer Service - Ensures Dynamic Content Mixing
 */
export class TimelineMixerService {
  private static instance: TimelineMixerService;
  private sessionCache = new Map<string, Set<string>>(); // Track seen content per session
  private userSeenContent = new Map<string, Set<string>>(); // Track seen content per user
  private mixingStrategies = ['chronological', 'relevance', 'diversity', 'serendipity', 'quality'];

  private constructor() {
    // Clean up old session data every hour
    setInterval(() => this.cleanupSessions(), 60 * 60 * 1000);
  }

  public static getInstance(): TimelineMixerService {
    if (!TimelineMixerService.instance) {
      TimelineMixerService.instance = new TimelineMixerService();
    }
    return TimelineMixerService.instance;
  }

  /**
   * Generate mixed timeline with A/B testing integration
   */
  public async generateMixedTimeline(
    candidateNotes: Note[],
    options: TimelineMixerOptions
  ): Promise<MixedTimelineResult> {
    const startTime = Date.now();

    try {
      // Get user's A/B test configuration
      const abConfig = await abTestingService.getUserTimelineConfig(options.userId);
      const userAssignment = await abTestingService.getUserAssignment(options.userId);

      // Determine mixing strategy based on A/B test
      const mixingStrategy = this.selectMixingStrategy(abConfig, userAssignment);

      // CRITICAL FIX: On cache bypass (force refresh), generate NEW session ID
      const forceNewSession = options.cacheBypass || false;
      const sessionId = options.sessionId || this.generateTimeBasedSessionId(options.userId, options.legacyMode, forceNewSession);

      // CRITICAL FIX: Clear seen content on force refresh to show fresh posts
      if (forceNewSession) {
        logger.info(`Force refresh detected for user ${options.userId}, clearing seen content`);
        this.invalidateUserCache(options.userId);
      }

      const seenContent = this.getSeenContent(options.userId, sessionId, options.legacyMode);

      // CRITICAL FIX: Add more randomness on refresh - use milliseconds instead of minutes
      const timeSeed = forceNewSession
        ? Date.now() // Completely unique on each refresh
        : (options.legacyMode
          ? Math.floor(Date.now() / (5 * 60 * 1000)) // Changes every 5 minutes for legacy (reduced from 10)
          : Math.floor(Date.now() / (3 * 60 * 1000))); // Changes every 3 minutes for new clients (reduced from 5)

      const randomizedCandidates = this.addTimeBasedRandomization(candidateNotes, timeSeed, options.legacyMode, forceNewSession);

      // CRITICAL FIX: On force refresh, disable seen content filtering to show fresh mix
      const freshCandidates = forceNewSession
        ? randomizedCandidates // Skip filtering on refresh - show everything with new randomization
        : this.filterSeenContent(
          randomizedCandidates,
          seenContent,
          options.enableFreshness !== false,
          options.legacyMode
        );

      // Apply A/B test specific mixing
      const mixedNotes = await this.applyMixingStrategy(
        freshCandidates,
        mixingStrategy,
        abConfig,
        options
      );

      // Update seen content tracking
      this.updateSeenContent(options.userId, sessionId, mixedNotes);

      // Calculate metadata
      const processingTime = Date.now() - startTime;
      const metadata = {
        mixingStrategy,
        freshnessScore: this.calculateFreshnessScore(mixedNotes, candidateNotes),
        diversityScore: this.calculateDiversityScore(mixedNotes),
        experimentVariant: this.getExperimentVariant(userAssignment),
        cacheHit: false, // Always fresh mixing
        processingTimeMs: processingTime,
        totalCandidates: candidateNotes.length,
        mixedCount: mixedNotes.length,
        sessionId,
        timeSeed
      };

      logger.info(`Mixed timeline for user ${options.userId}: ${mixedNotes.length} notes, strategy: ${mixingStrategy}, time: ${processingTime}ms, seed: ${timeSeed}`);

      return {
        notes: mixedNotes.slice(0, options.limit),
        metadata
      };

    } catch (error) {
      logger.error('Timeline mixing failed:', error as Error);

      // Fallback to randomized chronological
      const fallbackNotes = this.shuffleArray([...candidateNotes]);

      return {
        notes: fallbackNotes.slice(0, options.limit),
        metadata: {
          mixingStrategy: 'fallback_randomized',
          freshnessScore: 0.5, // Some freshness from randomization
          diversityScore: 0,
          cacheHit: false,
          processingTimeMs: Date.now() - startTime,
          totalCandidates: candidateNotes.length,
          mixedCount: fallbackNotes.length
        }
      };
    }
  }

  /**
   * Generate time-based session ID that changes periodically
   * CRITICAL FIX: Add randomness on each call to ensure refreshes get NEW content
   */
  private generateTimeBasedSessionId(userId: string, legacyMode = false, forceNew = false): string {
    // If forcing new session (explicit refresh), generate completely unique ID
    if (forceNew) {
      const randomSuffix = Math.random().toString(36).substring(2, 9);
      return `refresh_${userId}_${Date.now()}_${randomSuffix}`;
    }

    // Legacy clients: Session changes every 5 minutes (reduced from 15 for more freshness)
    // New clients: Session changes every 3 minutes (reduced from 10 for more dynamism)
    const interval = legacyMode ? (5 * 60 * 1000) : (3 * 60 * 1000);
    const timeSlot = Math.floor(Date.now() / interval);
    const prefix = legacyMode ? 'legacy' : 'modern';
    return `${prefix}_${userId}_${timeSlot}`;
  }

  /**
   * Add time-based randomization while maintaining some consistency
   * CRITICAL FIX: Add forceRandom flag for true randomness on explicit refreshes
   */
  private addTimeBasedRandomization(notes: Note[], timeSeed: number, _legacyMode = false, forceRandom = false): Note[] {
    // On force refresh, use TRUE randomization for completely fresh order
    if (forceRandom) {
      return this.shuffleArray([...notes]);
    }

    // Create a seeded random function for consistent but changing results
    const seededRandom = (seed: number) => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };

    // Sort notes with time-based randomization
    return [...notes].sort((a, b) => {
      // Combine note ID with time seed for consistent but changing order
      const seedA = parseInt(a.id.slice(-6), 16) + timeSeed;
      const seedB = parseInt(b.id.slice(-6), 16) + timeSeed;

      const randomA = seededRandom(seedA);
      const randomB = seededRandom(seedB);

      // Mix randomization with recency (80% random, 20% chronological for more variety)
      // Increased from 70/30 to make timeline feel less repetitive
      const scoreA = randomA * 0.8 + (a.createdAt.getTime() / Date.now()) * 0.2;
      const scoreB = randomB * 0.8 + (b.createdAt.getTime() / Date.now()) * 0.2;

      return scoreB - scoreA;
    });
  }

  /**
   * Select mixing strategy based on A/B test configuration
   */
  private selectMixingStrategy(abConfig: any, userAssignment: any): string {
    // Check if user is in an experiment
    const experiments = Object.keys(userAssignment.experiments);
    if (experiments.length > 0) {
      const primaryExperiment = experiments[0];
      const variant = userAssignment.experiments[primaryExperiment];

      // Determine strategy based on experiment variant
      if (variant.variantId.includes('diversity')) return 'diversity';
      if (variant.variantId.includes('relevance')) return 'relevance';
      if (variant.variantId.includes('serendipity')) return 'serendipity';
      if (variant.variantId.includes('quality')) return 'quality';
    }

    // Default strategy based on weights
    const weights = abConfig.weights;
    if (weights.diversity > 0.4) return 'diversity';
    if (weights.relevance > 0.5) return 'relevance';
    if (weights.serendipity > 0.2) return 'serendipity';
    if (weights.quality > 0.3) return 'quality';

    return 'chronological';
  }

  /**
   * Apply specific mixing strategy
   */
  private async applyMixingStrategy(
    notes: Note[],
    strategy: string,
    abConfig: any,
    options: TimelineMixerOptions
  ): Promise<Note[]> {
    // First apply diversity and content limits
    const filteredNotes = this.applyDiversityLimits(notes, options);

    // Then apply the selected mixing strategy
    switch (strategy) {
      case 'diversity':
        return this.applyDiversityMixing(filteredNotes, abConfig, options);

      case 'relevance':
        return this.applyRelevanceMixing(filteredNotes, abConfig, options);

      case 'serendipity':
        return this.applySerendipityMixing(filteredNotes, abConfig, options);

      case 'quality':
        return this.applyQualityMixing(filteredNotes, abConfig, options);

      case 'chronological':
      default:
        return this.applyChronologicalMixing(filteredNotes, options);
    }
  }

  /**
   * Apply diversity limits to prevent timeline domination by single users
   * and filter replies based on user preferences
   */
  private applyDiversityLimits(notes: Note[], options: TimelineMixerOptions): Note[] {
    // AGGRESSIVE limits for better UX (Twitter/Instagram-style)
    const maxPostsPerUser = options.maxPostsPerUser || 3; // Max 3 posts from same user (reduced from 5)
    const maxSelfPosts = options.maxSelfPosts || 1; // Max 1 of your own posts (reduced from 3)
    const showTimelineReplies = options.showTimelineReplies !== false; // Default to true

    // CRITICAL: Deduplicate posts first - prevent same post appearing twice
    const seenPostIds = new Set<string>();
    const deduplicatedNotes = notes.filter(note => {
      if (seenPostIds.has(note.id)) {
        logger.debug(`Filtered duplicate post: ${note.id}`);
        return false;
      }
      seenPostIds.add(note.id);
      return true;
    });

    if (deduplicatedNotes.length < notes.length) {
      logger.info(`Deduplicated ${notes.length - deduplicatedNotes.length} duplicate posts`);
    }

    // Filter out replies if user preference is disabled
    let filteredNotes = deduplicatedNotes;
    if (!showTimelineReplies) {
      filteredNotes = deduplicatedNotes.filter(note => {
        // Keep non-reply posts
        if (!note.replyId) return true;

        // Keep self-replies (user replying to themselves)
        if (note.replyUserId === note.userId) return true;

        // Keep replies TO the current user
        if (note.replyUserId === options.userId) return true;

        // Keep replies BY the current user
        if (note.userId === options.userId) return true;

        // Filter out other replies
        return false;
      });

      logger.info(`Filtered ${notes.length - filteredNotes.length} replies based on user preferences`);
    }

    // Track posts per user
    const userPostCount = new Map<string, number>();
    const result: Note[] = [];

    for (const note of filteredNotes) {
      const userId = note.userId;
      const currentCount = userPostCount.get(userId) || 0;

      // Check if this is a self-post
      const isSelfPost = userId === options.userId;
      const limit = isSelfPost ? maxSelfPosts : maxPostsPerUser;

      // Skip if user has exceeded their limit
      if (currentCount >= limit) {
        continue;
      }

      result.push(note);
      userPostCount.set(userId, currentCount + 1);
    }

    const totalFiltered = filteredNotes.length - result.length;
    if (totalFiltered > 0) {
      logger.info(`Applied diversity limits: filtered ${totalFiltered} posts (${userPostCount.size} unique authors)`);
    }

    return result;
  }

  /**
   * Diversity-focused mixing
   * Enhanced to ensure balanced distribution across authors
   */
  private async applyDiversityMixing(notes: Note[], abConfig: any, options: TimelineMixerOptions): Promise<Note[]> {
    // Group notes by author
    const authorGroups = new Map<string, Note[]>();

    notes.forEach(note => {
      if (!authorGroups.has(note.userId)) {
        authorGroups.set(note.userId, []);
      }
      authorGroups.get(note.userId)!.push(note);
    });

    // Sort author groups by engagement to prioritize active users
    const sortedAuthorGroups = Array.from(authorGroups.entries())
      .map(([userId, groupNotes]) => ({
        userId,
        notes: groupNotes,
        totalEngagement: groupNotes.reduce((sum, note) =>
          sum + (note.renoteCount || 0) + (note.repliesCount || 0), 0
        )
      }))
      .sort((a, b) => b.totalEngagement - a.totalEngagement);

    // Interleave notes from different authors in round-robin fashion
    const mixed: Note[] = [];
    const authorIterators = sortedAuthorGroups.map(group => ({
      userId: group.userId,
      notes: group.notes,
      index: 0
    }));

    // Round-robin distribution for maximum diversity
    let hasMore = true;
    while (mixed.length < options.limit && hasMore) {
      hasMore = false;

      for (const iterator of authorIterators) {
        if (iterator.index < iterator.notes.length && mixed.length < options.limit) {
          mixed.push(iterator.notes[iterator.index]);
          iterator.index++;
          hasMore = true;
        }
      }
    }

    logger.info(`Diversity mixing: ${mixed.length} posts from ${authorGroups.size} authors`);
    return mixed;
  }

  /**
   * Relevance-focused mixing
   */
  private async applyRelevanceMixing(notes: Note[], _abConfig: any, options: TimelineMixerOptions): Promise<Note[]> {
    // Sort by relevance score (could integrate with ML model)
    return notes
      .map(note => ({
        note,
        relevanceScore: this.calculateRelevanceScore(note, options.userId)
      }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .map(item => item.note);
  }

  /**
   * Serendipity-focused mixing
   */
  private async applySerendipityMixing(notes: Note[], _abConfig: any, options: TimelineMixerOptions): Promise<Note[]> {
    // Mix in unexpected content
    const followingNotes = notes.filter(note => this.isFromFollowing(note, options.userId, options.followingIds));
    const discoveryNotes = notes.filter(note => !this.isFromFollowing(note, options.userId, options.followingIds));

    // Interleave following and discovery content
    const mixed: Note[] = [];
    let followingIndex = 0;
    let discoveryIndex = 0;

    while (mixed.length < options.limit) {
      // Add 2 following notes, then 1 discovery note
      for (let i = 0; i < 2 && followingIndex < followingNotes.length && mixed.length < options.limit; i++) {
        mixed.push(followingNotes[followingIndex++]);
      }

      if (discoveryIndex < discoveryNotes.length && mixed.length < options.limit) {
        mixed.push(discoveryNotes[discoveryIndex++]);
      }

      // Break if no more content
      if (followingIndex >= followingNotes.length && discoveryIndex >= discoveryNotes.length) {
        break;
      }
    }

    return mixed;
  }

  /**
   * Quality-focused mixing
   */
  private async applyQualityMixing(notes: Note[], _abConfig: any, _options: TimelineMixerOptions): Promise<Note[]> {
    // Sort by quality score
    return notes
      .map(note => ({
        note,
        qualityScore: this.calculateQualityScore(note)
      }))
      .sort((a, b) => b.qualityScore - a.qualityScore)
      .map(item => item.note);
  }

  /**
   * Chronological mixing (fallback)
   * CRITICAL FIX: Don't re-sort if notes are already randomized
   * The notes have already been randomized with time-based seeding, so we preserve that order
   */
  private async applyChronologicalMixing(notes: Note[], _options: TimelineMixerOptions): Promise<Note[]> {
    // Notes are already randomized with time-seed, just return them as-is
    // This preserves the mixed order from addTimeBasedRandomization()
    return notes;
  }

  /**
   * Filter out recently seen content and add randomization for freshness
   * Enhanced to ensure minimum content retention and prevent timeline from being emptied
   */
  private filterSeenContent(notes: Note[], seenContent: Set<string>, enableFreshness = true, legacyMode = false): Note[] {
    if (!enableFreshness) {
      // Even without freshness, add some randomization
      return this.shuffleArray([...notes]);
    }

    // Separate seen and unseen content
    const unseenNotes = notes.filter(note => !seenContent.has(note.id));
    const seenNotes = notes.filter(note => seenContent.has(note.id));

    // CRITICAL: Ensure minimum retention - never drop below 40% of original content
    // This prevents refreshing away all posts
    const minimumRetentionRatio = 0.4;
    const minimumPosts = Math.ceil(notes.length * minimumRetentionRatio);

    // Shuffle both arrays for randomization
    const shuffledUnseen = this.shuffleArray([...unseenNotes]);
    const shuffledSeen = this.shuffleArray([...seenNotes]);

    // Calculate target distribution
    // Legacy clients: 60% unseen, 40% seen (more conservative, prevents emptying)
    // New clients: 70% unseen, 30% seen (balanced freshness with retention)
    const unseenRatio = legacyMode ? 0.6 : 0.7;
    let targetUnseen = Math.floor(notes.length * unseenRatio);
    let targetSeen = notes.length - targetUnseen;

    // If we don't have enough unseen content, use more seen content
    if (shuffledUnseen.length < targetUnseen) {
      targetUnseen = shuffledUnseen.length;
      targetSeen = Math.max(minimumPosts - targetUnseen, targetSeen);
    }

    // Ensure we always return at least the minimum number of posts
    const result = [
      ...shuffledUnseen.slice(0, targetUnseen),
      ...shuffledSeen.slice(0, targetSeen)
    ];

    // Safety check: if we still don't have enough, add more seen content
    if (result.length < minimumPosts && seenNotes.length > 0) {
      const needed = minimumPosts - result.length;
      const additionalSeen = shuffledSeen.slice(targetSeen, targetSeen + needed);
      result.push(...additionalSeen);
      logger.info(`Added ${additionalSeen.length} additional seen posts to maintain minimum retention`);
    }

    return result;
  }

  /**
   * Shuffle array for randomization
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Get seen content for user/session
   */
  private getSeenContent(userId: string, sessionId: string, _legacyMode = false): Set<string> {
    const sessionKey = `${userId}_${sessionId}`;

    if (!this.sessionCache.has(sessionKey)) {
      this.sessionCache.set(sessionKey, new Set());
    }

    if (!this.userSeenContent.has(userId)) {
      this.userSeenContent.set(userId, new Set());
    }

    // Combine session and user seen content
    const combined = new Set([
      ...this.sessionCache.get(sessionKey)!,
      ...Array.from(this.userSeenContent.get(userId)!).slice(-100) // Last 100 seen
    ]);

    return combined;
  }

  /**
   * Update seen content tracking
   */
  private updateSeenContent(userId: string, sessionId: string, notes: Note[]): void {
    const sessionKey = `${userId}_${sessionId}`;

    const sessionSeen = this.sessionCache.get(sessionKey) || new Set();
    const userSeen = this.userSeenContent.get(userId) || new Set();

    notes.forEach(note => {
      sessionSeen.add(note.id);
      userSeen.add(note.id);
    });

    this.sessionCache.set(sessionKey, sessionSeen);
    this.userSeenContent.set(userId, userSeen);

    // Limit user seen content to prevent memory bloat
    if (userSeen.size > 1000) {
      const recentSeen = Array.from(userSeen).slice(-500);
      this.userSeenContent.set(userId, new Set(recentSeen));
    }
  }

  /**
   * Calculate freshness score
   */
  private calculateFreshnessScore(mixedNotes: Note[], _allNotes: Note[]): number {
    const avgAge = mixedNotes.reduce((sum, note) => {
      return sum + (Date.now() - note.createdAt.getTime());
    }, 0) / mixedNotes.length;

    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    return Math.max(0, 1 - (avgAge / maxAge));
  }

  /**
   * Calculate diversity score
   */
  private calculateDiversityScore(notes: Note[]): number {
    const uniqueAuthors = new Set(notes.map(note => note.userId)).size;
    const uniqueTopics = new Set(notes.map(note => this.extractTopic(note))).size;

    return (uniqueAuthors + uniqueTopics) / (notes.length * 2);
  }

  /**
   * Get experiment variant for user
   */
  private getExperimentVariant(userAssignment: any): string | undefined {
    const experiments = Object.keys(userAssignment.experiments);
    if (experiments.length > 0) {
      const primaryExperiment = experiments[0];
      return userAssignment.experiments[primaryExperiment].variantId;
    }
    return undefined;
  }

  /**
   * Extract topic from note (simplified)
   */
  private extractTopic(note: Note): string {
    // Simple topic extraction - could be enhanced with NLP
    if (note.text) {
      const hashtags = note.text.match(/#\\w+/g);
      if (hashtags && hashtags.length > 0) {
        return hashtags[0];
      }
    }
    return 'general';
  }

  /**
   * Calculate relevance score (simplified)
   */
  private calculateRelevanceScore(note: Note, _userId: string): number {
    let score = 0;

    // Recency boost (much less aggressive)
    const ageHours = (Date.now() - note.createdAt.getTime()) / (1000 * 60 * 60);
    score += Math.max(0, 1 - (ageHours / 168)); // Decay over 7 days instead of 24 hours

    // Engagement boost
    if (note.renoteCount) score += Math.log(note.renoteCount + 1) * 0.1;
    if (note.repliesCount) score += Math.log(note.repliesCount + 1) * 0.1;

    // Reaction boost - calculate total reactions from reactions object
    if (note.reactions && typeof note.reactions === 'object') {
      const totalReactions = Object.values(note.reactions).reduce((sum, count) => sum + count, 0);
      if (totalReactions > 0) score += Math.log(totalReactions + 1) * 0.1;
    }

    return score;
  }

  /**
   * Calculate quality score (simplified)
   */
  private calculateQualityScore(note: Note): number {
    let score = 0;

    // Text length (not too short, not too long)
    if (note.text) {
      const length = note.text.length;
      if (length > 20 && length < 500) score += 0.3;
    }

    // Has media
    if (note.fileIds && note.fileIds.length > 0) score += 0.2;

    // Engagement ratio - calculate total reactions from reactions object
    let totalReactions = 0;
    if (note.reactions && typeof note.reactions === 'object') {
      totalReactions = Object.values(note.reactions).reduce((sum, count) => sum + count, 0);
    }

    const totalEngagement = (note.renoteCount || 0) + (note.repliesCount || 0) + totalReactions;
    if (totalEngagement > 0) score += Math.min(0.5, totalEngagement * 0.1);

    return score;
  }

  /**
   * Check if note is from following
   */
  private isFromFollowing(note: Note, userId: string, followingIds?: string[]): boolean {
    // If following IDs are provided, use them for accurate checking
    if (followingIds) {
      return followingIds.includes(note.userId);
    }

    // Fallback: assume non-self posts are from following (legacy behavior)
    // This should be replaced with proper following lookup in production
    return note.userId !== userId;
  }

  /**
   * Clean up old session data
   */
  private cleanupSessions(): void {
    // Clean up sessions older than 24 hours
    // This is a simplified cleanup - in production, you'd want more sophisticated session management
    if (this.sessionCache.size > 1000) {
      this.sessionCache.clear();
      logger.info('Cleaned up timeline mixer session cache');
    }
  }

  /**
   * Invalidate cache for user (force fresh content)
   */
  public invalidateUserCache(userId: string): void {
    // Clear user's seen content to force fresh mixing
    this.userSeenContent.delete(userId);

    // Clear all sessions for this user
    for (const [sessionKey] of this.sessionCache) {
      if (sessionKey.startsWith(`${userId}_`)) {
        this.sessionCache.delete(sessionKey);
      }
    }

    logger.info(`Invalidated timeline cache for user ${userId}`);
  }

  /**
   * Force refresh for A/B test participants
   */
  public async refreshExperimentParticipants(experimentId: string): Promise<void> {
    // Get all users in the experiment and invalidate their caches
    const assignments = Array.from(this.userSeenContent.keys());

    for (const userId of assignments) {
      const userAssignment = await abTestingService.getUserAssignment(userId);
      if (userAssignment.experiments[experimentId]) {
        this.invalidateUserCache(userId);
      }
    }

    logger.info(`Refreshed timeline cache for experiment ${experimentId} participants`);
  }
}

// Export singleton instance
export const timelineMixerService = TimelineMixerService.getInstance();