import { PrimaryColumn, Entity, Index, Column } from 'typeorm';
import { id } from '../id.js';
import { User } from './user.js';

/**
 * IP Ban Entity
 * Tracks banned IP addresses for security
 */
@Entity()
@Index(['ip'], { unique: true })
export class IpBan {
	@PrimaryColumn(id())
	public id: string;

	@Column('timestamp with time zone', {
		comment: 'The created date of the IP ban.',
	})
	public createdAt: Date;

	@Index()
	@Column(id(), {
		nullable: true,
		comment: 'The user ID that caused this ban (if applicable)',
	})
	public userId: User['id'] | null;

	@Column('varchar', {
		length: 128,
		comment: 'The banned IP address',
	})
	public ip: string;

	@Column('varchar', {
		length: 512,
		nullable: true,
		comment: 'Reason for the ban',
	})
	public reason: string | null;

	@Column('timestamp with time zone', {
		nullable: true,
		comment: 'When the ban expires (null for permanent)',
	})
	public expiresAt: Date | null;
}
