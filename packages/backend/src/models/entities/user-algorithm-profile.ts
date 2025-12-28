import { Entity, Column, Index, PrimaryColumn, OneToOne, JoinColumn } from 'typeorm';
import { id } from '../id.js';
import { User } from './user.js';

@Entity()
export class UserAlgorithmProfile {
	@PrimaryColumn(id())
	public userId: User['id'];

	@OneToOne(type => User, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public user: User | null;

	@Column('jsonb', {
		default: [],
		comment: '256-dimensional user embedding vector.',
	})
	public embedding: number[];

	@Column('jsonb', {
		default: {},
		comment: 'Interest categories with weights.',
	})
	public interestCategories: Record<string, number>;

	@Column('decimal', {
		precision: 8,
		scale: 2,
		default: 0,
		comment: 'Average dwell time in milliseconds.',
	})
	public avgDwellTime: number;

	@Column('jsonb', {
		default: [],
		comment: 'Preferred content types.',
	})
	public preferredContentTypes: string[];

	@Column('jsonb', {
		default: [],
		comment: 'Active time windows for engagement.',
	})
	public activeTimeWindows: {
		startHour: number;
		endHour: number;
		dayOfWeek?: number;
		engagementLevel: number;
	}[];

	@Column('decimal', {
		precision: 3,
		scale: 2,
		default: 0.5,
		comment: 'How much user follows social signals (0-1).',
	})
	public socialInfluence: number;

	@Column('decimal', {
		precision: 3,
		scale: 2,
		default: 0.2,
		comment: 'Diversity preference (0-1, higher = more exploration).',
	})
	public diversityPreference: number;

	@Index()
	@Column('timestamp with time zone', {
		comment: 'When the profile was last updated.',
	})
	public lastUpdated: Date;

	@Column('integer', {
		default: 0,
		comment: 'Total number of interactions recorded.',
	})
	public totalInteractions: number;

	@Column('decimal', {
		precision: 5,
		scale: 4,
		default: 0,
		comment: 'Overall engagement rate (0-1).',
	})
	public engagementRate: number;

	@Column('jsonb', {
		default: [],
		comment: 'Recent interaction summary for quick access.',
	})
	public recentInteractions: {
		contentId: string;
		interactionType: string;
		timestamp: Date;
		score: number;
	}[];

	@Column('varchar', {
		length: 32,
		default: '1.0',
		comment: 'Algorithm version used for this profile.',
	})
	public algorithmVersion: string;

	@Column('boolean', {
		default: true,
		comment: 'Whether personalization is enabled for this user.',
	})
	public personalizationEnabled: boolean;

	constructor(data: Partial<UserAlgorithmProfile>) {
		if (data == null) return;

		for (const [k, v] of Object.entries(data)) {
			(this as any)[k] = v;
		}
	}
}