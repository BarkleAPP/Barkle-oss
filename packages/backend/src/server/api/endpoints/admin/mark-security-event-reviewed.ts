import define from '../../define.js';
import { SecurityEvents } from '@/models/index.js';

export const meta = {
	tags: ['admin'],

	requireCredential: true,
	requireModerator: true,

	errors: {
		noSuchEvent: {
			message: 'No such event.',
			code: 'NO_SUCH_EVENT',
			id: '6f8ce72e-d010-4f3d-8c40-f04c3798d9f9',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		eventId: { type: 'string', format: 'barkle:id' },
	},
	required: ['eventId'],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const event = await SecurityEvents.findOneBy({ id: ps.eventId });

	if (event == null) {
		throw new Error('No such event');
	}

	await SecurityEvents.update(event.id, {
		reviewed: true,
	});

	return;
});
