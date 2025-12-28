import define from '../../define.js';
import { genId } from '@/misc/gen-id.js';

export const meta = {
	requireCredential: true,

	tags: ['barktres'],

	res: {
		type: 'object',
		optional: false, nullable: false,
		properties: {
			sessionToken: {
				type: 'string',
				optional: false, nullable: false,
			},
			startTime: {
				type: 'number',
				optional: false, nullable: false,
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
	// Generate a unique session token
	const sessionToken = genId();
	const startTime = Date.now();

	// Store session info in Redis with 2 hour expiration (allows for longer games)
	const { redisClient: redis } = await import('@/db/redis.js');
	await redis.setex(
		`barktres:session:${sessionToken}`,
		7200, // 2 hours
		JSON.stringify({
			userId: user.id,
			startTime,
		})
	);

	return {
		sessionToken,
		startTime,
	};
});
