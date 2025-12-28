import Chart from '../core.js';
import { Users, Followings, InvitationTrackings } from '@/models/index.js';
import { name, schema } from './entities/viral-growth.js';

/**
 * Viral Growth Chart - tracks viral coefficient, growth loops, and momentum
 */
export default class ViralGrowthChart extends Chart<typeof schema> {
	constructor() {
		super(name, schema);
	}

	protected async tickMajor(): Promise<Partial<typeof schema>> {
		const [
			totalUsers,
			totalFollows,
			totalInvitations,
			acceptedInvitations,
		] = await Promise.all([
			Users.createQueryBuilder('user')
				.where('user.host IS NULL')
				.getCount(),
			Followings.createQueryBuilder('following')
				.getCount(),
			InvitationTrackings.createQueryBuilder('invitation')
				.getCount(),
			InvitationTrackings.createQueryBuilder('invitation')
				.where('invitation.isAccepted = true')
				.getCount(),
		]);

		// Calculate overall viral coefficient
		const overallViralCoefficient = totalInvitations > 0 
			? acceptedInvitations / totalInvitations 
			: 0;

		// Calculate growth momentum metrics
		const twentyFourHoursAgo = new Date();
		twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

		const recentFollows = await Followings.createQueryBuilder('following')
			.where('following.createdAt >= :since', { since: twentyFourHoursAgo })
			.getCount();

		const recentInvitationAcceptances = await InvitationTrackings.createQueryBuilder('invitation')
			.where('invitation.isAccepted = true')
			.andWhere('invitation.acceptedAt >= :since', { since: twentyFourHoursAgo })
			.getCount();

		// Calculate average momentum score (simplified)
		const averageMomentumScore = Math.min(
			(recentFollows * 5) + (recentInvitationAcceptances * 10),
			100
		);

		// Count high momentum users (users with significant recent activity)
		const highMomentumUsers = await Users.createQueryBuilder('user')
			.leftJoin('following', 'f1', 'f1.followeeId = user.id AND f1.createdAt >= :since', { since: twentyFourHoursAgo })
			.leftJoin('invitation_tracking', 'inv', 'inv.inviterId = user.id AND inv.acceptedAt >= :since', { since: twentyFourHoursAgo })
			.select('user.id')
			.addSelect('COUNT(DISTINCT f1.id)', 'followersGained')
			.addSelect('COUNT(DISTINCT inv.id)', 'invitationsAccepted')
			.groupBy('user.id')
			.having('COUNT(DISTINCT f1.id) >= 3 OR COUNT(DISTINCT inv.id) >= 1')
			.getCount();

		return {
			'momentum.highScoreUsers': highMomentumUsers,
			'momentum.averageScore': Math.round(averageMomentumScore),
		};
	}

	protected async tickMinor(): Promise<Partial<typeof schema>> {
		// Minor tick focuses on recent activity (last hour)
		const oneHourAgo = new Date();
		oneHourAgo.setHours(oneHourAgo.getHours() - 1);

		const [
			recentFollows,
			recentInvitationsSent,
			recentInvitationsAccepted,
		] = await Promise.all([
			Followings.createQueryBuilder('following')
				.where('following.createdAt >= :since', { since: oneHourAgo })
				.getCount(),
			InvitationTrackings.createQueryBuilder('invitation')
				.where('invitation.createdAt >= :since', { since: oneHourAgo })
				.getCount(),
			InvitationTrackings.createQueryBuilder('invitation')
				.where('invitation.isAccepted = true')
				.andWhere('invitation.acceptedAt >= :since', { since: oneHourAgo })
				.getCount(),
		]);

		return {
			'follows.total': recentFollows,
			'invitations.sent': recentInvitationsSent,
			'invitations.accepted': recentInvitationsAccepted,
		};
	}
}