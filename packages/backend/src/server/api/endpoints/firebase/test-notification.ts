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
		title: { type: 'string', default: 'Test Notification' },
		body: { type: 'string', default: 'This is a test notification from Barkle!' },
		clickAction: { type: 'string', nullable: true },
	},
} as const;

export default define(meta, paramDef, async (ps, user) => {
	try {
		// Check if Firebase is available
		const { isFirebaseAvailable, getFirebaseInitError } = await import('@/services/firebase-messaging.js');
		
		if (!isFirebaseAvailable()) {
			const error = getFirebaseInitError();
			return { 
				success: false, 
				message: 'Firebase not initialized: ' + (error?.message || 'Unknown error'),
				error: error?.message 
			};
		}

		const success = await firebaseMessaging.sendNotification(user.id, {
			title: ps.title,
			body: ps.body,
			icon: '/static-assets/user-unknown.png',
			clickAction: ps.clickAction || '/',
		});

		return { success, message: success ? 'Notification sent successfully' : 'No active tokens found for this user' };
	} catch (error) {
		console.error('Failed to send test notification:', error);
		return { 
			success: false, 
			message: 'Failed to send test notification: ' + (error as Error).message,
			error: (error as Error).message 
		};
	}
});