import define from '../../../../define.js';
import { Users, UserMusicIntegrations } from '@/models/index.js';
import { ApiError } from '../../../../error.js';
import { genId } from '@/misc/gen-id.js';

export const meta = {
	tags: ['music', 'integrations'],

	requireCredential: true,

	params: {
		username: {
			type: 'string',
		},
	},

	res: {
		type: 'object',
		optional: false,
		nullable: false,
		properties: {
			success: {
				type: 'boolean',
				optional: false,
				nullable: false,
			},
		},
	},

	errors: {
		invalidUsername: {
			message: 'Invalid Last.fm username',
			code: 'INVALID_USERNAME',
			id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		username: { type: 'string' },
	},
	required: ['username'],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	if (!ps.username || ps.username.trim() === '') {
		throw new ApiError(meta.errors.invalidUsername);
	}

	// Use upsert to either insert new or update existing integration
	const integration = {
		id: genId(),
		userId: me.id,
		service: 'lastfm' as const,
		externalUserId: ps.username.trim(),
		username: ps.username.trim(),
		accessToken: '',
		refreshToken: null,
		expiresAt: null,
		createdAt: new Date(),
	};

	await UserMusicIntegrations.upsert(integration, ['userId', 'service']);

	return { success: true };
});
