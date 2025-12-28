import { db } from '@/db/postgre.js';
import { NotificationSchedule } from '@/models/entities/notification-schedule.js';
import { genId } from '@/misc/gen-id.js';

export const NotificationScheduleRepository = db.getRepository(NotificationSchedule).extend({
	/**
	 * Schedule a notification for a user
	 */
	async scheduleNotification(
		userId: string,
		type: string,
		scheduledAt: Date,
		data?: Record<string, any>
	): Promise<NotificationSchedule> {
		const schedule = new NotificationSchedule();
		schedule.id = genId();
		schedule.userId = userId;
		schedule.type = type;
		schedule.scheduledAt = scheduledAt;
		schedule.data = data || null;
		schedule.isActive = true;

		return await this.save(schedule);
	},

	/**
	 * Get pending notifications that should be sent now
	 */
	async getPendingNotifications(limit: number = 100): Promise<NotificationSchedule[]> {
		return await this.find({
			where: {
				isActive: true,
			},
			relations: ['user'],
			order: {
				scheduledAt: 'ASC',
			},
			take: limit,
		});
	},

	/**
	 * Get notifications ready to be sent (scheduled time has passed)
	 */
	async getReadyNotifications(limit: number = 100): Promise<NotificationSchedule[]> {
		const now = new Date();
		
		return await this.createQueryBuilder('schedule')
			.leftJoinAndSelect('schedule.user', 'user')
			.where('schedule.isActive = true')
			.andWhere('schedule.sentAt IS NULL')
			.andWhere('schedule.scheduledAt <= :now', { now })
			.orderBy('schedule.scheduledAt', 'ASC')
			.limit(limit)
			.getMany();
	},

	/**
	 * Mark a notification as sent
	 */
	async markAsSent(id: string): Promise<void> {
		await this.update(id, {
			sentAt: new Date(),
			isActive: false,
		});
	},

	/**
	 * Cancel a scheduled notification
	 */
	async cancelNotification(id: string): Promise<void> {
		await this.update(id, { isActive: false });
	},

	/**
	 * Cancel all pending notifications of a specific type for a user
	 */
	async cancelUserNotifications(userId: string, type?: string): Promise<void> {
		const query = this.createQueryBuilder()
			.update()
			.set({ isActive: false })
			.where('userId = :userId', { userId })
			.andWhere('sentAt IS NULL')
			.andWhere('isActive = true');

		if (type) {
			query.andWhere('type = :type', { type });
		}

		await query.execute();
	},

	/**
	 * Get notification statistics
	 */
	async getNotificationStats(userId?: string): Promise<{
		total: number;
		pending: number;
		sent: number;
		byType: Record<string, number>;
	}> {
		let query = this.createQueryBuilder('schedule');
		
		if (userId) {
			query = query.where('schedule.userId = :userId', { userId });
		}

		const total = await query.getCount();
		
		const pending = await query
			.clone()
			.andWhere('schedule.sentAt IS NULL')
			.andWhere('schedule.isActive = true')
			.getCount();

		const sent = await query
			.clone()
			.andWhere('schedule.sentAt IS NOT NULL')
			.getCount();

		const typeStats = await query
			.clone()
			.select('schedule.type', 'type')
			.addSelect('COUNT(*)', 'count')
			.groupBy('schedule.type')
			.getRawMany();

		const byType: Record<string, number> = {};
		typeStats.forEach(stat => {
			byType[stat.type] = parseInt(stat.count);
		});

		return { total, pending, sent, byType };
	},

	/**
	 * Clean up old sent notifications (older than 7 days)
	 */
	async cleanupOldNotifications(): Promise<void> {
		const sevenDaysAgo = new Date();
		sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

		await this.createQueryBuilder()
			.delete()
			.where('sentAt IS NOT NULL')
			.andWhere('sentAt < :date', { date: sevenDaysAgo })
			.execute();
	},
});