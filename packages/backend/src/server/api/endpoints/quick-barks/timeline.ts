import { QuickBarks, Followings } from '@/models/index.js';
import define from '../../define.js';
import { makePaginationQuery } from '../../common/make-pagination-query.js';

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
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
		sinceId: { type: 'string', format: 'barkle:id' },
		untilId: { type: 'string', format: 'barkle:id' },
	},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// Get users the current user is following
	const following = await Followings.createQueryBuilder('following')
		.select('following.followeeId')
		.where('following.followerId = :userId', { userId: user.id })
		.getMany();
	
	const followingIds = following.map(f => f.followeeId);
	followingIds.push(user.id); // Include user's own QuickBarks

	const query = makePaginationQuery(QuickBarks.createQueryBuilder('quick_bark'), ps.sinceId, ps.untilId)
		.where('quick_bark.userId IN (:...followingIds)', { followingIds })
		.andWhere('quick_bark.expiresAt > NOW()')
		.innerJoinAndSelect('quick_bark.user', 'user')
		.leftJoinAndSelect('user.avatar', 'avatar')
		.leftJoinAndSelect('quick_bark.file', 'file')
		.orderBy('quick_bark.createdAt', 'DESC');

	const quickBarks = await query.take(ps.limit).getMany();

	return await QuickBarks.packMany(quickBarks, user);
});
