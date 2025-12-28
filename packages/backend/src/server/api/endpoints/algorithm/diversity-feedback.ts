import define from '@/server/api/define.js';
import { userPersonalizationService } from '@/services/algorithm/user-personalization-service.js';
import { signalCollectionService } from '@/services/algorithm/signal-collection-service.js';
import Logger from '@/services/logger.js';

const logger = new Logger('algorithm-diversity-feedback');

export const meta = {
	tags: ['algorithm'],

	requireCredential: true,

	kind: 'write:account',

	description: 'Provide feedback on diverse content to improve personalization',

	res: {
		type: 'object',
		optional: false, nullable: false,
		properties: {
			success: {
				type: 'boolean',
				optional: false, nullable: false,
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		contentId: {
			type: 'string',
			description: 'ID of the content being rated',
		},
		feedback: {
			type: 'string',
			enum: ['positive', 'negative', 'neutral'],
			description: 'User feedback on the diverse content',
		},
	},
	required: ['contentId', 'feedback'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	try {
		// Collect diversity feedback signal for personalization
		const signalWeight = ps.feedback === 'positive' ? 1.0 : ps.feedback === 'negative' ? -0.5 : 0.1;

		await signalCollectionService.collectSignal(
			user.id,
			'feedback' as any,
			ps.contentId,
			{
				feedback: ps.feedback,
				feedbackType: 'diversity',
				weight: signalWeight,
				timestamp: new Date()
			}
		);

		logger.info(`Diversity feedback from user ${user.id}: ${ps.feedback} for ${ps.contentId}`);

		return {
			success: true,
		};
	} catch (error) {
		logger.error('Error processing diversity feedback:', error as Error);
		throw new Error('Failed to process diversity feedback');
	}
});