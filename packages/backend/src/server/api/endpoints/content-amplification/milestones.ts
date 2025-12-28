import define from '../../define.js';
import { ContentAmplificationService } from '@/services/content-amplification.js';

export const meta = {
	tags: ['growth', 'community'],
	requireCredential: true,
	kind: 'read:account',
	
	res: {
		type: 'array',
		optional: false, nullable: false,
		items: {
			type: 'object',
			properties: {
				type: { 
					type: 'string',
					enum: ['user_milestone', 'content_milestone', 'network_milestone']
				},
				userId: { type: 'string' },
				milestone: { type: 'string' },
				data: { type: 'object' },
				recognitionLevel: { 
					type: 'string',
					enum: ['bronze', 'silver', 'gold', 'platinum']
				},
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		userId: { type: 'string', format: 'barkle:id', nullable: true },
	},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const targetUserId = ps.userId || user.id;
	
	// Only allow users to see their own milestones or public milestones for others
	const milestones = await ContentAmplificationService.detectCommunityMilestones(targetUserId);
	
	// For other users, filter to only show public milestones
	if (targetUserId !== user.id) {
		return milestones.filter(milestone => 
			milestone.recognitionLevel === 'gold' || milestone.recognitionLevel === 'platinum'
		);
	}
	
	return milestones;
});