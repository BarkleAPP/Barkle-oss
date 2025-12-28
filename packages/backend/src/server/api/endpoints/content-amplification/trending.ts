import define from '../../define.js';
import { ContentAmplificationService } from '@/services/content-amplification.js';

export const meta = {
	tags: ['growth', 'content'],
	requireCredential: true,
	kind: 'read:account',
	
	res: {
		type: 'array',
		optional: false, nullable: false,
		items: {
			type: 'object',
			properties: {
				noteId: { type: 'string' },
				userId: { type: 'string' },
				engagementScore: { type: 'number' },
				viralityScore: { type: 'number' },
				amplificationLevel: { 
					type: 'string',
					enum: ['low', 'medium', 'high', 'viral']
				},
				metrics: {
					type: 'object',
					properties: {
						reactions: { type: 'number' },
						reposts: { type: 'number' },
						replies: { type: 'number' },
						engagementRate: { type: 'number' },
						velocityScore: { type: 'number' },
					},
				},
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
	},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const trendingContent = await ContentAmplificationService.getTrendingContent(ps.limit);
	return trendingContent;
});