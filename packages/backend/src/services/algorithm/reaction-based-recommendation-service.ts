/**
 * Reaction-Based Recommendation Service
 *
 * Collaborative filtering recommendation system based on user reaction patterns.
 * Finds users with similar tastes through their reaction history and recommends
 * content they've engaged with.
 *
 * This is the main service that orchestrates the recommendation pipeline.
 */

import { NoteReactions, Notes } from '@/models/index.js';
import { Note } from '@/models/entities/note.js';
import Logger from '@/services/logger.js';
import { DAY } from '@/const.js';
import type { RecommendationOptions, ReactionWithNote, RecommendationScore, SimilarUserScore } from './reaction-based-recommendation-types.js';
import { reactionSimilarityCalculator } from './reaction-similarity-calculator.js';
import { reactionCacheManager } from './reaction-cache-manager.js';

const logger = new Logger('reaction-based-recommendation');

// Scoring weights
const ENGAGEMENT_WEIGHT = 0.1; // Weight for engagement score in final recommendation score

// Query limits
const CANDIDATE_REACTIONS_LIMIT = 2000; // Max candidate reactions to fetch
const CANDIDATE_NOTES_CUTOFF_DAYS = 90; // Days to look back for candidate notes

// Sorting
const DEFAULT_SORT_ORDER = 999; // Fallback sort order for notes not in original list

/**
 * Reaction-Based Recommendation Service
 */
export class ReactionBasedRecommendationService {
	private static instance: ReactionBasedRecommendationService;

	private constructor() {}

	public static getInstance(): ReactionBasedRecommendationService {
		if (!ReactionBasedRecommendationService.instance) {
			ReactionBasedRecommendationService.instance = new ReactionBasedRecommendationService();
		}
		return ReactionBasedRecommendationService.instance;
	}

	/**
	 * Main entry point - Get recommendations for a user
	 */
	public async getRecommendations(
		userId: string,
		limit: number = 20,
		options: RecommendationOptions = {}
	): Promise<Note[]> {
		const startTime = Date.now();

		try {
			// Check cache first
			const cached = await reactionCacheManager.getCachedRecommendations(
				userId,
				limit,
				(ids, _lim) => this.fetchNotesByIds(ids, userId)
			);
			if (cached && cached.length > 0) {
				return cached;
			}

			// Merge default options
			const mergedOptions: Required<RecommendationOptions> = {
				minCommonReactions: options.minCommonReactions ?? 3,
				maxSimilarUsers: options.maxSimilarUsers ?? 50,
				followBoostMultiplier: options.followBoostMultiplier ?? 2.5,
				positiveSentimentWeight: options.positiveSentimentWeight ?? 2.0,
				negativeSentimentWeight: options.negativeSentimentWeight ?? 0.5,
				recencyDecayDays: options.recencyDecayDays ?? 30,
				excludeMuted: options.excludeMuted ?? true,
				excludeBlocked: options.excludeBlocked ?? true,
				excludeShadowHidden: options.excludeShadowHidden ?? true,
				seenNoteIds: options.seenNoteIds ?? [],
			};

			// Step 1: Get user's recent reactions
			const userReactions = await reactionSimilarityCalculator.getUserRecentReactions(userId, 90);
			if (userReactions.length < 5) {
				logger.debug(`User ${userId} has insufficient reaction history (${userReactions.length})`);
				return [];
			}

			// Step 2: Find similar users
			const similarUsers = await reactionSimilarityCalculator.findSimilarUsers(
				userReactions,
				userId,
				mergedOptions.minCommonReactions,
				mergedOptions.maxSimilarUsers
			);

			if (similarUsers.length === 0) {
				logger.debug(`No similar users found for ${userId}`);
				return [];
			}

			// Step 3: Get candidate notes from similar users
			const candidateNotes = await this.getCandidateNotes(
				similarUsers.map(u => u.userId),
				userId,
				userReactions.map(r => r.noteId),
				mergedOptions.seenNoteIds
			);

			if (candidateNotes.length === 0) {
				logger.debug(`No candidate notes found for ${userId}`);
				return [];
			}

			// Step 4: Calculate recommendation scores
			const scoredRecommendations = await this.scoreRecommendations(
				candidateNotes,
				similarUsers,
				userId,
				mergedOptions
			);

			// Step 5: Sort and return top results
			const topRecommendations = scoredRecommendations
				.sort((a, b) => b.score - a.score)
				.slice(0, limit);

			// Fetch full note objects
			const noteIds = topRecommendations.map(r => r.noteId);
			const notes = await this.fetchNotesByIds(noteIds, userId);

			// Cache results
			await reactionCacheManager.cacheRecommendations(userId, notes);

			const duration = Date.now() - startTime;
			logger.info(`Generated ${notes.length} recommendations for ${userId} in ${duration}ms`);

			return notes;

		} catch (error) {
			logger.error(`Failed to generate recommendations for ${userId}:`, error as Error);
			return [];
		}
	}

	/**
	 * Get candidate notes from similar users
	 */
	private async getCandidateNotes(
		similarUserIds: string[],
		userId: string,
		userReactedNoteIds: string[],
		seenNoteIds: string[]
	): Promise<ReactionWithNote[]> {
		const cutoffDate = new Date(Date.now() - CANDIDATE_NOTES_CUTOFF_DAYS * DAY);
		const excludeIds = new Set([...userReactedNoteIds, ...seenNoteIds]);

		// Get reactions from similar users
		const reactions = await NoteReactions.createQueryBuilder('nr')
			.select(['nr.id', 'nr.userId', 'nr.noteId', 'nr.reaction', 'nr.createdAt'])
			.addSelect(['note.userId', 'note.createdAt', 'note.renoteCount', 'note.repliesCount'])
			.innerJoin('nr.note', 'note')
			.where('nr.userId IN (:...userIds)', { userIds: similarUserIds })
			.andWhere('nr.createdAt > :cutoffDate', { cutoffDate })
			.andWhere('note.visibility = :visibility', { visibility: 'public' })
			.andWhere('note.userId != :currentUserId', { currentUserId: userId }) // Exclude own notes
			.orderBy('nr.createdAt', 'DESC')
			.limit(CANDIDATE_REACTIONS_LIMIT)
			.getRawMany();

		// Filter out already seen notes and user's own reactions
		return reactions
			.filter(r => !excludeIds.has(r.nr_noteId))
			.map(r => ({
				id: r.nr_id,
				userId: r.nr_userId,
				noteId: r.nr_noteId,
				reaction: r.nr_reaction,
				createdAt: r.nr_createdAt,
				note: {
					userId: r.note_userId,
					createdAt: r.note_createdAt,
					renoteCount: r.note_renoteCount,
					repliesCount: r.note_repliesCount,
				},
			}));
	}

	/**
	 * Score recommendations
	 */
	private async scoreRecommendations(
		candidateNotes: ReactionWithNote[],
		similarUsers: SimilarUserScore[],
		userId: string,
		options: Required<RecommendationOptions>
	): Promise<RecommendationScore[]> {
		const userFolloweeIds = await reactionCacheManager.getUserFollowingIds(userId);
		const followeeSet = new Set(userFolloweeIds);

		const similarUserMap = new Map(
			similarUsers.map(u => [u.userId, u])
		);

		const noteScores = new Map<string, RecommendationScore>();

		for (const reaction of candidateNotes) {
			const similarUser = similarUserMap.get(reaction.userId);
			if (!similarUser) continue;

			const baseSimilarity = similarUser.similarityScore;

			// Apply sentiment weight
			const sentiment = await reactionSimilarityCalculator.getReactionSentiment(reaction.reaction);
			const sentimentWeight = reactionSimilarityCalculator.getSentimentWeight(sentiment, {
				positiveWeight: options.positiveSentimentWeight,
				negativeWeight: options.negativeSentimentWeight,
			});

			// Apply follow boost
			const followBoost = followeeSet.has(reaction.note!.userId)
				? options.followBoostMultiplier
				: 1.0;

			// Apply recency decay
			const noteAge = Date.now() - reaction.note!.createdAt.getTime();
			const ageDays = noteAge / (24 * 60 * 60 * 1000);
			const recencyDecay = Math.exp(-ageDays / options.recencyDecayDays);

			// Engagement score (log-scale)
			const engagementScore = Math.log(
				1 + (reaction.note!.renoteCount || 0) +
				(reaction.note!.repliesCount || 0) +
				1 // Assume at least 1 reaction
			);

			// Final score
			const finalScore = baseSimilarity * sentimentWeight * followBoost * recencyDecay * (1 + engagementScore * ENGAGEMENT_WEIGHT);

			// Keep highest score per note
			if (!noteScores.has(reaction.noteId) || noteScores.get(reaction.noteId)!.score < finalScore) {
				noteScores.set(reaction.noteId, {
					noteId: reaction.noteId,
					score: finalScore,
					similarityScore: baseSimilarity,
					isFromFollowing: followeeSet.has(reaction.note!.userId),
					sentiment,
					sentimentWeight,
					followBoost,
					recencyDecay,
					recommendedBy: reaction.userId,
				});
			}
		}

		return Array.from(noteScores.values());
	}

	/**
	 * Fetch full note objects by IDs
	 */
	private async fetchNotesByIds(noteIds: string[], _userId?: string): Promise<Note[]> {
		if (noteIds.length === 0) return [];

		const query = Notes.createQueryBuilder('note')
			.where('note.id IN (:...noteIds)', { noteIds })
			.innerJoinAndSelect('note.user', 'user')
			.leftJoinAndSelect('user.avatar', 'avatar')
			.leftJoinAndSelect('user.banner', 'banner')
			.leftJoinAndSelect('note.reply', 'reply')
			.leftJoinAndSelect('note.renote', 'renote');

		// Note: Full filtering (muted, blocked, shadow-hidden) is applied at the endpoint level
		// to avoid duplicating query logic here

		const notes = await query.getMany();

		// Sort by the original order of noteIds to maintain scoring order
		const noteOrderMap = new Map(noteIds.map((id, index) => [id, index]));
		return notes.sort((a, b) => (noteOrderMap.get(a.id) ?? DEFAULT_SORT_ORDER) - (noteOrderMap.get(b.id) ?? DEFAULT_SORT_ORDER));
	}

	/**
	 * Invalidate user's recommendation cache
	 */
	public async invalidateCache(userId: string): Promise<void> {
		await reactionCacheManager.invalidateCache(userId);
	}

	/**
	 * Get cache statistics for a user
	 */
	public async getCacheStats(userId: string): Promise<{
		profileCached: boolean;
		similarUsersCached: boolean;
		candidatesCached: boolean;
		followingCached: boolean;
	}> {
		return await reactionCacheManager.getCacheStats(userId);
	}
}

// Export singleton instance
export const reactionBasedRecommendationService = ReactionBasedRecommendationService.getInstance();
