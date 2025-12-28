import { QuickBarks } from '@/models/index.js';
import define from '../../define.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['quick-barks'],
	requireCredential: true,
	res: {
		type: 'object',
		optional: false,
		nullable: false,
		properties: {
			success: { type: 'boolean' },
		},
	},
	errors: {
		noSuchQuickBark: {
			message: 'No such quick bark.',
			code: 'NO_SUCH_QUICK_BARK',
			id: '47d2dcd2-4f7e-4f01-99e4-8a7b8a1e2f21',
		},
		accessDenied: {
			message: 'Access denied.',
			code: 'ACCESS_DENIED',
			id: '52c7f9b1-1e3a-4c7e-8f5e-9d1b0e3f7a8c',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		quickBarkId: { type: 'string', format: 'barkle:id' },
	},
	required: ['quickBarkId'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const quickBark = await QuickBarks.findOneBy({ id: ps.quickBarkId });

	if (!quickBark) {
		throw new ApiError(meta.errors.noSuchQuickBark);
	}

	if (quickBark.userId !== user!.id) {
		throw new ApiError(meta.errors.accessDenied);
	}

	await QuickBarks.delete({ id: ps.quickBarkId });

	return { success: true };
});
