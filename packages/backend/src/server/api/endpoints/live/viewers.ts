import define from '../../define.js';
import { Users, Streams } from '@/models/index.js';
import { ApiError } from '../../error.js';
import { webSocketViewerTracker } from '@/services/websocket-viewer-tracker.js';

export const meta = {
	tags: ['live'],
	requireCredential: false, // Allow public access for viewer counts
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		userId: { type: 'string', format: 'barkle:id' },
	},
	required: ['userId'],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	// Get user from database
	const user = await Users.findOneBy({ id: ps.userId });
	if (!user) {
		throw new ApiError({
			message: 'User not found',
			code: 'USER_NOT_FOUND',
			id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
		});
	}

	// For non-live users, return 0 viewers
	if (!user.isLive) {
		return {
			views: 0,
			viewers: 0,
			updated_at: new Date().toISOString(),
		};
	}

	// Get the stream for the user
	const stream = await Streams.findOne({
		where: { userId: ps.userId },
	});

	if (!stream) {
		return {
			views: 0,
			viewers: 0,
			updated_at: new Date().toISOString(),
		};
	}

	// Get viewer count from WebSocket tracker
	const viewerCount = webSocketViewerTracker.getViewerCount(stream.id);

	const data = {
		views: viewerCount, // For compatibility, use same value for both
		viewers: viewerCount,
		updated_at: new Date().toISOString(),
	};

	return data;
});
