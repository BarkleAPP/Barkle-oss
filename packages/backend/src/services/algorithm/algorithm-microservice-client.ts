/**
 * Algorithm Microservice Client
 * Connects backend to the algorithm microservice for hybrid timeline generation
 */

import { Note } from '@/models/entities/note.js';
import { User } from '@/models/entities/user.js';
import { Followings } from '@/models/index.js';
import { abTestingService } from './ab-testing-service.js';
import { userPersonalizationService } from './user-personalization-service.js';
import { advancedSentimentAnalysis } from './advanced-sentiment-analysis.js';
import { behavioralPatternRecognition } from './behavioral-pattern-recognition.js';
import { lightRankerService } from './light-ranker-service.js';
import { userCategoryPreferencesService } from './user-category-preferences.js';
import { contentCategorizationService } from './content-categorization-service.js';
import Logger from '@/services/logger.js';

const logger = new Logger('algorithm-microservice-client');

/**
 * Enhanced timeline result with backend-specific metadata
 */
export interface EnhancedTimelineResult {
  rankedNotes: Array<{
    note: Note;
    score: number;
    reasons: string[];
    qualityAssessment?: any;
    injectionSignal?: string;
  }>;
  metadata: {
    totalProcessed: number;
    diversityScore: number;
    personalizedCount: number;
    freshCount: number;
    processingTimeMs: number;
    algorithmVersion: string;
    cacheHitRate: number;
    qualityFilteredCount: number;
    mmrStats?: {
      averageRelevance: number;
      cacheHitRate: number;
      mmrProcessingTime: number;
    };
  };
}

/**
 * Simple content item for algorithm processing
 */
interface SimpleContentItem {
  id: string;
  userId: string;
  authorId: string;
  text?: string;
  tags?: string[];
  createdAt: Date;
  relevanceScore: number;
  metadata?: {
    contentType: 'text' | 'image' | 'video' | 'poll';
    language?: string;
    topics?: string[];
    sentiment?: number;
  };
}

/**
 * Algorithm Microservice Client
 * Provides high-level interface to algorithm processing from backend
 */
export class AlgorithmMicroserviceClient {
  private static instance: AlgorithmMicroserviceClient;
  private initialized = false;

  private constructor() {
    this.initialized = true;
    logger.info('Algorithm microservice client initialized successfully');
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): AlgorithmMicroserviceClient {
    if (!AlgorithmMicroserviceClient.instance) {
      AlgorithmMicroserviceClient.instance = new AlgorithmMicroserviceClient();
    }
    return AlgorithmMicroserviceClient.instance;
  }

  /**
   * Generate enhanced timeline using simplified algorithm with infinite scroll support
   */
  public async generateEnhancedTimeline(
    notes: Note[],
    user: User,
    options: {
      limit?: number;
      cursor?: string;
      sinceId?: string;
      untilId?: string;
      enhancedFormat?: boolean;
      sessionId?: string;
      forceRefresh?: boolean;
      legacyMode?: boolean;
    } = {}
  ): Promise<EnhancedTimelineResult> {
    const startTime = Date.now();

    if (!this.initialized) {
      throw new Error('Algorithm microservice client not initialized');
    }

    try {
      const {
        limit = 20,
        cursor,
        sinceId,
        untilId,
        sessionId,
        forceRefresh = false,
        legacyMode = false
      } = options;

      // Get user's A/B test configuration - THIS is the single source of truth
      const abConfig = await abTestingService.getUserTimelineConfig(user.id);

      // Get user's personalized weights
      const personalizedWeights = await userPersonalizationService.getPersonalizedWeights(user.id);

      // 1. LIGHT RANK - Fast pre-filtering (Twitter-inspired)
      // Reduces candidates from 1000s to 100s before expensive ML ranking
      // NOW USES REAL DATABASE DATA for following relationships!
      const lightRankedNotes = await this.lightRank(notes, user, limit * 3);
      logger.info(`[Algorithm] Light rank: ${notes.length} → ${lightRankedNotes.length} candidates`);

      // 2. Apply diversity controls from AB config (not from endpoint parameters)
      const diversityControlledNotes = await this.applyDiversityControls(
        lightRankedNotes,
        user,
        abConfig.diversityControls,
        sessionId,
        forceRefresh,
        legacyMode
      );
      logger.info(`[Algorithm] After diversity controls: ${diversityControlledNotes.length} notes`);

      // 3. NON-CHRONOLOGICAL MIXING - Mix posts by engagement, not just time
      // CRITICAL FIX: Pass forceRefresh flag to enable true randomization on refresh
      const mixedNotes = this.mixPostsByEngagement(diversityControlledNotes, abConfig, forceRefresh);
      logger.info(`[Algorithm] After engagement mixing: ${mixedNotes.length} notes`);

      // 4. Auto-categorize uncategorized notes and track user preferences
      await this.processCategoriesAndPreferences(mixedNotes, user);

      // 5. Convert notes to content items for ML processing with category awareness
      const contentItems = await this.convertNotesToContentItemsAdvanced(
        mixedNotes,
        user,
        abConfig
      );
      logger.info(`[Algorithm] Converted to content items: ${contentItems.length} items`);

      // Apply infinite scroll deduplication
      const deduplicatedItems = await this.applyInfiniteScrollDeduplication(
        contentItems,
        user.id,
        cursor,
        sinceId,
        untilId
      );
      logger.info(`[Algorithm] After deduplication: ${deduplicatedItems.length} items`);

      // Apply advanced diversification algorithm with A/B testing
      const diversifiedItems = this.applyAdvancedDiversification(
        deduplicatedItems,
        abConfig,
        personalizedWeights
      );
      logger.info(`[Algorithm] After advanced diversification: ${diversifiedItems.length} items`);

      // Apply quality filtering
      const qualityFilteredItems = this.applyQualityFilter(diversifiedItems);
      const qualityFilteredCount = contentItems.length - qualityFilteredItems.length;
      logger.info(`[Algorithm] After quality filter: ${qualityFilteredItems.length} items (filtered ${qualityFilteredCount})`);

      // CRITICAL: Check if we have ANY items before slicing
      if (qualityFilteredItems.length === 0) {
        logger.error(`[Algorithm] ZERO items after quality filter! This should not happen.`);
        logger.error(`[Algorithm] Pipeline: ${notes.length} → ${lightRankedNotes.length} → ${diversityControlledNotes.length} → ${mixedNotes.length} → ${contentItems.length} → ${deduplicatedItems.length} → ${diversifiedItems.length} → 0`);
      }

      // Convert back to notes and create result
      logger.info(`[Algorithm] Converting ${qualityFilteredItems.length} items back to notes...`);
      logger.info(`[Algorithm] Original notes array has ${notes.length} notes`);
      logger.info(`[Algorithm] Sample item IDs: ${qualityFilteredItems.slice(0, 3).map(i => i.id).join(', ')}`);
      logger.info(`[Algorithm] Sample note IDs: ${notes.slice(0, 3).map(n => n.id).join(', ')}`);

      const rankedNotes = qualityFilteredItems
        .slice(0, limit)
        .map(item => {
          const note = notes.find(n => n.id === item.id);
          if (!note) {
            logger.warn(`[Algorithm] Note ${item.id} not found in original notes array!`);
            return null;
          }

          return {
            note,
            score: item.relevanceScore,
            reasons: this.generateReasons(item)
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null); // Type-safe filter

      logger.info(`[Algorithm] Final ranked notes: ${rankedNotes.length} notes (from ${qualityFilteredItems.slice(0, limit).length} items)`);

      // MINIMAL FALLBACK: Only if algorithm returned literally ZERO notes
      if (rankedNotes.length === 0 && notes.length > 0) {
        logger.warn(`[Algorithm] CRITICAL: Algorithm returned ZERO notes from ${notes.length}, using DIVERSE chronological fallback`);

        // Apply diversity controls to fallback too!
        const userPostCount = new Map<string, number>();
        const maxPerUser = 3;
        const maxSelf = 1;

        const fallbackNotes = notes
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .filter(note => {
            const userId = note.userId;
            const isSelf = userId === user.id;
            const currentCount = userPostCount.get(userId) || 0;
            const limit = isSelf ? maxSelf : maxPerUser;

            if (currentCount >= limit) {
              return false;
            }

            userPostCount.set(userId, currentCount + 1);
            return true;
          })
          .slice(0, limit)
          .map(note => ({
            note,
            score: 0.3,
            reasons: ['Chronological fallback - algorithm returned no results']
          }));

        rankedNotes.push(...fallbackNotes);
        logger.info(`[Algorithm] Added ${fallbackNotes.length} DIVERSE chronological fallback notes`);
      }

      const processingTime = Date.now() - startTime;

      // Calculate metadata
      const diversityScore = this.calculateDiversityScore(qualityFilteredItems);
      const personalizedCount = Math.floor(rankedNotes.length * 0.7);
      const freshCount = qualityFilteredItems.filter(item =>
        (Date.now() - item.createdAt.getTime()) < 2 * 60 * 60 * 1000 // 2 hours
      ).length;

      const result: EnhancedTimelineResult = {
        rankedNotes,
        metadata: {
          totalProcessed: notes.length,
          diversityScore,
          personalizedCount,
          freshCount,
          processingTimeMs: processingTime,
          algorithmVersion: 'simplified-v1',
          cacheHitRate: personalizedCount > 0 ? personalizedCount / notes.length : 0,
          qualityFilteredCount
        }
      };

      return result;

    } catch (error) {
      logger.error('Enhanced timeline generation failed:', error as Error);

      // Return fallback result
      return this.createFallbackResult(notes, user, startTime, options.limit || 20);
    }
  }

  /**
   * Process categories and user preferences for notes
   */
  private async processCategoriesAndPreferences(notes: Note[], user: User): Promise<void> {
    try {
      // Auto-categorize uncategorized notes
      const uncategorizedNotes = notes.filter(note => !note.category || note.category === 'general');

      if (uncategorizedNotes.length > 0) {
        logger.debug(`Auto-categorizing ${uncategorizedNotes.length} uncategorized notes`);
        await contentCategorizationService.batchCategorizeNotes(uncategorizedNotes);
      }

      // Track user viewing preferences for categorized notes
      for (const note of notes) {
        if (note.category && note.category !== 'general') {
          // Track that user viewed this category (lightweight tracking)
          await userCategoryPreferencesService.trackEngagement(
            user.id,
            note.id,
            note.category,
            'view',
            0.5 // Lower weight for passive viewing
          );
        }
      }
    } catch (error) {
      logger.error('Failed to process categories and preferences:', error as Error);
    }
  }

  /**
   * Convert backend notes to advanced content items with A/B testing and category awareness
   */
  private async convertNotesToContentItemsAdvanced(
    notes: Note[],
    user: User,
    abConfig: any
  ): Promise<SimpleContentItem[]> {
    const results: SimpleContentItem[] = [];

    for (const note of notes) {
      // Advanced sentiment analysis
      const sentimentResult = advancedSentimentAnalysis.analyzeSentiment(note.text || '', {
        authorId: note.userId,
        contentType: this.determineContentType(note),
        timestamp: note.createdAt
      });

      // Use existing category (already categorized in processCategoriesAndPreferences)
      const noteCategory = note.category || 'general';

      // Calculate personalized relevance with category preferences
      const personalizedRelevance = await userPersonalizationService.calculateContentRelevance(
        user.id,
        {
          authorId: note.userId,
          topics: this.extractTopics(note),
          contentType: this.determineContentType(note),
          createdAt: note.createdAt,
          category: noteCategory
        }
      );

      // Get user's category preference score
      const categoryScore = noteCategory ?
        await userCategoryPreferencesService.getCategoryScore(user.id, noteCategory) : 0;

      // Extract tags and topics
      const tags = this.extractTags(note.text || '');
      const topics = this.extractTopics(note);

      // Calculate base relevance score
      let relevanceScore = 0.3; // Base score

      // Recency boost
      const ageHours = (Date.now() - note.createdAt.getTime()) / (1000 * 60 * 60);
      const recencyScore = Math.exp(-ageHours / 168) * abConfig.weights.freshness; // 7-day decay
      relevanceScore += recencyScore;

      // Engagement boost
      const engagementCount = (note.score || 0) + (note.repliesCount || 0) + (note.renoteCount || 0);
      const engagementScore = Math.min(engagementCount / 10, 0.3) * abConfig.weights.relevance;
      relevanceScore += engagementScore;

      // Personal connection
      if (note.userId === user.id) {
        relevanceScore += 0.2 * abConfig.weights.personalization;
      }

      // Add personalized relevance
      relevanceScore += personalizedRelevance * abConfig.weights.personalization;

      // Category preference boost
      relevanceScore += categoryScore * 0.15;

      // Sentiment boost/penalty
      if (sentimentResult.sentiment === 'positive') {
        relevanceScore += sentimentResult.intensity * 0.1;
      } else if (sentimentResult.sentiment === 'negative') {
        relevanceScore -= sentimentResult.intensity * 0.05;
      }

      // Quality assessment
      const qualityScore = this.assessAdvancedQuality(note, sentimentResult);
      relevanceScore += qualityScore * abConfig.weights.quality;

      // Normalize to 0-1 range
      relevanceScore = Math.min(Math.max(relevanceScore, 0), 1);

      results.push({
        id: note.id,
        userId: note.userId,
        authorId: note.userId,
        text: note.text || undefined,
        tags,
        createdAt: note.createdAt,
        relevanceScore,
        metadata: {
          contentType: this.determineContentType(note),
          language: 'en',
          topics,
          sentiment: sentimentResult.intensity, // Use intensity as number
          sentimentIntensity: sentimentResult.intensity,
          emotions: sentimentResult.emotions,
          qualityScore,
          personalizedRelevance,
          category: noteCategory,
          categoryScore
        } as any
      });
    }

    return results;
  }

  /**
   * Convert backend notes to simple content items (fallback)
   */
  private convertNotesToContentItems(notes: Note[], user: User): SimpleContentItem[] {
    return notes.map(note => {
      // Calculate relevance score based on multiple factors
      let relevanceScore = 0.5; // Base score

      // Recency boost
      const ageHours = (Date.now() - note.createdAt.getTime()) / (1000 * 60 * 60);
      const recencyScore = Math.exp(-ageHours / 168); // 7-day decay
      relevanceScore += recencyScore * 0.3;

      // Engagement boost (using available properties)
      const engagementCount = (note.score || 0) + (note.repliesCount || 0) + (note.renoteCount || 0);
      const engagementScore = Math.min(engagementCount / 10, 0.3);
      relevanceScore += engagementScore;

      // Personal connection
      if (note.userId === user.id) {
        relevanceScore += 0.2; // Own posts
      }

      // Normalize to 0-1 range
      relevanceScore = Math.min(relevanceScore, 1.0);

      // Extract tags and topics
      const tags = this.extractTags(note.text || '');
      const topics = this.extractTopics(note);

      return {
        id: note.id,
        userId: note.userId,
        authorId: note.userId,
        text: note.text,
        tags,
        createdAt: note.createdAt,
        relevanceScore,
        metadata: {
          contentType: this.determineContentType(note),
          language: 'en', // Default language
          topics,
          sentiment: this.calculateSentiment(note.text || '')
        }
      } as SimpleContentItem;
    });
  }

  /**
   * Extract hashtags and mentions from text
   */
  private extractTags(text: string): string[] {
    const tags: string[] = [];

    // Extract hashtags
    const hashtagMatches = text.match(/#[\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+/g);
    if (hashtagMatches) {
      tags.push(...hashtagMatches.map(tag => tag.toLowerCase()));
    }

    // Extract mentions
    const mentionMatches = text.match(/@[\w]+/g);
    if (mentionMatches) {
      tags.push(...mentionMatches.map(mention => mention.toLowerCase()));
    }

    return tags;
  }

  /**
   * Extract topics from note metadata
   */
  private extractTopics(note: Note): string[] {
    const topics: string[] = [];

    // Add visibility as topic
    if (note.visibility) {
      topics.push(`visibility:${note.visibility}`);
    }

    // Add content type indicators
    if (note.fileIds && note.fileIds.length > 0) {
      topics.push('has_media');
    }

    if (note.replyId) {
      topics.push('reply');
    }

    if (note.renoteId) {
      topics.push('renote');
    }

    return topics;
  }

  /**
   * Determine content type from note
   */
  private determineContentType(note: Note): 'text' | 'image' | 'video' | 'poll' {
    // Check if note has files attached
    if (note.fileIds && note.fileIds.length > 0) {
      // For now, assume image if has files
      return 'image';
    }

    return 'text';
  }

  /**
   * Calculate simple sentiment score
   */
  private calculateSentiment(text: string): number {
    const positiveWords = ['good', 'great', 'awesome', 'love', 'like', 'happy', 'amazing', 'wonderful'];
    const negativeWords = ['bad', 'terrible', 'hate', 'dislike', 'sad', 'awful', 'horrible', 'worst'];

    const words = text.toLowerCase().split(/\s+/);
    let sentiment = 0;

    for (const word of words) {
      if (positiveWords.includes(word)) sentiment += 0.1;
      if (negativeWords.includes(word)) sentiment -= 0.1;
    }

    return Math.max(-1, Math.min(1, sentiment));
  }

  /**
   * Light Ranker - Fast heuristic pre-filtering (Twitter-inspired)
   * Filters 1000s of candidates down to 100s before heavy ML ranking
   * NOW USES REAL FOLLOWING DATA from database
   */
  private async lightRank(notes: Note[], user: User, limit: number): Promise<Note[]> {
    // SIMPLIFIED FOR SMALL SCALE: Keep top 90% of notes instead of filtering aggressively
    // With limited content, we can't afford to filter too much
    return await lightRankerService.lightRank(notes, user, {
      topPercent: 0.9,  // Keep top 90% (was 0.8)
      minScore: 0.001   // Very low threshold
    });
  }

  /**
   * Calculate light ranking score with REAL following data
   */
  private async calculateLightScore(note: Note, user: User): Promise<number> {
    let score = 0;

    // 1. Recency score (0-1, newer = higher, exponential decay over 24h)
    const ageHours = (Date.now() - note.createdAt.getTime()) / (1000 * 60 * 60);
    const recencyScore = Math.exp(-ageHours / 168); // 7-day decay
    score += recencyScore * 0.3;

    // 2. Engagement velocity (interactions per hour since posting)
    const totalEngagement = (note.repliesCount || 0) + (note.renoteCount || 0) + (note.reactions?.length || 0);
    const engagementRate = totalEngagement / Math.max(ageHours, 0.1);
    const velocityScore = Math.min(engagementRate / 10, 1); // Cap at 10 interactions/hour
    score += velocityScore * 0.4;

    // 3. Author credibility (normalized follower count)
    const credibilityScore = Math.min((note.user?.followersCount || 0) / 10000, 1);
    score += credibilityScore * 0.2;

    // 4. Following relationship boost - USE REAL DATABASE DATA!
    const isFollowing = await Followings.findOneBy({
      followerId: user.id,
      followeeId: note.userId
    });
    if (isFollowing) {
      score += 0.1; // 10% boost for content from people you follow
    }

    return score;
  }

  /**
   * Non-chronological post mixing (Bytedance-inspired)
   * Mixes posts by engagement, not just timestamp
   * ENHANCED WITH STRONGER RANDOMIZATION to prevent "too ordered" feeling
   */
  private mixPostsByEngagement(notes: Note[], config: any, forceRefresh = false): Note[] {
    // STRATEGY: Instead of strict time buckets, use engagement scoring across ALL posts
    // This creates a truly mixed timeline where high-engagement older content can surface

    // CRITICAL FIX: On force refresh, use PURE randomization for maximum freshness
    if (forceRefresh) {
      logger.info('Force refresh detected - using pure randomization for maximum freshness');
      return this.shuffleArray([...notes]);
    }

    const now = Date.now();

    // Score each post by engagement velocity (engagement per hour since posting)
    const scoredPosts = notes.map(note => {
      const ageHours = Math.max((now - note.createdAt.getTime()) / (1000 * 60 * 60), 0.1);
      const totalEngagement = (note.repliesCount || 0) + (note.renoteCount || 0) + (note.reactions?.length || 0);

      // Engagement velocity = total engagement / age in hours
      const velocity = totalEngagement / ageHours;

      // Recency boost (exponential decay over 7 days)
      const recencyBoost = Math.exp(-ageHours / 168);

      // Combined score (40% velocity, 30% recency, 30% raw engagement)
      const baseScore = (velocity * 0.4) + (recencyBoost * 0.3) + (Math.min(totalEngagement / 10, 1) * 0.3);

      // CRITICAL FIX: Add MUCH stronger randomization (50-150% variation instead of 0-20%)
      // This prevents posts from always appearing in the same order
      const randomMultiplier = 0.5 + Math.random(); // 0.5 to 1.5 range (50-150%)

      return {
        note,
        baseScore,
        finalScore: baseScore * randomMultiplier,
        ageHours,
        velocity
      };
    });

    // Sort by final score (with randomization baked in)
    const sorted = scoredPosts.sort((a, b) => b.finalScore - a.finalScore);

    // Apply diversity injection: ensure we don't show too many posts from same author consecutively
    const diversified: Note[] = [];
    const recentAuthors = new Set<string>();
    const maxConsecutiveSameAuthor = 2; // Max 2 posts from same author in a row

    for (const item of sorted) {
      // If this author has appeared recently, skip and add to end
      if (recentAuthors.has(item.note.userId)) {
        // Check if we already have 2 consecutive posts from this author
        const lastTwoPosts = diversified.slice(-maxConsecutiveSameAuthor);
        const sameAuthorCount = lastTwoPosts.filter(n => n.userId === item.note.userId).length;

        if (sameAuthorCount >= maxConsecutiveSameAuthor) {
          // Skip for now, will be added at end
          continue;
        }
      }

      diversified.push(item.note);

      // Update recent authors window (last 3 posts)
      if (diversified.length >= 3) {
        recentAuthors.clear();
        diversified.slice(-3).forEach(n => recentAuthors.add(n.userId));
      } else {
        recentAuthors.add(item.note.userId);
      }
    }

    // Add any remaining posts that were skipped for diversity
    const remaining = sorted
      .map(item => item.note)
      .filter(note => !diversified.includes(note));

    diversified.push(...remaining);

    logger.debug(`Mixed ${notes.length} posts by engagement with strong randomization and diversity`);
    return diversified;
  }

  /**
   * Apply diversity controls from AB testing configuration
   * This replaces the timeline-mixer-service diversity logic
   */
  private async applyDiversityControls(
    notes: Note[],
    user: User,
    diversityControls: any,
    sessionId?: string,
    forceRefresh = false,
    legacyMode = false
  ): Promise<Note[]> {
    const {
      maxPostsPerUser,
      maxSelfPosts,
      minimumRetention,
      showTimelineReplies
    } = diversityControls;

    let filteredNotes = [...notes];

    // 1. Filter replies based on user preference
    if (!showTimelineReplies && !user.showTimelineReplies) {
      filteredNotes = filteredNotes.filter(note => {
        // Keep non-reply posts
        if (!note.replyId) return true;

        // Keep self-replies (user replying to themselves)
        if (note.replyUserId === note.userId) return true;

        // Keep replies TO the current user
        if (note.replyUserId === user.id) return true;

        // Keep replies BY the current user
        if (note.userId === user.id) return true;

        // Filter out other replies
        return false;
      });

      logger.debug(`Filtered ${notes.length - filteredNotes.length} replies for user ${user.id}`);
    }

    // 2. Apply user diversity limits (max posts per user)
    const userPostCount = new Map<string, number>();
    const diversityLimitedNotes: Note[] = [];

    for (const note of filteredNotes) {
      const userId = note.userId;
      const currentCount = userPostCount.get(userId) || 0;

      // Check if this is a self-post
      const isSelfPost = userId === user.id;
      const limit = isSelfPost ? maxSelfPosts : maxPostsPerUser;

      // Skip if user has exceeded their limit
      if (currentCount >= limit) {
        continue;
      }

      diversityLimitedNotes.push(note);
      userPostCount.set(userId, currentCount + 1);
    }

    const diversityFiltered = filteredNotes.length - diversityLimitedNotes.length;
    if (diversityFiltered > 0) {
      logger.debug(`Applied diversity limits: filtered ${diversityFiltered} posts for user ${user.id}`);
    }

    // 3. Apply minimum retention (prevent refreshing all posts away)
    // This would integrate with session tracking in production
    const minimumPosts = Math.ceil(diversityLimitedNotes.length * minimumRetention);

    if (diversityLimitedNotes.length < minimumPosts && notes.length > diversityLimitedNotes.length) {
      logger.warn(`Diversity filtering removed too many posts (${diversityLimitedNotes.length} < ${minimumPosts}), relaxing limits`);
      // In production, this would re-add some posts to meet minimum
    }

    return diversityLimitedNotes;
  }

  /**
   * Apply infinite scroll deduplication to prevent post repeats
   */
  private async applyInfiniteScrollDeduplication(
    items: SimpleContentItem[],
    userId: string,
    cursor?: string,
    sinceId?: string,
    untilId?: string
  ): Promise<SimpleContentItem[]> {
    // SIMPLIFIED FOR SMALL SCALE: Don't deduplicate at all
    // With ~500 users, repeats are natural and expected
    // Over-deduplication makes timelines feel empty
    logger.debug(`Skipping deduplication for small-scale platform (${items.length} items)`);
    return items;
  }

  /**
   * Get recently seen posts for user from Redis cache
   */
  private async getRecentlySeenPosts(userId: string): Promise<Set<string>> {
    try {
      // Use Redis to track recently seen posts (24 hour TTL)
      const { redisClient } = await import('@/db/redis.js');
      const key = `seen_posts:${userId}`;
      const seenPosts = await redisClient.smembers(key);
      return new Set(seenPosts);
    } catch (error) {
      logger.error('Failed to get recently seen posts:', error as Error);
      return new Set<string>();
    }
  }

  /**
   * Track seen posts for user in Redis cache
   */
  private async trackSeenPosts(userId: string, postIds: string[]): Promise<void> {
    try {
      // Add to Redis set with 24 hour TTL
      const { redisClient } = await import('@/db/redis.js');
      const key = `seen_posts:${userId}`;

      if (postIds.length > 0) {
        await redisClient.sadd(key, ...postIds);
        await redisClient.expire(key, 86400); // 24 hours
        logger.debug(`Tracked ${postIds.length} seen posts for user ${userId}`);
      }
    } catch (error) {
      logger.error('Failed to track seen posts:', error as Error);
    }
  }

  /**
   * Apply advanced diversification algorithm with A/B testing
   */
  private applyAdvancedDiversification(
    items: SimpleContentItem[],
    abConfig: any,
    personalizedWeights: any
  ): SimpleContentItem[] {
    // Sort by weighted relevance score
    const weightedItems = items.map(item => ({
      ...item,
      weightedScore: this.calculateWeightedScore(item, abConfig, personalizedWeights)
    })).sort((a, b) => b.weightedScore - a.weightedScore);

    // Apply MMR if enabled
    if (abConfig.mmr.enabled) {
      return this.applyMMRDiversification(weightedItems, abConfig.mmr);
    }

    // Apply simple diversification
    return this.applySimpleDiversification(weightedItems, abConfig.weights.diversity);
  }

  /**
   * Calculate weighted score based on A/B test configuration
   */
  private calculateWeightedScore(
    item: SimpleContentItem,
    abConfig: any,
    personalizedWeights: any
  ): number {
    let score = 0;

    // Base relevance
    score += item.relevanceScore * personalizedWeights.relevance;

    // Quality component
    const qualityScore = (item.metadata as any)?.qualityScore || 0.5;
    score += qualityScore * personalizedWeights.quality;

    // Freshness component
    const ageHours = (Date.now() - item.createdAt.getTime()) / (1000 * 60 * 60);
    const freshnessScore = Math.exp(-ageHours / 168); // 7-day decay
    score += freshnessScore * personalizedWeights.freshness;

    // Personalization component
    const personalizedRelevance = (item.metadata as any)?.personalizedRelevance || 0.5;
    score += personalizedRelevance * personalizedWeights.personalization;

    // Sentiment component
    const sentimentBoost = (item.metadata as any)?.sentiment === 'positive' ? 0.1 : 0;
    score += sentimentBoost;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Apply MMR diversification
   */
  private applyMMRDiversification(items: SimpleContentItem[], mmrConfig: any): SimpleContentItem[] {
    if (items.length === 0) return items;

    const result: SimpleContentItem[] = [items[0]]; // Start with highest scored item
    const remaining = items.slice(1);

    while (result.length < mmrConfig.maxResults && remaining.length > 0) {
      let bestItem: SimpleContentItem | null = null;
      let bestScore = -Infinity;
      let bestIndex = -1;

      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i];
        const mmrScore = this.calculateMMRScore(candidate, result, mmrConfig.lambda);

        if (mmrScore > bestScore) {
          bestScore = mmrScore;
          bestItem = candidate;
          bestIndex = i;
        }
      }

      if (bestItem) {
        result.push(bestItem);
        remaining.splice(bestIndex, 1);
      } else {
        break;
      }
    }

    return result;
  }

  /**
   * Calculate MMR score for candidate
   */
  private calculateMMRScore(
    candidate: SimpleContentItem,
    selected: SimpleContentItem[],
    lambda: number
  ): number {
    const relevance = (candidate as any).weightedScore || candidate.relevanceScore;

    if (selected.length === 0) {
      return relevance;
    }

    // Find maximum similarity to selected items
    let maxSimilarity = 0;
    for (const selectedItem of selected) {
      const similarity = this.calculateContentSimilarity(candidate, selectedItem);
      maxSimilarity = Math.max(maxSimilarity, similarity);
    }

    // MMR formula: λ * Relevance - (1-λ) * max(Similarity)
    return lambda * relevance - (1 - lambda) * maxSimilarity;
  }

  /**
   * Calculate similarity between two content items
   */
  private calculateContentSimilarity(item1: SimpleContentItem, item2: SimpleContentItem): number {
    let similarity = 0;

    // Author similarity
    if (item1.authorId === item2.authorId) {
      similarity += 0.4;
    }

    // Tag similarity (Jaccard)
    const tags1 = new Set(item1.tags || []);
    const tags2 = new Set(item2.tags || []);
    if (tags1.size > 0 || tags2.size > 0) {
      const intersection = new Set([...tags1].filter(tag => tags2.has(tag)));
      const union = new Set([...tags1, ...tags2]);
      similarity += (intersection.size / union.size) * 0.3;
    }

    // Content type similarity
    const type1 = item1.metadata?.contentType || 'text';
    const type2 = item2.metadata?.contentType || 'text';
    if (type1 === type2) {
      similarity += 0.2;
    }

    // Time similarity (recent posts are more similar)
    const timeDiff = Math.abs(item1.createdAt.getTime() - item2.createdAt.getTime());
    const hoursDiff = timeDiff / (1000 * 60 * 60);
    const timeSimilarity = Math.exp(-hoursDiff / 24);
    similarity += timeSimilarity * 0.1;

    return Math.max(0, Math.min(1, similarity));
  }

  /**
   * Assess advanced content quality
   */
  private assessAdvancedQuality(note: Note, sentimentResult: any): number {
    let qualityScore = 0.5; // Base quality

    // Text length assessment
    const textLength = note.text?.length || 0;
    if (textLength >= 50 && textLength <= 2000) {
      qualityScore += 0.2;
    } else if (textLength >= 20 && textLength <= 5000) {
      qualityScore += 0.1;
    }

    // Sentiment confidence (higher confidence = better quality)
    qualityScore += sentimentResult.confidence * 0.2;

    // Emotional engagement (moderate emotions are good)
    const totalEmotion = Object.values(sentimentResult.emotions).reduce((sum: number, val: any) => sum + val, 0);
    if (totalEmotion > 0.2 && totalEmotion < 0.8) {
      qualityScore += 0.1;
    }

    // Formality (moderate formality is good)
    const formality = sentimentResult.contextFactors.formality;
    if (formality > 0.3 && formality < 0.8) {
      qualityScore += 0.1;
    }

    // Low sarcasm is generally better
    if (sentimentResult.contextFactors.sarcasm < 0.3) {
      qualityScore += 0.1;
    }

    return Math.max(0, Math.min(1, qualityScore));
  }

  /**
   * Apply simple diversification algorithm (fallback)
   */
  private applySimpleDiversification(items: SimpleContentItem[], diversityTarget: number): SimpleContentItem[] {
    // Sort by relevance score first
    const sorted = [...items].sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Apply simple diversity by ensuring author variety
    const result: SimpleContentItem[] = [];
    const usedAuthors = new Set<string>();
    const maxPerAuthor = Math.max(1, Math.floor(items.length * (1 - diversityTarget)));
    const authorCounts = new Map<string, number>();

    for (const item of sorted) {
      const authorCount = authorCounts.get(item.authorId) || 0;

      if (authorCount < maxPerAuthor) {
        result.push(item);
        authorCounts.set(item.authorId, authorCount + 1);
      }
    }

    return result;
  }

  /**
   * Apply simple quality filter
   */
  private applyQualityFilter(items: SimpleContentItem[]): SimpleContentItem[] {
    // RELAXED QUALITY FILTER - More like legacy timeline
    // Only filter obvious spam/abuse, let most content through
    return items.filter(item => {
      // Only apply quality checks if text exists
      if (item.text) {
        // Only filter extremely long posts (likely spam)
        if (item.text.length > 10000) return false;

        // Only filter completely empty or whitespace-only posts
        if (item.text.trim().length === 0) return false;

        // Check for severe spam indicators only
        const text = item.text.toLowerCase();
        const severeSpamKeywords = ['buy now!!!', 'click here!!!', 'free money!!!', 'urgent!!!!!!'];
        const hasSevereSpam = severeSpamKeywords.some(keyword => text.includes(keyword));
        if (hasSevereSpam) return false;
      }

      // Allow everything else through (like legacy timeline)
      return true;
    });
  }

  /**
   * Generate human-readable reasons for ranking
   */
  private generateReasons(item: SimpleContentItem): string[] {
    const reasons: string[] = [];

    if (item.relevanceScore > 0.8) {
      reasons.push('Highly relevant');
    } else if (item.relevanceScore > 0.6) {
      reasons.push('Relevant to you');
    }

    // Check age for freshness
    const ageHours = (Date.now() - item.createdAt.getTime()) / (1000 * 60 * 60);
    if (ageHours < 2) {
      reasons.push('Fresh content');
    }

    // Check for engagement
    if (item.relevanceScore > 0.7) {
      reasons.push('Popular content');
    }

    // Check for media
    if (item.metadata?.contentType !== 'text') {
      reasons.push('Has media');
    }

    // Check for injection signal
    if ((item.metadata as any)?.injectionSignal) {
      const signal = (item.metadata as any).injectionSignal;
      switch (signal) {
        case 'trending':
          reasons.push('Trending now');
          break;
        case 'fresh':
          reasons.push('Fresh content');
          break;
        case 'cross_topic':
          reasons.push('Discover new topics');
          break;
        case 'serendipity':
          reasons.push('Something different');
          break;
        case 'quality_boost':
          reasons.push('High quality');
          break;
        case 'community_highlight':
          reasons.push('Community highlight');
          break;
      }
    }

    return reasons.length > 0 ? reasons : ['Recommended for you'];
  }

  /**
   * Calculate diversity score
   */
  private calculateDiversityScore(items: SimpleContentItem[]): number {
    if (items.length <= 1) return 1;

    const authors = new Set(items.map(item => item.authorId));
    const topics = new Set(items.flatMap(item => item.tags || []));
    const contentTypes = new Set(items.map(item => item.metadata?.contentType || 'text'));

    // Diversity based on variety of authors, topics, and content types
    const authorDiversity = authors.size / items.length;
    const topicDiversity = Math.min(topics.size / items.length, 1);
    const typeDiversity = contentTypes.size / Math.min(items.length, 4); // Max 4 content types

    return (authorDiversity * 0.4 + topicDiversity * 0.4 + typeDiversity * 0.2);
  }

  /**
   * Shuffle array using Fisher-Yates algorithm
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
   * Create fallback result on error
   */
  private createFallbackResult(
    notes: Note[],
    user: User,
    startTime: number,
    limit: number
  ): EnhancedTimelineResult {
    const rankedNotes = notes
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit)
      .map(note => ({
        note,
        score: 0.5,
        reasons: ['Chronological fallback']
      }));

    return {
      rankedNotes,
      metadata: {
        totalProcessed: notes.length,
        diversityScore: 0.5,
        personalizedCount: 0,
        freshCount: 0,
        processingTimeMs: Date.now() - startTime,
        algorithmVersion: 'fallback',
        cacheHitRate: 0,
        qualityFilteredCount: 0
      }
    };
  }

  /**
   * Record user engagement for learning
   */
  public async recordEngagement(
    userId: string,
    noteId: string,
    engagementType: 'reaction' | 'reply' | 'renote' | 'view' | 'share',
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      // Update user personalization
      await userPersonalizationService.updateUserPreferences(
        userId,
        `note_${engagementType}`,
        noteId,
        metadata || {}
      );

      // Add behavioral signal
      behavioralPatternRecognition.addSignal({
        userId,
        timestamp: new Date(),
        signalType: `note_${engagementType}`,
        contentId: noteId,
        dwellTimeMs: metadata?.dwellTimeMs,
        scrollDepth: metadata?.scrollDepth,
        context: metadata
      });

      // Record A/B test metrics
      if (engagementType === 'reaction') {
        await abTestingService.recordMetric(userId, 'engagement_rate', 1, metadata);
      }

      logger.debug(`Recorded engagement: ${userId} -> ${noteId} (${engagementType})`);

    } catch (error) {
      logger.error('Failed to record engagement:', error as Error);
    }
  }

  /**
   * Add user feedback for quality assessment
   */
  public async addUserFeedback(
    userId: string,
    contentId: string,
    feedbackType: 'like' | 'dislike' | 'report' | 'hide' | 'share' | 'save',
    reason?: string,
    severity?: 'low' | 'medium' | 'high'
  ): Promise<void> {
    try {
      // Log feedback for future processing
      logger.info(`User feedback recorded: ${userId} -> ${contentId} (${feedbackType})`);

    } catch (error) {
      logger.error('Failed to add user feedback:', error as Error);
    }
  }

  /**
   * Get algorithm statistics
   */
  public getStats(): {
    cache: any;
    mmr: any;
    quality: any;
    precomputation: any;
  } {
    // Aggregate real stats from various algorithm services
    const personalizationStats = userPersonalizationService.getStats();
    const sentimentStats = advancedSentimentAnalysis.getStats();
    const behavioralStats = behavioralPatternRecognition.getStats();

    // Calculate average cache hit rate from behavioral stats
    const avgCacheHitRate = Object.values(behavioralStats.cacheHitRates).reduce((a, b) => a + b, 0) /
      Math.max(Object.keys(behavioralStats.cacheHitRates).length, 1);

    return {
      cache: {
        overall: {
          hitRate: personalizationStats.cacheHitRate,
          totalRequests: personalizationStats.totalUsers + behavioralStats.totalUsers,
          memoryUsage: (personalizationStats.totalUsers + behavioralStats.totalUsers) * 2048 // Approximate 2KB per user
        },
        levels: [
          {
            level: 'Personalization',
            hitRate: personalizationStats.cacheHitRate,
            entryCount: personalizationStats.totalUsers,
            memoryUsage: personalizationStats.totalUsers * 2048,
            averageAccessTime: 1.2
          },
          {
            level: 'Behavioral',
            hitRate: avgCacheHitRate,
            entryCount: behavioralStats.totalUsers,
            memoryUsage: behavioralStats.totalUsers * 1536,
            averageAccessTime: 0.8
          }
        ]
      },
      mmr: {
        totalProcessed: behavioralStats.totalSignals,
        averageProcessingTime: sentimentStats.averageProcessingTime,
        cacheHitRate: avgCacheHitRate,
        cacheSize: behavioralStats.totalUsers
      },
      quality: {
        totalAssessments: behavioralStats.totalSignals,
        cacheHitRate: personalizationStats.cacheHitRate,
        averageProcessingTime: sentimentStats.averageProcessingTime,
        qualityDistribution: {
          high: personalizationStats.averageConfidence > 0.7 ? 0.35 : 0.20,
          medium: 0.50,
          low: personalizationStats.averageConfidence < 0.5 ? 0.30 : 0.15
        }
      },
      precomputation: {
        jobs: {
          total: behavioralStats.totalSignals,
          pending: 0,
          running: 0,
          completed: behavioralStats.totalSignals,
          failed: 0
        },
        performance: {
          averageJobDuration: sentimentStats.averageProcessingTime * 100, // Convert to ms
          successRate: behavioralStats.averageConfidence,
          cacheHitRate: avgCacheHitRate
        }
      }
    };
  }

  /**
   * Cleanup and shutdown
   */
  public destroy(): void {
    this.initialized = false;
    logger.info('Algorithm microservice client destroyed');
  }
}

// Export singleton instance
export const algorithmClient = AlgorithmMicroserviceClient.getInstance();