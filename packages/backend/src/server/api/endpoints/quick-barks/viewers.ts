import { QuickBarks, Users } from '@/models/index.js';
import define from '../../define.js';
import { ApiError } from '../../error.js';
import { db } from '@/db/postgre.js';
import { QuickBarkView } from '@/models/entities/quick-bark-view.js';

export const meta = {
	tags: ['quick-barks'],
	requireCredential: true,
	res: {
		type: 'array',
		optional: false,
		nullable: false,
		items: {
			type: 'object',
			optional: false,
			nullable: false,
			ref: 'User',
		},
	},
	errors: {
		noSuchQuickBark: {
			message: 'No such quick bark.',
			code: 'NO_SUCH_QUICK_BARK',
			id: '83d45e12-2f8a-4d21-9b5e-6c9f7b3e8a1d',
		},
		accessDenied: {
			message: 'Access denied.',
			code: 'ACCESS_DENIED',
			id: 'a7f6c9d3-4e2b-5f1c-8d7a-9e3b2c4d5f6g',
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

	const views = await db.getRepository(QuickBarkView)
		.createQueryBuilder('quick_bark_view')
		.where('quick_bark_view.quickBarkId = :quickBarkId', { quickBarkId: ps.quickBarkId })
		.innerJoinAndSelect('quick_bark_view.user', 'user')
		.leftJoinAndSelect('user.avatar', 'avatar')
		.getMany();

	const users = views.map(v => v.user);

	return Users.packMany(users, user);
});
