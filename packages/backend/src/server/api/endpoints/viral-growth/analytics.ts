import define from '../../define.js';
import { ViralGrowthService } from '@/services/viral-growth.js';

export const meta = {
	tags: ['growth', 'analytics'],
	requireCredential: true,
	kind: 'read:account',
	
	res: {
		type: 'object',
		optional: false, nullable: false,
		properties: {
			momentum: {
				type: 'object',
				properties: {
					userId: { type: 'string' },
					followersGained24h: { type: 'number' },
					followingGained24h: { type: 'number' },
					invitationsAccepted24h: { type: 'number' },
					networkGrowthRate: { type: 'number' },
					viralCoefficient: { type: 'number' },
					momentumScore: { type: 'number' },
				},
			},
			recentViralMoments: { type: 'number' },
			networkGrowthTrend: {
				type: 'array',
				items: { type: 'number' },
			},
			viralCoefficientHistory: {
				type: 'array',
				items: { type: 'number' },
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
	const analytics = await ViralGrowthService.getViralGrowthAnalytics(user.id);
	return analytics;
});