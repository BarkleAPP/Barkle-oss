import { StreamModerators, Users } from '@/models/index.js';
import define from '../../define.js';
import { ApiError } from '../../error.js';

export const meta = {
    tags: ['live', 'moderation'],
    requireCredential: true,
    kind: 'read:live',
    
    res: {
        type: 'array',
        optional: false,
        nullable: false,
        items: {
            type: 'object',
            optional: false,
            nullable: false,
            ref: 'UserLite',
        },
    },

    errors: {
        noSuchStream: {
            message: 'No such stream.',
            code: 'NO_SUCH_STREAM',
            id: 'h8i9j0k1-l2m3-4n5o-6p7q-8r9s0t1u2v3w',
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
    // Get all moderators for the stream
    const moderators = await StreamModerators.find({
        where: { streamId: ps.streamId },
        relations: ['user'],
    });

    // Pack the user information
    const packedModerators = await Promise.all(
        moderators.map(async (moderator) => {
            if (!moderator.user) {
                const userData = await Users.findOneBy({ id: moderator.userId });
                return Users.pack(userData, user, { detail: false });
            }
            return Users.pack(moderator.user, user, { detail: false });
        })
    );

    return packedModerators.filter(Boolean);
});
