import { PrimaryColumn, Entity, JoinColumn, Column, OneToOne } from 'typeorm';
import { User } from './user.js';
import { id } from '../id.js';

@Entity()
export class UserEncryptionPreference {
	@PrimaryColumn({
		...id(),
		comment: 'The user ID.',
	})
	public userId: User['id'];

	@OneToOne(type => User, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public user: User | null;

	@Column('boolean', {
		default: false,
		comment: 'Whether to encrypt messages by default.',
	})
	public encryptByDefault: boolean;

	@Column('boolean', {
		default: true,
		comment: 'Whether to allow receiving legacy (unencrypted) messages.',
	})
	public allowLegacyMessages: boolean;

	@Column('integer', {
		default: 365,
		comment: 'Number of days after which to rotate encryption keys.',
	})
	public keyRotationDays: number;

	@Column('timestamp with time zone', {
		nullable: true,
		comment: 'The date of the last key rotation.',
	})
	public lastKeyRotation: Date | null;

	@Column('timestamp with time zone', {
		comment: 'The created date of the preference.',
	})
	public createdAt: Date;

	@Column('timestamp with time zone', {
		comment: 'The updated date of the preference.',
	})
	public updatedAt: Date;
}
