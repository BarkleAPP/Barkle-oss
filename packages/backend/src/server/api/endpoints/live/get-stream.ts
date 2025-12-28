import { Users, Streams } from '@/models/index.js';
import define from '../../define.js';
import { ApiError } from '../../error.js';
import { webSocketViewerTracker } from '@/services/websocket-viewer-tracker.js';

export const meta = {
    tags: ['stream'],
    requireCredential: false,
    res: {
        type: 'object',
        optional: false,
        nullable: false,
        properties: {
            id: { type: 'string', nullable: true },
            isActive: { type: 'boolean' },
            url: { type: 'string', nullable: true },
            playbackId: { type: 'string', nullable: true },
            title: { type: 'string', nullable: true },
            noteId: { type: 'string', nullable: true },
            viewers: { type: 'number' }
        }
    },
    errors: {
        noUser: {
            message: 'No user found.',
            code: 'NO_USER',
            id: '1d7c06cd-b9aa-4863-9534-fd8695099b8f',
        }
    },
} as const;

export const paramDef = {
    type: 'object',
    properties: {
        userId: { type: 'string', format: 'barkle:id' }
    },
    required: ['userId'],
} as const;

export default define(meta, paramDef, async (ps) => {
    // Get user from database
    const user = await Users.findOneBy({ id: ps.userId });
    if (!user) {
        throw new ApiError(meta.errors.noUser);
    }

    // Get the latest stream for the user
    const stream = await Streams.findOne({
        where: { userId: ps.userId },
    });

    // Get current viewer count from WebSocket tracker
    const currentViewers = stream?.id ? webSocketViewerTracker.getViewerCount(stream.id) : 0;

    // Return data including playbackId if available
    return {
        id: stream?.id || null,
        isActive: user.isLive || false,
        url: user.liveUrl || null,
        playbackId: stream?.playbackId || null,
        title: stream?.title,
        noteId: stream?.noteId,
        viewers: currentViewers,
    };
});