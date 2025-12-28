import { Entity, Column, Index, PrimaryColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { id } from '../id.js';
import { User } from './user.js';
import { AlgorithmExperiment } from './algorithm-experiment.js';

/**
 * User's Assignment to Algorithm A/B Test Experiments
 * Tracks which variant each user is in for consistent experience
 */
@Entity()
@Index(['userId', 'experimentId'], { unique: true })
@Index(['userId'])
@Index(['experimentId', 'variantId'])
export class UserAlgorithmExperiment {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column(id())
	public userId: User['id'];

	@ManyToOne(type => User, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public user: User | null;

	@Index()
	@Column(id())
	public experimentId: AlgorithmExperiment['id'];

	@ManyToOne(type => AlgorithmExperiment, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public experiment: AlgorithmExperiment | null;

	@Index()
	@Column('varchar', {
		length: 128,
		comment: 'Which variant this user is assigned to',
	})
	public variantId: string;

	@CreateDateColumn()
	public assignedAt: Date;

	@Column('jsonb', {
		comment: 'Cached variant configuration for fast access',
	})
	public config: any;

	@Column('jsonb', {
		default: {},
		comment: 'Metrics collected for this user in this experiment',
	})
	public metrics: Record<string, {
		value: number;
		sampleSize: number;
		lastUpdated: Date;
	}>;

	constructor(data?: Partial<UserAlgorithmExperiment>) {
		if (data) {
			Object.assign(this, data);
		}
	}
}
