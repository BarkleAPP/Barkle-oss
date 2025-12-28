import define from '../../define.js';
import { InvitationService } from '@/services/invitation-service.js';
import { DriveFiles } from '@/models/index.js';
import config from '@/config/index.js';
import Logger from '@/services/logger.js';

const logger = new Logger('invitations/validate');

export const meta = {
	tags: ['invitations', 'growth'],
	requireCredential: false, // Allow validation without login for signup flow
	kind: 'read:invitations',

	errors: {
		invalidInviteCode: {
			message: 'Invalid or expired invite code',
			code: 'INVALID_INVITE_CODE',
			id: 'invite-010',
		},
		validationFailed: {
			message: 'Failed to validate invite code',
			code: 'VALIDATION_FAILED',
			id: 'invite-011',
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
			// Allow both old format codes and user IDs
		},
	},
	required: ['inviteCode'],
} as const;

export default define(meta, paramDef, async (ps) => {
	try {
		const invitationService = new InvitationService();

		// Validate invitation code
		const validation = await invitationService.validateInviteCode(ps.inviteCode);

		if (!validation.isValid) {
			return {
				isValid: false,
				error: validation.error,
				message: validation.error === 'Invitation not found'
					? 'This invitation code is not valid'
					: validation.error === 'Invitation already used'
						? 'This invitation has already been used'
						: validation.error === 'Invitation expired'
							? 'This invitation has expired'
							: 'Invalid invitation code',
			};
		}

		// Return invitation details for valid codes
		const invitation = validation.invitation!;

		// Get proper avatar URL for inviter
		let inviterAvatarUrl = null;
		if (invitation.inviter?.avatarId) {
			const avatar = await DriveFiles.findOneBy({ id: invitation.inviter.avatarId });
			if (avatar) {
				inviterAvatarUrl = DriveFiles.getPublicUrl(avatar, true);
			}
		}

		return {
			isValid: true,
			invitation: {
				id: invitation.id,
				inviter: invitation.inviter ? {
					id: invitation.inviter.id,
					name: invitation.inviter.name,
					username: invitation.inviter.username,
					host: invitation.inviter.host,
					avatarId: invitation.inviter.avatarId,
					avatarUrl: inviterAvatarUrl,
					isCat: invitation.inviter.isCat,
					isBot: invitation.inviter.isBot,
					isAdmin: invitation.inviter.isAdmin,
					isModerator: invitation.inviter.isModerator,
				} : null,
				recipientName: invitation.recipientName,
				method: invitation.method,
				createdAt: invitation.createdAt,
				expiresAt: invitation.expiresAt,
				personalMessage: invitation.metadata?.personalMessage,
			},
			message: invitation.inviter
				? `${invitation.inviter.name || invitation.inviter.username} invited you to join Barkle!`
				: 'You\'ve been invited to join Barkle!',
		};
	} catch (error) {
		logger.error('Invitation validation failed', error as Error);
		throw new Error('Failed to validate invite code');
	}
});