import { Entity, Column, Index, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { id } from '../id.js';
import { User } from './user.js';
import { Note } from './note.js';

@Entity()
@Index(['userId', 'createdAt'])
@Index(['contentId', 'interactionType'])
export class UserBehavioralData {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column({
		...id(),
		comment: 'The ID of the user who performed the interaction.',
	})
	public userId: User['id'];

	@ManyToOne(type => User, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public user: User | null;

	@Index()
	@Column({
		...id(),
		comment: 'The ID of the content that was interacted with.',
	})
	public contentId: Note['id'];

	@ManyToOne(type => Note, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public content: Note | null;

	@Index()
	@Column('varchar', {
		length: 32,
		comment: 'Type of interaction performed.',
	})
	public interactionType: 'reaction' | 'share' | 'comment' | 'view' | 'dwell' | 'skip' | 'block' | 'renote';

	@Column('varchar', {
		length: 32,
		nullable: true,
		comment: 'Specific reaction type (e.g., ❤️, 👍, 😂) for reaction interactions.',
	})
	public reactionType: string | null;

	@Index()
	@Column('timestamp with time zone', {
		comment: 'When the interaction occurred.',
	})
	public createdAt: Date;

	@Column('integer', {
		nullable: true,
		comment: 'Duration of interaction in milliseconds (for dwell time).',
	})
	public duration: number | null;

	@Column('jsonb', {
		default: {},
		comment: 'Context information about the interaction.',
	})
	public context: {
		deviceType?: 'mobile' | 'desktop' | 'tablet';
		timeOfDay?: number;
		location?: string;
		sessionId?: string;
		scrollPosition?: number;
		viewportSize?: { width: number; height: number };
	};

	@Column('decimal', {
		precision: 5,
		scale: 4,
		default: 0,
		comment: 'Engagement score for this interaction (-1 to 1).',
	})
	public engagementScore: number;

	@Column('boolean', {
		default: false,
		comment: 'Whether this interaction has been processed by the ML pipeline.',
	})
	public processed: boolean;

	constructor(data: Partial<UserBehavioralData>) {
		if (data == null) return;

		for (const [k, v] of Object.entries(data)) {
			(this as any)[k] = v;
		}
	}
}