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
	},
	required: ['token'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	try {
		await firebaseMessaging.unregisterToken(user.id, ps.token);

		return { success: true };
	} catch (error) {
		console.error('Failed to unregister Firebase token:', error);
		throw new Error('Failed to unregister notification token');
	}
});