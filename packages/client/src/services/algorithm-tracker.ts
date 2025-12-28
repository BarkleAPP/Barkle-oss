import * as os from '@/os';
import { $i } from '@/account';

export interface AlgorithmInteraction {
	contentId: string;
	interactionType: 'reaction' | 'share' | 'comment' | 'view' | 'dwell' | 'skip' | 'block' | 'renote';
	reactionType?: string;
	duration?: number;
	context: {
		deviceType: 'mobile' | 'desktop' | 'tablet';
		timeOfDay?: number;
		sessionId: string;
		scrollPosition?: number;
		viewportSize?: { width: number; height: number };
	};
}

class AlgorithmTracker {
	private sessionId: string;
	private viewStartTimes = new Map<string, number>();
	private isEnabled = true;

	constructor() {
		this.sessionId = this.generateSessionId();
	}

	private generateSessionId(): string {
		return Math.random().toString(36).substring(2) + Date.now().toString(36);
	}

	private getDeviceType(): 'mobile' | 'desktop' | 'tablet' {
		const width = window.innerWidth;
		if (width < 768) return 'mobile';
		if (width < 1024) return 'tablet';
		return 'desktop';
	}

	private getContext(): AlgorithmInteraction['context'] {
		return {
			deviceType: this.getDeviceType(),
			timeOfDay: new Date().getHours(),
			sessionId: this.sessionId,
			scrollPosition: window.scrollY,
			viewportSize: {
				width: window.innerWidth,
				height: window.innerHeight,
			},
		};
	}

	async trackInteraction(interaction: Omit<AlgorithmInteraction, 'context'>): Promise<void> {
		if (!this.isEnabled || !$i) return;

		try {
			await os.api('algorithm/track-interaction', {
				contentId: interaction.contentId,
				interactionType: interaction.interactionType,
				reactionType: interaction.reactionType,
				duration: interaction.duration,
				context: this.getContext(),
			});
		} catch (error) {
			// Silently fail to avoid disrupting user experience
			console.warn('Failed to track algorithm interaction:', error);
		}
	}

	// Track when a user reacts to content
	async trackReaction(contentId: string, reactionType: string): Promise<void> {
		await this.trackInteraction({
			contentId,
			interactionType: 'reaction',
			reactionType,
		});
	}

	// Track when a user shares/renotes content
	async trackShare(contentId: string): Promise<void> {
		await this.trackInteraction({
			contentId,
			interactionType: 'renote',
		});
	}

	// Track when a user comments/replies to content
	async trackComment(contentId: string): Promise<void> {
		await this.trackInteraction({
			contentId,
			interactionType: 'comment',
		});
	}

	// Track when a user views content
	async trackView(contentId: string): Promise<void> {
		this.viewStartTimes.set(contentId, Date.now());
		await this.trackInteraction({
			contentId,
			interactionType: 'view',
		});
	}

	// Track dwell time when user stops viewing content
	async trackDwell(contentId: string): Promise<void> {
		const startTime = this.viewStartTimes.get(contentId);
		if (startTime) {
			const duration = Date.now() - startTime;
			this.viewStartTimes.delete(contentId);
			
			// Only track dwell if user spent more than 1 second
			if (duration > 1000) {
				await this.trackInteraction({
					contentId,
					interactionType: 'dwell',
					duration,
				});
			}
		}
	}

	// Track when a user skips content (scrolls past quickly)
	async trackSkip(contentId: string): Promise<void> {
		await this.trackInteraction({
			contentId,
			interactionType: 'skip',
		});
	}

	// Track when a user blocks content/user
	async trackBlock(contentId: string): Promise<void> {
		await this.trackInteraction({
			contentId,
			interactionType: 'block',
		});
	}

	// Enable/disable tracking
	setEnabled(enabled: boolean): void {
		this.isEnabled = enabled;
	}

	// Check if tracking is enabled
	isTrackingEnabled(): boolean {
		return this.isEnabled && !!$i;
	}
}

export const algorithmTracker = new AlgorithmTracker();