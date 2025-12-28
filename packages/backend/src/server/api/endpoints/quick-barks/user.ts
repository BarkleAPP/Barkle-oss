import { QuickBarks, Users } from '@/models/index.js';
import define from '../../define.js';
import { ulid } from 'ulid';
import { In } from 'typeorm';
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
			ref: 'QuickBark',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		userId: { type: 'string', format: 'barkle:id' },
	},
	required: ['userId'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	const quickBarks = await QuickBarks.createQueryBuilder('quick_bark')
		.where('quick_bark.userId = :userId', { userId: ps.userId })
		.andWhere('quick_bark.expiresAt > NOW()')
		.innerJoinAndSelect('quick_bark.user', 'user')
		.leftJoinAndSelect('user.avatar', 'avatar')
		.orderBy('quick_bark.createdAt', 'ASC')
		.getMany();

	const quickBarkViewRepo = db.getRepository(QuickBarkView);
	const qbIds = quickBarks.map(qb => qb.id);

	if (qbIds.length > 0) {
		const existingViews = await quickBarkViewRepo.findBy({
			quickBarkId: In(qbIds),
			userId: user!.id,
		});

		const newViews = quickBarks
			.filter(qb => !existingViews.some(v => v.quickBarkId === qb.id))
			.map(qb => ({
				id: ulid(),
				quickBarkId: qb.id,
				userId: user!.id,
				createdAt: new Date(),
			}));

		if (newViews.length > 0) {
			await quickBarkViewRepo.insert(newViews);
		}
	}

	return QuickBarks.packMany(quickBarks, user);
});
