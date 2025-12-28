import define from '../../define.js';
import { signalCollectionService } from '@/services/algorithm/signal-collection-service.js';
import Logger from '@/services/logger.js';

const logger = new Logger('algorithm-track-usage');

export const meta = {
	tags: ['algorithm'],
	requireCredential: true,
	res: {
		type: 'object',
		optional: false, nullable: false,
		properties: {
			success: {
				type: 'boolean',
				optional: false, nullable: false,
			},
			processed: {
				type: 'number',
				optional: false, nullable: false,
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		signals: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					contentId: { type: 'string' },
					signalType: { type: 'string' },
					context: {
						type: 'object',
						properties: {
							dwellTimeMs: { type: 'number' },
							scrollDepth: { type: 'number' },
							timelinePosition: { type: 'number' },
							deviceType: { type: 'string' },
							source: {
								type: 'string',
								enum: ['timeline', 'search', 'notification', 'direct']
							},
							reactionType: { type: 'string' },
							reactionSentiment: { type: 'string' }
						}
					}
				},
				required: ['contentId', 'signalType']
			}
		}
	},
	required: []
} as const;

export default define(meta, paramDef, async (ps, user) => {
	try {
		let processedCount = 0;

		// Process each signal through signal collection service
		if (ps.signals && ps.signals.length > 0) {
			for (const signal of ps.signals) {
				await signalCollectionService.collectSignal(
					user.id,
					signal.signalType as any,
					signal.contentId,
					signal.context as any || {}
				);
				processedCount++;
			}
		}

		logger.debug(`Processed ${processedCount} algorithm signals for user ${user.id}`);

		return {
			success: true,
			processed: processedCount
		};
	} catch (error) {
		logger.error('Error tracking algorithm usage:', error as Error);
		return {
			success: false,
			processed: 0
		};
	}
});