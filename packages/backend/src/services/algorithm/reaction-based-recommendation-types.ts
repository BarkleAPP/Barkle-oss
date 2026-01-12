/**
 * Reaction-Based Recommendation Types
 *
 * Shared types and interfaces for the reaction-based recommendation system.
 */

/**
 * Recommendation options
 */
export interface RecommendationOptions {
	minCommonReactions?: number;
	maxSimilarUsers?: number;
	followBoostMultiplier?: number;
	positiveSentimentWeight?: number;
	negativeSentimentWeight?: number;
	recencyDecayDays?: number;
	excludeMuted?: boolean;
	excludeBlocked?: boolean;
	excludeShadowHidden?: boolean;
	seenNoteIds?: string[];
}

/**
 * Similar user score
 */
export interface SimilarUserScore {
	userId: string;
	similarityScore: number;
	commonReactionCount: number;
	reactionTypeBonus: number;
	sentimentAlignmentBonus: number;
}

/**
 * Reaction data with note information
 */
export interface ReactionWithNote {
	id: string;
	userId: string;
	noteId: string;
	reaction: string;
	createdAt: Date;
	note?: {
		userId: string;
		createdAt: Date;
		renoteCount?: number;
		repliesCount?: number;
		reactionCount?: number;
	};
}

/**
 * Recommendation score breakdown
 */
export interface RecommendationScore {
	noteId: string;
	score: number;
	similarityScore: number;
	isFromFollowing: boolean;
	sentiment: 'positive' | 'negative' | 'neutral';
	sentimentWeight: number;
	followBoost: number;
	recencyDecay: number;
	recommendedBy: string;
}

/**
 * Cached similar users data
 */
export interface CachedSimilarUsers {
	userIds: string[];
	scores: Map<string, number>; // userId -> similarity score
	calculatedAt: Date;
	expiry: Date;
}

/**
 * Cached candidates data
 */
export interface CachedCandidates {
	noteIds: string[];
	scores: Map<string, number>; // noteId -> recommendation score
	calculatedAt: Date;
	expiry: Date;
}
