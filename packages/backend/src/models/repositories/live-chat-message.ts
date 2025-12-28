import { db } from '@/db/postgre.js';
import { LiveChatMessage } from '@/models/entities/live-chat-message.js';
import { Users } from '@/models/index.js';
import { Packed } from '@/misc/schema.js';
import { User } from '@/models/entities/user.js';

export const LiveChatMessagesRepository = db.getRepository(LiveChatMessage).extend({
	async pack(
		src: LiveChatMessage['id'] | LiveChatMessage,
		me?: { id: User['id'] } | null | undefined,
		options?: {
			skipUser?: boolean;
		},
	): Promise<Packed<'LiveChatMessage'>> {
		const opts = Object.assign({
			skipUser: false,
		}, options);

		const message = typeof src === 'object' ? src : await this.findOneByOrFail({ id: src });

		return {
			id: message.id,
			createdAt: message.createdAt.toISOString(),
			userId: message.userId,
			streamId: message.streamId,
			text: message.text,
			isDeleted: message.isDeleted,
			deletedAt: message.deletedAt?.toISOString() || null,
			deletedBy: message.deletedBy,
			user: opts.skipUser ? undefined : await Users.pack(message.userId, me),
		};
	},

	packMany(
		messages: any[],
		me?: { id: User['id'] } | null | undefined,
		options?: {
			skipUser?: boolean;
		},
	) {
		return Promise.all(messages.map(x => this.pack(x, me, options)));
	},
});
