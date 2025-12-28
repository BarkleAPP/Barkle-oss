import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { InvitationService } from '@/services/invitation-service.js';
import { InvitationTrackings, Users, Followings } from '@/models/index.js';
import { createNotification } from '@/services/create-notification.js';
import type { User } from '@/models/entities/user.js';
import type { InvitationTracking } from '@/models/entities/invitation-tracking.js';

// Mock dependencies
vi.mock('@/services/create-notification.js');
vi.mock('@/models/index.js');

describe('InvitationService', () => {
	let service: InvitationService;
	let mockUser: User;
	let mockAcceptedUser: User;
	let mockInvitation: InvitationTracking;

	beforeEach(() => {
		service = new InvitationService('https://test.barkle.com');
		
		mockUser = {
			id: 'user1',
			username: 'testuser',
			name: 'Test User',
			avatarUrl: 'https://example.com/avatar.jpg',
		} as User;

		mockAcceptedUser = {
			id: 'accepted1',
			username: 'accepteduser',
			name: 'Accepted User',
			avatarUrl: 'https://example.com/accepted-avatar.jpg',
		} as User;

		mockInvitation = {
			id: 'invitation1',
			inviterId: 'user1',
			inviteCode: 'ABC12345',
			method: 'link',
			recipientName: 'Test Recipient',
			isAccepted: false,
			acceptedUserId: null,
			createdAt: new Date(),
			acceptedAt: null,
			expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
			metadata: {},
			inviter: mockUser,
			acceptedUser: null,
		} as InvitationTracking;

		// Reset all mocks
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('createInvitation', () => {
		beforeEach(() => {
			(InvitationTrackings.findByInviteCode as Mock).mockResolvedValue(null);
			(InvitationTrackings.createInvitation as Mock).mockResolvedValue(mockInvitation);
		});

		it('should create invitation with unique code', async () => {
			const invitationData = {
				method: 'link' as const,
				recipientName: 'Test Recipient',
				personalMessage: 'Join me on Barkle!',
			};

			const result = await service.createInvitation('user1', invitationData);

			expect(InvitationTrackings.createInvitation).toHaveBeenCalledWith(
				expect.objectContaining({
					inviterId: 'user1',
					inviteCode: expect.stringMatching(/^[A-Z0-9]{8}$/),
					method: 'link',
					recipientName: 'Test Recipient',
					metadata: expect.objectContaining({
						personalMessage: 'Join me on Barkle!',
						createdVia: 'api',
					}),
				})
			);

			expect(result).toEqual({
				id: 'invitation1',
				inviteCode: 'ABC12345',
				inviteUrl: 'https://test.barkle.com/invite/ABC12345',
				recipient: 'Test Recipient',
				message: expect.stringContaining('Join me on Barkle!'),
			});
		});

		it('should generate unique invite codes', async () => {
			// Mock first code as existing, second as unique
			(InvitationTrackings.findByInviteCode as Mock)
				.mockResolvedValueOnce(mockInvitation) // First code exists
				.mockResolvedValueOnce(null); // Second code is unique

			const invitationData = {
				method: 'email' as const,
				recipientIdentifier: 'test@example.com',
			};

			await service.createInvitation('user1', invitationData);

			// Should have checked for uniqueness twice
			expect(InvitationTrackings.findByInviteCode).toHaveBeenCalledTimes(2);
		});

		it('should throw error if unable to generate unique code', async () => {
			// Mock all attempts as existing codes
			(InvitationTrackings.findByInviteCode as Mock).mockResolvedValue(mockInvitation);

			const invitationData = {
				method: 'sms' as const,
				recipientIdentifier: '+1234567890',
			};

			await expect(
				service.createInvitation('user1', invitationData)
			).rejects.toThrow('Failed to generate unique invite code');
		});

		it('should set default expiration date', async () => {
			const invitationData = {
				method: 'link' as const,
			};

			await service.createInvitation('user1', invitationData);

			const createCall = (InvitationTrackings.createInvitation as Mock).mock.calls[0][0];
			expect(createCall.expiresAt).toBeInstanceOf(Date);
			
			// Should expire in approximately 30 days
			const daysDiff = (createCall.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
			expect(daysDiff).toBeCloseTo(30, 0);
		});
	});

	describe('createBatchInvitations', () => {
		beforeEach(() => {
			(InvitationTrackings.findByInviteCode as Mock).mockResolvedValue(null);
			(InvitationTrackings.createInvitation as Mock).mockResolvedValue(mockInvitation);
		});

		it('should create multiple invitations', async () => {
			const invitations = [
				{ method: 'email' as const, recipientIdentifier: 'user1@example.com', recipientName: 'User 1' },
				{ method: 'sms' as const, recipientIdentifier: '+1234567890', recipientName: 'User 2' },
				{ method: 'link' as const, recipientName: 'User 3' },
			];

			const results = await service.createBatchInvitations('user1', invitations);

			expect(results).toHaveLength(3);
			expect(InvitationTrackings.createInvitation).toHaveBeenCalledTimes(3);
			
			results.forEach(result => {
				expect(result).toHaveProperty('inviteCode');
				expect(result).toHaveProperty('inviteUrl');
			});
		});

		it('should continue processing if one invitation fails', async () => {
			(InvitationTrackings.createInvitation as Mock)
				.mockResolvedValueOnce(mockInvitation)
				.mockRejectedValueOnce(new Error('Database error'))
				.mockResolvedValueOnce(mockInvitation);

			const invitations = [
				{ method: 'email' as const, recipientIdentifier: 'user1@example.com' },
				{ method: 'email' as const, recipientIdentifier: 'user2@example.com' },
				{ method: 'email' as const, recipientIdentifier: 'user3@example.com' },
			];

			const results = await service.createBatchInvitations('user1', invitations);

			// Should have 2 successful results (first and third)
			expect(results).toHaveLength(2);
		});
	});

	describe('acceptInvitation', () => {
		beforeEach(() => {
			const acceptedInvitation = {
				...mockInvitation,
				isAccepted: true,
				acceptedUserId: 'accepted1',
				acceptedAt: new Date(),
				acceptedUser: mockAcceptedUser,
				inviter: mockUser,
			};

			(InvitationTrackings.acceptInvitation as Mock).mockResolvedValue(acceptedInvitation);
			(Followings.findOne as Mock).mockResolvedValue(null);
			(Followings.save as Mock).mockResolvedValue({});
			(Users.increment as Mock).mockResolvedValue({});
			(createNotification as Mock).mockResolvedValue({});
		});

		it('should accept invitation and auto-connect users', async () => {
			const result = await service.acceptInvitation('ABC12345', 'accepted1');

			expect(InvitationTrackings.acceptInvitation).toHaveBeenCalledWith('ABC12345', 'accepted1');
			expect(result?.isAccepted).toBe(true);
			expect(result?.acceptedUserId).toBe('accepted1');

			// Should create following relationship
			expect(Followings.save).toHaveBeenCalledWith(
				expect.objectContaining({
					followerId: 'accepted1',
					followeeId: 'user1',
				})
			);

			// Should update follower counts
			expect(Users.increment).toHaveBeenCalledWith({ id: 'user1' }, 'followersCount', 1);
			expect(Users.increment).toHaveBeenCalledWith({ id: 'accepted1' }, 'followingCount', 1);
		});

		it('should send notification to inviter', async () => {
			const acceptedInvitation = {
				...mockInvitation,
				isAccepted: true,
				acceptedUserId: 'accepted1',
				acceptedUser: mockAcceptedUser,
				inviter: mockUser,
			};

			(InvitationTrackings.acceptInvitation as Mock).mockResolvedValue(acceptedInvitation);

			await service.acceptInvitation('ABC12345', 'accepted1');

			expect(createNotification).toHaveBeenCalledWith('user1', 'invitationAccepted', {
				invitationId: 'invitation1',
				acceptedUserId: 'accepted1',
				acceptedUserName: 'Accepted User',
				acceptedUserUsername: 'accepteduser',
				recipientName: 'Test Recipient',
			});
		});

		it('should not create duplicate following relationship', async () => {
			// Mock existing following relationship
			(Followings.findOne as Mock).mockResolvedValue({
				followerId: 'accepted1',
				followeeId: 'user1',
			});

			const acceptedInvitation = {
				...mockInvitation,
				isAccepted: true,
				acceptedUserId: 'accepted1',
				acceptedUser: mockAcceptedUser,
				inviter: mockUser,
			};

			(InvitationTrackings.acceptInvitation as Mock).mockResolvedValue(acceptedInvitation);

			await service.acceptInvitation('ABC12345', 'accepted1');

			// Should not create new following relationship
			expect(Followings.save).not.toHaveBeenCalled();
			expect(Users.increment).not.toHaveBeenCalled();
		});

		it('should handle null invitation gracefully', async () => {
			(InvitationTrackings.acceptInvitation as Mock).mockResolvedValue(null);

			const result = await service.acceptInvitation('INVALID', 'accepted1');

			expect(result).toBeNull();
			expect(Followings.save).not.toHaveBeenCalled();
			expect(createNotification).not.toHaveBeenCalled();
		});
	});

	describe('validateInviteCode', () => {
		it('should validate valid invitation', async () => {
			(InvitationTrackings.findByInviteCode as Mock).mockResolvedValue(mockInvitation);

			const result = await service.validateInviteCode('ABC12345');

			expect(result.isValid).toBe(true);
			expect(result.invitation).toEqual(mockInvitation);
			expect(result.error).toBeUndefined();
		});

		it('should reject non-existent invitation', async () => {
			(InvitationTrackings.findByInviteCode as Mock).mockResolvedValue(null);

			const result = await service.validateInviteCode('INVALID');

			expect(result.isValid).toBe(false);
			expect(result.error).toBe('Invitation not found');
			expect(result.invitation).toBeUndefined();
		});

		it('should reject already accepted invitation', async () => {
			const acceptedInvitation = { ...mockInvitation, isAccepted: true };
			(InvitationTrackings.findByInviteCode as Mock).mockResolvedValue(acceptedInvitation);

			const result = await service.validateInviteCode('ABC12345');

			expect(result.isValid).toBe(false);
			expect(result.error).toBe('Invitation already used');
		});

		it('should reject expired invitation', async () => {
			const expiredInvitation = {
				...mockInvitation,
				expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
			};
			(InvitationTrackings.findByInviteCode as Mock).mockResolvedValue(expiredInvitation);

			const result = await service.validateInviteCode('ABC12345');

			expect(result.isValid).toBe(false);
			expect(result.error).toBe('Invitation expired');
		});
	});

	describe('getInvitationStats', () => {
		it('should return comprehensive invitation statistics', async () => {
			const mockStats = {
				totalSent: 10,
				accepted: 3,
				pending: 7,
				acceptanceRate: 30.0,
			};

			const mockRecentInvitations = [mockInvitation];

			(InvitationTrackings.getInvitationStats as Mock).mockResolvedValue(mockStats);
			(InvitationTrackings.getRecentInvitations as Mock).mockResolvedValue(mockRecentInvitations);

			const result = await service.getInvitationStats('user1');

			expect(result).toEqual({
				...mockStats,
				recentInvitations: mockRecentInvitations,
			});

			expect(InvitationTrackings.getInvitationStats).toHaveBeenCalledWith('user1');
			expect(InvitationTrackings.getRecentInvitations).toHaveBeenCalledWith('user1', 5);
		});
	});

	describe('generateInviteMessage', () => {
		it('should generate personalized message with recipient name', () => {
			const data = {
				inviterId: 'user1',
				recipientName: 'Alice',
				personalMessage: 'You should check this out!',
				inviteUrl: 'https://test.barkle.com/invite/ABC12345',
			};

			const message = service.generateInviteMessage(data);

			expect(message).toContain('Hi Alice!');
			expect(message).toContain('You should check this out!');
			expect(message).toContain('https://test.barkle.com/invite/ABC12345');
		});

		it('should generate generic message without recipient name', () => {
			const data = {
				inviterId: 'user1',
				inviteUrl: 'https://test.barkle.com/invite/ABC12345',
			};

			const message = service.generateInviteMessage(data);

			expect(message).toContain('Hey!');
			expect(message).toContain('https://test.barkle.com/invite/ABC12345');
			expect(message).not.toContain('Hi ');
		});

		it('should include personal message when provided', () => {
			const data = {
				inviterId: 'user1',
				personalMessage: 'This app is amazing!',
				inviteUrl: 'https://test.barkle.com/invite/ABC12345',
			};

			const message = service.generateInviteMessage(data);

			expect(message).toContain('This app is amazing!');
		});
	});

	describe('cleanupExpiredInvitations', () => {
		it('should remove expired invitations', async () => {
			const expiredInvitations = [
				{ ...mockInvitation, id: 'expired1', expiresAt: new Date(Date.now() - 1000) },
				{ ...mockInvitation, id: 'expired2', expiresAt: new Date(Date.now() - 2000) },
			];

			(InvitationTrackings.createQueryBuilder as Mock).mockReturnValue({
				where: vi.fn().mockReturnThis(),
				andWhere: vi.fn().mockReturnThis(),
				getMany: vi.fn().mockResolvedValue(expiredInvitations),
			});

			(InvitationTrackings.remove as Mock).mockResolvedValue(undefined);

			const result = await service.cleanupExpiredInvitations();

			expect(result).toBe(2);
			expect(InvitationTrackings.remove).toHaveBeenCalledWith(expiredInvitations);
		});

		it('should return 0 when no expired invitations exist', async () => {
			(InvitationTrackings.createQueryBuilder as Mock).mockReturnValue({
				where: vi.fn().mockReturnThis(),
				andWhere: vi.fn().mockReturnThis(),
				getMany: vi.fn().mockResolvedValue([]),
			});

			const result = await service.cleanupExpiredInvitations();

			expect(result).toBe(0);
			expect(InvitationTrackings.remove).not.toHaveBeenCalled();
		});
	});

	describe('invitation URL generation', () => {
		it('should generate correct invitation URL', () => {
			const service = new InvitationService('https://custom.domain.com');
			const url = (service as any).generateInviteUrl('TEST1234');

			expect(url).toBe('https://custom.domain.com/invite/TEST1234');
		});

		it('should use default base URL when not provided', () => {
			// Mock process.env.BASE_URL
			const originalEnv = process.env.BASE_URL;
			process.env.BASE_URL = 'https://env.barkle.com';

			const service = new InvitationService();
			const url = (service as any).generateInviteUrl('TEST1234');

			expect(url).toBe('https://env.barkle.com/invite/TEST1234');

			// Restore original env
			process.env.BASE_URL = originalEnv;
		});
	});

	describe('invitation code generation', () => {
		it('should generate 8-character alphanumeric codes', () => {
			const service = new InvitationService();
			const code = (service as any).generateInviteCode();

			expect(code).toMatch(/^[A-Z0-9]{8}$/);
			expect(code).toHaveLength(8);
		});

		it('should generate unique codes', () => {
			const service = new InvitationService();
			const codes = new Set();

			// Generate 100 codes to test uniqueness
			for (let i = 0; i < 100; i++) {
				const code = (service as any).generateInviteCode();
				codes.add(code);
			}

			// Should have high uniqueness (allowing for small chance of collision)
			expect(codes.size).toBeGreaterThan(95);
		});
	});

	describe('expiration date calculation', () => {
		it('should calculate correct expiration date', () => {
			const service = new InvitationService();
			const expiresAt = (service as any).calculateExpirationDate(7);

			const daysDiff = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
			expect(daysDiff).toBeCloseTo(7, 0);
		});

		it('should use default expiration when no days specified', () => {
			const service = new InvitationService();
			const expiresAt = (service as any).calculateExpirationDate();

			const daysDiff = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
			expect(daysDiff).toBeCloseTo(30, 0);
		});
	});

	describe('error handling', () => {
		it('should handle auto-connect errors gracefully', async () => {
			const acceptedInvitation = {
				...mockInvitation,
				isAccepted: true,
				acceptedUserId: 'accepted1',
				acceptedUser: mockAcceptedUser,
				inviter: mockUser,
			};

			(InvitationTrackings.acceptInvitation as Mock).mockResolvedValue(acceptedInvitation);
			(Followings.findOne as Mock).mockRejectedValue(new Error('Database error'));

			// Should not throw error
			await expect(service.acceptInvitation('ABC12345', 'accepted1')).resolves.not.toThrow();
		});

		it('should handle notification errors gracefully', async () => {
			const acceptedInvitation = {
				...mockInvitation,
				isAccepted: true,
				acceptedUserId: 'accepted1',
				acceptedUser: mockAcceptedUser,
				inviter: mockUser,
			};

			(InvitationTrackings.acceptInvitation as Mock).mockResolvedValue(acceptedInvitation);
			(createNotification as Mock).mockRejectedValue(new Error('Notification error'));

			// Should not throw error
			await expect(service.acceptInvitation('ABC12345', 'accepted1')).resolves.not.toThrow();
		});
	});
});