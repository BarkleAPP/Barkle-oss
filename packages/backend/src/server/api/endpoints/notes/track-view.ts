import define from '../../define.js';
import { NoteViews } from '@/models/index.js';
import { genId } from '@/misc/gen-id.js';
import Logger from '@/services/logger.js';

const logger = new Logger('track-note-view');

export const meta = {
	tags: ['notes', 'tracking'],
	requireCredential: true,
	kind: 'write:account',
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		noteId: {
			type: 'string',
			format: 'misskey:id',
		},
		dwellTimeMs: {
			type: 'number',
			minimum: 0,
			description: 'How long user viewed the note in milliseconds',
		},
		scrollDepth: {
			type: 'number',
			minimum: 0,
			maximum: 1,
			description: 'How far user scrolled (0-1)',
		},
		position: {
			type: 'number',
			minimum: 0,
			description: 'Position in timeline',
		},
		source: {
			type: 'string',
			enum: ['timeline', 'profile', 'search', 'notification', 'share', 'embed', 'other'],
			description: 'Where the note was viewed from',
		},
		didEngage: {
			type: 'boolean',
			description: 'Whether user engaged (liked, shared, replied)',
		},
		sessionId: {
			type: 'string',
			description: 'Session ID for tracking session behavior',
		},
		metadata: {
			type: 'object',
			description: 'Additional tracking metadata',
		},
	},
	required: ['noteId'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	try {
		// Create view record
		await NoteViews.insert({
			id: genId(),
			noteId: ps.noteId,
			userId: user.id,
			dwellTimeMs: ps.dwellTimeMs || 0,
			scrollDepth: ps.scrollDepth || null,
			position: ps.position || null,
			source: ps.source || 'other',
			didEngage: ps.didEngage || false,
			sessionId: ps.sessionId || null,
			metadata: ps.metadata || {},
		});

		logger.debug(`View tracked: Note ${ps.noteId} by user ${user.id}`);

		return {
			success: true,
		};
	} catch (error) {
		logger.error('Error tracking note view:', error as Error);

		return {
			success: false,
			error: (error as Error).message,
		};
	}
});
