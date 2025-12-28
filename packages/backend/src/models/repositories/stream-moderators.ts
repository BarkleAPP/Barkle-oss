import { db } from '@/db/postgre.js';
import { StreamModerators } from '@/models/entities/stream-moderators.js';
import { User } from '@/models/entities/user.js';
import { UserRepository } from '@/models/repositories/user.js';

export const StreamModeratorsRepository = db.getRepository(StreamModerators).extend({
	async pack(
		src: StreamModerators['id'] | StreamModerators,
		options?: {
			includeUser?: boolean;
		},
	): Promise<any> {
		const opts = Object.assign({
			includeUser: true,
		}, options);

		const moderator = typeof src === 'object' ? src : await this.findOneByOrFail({ id: src });

		return {
			id: moderator.id,
			streamId: moderator.streamId,
			userId: moderator.userId,
			createdAt: moderator.createdAt,
			...(opts.includeUser ? {
				user: await UserRepository.pack(moderator.userId)
			} : {}),
		};
	},
});
