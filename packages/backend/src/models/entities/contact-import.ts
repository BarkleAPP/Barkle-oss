import { PrimaryColumn, Entity, Index, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { id } from '../id.js';
import { User } from './user.js';

@Entity()
@Index(['userId', 'hashedContact'], { unique: true })
@Index(['hashedContact'])
@Index(['matchedUserId'])
export class ContactImport {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column('varchar', {
		length: 32,
		comment: 'The ID of the user who imported this contact.',
	})
	public userId: string;

	@Column('varchar', {
		length: 64,
		comment: 'SHA-256 hash of the contact identifier (phone/email) for privacy.',
	})
	public hashedContact: string;

	@Column('varchar', {
		length: 255,
		nullable: true,
		comment: 'The display name of the contact.',
	})
	public contactName: string | null;

	@Column('varchar', {
		length: 32,
		nullable: true,
		default: 'import',
		comment: 'Source of the contact (e.g., import, suggestion, inference)',
	})
	public source: string | null;

	@Column('boolean', {
		default: false,
		comment: 'Whether this contact has been matched to a Barkle user.',
	})
	public isMatched: boolean;

	@Column('varchar', {
		length: 32,
		nullable: true,
		comment: 'The ID of the matched Barkle user, if any.',
	})
	public matchedUserId: string | null;

	@CreateDateColumn()
	public createdAt: Date;

	@ManyToOne(() => User, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public user: User | null;

	@ManyToOne(() => User, {
		onDelete: 'SET NULL',
		nullable: true,
	})
	@JoinColumn()
	public matchedUser: User | null;
}
