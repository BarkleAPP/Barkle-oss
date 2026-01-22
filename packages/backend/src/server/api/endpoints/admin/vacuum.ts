import define from '../../define.js';
import { insertModerationLog } from '@/services/insert-moderation-log.js';
import { db } from '@/db/postgre.js';

export const meta = {
	tags: ['admin'],

	requireCredential: true,
	requireModerator: true,
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		full: { type: 'boolean' },
		analyze: { type: 'boolean' },
	},
	required: ['full', 'analyze'],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	// Use static SQL queries with no string concatenation to prevent SQL injection
	// Only execute specific, pre-defined VACUUM commands
	if (ps.full && ps.analyze) {
		await db.query('VACUUM FULL ANALYZE');
	} else if (ps.full) {
		await db.query('VACUUM FULL');
	} else if (ps.analyze) {
		await db.query('VACUUM ANALYZE');
	} else {
		await db.query('VACUUM');
	}

	insertModerationLog(me, 'vacuum', ps);
});
