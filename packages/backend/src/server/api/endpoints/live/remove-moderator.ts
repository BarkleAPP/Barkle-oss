import { StreamModerators, Streams } from '@/models/index.js';
import define from '../../define.js';
import { ApiError } from '../../error.js';

export const meta = {
    tags: ['live', 'moderation'],
    requireCredential: true,
    kind: 'write:live',
    
    res: {
        type: 'object',
        optional: false,
        nullable: false,
        properties: {
            success: {
                type: 'boolean',
                optional: false,
                nullable: false,
            },
        },
    },

    errors: {
        noSuchStream: {
            message: 'No such stream.',
            code: 'NO_SUCH_STREAM',
            id: 'e5f6g7h8-i9j0-1k2l-3m4n-5o6p7q8r9s0t',
        },
        noSuchModerator: {
            message: 'No such moderator.',
            code: 'NO_SUCH_MODERATOR',
            id: 'f6g7h8i9-j0k1-2l3m-4n5o-6p7q8r9s0t1u',
        },
        notStreamOwner: {
            message: 'You are not the owner of this stream.',
            code: 'NOT_STREAM_OWNER',
            id: 'g7h8i9j0-k1l2-3m4n-5o6p-7q8r9s0t1u2v',
        },
    },
} as const;

export const paramDef = {
    type: 'object',
    properties: {
        streamId: { type: 'string', format: 'barkle:id' },
        userId: { type: 'string', format: 'barkle:id' },
    },
    required: ['streamId', 'userId'],
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

    // Find the moderator assignment
    const moderator = await StreamModerators.findOneBy({
        streamId: ps.streamId,
        userId: ps.userId,
    });
    if (!moderator) {
        throw new ApiError(meta.errors.noSuchModerator);
    }

    // Remove the moderator assignment
    await StreamModerators.delete(moderator.id);

    return {
        success: true,
    };
});
