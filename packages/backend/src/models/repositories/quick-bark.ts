import { QuickBark } from '@/models/entities/quick-bark.js';
import { User } from '@/models/entities/user.js';
import { Users, DriveFiles, Notes } from '../index.js';
import { Packed } from '@/misc/schema.js';
import { db } from '@/db/postgre.js';

export const QuickBarkRepository = db.getRepository(QuickBark).extend({
	async pack(
		src: QuickBark['id'] | QuickBark,
		me?: { id: User['id'] } | null | undefined,
	): Promise<Packed<'QuickBark'>> {
		const qb = typeof src === 'object' ? src : await this.findOneByOrFail({ id: src });

		const packed: Packed<'QuickBark'> = {
			id: qb.id,
			createdAt: qb.createdAt.toISOString(),
			userId: qb.userId,
			user: await Users.pack(qb.user ?? qb.userId, me, {
				detail: false,
			}),
			content: qb.content,
			type: qb.type,
			expiresAt: qb.expiresAt.toISOString(),
			sharedNoteId: qb.sharedNoteId,
			sharedNote: qb.sharedNoteId ? await Notes.pack(qb.sharedNoteId, me) : undefined,
			fileId: qb.fileId,
			file: qb.fileId ? await DriveFiles.pack(qb.file ?? qb.fileId) : undefined,
		};

		return packed;
	},

	async packMany(
		qbs: QuickBark[],
		me?: { id: User['id'] } | null | undefined,
	) {
		if (qbs.length === 0) return [];

		return Promise.all(qbs.map(qb => this.pack(qb, me)));
	},
});
