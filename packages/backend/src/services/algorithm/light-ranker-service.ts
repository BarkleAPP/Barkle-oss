import { Note } from '@/models/entities/note.js';
import { User } from '@/models/entities/user.js';
import { Followings } from '@/models/index.js';

const logger = {
  info: (msg: string, data?: any) => console.log('[LightRanker]', msg, data || ''),
  debug: (msg: string, data?: any) => console.log('[LightRanker]', msg, data || ''),
};

/**
 * Light Ranker - Fast heuristic-based pre-filtering
 * Inspired by Twitter's Earlybird light ranker
 * 
 * Reduces candidates from 1000s → 100s before heavy ML ranking
 * Uses simple, fast heuristics for initial scoring
 */
export class LightRankerService {
  // Cache following relationships per user to avoid repeated DB queries
  private followingCache = new Map<string, Set<string>>();
  private cacheExpiry = new Map<string, number>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Quick score candidates using heuristics
   * This is MUCH faster than ML models
   */
  public async lightRank(
    candidates: Note[],
    user: User,
    options: {
      topPercent?: number;  // Take top X% (default 30%)
      minScore?: number;    // Minimum score threshold
    } = {}
  ): Promise<Note[]> {
    const startTime = Date.now();
    const topPercent = options.topPercent || 0.3;
    const minScore = options.minScore || 0.1;

    if (candidates.length === 0) {
      return [];
    }

    // CRITICAL OPTIMIZATION: Batch load following relationships ONCE
    const followingSet = await this.getFollowingSet(user.id);
    const batchLoadTime = Date.now() - startTime;

    // Score all candidates with fast heuristics (now with cached following data)
    const scored = candidates.map(note => ({
      note,
      score: this.calculateLightScore(note, user, followingSet),
      breakdown: this.getScoreBreakdown(note, user, followingSet) // For debugging
    }));

    // Sort by score (highest first)
    scored.sort((a, b) => b.score - a.score);

    // Take top X% or those above minimum score
    const targetCount = Math.ceil(candidates.length * topPercent);
    let filtered = scored.filter(item => item.score >= minScore);
    
    // CRITICAL FIX: If filtering removes too many notes, relax the threshold
    if (filtered.length < Math.min(10, candidates.length * 0.1)) {
      logger.info('Light ranker: minScore too restrictive, relaxing threshold');
      filtered = scored.slice(0, Math.max(targetCount, Math.min(50, candidates.length)));
    } else {
      filtered = filtered.slice(0, Math.max(targetCount, 50)); // At least 50 candidates
    }

    const processingTime = Date.now() - startTime;
    
    logger.info('Light ranker completed', {
      inputCount: candidates.length,
      outputCount: filtered.length,
      filterRate: ((candidates.length - filtered.length) / candidates.length * 100).toFixed(1) + '%',
      processingTimeMs: processingTime,
      batchLoadMs: batchLoadTime,
      followingCount: followingSet.size,
      avgScore: (filtered.reduce((sum, item) => sum + item.score, 0) / filtered.length).toFixed(3)
    });

    return filtered.map(item => item.note);
  }

  /**
   * Get following set for a user with caching
   * ONE database query instead of N queries!
   */
  private async getFollowingSet(userId: string): Promise<Set<string>> {
    const now = Date.now();
    const cached = this.followingCache.get(userId);
    const expiry = this.cacheExpiry.get(userId);

    // Return cached data if still valid
    if (cached && expiry && expiry > now) {
      return cached;
    }

    // Fetch from database (ONE query for all followings)
    const followings = await Followings.find({
      where: { followerId: userId },
      select: ['followeeId']
    });

    const followingSet = new Set(followings.map(f => f.followeeId));

    // Cache for 5 minutes
    this.followingCache.set(userId, followingSet);
    this.cacheExpiry.set(userId, now + this.CACHE_TTL_MS);

    return followingSet;
  }

  /**
   * Calculate fast heuristic score (0-1 range)
   * Uses simple metrics that don't require ML
   */
  private calculateLightScore(note: Note, user: User, followingSet: Set<string>): number {
    let score = 0;

    // 1. RECENCY SCORE (20% weight - reduced from 30%)
    // Much slower decay - don't heavily penalize older content
    const ageHours = (Date.now() - note.createdAt.getTime()) / (1000 * 60 * 60);
    const recencyScore = Math.exp(-ageHours / 168); // Decay over 7 days instead of 24 hours
    score += recencyScore * 0.20;

    // 2. ENGAGEMENT VELOCITY (50% weight - increased from 40%)
    // Interactions per hour - indicates viral content
    const totalEngagement = 
      (note.repliesCount || 0) * 3 +      // Replies are worth more
      (note.renoteCount || 0) * 2 +       // Renotes are viral signals
      (note.reactions?.length || 0) * 1;  // Reactions are cheapest
    
    // For older content, use total engagement instead of rate to avoid penalizing good old content
    let engagementScore;
    if (ageHours > 24) {
      // For content older than 24 hours, use total engagement normalized
      engagementScore = Math.min(totalEngagement / 20, 1); // Cap at 20 total interactions
    } else {
      // For fresh content, use engagement rate
      const engagementRate = totalEngagement / Math.max(ageHours, 0.1);
      engagementScore = Math.min(engagementRate / 10, 1); // Cap at 10 interactions/hour
    }
    score += engagementScore * 0.50;

    // 3. AUTHOR QUALITY (20% weight)
    // Well-connected authors produce better content
    if (note.user) {
      const followerScore = Math.min((note.user.followersCount || 0) / 10000, 1); // Cap at 10k
      score += followerScore * 0.20;
    }

    // 4. RELATIONSHIP BONUS (10% weight) - USES CACHED SET!
    // Boost content from people you follow
    if (followingSet.has(note.userId)) {
      score += 0.10;
    }

    // 5. CONTENT QUALITY SIGNALS (bonus)
    // Has media (images/videos)
    if (note.fileIds && note.fileIds.length > 0) {
      score += 0.05;
    }

    // Has URL (indicates informative content)
    if (note.text && note.text.includes('http')) {
      score += 0.03;
    }

    // Reasonable length (not too short, not too long)
    const textLength = note.text?.length || 0;
    if (textLength > 50 && textLength < 500) {
      score += 0.02;
    }

    // 6. PENALTIES (much more lenient)
    // Only penalize extremely old content (older than 2 weeks)
    if (ageHours > 336) { // 2 weeks
      score *= 0.8; // Only 20% penalty for very old content
    }

    // Only penalize zero engagement for very old posts
    if (totalEngagement === 0 && ageHours > 24) { // 24 hours instead of 1 hour
      score *= 0.9; // Only 10% penalty for zero engagement after 24 hours
    }

    // Ensure score is in [0, 1] range
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Get detailed score breakdown (for debugging/monitoring)
   */
  private getScoreBreakdown(note: Note, user: User, followingSet: Set<string>): {
    recency: number;
    velocity: number;
    authorQuality: number;
    relationship: number;
    contentBonus: number;
  } {
    const ageHours = (Date.now() - note.createdAt.getTime()) / (1000 * 60 * 60);
    const totalEngagement = 
      (note.repliesCount || 0) * 3 +
      (note.renoteCount || 0) * 2 +
      (note.reactions?.length || 0) * 1;
    const engagementRate = totalEngagement / Math.max(ageHours, 0.1);

    // Calculate engagement score using same logic as main function
    let engagementScore;
    if (ageHours > 24) {
      engagementScore = Math.min(totalEngagement / 20, 1);
    } else {
      engagementScore = Math.min(engagementRate / 10, 1);
    }

    return {
      recency: Math.exp(-ageHours / 168) * 0.20, // Updated to match main function
      velocity: engagementScore * 0.50, // Updated to match main function
      authorQuality: Math.min((note.user?.followersCount || 0) / 10000, 1) * 0.20,
      relationship: followingSet.has(note.userId) ? 0.10 : 0,
      contentBonus: this.calculateContentBonus(note)
    };
  }

  private calculateContentBonus(note: Note): number {
    let bonus = 0;
    if (note.fileIds && note.fileIds.length > 0) bonus += 0.05;
    if (note.text && note.text.includes('http')) bonus += 0.03;
    
    const textLength = note.text?.length || 0;
    if (textLength > 50 && textLength < 500) bonus += 0.02;
    
    return bonus;
  }

  /**
   * Batch process with light ranking
   * Useful for API endpoints
   */
  public async batchLightRank(
    candidateBatches: Map<string, Note[]>,
    user: User,
    options: {
      topPercent?: number;
      minScore?: number;
    } = {}
  ): Promise<Map<string, Note[]>> {
    const results = new Map<string, Note[]>();

    for (const [source, candidates] of candidateBatches) {
      const ranked = await this.lightRank(candidates, user, options);
      results.set(source, ranked);
    }

    return results;
  }
}

// Singleton export
export const lightRankerService = new LightRankerService();
