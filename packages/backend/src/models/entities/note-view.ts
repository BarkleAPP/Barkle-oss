import { Entity, Column, Index, PrimaryColumn, CreateDateColumn } from 'typeorm';
import { id } from '../id.js';

/**
 * Note View Tracking
 * Tracks when users view notes for algorithm improvements and analytics
 */
@Entity()
@Index(['noteId', 'userId'])
@Index(['userId', 'createdAt'])
@Index(['noteId', 'createdAt'])
export class NoteView {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column(id())
	public noteId: string;

	@Index()
	@Column(id())
	public userId: string;

	@CreateDateColumn()
	public createdAt: Date;

	@Column('integer', {
		default: 0,
		comment: 'Dwell time in milliseconds',
	})
	public dwellTimeMs: number;

	@Column('decimal', {
		precision: 3,
		scale: 2,
		nullable: true,
		comment: 'How far user scrolled on note (0-1)',
	})
	public scrollDepth: number | null;

	@Column('integer', {
		nullable: true,
		comment: 'Position in timeline when viewed',
	})
	public position: number | null;

	@Column('varchar', {
		length: 50,
		nullable: true,
		comment: 'Source of view (timeline, profile, search, etc.)',
	})
	public source: string | null;

	@Column('boolean', {
		default: false,
		comment: 'Whether user engaged with note after viewing',
	})
	public didEngage: boolean;

	@Column('varchar', {
		length: 32,
		nullable: true,
		comment: 'Session ID for tracking session-level behavior',
	})
	public sessionId: string | null;

	@Column('jsonb', {
		default: {},
		comment: 'Additional metadata (device, network, etc.)',
	})
	public metadata: Record<string, any>;

	constructor(data?: Partial<NoteView>) {
		if (data) {
			Object.assign(this, data);
		}
	}
}
