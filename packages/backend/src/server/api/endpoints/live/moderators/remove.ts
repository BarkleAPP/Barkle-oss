import { StreamModerators, Streams } from '@/models/index.js';
import define from '../../../define.js';
import { ApiError } from '../../../error.js';

export const meta = {
    tags: ['live', 'moderation'],
    requireCredential: true,
    kind: 'write:live-chat',
    
    res: {
        type: 'object',
        optional: false,
        nullable: false,
        properties: {
            success: { type: 'boolean' },
        },
    },

    errors: {
        noSuchStream: {
            message: 'No such stream.',
            code: 'NO_SUCH_STREAM',
            id: 'a1b2c3d4-e5f6-7g8h-9i0j-1k2l3m4n5o6p',
        },
        notStreamOwner: {
            message: 'You are not the owner of this stream.',
            code: 'NOT_STREAM_OWNER',
            id: 'c3d4e5f6-g7h8-9i0j-1k2l-3m4n5o6p7q8r',
        },
        noSuchModerator: {
            message: 'No such moderator assignment.',
            code: 'NO_SUCH_MODERATOR',
            id: 'f6g7h8i9-j0k1-2l3m-4n5o-6p7q8r9s0t1u',
        },
    },
} as const;

export const paramDef = {
    type: 'object',
    properties: {
        streamId: { type: 'string', format: 'barkle:id' },
        moderatorId: { type: 'string', format: 'barkle:id' },
    },
    required: ['streamId', 'moderatorId'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
    // Check if stream exists
    const stream = await Streams.findOneBy({ id: ps.streamId });
    if (!stream) {
        throw new ApiError(meta.errors.noSuchStream);
    }

    // Check if user is the stream owner
    if (stream.userId !== user.id) {
        throw new ApiError(meta.errors.notStreamOwner);
    }

    // Find and remove the moderator
    const moderator = await StreamModerators.findOneBy({
        id: ps.moderatorId,
        streamId: ps.streamId,
    });
    if (!moderator) {
        throw new ApiError(meta.errors.noSuchModerator);
    }

    await StreamModerators.delete({ id: ps.moderatorId });

    return {
        success: true,
    };
});
