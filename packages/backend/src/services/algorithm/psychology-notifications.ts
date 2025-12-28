/**
 * Psychology-Based Notification Service
 * Creates notifications based on psychology engine triggers
 */

import { createNotification } from '@/services/create-notification.js';
import { Users } from '@/models/index.js';
import Logger from '@/services/logger.js';

// NOTE: PsychologyEnhancedContent type should be defined locally or imported from
// algorithm-microservice-client.ts (which is self-contained, NOT from '@barkle/algorithm')
// For now, defining inline:
interface PsychologyEnhancedContent {
	id: string;
	psychologyFlags?: Record<string, boolean>;
	metadata?: Record<string, any>;
	triggeredNotifications?: Array<{
		type: 'follower_engagement' | 'popularity_milestone' | 'network_activity' | 'similar_users';
		priority: number;
		delay: number;
	}>;
}

const logger = new Logger('psychology-notifications');

export interface NotificationTrigger {
	type: 'follower_engagement' | 'popularity_milestone' | 'network_activity' | 'similar_users' | 'new_followers';
	userId: string;
	noteId?: string;
	metadata: Record<string, any>;
	delay: number; // ms to delay notification
	priority: number; // 0-1
}

/**
 * Send psychology-triggered notifications
 */
export async function sendPsychologyNotification(trigger: NotificationTrigger): Promise<void> {
	try {
		// Apply delay for dopamine anticipation
		if (trigger.delay > 0) {
			await new Promise(resolve => setTimeout(resolve, trigger.delay));
		}

		const user = await Users.findOneBy({ id: trigger.userId });
		if (!user) {
			logger.warn(`User ${trigger.userId} not found for psychology notification`);
			return;
		}

		// Create notification based on type
		// NOTE: Using existing notification types since custom types aren't supported yet
		// Psychology notifications map to existing types for now
		switch (trigger.type) {
			case 'follower_engagement':
				// Use 'reaction' type as it's engagement from followers
				await createNotification(user.id, 'reaction', {
					noteId: trigger.noteId,
					notifierId: trigger.metadata.followerId || null,
				});
				break;

			case 'popularity_milestone':
				// Use 'app' type for milestone notifications
				await createNotification(user.id, 'app', {
					noteId: trigger.noteId,
					customBody: `Your post reached ${trigger.metadata.milestone} engagement!`,
				});
				break;

			case 'network_activity':
				// Use 'app' type for general activity notifications
				await createNotification(user.id, 'app', {
					customBody: `${trigger.metadata.activeCount} friends are active now`,
				});
				break;

			case 'similar_users':
				// Use 'app' type for similar user activity
				await createNotification(user.id, 'app', {
					noteId: trigger.noteId,
					customBody: 'Users like you are engaging with this content',
				});
				break;

			case 'new_followers':
				// Use 'follow' type for new followers
				// Note: This should ideally be called once per follower, not batched
				if (trigger.metadata.followerIds && trigger.metadata.followerIds.length > 0) {
					await createNotification(user.id, 'follow', {
						notifierId: trigger.metadata.followerIds[0], // Just use first follower for now
					});
				}
				break;

			default:
				logger.warn(`Unknown psychology notification type: ${trigger.type}`);
		}

		logger.debug(`Psychology notification sent: ${trigger.type} to user ${trigger.userId}`);
	} catch (error) {
		logger.error(`Error sending psychology notification:`, error as Error);
	}
}

/**
 * Process psychology-enhanced content and trigger notifications
 */
export async function processPsychologyNotifications(
	content: PsychologyEnhancedContent[],
	userId: string
): Promise<void> {
	for (const item of content) {
		if (!item.triggeredNotifications || item.triggeredNotifications.length === 0) {
			continue;
		}

		for (const notification of item.triggeredNotifications) {
			// Queue notification with delay
			setImmediate(async () => {
				await sendPsychologyNotification({
					type: notification.type,
					userId,
					noteId: item.id,
					metadata: {
						...item.metadata,
						priority: notification.priority,
					},
					delay: notification.delay,
					priority: notification.priority,
				});
			});
		}
	}
}

/**
 * Send new follower notification with random delay
 */
export async function notifyNewFollowers(
	userId: string,
	followerIds: string[],
	delay: number = 0
): Promise<void> {
	await sendPsychologyNotification({
		type: 'new_followers',
		userId,
		metadata: {
			followerCount: followerIds.length,
			followerIds,
		},
		delay,
		priority: 0.7,
	});
}

/**
 * Notify about network activity (friends online)
 */
export async function notifyNetworkActivity(
	userId: string,
	activeFriendIds: string[],
	delay: number = 0
): Promise<void> {
	await sendPsychologyNotification({
		type: 'network_activity',
		userId,
		metadata: {
			activeCount: activeFriendIds.length,
			friendIds: activeFriendIds,
		},
		delay,
		priority: 0.5,
	});
}
