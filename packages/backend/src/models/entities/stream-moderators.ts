import { PrimaryColumn, Entity, Index, Column, JoinColumn, ManyToOne } from 'typeorm';
import { id } from '../id.js';
import { User } from './user.js';
import { Streams } from './streams.js';

@Entity()
export class StreamModerators {
	@PrimaryColumn(id())
	public id: string;

	@Column('timestamp with time zone', {
		comment: 'The created date of the moderation assignment.',
	})
	public createdAt: Date;

	@Index()
	@Column({
		...id(),
		comment: 'The ID of the stream.',
	})
	public streamId: Streams['id'];

	@ManyToOne(() => Streams, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public stream: Streams | null;

	@Index()
	@Column({
		...id(),
		comment: 'The ID of the moderator user.',
	})
	public userId: User['id'];

	@ManyToOne(() => User, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public user: User | null;

	@Index()
	@Column({
		...id(),
		comment: 'The ID of the user who assigned this moderator (stream owner).',
	})
	public assignedBy: User['id'];

	@ManyToOne(() => User, {
		onDelete: 'CASCADE',
	})
	@JoinColumn({ name: 'assignedBy' })
	public assignedByUser: User | null;
}
