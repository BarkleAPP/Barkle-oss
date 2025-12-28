import { SubscriptionExpiryDaemon } from '@/daemons/subscription-expiry-daemon.js';
import define from '../../../define.js';

export const meta = {
	tags: ['admin', 'subscription'],
	requireCredential: true,
	requireAdmin: true,
} as const;

export const paramDef = {
	type: 'object',
	properties: {},
	required: [],
} as const;

export default define(meta, paramDef, async () => {
	const cleanedCount = await SubscriptionExpiryDaemon.runManualCheck();
	
	return {
		success: true,
		cleanedCount,
		message: `Cleaned up ${cleanedCount} expired subscriptions`
	};
});