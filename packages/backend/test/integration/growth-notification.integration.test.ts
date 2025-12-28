import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GrowthNotificationService } from '@/services/growth-notification.js';
import { createNotification } from '@/services/create-notification.js';
import { Users, UserProfiles, Followings, Notes, NoteReactions, NotificationSchedules } from '@/models/index.js';
import { User } from '@/models/entities/user.js';

// Integration tests that test the full notification flow
describe('GrowthNotificationService Integration', () => {
	let service: GrowthNotificationService;
	let testUser: User;
	let testFriend: User;

	beforeEach(async () => {
		service = GrowthNotificationService.getInstance();
		
		// Create test users
		testUser = {
			id: 'integration-user-1',
			username: 'integrationuser',
			name: 'Integration User',
			isActive: true,
			avatarUrl: null,
			createdAt: new Date(),
		} as User;

		testFriend = {
			id: 'integration-friend-1',
			username: 'integrationfriend',
			name: 'Integration Friend',
			isActive: true,
			avatarUrl: 'https://example.com/avatar.jpg',
			createdAt: new Date(),
		} as User;
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('Complete Friend Joined Flow', () => {
		it('should handle complete friend joined notification flow', async () => {
			// Mock database responses
			vi.mocked(Users.findOneBy).mockResolvedValue(testUser);
			vi.mocked(Followings.findOneBy).mockResolvedValue(null);
			vi.mocked(UserProfiles.findOneBy).mockResolvedValue({ 
				userId: testUser.id, 
				timezone: 'America/New_York' 
			});

			// Mock notification creation
			const mockNotification = { id: 'notification-1', type: 'app' };
			vi.mocked(createNotification).mockResolvedValue(mockNotification);

			// Test immediate notification
			await service.sendFriendJoinedNotification(testUser.id, testFriend, 'immediate');

			// Verify notification was created with correct data
			expect(createNotification).toHaveBeenCalledWith(
				testUser.id,
				'app',
				expect.objectContaining({
					notifierId: testFriend.id,
					customHeader: 'Integration Friend joined Barkle! 🎉',
					customBody: expect.stringContaining('Integration Friend'),
				})
			);
		});

		it('should schedule friend joined notification for optimal timing', async () => {
			vi.mocked(Users.findOneBy).mockResolvedValue(testUser);
			vi.mocked(UserProfiles.findOneBy).mockResolvedValue({ 
				userId: testUser.id, 
				timezone: 'UTC' 
			});
			vi.mocked(NotificationSchedules.scheduleNotification).mockResolvedValue({
				id: 'schedule-1',
				userId: testUser.id,
				type: 'friendJoined',
				scheduledAt: new Date(),
				data: {},
			} as any);

			await service.sendFriendJoinedNotification(testUser.id, testFriend, 'optimal');

			expect(NotificationSchedules.scheduleNotification).toHaveBeenCalledWith(
				testUser.id,
				'friendJoined',
				expect.any(Date),
				expect.objectContaining({
					notifierId: testFriend.id,
					friendUser: testFriend,
				})
			);
		});
	});

	describe('Social Proof Notification Flow', () => {
		it('should send growing network social proof with proper timing', async () => {
			vi.mocked(Users.findOneBy).mockResolvedValue(testUser);
			vi.mocked(createNotification).mockResolvedValue({ id: 'notification-2' });

			const proofData = { newFollowers: 7 };

			await service.sendSocialProofNotification(
				testUser.id,
				'growingNetwork',
				proofData,
				'immediate'
			);

			expect(createNotification).toHaveBeenCalledWith(
				testUser.id,
				'app',
				expect.objectContaining({
					customHeader: 'Your network is growing! 📈',
					customBody: '7 new people followed you this week',
				})
			);
		});

		it('should send content trending notification with note link', async () => {
			vi.mocked(Users.findOneBy).mockResolvedValue(testUser);
			vi.mocked(createNotification).mockResolvedValue({ id: 'notification-3' });

			const proofData = { engagementCount: 42, noteId: 'trending-note-123' };

			await service.sendSocialProofNotification(
				testUser.id,
				'contentTrending',
				proofData,
				'immediate'
			);

			expect(createNotification).toHaveBeenCalledWith(
				testUser.id,
				'app',
				expect.objectContaining({
					customHeader: 'Your post is trending! 🔥',
					customBody: '42 people are engaging with your content',
				})
			);
		});
	});

	describe('Milestone Detection and Notification', () => {
		it('should detect first follow milestone and send notification', async () => {
			vi.mocked(Users.findOneBy).mockResolvedValue(testUser);
			vi.mocked(Followings.countBy).mockResolvedValue(1); // First follow
			vi.mocked(Notes.countBy).mockResolvedValue(0);
			vi.mocked(NoteReactions.countBy).mockResolvedValue(0);
			vi.mocked(createNotification).mockResolvedValue({ id: 'milestone-1' });

			await service.detectAndSendMilestones(testUser.id);

			expect(createNotification).toHaveBeenCalledWith(
				testUser.id,
				'app',
				expect.objectContaining({
					customHeader: 'Great start! 🌟',
					customBody: 'You made your first connection! Keep building your network',
				})
			);
		});

		it('should detect popular post milestone', async () => {
			const mockNote = {
				id: 'popular-note-1',
				userId: testUser.id,
				createdAt: new Date(),
			};

			vi.mocked(Users.findOneBy).mockResolvedValue(testUser);
			vi.mocked(Followings.countBy).mockResolvedValue(5);
			vi.mocked(Notes.countBy).mockResolvedValue(3);
			vi.mocked(NoteReactions.countBy)
				.mockResolvedValueOnce(2) // General reactions count
				.mockResolvedValueOnce(15); // Specific note reactions
			vi.mocked(Notes.find).mockResolvedValue([mockNote]);
			vi.mocked(createNotification).mockResolvedValue({ id: 'milestone-2' });

			await service.detectAndSendMilestones(testUser.id);

			expect(createNotification).toHaveBeenCalledWith(
				testUser.id,
				'app',
				expect.objectContaining({
					customHeader: 'Your post is popular! 🎉',
					customBody: '15 people loved your post!',
				})
			);
		});

		it('should not send duplicate milestones', async () => {
			vi.mocked(Users.findOneBy).mockResolvedValue(testUser);
			vi.mocked(Followings.countBy).mockResolvedValue(5); // More than 1, so no first follow
			vi.mocked(Notes.countBy).mockResolvedValue(10); // More than 1, so no first note
			vi.mocked(NoteReactions.countBy).mockResolvedValue(20); // More than 1, so no first reaction
			vi.mocked(Notes.find).mockResolvedValue([]); // No recent notes
			vi.mocked(createNotification).mockResolvedValue({ id: 'no-milestone' });

			await service.detectAndSendMilestones(testUser.id);

			// Should not send any milestone notifications
			expect(createNotification).not.toHaveBeenCalled();
		});
	});

	describe('Scheduled Notification Processing', () => {
		it('should process scheduled friend joined notifications', async () => {
			const mockSchedule = {
				id: 'schedule-integration-1',
				type: 'friendJoined',
				userId: testUser.id,
				user: testUser,
				data: {
					friendUser: testFriend,
					customHeader: 'Scheduled Friend Notification',
					customBody: 'Your friend joined!',
				},
				scheduledAt: new Date(),
				createdAt: new Date(),
			};

			vi.mocked(NotificationSchedules.getReadyNotifications).mockResolvedValue([mockSchedule]);
			vi.mocked(NotificationSchedules.markAsSent).mockResolvedValue(undefined);
			vi.mocked(createNotification).mockResolvedValue({ id: 'processed-1' });

			await service.processScheduledNotifications();

			expect(NotificationSchedules.getReadyNotifications).toHaveBeenCalledWith(50);
			expect(NotificationSchedules.markAsSent).toHaveBeenCalledWith('schedule-integration-1');
		});

		it('should handle multiple scheduled notifications in batch', async () => {
			const mockSchedules = [
				{
					id: 'schedule-batch-1',
					type: 'friendJoined',
					userId: testUser.id,
					user: testUser,
					data: { friendUser: testFriend },
				},
				{
					id: 'schedule-batch-2',
					type: 'socialProof',
					userId: testUser.id,
					user: testUser,
					data: { proofType: 'growingNetwork', proofData: { newFollowers: 3 } },
				},
			];

			vi.mocked(NotificationSchedules.getReadyNotifications).mockResolvedValue(mockSchedules);
			vi.mocked(NotificationSchedules.markAsSent).mockResolvedValue(undefined);
			vi.mocked(createNotification).mockResolvedValue({ id: 'batch-processed' });

			await service.processScheduledNotifications();

			expect(NotificationSchedules.markAsSent).toHaveBeenCalledTimes(2);
			expect(NotificationSchedules.markAsSent).toHaveBeenCalledWith('schedule-batch-1');
			expect(NotificationSchedules.markAsSent).toHaveBeenCalledWith('schedule-batch-2');
		});
	});

	describe('Comeback Notification Flow', () => {
		it('should send appropriate comeback message based on inactivity duration', async () => {
			vi.mocked(Users.findOneBy).mockResolvedValue(testUser);
			vi.mocked(UserProfiles.findOneBy).mockResolvedValue({ 
				userId: testUser.id, 
				timezone: 'UTC' 
			});
			vi.mocked(NotificationSchedules.scheduleNotification).mockResolvedValue({
				id: 'comeback-schedule-1',
			} as any);

			// Test short inactivity (2 days)
			await service.sendComebackNotification(testUser.id, 2);

			expect(NotificationSchedules.scheduleNotification).toHaveBeenCalledWith(
				testUser.id,
				'socialProof',
				expect.any(Date),
				expect.objectContaining({
					proofType: 'friendActivity',
					proofData: expect.objectContaining({
						message: 'Your friends have been active while you were away! 👋',
						daysSinceLastActive: 2,
					}),
				})
			);
		});

		it('should send different message for longer inactivity', async () => {
			vi.mocked(Users.findOneBy).mockResolvedValue(testUser);
			vi.mocked(UserProfiles.findOneBy).mockResolvedValue({ 
				userId: testUser.id, 
				timezone: 'UTC' 
			});
			vi.mocked(NotificationSchedules.scheduleNotification).mockResolvedValue({
				id: 'comeback-schedule-2',
			} as any);

			// Test longer inactivity (10 days)
			await service.sendComebackNotification(testUser.id, 10);

			expect(NotificationSchedules.scheduleNotification).toHaveBeenCalledWith(
				testUser.id,
				'socialProof',
				expect.any(Date),
				expect.objectContaining({
					proofType: 'friendActivity',
					proofData: expect.objectContaining({
						message: 'Your community misses you! Come see what\'s new 🌟',
						daysSinceLastActive: 10,
					}),
				})
			);
		});
	});

	describe('Timing Algorithm Integration', () => {
		it('should calculate optimal times based on user timezone', async () => {
			const easternUser = { ...testUser };
			vi.mocked(Users.findOneBy).mockResolvedValue(easternUser);
			vi.mocked(UserProfiles.findOneBy).mockResolvedValue({ 
				userId: easternUser.id, 
				timezone: 'America/New_York' 
			});

			// Mock current time to be 10 AM EST (3 PM UTC)
			const mockDate = new Date('2024-01-01T15:00:00Z');
			vi.setSystemTime(mockDate);

			const optimalTime = await (service as any).calculateOptimalTime(
				easternUser,
				'socialProof',
				'optimal'
			);

			// Should be scheduled for evening in user's timezone
			expect(optimalTime.getHours()).toBe(19); // 7 PM
		});

		it('should handle different notification types with appropriate timing', async () => {
			vi.mocked(UserProfiles.findOneBy).mockResolvedValue({ 
				userId: testUser.id, 
				timezone: 'UTC' 
			});

			const mockDate = new Date('2024-01-01T10:00:00Z'); // 10 AM UTC
			vi.setSystemTime(mockDate);

			// Friend joined notifications should use high engagement windows
			const friendJoinedTime = await (service as any).calculateOptimalTime(
				testUser,
				'friendJoined',
				'optimal'
			);

			// Social proof should target evening hours
			const socialProofTime = await (service as any).calculateOptimalTime(
				testUser,
				'socialProof',
				'optimal'
			);

			// Comeback notifications should target afternoon
			const comebackTime = await (service as any).calculateOptimalTime(
				testUser,
				'comeback',
				'optimal'
			);

			expect(friendJoinedTime.getHours()).toBeGreaterThanOrEqual(15); // High engagement window
			expect(socialProofTime.getHours()).toBe(19); // Evening
			expect(comebackTime.getHours()).toBe(15); // Afternoon
		});
	});

	describe('Error Handling and Resilience', () => {
		it('should handle database errors gracefully', async () => {
			vi.mocked(Users.findOneBy).mockRejectedValue(new Error('Database error'));

			// Should not throw
			await expect(
				service.sendFriendJoinedNotification(testUser.id, testFriend, 'immediate')
			).resolves.not.toThrow();

			// Should not call createNotification
			expect(createNotification).not.toHaveBeenCalled();
		});

		it('should handle notification creation failures', async () => {
			vi.mocked(Users.findOneBy).mockResolvedValue(testUser);
			vi.mocked(createNotification).mockRejectedValue(new Error('Notification failed'));

			// Should not throw
			await expect(
				service.sendEngagementMilestone(testUser.id, 'firstFollow')
			).resolves.not.toThrow();
		});

		it('should continue processing other notifications if one fails', async () => {
			const mockSchedules = [
				{
					id: 'schedule-fail-1',
					type: 'friendJoined',
					userId: 'nonexistent-user',
					user: null, // This will cause processing to skip
					data: { friendUser: testFriend },
				},
				{
					id: 'schedule-success-1',
					type: 'socialProof',
					userId: testUser.id,
					user: testUser,
					data: { proofType: 'growingNetwork', proofData: { newFollowers: 1 } },
				},
			];

			vi.mocked(NotificationSchedules.getReadyNotifications).mockResolvedValue(mockSchedules);
			vi.mocked(NotificationSchedules.markAsSent).mockResolvedValue(undefined);
			vi.mocked(createNotification).mockResolvedValue({ id: 'success' });

			await service.processScheduledNotifications();

			// Both should be marked as sent (failed one gets skipped, successful one processes)
			expect(NotificationSchedules.markAsSent).toHaveBeenCalledTimes(2);
		});
	});

	describe('Content Appropriateness', () => {
		it('should generate positive and encouraging messages', async () => {
			const friendMessage = (service as any).generateFriendJoinedMessage(testFriend, false);
			const milestoneContent = (service as any).generateMilestoneContent('firstFollow', {});
			const socialProofContent = (service as any).generateSocialProofContent('growingNetwork', { newFollowers: 5 });

			// All messages should be positive and encouraging
			expect(friendMessage).toMatch(/joined|here|connect|welcome/i);
			expect(milestoneContent.body).toMatch(/great|first|keep|network/i);
			expect(socialProofContent.body).toMatch(/growing|people|followed/i);

			// Should not contain negative or pressuring language
			expect(friendMessage).not.toMatch(/must|should|need to|have to/i);
			expect(milestoneContent.body).not.toMatch(/behind|late|missing/i);
		});

		it('should use appropriate emojis and tone', async () => {
			const contents = [
				(service as any).generateMilestoneContent('firstFollow', {}),
				(service as any).generateMilestoneContent('popularPost', { reactionCount: 10 }),
				(service as any).generateSocialProofContent('contentTrending', { engagementCount: 20 }),
			];

			contents.forEach(content => {
				// Should contain positive emojis
				expect(content.title).toMatch(/[🌟🎉🔥📈👥✨🏆]/);
				
				// Should have encouraging tone
				expect(content.body).toMatch(/great|popular|growing|loved|active|progress/i);
			});
		});
	});
});