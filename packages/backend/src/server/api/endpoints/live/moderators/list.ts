import { StreamModerators, Streams } from '@/models/index.js';
import define from '../../../define.js';
import { ApiError } from '../../../error.js';

export const meta = {
    tags: ['live', 'moderation'],
    requireCredential: true,
    kind: 'read:live-chat',
    
    res: {
        type: 'array',
        optional: false,
        nullable: false,
        items: {
            type: 'object',
            optional: false,
            nullable: false,
            properties: {
                id: { type: 'string' },
                userId: { type: 'string' },
                username: { type: 'string' },
                name: { type: 'string', nullable: true },
                avatarUrl: { type: 'string', nullable: true },
                assignedBy: { type: 'string' },
                createdAt: { type: 'string' },
            },
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
    },
} as const;

export const paramDef = {
    type: 'object',
    properties: {
        streamId: { type: 'string', format: 'barkle:id' },
    },
    required: ['streamId'],
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

    // Get all moderators for this stream
    const moderators = await StreamModerators.find({
        where: { streamId: ps.streamId },
        relations: ['user'],
        order: { createdAt: 'DESC' },
    });

    return moderators.map(mod => ({
        id: mod.id,
        userId: mod.userId,
        username: mod.user?.username || '',
        name: mod.user?.name || null,
        avatarUrl: mod.user?.avatarUrl || null,
        assignedBy: mod.assignedBy,
        createdAt: mod.createdAt.toISOString(),
    }));
});
