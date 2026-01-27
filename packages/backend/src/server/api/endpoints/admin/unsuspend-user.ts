import define from '../../define.js';
import { Users } from '@/models/index.js';
import { insertModerationLog } from '@/services/insert-moderation-log.js';
import { doPostUnsuspend } from '@/services/unsuspend-user.js';
import { removeUserIpBans } from '@/misc/security/ip-ban.js';

export const meta = {
	tags: ['admin'],

	kind: 'write:admin',

	requireCredential: true,
	requireModerator: true,
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		userId: { type: 'string', format: 'barkle:id' },
	},
	required: ['userId'],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const user = await Users.findOneBy({ id: ps.userId });

	if (user == null) {
		throw new Error('user not found');
	}

	await Users.update(user.id, {
		isSuspended: false,
	});

	insertModerationLog(me, 'unsuspend', {
		targetId: user.id,
	});

	// Remove all IP bans for this user
	await removeUserIpBans(user.id);

	doPostUnsuspend(user);
});
