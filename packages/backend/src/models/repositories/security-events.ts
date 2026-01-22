import { db } from '@/db/postgre.js';
import { Users } from '../index.js';
import { SecurityEvent } from '@/models/entities/security-event.js';
import { awaitAll } from '@/prelude/await-all.js';

export const SecurityEventRepository = db.getRepository(SecurityEvent).extend({
	async pack(
		src: SecurityEvent['id'] | SecurityEvent,
	) {
		const event = typeof src === 'object' ? src : await this.findOneByOrFail({ id: src });

		return await awaitAll({
			id: event.id,
			createdAt: event.createdAt.toISOString(),
			type: event.type,
			userId: event.userId,
			user: event.user ? Users.pack(event.user, null, {
				detail: true,
			}) : null,
			ipAddress: event.ipAddress,
			userAgent: event.userAgent,
			details: event.details,
			severity: event.severity,
			reviewed: event.reviewed,
		});
	},

	packMany(
		events: any[],
	) {
		return Promise.all(events.map(x => this.pack(x)));
	},
});
