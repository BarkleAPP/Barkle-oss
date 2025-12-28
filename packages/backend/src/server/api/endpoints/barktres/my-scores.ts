import define from '../../define.js';
import { BarktresScores } from '@/models/index.js';

export const meta = {
	requireCredential: true,

	tags: ['barktres'],

	res: {
		type: 'object',
		optional: false, nullable: false,
		properties: {
			topScore: {
				type: 'integer',
				optional: false, nullable: true,
			},
			totalGames: {
				type: 'integer',
				optional: false, nullable: false,
			},
			bestRank: {
				type: 'integer',
				optional: false, nullable: true,
			},
			recentScores: {
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
					},
				},
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
	},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// Get total games played
	const totalGames = await BarktresScores.countBy({ userId: user.id });

	// Get top score
	const topScoreEntry = await BarktresScores.findOne({
		where: { userId: user.id },
		order: { score: 'DESC' },
	});

	const topScore = topScoreEntry?.score || null;

	// Get best rank
	let bestRank = null;
	if (topScore !== null) {
		bestRank = await BarktresScores.createQueryBuilder('score')
			.where('score.score > :topScore', { topScore })
			.getCount() + 1;
	}

	// Get recent scores
	const recentScores = await BarktresScores.find({
		where: { userId: user.id },
		order: { createdAt: 'DESC' },
		take: ps.limit,
	});

	return {
		topScore,
		totalGames,
		bestRank,
		recentScores: recentScores.map(score => ({
			id: score.id,
			score: score.score,
			lines: score.lines,
			level: score.level,
			duration: score.duration,
			createdAt: score.createdAt.toISOString(),
		})),
	};
});
