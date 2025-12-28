import { User } from '@/models/entities/user.js';
import { UserGroup } from '@/models/entities/user-group.js';
import { DriveFile } from '@/models/entities/drive-file.js';
import { MessagingMessages, UserGroupJoinings, Mutings, Users, MessageEncryptionKeys } from '@/models/index.js';
import { genId } from '@/misc/gen-id.js';
import { MessagingMessage } from '@/models/entities/messaging-message.js';
import { publishMessagingStream, publishMessagingIndexStream, publishMainStream, publishGroupMessagingStream } from '@/services/stream.js';
import { pushNotification } from '@/services/push-notification.js';
import { Not } from 'typeorm';
import { MessageEncryptionService } from '@/services/encryption/message-encryption.js';

export async function createMessage(
    user: { id: User['id'] }, 
    recipientUser: { id: User['id'] } | undefined, 
    recipientGroup: UserGroup | undefined, 
    text: string | null | undefined, 
    file: DriveFile | null,
    replyId: string | null = null,
    shouldEncrypt: boolean = true  // Default to encrypted
) {
    let encryptionResult = null;
    let messageEncryptionKeys = null;
    let finalText = text ? text.trim() : null;
    
    // Determine recipients for encryption
    let recipientUserIds: User['id'][] = [];
    if (recipientUser) {
        recipientUserIds = [recipientUser.id];
    } else if (recipientGroup) {
        const joinings = await UserGroupJoinings.findBy({ userGroupId: recipientGroup.id });
        recipientUserIds = joinings.map(j => j.userId).filter(id => id !== user.id);
    }

    // Check if we should encrypt by default
    if (!shouldEncrypt && recipientUserIds.length > 0) {
        shouldEncrypt = await MessageEncryptionService.shouldEncryptByDefault(user.id);
        
        // Also check if any recipient has encryption enabled by default
        if (!shouldEncrypt) {
            for (const recipientId of recipientUserIds) {
                if (await MessageEncryptionService.shouldEncryptByDefault(recipientId)) {
                    shouldEncrypt = true;
                    break;
                }
            }
        }
    }

    // Encrypt message if needed and possible
    if (shouldEncrypt && finalText && recipientUserIds.length > 0) {
        try {
            // Check if sender has encryption keys, if not, auto-generate them
            let senderKey = await import('@/models/index.js').then(m => m.UserEncryptionKeys.findOneBy({
                userId: user.id,
                isActive: true,
            }));
            
            if (!senderKey) {
                console.log(`Auto-generating encryption keys for user ${user.id}`);
                senderKey = await MessageEncryptionService.initializeUserKeysAuto(user.id);
            }

            // Auto-generate keys for recipients who don't have them
            for (const recipientId of recipientUserIds) {
                const recipientKey = await import('@/models/index.js').then(m => m.UserEncryptionKeys.findOneBy({
                    userId: recipientId,
                    isActive: true,
                }));
                
                if (!recipientKey) {
                    console.log(`Auto-generating encryption keys for user ${recipientId}`);
                    await MessageEncryptionService.initializeUserKeysAuto(recipientId);
                }
            }

            const encryption = await MessageEncryptionService.encryptMessage(
                finalText,
                user.id,
                recipientUserIds
            );
            encryptionResult = encryption.encryptionResult;
            messageEncryptionKeys = encryption.messageEncryptionKeys;
            
            // Only clear plain text if we actually encrypted the message successfully
            if (messageEncryptionKeys && messageEncryptionKeys.length > 0) {
                finalText = null; // Clear plain text since we have encrypted version
            }
        } catch (error) {
            console.warn('Failed to encrypt message, sending as plain text:', error);
            // Continue with unencrypted message
        }
    }

    const message = {
        id: genId(),
        createdAt: new Date(),
        fileId: file ? file.id : null,
        recipientId: recipientUser ? recipientUser.id : null,
        groupId: recipientGroup ? recipientGroup.id : null,
        text: finalText,
        userId: user.id,
        isRead: false,
        reads: [] as any[],
        replyId: replyId,
        // Encryption fields
        isEncrypted: encryptionResult !== null,
        encryptedText: encryptionResult?.encryptedText || null,
        encryptionVersion: encryptionResult?.encryptionVersion || null,
        encryptionAlgorithm: encryptionResult?.encryptionAlgorithm || null,
        encryptionKeyId: encryptionResult?.encryptionKeyId || null,
        encryptionIv: encryptionResult?.encryptionIv || null,
        encryptionSalt: encryptionResult?.encryptionSalt || null,
    } as MessagingMessage;

    await MessagingMessages.insert(message);

    // Insert encryption keys if message is encrypted
    if (messageEncryptionKeys) {
        const keysToInsert = messageEncryptionKeys.map(key => ({
            ...key,
            messageId: message.id,
        }));
        await MessageEncryptionKeys.insert(keysToInsert);
    }

    if (recipientUser) {
        // Pack message for sender and recipient separately to handle encryption
        const senderMessageObj = await MessagingMessages.pack(message, { id: message.userId });
        const recipientMessageObj = await MessagingMessages.pack(message, { id: recipientUser.id });

        // User's stream
        publishMessagingStream(message.userId, recipientUser.id, 'message', senderMessageObj);
        publishMessagingIndexStream(message.userId, 'message', senderMessageObj);
        publishMainStream(message.userId, 'messagingMessage', senderMessageObj);

        // Recipient's stream
        publishMessagingStream(recipientUser.id, message.userId, 'message', recipientMessageObj);
        publishMessagingIndexStream(recipientUser.id, 'message', recipientMessageObj);
        publishMainStream(recipientUser.id, 'messagingMessage', recipientMessageObj);
    } else if (recipientGroup) {
        // For groups, pack message for each member individually
        const joinings = await UserGroupJoinings.findBy({ userGroupId: recipientGroup.id });
        
        // Group stream - use sender's perspective
        const senderMessageObj = await MessagingMessages.pack(message, { id: message.userId });
        publishGroupMessagingStream(recipientGroup.id, 'message', senderMessageObj);

        // Members' streams - pack for each member individually
        for (const joining of joinings) {
            const memberMessageObj = await MessagingMessages.pack(message, { id: joining.userId });
            publishMessagingIndexStream(joining.userId, 'message', memberMessageObj);
            publishMainStream(joining.userId, 'messagingMessage', memberMessageObj);
        }
    }

    // Send unread notification after 2 seconds if message remains unread
    setTimeout(async () => {
        const freshMessage = await MessagingMessages.findOneBy({ id: message.id });
        if (freshMessage == null) return;

        if (recipientUser) {
            if (freshMessage.isRead) return;

            const mute = await Mutings.findBy({
                muterId: recipientUser.id,
            });
            if (mute.map(m => m.muteeId).includes(user.id)) return;

            publishMainStream(recipientUser.id, 'unreadMessagingMessage', await MessagingMessages.pack(message, { id: recipientUser.id }));
            pushNotification(recipientUser.id, 'unreadMessagingMessage', await MessagingMessages.pack(message, { id: recipientUser.id }));
        } else if (recipientGroup) {
            const joinings = await UserGroupJoinings.findBy({ userGroupId: recipientGroup.id, userId: Not(user.id) });
            for (const joining of joinings) {
                if (freshMessage.reads.includes(joining.userId)) return;
                publishMainStream(joining.userId, 'unreadMessagingMessage', await MessagingMessages.pack(message, { id: joining.userId }));
                pushNotification(joining.userId, 'unreadMessagingMessage', await MessagingMessages.pack(message, { id: joining.userId }));
            }
        }
    }, 2000);

    return await MessagingMessages.pack(
        await MessagingMessages.findOne({
            where: { id: message.id },
            relations: {
                reply: {
                    user: true,
                    file: true,
                },
            },
        }) || message, 
        { id: message.userId }
    );
}
