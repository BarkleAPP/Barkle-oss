import define from '../../define.js';
import { createExportUserDataJob } from '@/queue/index.js';
import { Users } from '@/models/index.js';
import { ApiError } from '../../error.js';
import { DAY } from '@/const.js';

export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
	limit: {
		duration: DAY,
		max: 10,
	},
	description: 'Request a comprehensive export of all user data for any user (admin only).',
	errors: {
		noSuchUser: {
			message: 'No such user.',
			code: 'NO_SUCH_USER',
			id: 'fcd2eef9-a9b2-4c4f-8624-038099e90aa5',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		userId: { type: 'string', format: 'barkle:id' },
		includePrivateData: {
			type: 'boolean',
			default: true,
			description: 'Whether to include private data like direct messages, muted users, blocked users, etc.'
		},
		format: {
			type: 'string',
			enum: ['json', 'csv'],
			default: 'json',
			description: 'Export format - JSON for machine readable, CSV for human readable'
		}
	},
	required: ['userId'],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const user = await Users.findOneBy({ id: ps.userId });

	if (user == null) {
		throw new ApiError(meta.errors.noSuchUser);
	}

	createExportUserDataJob(user, ps.includePrivateData, ps.format);
});
