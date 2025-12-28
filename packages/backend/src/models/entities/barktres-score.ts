import { PrimaryColumn, Entity, Index, JoinColumn, Column, ManyToOne } from 'typeorm';
import { User } from './user.js';
import { id } from '../id.js';

@Entity()
export class BarktresScore {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column('timestamp with time zone', {
		comment: 'The created date of the score.',
	})
	public createdAt: Date;

	@Index()
	@Column(id())
	public userId: User['id'];

	@ManyToOne(type => User, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public user: User | null;

	@Index()
	@Column('integer')
	public score: number;

	@Column('integer')
	public lines: number;

	@Column('integer')
	public level: number;

	@Column('integer')
	public duration: number;

	@Column('varchar', {
		length: 128,
	})
	public sessionToken: string;
}
