import { Notes, NoteReactions, Followings, Users } from '@/models/index.js';
import { User } from '@/models/entities/user.js';
import { Note } from '@/models/entities/note.js';
import { In, MoreThan } from 'typeorm';
import { DAY, HOUR } from '@/const.js';
import { ActiveUsersService } from './active-users-service.js';

export interface SocialProofMetadata {
	engagementScore: number;
	trendingScore: number;
	recentEngagement: {
		reactions: number;
		renotes: number;
		replies: number;
		timeframe: string;
	};
	socialValidation: {
		friendsWhoReacted: number;
		friendsWhoRenoted: number;
		popularityIndicator: 'low' | 'medium' | 'high' | 'viral';
	};
	activityIndicators: {
		isHot: boolean;
		isRising: boolean;
		isTrending: boolean;
		momentumScore: number;
	};
}

export interface UserSocialProof {
	mutualConnections: number;
	isContactMatch: boolean;
	followedByFriends: boolean;
	recentActivity: {
		notesCount: number;
		engagementReceived: number;
		timeframe: string;
	};
	socialStatus: {
		isPopular: boolean;
		isActive: boolean;
		engagementRate: number;
	};
}

export class SocialProofService {
	// Cache for trending calculations (noteId -> {score, timestamp})
	private static trendingCache = new Map<string, { score: number; timestamp: number; age: number }>();
	private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
	private static readonly TRENDING_TIMEFRAME = 7 * 24 * HOUR; // 7 days for trending consideration
	private static readonly TRENDING_WINDOW = 24 * HOUR; // 24 hours for active trending
	static async calculateNoteSocialProof(noteId: string, viewerId?: string): Promise<SocialProofMetadata> {
		const note = await Notes.findOneBy({ id: noteId });
		if (!note) {
			throw new Error('Note not found');
		}

		// Calculate engagement score based on reactions, renotes, and replies
		const engagementScore = await this.calculateEngagementScore(note);

		// Calculate trending score based on recent activity
		const trendingScore = await this.calculateTrendingScore(note);

		// Get recent engagement data (last 24 hours)
		const recentEngagement = await this.getRecentEngagement(noteId);

		// Calculate social validation if viewer is provided
		const socialValidation = viewerId
			? await this.calculateSocialValidation(noteId, viewerId)
			: { friendsWhoReacted: 0, friendsWhoRenoted: 0, popularityIndicator: 'low' as const };

		// Calculate activity indicators
		const activityIndicators = await this.calculateActivityIndicators(note, engagementScore, trendingScore);

		return {
			engagementScore,
			trendingScore,
			recentEngagement,
			socialValidation,
			activityIndicators,
		};
	}

	/**
	 * Calculate social proof metadata for a user
	 */
	static async calculateUserSocialProof(userId: string, viewerId?: string): Promise<UserSocialProof> {
		const user = await Users.findOneBy({ id: userId });
		if (!user) {
			throw new Error('User not found');
		}

		// Calculate mutual connections if viewer is provided
		const mutualConnections = viewerId && viewerId !== userId
			? await this.getMutualConnectionsCount(userId, viewerId)
			: 0;

		// Check if user is a contact match (this would be set from contact import)
		const isContactMatch = false; // This would be determined by ContactImport service

		// Check if followed by friends
		const followedByFriends = mutualConnections > 0;

		// Get recent activity data
		const recentActivity = await this.getUserRecentActivity(userId);

		// Calculate social status
		const socialStatus = await this.calculateUserSocialStatus(user, recentActivity);

		return {
			mutualConnections,
			isContactMatch,
			followedByFriends,
			recentActivity,
			socialStatus,
		};
	}

	/**
	 * Get trending notes with social proof metadata
	 */
	static async getTrendingNotes(limit: number = 20, viewerId?: string): Promise<(Note & { socialProof: SocialProofMetadata })[]> {
		const now = Date.now();

		// Get notes from the last 7 days that could potentially be trending
		const cutoffTime = new Date(now - this.TRENDING_TIMEFRAME);

		const notes = await Notes.createQueryBuilder('note')
			.where('note.createdAt > :cutoff', { cutoff: cutoffTime })
			.andWhere('note.visibility = :visibility', { visibility: 'public' })
			.andWhere('note.localOnly = false')
			// Only consider notes with some engagement to reduce processing
			.andWhere('(note.renoteCount + COALESCE(jsonb_array_length(jsonb_object_keys(note.reactions)::jsonb), 0) + note.repliesCount) > 0')
			.orderBy('note.createdAt', 'DESC') // Get newest first for processing
			.limit(200) // Get more candidates to filter properly
			.getMany();

		// Calculate trending scores with caching
		const notesWithScores = await Promise.all(
			notes.map(async (note) => {
				const cacheKey = `trending_${note.id}`;
				const cached = this.trendingCache.get(cacheKey);

				let trendingScore: number;
				const ageInHours = (now - note.createdAt.getTime()) / HOUR;

				// Use cached score if it's recent and note age hasn't changed much
				if (cached && (now - cached.timestamp) < this.CACHE_TTL && Math.abs(cached.age - ageInHours) < 1) {
					trendingScore = cached.score;
				} else {
					// Calculate fresh trending score
					trendingScore = await this.calculateTrendingScore(note);

					// Cache the result
					this.trendingCache.set(cacheKey, {
						score: trendingScore,
						timestamp: now,
						age: ageInHours
					});
				}

				return { note, trendingScore, ageInHours };
			})
		);

		// Clean up old cache entries periodically
		if (this.trendingCache.size > 1000) {
			const cutoff = now - this.CACHE_TTL;
			for (const [key, value] of this.trendingCache.entries()) {
				if (value.timestamp < cutoff) {
					this.trendingCache.delete(key);
				}
			}
		}

		// Filter to notes that are actively trending (high score and recent enough)
		const activelyTrending = notesWithScores
			.filter(item => {
				// Only include notes with meaningful trending scores
				const isTrending = item.trendingScore > 5;
				// And within the active trending window (24 hours)
				const isRecent = item.ageInHours <= (this.TRENDING_WINDOW / HOUR);
				return isTrending && isRecent;
			})
			.sort((a, b) => b.trendingScore - a.trendingScore)
			.slice(0, limit * 2); // Get more for social proof calculation

		// Calculate social proof for trending candidates
		const notesWithProof = await Promise.all(
			activelyTrending.map(async (item) => {
				const socialProof = await this.calculateNoteSocialProof(item.note.id, viewerId);
				return { ...item.note, socialProof };
			})
		);

		// Final sort by trending score and return top results
		return notesWithProof
			.sort((a, b) => b.socialProof.trendingScore - a.socialProof.trendingScore)
			.slice(0, limit);
	}

	/**
	 * Calculate engagement score for a note
	 */
	private static calculateEngagementScore(note: Note): number {
		const reactionCount = Object.values(note.reactions).reduce((sum, count) => sum + count, 0);
		const totalEngagement = reactionCount + note.renoteCount + note.repliesCount;

		// Weight different types of engagement
		const weightedScore = (reactionCount * 1) + (note.renoteCount * 2) + (note.repliesCount * 1.5);

		// Factor in note age (newer notes get slight boost)
		const ageInHours = (Date.now() - note.createdAt.getTime()) / HOUR;
		const ageFactor = Math.max(0.1, 1 - (ageInHours / 168)); // Decay over a week

		return Math.round(weightedScore * ageFactor);
	}

	/**
	 * Calculate trending score based on engagement velocity (scaled to active users)
	 */
	private static async calculateTrendingScore(note: Note): Promise<number> {
		const ageInHours = (Date.now() - note.createdAt.getTime()) / HOUR;

		// Get recent reactions (last 6 hours)
		const recentReactions = await NoteReactions.count({
			where: {
				noteId: note.id,
				createdAt: MoreThan(new Date(Date.now() - (6 * HOUR))),
			},
		});

		// Calculate total engagement and velocity
		const totalEngagement = Object.values(note.reactions).reduce((sum, count) => sum + count, 0) +
			note.renoteCount + note.repliesCount;

		const velocity = ageInHours > 0 ? totalEngagement / ageInHours : totalEngagement;

		// Get recent engagement for more accurate trending
		const recentRenotes = await Notes.count({
			where: { renoteId: note.id, createdAt: MoreThan(new Date(Date.now() - (6 * HOUR))) },
		});

		const recentReplies = await Notes.count({
			where: { replyId: note.id, createdAt: MoreThan(new Date(Date.now() - (6 * HOUR))) },
		});

		const recentEngagement = recentReactions + recentRenotes + recentReplies;

		// Use scaled trending score that adapts to active user count
		const scaledScore = await ActiveUsersService.calculateScaledTrendingScore({
			totalEngagement,
			velocity,
			ageInHours,
			recentEngagement,
		});

		return scaledScore;
	}

	/**
	 * Get recent engagement data for a note
	 */
	private static async getRecentEngagement(noteId: string) {
		const cutoff = new Date(Date.now() - DAY);

		const recentReactions = await NoteReactions.count({
			where: { noteId, createdAt: MoreThan(cutoff) },
		});

		// For renotes and replies, we'd need to query the notes table
		// This is a simplified version
		const recentRenotes = await Notes.count({
			where: { renoteId: noteId, createdAt: MoreThan(cutoff) },
		});

		const recentReplies = await Notes.count({
			where: { replyId: noteId, createdAt: MoreThan(cutoff) },
		});

		return {
			reactions: recentReactions,
			renotes: recentRenotes,
			replies: recentReplies,
			timeframe: '24h',
		};
	}

	/**
	 * Calculate social validation metrics
	 */
	private static async calculateSocialValidation(noteId: string, viewerId: string) {
		// Get viewer's following list
		const following = await Followings.find({
			where: { followerId: viewerId },
			select: ['followeeId'],
		});
		const followingIds = following.map(f => f.followeeId);

		if (followingIds.length === 0) {
			return {
				friendsWhoReacted: 0,
				friendsWhoRenoted: 0,
				popularityIndicator: 'low' as const,
			};
		}

		// Count friends who reacted
		const friendsWhoReacted = await NoteReactions.count({
			where: {
				noteId,
				userId: In(followingIds),
			},
		});

		// Count friends who renoted
		const friendsWhoRenoted = await Notes.count({
			where: {
				renoteId: noteId,
				userId: In(followingIds),
			},
		});

		// Determine popularity indicator
		const note = await Notes.findOneBy({ id: noteId });
		const totalEngagement = note ?
			Object.values(note.reactions).reduce((sum, count) => sum + count, 0) +
			note.renoteCount + note.repliesCount : 0;

		let popularityIndicator: 'low' | 'medium' | 'high' | 'viral';
		if (totalEngagement >= 100) popularityIndicator = 'viral';
		else if (totalEngagement >= 25) popularityIndicator = 'high';
		else if (totalEngagement >= 5) popularityIndicator = 'medium';
		else popularityIndicator = 'low';

		return {
			friendsWhoReacted,
			friendsWhoRenoted,
			popularityIndicator,
		};
	}

	/**
	 * Calculate activity indicators for a note (scaled to active users)
	 */
	private static async calculateActivityIndicators(note: Note, engagementScore: number, trendingScore: number) {
		const ageInHours = (Date.now() - note.createdAt.getTime()) / HOUR;

		// Get total engagement
		const totalEngagement = Object.values(note.reactions).reduce((sum, count) => sum + count, 0) +
			note.renoteCount + note.repliesCount;

		// Calculate velocity
		const velocity = ageInHours > 0 ? totalEngagement / ageInHours : totalEngagement;

		// Get recent engagement (last 6 hours)
		const recentReactions = await NoteReactions.count({
			where: {
				noteId: note.id,
				createdAt: MoreThan(new Date(Date.now() - (6 * HOUR))),
			},
		});

		const recentRenotes = await Notes.count({
			where: { renoteId: note.id, createdAt: MoreThan(new Date(Date.now() - (6 * HOUR))) },
		});

		const recentReplies = await Notes.count({
			where: { replyId: note.id, createdAt: MoreThan(new Date(Date.now() - (6 * HOUR))) },
		});

		const recentEngagement = recentReactions + recentRenotes + recentReplies;

		// Use scaled thresholds based on active users
		const metrics = { totalEngagement, velocity, ageInHours, recentEngagement };
		const isHot = await ActiveUsersService.isHot(metrics);
		const isTrending = await ActiveUsersService.isTrending(metrics);

		// Get thresholds for "rising" calculation
		const thresholds = await ActiveUsersService.getDynamicTrendingThresholds();
		const isRising = trendingScore > (10 * thresholds.scalingFactor) && ageInHours < 24;

		// Momentum score combines recency and engagement
		const momentumScore = Math.round(trendingScore * Math.max(0.1, 1 - (ageInHours / 48)));

		return {
			isHot,
			isRising,
			isTrending,
			momentumScore,
		};
	}

	/**
	 * Get mutual connections count between two users
	 */
	private static async getMutualConnectionsCount(userId: string, viewerId: string): Promise<number> {
		return await Followings.createQueryBuilder('f1')
			.innerJoin('following', 'f2', 'f1.followeeId = f2.followerId')
			.where('f1.followerId = :viewerId', { viewerId })
			.andWhere('f2.followeeId = :userId', { userId })
			.getCount();
	}

	/**
	 * Get user's recent activity data
	 */
	private static async getUserRecentActivity(userId: string) {
		const cutoff = new Date(Date.now() - (7 * DAY)); // Last week

		const notesCount = await Notes.count({
			where: { userId, createdAt: MoreThan(cutoff) },
		});

		// Calculate engagement received on recent notes
		const recentNotes = await Notes.find({
			where: { userId, createdAt: MoreThan(cutoff) },
			select: ['id', 'reactions', 'renoteCount', 'repliesCount'],
		});

		const engagementReceived = recentNotes.reduce((total, note) => {
			const reactionCount = Object.values(note.reactions).reduce((sum, count) => sum + count, 0);
			return total + reactionCount + note.renoteCount + note.repliesCount;
		}, 0);

		return {
			notesCount,
			engagementReceived,
			timeframe: '7d',
		};
	}

	/**
	 * Calculate user's social status indicators
	 */
	private static async calculateUserSocialStatus(user: User, recentActivity: any) {
		// User is popular if they have many followers
		const isPopular = user.followersCount > 100;

		// User is active if they posted recently
		const isActive = recentActivity.notesCount > 0;

		// Calculate engagement rate
		const engagementRate = recentActivity.notesCount > 0
			? recentActivity.engagementReceived / recentActivity.notesCount
			: 0;

		return {
			isPopular,
			isActive,
			engagementRate: Math.round(engagementRate * 100) / 100, // Round to 2 decimal places
		};
	}

	/**
	 * Batch calculate social proof for multiple notes (for timeline optimization)
	 */
	static async batchCalculateNoteSocialProof(noteIds: string[], viewerId?: string): Promise<Map<string, SocialProofMetadata>> {
		const results = new Map<string, SocialProofMetadata>();

		// Process in batches to avoid overwhelming the database
		const batchSize = 10;
		for (let i = 0; i < noteIds.length; i += batchSize) {
			const batch = noteIds.slice(i, i + batchSize);
			const batchResults = await Promise.all(
				batch.map(async (noteId) => {
					try {
						const socialProof = await this.calculateNoteSocialProof(noteId, viewerId);
						return { noteId, socialProof };
					} catch (error) {
						console.error(`Failed to calculate social proof for note ${noteId}:`, error);
						return null;
					}
				})
			);

			batchResults.forEach(result => {
				if (result) {
					results.set(result.noteId, result.socialProof);
				}
			});
		}

		return results;
	}
}