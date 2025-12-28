import { SocialProofService } from '@/services/social-proof-service.js';
import define from '../../define.js';

export const meta = {
	tags: ['notes', 'social-proof'],

	requireCredential: false,

	res: {
		type: 'object',
		optional: false, nullable: false,
		properties: {
			engagementScore: { type: 'number' },
			trendingScore: { type: 'number' },
			recentEngagement: {
				type: 'object',
				properties: {
					reactions: { type: 'number' },
					renotes: { type: 'number' },
					replies: { type: 'number' },
					timeframe: { type: 'string' },
				},
			},
			socialValidation: {
				type: 'object',
				properties: {
					friendsWhoReacted: { type: 'number' },
					friendsWhoRenoted: { type: 'number' },
					popularityIndicator: { type: 'string', enum: ['low', 'medium', 'high', 'viral'] },
				},
			},
			activityIndicators: {
				type: 'object',
				properties: {
					isHot: { type: 'boolean' },
					isRising: { type: 'boolean' },
					isTrending: { type: 'boolean' },
					momentumScore: { type: 'number' },
				},
			},
		},
	},

	description: 'Get social proof metadata for a specific note',
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		noteId: { type: 'string', format: 'barkle:id' },
	},
	required: ['noteId'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	try {
		const socialProof = await SocialProofService.calculateNoteSocialProof(ps.noteId, user?.id);
		return socialProof;
	} catch (error) {
		throw new Error('Failed to calculate social proof for note');
	}
});