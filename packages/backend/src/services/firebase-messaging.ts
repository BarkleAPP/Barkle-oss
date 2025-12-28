import admin from 'firebase-admin';
import config from '@/config/index.js';
import { fetchMeta } from '@/misc/fetch-meta.js';
import { FirebaseTokens, NotificationSchedules, Users, Notifications, UserProfiles } from '@/models/index.js';
import { User } from '@/models/entities/user.js';
import { Packed } from '@/misc/schema.js';
import { getNoteSummary } from '@/misc/get-note-summary.js';
import { genId } from '@/misc/gen-id.js';

// Initialize Firebase Admin SDK
let firebaseApp: admin.app.App | null = null;
let initializationAttempted = false;
let initializationError: Error | null = null;

export async function initializeFirebase(): Promise<boolean> {
	// Only attempt initialization once
	if (initializationAttempted) {
		return firebaseApp !== null;
	}

	initializationAttempted = true;

	try {
		// Get Firebase configuration from meta table
		const meta = await fetchMeta(true);

		// Check if Firebase is enabled and configured
		if (!meta.enableFirebaseMessaging) {
			console.warn('Firebase messaging is disabled in meta configuration');
			return false;
		}

		if (!meta.firebaseServiceAccountJson) {
			console.warn('Firebase service account JSON is not configured');
			return false;
		}

		// Parse service account JSON
		let serviceAccountKey: any;
		try {
			serviceAccountKey = JSON.parse(meta.firebaseServiceAccountJson);
		} catch (parseError) {
			console.error('Failed to parse Firebase service account JSON:', parseError);
			initializationError = new Error('Invalid Firebase service account JSON format');
			return false;
		}

		// Validate service account key structure
		if (!serviceAccountKey.project_id || !serviceAccountKey.private_key || !serviceAccountKey.client_email) {
			console.error('Invalid Firebase service account key structure - missing required fields');
			initializationError = new Error('Invalid Firebase service account key structure');
			return false;
		}

		// Use project ID from service account if not explicitly set
		const projectId = meta.firebaseProjectId || serviceAccountKey.project_id;

		if (!projectId) {
			console.error('Firebase projectId is missing in meta configuration and service account');
			initializationError = new Error('Firebase projectId is missing');
			return false;
		}

		// Check if app already exists
		try {
			firebaseApp = admin.app('barkle-firebase-app');
			console.log('Firebase app already exists, reusing it');
			return true;
		} catch (e) {
			// App doesn't exist, create it
			console.log('Creating new Firebase app');
		}

		firebaseApp = admin.initializeApp({
			credential: admin.credential.cert(serviceAccountKey),
			projectId: projectId,
		}, 'barkle-firebase-app'); // Add app name to avoid conflicts
		console.log('Firebase Admin SDK initialized successfully for project:', projectId);
		return true;
	} catch (error) {
		initializationError = error instanceof Error ? error : new Error(String(error));
		console.error('Failed to initialize Firebase Admin SDK:', error);
		return false;
	}
}

/**
 * Check if Firebase is available and initialized
 */
export function isFirebaseAvailable(): boolean {
	return firebaseApp !== null;
}

/**
 * Get Firebase initialization error if any
 */
export function getFirebaseInitError(): Error | null {
	return initializationError;
}

export class FirebaseMessagingService {
	private static instance: FirebaseMessagingService;
	private recentNotifications: Map<string, number> = new Map(); // notificationId -> timestamp

	public static getInstance(): FirebaseMessagingService {
		if (!FirebaseMessagingService.instance) {
			FirebaseMessagingService.instance = new FirebaseMessagingService();
		}
		return FirebaseMessagingService.instance;
	}

	/**
	 * Register a Firebase token for a user
	 */
	async registerToken(
		userId: string,
		token: string,
		deviceId?: string,
		platform: string = 'web',
		appVersion?: string
	): Promise<void> {
		// Validate inputs
		if (!userId || !token) {
			throw new Error('userId and token are required');
		}

		// Validate platform
		const validPlatforms = ['web', 'ios', 'android'];
		if (!validPlatforms.includes(platform)) {
			throw new Error(`Invalid platform: ${platform}. Must be one of: ${validPlatforms.join(', ')}`);
		}

		// Validate token format (basic check - Firebase tokens are typically ~150+ chars)
		if (token.length < 50) {
			throw new Error('Invalid Firebase token format - token too short');
		}

		try {
			await FirebaseTokens.registerToken(userId, token, deviceId, platform, appVersion);
		} catch (error) {
			console.error('Failed to register Firebase token:', error);
			throw error;
		}
	}

	/**
	 * Send notification via Firebase Cloud Messaging
	 */
	async sendNotification(
		userId: string,
		notification: {
			title: string;
			body: string;
			icon?: string;
			badge?: string;
			data?: Record<string, string>;
			clickAction?: string;
			badgeCount?: number;
		}
	): Promise<boolean> {
		// Graceful degradation: skip if Firebase not available
		if (!firebaseApp) {
			if (!initializationAttempted) {
				console.warn('Firebase not initialized - attempting initialization');
				await initializeFirebase();
			}
			if (!firebaseApp) {
				console.debug('Firebase not available, skipping FCM notification for user:', userId);
				return false;
			}
		}

		// Validate notification content
		if (!notification.title || !notification.body) {
			console.error('Notification title and body are required');
			return false;
		}

		try {
			const tokens = await FirebaseTokens.getActiveTokensForUser(userId);
			if (tokens.length === 0) {
				return false;
			}

			// Deduplicate tokens by token value as an additional safety measure
			const uniqueTokens = tokens.filter((token, index, self) =>
				index === self.findIndex(t => t.token === token.token)
			);

			console.log(`Sending FCM notification to user ${userId}: ${uniqueTokens.length} unique tokens`);

			const messaging = admin.messaging(firebaseApp);
			const results = await Promise.allSettled(
				uniqueTokens.map(async (tokenRecord) => {
					const message: admin.messaging.Message = {
						token: tokenRecord.token,
						notification: {
							title: notification.title,
							body: notification.body,
							imageUrl: notification.icon,
						},
						data: {
							...notification.data,
							clickAction: notification.clickAction || '/',
							userId,
							timestamp: Date.now().toString(),
						},
						webpush: {
							notification: {
								title: notification.title,
								body: notification.body,
								icon: notification.icon || '/static-assets/icons/192.png',
								badge: notification.badge || '/static-assets/icons/192.png',
								tag: 'barkle-notification',
								requireInteraction: false,
								actions: notification.clickAction ? [{
									action: 'open',
									title: 'Open',
								}] : undefined,
							},
							fcmOptions: {
								link: notification.clickAction,
							},
						},
						android: {
							notification: {
								title: notification.title,
								body: notification.body,
								icon: 'ic_notification',
								color: '#86b300',
								clickAction: notification.clickAction,
							},
						},
						apns: {
							payload: {
								aps: {
									alert: {
										title: notification.title,
										body: notification.body,
									},
									badge: notification.badgeCount || 1,
									sound: 'default',
								},
							},
							fcmOptions: {
								imageUrl: notification.icon,
							},
						},
					};

					const response = await messaging.send(message);

					// Update last used timestamp
					await FirebaseTokens.updateLastUsed(tokenRecord.token);

					return response;
				})
			);

			// Handle failed tokens
			let successCount = 0;
			results.forEach((result, index) => {
				if (result.status === 'fulfilled') {
					successCount++;
				} else {
					const error = result.reason;
					console.error('FCM send failed:', error);

					// Deactivate invalid tokens
					if (error?.code === 'messaging/registration-token-not-registered' ||
						error?.code === 'messaging/invalid-registration-token') {
						FirebaseTokens.deactivateToken(uniqueTokens[index].token);
					}
				}
			});

			return successCount > 0;
		} catch (error) {
			console.error('Firebase messaging error:', error);
			return false;
		}
	}

	/**
	 * Send notification to multiple users
	 */
	async sendMulticastNotification(
		userIds: string[],
		notification: {
			title: string;
			body: string;
			icon?: string;
			data?: Record<string, string>;
			clickAction?: string;
		}
	): Promise<{ successCount: number; failureCount: number }> {
		const results = await Promise.allSettled(
			userIds.map(userId => this.sendNotification(userId, notification))
		);

		let successCount = 0;
		let failureCount = 0;

		results.forEach(result => {
			if (result.status === 'fulfilled' && result.value) {
				successCount++;
			} else {
				failureCount++;
			}
		});

		return { successCount, failureCount };
	}

	/**
	 * Schedule a random engagement notification
	 */
	async scheduleRandomNotification(
		userId: string,
		type: 'comeback' | 'engagement' | 'social_proof' | 'friend_activity',
		delayHours: number = 24
	): Promise<void> {
		const scheduledAt = new Date();
		scheduledAt.setHours(scheduledAt.getHours() + delayHours);

		const notificationData = this.generateRandomNotificationData(type);

		await NotificationSchedules.scheduleNotification(
			userId,
			type,
			scheduledAt,
			notificationData
		);
	}

	/**
	 * Process pending scheduled notifications
	 */
	async processPendingNotifications(): Promise<void> {
		const pendingNotifications = await NotificationSchedules.getReadyNotifications(50);

		for (const schedule of pendingNotifications) {
			try {
				const user = schedule.user;
				// Check if user exists
				if (!user) {
					await NotificationSchedules.markAsSent(schedule.id);
					continue;
				}

				// Check if user still wants to receive social reminders
				if (schedule.type === 'social_reminder') {
					const userProfile = await UserProfiles.findOneBy({ userId: user.id });
					if (!userProfile || !userProfile.receiveSocialReminders) {
						await NotificationSchedules.markAsSent(schedule.id);
						continue;
					}
				}

				const notificationContent = this.buildNotificationFromSchedule(schedule);
				const success = await this.sendNotification(user.id, notificationContent);

				if (success) {
					await NotificationSchedules.markAsSent(schedule.id);

					// Don't auto-schedule follow-ups for social reminders
					// They are scheduled based on platform activity instead
					if (schedule.type !== 'social_reminder') {
						// Schedule next random notification (with some randomness)
						const nextDelayHours = 24 + Math.floor(Math.random() * 48); // 24-72 hours
						await this.scheduleRandomNotification(user.id, 'comeback', nextDelayHours);
					}
				}
			} catch (error) {
				console.error('Failed to process scheduled notification:', error);
				// Mark as sent to avoid infinite retries
				await NotificationSchedules.markAsSent(schedule.id);
			}
		}
	}

	/**
	 * Generate random notification data based on type
	 */
	private generateRandomNotificationData(type: string): Record<string, any> {
		const messages: Record<string, Array<{ title: string; body: string }>> = {
			comeback: [
				{ title: "Missing you on Barkle! 👋", body: "Your friends have been active while you were away" },
				{ title: "Something's happening! 🌟", body: "Check out what's new in your community" },
				{ title: "Your network is growing! 📈", body: "See who's joined Barkle recently" },
				{ title: "Don't miss out! ✨", body: "There are new posts waiting for you" },
			],
			engagement: [
				{ title: "Your post is getting love! ❤️", body: "People are reacting to your recent post" },
				{ title: "Someone mentioned you! 💬", body: "You have new interactions to check out" },
				{ title: "Trending now! 🔥", body: "Your content is gaining traction" },
			],
			social_proof: [
				{ title: "Your friends are active! 👥", body: "5 of your friends posted today" },
				{ title: "Growing community! 🌱", body: "Your network has grown by 3 new connections" },
				{ title: "Popular content! 📊", body: "See what's trending in your community" },
			],
			friend_activity: [
				{ title: "Friend activity! 👋", body: "Your friends have been busy on Barkle" },
				{ title: "New connections! 🤝", body: "Someone you know just joined" },
				{ title: "Community updates! 📢", body: "Check out the latest from your network" },
			],
		};

		const typeMessages = messages[type] || messages.comeback;
		const randomMessage = typeMessages[Math.floor(Math.random() * typeMessages.length)];

		return {
			...randomMessage,
			clickAction: '/',
			icon: '/static-assets/icons/192.png',
		};
	}

	/**
	 * Build notification content from scheduled notification
	 */
	private buildNotificationFromSchedule(schedule: any): {
		title: string;
		body: string;
		icon?: string;
		data?: Record<string, string>;
		clickAction?: string;
	} {
		const data = schedule.data || {};

		return {
			title: data.title || 'Barkle',
			body: data.body || 'You have new activity!',
			icon: data.icon || '/static-assets/icons/192.png',
			clickAction: data.clickAction || '/',
			data: {
				type: schedule.type,
				scheduleId: schedule.id,
			},
		};
	}

	/**
	 * Send notification for Barkle's existing notification system
	 */
	async sendBarkleNotification(
		userId: string,
		notification: Packed<'Notification'>
	): Promise<boolean> {
		const user = await Users.findOneBy({ id: userId });
		if (!user) return false;

		// Check user's notification preferences for social reminders
		const userProfile = await UserProfiles.findOneBy({ userId });
		if (!userProfile) return false;

		// Respect user's social reminder settings (check notification data for type)
		if (userProfile.receiveSocialReminders === false) {
			// Allow regular notifications, but check if this is a reminder notification
			// Reminders should have 'social_reminder' in the data
			const notificationData = (notification as any).data;
			if (notificationData && notificationData.type === 'social_reminder') {
				return false; // User opted out of social reminders
			}
		}

		// Prevent sending the same notification multiple times within 30 seconds
		const notificationKey = `${userId}:${notification.id}`;
		const now = Date.now();
		const lastSent = this.recentNotifications.get(notificationKey);

		if (lastSent && (now - lastSent) < 30000) { // 30 seconds
			console.log(`Skipping duplicate notification ${notification.id} for user ${userId}`);
			return true; // Return true to indicate "success" but we didn't actually send
		}

		this.recentNotifications.set(notificationKey, now);

		// Clean up old entries (keep only last 1000 entries)
		if (this.recentNotifications.size > 1000) {
			const entries = Array.from(this.recentNotifications.entries());
			entries.sort((a, b) => b[1] - a[1]); // Sort by timestamp descending
			this.recentNotifications = new Map(entries.slice(0, 500)); // Keep only the 500 most recent
		}

		const title = this.getNotificationTitle(notification);
		const body = this.getNotificationBody(notification);
		const clickAction = this.getNotificationClickAction(notification);

		// Get unread notification count
		const unreadCount = await Notifications.countBy({
			notifieeId: userId,
			isRead: false,
		});

		// Get notifier's profile picture
		const notifierAvatar = notification.user?.avatarUrl || '/static-assets/user-unknown.png';

		// Get unread count from data if provided, otherwise default to 1
		const badgeCount = unreadCount || 1;

		// Send to the primary recipient
		const primaryResult = await this.sendNotification(userId, {
			title,
			body,
			icon: notifierAvatar, // Use notifier's avatar as notification icon
			badge: '/static-assets/icons/192.png',
			clickAction,
			badgeCount: unreadCount, // Pass unread count for badge
			data: {
				notificationId: notification.id,
				type: notification.type,
				userId: userId, // Account ID of recipient
				unreadCount: unreadCount.toString(), // Unread notifications count
				notifierId: notification.user?.id || '', // ID of person triggering notification
				notifierUsername: notification.user?.username || '', // Username of notifier
				notifierName: notification.user?.name || '', // Display name of notifier
				notifierAvatar: notifierAvatar, // Profile picture URL
				noteId: notification.note?.id || '', // Note ID if applicable
				route: clickAction, // Deep link route
				timestamp: notification.createdAt, // When notification was created
			},
		});

		// TODO: Re-enable multi-account support after fixing duplicate notification issue
		// Also send to other accounts on the same device (multi-account support)
		// try {
		// 	await this.sendToOtherAccountsOnDevice(userId, {
		// 		title,
		// 		body,
		// 		icon: notifierAvatar,
		// 		badge: '/static-assets/icons/192.png',
		// 		clickAction,
		// 		badgeCount: unreadCount,
		// 		data: {
		// 			notificationId: notification.id,
		// 			type: notification.type,
		// 			userId: userId, // Original recipient ID
		// 			unreadCount: unreadCount.toString(),
		// 			notifierId: notification.user?.id || '',
		// 			notifierUsername: notification.user?.username || '',
		// 			notifierName: notification.user?.name || '',
		// 			notifierAvatar: notifierAvatar,
		// 			noteId: notification.note?.id || '',
		// 			route: clickAction,
		// 			timestamp: notification.createdAt,
		// 		},
		// 	});
		// } catch (error) {
		// 	console.warn('Failed to send multi-account notifications:', error);
		// }

		return primaryResult;
	}

	/**
	 * Send notification to other accounts on the same device (multi-account support)
	 */
	private async sendToOtherAccountsOnDevice(
		originalUserId: string,
		notification: {
			title: string;
			body: string;
			icon?: string;
			badge?: string;
			data?: Record<string, string>;
			clickAction?: string;
			badgeCount?: number;
		}
	): Promise<void> {
		// Get all devices that the original user has tokens on
		const userTokens = await FirebaseTokens.getActiveTokensForUser(originalUserId);
		const deviceIds = [...new Set(userTokens.map(t => t.deviceId).filter(Boolean))];

		// For each device, send to all other accounts on that device
		for (const deviceId of deviceIds) {
			if (deviceId) {
				const deviceTokens = await FirebaseTokens.getActiveTokensForDevice(deviceId);
				const otherUserTokens = deviceTokens.filter(t => t.userId !== originalUserId);

				// Group tokens by user to avoid sending multiple notifications to same user
				const tokensByUser = new Map<string, typeof otherUserTokens[0][]>();
				for (const token of otherUserTokens) {
					if (!tokensByUser.has(token.userId)) {
						tokensByUser.set(token.userId, []);
					}
					tokensByUser.get(token.userId)!.push(token);
				}

				// Send to each other user on this device
				for (const [otherUserId, tokens] of tokensByUser) {
					try {
						// Get unread count for this other user
						const otherUserUnreadCount = await Notifications.countBy({
							notifieeId: otherUserId,
							isRead: false,
						});

						// Send notification with data indicating it's for a different account
						await this.sendMulticastNotification([otherUserId], {
							...notification,
							data: {
								...notification.data,
								userId: otherUserId, // Override with the actual recipient
								unreadCount: otherUserUnreadCount.toString(),
								crossAccountNotification: 'true', // Flag to indicate this is a cross-account notification
								originalRecipientId: originalUserId,
							},
						});
					} catch (error) {
						console.warn(`Failed to send cross-account notification to user ${otherUserId}:`, error);
					}
				}
			}
		}
	}

	/**
	 * Get notification title based on type
	 */
	private getNotificationTitle(notification: Packed<'Notification'>): string {
		const notifierName = notification.user?.name || notification.user?.username || 'Someone';

		switch (notification.type) {
			case 'follow':
				return `${notifierName} followed you`;
			case 'mention':
				return `${notifierName} mentioned you`;
			case 'reply':
				return `${notifierName} replied to your post`;
			case 'renote':
				return `${notifierName} shared your post`;
			case 'quote':
				return `${notifierName} quoted your post`;
			case 'reaction':
				return `${notifierName} reacted to your post`;
			case 'pollVote':
				return `${notifierName} voted in your poll`;
			case 'pollEnded':
				return 'Your poll has ended';
			case 'receiveFollowRequest':
				return `${notifierName} wants to follow you`;
			case 'followRequestAccepted':
				return `${notifierName} accepted your follow request`;
			case 'groupInvited':
				return `${notifierName} invited you to a group`;
			case 'invitationAccepted':
				return `${notifierName} accepted your invitation`;
			case 'invitationReward':
				return 'You received an invitation reward';
			case 'app':
				return notification.note ? getNoteSummary(notification.note) || 'App notification' : 'App notification';
			default:
				return 'New notification';
		}
	}

	/**
	 * Get notification body based on type
	 */
	private getNotificationBody(notification: Packed<'Notification'>): string {
		if (notification.note) {
			const summary = getNoteSummary(notification.note);
			return summary || 'Check out the post';
		}

		switch (notification.type) {
			case 'follow':
				return 'Tap to view their profile';
			case 'receiveFollowRequest':
				return 'Tap to approve or decline';
			case 'followRequestAccepted':
				return 'You can now see their posts';
			case 'pollVote':
				return 'See the results';
			case 'pollEnded':
				return 'Check out the final results';
			case 'groupInvited':
				return 'Tap to join the group';
			case 'invitationAccepted':
				return 'Welcome to the team!';
			case 'invitationReward':
				return 'Congratulations on your reward!';
			case 'app':
				return 'Tap to view details';
			default:
				return 'Tap to view details';
		}
	}

	/**
	 * Get click action URL for notification
	 */
	private getNotificationClickAction(notification: Packed<'Notification'>): string {
		if (notification.note) {
			return `/notes/${notification.note.id}`;
		}

		if (notification.user) {
			return `/@${notification.user.username}`;
		}

		switch (notification.type) {
			case 'pollVote':
			case 'pollEnded':
				// Polls are associated with notes, so this should be handled above
				return '/notifications';
			case 'groupInvited':
				// Could link to group page if group info is available
				return '/notifications';
			case 'invitationAccepted':
			case 'invitationReward':
				return '/notifications';
			case 'app':
				return '/notifications';
			default:
				return '/notifications';
		}
	}

	/**
	 * Clean up old tokens and notifications
	 */
	async cleanup(): Promise<void> {
		await Promise.all([
			FirebaseTokens.cleanupOldTokens(),
			FirebaseTokens.cleanupDuplicateTokens(),
			NotificationSchedules.cleanupOldNotifications(),
		]);
	}

	/**
	 * Unregister a Firebase token for a user
	 */
	async unregisterToken(userId: string, token: string): Promise<void> {
		await FirebaseTokens.deactivateToken(token);
		console.log(`Unregistered Firebase token for user ${userId}`);
	}
}

// Export singleton instance
export const firebaseMessaging = FirebaseMessagingService.getInstance();