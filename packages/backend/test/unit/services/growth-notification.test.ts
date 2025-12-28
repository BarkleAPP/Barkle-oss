import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { GrowthNotificationService } from '@/services/growth-notification.js';
import { createNotification } from '@/services/create-notification.js';
import { firebaseMessaging } from '@/services/firebase-messaging.js';
import { Users, UserProfiles, Followings, Notes, NoteReactions, NotificationSchedules } from '@/models/index.js';
import { User } from '@/models/entities/user.js';

// Mock dependencies
vi.mock('@/services/create-notification.js');
vi.mock('@/services/firebase-messaging.js');
vi.mock('@/models/index.js');

describe('GrowthNotificationService', () => {
	let service: GrowthNotificationService;
	let mockUser: User;
	let mockFriendUser: User;

	beforeEach(() => {
		service = GrowthNotificationService.getInstance();
		
		mockUser = {
			id: 'user1',
			username: 'testuser',
			name: 'Test User',
			isActive: true,
			avatarUrl: 'https://example.com/avatar.jpg',
		} as User;

		mockFriendUser = {
			id: 'friend1',
			username: 'frienduser',
			name: 'Friend User',
			isActive: true,
			avatarUrl: 'https://example.com/friend-avatar.jpg',
		} as User;

		// Reset all mocks
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('sendFriendJoinedNotification', () => {
		beforeEach(() => {
			(Users.findOneBy as Mock).mockResolvedValue(mockUser);
			(Followings.findOneBy as Mock).mockResolvedValue(null);
			(createNotification as Mock).mockResolvedValue({});
			(firebaseMessaging.sendNotification as Mock).mockResolvedValue(true);
		});

		it('should send immediate friend joined notification', async () => {
			await service.sendFriendJoinedNotification('user1', mockFriendUser, 'immediate');

			expect(createNotification).toHaveBeenCalledWith('user1', 'app', expect.objectContaining({
				notifierId: 'friend1',
				customHeader: 'Friend User joined Barkle! 🎉',
				customBody: expect.stringContaining('Friend User'),
			}));

			expect(firebaseMessaging.sendNotification).toHaveBeenCalledWith('user1', expect.objectContaining({
				title: 'Friend User joined Barkle! 🎉',
				clickAction: '/@frienduser',
				data: expect.objectContaining({
					type: 'friendJoined',
					friendId: 'friend1',
				}),
			}));
		});

		it('should schedule notification for optimal timing', async () => {
			(UserProfiles.findOneBy as Mock).mockResolvedValue({ timezone: 'America/New_York' });
			(NotificationSchedules.scheduleNotification as Mock).mockResolvedValue({});

			await service.sendFriendJoinedNotification('user1', mockFriendUser, 'optimal');

			expect(NotificationSchedules.scheduleNotification).toHaveBeenCalledWith(
				'user1',
				'friendJoined',
				expect.any(Date),
				expect.objectContaining({
					notifierId: 'friend1',
					friendUser: mockFriendUser,
				})
			);
		});

		it('should generate different messages for existing connections', async () => {
			(Followings.findOneBy as Mock).mockResolvedValue({ followerId: 'user1', followeeId: 'friend1' });

			await service.sendFriendJoinedNotification('user1', mockFriendUser, 'immediate');

			const callArgs = (createNotification as Mock).mock.calls[0][2];
			expect(callArgs.customBody).toMatch(/active on Barkle|joined the conversation|is here/);
		});

		it('should handle user not found gracefully', async () => {
			(Users.findOneBy as Mock).mockResolvedValue(null);

			await expect(
				service.sendFriendJoinedNotification('nonexistent', mockFriendUser, 'immediate')
			).resolves.not.toThrow();

			expect(createNotification).not.toHaveBeenCalled();
		});
	});

	describe('sendSocialProofNotification', () => {
		beforeEach(() => {
			(Users.findOneBy as Mock).mockResolvedValue(mockUser);
			(createNotification as Mock).mockResolvedValue({});
			(firebaseMessaging.sendNotification as Mock).mockResolvedValue(true);
		});

		it('should send growing network social proof', async () => {
			const proofData = { newFollowers: 5 };

			await service.sendSocialProofNotification('user1', 'growingNetwork', proofData, 'immediate');

			expect(createNotification).toHaveBeenCalledWith('user1', 'app', expect.objectContaining({
				customHeader: 'Your network is growing! 📈',
				customBody: '5 new people followed you this week',
			}));

			expect(firebaseMessaging.sendNotification).toHaveBeenCalledWith('user1', expect.objectContaining({
				title: 'Your network is growing! 📈',
				clickAction: '/followers',
				data: expect.objectContaining({
					type: 'socialProof',
					proofType: 'growingNetwork',
					newFollowers: 5,
				}),
			}));
		});

		it('should send content trending social proof', async () => {
			const proofData = { engagementCount: 25, noteId: 'note123' };

			await service.sendSocialProofNotification('user1', 'contentTrending', proofData, 'immediate');

			expect(createNotification).toHaveBeenCalledWith('user1', 'app', expect.objectContaining({
				customHeader: 'Your post is trending! 🔥',
				customBody: '25 people are engaging with your content',
			}));

			expect(firebaseMessaging.sendNotification).toHaveBeenCalledWith('user1', expect.objectContaining({
				clickAction: '/notes/note123',
			}));
		});

		it('should send friend activity social proof', async () => {
			const proofData = { activeCount: 8 };

			await service.sendSocialProofNotification('user1', 'friendActivity', proofData, 'immediate');

			expect(createNotification).toHaveBeenCalledWith('user1', 'app', expect.objectContaining({
				customHeader: 'Your friends are active! 👥',
				customBody: '8 of your friends posted today',
			}));
		});

		it('should schedule social proof for optimal timing', async () => {
			(UserProfiles.findOneBy as Mock).mockResolvedValue({ timezone: 'UTC' });
			(NotificationSchedules.scheduleNotification as Mock).mockResolvedValue({});

			await service.sendSocialProofNotification('user1', 'growingNetwork', { newFollowers: 3 }, 'optimal');

			expect(NotificationSchedules.scheduleNotification).toHaveBeenCalledWith(
				'user1',
				'socialProof',
				expect.any(Date),
				expect.objectContaining({
					proofType: 'growingNetwork',
					proofData: { newFollowers: 3 },
				})
			);
		});
	});

	describe('sendEngagementMilestone', () => {
		beforeEach(() => {
			(createNotification as Mock).mockResolvedValue({});
			(firebaseMessaging.sendNotification as Mock).mockResolvedValue(true);
		});

		it('should send first follow milestone', async () => {
			await service.sendEngagementMilestone('user1', 'firstFollow');

			expect(createNotification).toHaveBeenCalledWith('user1', 'app', expect.objectContaining({
				customHeader: 'Great start! 🌟',
				customBody: 'You made your first connection! Keep building your network',
			}));

			expect(firebaseMessaging.sendNotification).toHaveBeenCalledWith('user1', expect.objectContaining({
				clickAction: '/explore/users',
				data: expect.objectContaining({
					type: 'milestone',
					milestone: 'firstFollow',
				}),
			}));
		});

		it('should send first note milestone', async () => {
			await service.sendEngagementMilestone('user1', 'firstNote');

			expect(createNotification).toHaveBeenCalledWith('user1', 'app', expect.objectContaining({
				customHeader: 'Welcome to the conversation! 💬',
				customBody: 'You shared your first post! Your voice matters here',
			}));
		});

		it('should send popular post milestone with data', async () => {
			const data = { reactionCount: 15, noteId: 'note456' };

			await service.sendEngagementMilestone('user1', 'popularPost', data);

			expect(createNotification).toHaveBeenCalledWith('user1', 'app', expect.objectContaining({
				customHeader: 'Your post is popular! 🎉',
				customBody: '15 people loved your post!',
			}));

			expect(firebaseMessaging.sendNotification).toHaveBeenCalledWith('user1', expect.objectContaining({
				clickAction: '/notes/note456',
			}));
		});
	});

	describe('calculateOptimalTime', () => {
		let mockUserProfile: any;

		beforeEach(() => {
			mockUserProfile = { timezone: 'America/New_York' };
			(UserProfiles.findOneBy as Mock).mockResolvedValue(mockUserProfile);
		});

		it('should schedule friend joined notifications during high engagement windows', async () => {
			// Mock current time to be 2 PM (14:00) - before high engagement window
			const mockDate = new Date('2024-01-01T14:00:00Z');
			vi.setSystemTime(mockDate);

			const service = GrowthNotificationService.getInstance();
			const optimalTime = await (service as any).calculateOptimalTime(mockUser, 'friendJoined', 'optimal');

			// Should be scheduled for high engagement window (3 PM or later)
			expect(optimalTime.getHours()).toBeGreaterThanOrEqual(15);
		});

		it('should schedule social proof notifications for evening hours', async () => {
			// Mock current time to be 10 AM
			const mockDate = new Date('2024-01-01T10:00:00Z');
			vi.setSystemTime(mockDate);

			const service = GrowthNotificationService.getInstance();
			const optimalTime = await (service as any).calculateOptimalTime(mockUser, 'socialProof', 'optimal');

			// Should be scheduled for evening (7 PM)
			expect(optimalTime.getHours()).toBe(19);
		});

		it('should add delay when requested', async () => {
			const mockDate = new Date('2024-01-01T15:00:00Z');
			vi.setSystemTime(mockDate);

			const service = GrowthNotificationService.getInstance();
			const optimalTime = await (service as any).calculateOptimalTime(mockUser, 'friendJoined', 'delayed');

			// Should be at least 2 hours later
			expect(optimalTime.getTime()).toBeGreaterThan(mockDate.getTime() + 2 * 60 * 60 * 1000);
		});

		it('should not schedule more than 48 hours in the future', async () => {
			const mockDate = new Date('2024-01-01T23:00:00Z');
			vi.setSystemTime(mockDate);

			const service = GrowthNotificationService.getInstance();
			const optimalTime = await (service as any).calculateOptimalTime(mockUser, 'socialProof', 'delayed');

			const maxFuture = new Date(mockDate.getTime() + 48 * 60 * 60 * 1000);
			expect(optimalTime.getTime()).toBeLessThanOrEqual(maxFuture.getTime());
		});
	});

	describe('detectAndSendMilestones', () => {
		beforeEach(() => {
			(Users.findOneBy as Mock).mockResolvedValue(mockUser);
			(createNotification as Mock).mockResolvedValue({});
			(firebaseMessaging.sendNotification as Mock).mockResolvedValue(true);
		});

		it('should detect and send first follow milestone', async () => {
			(Followings.countBy as Mock).mockResolvedValue(1);
			(Notes.countBy as Mock).mockResolvedValue(0);
			(NoteReactions.countBy as Mock).mockResolvedValue(0);

			const sendMilestoneSpy = vi.spyOn(service, 'sendEngagementMilestone');

			await service.detectAndSendMilestones('user1');

			expect(sendMilestoneSpy).toHaveBeenCalledWith('user1', 'firstFollow');
		});

		it('should detect and send first note milestone', async () => {
			(Followings.countBy as Mock).mockResolvedValue(0);
			(Notes.countBy as Mock).mockResolvedValue(1);
			(NoteReactions.countBy as Mock).mockResolvedValue(0);

			const sendMilestoneSpy = vi.spyOn(service, 'sendEngagementMilestone');

			await service.detectAndSendMilestones('user1');

			expect(sendMilestoneSpy).toHaveBeenCalledWith('user1', 'firstNote');
		});

		it('should detect popular post milestone', async () => {
			(Followings.countBy as Mock).mockResolvedValue(5);
			(Notes.countBy as Mock).mockResolvedValue(3);
			(NoteReactions.countBy as Mock).mockResolvedValue(5);

			const mockNote = { id: 'note123', userId: 'user1' };
			(Notes.find as Mock).mockResolvedValue([mockNote]);
			(NoteReactions.countBy as Mock).mockResolvedValueOnce(5).mockResolvedValueOnce(15); // Second call for note reactions

			const sendMilestoneSpy = vi.spyOn(service, 'sendEngagementMilestone');

			await service.detectAndSendMilestones('user1');

			expect(sendMilestoneSpy).toHaveBeenCalledWith('user1', 'popularPost', {
				noteId: 'note123',
				reactionCount: 15,
			});
		});

		it('should handle user not found gracefully', async () => {
			(Users.findOneBy as Mock).mockResolvedValue(null);

			await expect(service.detectAndSendMilestones('nonexistent')).resolves.not.toThrow();
		});
	});

	describe('processScheduledNotifications', () => {
		it('should process pending friend joined notifications', async () => {
			const mockSchedule = {
				id: 'schedule1',
				type: 'friendJoined',
				userId: 'user1',
				user: mockUser,
				data: {
					friendUser: mockFriendUser,
					customHeader: 'Test Header',
					customBody: 'Test Body',
				},
			};

			(NotificationSchedules.getReadyNotifications as Mock).mockResolvedValue([mockSchedule]);
			(NotificationSchedules.markAsSent as Mock).mockResolvedValue(undefined);

			const sendFriendJoinedSpy = vi.spyOn(service, 'sendFriendJoinedNotification').mockResolvedValue();

			await service.processScheduledNotifications();

			expect(sendFriendJoinedSpy).toHaveBeenCalledWith('user1', mockFriendUser, 'immediate');
			expect(NotificationSchedules.markAsSent).toHaveBeenCalledWith('schedule1');
		});

		it('should process pending social proof notifications', async () => {
			const mockSchedule = {
				id: 'schedule2',
				type: 'socialProof',
				userId: 'user1',
				user: mockUser,
				data: {
					proofType: 'growingNetwork',
					proofData: { newFollowers: 3 },
				},
			};

			(NotificationSchedules.getReadyNotifications as Mock).mockResolvedValue([mockSchedule]);
			(NotificationSchedules.markAsSent as Mock).mockResolvedValue(undefined);

			const sendSocialProofSpy = vi.spyOn(service, 'sendSocialProofNotification').mockResolvedValue();

			await service.processScheduledNotifications();

			expect(sendSocialProofSpy).toHaveBeenCalledWith('user1', 'growingNetwork', { newFollowers: 3 }, 'immediate');
			expect(NotificationSchedules.markAsSent).toHaveBeenCalledWith('schedule2');
		});

		it('should skip inactive users', async () => {
			const inactiveUser = { ...mockUser, isActive: false };
			const mockSchedule = {
				id: 'schedule3',
				type: 'friendJoined',
				userId: 'user1',
				user: inactiveUser,
				data: { friendUser: mockFriendUser },
			};

			(NotificationSchedules.getReadyNotifications as Mock).mockResolvedValue([mockSchedule]);
			(NotificationSchedules.markAsSent as Mock).mockResolvedValue(undefined);

			const sendFriendJoinedSpy = vi.spyOn(service, 'sendFriendJoinedNotification');

			await service.processScheduledNotifications();

			expect(sendFriendJoinedSpy).not.toHaveBeenCalled();
			expect(NotificationSchedules.markAsSent).toHaveBeenCalledWith('schedule3');
		});

		it('should handle processing errors gracefully', async () => {
			const mockSchedule = {
				id: 'schedule4',
				type: 'friendJoined',
				userId: 'user1',
				user: mockUser,
				data: { friendUser: mockFriendUser },
			};

			(NotificationSchedules.getReadyNotifications as Mock).mockResolvedValue([mockSchedule]);
			(NotificationSchedules.markAsSent as Mock).mockResolvedValue(undefined);

			const sendFriendJoinedSpy = vi.spyOn(service, 'sendFriendJoinedNotification')
				.mockRejectedValue(new Error('Test error'));

			await expect(service.processScheduledNotifications()).resolves.not.toThrow();

			expect(NotificationSchedules.markAsSent).toHaveBeenCalledWith('schedule4');
		});
	});

	describe('sendComebackNotification', () => {
		beforeEach(() => {
			(Users.findOneBy as Mock).mockResolvedValue(mockUser);
		});

		it('should send appropriate message for recent inactivity', async () => {
			const sendSocialProofSpy = vi.spyOn(service, 'sendSocialProofNotification').mockResolvedValue();

			await service.sendComebackNotification('user1', 2);

			expect(sendSocialProofSpy).toHaveBeenCalledWith('user1', 'friendActivity', 
				expect.objectContaining({
					message: 'Your friends have been active while you were away! 👋',
					daysSinceLastActive: 2,
				}),
				'optimal'
			);
		});

		it('should send appropriate message for longer inactivity', async () => {
			const sendSocialProofSpy = vi.spyOn(service, 'sendSocialProofNotification').mockResolvedValue();

			await service.sendComebackNotification('user1', 10);

			expect(sendSocialProofSpy).toHaveBeenCalledWith('user1', 'friendActivity',
				expect.objectContaining({
					message: 'Your community misses you! Come see what\'s new 🌟',
					daysSinceLastActive: 10,
				}),
				'optimal'
			);
		});
	});

	describe('message generation', () => {
		it('should generate varied friend joined messages', async () => {
			const messages = new Set();
			
			// Generate multiple messages to test variety
			for (let i = 0; i < 10; i++) {
				const message = (service as any).generateFriendJoinedMessage(mockFriendUser, false);
				messages.add(message);
			}

			// Should have some variety in messages
			expect(messages.size).toBeGreaterThan(1);
			
			// All messages should contain friend's name
			messages.forEach(message => {
				expect(message).toContain('Friend User');
			});
		});

		it('should generate appropriate social proof content', async () => {
			const content = (service as any).generateSocialProofContent('growingNetwork', { newFollowers: 5 });

			expect(content).toEqual({
				title: 'Your network is growing! 📈',
				body: '5 new people followed you this week',
				icon: '/static-assets/icons/192.png',
				clickAction: '/followers',
			});
		});

		it('should generate appropriate milestone content', async () => {
			const content = (service as any).generateMilestoneContent('firstFollow', {});

			expect(content).toEqual({
				title: 'Great start! 🌟',
				body: 'You made your first connection! Keep building your network',
				icon: '/static-assets/icons/192.png',
				clickAction: '/explore/users',
			});
		});
	});

	describe('timing algorithms', () => {
		it('should identify high engagement windows correctly', async () => {
			const service = GrowthNotificationService.getInstance();
			const highEngagementHours = (service as any).constructor.ENGAGEMENT_WINDOWS.HIGH;

			expect(highEngagementHours).toContain(19); // 7 PM
			expect(highEngagementHours).toContain(20); // 8 PM
			expect(highEngagementHours).not.toContain(3); // 3 AM
		});

		it('should calculate next engagement window correctly', async () => {
			const service = GrowthNotificationService.getInstance();
			const currentTime = new Date('2024-01-01T12:00:00Z'); // Noon
			
			const nextWindow = (service as any).getNextEngagementWindow(currentTime, 'HIGH');
			
			// Should be scheduled for next high engagement hour (3 PM or later)
			expect(nextWindow.getHours()).toBeGreaterThanOrEqual(15);
		});
	});
});