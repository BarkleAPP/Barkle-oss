import { Entity, Column, Index, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { id } from '../id.js';
import { User } from './user.js';

export type GiftedSubscriptionPlan = 'plus' | 'mplus';
export type GiftedSubscriptionType = 'month' | 'year';
export type GiftedSubscriptionStatus = 'pending_redemption' | 'redeemed' | 'expired';

@Entity()
@Index(['token'], { unique: true })
export class GiftedSubscription {
	@PrimaryColumn(id())
	public id: string;

	@Column('timestamp with time zone', {
		comment: 'The created date of the gifted subscription.',
	})
	public createdAt: Date;

	@Column('varchar', {
		length: 64, // Length for a secure random string
		unique: true,
		comment: 'Unique token for the gift redemption link.',
	})
	public token: string;

	@Column('varchar', {
		length: 10,
		comment: 'The plan type of the gifted subscription (e.g., plus, mplus).',
	})
	public plan: GiftedSubscriptionPlan;

	@Column('varchar', {
		length: 10,
		comment: 'The duration of the gifted subscription (e.g., month, year).',
	})
	public subscriptionType: GiftedSubscriptionType;

	@Column('varchar', {
		length: 20,
		default: 'pending_redemption',
		comment: 'The status of the gifted subscription.',
	})
	public status: GiftedSubscriptionStatus;

	@Column('timestamp with time zone', {
		nullable: true,
		comment: 'The date when the gift subscription expires if not redeemed.',
	})
	public expiresAt: Date | null;

	@Column({ ...id(), nullable: true, comment: 'The ID of the user who purchased this gift.' })
	public purchasedByUserId: User['id'] | null;

	@ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'purchasedByUserId' })
	public purchasedByUser: User | null;

	@Column({ ...id(), nullable: true, comment: 'The ID of the user who redeemed this gift.' })
	public redeemedByUserId: User['id'] | null;

	@ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'redeemedByUserId' })
	public redeemedByUser: User | null;

	@Column('timestamp with time zone', {
		nullable: true,
		comment: 'The date when the gifted subscription was redeemed.',
	})
	public redeemedAt: Date | null;

	@Column('varchar', {
		length: 255, // Stripe IDs can be long
		nullable: true,
		comment: 'The Stripe Checkout Session ID associated with the purchase of this gift.',
	})
	public stripeCheckoutSessionId: string | null;

	@Column('text', {
		nullable: true,
		comment: 'Optional personalized message from the gift purchaser to the recipient.',
	})
	public message: string | null;

	@Column('jsonb', {
		nullable: true,
		comment: 'JSON metadata for tracking subscription transitions and states.',
		default: {}
	})
	public metadata: Record<string, any> | null;
}
