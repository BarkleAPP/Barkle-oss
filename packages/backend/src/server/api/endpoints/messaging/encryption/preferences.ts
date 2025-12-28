import define from '../../../define.js';
import { UserEncryptionPreferences } from '@/models/index.js';
import { MessageEncryptionService } from '@/services/encryption/message-encryption.js';

export const meta = {
	tags: ['messaging', 'encryption'],
	requireCredential: true,
	kind: 'read:messaging',
	description: 'Get user encryption preferences',
} as const;

export const paramDef = {
	type: 'object',
	properties: {},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	let preferences = await UserEncryptionPreferences.findOneBy({ userId: user.id });
	
	if (!preferences) {
		preferences = await MessageEncryptionService.initializeUserPreferences(user.id);
	}

	return {
		encryptByDefault: preferences.encryptByDefault,
		allowLegacyMessages: preferences.allowLegacyMessages,
		keyRotationDays: preferences.keyRotationDays,
		lastKeyRotation: preferences.lastKeyRotation?.toISOString() || null,
		needsKeyRotation: await MessageEncryptionService.needsKeyRotation(user.id),
	};
});
