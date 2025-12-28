import { PrimaryColumn, Entity, Index, JoinColumn, Column, ManyToOne } from 'typeorm';
import { User } from './user.js';
import { MessagingMessage } from './messaging-message.js';
import { id } from '../id.js';

@Entity()
export class MessageEncryptionKey {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column({
		...id(),
		comment: 'The message ID this encryption key belongs to.',
	})
	public messageId: MessagingMessage['id'];

	@ManyToOne(type => MessagingMessage, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public message: MessagingMessage | null;

	@Index()
	@Column({
		...id(),
		comment: 'The user ID this encrypted key is for.',
	})
	public userId: User['id'];

	@ManyToOne(type => User, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public user: User | null;

	@Column('text', {
		comment: 'The symmetric key encrypted with the user\'s public key.',
	})
	public encryptedKey: string;

	@Column('varchar', {
		length: 50,
		default: 'aes-256-gcm',
		comment: 'The encryption algorithm used for the message.',
	})
	public algorithm: string;

	@Column('timestamp with time zone', {
		comment: 'The created date of the encryption key.',
	})
	public createdAt: Date;
}
