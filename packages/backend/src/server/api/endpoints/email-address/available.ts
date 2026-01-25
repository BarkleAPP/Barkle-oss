import define from '../../define.js';
import { validateEmailForAccount } from '@/services/validate-email-for-account.js';
import { MINUTE } from '@/const.js';

export const meta = {
	tags: ['users'],

	requireCredential: false,

	limit: {
		duration: MINUTE,
		max: 10,
	},

	res: {
		type: 'object',
		optional: false, nullable: false,
		properties: {
			available: {
				type: 'boolean',
				optional: false, nullable: false,
			},
			reason: {
				type: 'string',
				optional: false, nullable: true,
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		// RFC 5321 specifies max email length of 254 characters
		emailAddress: { type: 'string', maxLength: 254 },
	},
	required: ['emailAddress'],
} as const;

export default define(meta, paramDef, async (ps) => {
	return await validateEmailForAccount(ps.emailAddress);
});
