/**
 * Reaction Similarity Calculator
 *
 * Calculates similarity between users based on their reaction patterns.
 */

import { NoteReactions } from '@/models/index.js';
import Logger from '@/services/logger.js';
import { DAY } from '@/const.js';
import type { ReactionWithNote, SimilarUserScore } from './reaction-based-recommendation-types.js';
import { getReactionRecommendationsConfig } from '@/config/reaction-recommendations.js';
import { createAsyncConfigCache } from '@/misc/config-cache-util.js';

const logger = new Logger('reaction-similarity-calculator');

// Default reactions (will be overridden by config)
const DEFAULT_POSITIVE_REACTIONS = ['⭐', '👍', '❤️', '😍', '🎉', '👏', '🔥', 'like', 'love'];
const DEFAULT_NEGATIVE_REACTIONS = ['👎', '😢', '😡', '💔', 'dislike', 'angry'];

// Similarity calculation bonuses
const REACTION_TYPE_MATCH_BONUS = 0.1; // Bonus for using same emoji
const SENTIMENT_ALIGNMENT_BONUS = 0.05; // Bonus for same sentiment (both positive/negative)

// Similar user search cutoff
const SIMILAR_USERS_CUTOFF_DAYS = 90; // Days to look back for finding similar users

// Cached config with 5-minute TTL
const CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const getConfig = createAsyncConfigCache(getReactionRecommendationsConfig, CONFIG_CACHE_TTL);

/**
 * Reaction Similarity Calculator
 */
export class ReactionSimilarityCalculator {
	private static instance: ReactionSimilarityCalculator;

	private constructor() {}

	public static getInstance(): ReactionSimilarityCalculator {
		if (!ReactionSimilarityCalculator.instance) {
			ReactionSimilarityCalculator.instance = new ReactionSimilarityCalculator();
		}
		return ReactionSimilarityCalculator.instance;
	}

	/**
	 * Get user's recent reactions for similarity calculation
	 *
	 * @param userId - The user ID to fetch reactions for
	 * @param days - Number of days to look back (optional, defaults to config value)
	 * @returns Array of reactions with note data, filtered to public notes only
	 */
	public async getUserRecentReactions(
		userId: string,
		days?: number
	): Promise<ReactionWithNote[]> {
		const config = await getConfig();
		const historyDays = days ?? config.reactionHistoryDays;
		const cutoffDate = new Date(Date.now() - historyDays * DAY);

		const reactions = await NoteReactions.createQueryBuilder('nr')
			.select(['nr.id', 'nr.userId', 'nr.noteId', 'nr.reaction', 'nr.createdAt'])
			.addSelect(['note.userId', 'note.createdAt'])
			.innerJoin('nr.note', 'note')
			.where('nr.userId = :userId', { userId })
			.andWhere('nr.createdAt > :cutoffDate', { cutoffDate })
			.andWhere('note.visibility = :visibility', { visibility: 'public' })
			.orderBy('nr.createdAt', 'DESC')
			.limit(config.maxReactionsPerUser)
			.getRawMany();

		return reactions.map(r => ({
			id: r.nr_id,
			userId: r.nr_userId,
			noteId: r.nr_noteId,
			reaction: r.nr_reaction,
			createdAt: r.nr_createdAt,
			note: {
				userId: r.note_userId,
				createdAt: r.note_createdAt,
			},
		}));
	}

	/**
	 * Find users with similar reaction patterns using Jaccard similarity
	 *
	 * Calculates similarity scores based on:
	 * - Jaccard similarity coefficient (common reactions / total unique reactions)
	 * - Bonus for same emoji reaction (+0.1 per match)
	 * - Bonus for same sentiment alignment (+0.05 per match)
	 *
	 * @param userReactions - Current user's reactions to compare against
	 * @param userId - Current user ID to exclude from results
	 * @param minCommonReactions - Minimum number of common reactions required (default: 3)
	 * @param maxSimilarUsers - Maximum number of similar users to return (default: 50)
	 * @returns Array of similar users sorted by similarity score (highest first)
	 */
	public async findSimilarUsers(
		userReactions: ReactionWithNote[],
		userId: string,
		minCommonReactions: number = 3,
		maxSimilarUsers: number = 50
	): Promise<SimilarUserScore[]> {
		const userNoteIds = new Set(userReactions.map(r => r.noteId));
		const userReactionByNote = new Map(userReactions.map(r => [r.noteId, r.reaction]));
		const cutoffDate = new Date(Date.now() - SIMILAR_USERS_CUTOFF_DAYS * DAY);

		// Find other users who reacted to the same notes
		const similarUserReactions = await NoteReactions.createQueryBuilder('nr')
			.select(['nr.userId', 'nr.noteId', 'nr.reaction'])
			.innerJoin('nr.note', 'note')
			.where('nr.noteId IN (:...noteIds)', { noteIds: Array.from(userNoteIds) })
			.andWhere('nr.userId != :currentUserId', { currentUserId: userId })
			.andWhere('nr.createdAt > :cutoffDate', { cutoffDate })
			.orderBy('nr.createdAt', 'DESC')
			.getMany();

		// Pre-load config once outside the loop to avoid repeated async calls
		const config = await getConfig();
		const positiveReactions = config.positiveReactions || DEFAULT_POSITIVE_REACTIONS;
		const negativeReactions = config.negativeReactions || DEFAULT_NEGATIVE_REACTIONS;

		// Helper function for sentiment calculation (uses pre-loaded config)
		const getSentiment = (reaction: string): 'positive' | 'negative' | 'neutral' => {
			const reactionLower = reaction.toLowerCase();
			// Use exact matching to avoid false positives from substring matching
			if (positiveReactions.some(r => reactionLower === r.toLowerCase())) {
				return 'positive';
			}
			if (negativeReactions.some(r => reactionLower === r.toLowerCase())) {
				return 'negative';
			}
			return 'neutral';
		};

		// Group reactions by user
		const reactionsByUser = new Map<string, ReactionWithNote[]>();
		for (const r of similarUserReactions) {
			if (!reactionsByUser.has(r.userId)) {
				reactionsByUser.set(r.userId, []);
			}
			reactionsByUser.get(r.userId)!.push({
				id: r.id,
				userId: r.userId,
				noteId: r.noteId,
				reaction: r.reaction,
				createdAt: r.createdAt,
			});
		}

		// Calculate similarity scores
		const userSimilarities: SimilarUserScore[] = [];

		for (const [otherUserId, otherReactions] of reactionsByUser.entries()) {
			// Find common reacted notes
			const commonNoteIds = otherReactions
				.filter(r => userNoteIds.has(r.noteId))
				.map(r => r.noteId);

			if (commonNoteIds.length < minCommonReactions) {
				continue;
			}

			// Calculate Jaccard similarity
			const otherNoteIds = new Set(otherReactions.map(r => r.noteId));
			const intersection = commonNoteIds.length;
			const union = new Set([...userNoteIds, ...otherNoteIds]).size;
			// Guard against division by zero (though minCommonReactions should prevent this)
			const jaccardSimilarity = union === 0 ? 0 : intersection / union;

			// Calculate reaction type overlap bonus
			let reactionTypeBonus = 0;
			let sentimentAlignmentBonus = 0;

			for (const noteId of commonNoteIds) {
				const userReaction = userReactionByNote.get(noteId)!;
				const otherReaction = otherReactions.find(r => r.noteId === noteId)!.reaction;

				// Same emoji = higher similarity
				if (userReaction === otherReaction) {
					reactionTypeBonus += REACTION_TYPE_MATCH_BONUS;
				}

				// Same sentiment = bonus (using pre-loaded config, no async calls)
				const userSentiment = getSentiment(userReaction);
				const otherSentiment = getSentiment(otherReaction);

				if (userSentiment === otherSentiment && userSentiment !== 'neutral') {
					sentimentAlignmentBonus += SENTIMENT_ALIGNMENT_BONUS;
				}
			}

			// Final similarity score (0-1)
			const similarityScore = Math.min(1,
				jaccardSimilarity + reactionTypeBonus + sentimentAlignmentBonus
			);

			userSimilarities.push({
				userId: otherUserId,
				similarityScore,
				commonReactionCount: commonNoteIds.length,
				reactionTypeBonus,
				sentimentAlignmentBonus,
			});
		}

		// Sort by similarity and keep top users
		userSimilarities.sort((a, b) => b.similarityScore - a.similarityScore);
		const topSimilarUsers = userSimilarities.slice(0, maxSimilarUsers);

		logger.info(`Found ${topSimilarUsers.length} similar users for ${userId} (min ${minCommonReactions} common reactions)`);

		return topSimilarUsers;
	}

	/**
	 * Get reaction sentiment
	 *
	 * Note: Emoji reactions should be normalized to avoid Unicode variation issues.
	 * This method uses exact string matching (case-insensitive) to classify reactions.
	 */
	public async getReactionSentiment(reaction: string): Promise<'positive' | 'negative' | 'neutral'> {
		const config = await getConfig();
		const positiveReactions = config.positiveReactions || DEFAULT_POSITIVE_REACTIONS;
		const negativeReactions = config.negativeReactions || DEFAULT_NEGATIVE_REACTIONS;

		const reactionLower = reaction.toLowerCase();

		// Use exact matching to avoid false positives from substring matching
		if (positiveReactions.some(r => reactionLower === r.toLowerCase())) {
			return 'positive';
		}
		if (negativeReactions.some(r => reactionLower === r.toLowerCase())) {
			return 'negative';
		}
		return 'neutral';
	}

	/**
	 * Get sentiment weight
	 */
	public getSentimentWeight(sentiment: 'positive' | 'negative' | 'neutral', options: {
		positiveWeight: number;
		negativeWeight: number;
	}): number {
		return sentiment === 'positive'
			? options.positiveWeight
			: sentiment === 'negative'
				? options.negativeWeight
				: 1.0;
	}
}

// Export singleton instance
export const reactionSimilarityCalculator = ReactionSimilarityCalculator.getInstance();
