import { Entity, Column, Index, PrimaryColumn, OneToOne, JoinColumn } from 'typeorm';
import { id } from '../id.js';
import { Note } from './note.js';
import { User } from './user.js';

@Entity()
@Index(['createdAt', 'viralityScore'])
@Index(['authorId', 'engagementRate'])
export class ContentAlgorithmFeatures {
	@PrimaryColumn(id())
	public contentId: Note['id'];

	@OneToOne(type => Note, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public content: Note | null;

	@Index()
	@Column({
		...id(),
		comment: 'The ID of the content author.',
	})
	public authorId: User['id'];

	@Column('jsonb', {
		default: [],
		comment: '256-dimensional content embedding vector.',
	})
	public embedding: number[];

	@Column('jsonb', {
		default: [],
		comment: 'Extracted topics from content.',
	})
	public topics: string[];

	@Column('varchar', {
		length: 10,
		default: 'en',
		comment: 'Detected language of the content.',
	})
	public language: string;

	@Column('varchar', {
		length: 32,
		comment: 'Type of content.',
	})
	public contentType: 'text' | 'image' | 'video' | 'poll' | 'renote';

	@Column('boolean', {
		default: false,
		comment: 'Whether content has media attachments.',
	})
	public hasMedia: boolean;

	@Column('integer', {
		nullable: true,
		comment: 'Length of text content in characters.',
	})
	public textLength: number | null;

	@Column('integer', {
		default: 0,
		comment: 'Number of media attachments.',
	})
	public mediaCount: number;

	@Index()
	@Column('timestamp with time zone', {
		comment: 'When the content was created.',
	})
	public createdAt: Date;

	@Column('integer', {
		default: 0,
		comment: 'Number of reactions.',
	})
	public reactions: number;

	@Column('integer', {
		default: 0,
		comment: 'Number of shares/renotes.',
	})
	public shares: number;

	@Column('integer', {
		default: 0,
		comment: 'Number of comments/replies.',
	})
	public comments: number;

	@Column('integer', {
		default: 0,
		comment: 'Number of views.',
	})
	public views: number;

	@Column('integer', {
		default: 0,
		comment: 'Number of renotes.',
	})
	public renotes: number;

	@Index()
	@Column('decimal', {
		precision: 5,
		scale: 4,
		default: 0,
		comment: 'Overall engagement rate (0-1).',
	})
	public engagementRate: number;

	@Index()
	@Column('decimal', {
		precision: 5,
		scale: 4,
		default: 0,
		comment: 'Virality score for trending detection (0-1).',
	})
	public viralityScore: number;

	@Column('decimal', {
		precision: 3,
		scale: 2,
		default: 1.0,
		comment: 'Time-based freshness factor (0-1).',
	})
	public freshness: number;

	@Column('decimal', {
		precision: 3,
		scale: 2,
		default: 0.5,
		comment: 'Content quality assessment (0-1).',
	})
	public qualityScore: number;

	@Column('timestamp with time zone', {
		comment: 'When features were last updated.',
	})
	public lastUpdated: Date;

	@Column('varchar', {
		length: 32,
		default: '1.0',
		comment: 'Algorithm version used for feature extraction.',
	})
	public algorithmVersion: string;

	@Column('boolean', {
		default: false,
		comment: 'Whether embedding has been computed.',
	})
	public embeddingComputed: boolean;

	constructor(data: Partial<ContentAlgorithmFeatures>) {
		if (data == null) return;

		for (const [k, v] of Object.entries(data)) {
			(this as any)[k] = v;
		}
	}
}