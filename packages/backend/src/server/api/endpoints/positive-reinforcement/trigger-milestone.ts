import define from '../../define.js';
import { PositiveReinforcementService } from '@/services/positive-reinforcement.js';

export const meta = {
	tags: ['positive-reinforcement'],
	requireCredential: true,
	kind: 'write:account',
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		action: { 
			type: 'string', 
			enum: ['noteCreated', 'followerGained', 'reactionReceived', 'dailyActivity']
		},
		context: {
			type: 'object',
			properties: {
				noteId: { type: 'string', nullable: true },
				value: { type: 'number', nullable: true }
			},
			nullable: true
		}
	},
	required: ['action'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const milestone = await PositiveReinforcementService.detectMilestone(
		user.id, 
		ps.action, 
		ps.context
	);

	if (milestone) {
		await PositiveReinforcementService.sendPositiveReinforcement(milestone);
		return { milestone: milestone.type, triggered: true };
	}

	return { triggered: false };
});