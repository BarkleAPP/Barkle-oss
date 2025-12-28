import define from '../../../define.js';
import { UserEncryptionPreferences } from '@/models/index.js';
import { MessageEncryptionService } from '@/services/encryption/message-encryption.js';

export const meta = {
	tags: ['messaging', 'encryption'],
	requireCredential: true,
	kind: 'write:messaging',
	description: 'Update user encryption preferences',
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		encryptByDefault: { type: 'boolean' },
		allowLegacyMessages: { type: 'boolean' },
		keyRotationDays: { type: 'integer', minimum: 30, maximum: 3650 },
	},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	let preferences = await UserEncryptionPreferences.findOneBy({ userId: user.id });
	
	if (!preferences) {
		preferences = await MessageEncryptionService.initializeUserPreferences(user.id);
	}

	const updateData: any = {
		updatedAt: new Date(),
	};

	if (ps.encryptByDefault !== undefined) {
		updateData.encryptByDefault = ps.encryptByDefault;
	}

	if (ps.allowLegacyMessages !== undefined) {
		updateData.allowLegacyMessages = ps.allowLegacyMessages;
	}

	if (ps.keyRotationDays !== undefined) {
		updateData.keyRotationDays = ps.keyRotationDays;
	}

	await UserEncryptionPreferences.update({ userId: user.id }, updateData);

	const updatedPreferences = await UserEncryptionPreferences.findOneByOrFail({ userId: user.id });

	return {
		encryptByDefault: updatedPreferences.encryptByDefault,
		allowLegacyMessages: updatedPreferences.allowLegacyMessages,
		keyRotationDays: updatedPreferences.keyRotationDays,
		lastKeyRotation: updatedPreferences.lastKeyRotation?.toISOString() || null,
		needsKeyRotation: await MessageEncryptionService.needsKeyRotation(user.id),
	};
});
