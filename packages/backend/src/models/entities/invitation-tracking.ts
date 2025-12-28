import { PrimaryColumn, Entity, Index, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { id } from '../id.js';
import { User } from './user.js';

@Entity()
@Index(['inviterId'])
@Index(['inviteCode'], { unique: true })
@Index(['acceptedUserId'])
@Index(['createdAt'])
export class InvitationTracking {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column('varchar', {
		length: 32,
		comment: 'The ID of the user who sent the invitation.',
	})
	public inviterId: string;

	@Index()
	@Column('varchar', {
		length: 32,
		unique: true,
		comment: 'Unique invitation code for tracking.',
	})
	public inviteCode: string;

	@Column('enum', {
		enum: ['sms', 'email', 'social', 'link'],
		comment: 'The method used to send the invitation.',
	})
	public method: 'sms' | 'email' | 'social' | 'link';

	@Column('varchar', {
		length: 255,
		nullable: true,
		comment: 'The recipient identifier (phone/email) if available.',
	})
	public recipientIdentifier: string | null;

	@Column('varchar', {
		length: 255,
		nullable: true,
		comment: 'The display name of the recipient.',
	})
	public recipientName: string | null;

	@Column('boolean', {
		default: false,
		comment: 'Whether this invitation has been accepted.',
	})
	public isAccepted: boolean;

	@Column('varchar', {
		length: 32,
		nullable: true,
		comment: 'The ID of the user who accepted the invitation, if any.',
	})
	public acceptedUserId: string | null;

	@CreateDateColumn()
	public createdAt: Date;

	@Column('timestamp with time zone', {
		nullable: true,
		comment: 'The date when the invitation was accepted.',
	})
	public acceptedAt: Date | null;

	@Column('timestamp with time zone', {
		nullable: true,
		comment: 'The expiration date of the invitation.',
	})
	public expiresAt: Date | null;

	@Column('jsonb', {
		default: {},
		comment: 'Additional metadata for analytics and tracking.',
	})
	public metadata: Record<string, any>;

	@ManyToOne(() => User, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public inviter: User | null;

	@ManyToOne(() => User, {
		onDelete: 'SET NULL',
		nullable: true,
	})
	@JoinColumn()
	public acceptedUser: User | null;
}