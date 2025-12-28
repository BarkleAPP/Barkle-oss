import { Users, Notes, Followings, NoteReactions, UserProfiles } from '@/models/index.js';
import { User } from '@/models/entities/user.js';
import { Note } from '@/models/entities/note.js';
import { createNotification } from './create-notification.js';
import { genId } from '@/misc/gen-id.js';

export interface MilestoneData {
	type: 'firstNote' | 'firstFollower' | 'firstReaction' | 'noteEngagement' | 'communityContribution' | 'consistentPosting' | 'helpfulInteraction';
	userId: string;
	value?: number;
	context?: any;
}

export interface EncouragementMessage {
	title: string;
	body: string;
	icon?: string;
	actionText?: string;
	actionUrl?: string;
}

export class PositiveReinforcementService {
	/**
	 * Detect and celebrate user milestones
	 */
	static async detectMilestone(userId: string, action: string, context?: any): Promise<MilestoneData | null> {
		const user = await Users.findOneBy({ id: userId });
		if (!user) return null;

		switch (action) {
			case 'noteCreated':
				return await this.checkNoteCreationMilestones(user, context);
			case 'followerGained':
				return await this.checkFollowerMilestones(user);
			case 'reactionReceived':
				return await this.checkReactionMilestones(user, context);
			case 'dailyActivity':
				return await this.checkActivityMilestones(user);
			default:
				return null;
		}
	}

	/**
	 * Generate personalized encouragement messages
	 */
	static generateEncouragementMessage(milestone: MilestoneData, user: User): EncouragementMessage {
		const userName = user.name || user.username;

		switch (milestone.type) {
			case 'firstNote':
				return {
					title: '🎉 Welcome to Barkle!',
					body: `Great job on your first bark, ${userName}! You're now part of our amazing community.`,
					icon: '🎉',
					actionText: 'Share another thought',
					actionUrl: '/compose'
				};

			case 'firstFollower':
				return {
					title: '👥 You have your first follower!',
					body: `Congratulations ${userName}! Someone found your content interesting enough to follow you.`,
					icon: '👥',
					actionText: 'See your followers',
					actionUrl: `/@${user.username}/followers`
				};

			case 'firstReaction':
				return {
					title: '❤️ Your first reaction!',
					body: `Someone loved your bark, ${userName}! Your content is making people smile.`,
					icon: '❤️',
					actionText: 'Keep sharing',
					actionUrl: '/compose'
				};

			case 'noteEngagement':
				const engagementCount = milestone.value || 0;
				return {
					title: '🔥 Your post is popular!',
					body: `Amazing ${userName}! Your bark has ${engagementCount} reactions. You're really connecting with people!`,
					icon: '🔥',
					actionText: 'View your post',
					actionUrl: milestone.context?.noteUrl || '/timeline'
				};

			case 'communityContribution':
				return {
					title: '🌟 Community Champion!',
					body: `${userName}, you're making Barkle a better place with your positive interactions and helpful contributions!`,
					icon: '🌟',
					actionText: 'Keep being awesome',
					actionUrl: '/timeline'
				};

			case 'consistentPosting':
				const days = milestone.value || 0;
				return {
					title: '📅 Consistency Champion!',
					body: `${userName}, you've been active for ${days} days in a row! Your dedication to the community is inspiring.`,
					icon: '📅',
					actionText: 'Continue your streak',
					actionUrl: '/compose'
				};

			case 'helpfulInteraction':
				return {
					title: '🤝 Helpful Community Member!',
					body: `${userName}, your supportive comments and reactions are making others feel welcome. Thank you for being so kind!`,
					icon: '🤝',
					actionText: 'Spread more kindness',
					actionUrl: '/timeline'
				};

			default:
				return {
					title: '✨ Keep being amazing!',
					body: `${userName}, you're doing great on Barkle! Keep sharing and connecting with others.`,
					icon: '✨'
				};
		}
	}

	/**
	 * Send positive reinforcement notification
	 */
	static async sendPositiveReinforcement(milestone: MilestoneData): Promise<void> {
		const user = await Users.findOneBy({ id: milestone.userId });
		if (!user) return;

		const message = this.generateEncouragementMessage(milestone, user);

		await createNotification(milestone.userId, 'app', {
			customHeader: message.title,
			customBody: message.body,
			customIcon: message.icon,
		});
	}

	/**
	 * Check for note creation milestones
	 */
	private static async checkNoteCreationMilestones(user: User, note?: Note): Promise<MilestoneData | null> {
		// First note milestone
		if (user.notesCount === 1) {
			return {
				type: 'firstNote',
				userId: user.id,
				context: { noteId: note?.id }
			};
		}

		// Milestone posts (10, 50, 100, etc.)
		const milestones = [10, 50, 100, 250, 500, 1000];
		if (milestones.includes(user.notesCount)) {
			return {
				type: 'consistentPosting',
				userId: user.id,
				value: user.notesCount,
				context: { noteId: note?.id }
			};
		}

		return null;
	}

	/**
	 * Check for follower milestones
	 */
	private static async checkFollowerMilestones(user: User): Promise<MilestoneData | null> {
		// First follower milestone
		if (user.followersCount === 1) {
			return {
				type: 'firstFollower',
				userId: user.id
			};
		}

		// Follower milestones (10, 25, 50, 100, etc.)
		const milestones = [10, 25, 50, 100, 250, 500, 1000];
		if (milestones.includes(user.followersCount)) {
			return {
				type: 'communityContribution',
				userId: user.id,
				value: user.followersCount
			};
		}

		return null;
	}

	/**
	 * Check for reaction milestones
	 */
	private static async checkReactionMilestones(user: User, context?: any): Promise<MilestoneData | null> {
		if (!context?.noteId) return null;

		// Check if this is the user's first reaction ever
		const totalReactions = await NoteReactions.createQueryBuilder('reaction')
			.innerJoin('reaction.note', 'note')
			.where('note.userId = :userId', { userId: user.id })
			.getCount();

		if (totalReactions === 1) {
			return {
				type: 'firstReaction',
				userId: user.id,
				context: { noteId: context.noteId }
			};
		}

		// Check if this specific note has reached engagement milestones
		const noteReactions = await NoteReactions.countBy({ noteId: context.noteId });
		const engagementMilestones = [5, 10, 25, 50, 100];

		if (engagementMilestones.includes(noteReactions)) {
			return {
				type: 'noteEngagement',
				userId: user.id,
				value: noteReactions,
				context: {
					noteId: context.noteId,
					noteUrl: `/notes/${context.noteId}`
				}
			};
		}

		return null;
	}

	/**
	 * Check for activity milestones
	 */
	private static async checkActivityMilestones(user: User): Promise<MilestoneData | null> {
		// Check for consistent daily activity
		const profile = await UserProfiles.findOneBy({ userId: user.id });
		if (!profile) return null;

		// Calculate consecutive active days (simplified - in real implementation, 
		// you'd track this more precisely with daily activity logs)
		const daysSinceJoined = Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24));
		const activityRatio = user.notesCount / Math.max(daysSinceJoined, 1);

		// If user has been consistently active (at least 1 post every 3 days on average)
		if (activityRatio >= 0.33 && daysSinceJoined >= 7) {
			const streakMilestones = [7, 14, 30, 60, 100];
			if (streakMilestones.includes(daysSinceJoined)) {
				return {
					type: 'consistentPosting',
					userId: user.id,
					value: daysSinceJoined
				};
			}
		}

		return null;
	}

	/**
	 * Recognize helpful community interactions
	 */
	static async recognizeHelpfulInteraction(userId: string, interactionType: 'supportiveReply' | 'encouragingReaction' | 'helpfulMention'): Promise<void> {
		// Track positive interactions over time
		const recentInteractions = await this.countRecentPositiveInteractions(userId);

		// If user has been consistently helpful (5+ positive interactions in last week)
		if (recentInteractions >= 5) {
			const milestone: MilestoneData = {
				type: 'helpfulInteraction',
				userId: userId,
				value: recentInteractions
			};

			await this.sendPositiveReinforcement(milestone);
		}
	}

	/**
	 * Count recent positive interactions (simplified implementation)
	 */
	private static async countRecentPositiveInteractions(userId: string): Promise<number> {
		const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

		// Count reactions given by user in the last week
		const reactions = await NoteReactions.createQueryBuilder('reaction')
			.where('reaction.userId = :userId', { userId })
			.andWhere('reaction.createdAt > :date', { date: oneWeekAgo })
			.getCount();

		// Count replies by user in the last week (simplified)
		const replies = await Notes.createQueryBuilder('note')
			.where('note.userId = :userId', { userId })
			.andWhere('note.replyId IS NOT NULL')
			.andWhere('note.createdAt > :date', { date: oneWeekAgo })
			.getCount();

		return reactions + replies;
	}

	/**
	 * Provide supportive suggestions for users with low engagement
	 */
	static async provideSupportiveSuggestions(userId: string): Promise<void> {
		const user = await Users.findOneBy({ id: userId });
		if (!user) return;

		// Check if user needs encouragement (low activity, few followers, etc.)
		const needsEncouragement = await this.assessNeedForEncouragement(user);

		if (needsEncouragement) {
			const encouragementMessage: EncouragementMessage = {
				title: '💪 You\'re doing great!',
				body: `${user.name || user.username}, every great community member started somewhere. Your unique perspective matters here!`,
				icon: '💪',
				actionText: 'Share your thoughts',
				actionUrl: '/compose'
			};

			await createNotification(userId, 'app', {
				customHeader: encouragementMessage.title,
				customBody: encouragementMessage.body,
				customIcon: encouragementMessage.icon,
			});
		}
	}

	/**
	 * Assess if user needs encouragement
	 */
	private static async assessNeedForEncouragement(user: User): Promise<boolean> {
		const daysSinceJoined = Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24));

		// New users (less than 7 days) with low activity
		if (daysSinceJoined <= 7 && user.notesCount < 3) {
			return true;
		}

		// Established users (more than 7 days) with very low engagement
		if (daysSinceJoined > 7 && user.followersCount === 0 && user.notesCount < 5) {
			return true;
		}

		return false;
	}

	/**
	 * Highlight user's unique value to the community
	 */
	static async highlightUniqueValue(userId: string, contribution: string): Promise<void> {
		const user = await Users.findOneBy({ id: userId });
		if (!user) return;

		const message: EncouragementMessage = {
			title: '🌟 Your unique contribution!',
			body: `${user.name || user.username}, your ${contribution} brings something special to our community. Thank you for being you!`,
			icon: '🌟',
			actionText: 'Keep sharing',
			actionUrl: '/timeline'
		};

		await createNotification(userId, 'app', {
			customHeader: message.title,
			customBody: message.body,
			customIcon: message.icon,
		});
	}
}