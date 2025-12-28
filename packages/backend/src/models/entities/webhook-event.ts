import { PrimaryColumn, Entity, Index, Column } from 'typeorm';
import { id } from '../id.js';

/**
 * WebhookEvent Entity
 * Stores processed webhook events for idempotency and audit trail
 * Works with all webhook providers (Stripe, Mux, RevenueCat, etc.)
 */
@Entity()
export class WebhookEvent {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column('varchar', {
		length: 64,
		comment: 'Webhook provider (stripe, mux, revenuecat, etc.)',
	})
	public provider: string;

	@Index()
	@Column('varchar', {
		length: 256,
		comment: 'Provider-specific event ID for idempotency',
	})
	public eventId: string;

	@Index()
	@Column('varchar', {
		length: 128,
		comment: 'Event type (e.g., payment.succeeded, video.asset.ready)',
	})
	public eventType: string;

	@Index()
	@Column('timestamp with time zone', {
		comment: 'When the event was processed',
	})
	public processedAt: Date;

	@Column('jsonb', {
		default: {},
		comment: 'Full event data for debugging',
	})
	public eventData: Record<string, unknown>;

	@Index()
	@Column('varchar', {
		length: 128,
		nullable: true,
		comment: 'User ID associated with this event',
	})
	public userId: string | null;
}
