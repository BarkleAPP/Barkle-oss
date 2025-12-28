import { Users, UserProfiles, Followings, Notes, NoteReactions, NotificationSchedules } from '@/models/index.js';
import { User } from '@/models/entities/user.js';
import { ActiveUsersService } from './active-users-service.js';
import { MoreThan, LessThan } from 'typeorm';
import config from '@/config/index.js';

const HOUR = 1000 * 60 * 60;
const DAY = 1000 * 60 * 60 * 24;

interface ReminderData {
    title: string;
    body: string;
    icon?: string;
    clickAction?: string;
    type: 'social_reminder';
    category: 'friend_activity' | 'trending_content' | 'missed_activity' | 'engagement_received';
}

/**
 * Reminder Notification Service
 * Sends ethical, truthful reminder notifications when platform activity drops
 */
export class ReminderNotificationService {
    /**
     * Check if platform activity is low and reminders should be sent
     */
    static async shouldSendReminders(): Promise<boolean> {
        const metrics = await ActiveUsersService.getActiveUserMetrics();

        // Send reminders when:
        // 1. Active users in last hour is less than 20% of 24h active users
        // 2. OR active users in last 6h is less than 40% of 24h active users
        const hourlyRatio = metrics.activeUsersLast1h / Math.max(metrics.activeUsersLast24h, 1);
        const sixHourRatio = metrics.activeUsersLast6h / Math.max(metrics.activeUsersLast24h, 1);

        return hourlyRatio < 0.2 || sixHourRatio < 0.4;
    }

    /**
     * Get users eligible for reminder notifications
     * Users who haven't been active in 12-72 hours
     */
    static async getEligibleUsers(limit: number = 50): Promise<User[]> {
        const now = Date.now();
        const twelveHoursAgo = new Date(now - 12 * HOUR);
        const threeDaysAgo = new Date(now - 3 * DAY);

        return await Users.createQueryBuilder('user')
            .innerJoin('user_profile', 'profile', 'profile.userId = user.id')
            .where('user.host IS NULL') // Local users only
            .andWhere('user.lastActiveDate < :twelveHoursAgo', { twelveHoursAgo })
            .andWhere('user.lastActiveDate > :threeDaysAgo', { threeDaysAgo })
            .andWhere('profile.receiveSocialReminders = true') // Respect user preferences
            .orderBy('user.lastActiveDate', 'ASC')
            .limit(limit)
            .getMany();
    }

    /**
     * Generate truthful reminder notification based on real platform activity
     */
    static async generateReminderNotification(user: User): Promise<ReminderData | null> {
        const userProfile = await UserProfiles.findOneBy({ userId: user.id });
        if (!userProfile || !userProfile.receiveSocialReminders) {
            return null;
        }

        // Get real data about what's happening
        const [friendsActivity, trendingContent, engagementReceived, newFollowers] = await Promise.all([
            this.getFriendsActivityCount(user.id),
            this.getTrendingContentCount(),
            this.getEngagementReceivedCount(user.id),
            this.getNewFollowersCount(user.id),
        ]);

        // Generate truthful notification based on actual data
        const notifications: ReminderData[] = [];

        // Friend activity notification
        if (friendsActivity.activeCount > 0) {
            notifications.push({
                title: 'Your friends are active',
                body: `${friendsActivity.activeCount} of your friends ${friendsActivity.activeCount === 1 ? 'has' : 'have'} posted recently`,
                icon: '/static-assets/icons/192.png',
                clickAction: '/',
                type: 'social_reminder',
                category: 'friend_activity',
            });
        }

        // Trending content notification
        if (trendingContent.count > 0) {
            notifications.push({
                title: 'New trending content',
                body: `${trendingContent.count} trending ${trendingContent.count === 1 ? 'post' : 'posts'} in your community`,
                icon: '/static-assets/icons/192.png',
                clickAction: '/',
                type: 'social_reminder',
                category: 'trending_content',
            });
        }

        // Engagement received notification
        if (engagementReceived.count > 0) {
            const types: string[] = [];
            if (engagementReceived.reactions > 0) types.push('reactions');
            if (engagementReceived.replies > 0) types.push('replies');
            if (engagementReceived.renotes > 0) types.push('shares');

            notifications.push({
                title: 'You have new activity',
                body: `${engagementReceived.count} new ${types.join(', ')} on your posts`,
                icon: '/static-assets/icons/192.png',
                clickAction: '/notifications',
                type: 'social_reminder',
                category: 'engagement_received',
            });
        }

        // New followers notification
        if (newFollowers > 0) {
            notifications.push({
                title: 'You have new followers',
                body: `${newFollowers} ${newFollowers === 1 ? 'person has' : 'people have'} followed you`,
                icon: '/static-assets/icons/192.png',
                clickAction: '/notifications',
                type: 'social_reminder',
                category: 'engagement_received',
            });
        }

        // If no real activity, send a generic but truthful reminder
        if (notifications.length === 0 && user.lastActiveDate) {
            // Check when they were last active
            const daysSinceActive = Math.floor((Date.now() - user.lastActiveDate.getTime()) / DAY);

            if (daysSinceActive >= 1) {
                notifications.push({
                    title: 'Check in with your community',
                    body: `See what's new on Barkle`,
                    icon: '/static-assets/icons/192.png',
                    clickAction: '/',
                    type: 'social_reminder',
                    category: 'missed_activity',
                });
            }
        }

        // Return random notification from available options
        if (notifications.length > 0) {
            return notifications[Math.floor(Math.random() * notifications.length)];
        }

        return null;
    }

    /**
     * Schedule reminder notifications for eligible users
     */
    static async scheduleReminders(): Promise<{ scheduled: number; skipped: number }> {
        // Check if we should send reminders based on platform activity
        const shouldSend = await this.shouldSendReminders();
        if (!shouldSend) {
            return { scheduled: 0, skipped: 0 };
        }

        const eligibleUsers = await this.getEligibleUsers(50);
        let scheduled = 0;
        let skipped = 0;

        for (const user of eligibleUsers) {
            try {
                // Check if user already has a pending reminder
                const existingReminder = await NotificationSchedules.createQueryBuilder('schedule')
                    .where('schedule.userId = :userId', { userId: user.id })
                    .andWhere('schedule.type = :type', { type: 'social_reminder' })
                    .andWhere('schedule.sentAt IS NULL')
                    .andWhere('schedule.isActive = true')
                    .getOne();

                if (existingReminder) {
                    skipped++;
                    continue;
                }

                // Generate notification content
                const reminderData = await this.generateReminderNotification(user);
                if (!reminderData) {
                    skipped++;
                    continue;
                }

                // Schedule notification with a random delay (1-6 hours)
                const delayHours = 1 + Math.floor(Math.random() * 5);
                const scheduledAt = new Date(Date.now() + delayHours * HOUR);

                await NotificationSchedules.scheduleNotification(
                    user.id,
                    'social_reminder',
                    scheduledAt,
                    reminderData
                );

                scheduled++;
            } catch (error) {
                console.error(`Failed to schedule reminder for user ${user.id}:`, error);
                skipped++;
            }
        }

        return { scheduled, skipped };
    }

    /**
     * Get count of friends who have been active recently
     */
    private static async getFriendsActivityCount(userId: string): Promise<{ activeCount: number; postCount: number }> {
        const cutoff = new Date(Date.now() - 12 * HOUR);

        // Get user's following list
        const following = await Followings.createQueryBuilder('f')
            .where('f.followerId = :userId', { userId })
            .select('f.followeeId')
            .getMany();

        const followingIds = following.map(f => f.followeeId);

        if (followingIds.length === 0) {
            return { activeCount: 0, postCount: 0 };
        }

        // Count friends who posted recently
        const activeFriends = await Notes.createQueryBuilder('note')
            .where('note.userId IN (:...followingIds)', { followingIds })
            .andWhere('note.createdAt > :cutoff', { cutoff })
            .select('DISTINCT note.userId')
            .getRawMany();

        // Count total posts from friends
        const postCount = await Notes.count({
            where: {
                userId: In(followingIds),
                createdAt: MoreThan(cutoff),
            },
        });

        return {
            activeCount: activeFriends.length,
            postCount,
        };
    }

    /**
     * Get count of trending content
     */
    private static async getTrendingContentCount(): Promise<{ count: number }> {
        const cutoff = new Date(Date.now() - 6 * HOUR);

        // Get posts with significant engagement in the last 6 hours
        const trendingPosts = await Notes.createQueryBuilder('note')
            .where('note.createdAt > :cutoff', { cutoff })
            .andWhere('note.userHost IS NULL') // Local posts only
            .andWhere(
                '(COALESCE(note.renoteCount, 0) + COALESCE(note.repliesCount, 0) + ' +
                '(SELECT COUNT(*) FROM note_reaction WHERE noteId = note.id)) >= :threshold',
                { threshold: 5 }
            )
            .getCount();

        return { count: trendingPosts };
    }

    /**
     * Get count of engagement received on user's posts
     */
    private static async getEngagementReceivedCount(userId: string): Promise<{
        count: number;
        reactions: number;
        replies: number;
        renotes: number;
    }> {
        const cutoff = new Date(Date.now() - 12 * HOUR);
        const userLastActive = await Users.findOneBy({ id: userId });

        if (!userLastActive || !userLastActive.lastActiveDate) {
            return { count: 0, reactions: 0, replies: 0, renotes: 0 };
        }

        // Get user's recent posts (from before they went inactive)
        const userNotes = await Notes.createQueryBuilder('note')
            .where('note.userId = :userId', { userId })
            .andWhere('note.createdAt > :cutoff', { cutoff: new Date(Date.now() - 7 * DAY) })
            .select('note.id')
            .getMany();

        const noteIds = userNotes.map(n => n.id);

        if (noteIds.length === 0) {
            return { count: 0, reactions: 0, replies: 0, renotes: 0 };
        }

        const lastActiveDate = userLastActive.lastActiveDate;

        // Count engagement since user was last active
        const [reactions, replies, renotes] = await Promise.all([
            NoteReactions.createQueryBuilder('reaction')
                .where('reaction.noteId IN (:...noteIds)', { noteIds })
                .andWhere('reaction.createdAt > :lastActive', { lastActive: lastActiveDate })
                .getCount(),
            Notes.createQueryBuilder('note')
                .where('note.replyId IN (:...noteIds)', { noteIds })
                .andWhere('note.createdAt > :lastActive', { lastActive: lastActiveDate })
                .getCount(),
            Notes.createQueryBuilder('note')
                .where('note.renoteId IN (:...noteIds)', { noteIds })
                .andWhere('note.createdAt > :lastActive', { lastActive: lastActiveDate })
                .getCount(),
        ]);

        return {
            count: reactions + replies + renotes,
            reactions,
            replies,
            renotes,
        };
    }

    /**
     * Get count of new followers since user was last active
     */
    private static async getNewFollowersCount(userId: string): Promise<number> {
        const user = await Users.findOneBy({ id: userId });
        if (!user || !user.lastActiveDate) return 0;

        return await Followings.createQueryBuilder('f')
            .where('f.followeeId = :userId', { userId })
            .andWhere('f.createdAt > :lastActive', { lastActive: user.lastActiveDate })
            .getCount();
    }
}

// Import statement fix for In operator
import { In } from 'typeorm';
