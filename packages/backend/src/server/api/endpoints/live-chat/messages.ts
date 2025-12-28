import { LiveChatMessages, Streams, Users } from '@/models/index.js';
import { LiveChatMessage } from '@/models/entities/live-chat-message.js';
import { makePaginationQuery } from '../../common/make-pagination-query.js';
import define from '../../define.js';
import { ApiError } from '../../error.js';

export const meta = {
    tags: ['live-chat'],
    requireCredential: false,
    res: {
        type: 'array',
        optional: false,
        nullable: false,
        items: {
            type: 'object',
            optional: false,
            nullable: false,
            ref: 'LiveChatMessage',
        },
    },
    errors: {
        noSuchStream: {
            message: 'No such stream.',
            code: 'NO_SUCH_STREAM',
            id: 'b4d4ce4d-8df7-4c32-b4c2-2a8f7a3b5c4e',
        },
    },
} as const;

export const paramDef = {
    type: 'object',
    properties: {
        streamId: { type: 'string', format: 'barkle:id' },
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 30 },
        sinceId: { type: 'string', format: 'barkle:id' },
        untilId: { type: 'string', format: 'barkle:id' },
        since: { type: 'integer' },
        until: { type: 'integer' },
    },
    required: ['streamId'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
    // Check if stream exists
    const stream = await Streams.findOneBy({ id: ps.streamId });
    if (!stream) {
        throw new ApiError(meta.errors.noSuchStream);
    }

    const query = makePaginationQuery(LiveChatMessages.createQueryBuilder('message'), ps.sinceId, ps.untilId, ps.since, ps.until)
        .andWhere('message.streamId = :streamId', { streamId: ps.streamId })
        .andWhere('message.isDeleted = :isDeleted', { isDeleted: false })
        .innerJoinAndSelect('message.user', 'user')
        .orderBy('message.createdAt', 'DESC');

    const messages = await query.limit(ps.limit).getMany();

    return await LiveChatMessages.packMany(messages, user);
});
