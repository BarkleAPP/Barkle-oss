import { LiveChatMessages, Streams, StreamModerators } from '@/models/index.js';
import { publishLiveChatStream } from '@/services/stream.js';
import define from '../../define.js';
import { ApiError } from '../../error.js';

export const meta = {
    tags: ['live-chat'],
    requireCredential: true,
    kind: 'write:live-chat',

    errors: {
        noSuchMessage: {
            message: 'No such message.',
            code: 'NO_SUCH_MESSAGE',
            id: 'e8h8g28h-ch2b-8g76-f8g6-6d2h1b7e9g8i',
        },
        accessDenied: {
            message: 'Access denied.',
            code: 'ACCESS_DENIED', 
            id: 'f9i9h39i-di3c-9h87-g9h7-7e3i2c8f0h9j',
        },
    },
} as const;

export const paramDef = {
    type: 'object',
    properties: {
        messageId: { type: 'string', format: 'barkle:id' },
    },
    required: ['messageId'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
    // Find the message
    const message = await LiveChatMessages.findOneBy({ 
        id: ps.messageId,
        isDeleted: false,
    });
    
    if (!message) {
        throw new ApiError(meta.errors.noSuchMessage);
    }

    // Get the stream to check permissions
    const stream = await Streams.findOneBy({ id: message.streamId });
    if (!stream) {
        throw new ApiError(meta.errors.noSuchMessage);
    }

    // Check if user can delete (own message, stream owner, site moderator, or stream moderator)
    let canDelete = message.userId === user.id || 
                   stream.userId === user.id || 
                   user.isModerator || 
                   user.isAdmin;

    // If not already allowed, check if user is a stream moderator
    if (!canDelete) {
        const streamModerator = await StreamModerators.findOneBy({
            streamId: message.streamId,
            userId: user.id,
        });
        canDelete = !!streamModerator;
    }

    if (!canDelete) {
        throw new ApiError(meta.errors.accessDenied);
    }

    // Mark message as deleted
    await LiveChatMessages.update(message.id, {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: user.id,
    });

    // Publish deletion to live chat stream
    publishLiveChatStream(message.streamId, 'deleted', {
        messageId: message.id,
        deletedBy: user.id,
    });

    return { success: true };
});
