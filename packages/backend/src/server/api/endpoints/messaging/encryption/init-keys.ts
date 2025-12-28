import define from '../../../define.js';
import { ApiError } from '../../../error.js';
import { MessageEncryptionService } from '@/services/encryption/message-encryption.js';
import { UserProfiles } from '@/models/index.js';
import bcrypt from 'bcryptjs';

export const meta = {
	tags: ['messaging', 'encryption'],
	requireCredential: true,
	kind: 'write:messaging',
	description: 'Initialize encryption keys for the user',
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		password: { 
			type: 'string',
			description: 'User password for encrypting private key'
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
		const encryptionKey = await MessageEncryptionService.initializeUserKeys(user.id, ps.password);
		return {
			id: encryptionKey.id,
			algorithm: encryptionKey.algorithm,
			keySize: encryptionKey.keySize,
			version: encryptionKey.version,
			createdAt: encryptionKey.createdAt.toISOString(),
		};
	} catch (error) {
		throw new ApiError({
			message: 'Failed to initialize encryption keys.',
			code: 'ENCRYPTION_INIT_FAILED',
			id: 'f8e4a8b3-2c1d-4e89-9f6a-7b2c4d5e6f8g',
		});
	}
});
