import { Entity, PrimaryColumn, Column, CreateDateColumn, ManyToOne, Index } from 'typeorm';
import { id } from '../id.js';
import { User } from './user.js';

@Entity('notification_schedule')
export class NotificationSchedule {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column('varchar', {
		length: 32,
		comment: 'The ID of the user to notify.',
	})
	public userId: string;

	@ManyToOne(() => User, {
		onDelete: 'CASCADE',
	})
	public user: User | null;

	@Index()
	@Column('varchar', {
		length: 50,
		comment: 'Type of notification: comeback, engagement, social_proof, etc.',
	})
	public type: string;

	@Index()
	@Column('timestamp with time zone', {
		comment: 'When this notification should be sent.',
	})
	public scheduledAt: Date;

	@Column('timestamp with time zone', {
		nullable: true,
		comment: 'When this notification was actually sent.',
	})
	public sentAt: Date | null;

	@Column('jsonb', {
		nullable: true,
		comment: 'JSON data for the notification content.',
	})
	public data: Record<string, any> | null;

	@Index()
	@Column('boolean', {
		default: true,
		comment: 'Whether this scheduled notification is still active.',
	})
	public isActive: boolean;

	@CreateDateColumn()
	public createdAt: Date;
}