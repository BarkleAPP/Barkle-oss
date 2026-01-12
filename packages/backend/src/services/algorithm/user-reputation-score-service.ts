/**
 * User Reputation Score Service
 * Calculates a 0-1 reputation score for users based on multiple factors
 * Used for recommendation ranking and content deboost algorithms
 */

import { User } from '@/models/entities/user.js';
import { Users, NoteReactions } from '@/models/index.js';
import Logger from '@/services/logger.js';

const logger = new Logger('user-reputation-score-service');

// Negative reactions that hurt reputation
export const NEGATIVE_REACTIONS = ['👎', '😡', '😢', '💔', '🤮', '🤬', '💩', '🙄', '😤', '😠'];

// Platform domains that don't trigger external link penalty
export const PLATFORM_DOMAINS = ['barkle.chat', 'avunite.com'];

// Thresholds for block-to-follow ratio
export const BLOCK_RATIO_EXCLUDE_THRESHOLD = 0.3; // 30%+ blocks = complete exclusion
export const BLOCK_RATIO_DEBOOST_THRESHOLD = 0.1; // 10%+ blocks = significant deboost

/**
 * User Reputation Score Service
 * Singleton service for calculating and caching user reputation scores
 */
export class UserReputationScoreService {
	private static instance: UserReputationScoreService;
	private reputationCache = new Map<string, { score: number; timestamp: number }>();
	private readonly CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache

	private constructor() {
		logger.info('User Reputation Score Service initialized');
	}

	public static getInstance(): UserReputationScoreService {
		if (!UserReputationScoreService.instance) {
			UserReputationScoreService.instance = new UserReputationScoreService();
		}
		return UserReputationScoreService.instance;
	}

	/**
	 * Calculate comprehensive reputation score for a user (0-1 range)
	 * Lower score = worse reputation, higher score = better reputation
	 */
	public async calculateReputationScore(user: User): Promise<number> {
		// Check cache first
		const cached = this.reputationCache.get(user.id);
		if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
			return cached.score;
		}

		let score = 0.5; // Start at neutral

		// POSITIVE FACTORS
		// 1. Follower count (normalized) - max +0.15
		const followerScore = Math.min((user.followersCount || 0) / 1000, 1.0) * 0.15;
		score += followerScore;

		// 2. Account age - max +0.10
		const accountAgeMs = Date.now() - user.createdAt.getTime();
		const accountAgeDays = accountAgeMs / (1000 * 60 * 60 * 24);
		const ageScore = Math.min(accountAgeDays / 365, 1.0) * 0.10; // Max at 1 year
		score += ageScore;

		// 3. Verified/staff status - max +0.15
		if (user.isVerified) score += 0.10;
		if (user.isStaff) score += 0.05;

		// 4. Complete profile - max +0.10
		let profileCompletenessBonus = 0;
		if (user.avatarId) profileCompletenessBonus += 0.04;
		if (user.name) profileCompletenessBonus += 0.03;
		if (user.bannerId) profileCompletenessBonus += 0.03;
		score += profileCompletenessBonus;

		// NEGATIVE FACTORS (HEAVY PENALTIES)

		// 1. Blocks received - MAJOR penalty
		const blocksReceived = user.blocksReceivedCount || 0;
		if (blocksReceived > 0) {
			// Exponential penalty: each block reduces score
			const blockPenalty = Math.min(blocksReceived * 0.02, 0.30); // Max -0.30
			score -= blockPenalty;
		}

		// 2. Mutes received - Significant penalty
		const mutesReceived = user.mutesReceivedCount || 0;
		if (mutesReceived > 0) {
			// Exponential penalty: each mute reduces score
			const mutePenalty = Math.min(mutesReceived * 0.015, 0.20); // Max -0.20
			score -= mutePenalty;
		}

		// 3. Block-to-follow ratio - CRITICAL penalty
		const followersCount = user.followersCount || 1; // Avoid division by zero
		const blockToFollowRatio = blocksReceived / followersCount;

		if (blockToFollowRatio > BLOCK_RATIO_DEBOOST_THRESHOLD) {
			// Bad ratio gets exponential penalty
			const ratioPenalty = Math.min(blockToFollowRatio * 0.5, 0.40); // Max -0.40
			score -= ratioPenalty;
		}

		// 4. Get negative reactions received
		try {
			const negativeReactionsCount = await this.getNegativeReactionsCount(user.id);
			if (negativeReactionsCount > 0) {
				// Penalty scales with negative reactions
				const negativeReactionsPenalty = Math.min(negativeReactionsCount * 0.005, 0.15); // Max -0.15
				score -= negativeReactionsPenalty;
			}
		} catch (error) {
			logger.error(`Failed to get negative reactions for user ${user.id}:`, { error: String(error) });
		}

		// SUSPICIOUS ACCOUNT DETECTION (MAJOR DEBOOST)
		let suspicionScore = 0;

		// No profile picture
		if (!user.avatarId) suspicionScore += 1;

		// No display name
		if (!user.name) suspicionScore += 1;

		// No banner
		if (!user.bannerId) suspicionScore += 1;

		// Very new account with high block ratio
		if (accountAgeDays < 30 && blockToFollowRatio > 0.2) {
			suspicionScore += 2;
		}

		// High block-to-follow ratio
		if (blockToFollowRatio > 0.3) {
			suspicionScore += 3;
		}

		// Apply suspicion penalty (max -0.25)
		if (suspicionScore > 0) {
			const suspicionPenalty = Math.min(suspicionScore * 0.05, 0.25);
			score -= suspicionPenalty;
		}

		// Ensure score is in [0, 1] range
		score = Math.max(0.0, Math.min(1.0, score));

		// Cache the result
		this.reputationCache.set(user.id, { score, timestamp: Date.now() });

		// Optionally update the database (async, non-blocking)
		this.updateReputationScoreInDb(user.id, score).catch(error => {
			logger.error(`Failed to update reputation score in DB for user ${user.id}:`, error);
		});

		logger.info(`Calculated reputation score for user ${user.id}: ${score.toFixed(3)}`);

		return score;
	}

	/**
	 * Get count of negative reactions received by a user
	 */
	private async getNegativeReactionsCount(userId: string): Promise<number> {
		try {
			// Get all reactions to this user's notes
			const count = await NoteReactions.createQueryBuilder('reaction')
				.innerJoin('note', 'note', 'note.id = reaction.noteId')
				.where('note.userId = :userId', { userId })
				.andWhere('reaction.reaction IN (:...negativeReactions)', {
					negativeReactions: NEGATIVE_REACTIONS
				})
				.getCount();

			return count;
		} catch (error) {
			logger.error('Error counting negative reactions:', { error: String(error) });
			return 0;
		}
	}

	/**
	 * Update reputation score in database (async)
	 */
	private async updateReputationScoreInDb(userId: string, score: number): Promise<void> {
		try {
			await Users.update(userId, { reputationScore: score });
		} catch (error) {
			logger.error('Error updating reputation score in DB:', { error: String(error) });
		}
	}

	/**
	 * Invalidate cache for a user (call when their data changes)
	 */
	public invalidateCache(userId: string): void {
		this.reputationCache.delete(userId);
	}

	/**
	 * Get cached reputation score or calculate if not cached
	 */
	public async getReputationScore(userId: string): Promise<number> {
		try {
			// Try to get from cache first
			const cached = this.reputationCache.get(userId);
			if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
				return cached.score;
			}

			// Get user from database
			const user = await Users.findOneBy({ id: userId });
			if (!user) {
				logger.warn(`User ${userId} not found for reputation score`);
				return 0.5; // Default neutral score
			}

			// Calculate and cache
			return await this.calculateReputationScore(user);
		} catch (error) {
			logger.error(`Error getting reputation score for user ${userId}:`, { error: String(error) });
			return 0.5; // Default neutral score on error
		}
	}

	/**
	 * Check if user should be excluded from recommendations based on reputation
	 */
	public shouldExcludeFromRecommendations(user: User): boolean {
		const blocksReceived = user.blocksReceivedCount || 0;
		const followersCount = user.followersCount || 1;
		const blockToFollowRatio = blocksReceived / followersCount;

		// Exclude if block-to-follow ratio exceeds threshold
		return blockToFollowRatio > BLOCK_RATIO_EXCLUDE_THRESHOLD;
	}

	/**
	 * Get deboost multiplier based on block/mute counts
	 */
	public getBlockMuteDeboustMultiplier(user: User): number {
		const blocksReceived = user.blocksReceivedCount || 0;
		const mutesReceived = user.mutesReceivedCount || 0;

		let multiplier = 1.0;

		// Block penalty - exponential decay
		if (blocksReceived > 0) {
			// Each significant block count reduces multiplier
			const blockPenalty = Math.pow(0.3, Math.min(blocksReceived / 10, 3)); // 0.3x per 10 blocks, max 3 iterations
			multiplier *= blockPenalty;
		}

		// Mute penalty - lighter than blocks
		if (mutesReceived > 0) {
			const mutePenalty = Math.pow(0.4, Math.min(mutesReceived / 15, 3)); // 0.4x per 15 mutes, max 3 iterations
			multiplier *= mutePenalty;
		}

		return Math.max(0.05, multiplier); // Minimum 0.05x
	}

	/**
	 * Get deboost multiplier for incomplete profile
	 */
	public getIncompleteProfileMultiplier(user: User): number {
		let multiplier = 1.0;

		// Check each profile component
		const hasAvatar = !!user.avatarId;
		const hasName = !!user.name;
		const hasBanner = !!user.bannerId;

		// Apply individual penalties
		if (!hasAvatar) multiplier *= 0.5;
		if (!hasName) multiplier *= 0.7;
		if (!hasBanner) multiplier *= 0.8;

		// All three missing = very suspicious
		if (!hasAvatar && !hasName && !hasBanner) {
			multiplier = 0.2;
		}

		return multiplier;
	}

	/**
	 * Clear entire cache (for testing/maintenance)
	 */
	public clearCache(): void {
		this.reputationCache.clear();
		logger.info('Reputation cache cleared');
	}
}

// Export singleton instance
export const userReputationScoreService = UserReputationScoreService.getInstance();
