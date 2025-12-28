import { createNotification } from '@/services/create-notification.js';
import { firebaseMessaging } from '@/services/firebase-messaging.js';
import { Users, UserProfiles, Followings, Notes, NoteReactions, NotificationSchedules } from '@/models/index.js';
import { User } from '@/models/entities/user.js';
import { genId } from '@/misc/gen-id.js';

export class GrowthNotificationService {
	private static instance: GrowthNotificationService;

	public static getInstance(): GrowthNotificationService {
		if (!GrowthNotificationService.instance) {
			GrowthNotificationService.instance = new GrowthNotificationService();
		}
		return GrowthNotificationService.instance;
	}

	/**
	 * Strategic timing configuration for optimal user engagement
	 */
	private static readonly OPTIMAL_TIMES = {
		MORNING: { hour: 9, minute: 0 },
		AFTERNOON: { hour: 15, minute: 0 }, // After school/work
		EVENING: { hour: 19, minute: 0 },   // Peak social hours
		LATE_EVENING: { hour: 21, minute: 0 },
	};

	private static readonly ENGAGEMENT_WINDOWS = {
		HIGH: [15, 16, 17, 18, 19, 20, 21], // 3 PM - 9 PM
		MEDIUM: [9, 10, 11, 12, 19, 20, 21, 22], // Morning and evening
		LOW: [0, 1, 2, 3, 4, 5, 6, 7, 8, 13, 14, 23], // Off-peak hours
	};

	/**
	 * Create friend-joined notification (static method for viral growth service)
	 */
	static async createFriendJoinedNotification(
		userId: string,
		friendUser: User
	): Promise<void> {
		const instance = GrowthNotificationService.getInstance();
		await instance.sendFriendJoinedNotification(userId, friendUser, 'immediate');
	}

	/**
	 * Create social proof notification (static method for viral growth service)
	 */
	static async createSocialProofNotification(
		userId: string,
		proofData: any
	): Promise<void> {
		const instance = GrowthNotificationService.getInstance();
		await instance.sendSocialProofNotification(
			userId,
			proofData.type,
			proofData,
			'optimal'
		);
	}

	/**
	 * Create growth milestone notification (static method for viral growth service)
	 */
	static async createGrowthMilestoneNotification(
		userId: string,
		momentType: string,
		data: any
	): Promise<void> {
		const instance = GrowthNotificationService.getInstance();
		
		// Map viral moment types to notification types
		const notificationMap = {
			'rapid_growth': 'growingNetwork',
			'network_effect': 'friendActivity',
			'milestone_reached': 'milestone',
			'viral_content': 'contentTrending',
		};

		const notificationType = notificationMap[momentType] || 'milestone';
		await instance.sendSocialProofNotification(userId, notificationType, data, 'immediate');
	}

	/**
	 * Send friend-joined notification with personalized messaging
	 */
	async sendFriendJoinedNotification(
		userId: string,
		friendUser: User,
		timing: 'immediate' | 'optimal' | 'delayed' = 'optimal'
	): Promise<void> {
		try {
			const user = await Users.findOneBy({ id: userId });
			if (!user) return;

			// Check if users are already connected to avoid spam
			const existingConnection = await Followings.findOneBy({
				followerId: userId,
				followeeId: friendUser.id,
			});

			const notificationData = {
				notifierId: friendUser.id,
				customHeader: `${friendUser.name || friendUser.username} joined Barkle! 🎉`,
				customBody: this.generateFriendJoinedMessage(friendUser, existingConnection !== null),
				customIcon: friendUser.avatarUrl || '/static-assets/icons/192.png',
			};

			if (timing === 'immediate') {
				// Send immediately using existing notification system
				await createNotification(userId, 'app', notificationData);
				
				// Also send via Firebase for mobile push
				await firebaseMessaging.sendNotification(userId, {
					title: notificationData.customHeader,
					body: notificationData.customBody,
					icon: notificationData.customIcon,
					clickAction: `/@${friendUser.username}`,
					data: {
						type: 'friendJoined',
						friendId: friendUser.id,
						friendUsername: friendUser.username,
					},
				});
			} else {
				// Schedule for optimal timing
				const optimalTime = await this.calculateOptimalTime(user, 'friendJoined', timing);
				await this.scheduleGrowthNotification(
					userId,
					'friendJoined',
					{ ...notificationData, friendUser },
					optimalTime
				);
			}

			// Track engagement metrics
			await this.trackNotificationSent(userId, 'friendJoined', {
				friendId: friendUser.id,
				timing,
				wasAlreadyConnected: existingConnection !== null,
			});

		} catch (error) {
			console.error('Failed to send friend joined notification:', error);
		}
	}

	/**
	 * Send social proof notification for engagement milestones
	 */
	async sendSocialProofNotification(
		userId: string,
		proofType: 'growingNetwork' | 'contentTrending' | 'friendActivity' | 'milestone',
		data: any,
		timing: 'immediate' | 'optimal' | 'delayed' = 'optimal'
	): Promise<void> {
		try {
			const user = await Users.findOneBy({ id: userId });
			if (!user) return;

			const notificationContent = this.generateSocialProofContent(proofType, data);
			
			const notificationData = {
				customHeader: notificationContent.title,
				customBody: notificationContent.body,
				customIcon: notificationContent.icon,
			};

			if (timing === 'immediate') {
				await createNotification(userId, 'app', notificationData);
				
				await firebaseMessaging.sendNotification(userId, {
					title: notificationContent.title,
					body: notificationContent.body,
					icon: notificationContent.icon,
					clickAction: notificationContent.clickAction,
					data: {
						type: 'socialProof',
						proofType,
						...data,
					},
				});
			} else {
				const optimalTime = await this.calculateOptimalTime(user, 'socialProof', timing);
				await this.scheduleGrowthNotification(
					userId,
					'socialProof',
					{ ...notificationData, proofType, proofData: data },
					optimalTime
				);
			}

			await this.trackNotificationSent(userId, 'socialProof', {
				proofType,
				timing,
				...data,
			});

		} catch (error) {
			console.error('Failed to send social proof notification:', error);
		}
	}

	/**
	 * Send engagement milestone notification
	 */
	async sendEngagementMilestone(
		userId: string,
		milestone: 'firstFollow' | 'firstNote' | 'firstReaction' | 'popularPost' | 'weeklyActive',
		data: any = {}
	): Promise<void> {
		try {
			const milestoneContent = this.generateMilestoneContent(milestone, data);
			
			const notificationData = {
				customHeader: milestoneContent.title,
				customBody: milestoneContent.body,
				customIcon: milestoneContent.icon,
			};

			// Milestone notifications are always sent immediately for maximum impact
			await createNotification(userId, 'app', notificationData);
			
			await firebaseMessaging.sendNotification(userId, {
				title: milestoneContent.title,
				body: milestoneContent.body,
				icon: milestoneContent.icon,
				clickAction: milestoneContent.clickAction,
				data: {
					type: 'milestone',
					milestone,
					...data,
				},
			});

			await this.trackNotificationSent(userId, 'milestone', {
				milestone,
				timing: 'immediate',
				...data,
			});

		} catch (error) {
			console.error('Failed to send engagement milestone notification:', error);
		}
	}

	/**
	 * Calculate optimal timing for notifications based on user behavior and psychology
	 */
	private async calculateOptimalTime(
		user: User,
		notificationType: string,
		timing: 'optimal' | 'delayed'
	): Date {
		const now = new Date();
		const userProfile = await UserProfiles.findOneBy({ userId: user.id });
		const userTimezone = userProfile?.timezone || 'UTC';
		
		// Calculate user's local time
		const userTime = new Date(now.toLocaleString("en-US", { timeZone: userTimezone }));
		const currentHour = userTime.getHours();
		
		let targetTime: Date;
		
		switch (notificationType) {
			case 'friendJoined':
				// Send during high engagement windows for maximum impact
				if (this.ENGAGEMENT_WINDOWS.HIGH.includes(currentHour)) {
					// If in high engagement window, send within 5-15 minutes
					targetTime = new Date(userTime.getTime() + (5 + Math.random() * 10) * 60000);
				} else {
					// Schedule for next high engagement window
					targetTime = this.getNextEngagementWindow(userTime, 'HIGH');
				}
				break;
				
			case 'socialProof':
				// Social proof works best during peak social hours (evening)
				targetTime = new Date(userTime);
				if (currentHour < 19) {
					targetTime.setHours(19, Math.floor(Math.random() * 60), 0, 0);
				} else if (currentHour > 21) {
					// Next day evening
					targetTime.setDate(targetTime.getDate() + 1);
					targetTime.setHours(19, Math.floor(Math.random() * 60), 0, 0);
				} else {
					// Current time is good, send within 30 minutes
					targetTime = new Date(userTime.getTime() + Math.random() * 30 * 60000);
				}
				break;
				
			case 'comeback':
				// Re-engagement notifications work best in the afternoon
				targetTime = new Date(userTime);
				targetTime.setHours(15, Math.floor(Math.random() * 60), 0, 0);
				if (targetTime <= userTime) {
					targetTime.setDate(targetTime.getDate() + 1);
				}
				break;
				
			default:
				// Default to next medium engagement window
				targetTime = this.getNextEngagementWindow(userTime, 'MEDIUM');
		}
		
		// Apply delay if requested (adds psychological anticipation)
		if (timing === 'delayed') {
			const delayHours = 2 + Math.random() * 4; // 2-6 hours delay
			targetTime.setHours(targetTime.getHours() + delayHours);
		}
		
		// Ensure we don't schedule too far in the future (max 48 hours)
		const maxFuture = new Date(now.getTime() + 48 * 60 * 60 * 1000);
		if (targetTime > maxFuture) {
			targetTime = maxFuture;
		}
		
		return targetTime;
	}

	/**
	 * Get the next engagement window based on current time
	 */
	private getNextEngagementWindow(currentTime: Date, priority: 'HIGH' | 'MEDIUM'): Date {
		const targetHours = this.ENGAGEMENT_WINDOWS[priority];
		const currentHour = currentTime.getHours();
		
		// Find next available hour
		const nextHour = targetHours.find(hour => hour > currentHour);
		
		const targetTime = new Date(currentTime);
		
		if (nextHour !== undefined) {
			// Same day
			targetTime.setHours(nextHour, Math.floor(Math.random() * 60), 0, 0);
		} else {
			// Next day, use first available hour
			targetTime.setDate(targetTime.getDate() + 1);
			targetTime.setHours(targetHours[0], Math.floor(Math.random() * 60), 0, 0);
		}
		
		return targetTime;
	}

	/**
	 * Schedule a growth notification for later delivery
	 */
	private async scheduleGrowthNotification(
		userId: string,
		type: string,
		data: any,
		scheduledAt: Date
	): Promise<void> {
		await NotificationSchedules.scheduleNotification(userId, type, scheduledAt, data);
	}

	/**
	 * Generate personalized friend-joined message
	 */
	private generateFriendJoinedMessage(friendUser: User, alreadyConnected: boolean): string {
		const friendName = friendUser.name || friendUser.username;
		
		if (alreadyConnected) {
			const messages = [
				`${friendName} is now active on Barkle! Check out their latest posts 📱`,
				`Your friend ${friendName} just joined the conversation! Say hello 👋`,
				`${friendName} is here! Time to catch up on Barkle ✨`,
			];
			return messages[Math.floor(Math.random() * messages.length)];
		} else {
			const messages = [
				`${friendName} just joined Barkle! Follow them to stay connected 🤝`,
				`Great news! ${friendName} is now on Barkle. Connect with them now 🎉`,
				`${friendName} joined Barkle! Be their first connection 🌟`,
				`Your friend ${friendName} is here! Welcome them to the community 👋`,
			];
			return messages[Math.floor(Math.random() * messages.length)];
		}
	}

	/**
	 * Generate social proof notification content
	 */
	private generateSocialProofContent(
		proofType: string,
		data: any
	): { title: string; body: string; icon: string; clickAction: string } {
		switch (proofType) {
			case 'growingNetwork':
				return {
					title: 'Your network is growing! 📈',
					body: `${data.newFollowers || 'Several'} new people followed you this week`,
					icon: '/static-assets/icons/192.png',
					clickAction: '/followers',
				};
				
			case 'contentTrending':
				return {
					title: 'Your post is trending! 🔥',
					body: `${data.engagementCount || 'Many'} people are engaging with your content`,
					icon: '/static-assets/icons/192.png',
					clickAction: data.noteId ? `/notes/${data.noteId}` : '/notes',
				};
				
			case 'friendActivity':
				return {
					title: 'Your friends are active! 👥',
					body: `${data.activeCount || 'Several'} of your friends posted today`,
					icon: '/static-assets/icons/192.png',
					clickAction: '/timeline',
				};
				
			case 'milestone':
				return {
					title: 'Community milestone! 🎉',
					body: data.message || 'Your community is growing stronger every day',
					icon: '/static-assets/icons/192.png',
					clickAction: '/explore',
				};
				
			default:
				return {
					title: 'Something exciting is happening! ✨',
					body: 'Check out what\'s new on Barkle',
					icon: '/static-assets/icons/192.png',
					clickAction: '/',
				};
		}
	}

	/**
	 * Generate milestone notification content
	 */
	private generateMilestoneContent(
		milestone: string,
		data: any
	): { title: string; body: string; icon: string; clickAction: string } {
		switch (milestone) {
			case 'firstFollow':
				return {
					title: 'Great start! 🌟',
					body: 'You made your first connection! Keep building your network',
					icon: '/static-assets/icons/192.png',
					clickAction: '/explore/users',
				};
				
			case 'firstNote':
				return {
					title: 'Welcome to the conversation! 💬',
					body: 'You shared your first post! Your voice matters here',
					icon: '/static-assets/icons/192.png',
					clickAction: '/timeline',
				};
				
			case 'firstReaction':
				return {
					title: 'You\'re engaging! 👍',
					body: 'You gave your first reaction! Keep spreading positivity',
					icon: '/static-assets/icons/192.png',
					clickAction: '/timeline',
				};
				
			case 'popularPost':
				return {
					title: 'Your post is popular! 🎉',
					body: `${data.reactionCount || 'Many'} people loved your post!`,
					icon: '/static-assets/icons/192.png',
					clickAction: data.noteId ? `/notes/${data.noteId}` : '/notes',
				};
				
			case 'weeklyActive':
				return {
					title: 'You\'re on fire! 🔥',
					body: 'You\'ve been active all week! Your community appreciates you',
					icon: '/static-assets/icons/192.png',
					clickAction: '/timeline',
				};
				
			default:
				return {
					title: 'Achievement unlocked! 🏆',
					body: 'You\'re making great progress on Barkle!',
					icon: '/static-assets/icons/192.png',
					clickAction: '/',
				};
		}
	}

	/**
	 * Track notification metrics for optimization
	 */
	private async trackNotificationSent(
		userId: string,
		type: string,
		metadata: any
	): Promise<void> {
		// This would integrate with analytics system
		// For now, we'll log for debugging
		console.log('Growth notification sent:', {
			userId,
			type,
			timestamp: new Date().toISOString(),
			metadata,
		});
	}

	/**
	 * Process scheduled growth notifications
	 */
	async processScheduledNotifications(): Promise<void> {
		try {
			const pendingNotifications = await NotificationSchedules.getReadyNotifications(50);
			
			for (const schedule of pendingNotifications) {
				try {
					const user = schedule.user;
					if (!user || !user.isActive) {
						await NotificationSchedules.markAsSent(schedule.id);
						continue;
					}

					await this.executeScheduledNotification(schedule);
					await NotificationSchedules.markAsSent(schedule.id);
					
				} catch (error) {
					console.error('Failed to process scheduled notification:', error);
					// Mark as sent to avoid infinite retries
					await NotificationSchedules.markAsSent(schedule.id);
				}
			}
		} catch (error) {
			console.error('Failed to process scheduled notifications:', error);
		}
	}

	/**
	 * Execute a scheduled notification
	 */
	private async executeScheduledNotification(schedule: any): Promise<void> {
		const { type, data, userId } = schedule;
		
		switch (type) {
			case 'friendJoined':
				if (data.friendUser) {
					await this.sendFriendJoinedNotification(userId, data.friendUser, 'immediate');
				}
				break;
				
			case 'socialProof':
				if (data.proofType && data.proofData) {
					await this.sendSocialProofNotification(
						userId,
						data.proofType,
						data.proofData,
						'immediate'
					);
				}
				break;
				
			default:
				// Generic scheduled notification
				await createNotification(userId, 'app', {
					customHeader: data.customHeader || 'Barkle',
					customBody: data.customBody || 'You have new activity!',
					customIcon: data.customIcon || '/static-assets/icons/192.png',
				});
		}
	}

	/**
	 * Detect and send automatic engagement milestones
	 */
	async detectAndSendMilestones(userId: string): Promise<void> {
		try {
			const user = await Users.findOneBy({ id: userId });
			if (!user) return;

			// Check for various milestones
			const followingCount = await Followings.countBy({ followerId: userId });
			const notesCount = await Notes.countBy({ userId });
			const reactionsGiven = await NoteReactions.countBy({ userId });

			// First follow milestone
			if (followingCount === 1) {
				await this.sendEngagementMilestone(userId, 'firstFollow');
			}

			// First note milestone
			if (notesCount === 1) {
				await this.sendEngagementMilestone(userId, 'firstNote');
			}

			// First reaction milestone
			if (reactionsGiven === 1) {
				await this.sendEngagementMilestone(userId, 'firstReaction');
			}

			// Popular post milestone (check recent notes)
			const recentNotes = await Notes.find({
				where: { userId },
				order: { createdAt: 'DESC' },
				take: 5,
			});

			for (const note of recentNotes) {
				const reactionCount = await NoteReactions.countBy({ noteId: note.id });
				if (reactionCount >= 10) { // Threshold for "popular"
					await this.sendEngagementMilestone(userId, 'popularPost', {
						noteId: note.id,
						reactionCount,
					});
					break; // Only send one popular post notification
				}
			}

		} catch (error) {
			console.error('Failed to detect milestones:', error);
		}
	}

	/**
	 * Send comeback notification for inactive users
	 */
	async sendComebackNotification(userId: string, daysSinceLastActive: number): Promise<void> {
		try {
			const user = await Users.findOneBy({ id: userId });
			if (!user) return;

			let message: string;
			if (daysSinceLastActive <= 3) {
				message = 'Your friends have been active while you were away! 👋';
			} else if (daysSinceLastActive <= 7) {
				message = 'There\'s lots of new content waiting for you! ✨';
			} else {
				message = 'Your community misses you! Come see what\'s new 🌟';
			}

			await this.sendSocialProofNotification(
				userId,
				'friendActivity',
				{ message, daysSinceLastActive },
				'optimal'
			);

		} catch (error) {
			console.error('Failed to send comeback notification:', error);
		}
	}
}

// Export singleton instance
export const growthNotificationService = GrowthNotificationService.getInstance();