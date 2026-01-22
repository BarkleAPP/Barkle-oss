import define from '../../define.js';
import { SecurityEvents } from '@/models/index.js';
import { makePaginationQuery } from '../../common/make-pagination-query.js';
import { SecurityEventType } from '@/models/entities/security-event.js';

export const meta = {
	tags: ['admin'],

	requireCredential: true,
	requireModerator: true,

	res: {
		type: 'array',
		optional: false,
		nullable: false,
		items: {
			type: 'object',
			optional: false,
			nullable: false,
			properties: {
				id: {
					type: 'string',
					optional: false,
					nullable: false,
					format: 'barkle:id',
				},
				createdAt: {
					type: 'string',
					optional: false,
					nullable: false,
					format: 'date-time',
				},
				type: {
					type: 'string',
					optional: false,
					nullable: false,
					enum: Object.values(SecurityEventType),
				},
				userId: {
					type: 'string',
					optional: false,
					nullable: true,
					format: 'barkle:id',
				},
				user: {
					type: 'object',
					optional: false,
					nullable: true,
					ref: 'UserDetailed',
				},
				ipAddress: {
					type: 'string',
					optional: false,
					nullable: true,
				},
				userAgent: {
					type: 'string',
					optional: false,
					nullable: true,
				},
				details: {
					type: 'object',
					optional: false,
					nullable: true,
				},
				severity: {
					type: 'string',
					optional: false,
					nullable: true,
					enum: ['critical', 'high', 'medium', 'low', 'info'],
				},
				reviewed: {
					type: 'boolean',
					optional: false,
					nullable: false,
				},
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
		sinceId: { type: 'string', format: 'barkle:id' },
		untilId: { type: 'string', format: 'barkle:id' },
		type: { type: 'string', enum: Object.values(SecurityEventType) },
		severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'info'] },
		userId: { type: 'string', format: 'barkle:id' },
		unreviewedOnly: { type: 'boolean', default: false },
	},
	required: [],
} as const;

export default define(meta, paramDef, async (ps) => {
	const query = makePaginationQuery(SecurityEvents.createQueryBuilder('event'), ps.sinceId, ps.untilId);

	// Filter by type if specified
	if (ps.type) {
		query.andWhere('event.type = :type', { type: ps.type });
	}

	// Filter by severity if specified
	if (ps.severity) {
		query.andWhere('event.severity = :severity', { severity: ps.severity });
	}

	// Filter by user if specified
	if (ps.userId) {
		query.andWhere('event.userId = :userId', { userId: ps.userId });
	}

	// Filter by reviewed status
	if (ps.unreviewedOnly) {
		query.andWhere('event.reviewed = false');
	}

	// Order by most recent first
	query.orderBy('event.createdAt', 'DESC');

	const events = await query.take(ps.limit).getMany();

	return await SecurityEvents.packMany(events);
});
