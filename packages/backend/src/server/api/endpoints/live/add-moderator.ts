import { StreamModerators, Streams, Users } from '@/models/index.js';
import { genId } from '@/misc/gen-id.js';
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
            id: {
                type: 'string',
                optional: false,
                nullable: false,
            },
        },
    },

    errors: {
        noSuchStream: {
            message: 'No such stream.',
            code: 'NO_SUCH_STREAM',
            id: 'a1b2c3d4-e5f6-7g8h-9i0j-1k2l3m4n5o6p',
        },
        noSuchUser: {
            message: 'No such user.',
            code: 'NO_SUCH_USER',
            id: 'b2c3d4e5-f6g7-8h9i-0j1k-2l3m4n5o6p7q',
        },
        notStreamOwner: {
            message: 'You are not the owner of this stream.',
            code: 'NOT_STREAM_OWNER',
            id: 'c3d4e5f6-g7h8-9i0j-1k2l-3m4n5o6p7q8r',
        },
        alreadyModerator: {
            message: 'User is already a moderator of this stream.',
            code: 'ALREADY_MODERATOR',
            id: 'd4e5f6g7-h8i9-0j1k-2l3m-4n5o6p7q8r9s',
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

    // Check if target user exists
    const targetUser = await Users.findOneBy({ id: ps.userId });
    if (!targetUser) {
        throw new ApiError(meta.errors.noSuchUser);
    }

    // Check if user is already a moderator
    const existingModerator = await StreamModerators.findOneBy({
        streamId: ps.streamId,
        userId: ps.userId,
    });
    if (existingModerator) {
        throw new ApiError(meta.errors.alreadyModerator);
    }

    // Create the moderator assignment
    const moderator = await StreamModerators.insert({
        id: genId(),
        createdAt: new Date(),
        streamId: ps.streamId,
        userId: ps.userId,
        assignedBy: user.id,
    }).then(x => StreamModerators.findOneByOrFail({ id: x.identifiers[0].id }));

    return {
        id: moderator.id,
    };
});
