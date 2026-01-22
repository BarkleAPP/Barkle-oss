import { db } from '@/db/postgre.js';
import { IpBan } from '@/models/entities/ip-ban.js';
import { genId } from '@/misc/gen-id.js';

export const IpBanRepository = db.getRepository(IpBan).extend({
	async isBanned(ip: string): Promise<boolean> {
		try {
			const ban = await this.createQueryBuilder('ban')
				.where('ban.ip = :ip', { ip })
				.andWhere('(ban.expiresAt IS NULL OR ban.expiresAt > :now)', { now: new Date() })
				.getOne();

			return !!ban;
		} catch (error) {
			// If ip_ban table doesn't exist or has issues, fail open (allow access)
			// This prevents blocking all API requests if the table isn't set up yet
			console.error('Error checking IP ban status:', error);
			return false;
		}
	},

	async createBan(ip: string, userId: string | null, reason: string | null, expiresAt: Date | null = null): Promise<IpBan> {
		const ban = this.create({
			id: genId(),
			createdAt: new Date(),
			userId,
			ip,
			reason,
			expiresAt,
		});

		return this.save(ban);
	},

	async removeBan(ip: string): Promise<void> {
		await this.delete({ ip });
	},

	async removeBansByUserId(userId: string): Promise<void> {
		await this.delete({ userId });
	},

	async pack(
		src: IpBan['id'] | IpBan,
	) {
		const ban = typeof src === 'object' ? src : await this.findOneByOrFail({ id: src });

		return {
			id: ban.id,
			createdAt: ban.createdAt.toISOString(),
			userId: ban.userId,
			ip: ban.ip,
			reason: ban.reason,
			expiresAt: ban.expiresAt ? ban.expiresAt.toISOString() : null,
		};
	},

	packMany(
		bans: any[],
	) {
		return Promise.all(bans.map(x => this.pack(x)));
	},
});
