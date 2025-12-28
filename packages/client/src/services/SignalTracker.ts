import * as os from '@/os';

export interface ClientSignal {
	contentId: string;
	signalType: SignalType;
	context?: SignalContext;
}

export type SignalType = 
	| 'view' | 'dwell_time' | 'reaction_positive' | 'reaction_negative' | 'reply' | 'renote' | 'quote'
	| 'follow' | 'unfollow' | 'mute' | 'block' | 'report'
	| 'click_profile' | 'click_link' | 'share_external'
	| 'scroll_past' | 'negative_feedback';

export interface SignalContext {
	dwellTimeMs?: number;
	scrollDepth?: number;
	timelinePosition?: number;
	deviceType?: string;
	source?: 'timeline' | 'search' | 'notification' | 'direct';
	reactionType?: string;
	reactionSentiment?: 'positive' | 'negative' | 'neutral';
}

class SignalTrackerService {
	private viewStartTimes = new Map<string, number>();
	private batchedSignals: ClientSignal[] = [];
	private batchTimeout: number | null = null;
	private readonly BATCH_SIZE = 10;
	private readonly BATCH_DELAY = 2000; // 2 seconds

	/**
	 * Track when a note comes into view
	 */
	trackView(noteId: string, position?: number): void {
		this.viewStartTimes.set(noteId, Date.now());
		
		this.addSignal({
			contentId: noteId,
			signalType: 'view',
			context: {
				timelinePosition: position,
				source: 'timeline',
				deviceType: this.getDeviceType()
			}
		});
	}

	/**
	 * Track when a note goes out of view (calculate dwell time)
	 */
	trackViewEnd(noteId: string): void {
		const startTime = this.viewStartTimes.get(noteId);
		if (startTime) {
			const dwellTime = Date.now() - startTime;
			this.viewStartTimes.delete(noteId);
			
			// Only track significant dwell times (>1 second)
			if (dwellTime > 1000) {
				this.addSignal({
					contentId: noteId,
					signalType: 'dwell_time',
					context: {
						dwellTimeMs: dwellTime,
						source: 'timeline',
						deviceType: this.getDeviceType()
					}
				});
			}
		}
	}

	/**
	 * Track reaction with sentiment analysis
	 */
	trackReaction(noteId: string, reactionEmoji: string): void {
		const sentiment = this.getReactionSentiment(reactionEmoji);
		const signalType = sentiment === 'positive' ? 'reaction_positive' : 
						 sentiment === 'negative' ? 'reaction_negative' : 'reaction_positive';
		
		this.addSignal({
			contentId: noteId,
			signalType,
			context: {
				reactionType: reactionEmoji,
				reactionSentiment: sentiment,
				source: 'timeline',
				deviceType: this.getDeviceType()
			}
		});
	}

	/**
	 * Track reply action
	 */
	trackReply(noteId: string): void {
		this.addSignal({
			contentId: noteId,
			signalType: 'reply',
			context: {
				source: 'timeline',
				deviceType: this.getDeviceType()
			}
		});
	}

	/**
	 * Track renote action
	 */
	trackRenote(noteId: string): void {
		this.addSignal({
			contentId: noteId,
			signalType: 'renote',
			context: {
				source: 'timeline',
				deviceType: this.getDeviceType()
			}
		});
	}

	/**
	 * Track profile click
	 */
	trackProfileClick(userId: string): void {
		this.addSignal({
			contentId: userId,
			signalType: 'click_profile',
			context: {
				source: 'timeline',
				deviceType: this.getDeviceType()
			}
		});
	}

	/**
	 * Track follow action
	 */
	trackFollow(userId: string): void {
		this.addSignal({
			contentId: userId,
			signalType: 'follow',
			context: {
				source: 'timeline',
				deviceType: this.getDeviceType()
			}
		});
	}

	/**
	 * Track unfollow action
	 */
	trackUnfollow(userId: string): void {
		this.addSignal({
			contentId: userId,
			signalType: 'unfollow',
			context: {
				source: 'timeline',
				deviceType: this.getDeviceType()
			}
		});
	}

	/**
	 * Track scroll past (negative signal)
	 */
	trackScrollPast(noteId: string): void {
		this.addSignal({
			contentId: noteId,
			signalType: 'scroll_past',
			context: {
				source: 'timeline',
				deviceType: this.getDeviceType()
			}
		});
	}

	/**
	 * Track link click
	 */
	trackLinkClick(noteId: string, url: string): void {
		this.addSignal({
			contentId: noteId,
			signalType: 'click_link',
			context: {
				source: 'timeline',
				deviceType: this.getDeviceType()
			}
		});
	}

	/**
	 * Add signal to batch for processing
	 */
	private addSignal(signal: ClientSignal): void {
		this.batchedSignals.push(signal);
		
		// Send batch if it's full
		if (this.batchedSignals.length >= this.BATCH_SIZE) {
			this.sendBatch();
		} else {
			// Set timeout to send batch
			if (this.batchTimeout) {
				clearTimeout(this.batchTimeout);
			}
			this.batchTimeout = window.setTimeout(() => {
				this.sendBatch();
			}, this.BATCH_DELAY);
		}
	}

	/**
	 * Send batched signals to backend
	 */
	private async sendBatch(): void {
		if (this.batchedSignals.length === 0) return;
		
		const signals = [...this.batchedSignals];
		this.batchedSignals = [];
		
		if (this.batchTimeout) {
			clearTimeout(this.batchTimeout);
			this.batchTimeout = null;
		}

		try {
			await os.api('algorithm/track-usage', {
				signals
			});
		} catch (error) {
			console.warn('Failed to send user signals:', error);
		}
	}

	/**
	 * Get reaction sentiment from emoji
	 */
	private getReactionSentiment(reactionEmoji: string): 'positive' | 'negative' | 'neutral' {
		const sentimentMap: Record<string, 'positive' | 'negative' | 'neutral'> = {
			// Positive reactions
			'❤️': 'positive', '👍': 'positive', '😍': 'positive', '🔥': 'positive',
			'💯': 'positive', '✨': 'positive', '🎉': 'positive', '😊': 'positive',
			'🥰': 'positive', '😘': 'positive', '🤗': 'positive', '👏': 'positive',
			
			// Negative reactions  
			'👎': 'negative', '😠': 'negative', '😡': 'negative', '🤮': 'negative',
			'💩': 'negative', '🙄': 'negative', '😤': 'negative', '🤬': 'negative',
			
			// Neutral reactions
			'🤔': 'neutral', '😐': 'neutral', '🤷': 'neutral', '👀': 'neutral',
			'😅': 'neutral', '😬': 'neutral'
		};
		
		return sentimentMap[reactionEmoji] || 'neutral';
	}

	/**
	 * Get device type for context
	 */
	private getDeviceType(): string {
		if (typeof window === 'undefined') return 'unknown';
		
		const userAgent = window.navigator.userAgent;
		if (/Mobile|Android|iPhone|iPad/.test(userAgent)) {
			return 'mobile';
		} else if (/Tablet/.test(userAgent)) {
			return 'tablet';
		} else {
			return 'desktop';
		}
	}

	/**
	 * Flush any remaining signals (call on page unload)
	 */
	flush(): void {
		if (this.batchedSignals.length > 0) {
			this.sendBatch();
		}
	}
}

export const signalTracker = new SignalTrackerService();

// Auto-flush on page unload
if (typeof window !== 'undefined') {
	window.addEventListener('beforeunload', () => {
		signalTracker.flush();
	});
}