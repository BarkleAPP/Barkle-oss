import { Notes, NoteReactions, Users, Followings } from '@/models/index.js';
import type { Note } from '@/models/entities/note.js';
import type { User } from '@/models/entities/user.js';
import { createNotification } from '@/services/create-notification.js';
import { GrowthNotificationService } from '@/services/growth-notification.js';
import { viralGrowthChart } from '@/services/chart/index.js';
import Logger from '@/services/logger.js';

const logger = new Logger('contentAmplification');

export interface ViralContent {
	noteId: string;
	userId: string;
	engagementScore: number;
	viralityScore: number;
	amplificationLevel: 'low' | 'medium' | 'high' | 'viral';
	metrics: {
		reactions: number;
		reposts: number;
		replies: number;
		engagementRate: number;
		velocityScore: number;
	};
}

export interface CommunityMilestone {
	type: 'user_milestone' | 'content_milestone' | 'network_milestone';
	userId: string;
	milestone: string;
	data: Record<string, any>;
	recognitionLevel: 'bronze' | 'silver' | 'gold' | 'platinum';
}

export class ContentAmplificationService {
	private static readonly VIRAL_THRESHOLDS = {
		LOW_ENGAGEMENT: 5,      // 5+ reactions
		MEDIUM_ENGAGEMENT: 15,  // 15+ reactions
		HIGH_ENGAGEMENT: 50,    // 50+ reactions
		VIRAL_ENGAGEMENT: 100,  // 100+ reactions
		VELOCITY_THRESHOLD: 10, // reactions per hour
	};

	private static readonly AMPLIFICATION_MULTIPLIERS = {
		low: 1.2,
		medium: 1.5,
		high: 2.0,
		viral: 3.0,
	};

	/**
	 * Detect and amplify viral content moments
	 */
	static async detectViralContent(noteId: string): Promise<ViralContent | null> {
		try {
			const note = await Notes.findOne({
				where: { id: noteId },
				relations: ['user'],
			});

			if (!note) return null;

			const metrics = await this.calculateContentMetrics(noteId);
			const viralityScore = this.calculateViralityScore(metrics);
			const amplificationLevel = this.determineAmplificationLevel(metrics);

			const viralContent: ViralContent = {
				noteId,
				userId: note.userId,
				engagementScore: metrics.reactions + metrics.reposts + metrics.replies,
				viralityScore,
				amplificationLevel,
				metrics,
			};

			// Amplify if it meets thresholds
			if (amplificationLevel !== 'low') {
				await this.amplifyContent(viralContent);
			}

			return viralContent;

		} catch (error) {
			logger.error('Error detecting viral content:', error as Error);
			return null;
		}
	}

	/**
	 * Calculate comprehensive content metrics
	 */
	private static async calculateContentMetrics(noteId: string): Promise<ViralContent['metrics']> {
		const [reactions, reposts, replies] = await Promise.all([
			NoteReactions.countBy({ noteId }),
			Notes.countBy({ renoteId: noteId }),
			Notes.countBy({ replyId: noteId }),
		]);

		const note = await Notes.findOneBy({ id: noteId });
		const ageInHours = note ? (Date.now() - note.createdAt.getTime()) / (1000 * 60 * 60) : 1;
		
		// Calculate engagement rate (total interactions / age in hours)
		const totalEngagement = reactions + reposts + replies;
		const engagementRate = totalEngagement / Math.max(ageInHours, 0.1);
		
		// Calculate velocity score (recent engagement rate)
		const oneHourAgo = new Date();
		oneHourAgo.setHours(oneHourAgo.getHours() - 1);
		
		const recentReactions = await NoteReactions.createQueryBuilder('reaction')
			.where('reaction.noteId = :noteId', { noteId })
			.andWhere('reaction.createdAt >= :since', { since: oneHourAgo })
			.getCount();

		const velocityScore = recentReactions; // reactions in last hour

		return {
			reactions,
			reposts,
			replies,
			engagementRate,
			velocityScore,
		};
	}

	/**
	 * Calculate virality score based on multiple factors
	 */
	private static calculateViralityScore(metrics: ViralContent['metrics']): number {
		// Weighted scoring system (0-100 scale)
		const reactionScore = Math.min(metrics.reactions * 2, 40); // Max 40 points
		const repostScore = Math.min(metrics.reposts * 5, 25); // Max 25 points
		const replyScore = Math.min(metrics.replies * 3, 20); // Max 20 points
		const velocityScore = Math.min(metrics.velocityScore * 1.5, 15); // Max 15 points

		return reactionScore + repostScore + replyScore + velocityScore;
	}

	/**
	 * Determine amplification level based on metrics
	 */
	private static determineAmplificationLevel(metrics: ViralContent['metrics']): ViralContent['amplificationLevel'] {
		const totalEngagement = metrics.reactions + metrics.reposts + metrics.replies;

		if (totalEngagement >= this.VIRAL_THRESHOLDS.VIRAL_ENGAGEMENT || 
			metrics.velocityScore >= this.VIRAL_THRESHOLDS.VELOCITY_THRESHOLD * 2) {
			return 'viral';
		} else if (totalEngagement >= this.VIRAL_THRESHOLDS.HIGH_ENGAGEMENT ||
				   metrics.velocityScore >= this.VIRAL_THRESHOLDS.VELOCITY_THRESHOLD) {
			return 'high';
		} else if (totalEngagement >= this.VIRAL_THRESHOLDS.MEDIUM_ENGAGEMENT) {
			return 'medium';
		} else {
			return 'low';
		}
	}

	/**
	 * Amplify viral content through strategic actions
	 */
	private static async amplifyContent(viralContent: ViralContent): Promise<void> {
		try {
			// Notify the content creator
			await this.notifyContentCreator(viralContent);

			// Amplify to the creator's network
			await this.amplifyToNetwork(viralContent);

			// Track amplification metrics
			await this.trackAmplification(viralContent);

			// For high-viral content, trigger additional amplification
			if (viralContent.amplificationLevel === 'viral') {
				await this.triggerViralAmplification(viralContent);
			}

			logger.info(`Content amplified: ${viralContent.noteId} (level: ${viralContent.amplificationLevel})`);

		} catch (error) {
			logger.error('Error amplifying content:', error as Error);
		}
	}

	/**
	 * Notify content creator about viral moment
	 */
	private static async notifyContentCreator(viralContent: ViralContent): Promise<void> {
		const messages = {
			medium: 'Your post is getting attention! 📈',
			high: 'Your post is trending! 🔥',
			viral: 'Your post is going viral! 🚀',
		};

		const message = messages[viralContent.amplificationLevel] || messages.medium;

		await GrowthNotificationService.createSocialProofNotification(
			viralContent.userId,
			{
				type: 'contentTrending',
				noteId: viralContent.noteId,
				engagementCount: viralContent.engagementScore,
				amplificationLevel: viralContent.amplificationLevel,
				message,
			}
		);
	}

	/**
	 * Amplify content to creator's network
	 */
	private static async amplifyToNetwork(viralContent: ViralContent): Promise<void> {
		// Get creator's followers
		const followers = await Followings.createQueryBuilder('following')
			.select('following.followerId')
			.where('following.followeeId = :userId', { userId: viralContent.userId })
			.limit(100) // Limit to prevent spam
			.getMany();

		// Send social proof notifications to followers
		const notifications = followers.slice(0, 20).map(follower => // Limit to 20 for high engagement
			GrowthNotificationService.createSocialProofNotification(
				follower.followerId,
				{
					type: 'friendActivity',
					friendId: viralContent.userId,
					noteId: viralContent.noteId,
					amplificationLevel: viralContent.amplificationLevel,
					engagementCount: viralContent.engagementScore,
				}
			)
		);

		await Promise.all(notifications);
	}

	/**
	 * Track amplification metrics
	 */
	private static async trackAmplification(viralContent: ViralContent): Promise<void> {
		viralGrowthChart.commit({
			'contentAmplification.total': 1,
			[`contentAmplification.${viralContent.amplificationLevel}`]: 1,
			'contentAmplification.engagementScore': viralContent.engagementScore,
		});
	}

	/**
	 * Trigger viral amplification for extremely popular content
	 */
	private static async triggerViralAmplification(viralContent: ViralContent): Promise<void> {
		// Boost content creator in recommendations
		await this.boostCreatorInRecommendations(viralContent.userId, 48); // 48 hours

		// Send broader network notifications
		await this.amplifyToBroaderNetwork(viralContent);

		// Track viral amplification
		viralGrowthChart.commit({
			'viralAmplification.total': 1,
			'viralAmplification.contentBoosts': 1,
		});
	}

	/**
	 * Boost content creator in recommendation algorithms
	 */
	private static async boostCreatorInRecommendations(userId: string, hours: number): Promise<void> {
		// This would integrate with the recommendation system
		// For now, we'll track it in the chart system
		viralGrowthChart.commit({
			'creatorBoosts.total': 1,
			'creatorBoosts.duration': hours,
		});

		logger.info(`Creator ${userId} boosted in recommendations for ${hours} hours`);
	}

	/**
	 * Amplify to broader network beyond direct followers
	 */
	private static async amplifyToBroaderNetwork(viralContent: ViralContent): Promise<void> {
		// Get followers of followers (second-degree connections)
		const secondDegreeConnections = await Followings.createQueryBuilder('f1')
			.innerJoin('following', 'f2', 'f1.followeeId = f2.followerId')
			.select('f2.followeeId')
			.where('f1.followerId = :userId', { userId: viralContent.userId })
			.andWhere('f2.followeeId != :userId', { userId: viralContent.userId })
			.limit(50)
			.getMany();

		// Send selective notifications to second-degree connections
		const notifications = secondDegreeConnections.slice(0, 10).map(connection =>
			GrowthNotificationService.createSocialProofNotification(
				connection.followeeId,
				{
					type: 'viralContent',
					creatorId: viralContent.userId,
					noteId: viralContent.noteId,
					amplificationLevel: viralContent.amplificationLevel,
				}
			)
		);

		await Promise.all(notifications);
	}

	/**
	 * Detect and recognize community milestones
	 */
	static async detectCommunityMilestones(userId: string): Promise<CommunityMilestone[]> {
		const milestones: CommunityMilestone[] = [];

		try {
			const user = await Users.findOneBy({ id: userId });
			if (!user) return milestones;

			// Check follower milestones
			const followerMilestones = await this.checkFollowerMilestones(user);
			milestones.push(...followerMilestones);

			// Check content milestones
			const contentMilestones = await this.checkContentMilestones(user);
			milestones.push(...contentMilestones);

			// Check network milestones
			const networkMilestones = await this.checkNetworkMilestones(user);
			milestones.push(...networkMilestones);

			// Send recognition for achieved milestones
			for (const milestone of milestones) {
				await this.sendMilestoneRecognition(milestone);
			}

			return milestones;

		} catch (error) {
			logger.error('Error detecting community milestones:', error as Error);
			return milestones;
		}
	}

	/**
	 * Check follower-based milestones
	 */
	private static async checkFollowerMilestones(user: User): Promise<CommunityMilestone[]> {
		const milestones: CommunityMilestone[] = [];
		const followerCount = user.followersCount;

		const followerThresholds = [
			{ count: 10, level: 'bronze' as const, milestone: 'first_10_followers' },
			{ count: 50, level: 'silver' as const, milestone: 'growing_community' },
			{ count: 100, level: 'gold' as const, milestone: 'popular_creator' },
			{ count: 500, level: 'platinum' as const, milestone: 'influencer_status' },
		];

		for (const threshold of followerThresholds) {
			if (followerCount >= threshold.count && followerCount < threshold.count + 5) {
				// Only trigger if recently crossed threshold (within 5 followers)
				milestones.push({
					type: 'user_milestone',
					userId: user.id,
					milestone: threshold.milestone,
					data: { followerCount, threshold: threshold.count },
					recognitionLevel: threshold.level,
				});
			}
		}

		return milestones;
	}

	/**
	 * Check content-based milestones
	 */
	private static async checkContentMilestones(user: User): Promise<CommunityMilestone[]> {
		const milestones: CommunityMilestone[] = [];

		// Check total notes milestone
		const noteCount = await Notes.countBy({ userId: user.id });
		if (noteCount === 10 || noteCount === 50 || noteCount === 100) {
			milestones.push({
				type: 'content_milestone',
				userId: user.id,
				milestone: 'prolific_creator',
				data: { noteCount },
				recognitionLevel: noteCount >= 100 ? 'gold' : noteCount >= 50 ? 'silver' : 'bronze',
			});
		}

		// Check viral content milestone
		const recentNotes = await Notes.find({
			where: { userId: user.id },
			order: { createdAt: 'DESC' },
			take: 10,
		});

		for (const note of recentNotes) {
			const reactionCount = await NoteReactions.countBy({ noteId: note.id });
			if (reactionCount >= 50) { // Viral threshold
				milestones.push({
					type: 'content_milestone',
					userId: user.id,
					milestone: 'viral_creator',
					data: { noteId: note.id, reactionCount },
					recognitionLevel: reactionCount >= 100 ? 'platinum' : 'gold',
				});
				break; // Only one viral milestone at a time
			}
		}

		return milestones;
	}

	/**
	 * Check network-based milestones
	 */
	private static async checkNetworkMilestones(user: User): Promise<CommunityMilestone[]> {
		const milestones: CommunityMilestone[] = [];

		// Check mutual connections milestone
		const mutualConnections = await Followings.createQueryBuilder('f1')
			.innerJoin('following', 'f2', 'f1.followeeId = f2.followerId AND f2.followeeId = f1.followerId')
			.where('f1.followerId = :userId', { userId: user.id })
			.getCount();

		if (mutualConnections === 5 || mutualConnections === 20 || mutualConnections === 50) {
			milestones.push({
				type: 'network_milestone',
				userId: user.id,
				milestone: 'connected_community',
				data: { mutualConnections },
				recognitionLevel: mutualConnections >= 50 ? 'platinum' : mutualConnections >= 20 ? 'gold' : 'silver',
			});
		}

		return milestones;
	}

	/**
	 * Send milestone recognition notification
	 */
	private static async sendMilestoneRecognition(milestone: CommunityMilestone): Promise<void> {
		const recognitionMessages = {
			first_10_followers: '🌟 You reached 10 followers! Your community is growing',
			growing_community: '🚀 50 followers! You\'re building something special',
			popular_creator: '🔥 100 followers! You\'re becoming a popular creator',
			influencer_status: '👑 500 followers! You\'re now a community influencer',
			prolific_creator: '✍️ You\'re a prolific creator! Keep sharing your thoughts',
			viral_creator: '🚀 Your content went viral! You\'re inspiring others',
			connected_community: '🤝 You\'re building strong connections in the community',
		};

		const message = recognitionMessages[milestone.milestone] || 'Congratulations on your achievement!';

		await GrowthNotificationService.createGrowthMilestoneNotification(
			milestone.userId,
			'milestone_reached',
			{
				milestone: milestone.milestone,
				recognitionLevel: milestone.recognitionLevel,
				message,
				...milestone.data,
			}
		);

		// Track milestone recognition
		viralGrowthChart.commit({
			'milestoneRecognition.total': 1,
			[`milestoneRecognition.${milestone.type}`]: 1,
			[`milestoneRecognition.${milestone.recognitionLevel}`]: 1,
		});
	}

	/**
	 * Get trending content for amplification
	 */
	static async getTrendingContent(limit: number = 10): Promise<ViralContent[]> {
		const trendingContent: ViralContent[] = [];

		try {
			// Get recent notes with high engagement
			const recentNotes = await Notes.createQueryBuilder('note')
				.leftJoin('note_reaction', 'reaction', 'reaction.noteId = note.id')
				.select('note.id')
				.addSelect('COUNT(reaction.id)', 'reactionCount')
				.where('note.createdAt >= :since', { 
					since: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
				})
				.groupBy('note.id')
				.having('COUNT(reaction.id) >= :threshold', { 
					threshold: this.VIRAL_THRESHOLDS.MEDIUM_ENGAGEMENT 
				})
				.orderBy('COUNT(reaction.id)', 'DESC')
				.limit(limit)
				.getRawMany();

			// Analyze each trending note
			for (const noteData of recentNotes) {
				const viralContent = await this.detectViralContent(noteData.note_id);
				if (viralContent) {
					trendingContent.push(viralContent);
				}
			}

			return trendingContent;

		} catch (error) {
			logger.error('Error getting trending content:', error as Error);
			return trendingContent;
		}
	}

	/**
	 * Process content amplification queue
	 */
	static async processAmplificationQueue(): Promise<void> {
		try {
			const trendingContent = await this.getTrendingContent(20);
			
			for (const content of trendingContent) {
				if (content.amplificationLevel !== 'low') {
					await this.amplifyContent(content);
				}
			}

			logger.info(`Processed ${trendingContent.length} trending content items`);

		} catch (error) {
			logger.error('Error processing amplification queue:', error as Error);
		}
	}
}