import define from '../../../define.js';
import { ApiError } from '../../../error.js';
import { MessageEncryptionService } from '@/services/encryption/message-encryption.js';
import { UserProfiles } from '@/models/index.js';
import bcrypt from 'bcryptjs';

export const meta = {
	tags: ['messaging', 'encryption'],
	requireCredential: true,
	kind: 'read:messaging',
	description: 'Decrypt a message for the current user',
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		messageId: {
			type: 'string',
			format: 'barkle:id',
			description: 'ID of the message to decrypt'
		},
		password: { 
			type: 'string',
			description: 'User password for decrypting private key'
		},
	},
	required: ['messageId', 'password'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// Verify user's password
	const profile = await UserProfiles.findOneByOrFail({ userId: user.id });
	const same = await bcrypt.compare(ps.password, profile.password!);

	if (!same) {
		throw new ApiError({
			message: 'Incorrect password.',
			code: 'INCORRECT_PASSWORD',
			id: 'e03a5f46-d309-4865-9b69-56282d94e1eb',
		});
	}

	try {
		const result = await MessageEncryptionService.getMessageText(
			ps.messageId,
			user.id,
			ps.password
		);

		return {
			text: result.text,
			isLegacy: result.isLegacy,
		};
	} catch (error) {
		throw new ApiError({
			message: 'Failed to decrypt message.',
			code: 'DECRYPTION_FAILED',
			id: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
		});
	}
});
