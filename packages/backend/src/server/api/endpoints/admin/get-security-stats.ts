import define from '../../define.js';
import { SecurityEvents } from '@/models/index.js';
import { MoreThan } from 'typeorm';
import { SecurityEventType } from '@/models/entities/security-event.js';

export const meta = {
	tags: ['admin'],

	requireCredential: true,
	requireModerator: true,

	res: {
		type: 'object',
		optional: false,
		nullable: false,
		properties: {
			totalEvents: { type: 'number' },
			unreviewedEvents: { type: 'number' },
			criticalEvents: { type: 'number' },
			highSeverityEvents: { type: 'number' },
			mediumSeverityEvents: { type: 'number' },
			eventsLast24h: { type: 'number' },
			eventsLast7d: { type: 'number' },
			eventsLast30d: { type: 'number' },
			topEventTypes: {
				type: 'array',
				items: {
					type: 'object',
					properties: {
						type: { type: 'string' },
						count: { type: 'number' },
					},
				},
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const now = new Date();
	const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
	const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
	const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

	const [
		totalEvents,
		unreviewedEvents,
		criticalEvents,
		highSeverityEvents,
		mediumSeverityEvents,
		eventsLast24h,
		eventsLast7d,
		eventsLast30d,
	] = await Promise.all([
		SecurityEvents.count(),
		SecurityEvents.count({ where: { reviewed: false } }),
		SecurityEvents.count({ where: { severity: 'critical' } }),
		SecurityEvents.count({ where: { severity: 'high' } }),
		SecurityEvents.count({ where: { severity: 'medium' } }),
		SecurityEvents.count({ where: { createdAt: MoreThan(yesterday) } }),
		SecurityEvents.count({ where: { createdAt: MoreThan(sevenDaysAgo) } }),
		SecurityEvents.count({ where: { createdAt: MoreThan(thirtyDaysAgo) } }),
	]);

	// Get top event types
	const eventTypeCounts = await SecurityEvents.createQueryBuilder('event')
		.select('event.type', 'type')
		.addSelect('COUNT(*)', 'count')
		.where('event.createdAt > :thirtyDaysAgo', { thirtyDaysAgo })
		.groupBy('event.type')
		.orderBy('COUNT(*)', 'DESC')
		.limit(10)
		.getRawMany();

	const topEventTypes = eventTypeCounts.map(item => ({
		type: item.type,
		count: parseInt(item.count, 10),
	}));

	return {
		totalEvents,
		unreviewedEvents,
		criticalEvents,
		highSeverityEvents,
		mediumSeverityEvents,
		eventsLast24h,
		eventsLast7d,
		eventsLast30d,
		topEventTypes,
	};
});
