import define from '../../define.js';
import { signalCollectionService } from '@/services/algorithm/signal-collection-service.js';
import Logger from '@/services/logger.js';

const logger = new Logger('algorithm-track-interaction');

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
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		contentId: { type: 'string' },
		interactionType: {
			type: 'string',
			enum: ['reaction', 'share', 'comment', 'view', 'dwell', 'skip', 'block', 'renote']
		},
		reactionType: { type: 'string', nullable: true },
		duration: { type: 'number', nullable: true },
		context: {
			type: 'object',
			properties: {
				deviceType: {
					type: 'string',
					enum: ['mobile', 'desktop', 'tablet']
				},
				timeOfDay: { type: 'number', nullable: true },
				sessionId: { type: 'string' },
				scrollPosition: { type: 'number', nullable: true },
				viewportSize: {
					type: 'object',
					nullable: true,
					properties: {
						width: { type: 'number' },
						height: { type: 'number' }
					}
				}
			},
			required: ['sessionId']
		}
	},
	required: ['contentId', 'interactionType', 'context']
} as const;

export default define(meta, paramDef, async (ps, user) => {
	try {
		// Map interaction type to signal type
		const signalTypeMap: Record<string, string> = {
			'view': 'note_view',
			'reaction': 'note_reaction',
			'renote': 'note_renote',
			'comment': 'note_reply',
			'share': 'note_share',
			'dwell': 'dwell_time',
			'skip': 'scroll_past',
			'block': 'block',
		};
		
		const signalType = signalTypeMap[ps.interactionType] || 'note_view';
		
		// Collect signal
		await signalCollectionService.collectSignal(
			user.id,
			signalType as any,
			ps.contentId,
			{
				source: 'timeline',
				deviceType: ps.context.deviceType,
				sessionId: ps.context.sessionId,
				dwellTimeMs: ps.duration ?? undefined,
				scrollDepth: ps.context.scrollPosition ?? undefined,
				reactionType: ps.reactionType ?? undefined,
			}
		);

		return {
			success: true
		};
	} catch (error) {
		logger.error('Error tracking interaction:', error as Error);
		return {
			success: false
		};
	}
});
