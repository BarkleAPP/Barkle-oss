import define from '../../define.js';
import { algorithmClient } from '@/services/algorithm/algorithm-microservice-client.js';
import Logger from '@/services/logger.js';

const logger = new Logger('algorithm-feedback');

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
		contentId: { 
			type: 'string',
			description: 'ID of the content being rated'
		},
		feedbackType: { 
			type: 'string',
			enum: ['like', 'dislike', 'report', 'hide', 'share', 'save'],
			description: 'Type of feedback'
		},
		reason: { 
			type: 'string',
			description: 'Optional reason for the feedback'
		},
		severity: { 
			type: 'string',
			enum: ['low', 'medium', 'high'],
			description: 'Severity level for reports'
		}
	},
	required: ['contentId', 'feedbackType']
} as const;

export default define(meta, paramDef, async (ps, user) => {
	try {
		// Add user feedback to algorithm system
		await algorithmClient.addUserFeedback(
			user.id,
			ps.contentId,
			ps.feedbackType as any,
			ps.reason,
			ps.severity as any
		);

		logger.info(`User feedback recorded: ${user.id} -> ${ps.contentId} (${ps.feedbackType})`);

		return {
			success: true
		};
	} catch (error) {
		logger.error('Error recording user feedback:', error as Error);
		return {
			success: false
		};
	}
});