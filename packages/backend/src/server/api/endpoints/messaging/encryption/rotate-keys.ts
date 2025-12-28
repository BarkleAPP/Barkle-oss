import define from '../../../define.js';
import { ApiError } from '../../../error.js';
import { MessageEncryptionService } from '@/services/encryption/message-encryption.js';
import { UserProfiles } from '@/models/index.js';
import bcrypt from 'bcryptjs';

export const meta = {
	tags: ['messaging', 'encryption'],
	requireCredential: true,
	kind: 'write:messaging',
	description: 'Rotate user encryption keys',
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		password: { 
			type: 'string',
			description: 'User password for encrypting new private key'
		},
	},
	required: ['password'],
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
		const newKey = await MessageEncryptionService.rotateUserKeys(user.id, ps.password);
		return {
			id: newKey.id,
			algorithm: newKey.algorithm,
			keySize: newKey.keySize,
			version: newKey.version,
			createdAt: newKey.createdAt.toISOString(),
		};
	} catch (error) {
		throw new ApiError({
			message: 'Failed to rotate encryption keys.',
			code: 'KEY_ROTATION_FAILED',
			id: 'a1b2c3d4-e5f6-7890-ab12-cd34ef567890',
		});
	}
});
