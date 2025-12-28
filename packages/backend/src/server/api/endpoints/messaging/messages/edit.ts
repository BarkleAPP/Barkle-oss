import define from '../../../define.js';
import { ApiError } from '../../../error.js';
import { MessagingMessages, UserGroupJoinings } from '@/models/index.js';
import { publishMessagingStream, publishGroupMessagingStream } from '@/services/stream.js';

export const meta = {
	tags: ['messaging'],

	requireCredential: true,

	kind: 'write:messaging',

	errors: {
		noSuchMessage: {
			message: 'No such message.',
			code: 'NO_SUCH_MESSAGE',
			id: '54b5b326-7925-42cf-8019-130fda8b56af',
		},

		accessDenied: {
			message: 'You can only edit your own messages.',
			code: 'ACCESS_DENIED',
			id: '2ce9b3f9-fd08-4a15-8289-da5b5b82e4cb',
		},

		messageNotEditable: {
			message: 'This message cannot be edited.',
			code: 'MESSAGE_NOT_EDITABLE',
			id: '3ce9b3f9-fd08-4a15-8289-da5b5b82e4cb',
		},
	},

	res: {
		type: 'object',
		optional: false, nullable: false,
		ref: 'MessagingMessage',
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		messageId: { type: 'string', format: 'barkle:id' },
		text: { type: 'string', nullable: false, maxLength: 3000 },
	},
	required: ['messageId', 'text'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// Get the message
	const message = await MessagingMessages.findOne({
		where: {
			id: ps.messageId,
			isDeleted: false,
		},
		relations: {
			user: true,
			recipient: true,
			group: true,
		},
	});

	if (message == null) {
		throw new ApiError(meta.errors.noSuchMessage);
	}

	// Check if user owns the message
	if (message.userId !== user.id) {
		throw new ApiError(meta.errors.accessDenied);
	}

	// Check if message is editable (only text messages, and within reasonable time limit)
	const messageAge = Date.now() - message.createdAt.getTime();
	const maxEditTime = 24 * 60 * 60 * 1000; // 24 hours
	
	if (messageAge > maxEditTime) {
		throw new ApiError(meta.errors.messageNotEditable);
	}

	// Update the message
	await MessagingMessages.update(ps.messageId, {
		text: ps.text,
	});

	// Get updated message
	const updatedMessage = await MessagingMessages.findOneOrFail({
		where: { id: ps.messageId },
		relations: {
			user: true,
			recipient: true,
			group: true,
			reply: {
				user: true,
				file: true,
			},
		},
	});

	// Add edited flag for response
	(updatedMessage as any).isEdited = true;

	// Publish to streams
	if (message.recipientId) {
		const recipientId = message.recipientId === user.id ? message.userId : message.recipientId;
		publishMessagingStream(recipientId, user.id, 'message', await MessagingMessages.pack(updatedMessage, { id: recipientId }));
	}

	if (message.groupId) {
		publishGroupMessagingStream(message.groupId, 'message', await MessagingMessages.pack(updatedMessage, user));
	}

	return await MessagingMessages.pack(updatedMessage, user);
});
