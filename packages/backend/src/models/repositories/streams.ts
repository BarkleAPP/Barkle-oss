import { db } from '@/db/postgre.js';
import { Streams } from '@/models/entities/streams.js';
import { Packed } from '@/misc/schema.js';

export const StreamsRepository = db.getRepository(Streams).extend({
	async pack(
		src: Streams['id'] | Streams,
	): Promise<Packed<'Streams'>> {
		const streams = typeof src === 'object' ? src : await this.findOneByOrFail({ id: src });

		return {
			id: streams.id,
			title: streams.title,
			key: streams.key,
			url: streams.url,
			userId: streams.userId,
			playbackId: streams.playbackId,
			noteId: streams.noteId,
		};
	},

	packMany(
		streams: any[],
	) {
		return Promise.all(streams.map(x => this.pack(x)));
	},
});
