import define from '../../define.js';
import { InvitationService } from '@/services/invitation-service.js';
import { HOUR } from '@/const.js';

export const meta = {
	tags: ['invitations', 'growth'],
	requireCredential: true,
	kind: 'write:invitations',
	limit: { duration: HOUR, max: 20 }, // Rate limit invitation creation

	errors: {
		invalidRecipient: {
			message: 'Invalid recipient information',
			code: 'INVALID_RECIPIENT',
			id: 'invite-001',
		},
		invitationLimitExceeded: {
			message: 'Daily invitation limit exceeded',
			code: 'INVITATION_LIMIT_EXCEEDED',
			id: 'invite-002',
		},
		invitationCreationFailed: {
			message: 'Failed to create invitation',
			code: 'INVITATION_CREATION_FAILED',
			id: 'invite-003',
		},
		invalidMethod: {
			message: 'Invalid invitation method',
			code: 'INVALID_METHOD',
			id: 'invite-004',
		},
		dailyEmailLimitExceeded: {
			message: 'Daily email invitation limit exceeded (50 per day)',
			code: 'DAILY_EMAIL_LIMIT_EXCEEDED',
			id: 'invite-014',
		},
		duplicateEmailInvitation: {
			message: 'You already sent an invitation to this email address recently',
			code: 'DUPLICATE_EMAIL_INVITATION',
			id: 'invite-015',
		},
		hourlyRateLimitExceeded: {
			message: 'Hourly email invitation limit exceeded (10 per hour)',
			code: 'HOURLY_RATE_LIMIT_EXCEEDED',
			id: 'invite-016',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		method: {
			type: 'string',
			enum: ['sms', 'email', 'social', 'link'],
		},
		recipients: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					identifier: {
						type: 'string',
						minLength: 1,
						maxLength: 255,
					},
					name: {
						type: 'string',
						minLength: 1,
						maxLength: 255,
					},
				},
				required: ['identifier'],
			},
			maxItems: 10,
			minItems: 1,
		},
		personalMessage: {
			type: 'string',
			maxLength: 200,
		},
		expirationDays: {
			type: 'integer',
			minimum: 1,
			maximum: 90,
		},
	},
	required: ['method', 'recipients'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	try {
		const invitationService = new InvitationService();

		// Validate recipients
		const validRecipients = ps.recipients.filter(recipient => {
			return recipient.identifier &&
				recipient.identifier.trim().length > 0 &&
				recipient.identifier.trim().length <= 255;
		}).map(recipient => ({
			identifier: recipient.identifier.trim(),
			name: recipient.name?.trim() || undefined,
		}));

		if (validRecipients.length === 0) {
			throw new Error('No valid recipients provided');
		}

		// Calculate expiration date if provided
		const expiresAt = ps.expirationDays
			? new Date(Date.now() + ps.expirationDays * 24 * 60 * 60 * 1000)
			: undefined;

		// Create invitations
		const invitationPromises = validRecipients.map(recipient =>
			invitationService.createInvitation(user.id, {
				method: ps.method,
				recipientIdentifier: recipient.identifier,
				recipientName: recipient.name,
				personalMessage: ps.personalMessage,
				expiresAt,
				metadata: {
					createdVia: 'api',
					userAgent: 'web', // Could be enhanced to detect actual user agent
				},
			})
		);

		const invitations = await Promise.allSettled(invitationPromises);

		// Separate successful and failed invitations
		const successful = invitations
			.filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
			.map(result => result.value);

		const failed = invitations
			.filter((result): result is PromiseRejectedResult => result.status === 'rejected')
			.length;

		// Track invitation batch analytics
		await invitationService.trackInvitationBatch(user.id, ps.method, successful.length);

		return {
			invitations: successful,
			totalSent: successful.length,
			failed,
			method: ps.method,
		};
	} catch (error) {
		console.error('Invitation creation failed:', error);

		// Handle specific anti-spam errors
		if (error.message.includes('Daily email invitation limit exceeded')) {
			throw new Error('Daily email invitation limit exceeded (50 per day)');
		} else if (error.message.includes('already sent an invitation to this email')) {
			throw new Error('You already sent an invitation to this email address recently');
		} else if (error.message.includes('Hourly email invitation limit exceeded')) {
			throw new Error('Hourly email invitation limit exceeded (10 per hour)');
		} else {
			throw new Error('Failed to create invitations');
		}
	}
});