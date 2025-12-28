import { db } from '@/db/postgre.js';
import { MessagingMessage } from '@/models/entities/messaging-message.js';
import { Users, DriveFiles, UserGroups, MessagingMessageReactions } from '../index.js';
import { Packed } from '@/misc/schema.js';
import { User } from '@/models/entities/user.js';

export const MessagingMessageRepository = db.getRepository(MessagingMessage).extend({
	async pack(
		src: MessagingMessage['id'] | MessagingMessage,
		me?: { id: User['id'] } | null | undefined,
		options?: {
			populateRecipient?: boolean,
			populateGroup?: boolean,
		}
	): Promise<Packed<'MessagingMessage'>> {
		const opts = options || {
			populateRecipient: true,
			populateGroup: true,
		};

		const message = typeof src === 'object' ? src : await this.findOneByOrFail({ id: src });

		// Get user's reactions to this message
		let userReactions: string[] = [];
		if (me) {
			const reactions = await MessagingMessageReactions.findBy({
				messageId: message.id,
				userId: me.id,
			});
			userReactions = reactions.map(r => r.reaction);
		}

		// Handle encrypted messages - automatically decrypt for the viewing user
		let messageText = message.text;
		if (message.isEncrypted && message.encryptedText && me) {
			try {
				const { MessageEncryptionService } = await import('@/services/encryption/message-encryption.js');
				const decryptResult = await MessageEncryptionService.getMessageText(message.id, me.id);
				messageText = decryptResult.text;
			} catch (error) {
				// If decryption fails, keep the original plain text or show placeholder
				console.warn(`Failed to decrypt message ${message.id} for user ${me.id}:`, error);
				messageText = message.text || '[Encrypted message]';
			}
		}

		return {
			id: message.id,
			createdAt: message.createdAt.toISOString(),
			text: messageText,
			userId: message.userId,
			user: await Users.pack(message.user || message.userId, me),
			recipientId: message.recipientId,
			recipient: message.recipientId && opts.populateRecipient ? await Users.pack(message.recipient || message.recipientId, me) : undefined,
			groupId: message.groupId,
			group: message.groupId && opts.populateGroup ? await UserGroups.pack(message.group || message.groupId) : undefined,
			fileId: message.fileId,
			file: message.fileId ? await DriveFiles.pack(message.fileId) : null,
			isRead: message.isRead,
			reads: message.reads,
			replyId: message.replyId,
			reply: message.reply ? await this.pack(message.reply, me, { populateRecipient: false, populateGroup: false }) : null,
			reactionCounts: message.reactionCounts || {},
			userReactions,
			isEncrypted: message.isEncrypted || false,
			isDeleted: message.isDeleted || false,
			// Encryption fields
			encryptionVersion: message.encryptionVersion,
			encryptionAlgorithm: message.encryptionAlgorithm,
		};
	},
});
