/**
 * Enhanced Trending Service
 * Twitter-like trending system that tracks hashtags, topics, users, and content
 * Integrates with algorithm microservice for advanced trending detection
 */

import { Notes, Users, Hashtags } from '@/models/index.js';
import { Note } from '@/models/entities/note.js';
import { User } from '@/models/entities/user.js';
import { AlgorithmMicroserviceClient } from './algorithm/algorithm-microservice-client.js';
import { SocialProofService } from './social-proof-service.js';
import { ActiveUsersService } from './active-users-service.js';
import { fetchMeta } from '@/misc/fetch-meta.js';
import { normalizeForSearch } from '@/misc/normalize-for-search.js';
import { Brackets } from 'typeorm';
import Logger from '@/services/logger.js';

const logger = new Logger('enhanced-trending-service');

export interface TrendingItem {
  id: string;
  type: 'hashtag' | 'topic' | 'user' | 'content';
  name: string;
  displayName: string;
  description?: string;
  trendingScore: number;
  engagementVelocity: number;
  viralityScore: number;
  volume: number;
  volumeChange: number; // Percentage change from previous period
  chart: number[]; // Historical data points
  metadata: {
    category?: string;
    relatedTags?: string[];
    topContributors?: string[];
    peakTime?: Date;
    isRising?: boolean;
    isHot?: boolean;
    sentiment?: 'positive' | 'negative' | 'neutral';
  };
}

export interface TrendingResponse {
  items: TrendingItem[];
  metadata: {
    generatedAt: Date;
    timeframe: string;
    totalVolume: number;
    algorithmVersion: string;
    location?: string;
  };
}

export class EnhancedTrendingService {
  private static instance: EnhancedTrendingService;
  private algorithmClient: AlgorithmMicroserviceClient;
  private cache = new Map<string, { data: any; expires: number }>();

  private constructor() {
    this.algorithmClient = AlgorithmMicroserviceClient.getInstance();
  }

  public static getInstance(): EnhancedTrendingService {
    if (!EnhancedTrendingService.instance) {
      EnhancedTrendingService.instance = new EnhancedTrendingService();
    }
    return EnhancedTrendingService.instance;
  }

  /**
   * Get comprehensive trending data (Twitter-like)
   */
  public async getTrendingData(options: {
    timeframe?: '1h' | '6h' | '24h' | '7d';
    location?: string;
    limit?: number;
    includeTypes?: ('hashtag' | 'topic' | 'user' | 'content')[];
  } = {}): Promise<TrendingResponse> {
    const {
      timeframe = '24h',
      location,
      limit = 20,
      includeTypes = ['hashtag', 'topic', 'content']
    } = options;

    const cacheKey = `trending:${timeframe}:${location || 'global'}:${includeTypes.join(',')}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    logger.info(`Generating trending data for ${timeframe} timeframe`);

    const results: TrendingItem[] = [];

    // Get trending hashtags
    if (includeTypes.includes('hashtag')) {
      const trendingHashtags = await this.getTrendingHashtags(timeframe, Math.ceil(limit * 0.4));
      results.push(...trendingHashtags);
    }

    // Get trending topics (extracted from content)
    if (includeTypes.includes('topic')) {
      const trendingTopics = await this.getTrendingTopics(timeframe, Math.ceil(limit * 0.3));
      results.push(...trendingTopics);
    }

    // Get trending content
    if (includeTypes.includes('content')) {
      const trendingContent = await this.getTrendingContent(timeframe, Math.ceil(limit * 0.3));
      results.push(...trendingContent);
    }

    // Sort by trending score and limit results
    const sortedResults = results
      .sort((a, b) => b.trendingScore - a.trendingScore)
      .slice(0, limit);

    const response: TrendingResponse = {
      items: sortedResults,
      metadata: {
        generatedAt: new Date(),
        timeframe,
        totalVolume: sortedResults.reduce((sum, item) => sum + item.volume, 0),
        algorithmVersion: '2.0',
        location
      }
    };

    // Cache for 5 minutes
    this.setCache(cacheKey, response, 5 * 60 * 1000);

    return response;
  }

  /**
   * Get trending hashtags with enhanced metrics
   */
  private async getTrendingHashtags(timeframe: string, limit: number): Promise<TrendingItem[]> {
    const timeMs = this.getTimeframeMs(timeframe);
    const now = new Date();
    const cutoff = new Date(now.getTime() - timeMs);

    const instance = await fetchMeta(true);
    const hiddenTags = instance.hiddenTags.map(t => normalizeForSearch(t));

    // Get hashtag usage data with category information
    const tagNotes = await Notes.createQueryBuilder('note')
      .where('note.createdAt > :cutoff', { cutoff })
      .andWhere(new Brackets(qb => {
        qb.where('note.visibility = :public', { public: 'public' })
          .orWhere('note.visibility = :home', { home: 'home' });
      }))
      .andWhere('note.tags != :empty', { empty: '{}' })
      .select(['note.tags', 'note.userId', 'note.createdAt', 'note.score', 'note.category'])
      .getMany();

    console.log(`Enhanced trending: Found ${tagNotes.length} notes with tags in timeframe ${timeframe}`);

    // Process hashtags with category information
    const tagStats = new Map<string, {
      users: Set<string>;
      posts: number;
      engagement: number;
      timeline: number[];
      categories: Map<string, number>; // Track which categories use this hashtag
    }>();

    for (const note of tagNotes) {
      for (const tag of note.tags) {
        if (hiddenTags.includes(tag)) continue;

        if (!tagStats.has(tag)) {
          tagStats.set(tag, {
            users: new Set(),
            posts: 0,
            engagement: 0,
            timeline: new Array(24).fill(0),
            categories: new Map()
          });
        }

        const stats = tagStats.get(tag)!;
        stats.users.add(note.userId);
        stats.posts++;
        stats.engagement += (note.score || 0);

        // Track category usage for this hashtag
        if (note.category) {
          const categoryCount = stats.categories.get(note.category) || 0;
          stats.categories.set(note.category, categoryCount + 1);
        }

        // Add to timeline (hourly buckets)
        const hourIndex = Math.floor((now.getTime() - note.createdAt.getTime()) / (1000 * 60 * 60));
        if (hourIndex < 24) {
          stats.timeline[23 - hourIndex]++;
        }
      }
    }

    // Convert to trending items
    const trendingHashtags: TrendingItem[] = [];

    console.log(`Enhanced trending: Processed ${tagStats.size} unique hashtags`);

    for (const [tag, stats] of tagStats.entries()) {
      const volume = stats.users.size;
      if (volume < 1) continue; // Lower minimum threshold - just need 1 user

      const engagementVelocity = stats.engagement / Math.max(1, timeMs / (1000 * 60 * 60));
      const viralityScore = stats.users.size / Math.max(1, stats.posts) * 100;

      // Calculate volume change (compare with previous period)
      const previousPeriodVolume = await this.getPreviousPeriodVolume(tag, timeframe);
      const volumeChange = previousPeriodVolume > 0
        ? ((volume - previousPeriodVolume) / previousPeriodVolume) * 100
        : 100;

      const trendingScore = await this.calculateTrendingScore({
        volume,
        engagementVelocity,
        viralityScore,
        volumeChange,
        recency: Math.exp(-Math.max(0, timeMs / (1000 * 60 * 60) - 1) / 12) // Decay over 12 hours
      });

      // Determine the most common category for this hashtag
      let primaryCategory = this.categorizeHashtag(tag); // Fallback to keyword-based categorization
      if (stats.categories.size > 0) {
        // Use the most frequently used category from actual notes
        let maxCount = 0;
        for (const [category, count] of stats.categories.entries()) {
          if (count > maxCount) {
            maxCount = count;
            primaryCategory = category;
          }
        }
      }

      trendingHashtags.push({
        id: `hashtag:${tag}`,
        type: 'hashtag',
        name: tag,
        displayName: `#${tag}`,
        trendingScore,
        engagementVelocity,
        viralityScore,
        volume,
        volumeChange,
        chart: stats.timeline,
        metadata: {
          category: primaryCategory,
          isRising: volumeChange > 50,
          isHot: engagementVelocity > 10,
          sentiment: 'neutral' // TODO: Implement sentiment analysis
        }
      });
    }

    return trendingHashtags
      .sort((a, b) => b.trendingScore - a.trendingScore)
      .slice(0, limit);
  }

  /**
   * Get trending topics (extracted from content analysis)
   */
  private async getTrendingTopics(timeframe: string, limit: number): Promise<TrendingItem[]> {
    const timeMs = this.getTimeframeMs(timeframe);
    const cutoff = new Date(Date.now() - timeMs);

    // Get recent notes for topic extraction
    const recentNotes = await Notes.createQueryBuilder('note')
      .where('note.createdAt > :cutoff', { cutoff })
      .andWhere('note.visibility IN (:...visibilities)', { visibilities: ['public', 'home'] })
      .andWhere('note.text IS NOT NULL')
      .select(['note.text', 'note.userId', 'note.createdAt', 'note.score'])
      .limit(1000)
      .getMany();

    // Extract topics using simple keyword analysis
    // In a real implementation, this would use NLP/ML for topic extraction
    const topicStats = new Map<string, {
      mentions: number;
      users: Set<string>;
      engagement: number;
      timeline: number[];
    }>();

    const commonTopics = [
      'technology', 'politics', 'sports', 'entertainment', 'news', 'music',
      'art', 'food', 'travel', 'gaming', 'science', 'health', 'education',
      'business', 'fashion', 'photography', 'books', 'movies', 'anime'
    ];

    for (const note of recentNotes) {
      if (!note.text) continue;

      const text = note.text.toLowerCase();
      const now = new Date();

      for (const topic of commonTopics) {
        if (text.includes(topic)) {
          if (!topicStats.has(topic)) {
            topicStats.set(topic, {
              mentions: 0,
              users: new Set(),
              engagement: 0,
              timeline: new Array(24).fill(0)
            });
          }

          const stats = topicStats.get(topic)!;
          stats.mentions++;
          stats.users.add(note.userId);
          stats.engagement += (note.score || 0);

          // Add to timeline
          const hourIndex = Math.floor((now.getTime() - note.createdAt.getTime()) / (1000 * 60 * 60));
          if (hourIndex < 24) {
            stats.timeline[23 - hourIndex]++;
          }
        }
      }
    }

    // Convert to trending items
    const trendingTopics: TrendingItem[] = [];

    for (const [topic, stats] of topicStats.entries()) {
      if (stats.mentions < 5) continue;

      const volume = stats.users.size;
      const engagementVelocity = stats.engagement / Math.max(1, timeMs / (1000 * 60 * 60));
      const viralityScore = stats.users.size / Math.max(1, stats.mentions) * 100;

      const previousPeriodVolume = await this.getPreviousPeriodVolume(`topic:${topic}`, timeframe);
      const volumeChange = previousPeriodVolume > 0
        ? ((volume - previousPeriodVolume) / previousPeriodVolume) * 100
        : 100;

      const trendingScore = await this.calculateTrendingScore({
        volume,
        engagementVelocity,
        viralityScore,
        volumeChange,
        recency: 1
      });

      trendingTopics.push({
        id: `topic:${topic}`,
        type: 'topic',
        name: topic,
        displayName: topic.charAt(0).toUpperCase() + topic.slice(1),
        description: `Trending topic: ${topic}`,
        trendingScore,
        engagementVelocity,
        viralityScore,
        volume,
        volumeChange,
        chart: stats.timeline,
        metadata: {
          category: topic, // The topic itself is the category
          isRising: volumeChange > 30,
          isHot: engagementVelocity > 5
        }
      });
    }

    return trendingTopics
      .sort((a, b) => b.trendingScore - a.trendingScore)
      .slice(0, limit);
  }

  /**
   * Get trending content using algorithm service
   */
  private async getTrendingContent(timeframe: string, limit: number): Promise<TrendingItem[]> {
    try {
      // Get trending notes from social proof service
      const trendingNotes = await SocialProofService.getTrendingNotes(limit * 2);

      const trendingContent: TrendingItem[] = [];

      for (const note of trendingNotes.slice(0, limit)) {
        const socialProof = note.socialProof;
        const volume = (socialProof.recentEngagement?.reactions || 0) + (socialProof.recentEngagement?.renotes || 0);

        trendingContent.push({
          id: `content:${note.id}`,
          type: 'content',
          name: note.id,
          displayName: note.text?.substring(0, 50) + '...' || 'Content',
          description: `Trending post by @${note.user?.username}`,
          trendingScore: socialProof.trendingScore,
          engagementVelocity: socialProof.engagementScore,
          viralityScore: socialProof.trendingScore,
          volume,
          volumeChange: 0, // TODO: Calculate change
          chart: [], // TODO: Generate chart data
          metadata: {
            category: 'content',
            isRising: socialProof.activityIndicators.isRising,
            isHot: socialProof.activityIndicators.isHot,
            topContributors: [note.user?.username || 'unknown']
          }
        });
      }

      return trendingContent;
    } catch (error) {
      logger.error('Failed to get trending content:', error as any);
      return [];
    }
  }

  /**
   * Calculate trending score using multiple factors (scaled to active users)
   */
  private async calculateTrendingScore(factors: {
    volume: number;
    engagementVelocity: number;
    viralityScore: number;
    volumeChange: number;
    recency: number;
  }): Promise<number> {
    const {
      volume,
      engagementVelocity,
      viralityScore,
      volumeChange,
      recency
    } = factors;

    // Get scaling factor based on active users
    const thresholds = await ActiveUsersService.getDynamicTrendingThresholds();
    const scalingFactor = thresholds.scalingFactor;

    // Normalize values with scaling
    const normalizedVolume = Math.min(volume / (50 * scalingFactor), 1);
    const normalizedVelocity = Math.min(engagementVelocity / (25 * scalingFactor), 1);
    const normalizedVirality = Math.min(viralityScore / (100 * scalingFactor), 1);
    const normalizedChange = Math.min(Math.max(volumeChange / 200, -1), 1);

    // Weighted score
    return (
      normalizedVolume * 0.3 +
      normalizedVelocity * 0.25 +
      normalizedVirality * 0.2 +
      normalizedChange * 0.15 +
      recency * 0.1
    ) * 100;
  }

  /**
   * Get volume from previous period for comparison
   */
  private async getPreviousPeriodVolume(identifier: string, timeframe: string): Promise<number> {
    const cacheKey = `prev_volume:${identifier}:${timeframe}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    // For now, return a random value
    // In production, this would query historical data
    const volume = Math.floor(Math.random() * 50);
    this.setCache(cacheKey, volume, 60 * 60 * 1000); // Cache for 1 hour
    return volume;
  }

  /**
   * Convert timeframe string to milliseconds
   */
  private getTimeframeMs(timeframe: string): number {
    switch (timeframe) {
      case '1h': return 60 * 60 * 1000;
      case '6h': return 6 * 60 * 60 * 1000;
      case '24h': return 24 * 60 * 60 * 1000;
      case '7d': return 7 * 24 * 60 * 60 * 1000;
      default: return 24 * 60 * 60 * 1000;
    }
  }

  /**
   * Cache management
   */
  private getFromCache(key: string): any {
    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: any, ttlMs: number): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + ttlMs
    });
  }

  /**
   * Categorize hashtag based on common patterns
   */
  private categorizeHashtag(tag: string): string {
    const lowerTag = tag.toLowerCase();

    // Technology keywords
    if (['tech', 'ai', 'ml', 'crypto', 'bitcoin', 'blockchain', 'coding', 'programming', 'javascript', 'python', 'react', 'vue', 'nodejs', 'web3', 'nft', 'metaverse', 'vr', 'ar'].some(keyword => lowerTag.includes(keyword))) {
      return 'technology';
    }

    // Gaming keywords
    if (['gaming', 'game', 'esports', 'twitch', 'steam', 'xbox', 'playstation', 'nintendo', 'fps', 'mmo', 'rpg'].some(keyword => lowerTag.includes(keyword))) {
      return 'gaming';
    }

    // Music keywords
    if (['music', 'song', 'album', 'concert', 'band', 'artist', 'spotify', 'soundcloud', 'vinyl', 'guitar', 'piano'].some(keyword => lowerTag.includes(keyword))) {
      return 'music';
    }

    // Sports keywords
    if (['sports', 'football', 'soccer', 'basketball', 'baseball', 'tennis', 'golf', 'olympics', 'fifa', 'nfl', 'nba', 'mlb'].some(keyword => lowerTag.includes(keyword))) {
      return 'sports';
    }

    // Entertainment keywords
    if (['movie', 'film', 'tv', 'show', 'netflix', 'disney', 'marvel', 'actor', 'actress', 'cinema', 'hollywood'].some(keyword => lowerTag.includes(keyword))) {
      return 'entertainment';
    }

    // News/Politics keywords
    if (['news', 'politics', 'election', 'government', 'policy', 'breaking', 'update', 'announcement'].some(keyword => lowerTag.includes(keyword))) {
      return 'news';
    }

    // Art keywords
    if (['art', 'design', 'drawing', 'painting', 'photography', 'creative', 'artist', 'gallery', 'exhibition'].some(keyword => lowerTag.includes(keyword))) {
      return 'art';
    }

    // Food keywords
    if (['food', 'recipe', 'cooking', 'restaurant', 'chef', 'cuisine', 'dinner', 'lunch', 'breakfast', 'coffee', 'wine'].some(keyword => lowerTag.includes(keyword))) {
      return 'food';
    }

    // Travel keywords
    if (['travel', 'vacation', 'trip', 'tourism', 'hotel', 'flight', 'adventure', 'explore', 'journey'].some(keyword => lowerTag.includes(keyword))) {
      return 'travel';
    }

    // Health keywords
    if (['health', 'fitness', 'workout', 'gym', 'wellness', 'medical', 'doctor', 'medicine', 'mental'].some(keyword => lowerTag.includes(keyword))) {
      return 'health';
    }

    // Business keywords
    if (['business', 'startup', 'entrepreneur', 'finance', 'investment', 'stock', 'market', 'economy', 'money'].some(keyword => lowerTag.includes(keyword))) {
      return 'business';
    }

    // Education keywords
    if (['education', 'learning', 'school', 'university', 'student', 'teacher', 'course', 'study', 'knowledge'].some(keyword => lowerTag.includes(keyword))) {
      return 'education';
    }

    // Fashion keywords
    if (['fashion', 'style', 'clothing', 'outfit', 'designer', 'brand', 'trend', 'beauty', 'makeup'].some(keyword => lowerTag.includes(keyword))) {
      return 'fashion';
    }

    // Science keywords
    if (['science', 'research', 'study', 'discovery', 'experiment', 'physics', 'chemistry', 'biology', 'space', 'nasa'].some(keyword => lowerTag.includes(keyword))) {
      return 'science';
    }

    // Default category
    return 'general';
  }

  /**
   * Clear all caches
   */
  public clearCache(): void {
    this.cache.clear();
  }
}