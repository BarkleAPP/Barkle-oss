import * as os from '@/os';

/**
 * Diversity metrics from the algorithm
 */
export interface DiversityMetrics {
	currentDiversityScore: number; // 0-1, current timeline diversity
	explorationTolerance: number; // 0-1, user's willingness to see diverse content
	topicCount: number; // number of topics in user profile
	diversityTrend: number; // positive = increasing diversity, negative = decreasing
}

/**
 * Service for managing content diversity and exploration preferences
 */
export class DiversityService {
	private static instance: DiversityService;

	public static getInstance(): DiversityService {
		if (!DiversityService.instance) {
			DiversityService.instance = new DiversityService();
		}
		return DiversityService.instance;
	}

	/**
	 * Provide feedback on diverse content to improve personalization
	 */
	async provideDiversityFeedback(
		contentId: string,
		feedback: 'positive' | 'negative' | 'neutral'
	): Promise<boolean> {
		try {
			// Map feedback to the new algorithm feedback system
			let feedbackType: 'like' | 'dislike' | 'hide';
			let reason: string;

			switch (feedback) {
				case 'positive':
					feedbackType = 'like';
					reason = 'Enjoyed diverse content';
					break;
				case 'negative':
					feedbackType = 'dislike';
					reason = 'Did not enjoy diverse content';
					break;
				case 'neutral':
					feedbackType = 'hide';
					reason = 'Neutral about diverse content';
					break;
			}

			const result = await os.api('algorithm/feedback', {
				contentId,
				feedbackType,
				reason,
				severity: 'low'
			});

			return result.success === true;
		} catch (error) {
			console.error('Error providing diversity feedback:', error);
			return false;
		}
	}

	/**
	 * Get user's diversity metrics and preferences
	 */
	async getDiversityMetrics(): Promise<DiversityMetrics | null> {
		try {
			const metrics = await os.api('algorithm/diversity-metrics');
			return metrics;
		} catch (error) {
			console.error('Error getting diversity metrics:', error);
			return null;
		}
	}

	/**
	 * Track when user interacts with exploration content
	 */
	async trackExplorationInteraction(
		contentId: string,
		interactionType: 'view' | 'like' | 'share' | 'comment' | 'skip',
		duration?: number
	): Promise<void> {
		try {
			// Use existing algorithm tracking with exploration context
			await os.api('algorithm/track-interaction', {
				contentId,
				interactionType,
				duration,
				context: {
					isExploration: true,
					timestamp: new Date().toISOString(),
				},
			});
		} catch (error) {
			console.error('Error tracking exploration interaction:', error);
		}
	}

	/**
	 * Check if content is marked as exploration/diverse content
	 */
	isExplorationContent(content: any): boolean {
		return (
			content.source === 'exploration' ||
			content.rankingFactors?.exploration === 1.0 ||
			content.diversityScore > 0.7
		);
	}

	/**
	 * Get diversity score interpretation for UI
	 */
	getDiversityScoreInterpretation(score: number): {
		level: 'low' | 'medium' | 'high';
		description: string;
		recommendation: string;
	} {
		if (score < 0.3) {
			return {
				level: 'low',
				description: 'Your timeline focuses on familiar topics',
				recommendation: 'Consider exploring new content to discover fresh perspectives',
			};
		} else if (score < 0.7) {
			return {
				level: 'medium',
				description: 'Your timeline has a good balance of familiar and diverse content',
				recommendation: 'Great balance! You\'re discovering new content while staying engaged',
			};
		} else {
			return {
				level: 'high',
				description: 'Your timeline shows a wide variety of topics and perspectives',
				recommendation: 'You\'re exploring lots of diverse content! Let us know what you like',
			};
		}
	}

	/**
	 * Get exploration tolerance interpretation for UI
	 */
	getExplorationToleranceInterpretation(tolerance: number): {
		level: 'conservative' | 'balanced' | 'adventurous';
		description: string;
	} {
		if (tolerance < 0.3) {
			return {
				level: 'conservative',
				description: 'You prefer content similar to your interests',
			};
		} else if (tolerance < 0.7) {
			return {
				level: 'balanced',
				description: 'You enjoy a mix of familiar and new content',
			};
		} else {
			return {
				level: 'adventurous',
				description: 'You love discovering new topics and perspectives',
			};
		}
	}

	/**
	 * Suggest diversity actions based on user metrics
	 */
	getDiversitySuggestions(metrics: DiversityMetrics): {
		action: string;
		description: string;
		priority: 'low' | 'medium' | 'high';
	}[] {
		const suggestions: {
			action: string;
			description: string;
			priority: 'low' | 'medium' | 'high';
		}[] = [];

		// Low diversity suggestions
		if (metrics.currentDiversityScore < 0.3) {
			suggestions.push({
				action: 'Explore trending topics',
				description: 'Check out what\'s trending to discover new interests',
				priority: 'high',
			});

			suggestions.push({
				action: 'Follow diverse creators',
				description: 'Follow users who post about different topics',
				priority: 'medium',
			});
		}

		// Low exploration tolerance suggestions
		if (metrics.explorationTolerance < 0.2) {
			suggestions.push({
				action: 'Try new content gradually',
				description: 'We\'ll slowly introduce more diverse content to your timeline',
				priority: 'low',
			});
		}

		// Declining diversity trend
		if (metrics.diversityTrend < -0.1) {
			suggestions.push({
				action: 'Engage with diverse content',
				description: 'Like or share content outside your usual interests',
				priority: 'medium',
			});
		}

		// Few topics
		if (metrics.topicCount < 5) {
			suggestions.push({
				action: 'Explore new hashtags',
				description: 'Search for and engage with new hashtags and topics',
				priority: 'medium',
			});
		}

		return suggestions;
	}

	/**
	 * Format diversity metrics for display
	 */
	formatDiversityMetrics(metrics: DiversityMetrics): {
		diversityScore: string;
		explorationLevel: string;
		topicBreadth: string;
		trend: string;
	} {
		const diversityPercentage = Math.round(metrics.currentDiversityScore * 100);
		const explorationPercentage = Math.round(metrics.explorationTolerance * 100);

		let trendText = 'Stable';
		if (metrics.diversityTrend > 0.1) {
			trendText = 'Increasing';
		} else if (metrics.diversityTrend < -0.1) {
			trendText = 'Decreasing';
		}

		return {
			diversityScore: `${diversityPercentage}%`,
			explorationLevel: `${explorationPercentage}%`,
			topicBreadth: `${metrics.topicCount} topics`,
			trend: trendText,
		};
	}
}

// Export singleton instance
export const diversityService = DiversityService.getInstance();