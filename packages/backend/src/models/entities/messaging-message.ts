import { PrimaryColumn, Entity, Index, JoinColumn, Column, ManyToOne } from 'typeorm';
import { User } from './user.js';
import { DriveFile } from './drive-file.js';
import { id } from '../id.js';
import { UserGroup } from './user-group.js';

@Entity()
export class MessagingMessage {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column('timestamp with time zone', {
		comment: 'The created date of the MessagingMessage.',
	})
	public createdAt: Date;

	@Index()
	@Column({
		...id(),
		comment: 'The sender user ID.',
	})
	public userId: User['id'];

	@ManyToOne(type => User, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public user: User | null;

	@Index()
	@Column({
		...id(), nullable: true,
		comment: 'The recipient user ID.',
	})
	public recipientId: User['id'] | null;

	@ManyToOne(type => User, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public recipient: User | null;

	@Index()
	@Column({
		...id(), nullable: true,
		comment: 'The recipient group ID.',
	})
	public groupId: UserGroup['id'] | null;

	@ManyToOne(type => UserGroup, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public group: UserGroup | null;

	@Column('varchar', {
		length: 4096, nullable: true,
	})
	public text: string | null;

	@Column('boolean', {
		default: false,
	})
	public isRead: boolean;

	@Column('varchar', {
		length: 512, nullable: true,
	})
	public uri: string | null;

	@Column({
		...id(),
		array: true, default: '{}',
	})
	public reads: User['id'][];

	@Column({
		...id(),
		nullable: true,
	})
	public fileId: DriveFile['id'] | null;

	@ManyToOne(type => DriveFile, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public file: DriveFile | null;

	@Index()
	@Column({
		...id(),
		nullable: true,
		comment: 'The parent message ID for replies.',
	})
	public replyId: MessagingMessage['id'] | null;

	@ManyToOne(type => MessagingMessage, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public reply: MessagingMessage | null;

	@Column('jsonb', {
		default: {},
		comment: 'Reaction counts for this message.',
	})
	public reactionCounts: Record<string, number>;

	@Column('boolean', {
		default: false,
		comment: 'Whether the message has been deleted.',
	})
	public isDeleted: boolean;

	// Encryption fields
	@Column('text', {
		nullable: true,
		comment: 'Encrypted message text.',
	})
	public encryptedText: string | null;

	@Column('varchar', {
		length: 10,
		nullable: true,
		comment: 'Encryption version.',
	})
	public encryptionVersion: string | null;

	@Column('varchar', {
		length: 50,
		nullable: true,
		comment: 'Encryption algorithm used.',
	})
	public encryptionAlgorithm: string | null;

	@Index()
	@Column('varchar', {
		length: 64,
		nullable: true,
		comment: 'Encryption key ID.',
	})
	public encryptionKeyId: string | null;

	@Column('varchar', {
		length: 32,
		nullable: true,
		comment: 'Encryption initialization vector.',
	})
	public encryptionIv: string | null;

	@Column('varchar', {
		length: 32,
		nullable: true,
		comment: 'Encryption salt.',
	})
	public encryptionSalt: string | null;

	@Index()
	@Column('boolean', {
		default: false,
		comment: 'Whether the message is encrypted.',
	})
	public isEncrypted: boolean;
}
