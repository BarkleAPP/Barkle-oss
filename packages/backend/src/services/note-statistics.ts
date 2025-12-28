import { Notes, NoteReactions } from '@/models/index.js';
import { redisClient } from '@/db/redis.js';
import { Note } from '@/models/entities/note.js';

export interface NoteStatistics {
	noteId: string;
	repliesCount: number;
	renotesCount: number;
	reactionsCount: number;
	engagementScore: number;
	lastUpdated: Date;
}

export class NoteStatisticsService {
	private static readonly CACHE_PREFIX = 'note_stats:';
	private static readonly CACHE_TTL = 300; // 5 minutes
	private static readonly BATCH_SIZE = 50;

	/**
	 * Get statistics for a single note with caching
	 */
	static async getStatistics(noteId: string): Promise<NoteStatistics> {
		const cacheKey = `${this.CACHE_PREFIX}${noteId}`;
		
		// Try cache first
		const cached = await redisClient.get(cacheKey);
		if (cached) {
			return JSON.parse(cached);
		}

		// Calculate fresh statistics
		const stats = await this.calculateStatistics(noteId);
		
		// Cache the result
		await redisClient.setex(cacheKey, this.CACHE_TTL, JSON.stringify(stats));
		
		return stats;
	}

	/**
	 * Get statistics for multiple notes efficiently
	 */
	static async getBatchStatistics(noteIds: string[]): Promise<Map<string, NoteStatistics>> {
		const results = new Map<string, NoteStatistics>();
		const uncachedIds: string[] = [];

		// Check cache for all notes
		const cacheKeys = noteIds.map(id => `${this.CACHE_PREFIX}${id}`);
		const cachedResults = await redisClient.mget(cacheKeys);

		for (let i = 0; i < noteIds.length; i++) {
			const cached = cachedResults[i];
			if (cached) {
				results.set(noteIds[i], JSON.parse(cached));
			} else {
				uncachedIds.push(noteIds[i]);
			}
		}

		// Calculate statistics for uncached notes in batches
		if (uncachedIds.length > 0) {
			const freshStats = await this.calculateBatchStatistics(uncachedIds);
			
			// Cache the fresh results
			const cacheOperations: Promise<string>[] = [];
			for (const [noteId, stats] of freshStats) {
				results.set(noteId, stats);
				const cacheKey = `${this.CACHE_PREFIX}${noteId}`;
				cacheOperations.push(
					redisClient.setex(cacheKey, this.CACHE_TTL, JSON.stringify(stats))
				);
			}
			
			// Execute cache operations in parallel
			await Promise.all(cacheOperations);
		}

		return results;
	}

	/**
	 * Calculate fresh statistics for a single note
	 */
	private static async calculateStatistics(noteId: string): Promise<NoteStatistics> {
		const [repliesCount, renotesCount, reactionsCount] = await Promise.all([
			this.getRepliesCount(noteId),
			this.getRenotesCount(noteId),
			this.getReactionsCount(noteId)
		]);

		const engagementScore = this.calculateEngagementScore(
			repliesCount,
			renotesCount,
			reactionsCount
		);

		return {
			noteId,
			repliesCount,
			renotesCount,
			reactionsCount,
			engagementScore,
			lastUpdated: new Date()
		};
	}

	/**
	 * Calculate statistics for multiple notes efficiently
	 */
	private static async calculateBatchStatistics(noteIds: string[]): Promise<Map<string, NoteStatistics>> {
		const results = new Map<string, NoteStatistics>();

		// Process in batches to avoid overwhelming the database
		for (let i = 0; i < noteIds.length; i += this.BATCH_SIZE) {
			const batch = noteIds.slice(i, i + this.BATCH_SIZE);
			
			const [repliesCounts, renotesCounts, reactionsCounts] = await Promise.all([
				this.getBatchRepliesCount(batch),
				this.getBatchRenotesCount(batch),
				this.getBatchReactionsCount(batch)
			]);

			for (const noteId of batch) {
				const repliesCount = repliesCounts.get(noteId) || 0;
				const renotesCount = renotesCounts.get(noteId) || 0;
				const reactionsCount = reactionsCounts.get(noteId) || 0;
				
				const engagementScore = this.calculateEngagementScore(
					repliesCount,
					renotesCount,
					reactionsCount
				);

				results.set(noteId, {
					noteId,
					repliesCount,
					renotesCount,
					reactionsCount,
					engagementScore,
					lastUpdated: new Date()
				});
			}
		}

		return results;
	}

	/**
	 * Get replies count for a single note
	 */
	private static async getRepliesCount(noteId: string): Promise<number> {
		const count = await Notes.createQueryBuilder('note')
			.where('note.replyId = :noteId', { noteId })
			.getCount();
		
		return count;
	}

	/**
	 * Get replies count for multiple notes efficiently
	 */
	private static async getBatchRepliesCount(noteIds: string[]): Promise<Map<string, number>> {
		const results = await Notes.createQueryBuilder('note')
			.select('note.replyId', 'replyId')
			.addSelect('COUNT(*)', 'count')
			.where('note.replyId IN (:...noteIds)', { noteIds })
			.groupBy('note.replyId')
			.getRawMany();

		const counts = new Map<string, number>();
		for (const result of results) {
			counts.set(result.replyId, parseInt(result.count));
		}

		return counts;
	}

	/**
	 * Get renotes count for a single note
	 */
	private static async getRenotesCount(noteId: string): Promise<number> {
		const count = await Notes.createQueryBuilder('note')
			.where('note.renoteId = :noteId', { noteId })
			.getCount();
		
		return count;
	}

	/**
	 * Get renotes count for multiple notes efficiently
	 */
	private static async getBatchRenotesCount(noteIds: string[]): Promise<Map<string, number>> {
		const results = await Notes.createQueryBuilder('note')
			.select('note.renoteId', 'renoteId')
			.addSelect('COUNT(*)', 'count')
			.where('note.renoteId IN (:...noteIds)', { noteIds })
			.groupBy('note.renoteId')
			.getRawMany();

		const counts = new Map<string, number>();
		for (const result of results) {
			counts.set(result.renoteId, parseInt(result.count));
		}

		return counts;
	}

	/**
	 * Get reactions count for a single note
	 */
	private static async getReactionsCount(noteId: string): Promise<number> {
		const count = await NoteReactions.createQueryBuilder('reaction')
			.where('reaction.noteId = :noteId', { noteId })
			.getCount();
		
		return count;
	}

	/**
	 * Get reactions count for multiple notes efficiently
	 */
	private static async getBatchReactionsCount(noteIds: string[]): Promise<Map<string, number>> {
		const results = await NoteReactions.createQueryBuilder('reaction')
			.select('reaction.noteId', 'noteId')
			.addSelect('COUNT(*)', 'count')
			.where('reaction.noteId IN (:...noteIds)', { noteIds })
			.groupBy('reaction.noteId')
			.getRawMany();

		const counts = new Map<string, number>();
		for (const result of results) {
			counts.set(result.noteId, parseInt(result.count));
		}

		return counts;
	}

	/**
	 * Calculate engagement score based on different interaction types
	 */
	private static calculateEngagementScore(
		repliesCount: number,
		renotesCount: number,
		reactionsCount: number
	): number {
		// Weighted engagement score
		// Replies are worth more than renotes, renotes more than reactions
		return (repliesCount * 3) + (renotesCount * 2) + (reactionsCount * 1);
	}

	/**
	 * Invalidate cache for a specific note
	 */
	static async invalidateCache(noteId: string): Promise<void> {
		const cacheKey = `${this.CACHE_PREFIX}${noteId}`;
		await redisClient.del(cacheKey);
	}

	/**
	 * Invalidate cache for multiple notes
	 */
	static async invalidateBatchCache(noteIds: string[]): Promise<void> {
		if (noteIds.length === 0) return;
		
		const cacheKeys = noteIds.map(id => `${this.CACHE_PREFIX}${id}`);
		await redisClient.del(...cacheKeys);
	}

	/**
	 * Update statistics when a new reply is created
	 */
	static async onReplyCreated(parentNoteId: string): Promise<void> {
		await this.invalidateCache(parentNoteId);
	}

	/**
	 * Update statistics when a new renote is created
	 */
	static async onRenoteCreated(originalNoteId: string): Promise<void> {
		await this.invalidateCache(originalNoteId);
	}

	/**
	 * Update statistics when a new reaction is created
	 */
	static async onReactionCreated(noteId: string): Promise<void> {
		await this.invalidateCache(noteId);
	}

	/**
	 * Get trending notes based on engagement score using pure ORM
	 */
	static async getTrendingNotes(
		limit: number = 50,
		timeWindow: number = 24 * 60 * 60 * 1000 // 24 hours
	): Promise<Note[]> {
		// Use ORM to get notes with engagement, sorted by recency first
		const recentNotes = await Notes.createQueryBuilder('note')
			.where('note.visibility = :visibility', { visibility: 'public' })
			.andWhere('note.userHost IS NULL')
			.andWhere('note.createdAt > :dateLimit', {
				dateLimit: new Date(Date.now() - timeWindow)
			})
			.orderBy('note.createdAt', 'DESC')
			.limit(limit * 3) // Get more to filter by engagement
			.getMany();

		if (recentNotes.length === 0) return [];

		// Get statistics and sort by engagement
		const noteIds = recentNotes.map(note => note.id);
		const statsMap = await NoteStatisticsService.getBatchStatistics(noteIds);

		// Sort by engagement score
		const notesWithStats = recentNotes
			.map(note => ({
				note,
				stats: statsMap.get(note.id)!
			}))
			.sort((a, b) => b.stats.engagementScore - a.stats.engagementScore);

		return notesWithStats
			.slice(0, limit)
			.map(item => item.note);
	}
}