import define from '../../../define.js';
import { Notes } from '@/models/index.js';
import { insertModerationLog } from '@/services/insert-moderation-log.js';

export const meta = {
	secure: true,
	tags: ['admin'],

	requireCredential: true,
	requireModerator: true,
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		noteId: { type: 'string', format: 'barkle:id' },
		shadowHidden: { type: 'boolean' },
	},
	required: ['noteId', 'shadowHidden'],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const note = await Notes.findOneBy({ id: ps.noteId });

	if (note == null) {
		throw new Error('note not found');
	}

	// Update note's shadowHidden field
	await Notes.update(note.id, {
		shadowHidden: ps.shadowHidden,
	});

	// Add moderation log entry
	insertModerationLog(me, 'shadowHideNote', {
		noteId: note.id,
		shadowHidden: ps.shadowHidden,
	});

	return {
		success: true,
	};
});
