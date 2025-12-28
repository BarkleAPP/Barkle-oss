import define from '../../define.js';
import { InvitationService } from '@/services/invitation-service.js';
import { DriveFiles } from '@/models/index.js';

export const meta = {
	tags: ['invitations', 'growth'],
	requireCredential: true,
	kind: 'read:invitations',

	errors: {
		statsRetrievalFailed: {
			message: 'Failed to retrieve invitation statistics',
			code: 'STATS_RETRIEVAL_FAILED',
			id: 'invite-009',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		includeDetails: {
			type: 'boolean',
			default: false,
		},
		limit: {
			type: 'integer',
			minimum: 1,
			maximum: 50,
			default: 10,
		},
	},
} as const;

export default define(meta, paramDef, async (ps, user) => {
	try {
		const invitationService = new InvitationService();

		// Get invitation statistics
		const stats = await invitationService.getInvitationStats(user.id);

		let detailedInvitations = [];

		if (ps.includeDetails) {
			// Get recent invitations with details
			const recentInvitations = await invitationService.getInvitationsByInviter(user.id);

			detailedInvitations = await Promise.all(recentInvitations
				.slice(0, ps.limit)
				.map(async (invitation: any) => {
					// Get proper avatar URL for accepted user
					let acceptedUserAvatarUrl = null;
					if (invitation.acceptedUser?.avatarId) {
						const avatar = await DriveFiles.findOneBy({ id: invitation.acceptedUser.avatarId });
						if (avatar) {
							acceptedUserAvatarUrl = DriveFiles.getPublicUrl(avatar, true);
						}
					}

					return {
						id: invitation.id,
						inviteCode: invitation.inviteCode,
						method: invitation.method,
						recipientName: invitation.recipientName,
						recipientIdentifier: invitation.recipientIdentifier,
						isAccepted: invitation.isAccepted,
						acceptedAt: invitation.acceptedAt,
						acceptedUser: invitation.acceptedUser ? {
							id: invitation.acceptedUser.id,
							username: invitation.acceptedUser.username,
							name: invitation.acceptedUser.name,
							avatarUrl: acceptedUserAvatarUrl,
						} : null,
						createdAt: invitation.createdAt,
						expiresAt: invitation.expiresAt,
						isExpired: invitation.expiresAt ? invitation.expiresAt < new Date() : false,
					};
				}));
		}

		return {
			stats: {
				totalSent: stats.totalSent,
				accepted: stats.accepted,
				pending: stats.pending,
				acceptanceRate: stats.acceptanceRate,
			},
			recentInvitations: ps.includeDetails ? detailedInvitations : [],
			summary: {
				hasInvitations: stats.totalSent > 0,
				hasAcceptedInvitations: stats.accepted > 0,
				successMessage: stats.accepted > 0
					? `${stats.accepted} of your friends have joined Barkle!`
					: stats.totalSent > 0
						? `You've sent ${stats.totalSent} invitations. Keep sharing!`
						: 'Start inviting friends to grow your network!',
			},
		};
	} catch (error) {
		console.error('Failed to retrieve invitation status:', error);
		throw new Error('Failed to retrieve invitation statistics');
	}
});