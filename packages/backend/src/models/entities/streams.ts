import { PrimaryColumn, Entity, Index, Column } from 'typeorm';
import { id } from '../id.js';
import { User } from './user.js';

@Entity()
export class Streams {
	@PrimaryColumn('varchar', { length: 128 })
    public id: string;

	@Column('timestamp with time zone', {
		nullable: true,
	})
	public updatedAt: Date | null;

	@Index()
	@Column('varchar', {
		length: 128,
	})
	public title: string;

	@Column('varchar', {
		length: 512, nullable: true,
	})
	public key: string | null;

	@Index()
	@Column({
		...id(),
		comment: 'The ID of author.',
	})
	public userId: User['id'];

	@Column('varchar', {
		length: 512,
		default: '',
	})
	public url: string;

	@Column('varchar', {
		length: 512,
		default: '',
	})
	public playbackId: string;

	@Column('varchar', {
		length: 512,
		default: '',
	})
	public noteId: string;

	@Column('varchar', {
		length: 16,
		default: 'rtmp',
	})
	public streamingMode: string;

	@Column('boolean', {
		default: false,
	})
	public isLive: boolean;
}
