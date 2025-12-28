import define from '../../../define.js';
import { UserEncryptionKeys } from '@/models/index.js';

export const meta = {
	tags: ['messaging', 'encryption'],
	requireCredential: true,
	kind: 'read:messaging',
	description: 'Get user encryption keys',
} as const;

export const paramDef = {
	type: 'object',
	properties: {},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const keys = await UserEncryptionKeys.findBy({
		userId: user.id,
	});

	return keys.map(key => ({
		id: key.id,
		algorithm: key.algorithm,
		keySize: key.keySize,
		version: key.version,
		createdAt: key.createdAt.toISOString(),
		isActive: key.isActive,
		publicKey: key.publicKey, // Public key is safe to return
		// Note: private key is never returned for security
	}));
});
