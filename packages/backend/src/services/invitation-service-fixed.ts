import { genId } from '@/misc/gen-id.js';
import { InvitationTrackings, Users, Followings } from '@/models/index.js';
import type { User } from '@/models/entities/user.js';
import type { InvitationTracking } from '@/models/entities/invitation-tracking.js';
import { createNotification } from '@/services/create-notification.js';
import { SubscriptionManagerComprehensive } from '@/services/subscription-manager-comprehensive.js';
import config from '@/config/index.js';
import Logger from '@/services/logger.js';

const logger = new Logger('invitationService');

export interface InvitationData {
    method: 'sms' | 'email' | 'social' | 'link';
    recipientIdentifier?: string;
    recipientName?: string;
    personalMessage?: string;
    expiresAt?: Date;
    metadata?: Record<string, any>;
}

export interface InvitationResult {
    id: string;
    inviteCode: string;
    inviteUrl: string;
    recipient?: string;
    message?: string;
}

export interface InvitationStats {
    totalSent: number;
    accepted: number;
    pending: number;
    acceptanceRate: number;
    recentInvitations: InvitationTracking[];
}

export class InvitationService {
    private readonly baseUrl: string;
    private readonly defaultExpirationDays: number = 30;

    constructor() {
        this.baseUrl = config.url;
    }

    /**
     * Generate invite code (use user ID for simplicity and reusability)
     */
    private generateInviteCode(inviterId: string): string {
        return inviterId;
    }

    /**
     * Generate invitation URL
     */
    private generateInviteUrl(inviteCode: string): string {
        return `${this.baseUrl}/invite/${inviteCode}`;
    }

    /**
     * Calculate expiration date
     */
    private calculateExpirationDate(days: number = this.defaultExpirationDays): Date {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + days);
        return expiresAt;
    }

    /**
     * Create a new invitation
     */
    async createInvitation(
        inviterId: string,
        invitationData: InvitationData,
    ): Promise<InvitationResult> {
        // Use user ID as invite code (naturally unique and reusable)
        const inviteCode = this.generateInviteCode(inviterId);

        // Set expiration date if not provided
        const expiresAt = invitationData.expiresAt || this.calculateExpirationDate();

        // For link invitations, we don't need to create a tracking record
        // The user ID serves as the permanent invite code
        if (invitationData.method === 'link') {
            const inviteUrl = this.generateInviteUrl(inviteCode);
            const message = this.generateInviteMessage({
                inviterId,
                recipientName: invitationData.recipientName,
                personalMessage: invitationData.personalMessage,
                inviteUrl,
            });

            return {
                id: genId(), // Generate a temporary ID for consistency
                inviteCode,
                inviteUrl,
                recipient: invitationData.recipientName || invitationData.recipientIdentifier,
                message,
            };
        }

        // For email/SMS invitations, still create tracking records for analytics
        const invitation = await InvitationTrackings.createInvitation({
            inviterId,
            inviteCode,
            method: invitationData.method,
            recipientIdentifier: invitationData.recipientIdentifier,
            recipientName: invitationData.recipientName,
            expiresAt,
            metadata: {
                ...invitationData.metadata,
                personalMessage: invitationData.personalMessage,
                createdVia: 'api',
            },
        });

        const inviteUrl = this.generateInviteUrl(inviteCode);

        // Generate invitation message if needed
        const message = this.generateInviteMessage({
            inviterId,
            recipientName: invitationData.recipientName,
            personalMessage: invitationData.personalMessage,
            inviteUrl,
        });

        return {
            id: invitation.id,
            inviteCode,
            inviteUrl,
            recipient: invitationData.recipientName || invitationData.recipientIdentifier,
            message: invitationData.method === 'link' ? message : undefined,
        };
    }

    /**
     * Process invitation during signup (user ID-based) - FIXED WITH TRANSACTION & IDEMPOTENCY
     */
    async processInvitationForNewUser(
        inviteCode: string,
        newUserId: string,
    ): Promise<any> {
        console.log(`🎁 INVITATION: Processing invitation ${inviteCode} for user ${newUserId}`);

        // CRITICAL FIX: Prevent self-invitation FIRST
        if (inviteCode === newUserId) {
            throw new Error('Cannot accept your own invitation');
        }

        // CRITICAL FIX: Check for duplicate processing (idempotency)
        const existingInvitation = await InvitationTrackings.findOne({
            where: {
                inviteCode,
                metadata: { acceptedUserId: newUserId } as any,
            },
        });

        if (existingInvitation) {
            console.log(`🎁 INVITATION: Already processed for user ${newUserId}, skipping duplicate`);
            // Return existing invitation to maintain idempotency
            const inviter = await Users.findOneBy({ id: inviteCode });
            const newUser = await Users.findOneBy({ id: newUserId });
            return {
                id: existingInvitation.id,
                inviteCode,
                inviterId: inviteCode,
                inviter,
                acceptedUserId: newUserId,
                acceptedUser: newUser,
                isAccepted: true,
                acceptedAt: existingInvitation.createdAt,
                method: 'link',
            };
        }

        // Validate that the invite code is a valid user ID
        const inviter = await Users.findOneBy({ id: inviteCode });

        if (!inviter) {
            throw new Error('Invalid invitation code');
        }

        // Double-check self-invitation (defensive)
        if (inviter.id === newUserId) {
            throw new Error('Cannot accept your own invitation');
        }

        // Get the new user
        const newUser = await Users.findOneBy({ id: newUserId });
        if (!newUser) {
            throw new Error('New user not found');
        }

        console.log(`🎁 INVITATION: Valid invitation from ${inviter.username} to ${newUser.username}`);

        // CRITICAL FIX: Use transaction for atomicity
        const queryRunner = Users.manager.connection.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            // Automatically follow the inviter
            await this.autoConnectUsers(inviter.id, newUserId);

            // Reward both parties with a week of Barkle+ (SIMPLIFIED)
            await this.rewardInvitationParties(inviter.id, newUserId);

            // CRITICAL FIX: Commit transaction on success
            await queryRunner.commitTransaction();
        } catch (error) {
            // CRITICAL FIX: Rollback on any failure
            await queryRunner.rollbackTransaction();
            console.error('❌ INVITATION ERROR: Transaction rolled back:', error);
            throw error;
        } finally {
            await queryRunner.release();
        }

        // Create a tracking record for analytics
        try {
            await InvitationTrackings.createInvitation({
                inviterId: inviter.id,
                inviteCode,
                method: 'link',
                recipientIdentifier: newUser.username,
                recipientName: newUser.name,
                expiresAt: null,
                metadata: {
                    acceptedAt: new Date(),
                    acceptedUserId: newUserId,
                    isNewSignup: true,
                    createdVia: 'signup',
                },
            });
        } catch (error) {
            // Don't fail if tracking fails
            logger.error('Failed to create invitation tracking record:', error as Error);
        }

        // Notify the inviter that their invitation was accepted
        await this.notifyInviterOfAcceptance(inviter, newUser);

        // Create a simplified invitation object for return
        const invitation = {
            id: genId(),
            inviteCode,
            inviterId: inviter.id,
            inviter,
            acceptedUserId: newUserId,
            acceptedUser: newUser,
            isAccepted: true,
            acceptedAt: new Date(),
            method: 'link',
        };

        return invitation;
    }

    /**
     * SIMPLIFIED REWARD SYSTEM - Uses reliable subscription manager
     */
    private async rewardInvitationParties(inviterId: string, acceptedUserId: string): Promise<void> {
        console.log(`🎁 REWARD: Starting SIMPLIFIED reward process for ${inviterId} and ${acceptedUserId}`);

        try {
            // Use the comprehensive subscription manager for proper credit handling
            // Invitation rewards are 1-week Barkle+ credits that stack properly
            const [inviterSuccess, acceptedUserSuccess] = await Promise.all([
                SubscriptionManagerComprehensive.addCredits(inviterId, 'plus', 'invitation'), // 1 week invitation credit
                SubscriptionManagerComprehensive.addCredits(acceptedUserId, 'plus', 'invitation') // 1 week invitation credit
            ]);

            if (inviterSuccess && acceptedUserSuccess) {
                console.log(`🎁 REWARD SUCCESS: Both users received 1-week Barkle+ invitation credits`);
                logger.info(`🎁 INVITATION REWARD SUCCESS: Invitation credits granted to ${inviterId} and ${acceptedUserId}`);

                // Create notifications (non-blocking)
                this.createRewardNotifications(inviterId, acceptedUserId).catch(error => {
                    console.error('❌ REWARD: Notification creation failed:', error);
                });
            } else {
                console.error(`❌ REWARD ERROR: Credit grant failed - Inviter: ${inviterSuccess}, New user: ${acceptedUserSuccess}`);
                logger.error(`Invitation reward failed - Inviter: ${inviterSuccess}, New user: ${acceptedUserSuccess}`);
            }

        } catch (error) {
            console.error('❌ REWARD ERROR: Failed to reward invitation parties:', error);
            logger.error('Failed to reward invitation parties:', error as Error);
            // Don't throw - invitation should still succeed
        }
    }

    /**
     * Create reward notifications (separated for non-blocking execution)
     */
    private async createRewardNotifications(inviterId: string, acceptedUserId: string): Promise<void> {
        try {
            await Promise.all([
                createNotification(inviterId, 'invitationReward', {
                    customHeader: '🎉 Invitation Reward!',
                    customBody: 'You received 1 week of Barkle+ for inviting a friend!',
                    customIcon: '🎁',
                }),
                createNotification(acceptedUserId, 'invitationReward', {
                    customHeader: '🎉 Welcome Reward!',
                    customBody: 'You received 1 week of Barkle+ for joining through an invitation!',
                    customIcon: '🎁',
                }),
            ]);
            console.log(`🎁 REWARD: Notifications created successfully`);
        } catch (error) {
            console.error('❌ REWARD: Failed to create notifications:', error);
        }
    }

    /**
     * Automatically connect users when invitation is accepted (mutual following)
     */
    private async autoConnectUsers(inviterId: string, acceptedUserId: string): Promise<void> {
        try {
            // Create mutual following relationships
            await this.createMutualFollowing(inviterId, acceptedUserId);

            // Trigger viral growth tracking for invitation-based connections
            const { ViralGrowthService } = await import('./viral-growth.js');
            await ViralGrowthService.processInvitationAcceptance(
                '', // invite code not needed here
                acceptedUserId
            );
        } catch (error) {
            logger.error('Failed to auto-connect users:', error as Error);
        }
    }

    /**
     * Create mutual following relationships between two users
     */
    private async createMutualFollowing(user1Id: string, user2Id: string): Promise<void> {
        // Check existing relationships
        const [follow1to2, follow2to1] = await Promise.all([
            Followings.findOne({
                where: {
                    followerId: user1Id,
                    followeeId: user2Id,
                },
            }),
            Followings.findOne({
                where: {
                    followerId: user2Id,
                    followeeId: user1Id,
                },
            }),
        ]);

        const followsToCreate = [];
        const userUpdates = [];

        // Create user1 -> user2 follow if it doesn't exist
        if (!follow1to2) {
            followsToCreate.push({
                id: genId(),
                followerId: user1Id,
                followeeId: user2Id,
                createdAt: new Date(),
            });

            // Update counts
            userUpdates.push(
                Users.increment({ id: user2Id }, 'followersCount', 1),
                Users.increment({ id: user1Id }, 'followingCount', 1)
            );
        }

        // Create user2 -> user1 follow if it doesn't exist
        if (!follow2to1) {
            followsToCreate.push({
                id: genId(),
                followerId: user2Id,
                followeeId: user1Id,
                createdAt: new Date(),
            });

            // Update counts
            userUpdates.push(
                Users.increment({ id: user1Id }, 'followersCount', 1),
                Users.increment({ id: user2Id }, 'followingCount', 1)
            );
        }

        // Execute all database operations
        if (followsToCreate.length > 0) {
            await Promise.all([
                Followings.save(followsToCreate),
                ...userUpdates,
            ]);
        }
    }

    /**
     * Notify inviter that someone accepted their invitation (simplified version)
     */
    private async notifyInviterOfAcceptance(inviter: any, acceptedUser: any): Promise<void> {
        try {
            await createNotification(inviter.id, 'invitationAccepted', {
                notifierId: acceptedUser.id,
                customHeader: 'New Connection!',
                customBody: `${acceptedUser.name || acceptedUser.username} joined Barkle through your invitation link!`,
            });
        } catch (error) {
            logger.error('Failed to send invitation accepted notification:', error as Error);
        }
    }

    /**
     * Generate personalized invitation message
     */
    generateInviteMessage(data: {
        inviterId: string;
        recipientName?: string;
        personalMessage?: string;
        inviteUrl: string;
    }): string {
        const recipientPart = data.recipientName ? `Hi ${data.recipientName}! ` : 'Hey! ';
        const personalPart = data.personalMessage ? `${data.personalMessage}\n\n` : '';

        return `${recipientPart}I'm using Barkle and thought you'd love it too! ${personalPart}Join me here: ${data.inviteUrl}`;
    }

    /**
     * Get invitation statistics for a user
     */
    async getInvitationStats(inviterId: string): Promise<InvitationStats> {
        const stats = await InvitationTrackings.getInvitationStats(inviterId);
        const recentInvitations = await InvitationTrackings.getRecentInvitations(inviterId, 5);

        return {
            ...stats,
            recentInvitations,
        };
    }

    /**
     * Validate invitation code (user ID)
     */
    async validateInviteCode(inviteCode: string): Promise<{
        isValid: boolean;
        invitation?: any; // Simplified invitation object
        error?: string;
    }> {
        // Check if the invite code is a valid user ID
        const inviter = await Users.findOneBy({ id: inviteCode });

        if (!inviter) {
            return {
                isValid: false,
                error: 'Invitation not found',
            };
        }

        // Create a simplified invitation object for compatibility
        const invitation = {
            id: genId(),
            inviteCode,
            inviterId: inviter.id,
            inviter,
            method: 'link',
            isAccepted: false, // Always false since we don't track individual acceptances
            createdAt: inviter.createdAt,
            expiresAt: null, // User-based invites never expire
            personalMessage: null,
        };

        return {
            isValid: true,
            invitation,
        };
    }
}