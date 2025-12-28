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
		interactionType: { 
			type: 'string', 
			enum: ['supportiveReply', 'encouragingReaction', 'helpfulMention']
		},
		contribution: {
			type: 'string',
			maxLength: 100,
			nullable: true
		}
	},
	required: ['interactionType'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	if (ps.contribution) {
		await PositiveReinforcementService.highlightUniqueValue(user.id, ps.contribution);
	} else {
		await PositiveReinforcementService.recognizeHelpfulInteraction(user.id, ps.interactionType);
	}

	return { success: true };
});