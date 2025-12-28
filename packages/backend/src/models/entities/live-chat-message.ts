import { PrimaryColumn, Entity, Index, JoinColumn, Column, ManyToOne } from 'typeorm';
import { User } from './user.js';
import { id } from '../id.js';
import { Streams } from './streams.js';

@Entity()
export class LiveChatMessage {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column('timestamp with time zone', {
		comment: 'The created date of the LiveChatMessage.',
	})
	public createdAt: Date;

	@Index()
	@Column({
		...id(),
		comment: 'The ID of author.',
	})
	public userId: User['id'];

	@ManyToOne(type => User, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public user: User | null;

	@Index()
	@Column('varchar', {
		length: 128,
		comment: 'The ID of the stream.',
	})
	public streamId: Streams['id'];

	@ManyToOne(type => Streams, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public stream: Streams | null;

	@Column('varchar', {
		length: 3000,
		comment: 'The message text.',
	})
	public text: string;

	@Column('boolean', {
		default: false,
		comment: 'Whether the message is deleted.',
	})
	public isDeleted: boolean;

	@Column('timestamp with time zone', {
		nullable: true,
		comment: 'The deleted date of the LiveChatMessage.',
	})
	public deletedAt: Date | null;

	@Column({
		...id(),
		nullable: true,
		comment: 'The ID of user who deleted this message.',
	})
	public deletedBy: User['id'] | null;
}
