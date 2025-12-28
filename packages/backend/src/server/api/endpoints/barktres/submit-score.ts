import define from '../../define.js';
import { ApiError } from '../../error.js';
import { BarktresScores } from '@/models/index.js';
import { genId } from '@/misc/gen-id.js';

export const meta = {
	requireCredential: true,

	tags: ['barktres'],

	limit: {
		duration: 60000, // 1 minute
		max: 10, // Max 10 score submissions per minute
	},

	errors: {
		invalidSession: {
			message: 'Invalid or expired session.',
			code: 'INVALID_SESSION',
			id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
		},
		invalidScore: {
			message: 'Score validation failed.',
			code: 'INVALID_SCORE',
			id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
		},
	},

	res: {
		type: 'object',
		optional: false, nullable: false,
		properties: {
			success: {
				type: 'boolean',
				optional: false, nullable: false,
			},
			scoreId: {
				type: 'string',
				optional: false, nullable: false,
			},
			rank: {
				type: 'number',
				optional: true, nullable: false,
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		sessionToken: { type: 'string' },
		score: { type: 'integer', minimum: 0 },
		lines: { type: 'integer', minimum: 0 },
		level: { type: 'integer', minimum: 1 },
		duration: { type: 'integer', minimum: 1000 }, // At least 1 second
	},
	required: ['sessionToken', 'score', 'lines', 'level', 'duration'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// Verify session token
	const { redisClient: redis } = await import('@/db/redis.js');
	const sessionData = await redis.get(`barktres:session:${ps.sessionToken}`);

	if (!sessionData) {
		throw new ApiError(meta.errors.invalidSession);
	}

	const session = JSON.parse(sessionData);

	// Verify the session belongs to this user
	if (session.userId !== user.id) {
		throw new ApiError(meta.errors.invalidSession);
	}

	// Validate score feasibility
	// Basic checks to prevent obviously fake scores
	const maxScorePerSecond = 100; // Reasonable max score rate
	const secondsPlayed = ps.duration / 1000;
	const maxPossibleScore = secondsPlayed * maxScorePerSecond;

	if (ps.score > maxPossibleScore) {
		throw new ApiError(meta.errors.invalidScore);
	}

	// Lines cleared should be reasonable for the score
	// Typical scoring: 40 * level for single, up to 1200 * level for tetris
	const minScorePerLine = 40;
	const maxScorePerLine = 1200;
	const expectedMinScore = ps.lines * minScorePerLine;
	const expectedMaxScore = ps.lines * maxScorePerLine * ps.level;

	if (ps.lines > 0 && (ps.score < expectedMinScore * 0.5 || ps.score > expectedMaxScore * 2)) {
		throw new ApiError(meta.errors.invalidScore);
	}

	// Duration should be reasonable
	const minGameDuration = 10000; // At least 10 seconds
	const maxGameDuration = 3600000; // Max 1 hour

	if (ps.duration < minGameDuration || ps.duration > maxGameDuration) {
		throw new ApiError(meta.errors.invalidScore);
	}

	// Save the score
	const scoreId = genId();
	await BarktresScores.insert({
		id: scoreId,
		createdAt: new Date(),
		userId: user.id,
		score: ps.score,
		lines: ps.lines,
		level: ps.level,
		duration: ps.duration,
		sessionToken: ps.sessionToken,
	});

	// Delete the session token to prevent reuse
	await redis.del(`barktres:session:${ps.sessionToken}`);

	// Get user's rank
	const rank = await BarktresScores.createQueryBuilder('score')
		.where('score.score > :userScore', { userScore: ps.score })
		.getCount() + 1;

	return {
		success: true,
		scoreId,
		rank,
	};
});
