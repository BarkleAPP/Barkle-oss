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
			userId: { type: 'string' },
			followersGained24h: { type: 'number' },
			followingGained24h: { type: 'number' },
			invitationsAccepted24h: { type: 'number' },
			networkGrowthRate: { type: 'number' },
			viralCoefficient: { type: 'number' },
			momentumScore: { type: 'number' },
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
	
	// Only allow users to see their own momentum or public momentum for others
	if (targetUserId !== user.id) {
		// For other users, return limited public momentum data
		const momentum = await ViralGrowthService.calculateGrowthMomentum(targetUserId);
		return {
			userId: momentum.userId,
			followersGained24h: momentum.followersGained24h,
			networkGrowthRate: momentum.networkGrowthRate,
			momentumScore: Math.min(momentum.momentumScore, 100), // Cap at 100 for public view
			// Hide private metrics
			followingGained24h: 0,
			invitationsAccepted24h: 0,
			viralCoefficient: 0,
		};
	}
	
	const momentum = await ViralGrowthService.calculateGrowthMomentum(targetUserId);
	return momentum;
});