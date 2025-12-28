import { PrimaryColumn, Entity, Index, JoinColumn, Column, ManyToOne } from 'typeorm';
import { User } from './user.js';
import { id } from '../id.js';

@Entity()
export class UserEncryptionKey {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column({
		...id(),
		comment: 'The user ID this encryption key belongs to.',
	})
	public userId: User['id'];

	@ManyToOne(type => User, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public user: User | null;

	@Column('text', {
		comment: 'The RSA public key in PEM format.',
	})
	public publicKey: string;

	@Column('text', {
		comment: 'The RSA private key encrypted with user password, in PEM format.',
	})
	public privateKeyEncrypted: string;

	@Column('varchar', {
		length: 50,
		default: 'rsa-oaep',
		comment: 'The encryption algorithm used.',
	})
	public algorithm: string;

	@Column('integer', {
		default: 2048,
		comment: 'The key size in bits.',
	})
	public keySize: number;

	@Index()
	@Column('timestamp with time zone', {
		comment: 'The created date of the encryption key.',
	})
	public createdAt: Date;

	@Index()
	@Column('boolean', {
		default: true,
		comment: 'Whether this key is currently active.',
	})
	public isActive: boolean;

	@Column('varchar', {
		length: 10,
		default: '1.0',
		comment: 'The encryption version.',
	})
	public version: string;
}
