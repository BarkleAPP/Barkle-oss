import define from '../../define.js';
import { BarktresScores } from '@/models/index.js';

export const meta = {
	requireCredential: false,

	tags: ['barktres'],

	res: {
		type: 'array',
		optional: false, nullable: false,
		items: {
			type: 'object',
			optional: false, nullable: false,
			properties: {
				id: {
					type: 'string',
					optional: false, nullable: false,
				},
				score: {
					type: 'integer',
					optional: false, nullable: false,
				},
				lines: {
					type: 'integer',
					optional: false, nullable: false,
				},
				level: {
					type: 'integer',
					optional: false, nullable: false,
				},
				duration: {
					type: 'integer',
					optional: false, nullable: false,
				},
				createdAt: {
					type: 'string',
					optional: false, nullable: false,
				},
				user: {
					type: 'object',
					optional: false, nullable: false,
					ref: 'UserLite',
				},
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
		offset: { type: 'integer', minimum: 0, default: 0 },
	},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// Use TypeORM to get the best score per user with proper ranking
	const scores = await BarktresScores.createQueryBuilder('score')
		.leftJoinAndSelect('score.user', 'user')
		.orderBy('score.score', 'DESC')
		.addOrderBy('score.createdAt', 'ASC')
		.getMany();

	// Group by user and keep only the best score for each user
	const userBestScores = new Map<string, typeof scores[0]>();
	for (const score of scores) {
		const userId = score.userId;
		const existing = userBestScores.get(userId);
		if (!existing || score.score > existing.score ||
			(score.score === existing.score && score.createdAt < existing.createdAt)) {
			userBestScores.set(userId, score);
		}
	}

	// Sort by score and apply pagination
	const sortedScores = Array.from(userBestScores.values())
		.sort((a, b) => {
			if (b.score !== a.score) return b.score - a.score;
			return a.createdAt.getTime() - b.createdAt.getTime();
		})
		.slice(ps.offset, ps.offset + ps.limit);

	const Users = (await import('@/models/index.js')).Users;

	return await Promise.all(sortedScores.map(async score => ({
		id: score.id,
		score: score.score,
		lines: score.lines,
		level: score.level,
		duration: score.duration,
		createdAt: score.createdAt.toISOString(),
		user: await Users.pack(score.user!, user, { detail: false }),
	})));
});
