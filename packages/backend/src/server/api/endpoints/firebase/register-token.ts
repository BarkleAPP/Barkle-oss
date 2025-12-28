import define from '../../define.js';
import { firebaseMessaging } from '@/services/firebase-messaging.js';

export const meta = {
	tags: ['firebase', 'notifications'],
	requireCredential: true,
	kind: 'write:account',
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		token: { type: 'string', minLength: 1 },
		deviceId: { type: 'string', nullable: true },
		platform: { type: 'string', enum: ['web', 'ios', 'android'], default: 'web' },
		appVersion: { type: 'string', nullable: true },
	},
	required: ['token'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	try {
		await firebaseMessaging.registerToken(
			user.id,
			ps.token,
			ps.deviceId || undefined,
			ps.platform,
			ps.appVersion || undefined
		);

		return { success: true };
	} catch (error) {
		console.error('Failed to register Firebase token:', error);
		throw new Error('Failed to register notification token');
	}
});