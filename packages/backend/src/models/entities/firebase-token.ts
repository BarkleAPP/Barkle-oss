import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, Index } from 'typeorm';
import { id } from '../id.js';
import { User } from './user.js';

@Entity('firebase_token')
export class FirebaseToken {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column('varchar', {
		length: 32,
		comment: 'The ID of the user who owns this token.',
	})
	public userId: string;

	@ManyToOne(() => User, {
		onDelete: 'CASCADE',
	})
	public user: User | null;

	@Index()
	@Column('text', {
		comment: 'The Firebase Cloud Messaging token.',
	})
	public token: string;

	@Column('varchar', {
		length: 255,
		nullable: true,
		comment: 'Unique device identifier for deduplication.',
	})
	public deviceId: string | null;

	@Column('varchar', {
		length: 50,
		default: 'web',
		comment: 'Platform: web, ios, android.',
	})
	public platform: string;

	@Column('varchar', {
		length: 50,
		nullable: true,
		comment: 'App version when token was registered.',
	})
	public appVersion: string | null;

	@Index()
	@Column('boolean', {
		default: true,
		comment: 'Whether this token is still valid and active.',
	})
	public isActive: boolean;

	@Column('timestamp with time zone', {
		nullable: true,
		comment: 'When this token was last used successfully.',
	})
	public lastUsed: Date | null;

	@CreateDateColumn()
	public createdAt: Date;

	@UpdateDateColumn()
	public updatedAt: Date;
}