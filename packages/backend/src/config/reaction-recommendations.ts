/**
 * Reaction-Based Recommendations Configuration
 *
 * Provides configuration values for the reaction-based recommendation system
 * with sensible defaults.
 */

import { fetchMeta } from '@/misc/fetch-meta.js';

interface ReactionRecommendationsConfig {
	enabled: boolean;
	minCommonReactions: number;
	maxSimilarUsers: number;
	followBoostMultiplier: number;
	positiveSentimentWeight: number;
	negativeSentimentWeight: number;
	recencyDecayDays: number;
	reactionHistoryDays: number;
	maxReactionsPerUser: number;
	cacheTtlProfile: number;
	cacheTtlSimilar: number;
	cacheTtlCandidates: number;
	cacheTtlFollowing: number;
	positiveReactions: string[];
	negativeReactions: string[];
}

/**
 * Get reaction-based recommendations configuration with defaults
 */
export async function getReactionRecommendationsConfig(): Promise<ReactionRecommendationsConfig> {
	const meta = await fetchMeta();
	const customConfig = meta.reactionBasedRecommendations || {};

	return {
		enabled: customConfig.enabled ?? true,
		minCommonReactions: customConfig.minCommonReactions ?? 3,
		maxSimilarUsers: customConfig.maxSimilarUsers ?? 50,
		followBoostMultiplier: customConfig.followBoostMultiplier ?? 2.5,
		positiveSentimentWeight: customConfig.positiveSentimentWeight ?? 2.0,
		negativeSentimentWeight: customConfig.negativeSentimentWeight ?? 0.5,
		recencyDecayDays: customConfig.recencyDecayDays ?? 30,
		reactionHistoryDays: customConfig.reactionHistoryDays ?? 90,
		maxReactionsPerUser: customConfig.maxReactionsPerUser ?? 500,
		cacheTtlProfile: customConfig.cacheTtlProfile ?? 24 * 60 * 60, // 24 hours
		cacheTtlSimilar: customConfig.cacheTtlSimilar ?? 6 * 60 * 60, // 6 hours
		cacheTtlCandidates: customConfig.cacheTtlCandidates ?? 15 * 60, // 15 minutes
		cacheTtlFollowing: customConfig.cacheTtlFollowing ?? 60 * 60, // 1 hour
		positiveReactions: customConfig.positiveReactions ?? ['⭐', '👍', '❤️', '😍', '🎉', '👏', '🔥', 'like', 'love'],
		negativeReactions: customConfig.negativeReactions ?? ['👎', '😢', '😡', '💔', 'dislike', 'angry'],
	};
}

/**
 * Check if reaction-based recommendations are enabled
 */
export async function isReactionRecommendationsEnabled(): Promise<boolean> {
	const config = await getReactionRecommendationsConfig();
	return config.enabled;
}
