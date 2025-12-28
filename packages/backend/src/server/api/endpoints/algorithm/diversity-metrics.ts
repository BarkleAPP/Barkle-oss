import define from '@/server/api/define.js';
import { behavioralPatternRecognition } from '@/services/algorithm/behavioral-pattern-recognition.js';
import { userPersonalizationService } from '@/services/algorithm/user-personalization-service.js';
import Logger from '@/services/logger.js';

const logger = new Logger('algorithm-diversity-metrics');

export const meta = {
	tags: ['algorithm'],

	requireCredential: true,

	kind: 'read:account',

	description: 'Get user diversity metrics and preferences',

	res: {
		type: 'object',
		nullable: true,
		properties: {
			currentDiversityScore: {
				type: 'number',
				description: 'Current diversity score (0-1)',
			},
			explorationTolerance: {
				type: 'number',
				description: 'User exploration tolerance (0-1)',
			},
			topicCount: {
				type: 'number',
				description: 'Number of topics in user profile',
			},
			diversityTrend: {
				type: 'number',
				description: 'Diversity trend (positive = increasing)',
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	try {
		// Get real diversity metrics from user profile
		const personalizationProfile = await userPersonalizationService.getUserProfile(user.id);
		const behavioralProfile = await behavioralPatternRecognition.getUserBehaviorProfile(user.id);

		// Calculate topic count from personalization profile
		const topicCount = personalizationProfile && personalizationProfile.preferences.topicAffinities
			? Object.keys(personalizationProfile.preferences.topicAffinities).length
			: 0;

		// Calculate diversity score from diversity tolerance preference
		const diversityScore = personalizationProfile
			? personalizationProfile.preferences.diversityTolerance
			: 0.5;

		// Exploration tolerance is based on confidence score (lower confidence = more exploration)
		const explorationTolerance = personalizationProfile ? (1 - personalizationProfile.confidence) : 0.5;

		logger.debug(`Diversity metrics for user ${user.id}: score=${diversityScore.toFixed(2)}, topics=${topicCount}`);

		return {
			currentDiversityScore: Math.min(Math.max(diversityScore, 0), 1.0),
			explorationTolerance: Math.min(Math.max(explorationTolerance, 0), 1),
			topicCount,
			diversityTrend: 0, // Would require historical tracking
		};
	} catch (error) {
		logger.error('Error getting diversity metrics:', error as Error);
		return null;
	}
});