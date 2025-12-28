import define from '../../define.js';
import { createExportUserDataJob } from '@/queue/index.js';
import { DAY } from '@/const.js';

export const meta = {
	secure: true,
	requireCredential: true,
	limit: {
		duration: DAY,
		max: 1,
	},
	description: 'Request a comprehensive export of all user data including profile, notes, following, followers, lists, and more.',
} as const;

export const paramDef = {
	type: 'object',
	properties: {
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
	required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	createExportUserDataJob(user, ps.includePrivateData, ps.format);
});
