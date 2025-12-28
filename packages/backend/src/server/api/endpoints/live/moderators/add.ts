import { StreamModerators, Streams, Users } from '@/models/index.js';
import { genId } from '@/misc/gen-id.js';
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
            id: { type: 'string' },
            streamId: { type: 'string' },
            userId: { type: 'string' },
            assignedBy: { type: 'string' },
            createdAt: { type: 'string' },
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
        cannotModerateOwner: {
            message: 'Cannot add stream owner as moderator.',
            code: 'CANNOT_MODERATE_OWNER',
            id: 'e5f6g7h8-i9j0-1k2l-3m4n-5o6p7q8r9s0t',
        },
    },
} as const;

export const paramDef = {
    type: 'object',
    properties: {
        streamId: { type: 'string', format: 'barkle:id' },
        username: { type: 'string' },
    },
    required: ['streamId', 'username'],
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

    // Find the user to be added as moderator
    const targetUser = await Users.findOneBy({ 
        usernameLower: ps.username.toLowerCase() 
    });
    if (!targetUser) {
        throw new ApiError(meta.errors.noSuchUser);
    }

    // Cannot add stream owner as moderator
    if (targetUser.id === stream.userId) {
        throw new ApiError(meta.errors.cannotModerateOwner);
    }

    // Check if user is already a moderator
    const existingModerator = await StreamModerators.findOneBy({
        streamId: ps.streamId,
        userId: targetUser.id,
    });
    if (existingModerator) {
        throw new ApiError(meta.errors.alreadyModerator);
    }

    // Add moderator
    const moderator = await StreamModerators.insert({
        id: genId(),
        createdAt: new Date(),
        streamId: ps.streamId,
        userId: targetUser.id,
        assignedBy: user.id,
    }).then(x => StreamModerators.findOneByOrFail({ id: x.identifiers[0].id }));

    return {
        id: moderator.id,
        streamId: moderator.streamId,
        userId: moderator.userId,
        assignedBy: moderator.assignedBy,
        createdAt: moderator.createdAt.toISOString(),
    };
});
