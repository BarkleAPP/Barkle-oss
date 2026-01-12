import define from '../../define.js';
import { Users } from '@/models/index.js';
import { insertModerationLog } from '@/services/insert-moderation-log.js';
import { userReputationScoreService } from '@/services/algorithm/user-reputation-score-service.js';

export const meta = {
	secure: true,
	tags: ['admin'],

	requireCredential: true,
	requireModerator: true,
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		userId: { type: 'string', format: 'barkle:id' },
		reputationScore: { type: 'number', minimum: 0, maximum: 1 },
	},
	required: ['userId', 'reputationScore'],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const user = await Users.findOneBy({ id: ps.userId });

	if (user == null) {
		throw new Error('user not found');
	}

	const oldScore = user.reputationScore ?? 0.5;

	// Update the user's reputationScore field
	await Users.update(user.id, {
		reputationScore: ps.reputationScore,
	});

	// Clear the reputation cache
	userReputationScoreService.invalidateCache(user.id);

	// Add moderation log entry
	insertModerationLog(me, 'updateUserReputation', {
		userId: user.id,
		oldScore,
		newScore: ps.reputationScore,
	});

	return {
		success: true,
	};
});
