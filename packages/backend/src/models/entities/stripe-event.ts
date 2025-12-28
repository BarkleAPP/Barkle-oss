import { PrimaryColumn, Entity, Index, Column } from 'typeorm';
import { id } from '../id.js';

@Entity()
export class StripeEvent {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column('varchar', {
		length: 128,
		comment: 'Stripe event type (e.g., customer.subscription.created)',
	})
	public type: string;

	@Index()
	@Column('timestamp with time zone', {
		comment: 'When the event was processed',
	})
	public processedAt: Date;

	@Column('jsonb', {
		default: {},
		comment: 'Full Stripe event data for debugging',
	})
	public eventData: Record<string, any>;

	@Column('varchar', {
		length: 128,
		nullable: true,
		comment: 'User ID associated with this event',
	})
	public userId: string | null;
}
