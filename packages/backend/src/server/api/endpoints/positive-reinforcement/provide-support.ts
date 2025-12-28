import define from '../../define.js';
import { PositiveReinforcementService } from '@/services/positive-reinforcement.js';

export const meta = {
	tags: ['positive-reinforcement'],
	requireCredential: true,
	kind: 'write:account',
} as const;

export const paramDef = {
	type: 'object',
	properties: {},
} as const;

export default define(meta, paramDef, async (ps, user) => {
	await PositiveReinforcementService.provideSupportiveSuggestions(user.id);
	return { success: true };
});