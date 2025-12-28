import { Entity, Column, Index, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { id } from '../id.js';
import { User } from './user.js';

@Entity()
@Index(['userId', 'createdAt'])
@Index(['userId', 'cursor'])
export class TimelineCache {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column({
		...id(),
		comment: 'The ID of the user this timeline belongs to.',
	})
	public userId: User['id'];

	@ManyToOne(type => User, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public user: User | null;

	@Column('jsonb', {
		comment: 'Cached timeline content with ranking scores.',
	})
	public content: {
		contentId: string;
		userId: string;
		relevanceScore: number;
		diversityScore: number;
		finalScore: number;
		source: string;
		rankingFactors: Record<string, number>;
	}[];

	@Index()
	@Column('timestamp with time zone', {
		comment: 'When this cache entry was generated.',
	})
	public createdAt: Date;

	@Index()
	@Column('varchar', {
		length: 128,
		comment: 'Pagination cursor for this cache entry.',
	})
	public cursor: string;

	@Column('integer', {
		default: 3600,
		comment: 'Time to live in seconds.',
	})
	public ttl: number;

	@Column('varchar', {
		length: 64,
		comment: 'Cache version for invalidation.',
	})
	public version: string;

	@Column('varchar', {
		length: 32,
		default: '1.0',
		comment: 'Algorithm version used to generate this cache.',
	})
	public algorithmVersion: string;

	@Column('integer', {
		default: 20,
		comment: 'Number of items in this cache batch.',
	})
	public batchSize: number;

	@Column('boolean', {
		default: true,
		comment: 'Whether there are more items available.',
	})
	public hasMore: boolean;

	@Column('jsonb', {
		default: {},
		comment: 'Generation metadata and performance metrics.',
	})
	public metadata: {
		generationTime?: number;
		candidateCount?: number;
		cacheHit?: boolean;
		diversityScore?: number;
	};

	constructor(data: Partial<TimelineCache>) {
		if (data == null) return;

		for (const [k, v] of Object.entries(data)) {
			(this as any)[k] = v;
		}
	}
}