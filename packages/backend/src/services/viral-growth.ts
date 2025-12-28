import { Users, Followings, InvitationTrackings } from '@/models/index.js';
import type { User } from '@/models/entities/user.js';
import { createNotification } from '@/services/create-notification.js';
import { InvitationService } from '@/services/invitation-service.js';
import { GrowthNotificationService } from '@/services/growth-notification.js';
import Logger from '@/services/logger.js';
import { viralGrowthChart } from '@/services/chart/index.js';

const logger = new Logger('viralGrowth');

export interface ViralMoment {
	type: 'rapid_growth' | 'milestone_reached' | 'viral_content' | 'network_effect';
	userId: string;
	data: Record<string, any>;
	timestamp: Date;
	amplificationScore: number;
}

export interface GrowthMomentum {
	userId: string;
	followersGained24h: number;
	followingGained24h: number;
	invitationsAccepted24h: number;
	networkGrowthRate: number;
	viralCoefficient: number;
	momentumScore: number;
}

export class ViralGrowthService {
	private static readonly VIRAL_THRESHOLDS = {
		RAPID_FOLLOWER_GAIN: 10, // 10+ followers in 24h
		HIGH_INVITATION_ACCEPTANCE: 3, // 3+ invitations accepted in 24h
		VIRAL_COEFFICIENT_THRESHOLD: 1.5, // Each user brings 1.5+ new users
		MOMENTUM_SCORE_THRESHOLD: 75, // Score above 75 triggers amplification
	};

	/**
	 * Enhance following creation with viral growth triggers
	 */
	static async enhanceFollowingCreation(
		followerId: string,
		followeeId: string,
		isFromInvitation: boolean = false
	): Promise<void> {
		try {
			// Track the viral loop metrics
			await this.trackViralLoop(followerId, followeeId, isFromInvitation);

			// Check for viral moments for both users
			const [followerMomentum, followeeMomentum] = await Promise.all([
				this.calculateGrowthMomentum(followerId),
				this.calculateGrowthMomentum(followeeId),
			]);

			// Detect and amplify viral moments
			await Promise.all([
				this.detectAndAmplifyViralMoments(followerMomentum),
				this.detectAndAmplifyViralMoments(followeeMomentum),
			]);

			// Trigger friend network expansion for high-momentum users
			if (followeeMomentum.momentumScore > this.VIRAL_THRESHOLDS.MOMENTUM_SCORE_THRESHOLD) {
				await this.triggerNetworkExpansion(followeeId, followerId);
			}

			// Update viral coefficient tracking
			await this.updateViralCoefficient(followerId, followeeId, isFromInvitation);

		} catch (error) {
			logger.error('Error in viral growth enhancement:', error as Error);
		}
	}

	/**
	 * Track viral loop metrics in the chart system
	 */
	private static async trackViralLoop(
		followerId: string,
		followeeId: string,
		isFromInvitation: boolean
	): Promise<void> {
		// Track in viral growth chart
		viralGrowthChart.commit({
			'follows.total': 1,
			'follows.fromInvitation': isFromInvitation ? 1 : 0,
			'follows.organic': isFromInvitation ? 0 : 1,
		});

		// Track per-user viral metrics
		viralGrowthChart.commit({
			'userGrowth.followersGained': 1,
		}, followeeId);

		viralGrowthChart.commit({
			'userGrowth.followingCreated': 1,
		}, followerId);
	}

	/**
	 * Calculate growth momentum for a user
	 */
	static async calculateGrowthMomentum(userId: string): Promise<GrowthMomentum> {
		const twentyFourHoursAgo = new Date();
		twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

		// Get followers gained in last 24h
		const followersGained24h = await Followings.createQueryBuilder('following')
			.where('following.followeeId = :userId', { userId })
			.andWhere('following.createdAt >= :since', { since: twentyFourHoursAgo })
			.getCount();

		// Get following created in last 24h
		const followingGained24h = await Followings.createQueryBuilder('following')
			.where('following.followerId = :userId', { userId })
			.andWhere('following.createdAt >= :since', { since: twentyFourHoursAgo })
			.getCount();

		// Get invitations accepted in last 24h
		const invitationsAccepted24h = await InvitationTrackings.createQueryBuilder('invitation')
			.where('invitation.inviterId = :userId', { userId })
			.andWhere('invitation.isAccepted = true')
			.andWhere('invitation.acceptedAt >= :since', { since: twentyFourHoursAgo })
			.getCount();

		// Calculate network growth rate (followers gained / total followers)
		const user = await Users.findOneBy({ id: userId });
		const networkGrowthRate = user?.followersCount 
			? (followersGained24h / Math.max(user.followersCount, 1)) * 100 
			: 0;

		// Calculate viral coefficient (new users brought in / invitations sent)
		const viralCoefficient = await this.calculateViralCoefficient(userId);

		// Calculate momentum score (weighted combination of metrics)
		const momentumScore = this.calculateMomentumScore({
			followersGained24h,
			followingGained24h,
			invitationsAccepted24h,
			networkGrowthRate,
			viralCoefficient,
		});

		return {
			userId,
			followersGained24h,
			followingGained24h,
			invitationsAccepted24h,
			networkGrowthRate,
			viralCoefficient,
			momentumScore,
		};
	}

	/**
	 * Calculate viral coefficient for a user
	 */
	private static async calculateViralCoefficient(userId: string): Promise<number> {
		const thirtyDaysAgo = new Date();
		thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

		// Get invitations sent in last 30 days
		const invitationsSent = await InvitationTrackings.createQueryBuilder('invitation')
			.where('invitation.inviterId = :userId', { userId })
			.andWhere('invitation.createdAt >= :since', { since: thirtyDaysAgo })
			.getCount();

		// Get invitations accepted in last 30 days
		const invitationsAccepted = await InvitationTrackings.createQueryBuilder('invitation')
			.where('invitation.inviterId = :userId', { userId })
			.andWhere('invitation.isAccepted = true')
			.andWhere('invitation.acceptedAt >= :since', { since: thirtyDaysAgo })
			.getCount();

		// Viral coefficient = accepted / sent (how many new users each invitation brings)
		return invitationsSent > 0 ? invitationsAccepted / invitationsSent : 0;
	}

	/**
	 * Calculate momentum score from growth metrics
	 */
	private static calculateMomentumScore(metrics: {
		followersGained24h: number;
		followingGained24h: number;
		invitationsAccepted24h: number;
		networkGrowthRate: number;
		viralCoefficient: number;
	}): number {
		// Weighted scoring system (0-100 scale)
		const followerScore = Math.min(metrics.followersGained24h * 5, 30); // Max 30 points
		const invitationScore = Math.min(metrics.invitationsAccepted24h * 10, 25); // Max 25 points
		const growthRateScore = Math.min(metrics.networkGrowthRate * 2, 20); // Max 20 points
		const viralScore = Math.min(metrics.viralCoefficient * 15, 25); // Max 25 points

		return followerScore + invitationScore + growthRateScore + viralScore;
	}

	/**
	 * Detect and amplify viral moments
	 */
	private static async detectAndAmplifyViralMoments(momentum: GrowthMomentum): Promise<void> {
		const viralMoments: ViralMoment[] = [];

		// Detect rapid follower growth
		if (momentum.followersGained24h >= this.VIRAL_THRESHOLDS.RAPID_FOLLOWER_GAIN) {
			viralMoments.push({
				type: 'rapid_growth',
				userId: momentum.userId,
				data: { followersGained: momentum.followersGained24h },
				timestamp: new Date(),
				amplificationScore: momentum.followersGained24h * 2,
			});
		}

		// Detect high invitation acceptance
		if (momentum.invitationsAccepted24h >= this.VIRAL_THRESHOLDS.HIGH_INVITATION_ACCEPTANCE) {
			viralMoments.push({
				type: 'network_effect',
				userId: momentum.userId,
				data: { invitationsAccepted: momentum.invitationsAccepted24h },
				timestamp: new Date(),
				amplificationScore: momentum.invitationsAccepted24h * 5,
			});
		}

		// Detect viral coefficient milestone
		if (momentum.viralCoefficient >= this.VIRAL_THRESHOLDS.VIRAL_COEFFICIENT_THRESHOLD) {
			viralMoments.push({
				type: 'milestone_reached',
				userId: momentum.userId,
				data: { viralCoefficient: momentum.viralCoefficient },
				timestamp: new Date(),
				amplificationScore: momentum.viralCoefficient * 10,
			});
		}

		// Amplify detected viral moments
		for (const moment of viralMoments) {
			await this.amplifyViralMoment(moment);
		}
	}

	/**
	 * Amplify a viral moment with strategic actions
	 */
	private static async amplifyViralMoment(moment: ViralMoment): Promise<void> {
		try {
			// Send growth milestone notification
			await GrowthNotificationService.createGrowthMilestoneNotification(
				moment.userId,
				moment.type,
				moment.data
			);

			// Track viral moment in charts
			viralGrowthChart.commit({
				'viralMoments.total': 1,
				[`viralMoments.${moment.type}`]: 1,
			});

			// For high-amplification moments, trigger additional growth actions
			if (moment.amplificationScore > 50) {
				await this.triggerHighAmplificationActions(moment);
			}

			logger.info(`Viral moment amplified: ${moment.type} for user ${moment.userId} (score: ${moment.amplificationScore})`);

		} catch (error) {
			logger.error('Error amplifying viral moment:', error as Error);
		}
	}

	/**
	 * Trigger high amplification actions for viral moments
	 */
	private static async triggerHighAmplificationActions(moment: ViralMoment): Promise<void> {
		// Boost user in recommendations for 24 hours
		await this.boostUserInRecommendations(moment.userId, 24);

		// Send social proof notifications to their network
		await this.sendSocialProofToNetwork(moment.userId, moment.type, moment.data);

		// Track high amplification event
		viralGrowthChart.commit({
			'highAmplification.total': 1,
			[`highAmplification.${moment.type}`]: 1,
		});
	}

	/**
	 * Boost user in recommendation algorithms temporarily
	 */
	private static async boostUserInRecommendations(userId: string, hours: number): Promise<void> {
		// This would integrate with the recommendation system
		// For now, we'll track it in the chart system
		viralGrowthChart.commit({
			'recommendationBoosts.total': 1,
		});

		logger.info(`User ${userId} boosted in recommendations for ${hours} hours`);
	}

	/**
	 * Send social proof notifications to user's network
	 */
	private static async sendSocialProofToNetwork(
		userId: string,
		momentType: string,
		data: Record<string, any>
	): Promise<void> {
		// Get user's followers to send social proof notifications
		const followers = await Followings.createQueryBuilder('following')
			.select('following.followerId')
			.where('following.followeeId = :userId', { userId })
			.limit(50) // Limit to prevent spam
			.getMany();

		// Send social proof notifications
		const notifications = followers.map(follower =>
			GrowthNotificationService.createSocialProofNotification(
				follower.followerId,
				{
					type: 'friendGrowth',
					friendId: userId,
					momentType,
					data,
				}
			)
		);

		await Promise.all(notifications);
	}

	/**
	 * Trigger network expansion for high-momentum users
	 */
	private static async triggerNetworkExpansion(
		highMomentumUserId: string,
		newFollowerId: string
	): Promise<void> {
		try {
			// Get mutual connections between the high-momentum user and new follower
			const mutualConnections = await this.getMutualConnections(highMomentumUserId, newFollowerId);

			// Suggest the high-momentum user to mutual connections
			for (const connectionId of mutualConnections.slice(0, 5)) { // Limit to 5
				await GrowthNotificationService.createSocialProofNotification(
					connectionId,
					{
						type: 'mutualFriendGrowth',
						friendId: highMomentumUserId,
						mutualFriendId: newFollowerId,
						data: { type: 'network_expansion' },
					}
				);
			}

			// Track network expansion
			viralGrowthChart.commit({
				'networkExpansion.total': 1,
				'networkExpansion.suggestions': mutualConnections.length,
			});

		} catch (error) {
			logger.error('Error in network expansion:', error as Error);
		}
	}

	/**
	 * Get mutual connections between two users
	 */
	private static async getMutualConnections(userId1: string, userId2: string): Promise<string[]> {
		const mutualFollowers = await Followings.createQueryBuilder('f1')
			.innerJoin('following', 'f2', 'f1.followerId = f2.followerId')
			.select('f1.followerId')
			.where('f1.followeeId = :userId1', { userId1 })
			.andWhere('f2.followeeId = :userId2', { userId2 })
			.limit(10)
			.getMany();

		return mutualFollowers.map(f => f.followerId);
	}

	/**
	 * Update viral coefficient tracking in charts
	 */
	private static async updateViralCoefficient(
		followerId: string,
		followeeId: string,
		isFromInvitation: boolean
	): Promise<void> {
		if (isFromInvitation) {
			// Track successful viral loop completion
			viralGrowthChart.commit({
				'viralCoefficient.completedLoops': 1,
				'viralCoefficient.newUsersFromInvitations': 1,
			});

			// Check if this creates a chain reaction (invited user invites others)
			const invitationsSentByNewUser = await InvitationTrackings.createQueryBuilder('invitation')
				.where('invitation.inviterId = :followerId', { followerId })
				.getCount();

			if (invitationsSentByNewUser > 0) {
				viralGrowthChart.commit({
					'viralCoefficient.chainReactions': 1,
				});
			}
		}
	}

	/**
	 * Automatic friend connection system for accepted invitations
	 */
	static async processInvitationAcceptance(
		inviteCode: string,
		acceptedUserId: string
	): Promise<void> {
		try {
			const invitationService = new InvitationService();
			
			// Accept the invitation and get details
			const invitation = await invitationService.acceptInvitation(
				inviteCode,
				acceptedUserId,
				true // isNewSignup
			);

			if (invitation) {
				// Trigger viral growth tracking
				await this.enhanceFollowingCreation(
					acceptedUserId,
					invitation.inviterId,
					true // isFromInvitation
				);

				// Send viral growth notifications
				await GrowthNotificationService.createFriendJoinedNotification(
					invitation.inviterId,
					await Users.findOneByOrFail({ id: acceptedUserId })
				);

				// Track successful invitation conversion
				viralGrowthChart.commit({
					'invitations.accepted': 1,
					'invitations.newUserSignups': 1,
				});

				logger.info(`Viral loop completed: ${invitation.inviterId} -> ${acceptedUserId}`);
			}

		} catch (error) {
			logger.error('Error processing invitation acceptance:', error as Error);
		}
	}

	/**
	 * Get viral growth analytics for a user
	 */
	static async getViralGrowthAnalytics(userId: string): Promise<{
		momentum: GrowthMomentum;
		recentViralMoments: number;
		networkGrowthTrend: number[];
		viralCoefficientHistory: number[];
	}> {
		const momentum = await this.calculateGrowthMomentum(userId);

		// Get recent viral moments (last 7 days)
		const sevenDaysAgo = new Date();
		sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

		// This would typically come from a viral moments tracking table
		// For now, we'll estimate based on momentum
		const recentViralMoments = momentum.momentumScore > 50 ? 
			Math.floor(momentum.momentumScore / 25) : 0;

		// Get network growth trend (last 7 days)
		const networkGrowthTrend = await this.getNetworkGrowthTrend(userId, 7);

		// Get viral coefficient history (last 30 days)
		const viralCoefficientHistory = await this.getViralCoefficientHistory(userId, 30);

		return {
			momentum,
			recentViralMoments,
			networkGrowthTrend,
			viralCoefficientHistory,
		};
	}

	/**
	 * Get network growth trend for a user
	 */
	private static async getNetworkGrowthTrend(userId: string, days: number): Promise<number[]> {
		const trend: number[] = [];
		
		for (let i = days - 1; i >= 0; i--) {
			const date = new Date();
			date.setDate(date.getDate() - i);
			date.setHours(0, 0, 0, 0);
			
			const nextDate = new Date(date);
			nextDate.setDate(nextDate.getDate() + 1);

			const followersGained = await Followings.createQueryBuilder('following')
				.where('following.followeeId = :userId', { userId })
				.andWhere('following.createdAt >= :start', { start: date })
				.andWhere('following.createdAt < :end', { end: nextDate })
				.getCount();

			trend.push(followersGained);
		}

		return trend;
	}

	/**
	 * Get viral coefficient history for a user
	 */
	private static async getViralCoefficientHistory(userId: string, days: number): Promise<number[]> {
		const history: number[] = [];
		
		for (let i = days - 1; i >= 0; i--) {
			const endDate = new Date();
			endDate.setDate(endDate.getDate() - i);
			
			const startDate = new Date(endDate);
			startDate.setDate(startDate.getDate() - 7); // 7-day rolling window

			const invitationsSent = await InvitationTrackings.createQueryBuilder('invitation')
				.where('invitation.inviterId = :userId', { userId })
				.andWhere('invitation.createdAt >= :start', { start: startDate })
				.andWhere('invitation.createdAt <= :end', { end: endDate })
				.getCount();

			const invitationsAccepted = await InvitationTrackings.createQueryBuilder('invitation')
				.where('invitation.inviterId = :userId', { userId })
				.andWhere('invitation.isAccepted = true')
				.andWhere('invitation.acceptedAt >= :start', { start: startDate })
				.andWhere('invitation.acceptedAt <= :end', { end: endDate })
				.getCount();

			const coefficient = invitationsSent > 0 ? invitationsAccepted / invitationsSent : 0;
			history.push(coefficient);
		}

		return history;
	}
}