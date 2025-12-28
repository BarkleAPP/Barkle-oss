import Logger from '@/services/logger.js';
import { WebhookEvents } from '@/models/index.js';
import { WebhookEvent } from '@/models/entities/webhook-event.js';
import { FindOptionsWhere } from 'typeorm';

const logger = new Logger('webhook-event-store');

/**
 * Webhook Event Store
 * Handles idempotent event processing and event history
 */
export class WebhookEventStore {
	/**
	 * Check if an event has already been processed
	 */
	public static async isEventProcessed(
		provider: string,
		eventId: string
	): Promise<boolean> {
		try {
			// Try to find the event in the database
			const existing = await WebhookEvents.findOne({
				where: {
					provider,
					eventId,
				},
			});
			return !!existing;
		} catch (error) {
			// If the table doesn't exist yet, assume not processed
			logger.warn(`⚠️ EVENT_STORE: Error checking event: ${error}`);
			return false;
		}
	}

	/**
	 * Mark an event as processed
	 */
	public static async markEventProcessed(
		provider: string,
		eventId: string,
		eventType: string,
		data?: Record<string, unknown>,
		userId?: string | null
	): Promise<void> {
		try {
			await WebhookEvents.save({
				provider,
				eventId,
				eventType,
				processedAt: new Date(),
				eventData: data || {},
				userId: userId || null,
			});
			logger.info(`✅ EVENT_STORE: Marked ${provider}:${eventId} as processed`);
		} catch (error) {
			logger.error(`❌ EVENT_STORE: Failed to mark event as processed: ${error}`);
			// Don't throw - we don't want to fail the webhook because of storage issues
		}
	}

	/**
	 * Get recent events for a provider
	 */
	public static async getRecentEvents(
		provider: string,
		limit: number = 50
	): Promise<WebhookEvent[]> {
		try {
			return await WebhookEvents.find({
				where: { provider },
				order: { processedAt: 'DESC' },
				take: limit,
			});
		} catch (error) {
			logger.error(`❌ EVENT_STORE: Error fetching events: ${error}`);
			return [];
		}
	}

	/**
	 * Get events for a specific user
	 */
	public static async getEventsByUser(
		userId: string,
		provider?: string,
		limit: number = 50
	): Promise<WebhookEvent[]> {
		try {
			const where: FindOptionsWhere<WebhookEvent> = { userId };
			if (provider) {
				where.provider = provider;
			}

			return await WebhookEvents.find({
				where,
				order: { processedAt: 'DESC' },
				take: limit,
			});
		} catch (error) {
			logger.error(`❌ EVENT_STORE: Error fetching user events: ${error}`);
			return [];
		}
	}

	/**
	 * Clean up old events (older than specified days)
	 */
	public static async cleanupOldEvents(daysOld: number = 30): Promise<number> {
		try {
			const cutoffDate = new Date();
			cutoffDate.setDate(cutoffDate.getDate() - daysOld);

			const result = await WebhookEvents.createQueryBuilder()
				.delete()
				.where('processedAt < :cutoff', { cutoff: cutoffDate })
				.execute();

			const deletedCount = result.affected || 0;
			if (deletedCount > 0) {
				logger.info(`🧹 EVENT_STORE: Cleaned up ${deletedCount} old webhook events`);
			}
			return deletedCount;
		} catch (error) {
			logger.error(`❌ EVENT_STORE: Error cleaning up events: ${error}`);
			return 0;
		}
	}

	/**
	 * Get event statistics per provider
	 */
	public static async getEventStatistics(): Promise<Record<string, number>> {
		try {
			const results = await WebhookEvents.createQueryBuilder('event')
				.select('event.provider', 'provider')
				.addSelect('COUNT(*)', 'count')
				.groupBy('event.provider')
				.getRawMany();

			const stats: Record<string, number> = {};
			for (const row of results) {
				stats[row.provider] = parseInt(row.count, 10);
			}
			return stats;
		} catch (error) {
			logger.error(`❌ EVENT_STORE: Error getting statistics: ${error}`);
			return {};
		}
	}
}

export default WebhookEventStore;
