import Logger from '../logger.js';
import { CacheableUser } from '@/models/entities/user.js';
import { Blockings, Users } from '@/models/index.js';
import { userReputationScoreService } from '@/services/algorithm/user-reputation-score-service.js';

const logger = new Logger('blocking/delete');

export default async function (blocker: CacheableUser, blockee: CacheableUser) {
	const blocking = await Blockings.findOneBy({
		blockerId: blocker.id,
		blockeeId: blockee.id,
	});

	if (blocking == null) {
		logger.warn('Unblock requested but user was not blocked');
		return;
	}

	// Since we already have the blocker and blockee, we do not need to fetch
	// them in the query above and can just manually insert them here.
	blocking.blocker = blocker;
	blocking.blockee = blockee;

	await Blockings.delete(blocking.id);

	// Decrement blockee's blocksReceivedCount and recalculate reputation
	await Users.decrement({ id: blockee.id }, 'blocksReceivedCount', 1);
	userReputationScoreService.invalidateCache(blockee.id);

	// Async reputation recalculation (non-blocking)
	Users.findOneBy({ id: blockee.id }).then(user => {
		if (user) userReputationScoreService.calculateReputationScore(user);
	}).catch(() => { });
}
