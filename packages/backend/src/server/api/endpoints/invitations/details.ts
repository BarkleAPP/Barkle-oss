import define from '../../define.js';
import { InvitationService } from '@/services/invitation-service.js';
import { DriveFiles } from '@/models/index.js';

export const meta = {
	tags: ['invitations', 'growth'],
	requireCredential: true,
	kind: 'read:invitations',

	errors: {
		invitationNotFound: {
			message: 'Invitation not found',
			code: 'INVITATION_NOT_FOUND',
			id: 'invite-012',
		},
		accessDenied: {
			message: 'Access denied to invitation details',
			code: 'ACCESS_DENIED',
			id: 'invite-013',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		inviteCode: {
			type: 'string',
			minLength: 8,
			maxLength: 32,
			pattern: '^[A-Z0-9]+$',
		},
	},
	required: ['inviteCode'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	try {
		const invitationService = new InvitationService();

		// Get invitation details
		const invitation = await invitationService.getInvitationByCode(ps.inviteCode);

		if (!invitation) {
			throw new Error('INVITATION_NOT_FOUND');
		}

		// Check if user has access to this invitation
		// Users can view invitations they created or accepted
		const hasAccess = invitation.inviterId === user.id || invitation.acceptedUserId === user.id;

		if (!hasAccess) {
			throw new Error('ACCESS_DENIED');
		}

		// Get proper avatar URLs
		let inviterAvatarUrl = null;
		if (invitation.inviter?.avatarId) {
			const avatar = await DriveFiles.findOneBy({ id: invitation.inviter.avatarId });
			if (avatar) {
				inviterAvatarUrl = DriveFiles.getPublicUrl(avatar, true);
			}
		}

		let acceptedUserAvatarUrl = null;
		if (invitation.acceptedUser?.avatarId) {
			const avatar = await DriveFiles.findOneBy({ id: invitation.acceptedUser.avatarId });
			if (avatar) {
				acceptedUserAvatarUrl = DriveFiles.getPublicUrl(avatar, true);
			}
		}

		return {
			invitation: {
				id: invitation.id,
				inviteCode: invitation.inviteCode,
				method: invitation.method,
				recipientName: invitation.recipientName,
				recipientIdentifier: invitation.recipientIdentifier,
				isAccepted: invitation.isAccepted,
				createdAt: invitation.createdAt,
				acceptedAt: invitation.acceptedAt,
				expiresAt: invitation.expiresAt,
				isExpired: invitation.expiresAt ? invitation.expiresAt < new Date() : false,
				personalMessage: invitation.metadata?.personalMessage,
				inviter: invitation.inviter ? {
					id: invitation.inviter.id,
					username: invitation.inviter.username,
					name: invitation.inviter.name,
					avatarUrl: inviterAvatarUrl,
				} : null,
				acceptedUser: invitation.acceptedUser ? {
					id: invitation.acceptedUser.id,
					username: invitation.acceptedUser.username,
					name: invitation.acceptedUser.name,
					avatarUrl: acceptedUserAvatarUrl,
				} : null,
				metadata: {
					createdVia: invitation.metadata?.createdVia,
					userAgent: invitation.metadata?.userAgent,
				},
			},
		};
	} catch (error) {
		console.error('Failed to get invitation details:', error);

		if (error.message === 'INVITATION_NOT_FOUND') {
			throw new Error('Invitation not found');
		} else if (error.message === 'ACCESS_DENIED') {
			throw new Error('You do not have access to view this invitation');
		} else {
			throw new Error('Failed to retrieve invitation details');
		}
	}
});