import Bull from 'bull';
import { queueLogger } from '../logger.js';
import { firebaseMessaging } from '@/services/firebase-messaging.js';
import { ReminderNotificationService } from '@/services/reminder-notification.js';
import { sendEmailNotification } from '@/services/send-email-notification.js';
import { Users, UserProfiles, NotificationSchedules } from '@/models/index.js';

const logger = queueLogger.createSubLogger('firebase-notifications');

export async function processFirebaseNotifications(job: Bull.Job, done: any): Promise<void> {
	logger.info('Processing Firebase notifications...');

	try {
		// Process pending scheduled notifications (including reminders)
		await processPendingScheduledNotifications();

		// Schedule social reminder notifications based on platform activity
		await scheduleSocialReminders();

		// Cleanup old tokens and notifications
		await firebaseMessaging.cleanup();

		logger.succ('Firebase notifications processed successfully');
		done();
	} catch (error) {
		logger.error('Failed to process Firebase notifications:', error as Error);
		done(error);
	}
}

/**
 * Process all pending scheduled notifications and send via appropriate channels
 */
async function processPendingScheduledNotifications(): Promise<void> {
	const pendingNotifications = await NotificationSchedules.getReadyNotifications(50);

	logger.info(`Processing ${pendingNotifications.length} pending scheduled notifications`);

	for (const schedule of pendingNotifications) {
		try {
			const user = schedule.user;
			if (!user) {
				await NotificationSchedules.markAsSent(schedule.id);
				continue;
			}

			const userProfile = await UserProfiles.findOneBy({ userId: user.id });
			if (!userProfile) {
				await NotificationSchedules.markAsSent(schedule.id);
				continue;
			}

			// Check if user still wants to receive this type of notification
			if (schedule.type === 'social_reminder') {
				if (!userProfile.receiveSocialReminders) {
					await NotificationSchedules.markAsSent(schedule.id);
					logger.info(`Skipping social reminder for user ${user.id} - opted out`);
					continue;
				}
			}

			const data = schedule.data || {};

			// Send push notification via Firebase
			const pushSent = await firebaseMessaging.sendNotification(user.id, {
				title: data.title || 'Barkle',
				body: data.body || 'You have new activity',
				icon: data.icon || '/static-assets/icons/192.png',
				clickAction: data.clickAction || '/',
				data: {
					type: schedule.type,
					category: data.category || 'general',
				},
			});

			// Send email if user wants email reminders for this type
			if (schedule.type === 'social_reminder' && userProfile.receiveEmailReminders) {
				if (userProfile.email && userProfile.emailNotificationTypes.includes('socialReminder')) {
					try {
						await sendEmailNotification.socialReminder(user.id, {
							title: data.title,
							body: data.body,
							clickAction: data.clickAction,
						});
						logger.info(`Sent email reminder to user ${user.id}`);
					} catch (error) {
						logger.warn(`Failed to send email reminder to user ${user.id}:`, error as Error);
					}
				}
			}

			// Mark as sent
			await NotificationSchedules.markAsSent(schedule.id);

			if (pushSent) {
				logger.info(`Successfully sent ${schedule.type} notification to user ${user.id}`);
			}
		} catch (error) {
			logger.error('Failed to process scheduled notification:', error as Error);
			// Mark as sent to avoid infinite retries
			await NotificationSchedules.markAsSent(schedule.id);
		}
	}
}

/**
 * Schedule social reminder notifications when platform activity is low
 */
async function scheduleSocialReminders(): Promise<void> {
	try {
		const result = await ReminderNotificationService.scheduleReminders();

		if (result.scheduled > 0) {
			logger.info(`Scheduled ${result.scheduled} social reminder notifications (skipped: ${result.skipped})`);
		} else if (result.skipped === 0) {
			logger.info('No social reminders needed - platform activity is healthy');
		}
	} catch (error) {
		logger.error('Failed to schedule social reminders:', error as Error);
	}
}