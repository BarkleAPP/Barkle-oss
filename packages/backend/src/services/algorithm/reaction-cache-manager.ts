/**
 * Reaction Cache Manager
 *
 * Handles Redis caching for reaction-based recommendations.
 */

import { Note } from '@/models/entities/note.js';
import Logger from '@/services/logger.js';
import { redisClient } from '@/db/redis.js';
import { Followings } from '@/models/index.js';
import { getReactionRecommendationsConfig } from '@/config/reaction-recommendations.js';
import { createAsyncConfigCache } from '@/misc/config-cache-util.js';

const logger = new Logger('reaction-cache-manager');

// Cache key patterns
const CACHE_KEYS = {
	userReactionProfile: (userId: string) => `reaction_rec:profile:${userId}`,
	similarUsers: (userId: string) => `reaction_rec:similar:${userId}`,
	candidateNotes: (userId: string) => `reaction_rec:candidates:${userId}`,
	userFollowing: (userId: string) => `reaction_rec:following:${userId}`,
};

// Cached config with 5-minute TTL
const CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const getConfig = createAsyncConfigCache(getReactionRecommendationsConfig, CONFIG_CACHE_TTL);

/**
 * Reaction Cache Manager
 */
export class ReactionCacheManager {
	private static instance: ReactionCacheManager;

	private constructor() {}

	public static getInstance(): ReactionCacheManager {
		if (!ReactionCacheManager.instance) {
			ReactionCacheManager.instance = new ReactionCacheManager();
		}
		return ReactionCacheManager.instance;
	}

	/**
	 * Get user's following list with caching
	 */
	public async getUserFollowingIds(userId: string): Promise<string[]> {
		const cacheKey = CACHE_KEYS.userFollowing(userId);

		// Try cache first
		try {
			const cached = await redisClient.get(cacheKey);
			if (cached) {
				return JSON.parse(cached);
			}
		} catch (err) {
			logger.warn('Cache read failed for following list:', err as Error);
		}

		// Fetch from database
		const followings = await Followings.createQueryBuilder('f')
			.select('f.followeeId')
			.where('f.followerId = :userId', { userId })
			.getRawMany();

		const followeeIds = followings.map(f => f.f_followeeId);

		// Cache for configured duration
		const config = await getConfig();
		try {
			await redisClient.set(cacheKey, JSON.stringify(followeeIds), 'EX', config.cacheTtlFollowing);
		} catch (err) {
			logger.warn('Failed to cache following list:', err as Error);
		}

		return followeeIds;
	}

	/**
	 * Cache recommendations
	 */
	public async cacheRecommendations(userId: string, notes: Note[]): Promise<void> {
		const cacheKey = CACHE_KEYS.candidateNotes(userId);
		const config = await getConfig();
		try {
			await redisClient.set(
				cacheKey,
				JSON.stringify(notes.map(n => n.id)),
				'EX',
				config.cacheTtlCandidates
			);
			logger.debug(`Cached ${notes.length} recommendations for user ${userId}`);
		} catch (err) {
			logger.warn('Failed to cache recommendations:', err as Error);
		}
	}

	/**
	 * Get cached recommendations
	 */
	public async getCachedRecommendations(
		userId: string,
		limit: number,
		fetchNotesByIds: (ids: string[], limit: number) => Promise<Note[]>
	): Promise<Note[] | null> {
		const cacheKey = CACHE_KEYS.candidateNotes(userId);
		try {
			const cached = await redisClient.get(cacheKey);
			if (!cached) return null;

			const noteIds = JSON.parse(cached) as string[];
			if (noteIds.length === 0) return null;

			// Fetch full notes
			const notes = await fetchNotesByIds(noteIds.slice(0, limit), limit);
			logger.debug(`Cache hit for user ${userId}, returning ${notes.length} recommendations`);
			return notes;
		} catch (err) {
			logger.warn('Failed to get cached recommendations:', err as Error);
			return null;
		}
	}

	/**
	 * Invalidate user's recommendation cache
	 */
	public async invalidateCache(userId: string): Promise<void> {
		const keys = [
			CACHE_KEYS.userReactionProfile(userId),
			CACHE_KEYS.similarUsers(userId),
			CACHE_KEYS.candidateNotes(userId),
			CACHE_KEYS.userFollowing(userId),
		];

		try {
			await Promise.all(keys.map(key => redisClient.del(key)));
			logger.debug(`Invalidated cache for user ${userId}`);
		} catch (err) {
			logger.warn('Failed to invalidate cache:', err as Error);
		}
	}

	/**
	 * Invalidate user's following cache
	 */
	public async invalidateFollowingCache(userId: string): Promise<void> {
		const cacheKey = CACHE_KEYS.userFollowing(userId);
		try {
			await redisClient.del(cacheKey);
			logger.debug(`Invalidated following cache for user ${userId}`);
		} catch (err) {
			logger.warn('Failed to invalidate following cache:', err as Error);
		}
	}

	/**
	 * Get cache statistics
	 */
	public async getCacheStats(userId: string): Promise<{
		profileCached: boolean;
		similarUsersCached: boolean;
		candidatesCached: boolean;
		followingCached: boolean;
	}> {
		const stats = {
			profileCached: false,
			similarUsersCached: false,
			candidatesCached: false,
			followingCached: false,
		};

		try {
			const keys = [
				CACHE_KEYS.userReactionProfile(userId),
				CACHE_KEYS.similarUsers(userId),
				CACHE_KEYS.candidateNotes(userId),
				CACHE_KEYS.userFollowing(userId),
			];

			const results = await Promise.all(
				keys.map(key => redisClient.exists(key))
			);

			stats.profileCached = results[0] === 1;
			stats.similarUsersCached = results[1] === 1;
			stats.candidatesCached = results[2] === 1;
			stats.followingCached = results[3] === 1;
		} catch (err) {
			logger.warn('Failed to get cache stats:', err as Error);
		}

		return stats;
	}
}

// Export singleton instance
export const reactionCacheManager = ReactionCacheManager.getInstance();
