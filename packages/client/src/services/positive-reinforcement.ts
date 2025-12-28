import * as os from '@/os';

export interface MilestoneData {
	type: 'firstNote' | 'firstFollower' | 'firstReaction' | 'noteEngagement' | 'communityContribution' | 'consistentPosting' | 'helpfulInteraction';
	userId: string;
	value?: number;
	context?: any;
}

export interface MilestoneResponse {
	milestone?: string;
	triggered: boolean;
}

export class PositiveReinforcementService {
	/**
	 * Trigger milestone detection for a user action
	 */
	static async triggerMilestone(
		action: 'noteCreated' | 'followerGained' | 'reactionReceived' | 'dailyActivity',
		context?: any
	): Promise<MilestoneResponse> {
		try {
			return await os.api('positive-reinforcement/trigger-milestone', {
				action,
				context
			});
		} catch (error) {
			console.error('Failed to trigger milestone:', error);
			return { triggered: false };
		}
	}

	/**
	 * Recognize helpful community interactions
	 */
	static async recognizeContribution(
		interactionType: 'supportiveReply' | 'encouragingReaction' | 'helpfulMention',
		contribution?: string
	): Promise<{ success: boolean }> {
		try {
			return await os.api('positive-reinforcement/recognize-contribution', {
				interactionType,
				contribution
			});
		} catch (error) {
			console.error('Failed to recognize contribution:', error);
			return { success: false };
		}
	}

	/**
	 * Request supportive suggestions for users with low engagement
	 */
	static async provideSupportiveSuggestions(): Promise<{ success: boolean }> {
		try {
			return await os.api('positive-reinforcement/provide-support', {});
		} catch (error) {
			console.error('Failed to provide supportive suggestions:', error);
			return { success: false };
		}
	}

	/**
	 * Show milestone celebration
	 */
	static showMilestoneCelebration(milestone: MilestoneData): void {
		// This would integrate with the notification system or show a modal
		// For now, we'll use the existing notification system
		os.popup(import('@/components/growth/MilestoneCelebration.vue'), {
			notificationData: {
				customHeader: this.getMilestoneTitle(milestone.type),
				customBody: this.getMilestoneMessage(milestone.type, milestone.value),
				customIcon: this.getMilestoneIcon(milestone.type)
			}
		}, {}, 'closed');
	}

	private static getMilestoneTitle(type: string): string {
		switch (type) {
			case 'firstNote':
				return '🎉 Welcome to Barkle!';
			case 'firstFollower':
				return '👥 Your first follower!';
			case 'firstReaction':
				return '❤️ Your first reaction!';
			case 'noteEngagement':
				return '🔥 Your post is popular!';
			case 'communityContribution':
				return '🌟 Community Champion!';
			case 'consistentPosting':
				return '📅 Consistency Champion!';
			case 'helpfulInteraction':
				return '🤝 Helpful Community Member!';
			default:
				return '✨ Achievement Unlocked!';
		}
	}

	private static getMilestoneMessage(type: string, value?: number): string {
		switch (type) {
			case 'firstNote':
				return `Great job on your first post! You're now part of our amazing community.`;
			case 'firstFollower':
				return `Congratulations! Someone found your content interesting enough to follow you.`;
			case 'firstReaction':
				return `Someone loved your post! Your content is making people smile.`;
			case 'noteEngagement':
				return `Amazing! Your post has ${value || 0} reactions. You're really connecting with people!`;
			case 'communityContribution':
				return `You're making Barkle a better place with your positive interactions and helpful contributions!`;
			case 'consistentPosting':
				return `You've been active for ${value || 0} days! Your dedication to the community is inspiring.`;
			case 'helpfulInteraction':
				return `Your supportive comments and reactions are making others feel welcome. Thank you for being so kind!`;
			default:
				return `Keep being amazing on Barkle!`;
		}
	}

	private static getMilestoneIcon(type: string): string {
		switch (type) {
			case 'firstNote':
				return '🎉';
			case 'firstFollower':
				return '👥';
			case 'firstReaction':
				return '❤️';
			case 'noteEngagement':
				return '🔥';
			case 'communityContribution':
				return '🌟';
			case 'consistentPosting':
				return '📅';
			case 'helpfulInteraction':
				return '🤝';
			default:
				return '✨';
		}
	}
}