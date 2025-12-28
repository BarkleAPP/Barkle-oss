import { LiveChatMessages, Streams, Users } from '@/models/index.js';
import { LiveChatMessage } from '@/models/entities/live-chat-message.js';
import { genId } from '@/misc/gen-id.js';
import { publishLiveChatStream } from '@/services/stream.js';
import define from '../../define.js';
import { ApiError } from '../../error.js';

export const meta = {
    tags: ['live-chat'],
    requireCredential: true,
    kind: 'write:live-chat',
    
    limit: {
        duration: 60000,
        max: 30,
    },

    res: {
        type: 'object',
        optional: false,
        nullable: false,
        ref: 'LiveChatMessage',
    },

    errors: {
        noSuchStream: {
            message: 'No such stream.',
            code: 'NO_SUCH_STREAM',
            id: 'a4d4ce4d-8df7-4c32-b4c2-2a8f7a3b5c4e',
        },
        streamNotActive: {
            message: 'Stream is not active.',
            code: 'STREAM_NOT_ACTIVE',
            id: 'b5e5df5e-9ef8-5d43-c5d3-3a9f8a4b6d5f',
        },
        textRequired: {
            message: 'Text is required.',
            code: 'TEXT_REQUIRED',
            id: 'c6f6e06f-af09-6e54-d6e4-4b0f9a5c7e6g',
        },
        textTooLong: {
            message: 'Text is too long.',
            code: 'TEXT_TOO_LONG',
            id: 'd7g7f17g-bg1a-7f65-e7f5-5c1g0a6d8f7h',
        },
    },
} as const;

export const paramDef = {
    type: 'object',
    properties: {
        streamId: { type: 'string', format: 'barkle:id' },
        text: { type: 'string', minLength: 1, maxLength: 3000 },
    },
    required: ['streamId', 'text'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
    // Check if stream exists
    const stream = await Streams.findOneBy({ id: ps.streamId });
    if (!stream) {
        throw new ApiError(meta.errors.noSuchStream);
    }

    // Check if stream is active (user should be live)
    const streamOwner = await Users.findOneBy({ id: stream.userId });
    if (!streamOwner?.isLive) {
        throw new ApiError(meta.errors.streamNotActive);
    }

    // Validate text
    const text = ps.text.trim();
    if (!text) {
        throw new ApiError(meta.errors.textRequired);
    }

    if (text.length > 3000) {
        throw new ApiError(meta.errors.textTooLong);
    }

    // Create the message
    const message = await LiveChatMessages.insert({
        id: genId(),
        createdAt: new Date(),
        userId: user.id,
        streamId: ps.streamId,
        text: text,
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
    }).then(x => LiveChatMessages.findOneByOrFail({ id: x.identifiers[0].id }));

    // Pack the message
    const packed = await LiveChatMessages.pack(message, user);

    // Publish to live chat stream
    publishLiveChatStream(ps.streamId, 'message', packed);

    return packed;
});
