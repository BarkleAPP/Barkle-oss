import * as crypto from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { genRsaKeyPair } from '@/misc/gen-key-pair.js';
import { UserEncryptionKeys, MessageEncryptionKeys, UserEncryptionPreferences } from '@/models/index.js';
import { User } from '@/models/entities/user.js';
import { genId } from '@/misc/gen-id.js';
import { UserEncryptionKey } from '@/models/entities/user-encryption-key.js';
import { MessageEncryptionKey } from '@/models/entities/message-encryption-key.js';
import { UserEncryptionPreference } from '@/models/entities/user-encryption-preference.js';

export interface EncryptionResult {
	encryptedText: string;
	encryptionVersion: string;
	encryptionAlgorithm: string;
	encryptionKeyId: string;
	encryptionIv: string;
	encryptionSalt: string;
}

export interface DecryptionResult {
	text: string;
	isLegacy: boolean;
}

const ENCRYPTION_VERSION = '2.0';
const SYMMETRIC_ALGORITHM = 'aes-256-cbc';
const ASYMMETRIC_ALGORITHM = 'rsa-oaep';

export class MessageEncryptionService {
	/**
	 * Initialize encryption keys for a user automatically (no password required)
	 */
	static async initializeUserKeysAuto(userId: User['id']): Promise<UserEncryptionKey> {
		// Check if user already has active keys
		const existingKey = await UserEncryptionKeys.findOneBy({
			userId,
			isActive: true,
		});

		if (existingKey) {
			return existingKey;
		}

		// Generate RSA key pair
		const { publicKey, privateKey } = await genRsaKeyPair(2048);

		// For auto-generated keys, we'll store the private key encrypted with a system-generated key
		// This is less secure than user password but provides automatic encryption
		const systemKey = crypto.randomBytes(32);
		const salt = crypto.randomBytes(32);
		const iv = crypto.randomBytes(16);
		const cipher = crypto.createCipheriv('aes-256-cbc', new Uint8Array(systemKey), new Uint8Array(iv));
		let encryptedPrivateKey = cipher.update(privateKey, 'utf8', 'hex');
		encryptedPrivateKey += cipher.final('hex');

		// Store the system key, salt and IV with the encrypted private key
		const privateKeyWithMetadata = JSON.stringify({
			encryptedKey: encryptedPrivateKey,
			systemKey: systemKey.toString('hex'),
			salt: salt.toString('hex'),
			iv: iv.toString('hex'),
			version: 'auto',
		});

		const encryptionKey = {
			id: genId(),
			userId,
			publicKey,
			privateKeyEncrypted: privateKeyWithMetadata,
			algorithm: ASYMMETRIC_ALGORITHM,
			keySize: 2048,
			createdAt: new Date(),
			isActive: true,
			version: 'auto-' + ENCRYPTION_VERSION,
		} as UserEncryptionKey;

		await UserEncryptionKeys.insert(encryptionKey);

		// Initialize user preferences with encryption enabled by default
		await this.initializeUserPreferencesAuto(userId);

		return encryptionKey;
	}

	/**
	 * Initialize encryption preferences for a user with auto-encryption enabled
	 */
	static async initializeUserPreferencesAuto(userId: User['id']): Promise<UserEncryptionPreference> {
		const existingPrefs = await UserEncryptionPreferences.findOneBy({ userId });
		if (existingPrefs) {
			return existingPrefs;
		}

		const preferences = {
			userId,
			encryptByDefault: true, // Enable by default for auto-generated keys
			allowLegacyMessages: true,
			keyRotationDays: 365,
			lastKeyRotation: null,
			createdAt: new Date(),
			updatedAt: new Date(),
		} as UserEncryptionPreference;

		await UserEncryptionPreferences.insert(preferences);
		return preferences;
	}

	/**
	 * Initialize encryption preferences for a user
	 */
	static async initializeUserPreferences(userId: User['id']): Promise<UserEncryptionPreference> {
		const existingPrefs = await UserEncryptionPreferences.findOneBy({ userId });
		if (existingPrefs) {
			return existingPrefs;
		}

		const preferences = {
			userId,
			encryptByDefault: false,
			allowLegacyMessages: true,
			keyRotationDays: 365,
			lastKeyRotation: null,
			createdAt: new Date(),
			updatedAt: new Date(),
		} as UserEncryptionPreference;

		await UserEncryptionPreferences.insert(preferences);
		return preferences;
	}

	/**
	 * Encrypt message text for multiple recipients
	 */
	static async encryptMessage(
		text: string,
		senderUserId: User['id'],
		recipientUserIds: User['id'][]
	): Promise<{
		encryptionResult: EncryptionResult;
		messageEncryptionKeys: MessageEncryptionKey[];
	}> {
		// Generate a random symmetric key for this message
		const symmetricKey = crypto.randomBytes(32);
		const iv = crypto.randomBytes(16); // 16 bytes for CBC
		const salt = crypto.randomBytes(16);

		// Encrypt the message with AES-256-CBC
		const cipher = crypto.createCipheriv('aes-256-cbc', new Uint8Array(symmetricKey), new Uint8Array(iv));
		let encryptedText = cipher.update(text, 'utf8', 'hex');
		encryptedText += cipher.final('hex');

		// Combine encrypted text (no auth tag for CBC)
		const encryptedData = JSON.stringify({
			data: encryptedText,
		});

		const keyId = genId();

		// Encrypt the symmetric key for each recipient (including sender)
		const allUserIds = [senderUserId, ...recipientUserIds.filter(id => id !== senderUserId)];
		const messageEncryptionKeys: MessageEncryptionKey[] = [];

		for (const userId of allUserIds) {
			const userKey = await UserEncryptionKeys.findOneBy({
				userId,
				isActive: true,
			});

			if (!userKey) {
				// Skip users without encryption keys - they can't receive encrypted messages
				console.warn(`User ${userId} does not have encryption keys, skipping encryption for this user`);
				continue;
			}

			// Encrypt symmetric key with user's public key
			const encryptedSymmetricKey = crypto.publicEncrypt(
				{
					key: userKey.publicKey,
					padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
				},
				new Uint8Array(symmetricKey)
			);

			const messageKey = {
				id: genId(),
				messageId: '', // Will be set after message creation
				userId,
				encryptedKey: encryptedSymmetricKey.toString('base64'),
				algorithm: SYMMETRIC_ALGORITHM,
				createdAt: new Date(),
			} as MessageEncryptionKey;

			messageEncryptionKeys.push(messageKey);
		}

		const encryptionResult: EncryptionResult = {
			encryptedText: encryptedData,
			encryptionVersion: ENCRYPTION_VERSION,
			encryptionAlgorithm: SYMMETRIC_ALGORITHM,
			encryptionKeyId: keyId,
			encryptionIv: iv.toString('hex'),
			encryptionSalt: salt.toString('hex'),
		};

		return { encryptionResult, messageEncryptionKeys };
	}

	/**
	 * Decrypt message text for a specific user
	 */
	static async decryptMessage(
		messageId: string,
		userId: User['id'],
		userPassword?: string
	): Promise<DecryptionResult> {
		// Get the message encryption key for this user
		const messageKey = await MessageEncryptionKeys.findOneBy({
			messageId,
			userId,
		});

		if (!messageKey) {
			throw new Error('No decryption key available for this message');
		}

		// Get user's private key
		const userKey = await UserEncryptionKeys.findOneBy({
			userId,
			isActive: true,
		});

		if (!userKey) {
			throw new Error('No encryption key found for user');
		}

		// Decrypt user's private key if password is provided
		let privateKey: string;
		if (userPassword) {
			privateKey = await this.decryptPrivateKey(userKey.privateKeyEncrypted, userPassword);
		} else {
			throw new Error('User password required for decryption');
		}

		// Decrypt the symmetric key
		const encryptedSymmetricKey = Buffer.from(messageKey.encryptedKey, 'base64');
		const symmetricKeyBuffer = crypto.privateDecrypt(
			{
				key: privateKey,
				padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
			},
			new Uint8Array(encryptedSymmetricKey)
		);

		// Get the message and decrypt it
		const message = await import('@/models/index.js').then(m => m.MessagingMessages.findOneBy({ id: messageId }));
		if (!message || !message.encryptedText) {
			throw new Error('Message not found or not encrypted');
		}

		const encryptedData = JSON.parse(message.encryptedText);
		const iv = Buffer.from(message.encryptionIv!, 'hex');

		const decipher = crypto.createDecipheriv(SYMMETRIC_ALGORITHM, new Uint8Array(symmetricKeyBuffer), new Uint8Array(iv));
		let decryptedText = decipher.update(encryptedData.data, 'hex', 'utf8');
		decryptedText += decipher.final('utf8');

		return {
			text: decryptedText,
			isLegacy: false,
		};
	}

	/**
	 * Decrypt user's private key
	 */
	static async decryptPrivateKey(encryptedPrivateKey: string, userPassword: string): Promise<string> {
		const metadata = JSON.parse(encryptedPrivateKey);
		const salt = metadata.salt;
		const iv = metadata.iv;
		
		// Handle both old and new encryption formats for backwards compatibility
		if (metadata.version === 'v2') {
			// New format with stronger parameters
			const key = crypto.pbkdf2Sync(userPassword, salt, 200000, 32, 'sha256');
			const ivBuffer = Buffer.from(iv, 'hex');
			const decipher = crypto.createDecipheriv('aes-256-cbc', new Uint8Array(key), new Uint8Array(ivBuffer));
			let privateKey = decipher.update(metadata.encryptedKey, 'hex', 'utf8');
			privateKey += decipher.final('utf8');
			return privateKey;
		} else {
			// Legacy format
			const key = crypto.pbkdf2Sync(userPassword, salt, 100000, 32, 'sha256');
			const ivBuffer = Buffer.from(iv, 'hex');
			const decipher = crypto.createDecipheriv('aes-256-cbc', new Uint8Array(key), new Uint8Array(ivBuffer));
			let privateKey = decipher.update(metadata.encryptedKey, 'hex', 'utf8');
			privateKey += decipher.final('utf8');
			return privateKey;
		}
	}

	/**
	 * Decrypt user's private key (auto-generated or password-based)
	 */
	static async decryptPrivateKeyAuto(encryptedPrivateKey: string): Promise<string> {
		const metadata = JSON.parse(encryptedPrivateKey);
		
		// Handle auto-generated keys
		if (metadata.version === 'auto' && metadata.systemKey) {
			const systemKey = Buffer.from(metadata.systemKey, 'hex');
			const salt = Buffer.from(metadata.salt, 'hex');
			const iv = Buffer.from(metadata.iv, 'hex');

			const decipher = crypto.createDecipheriv('aes-256-cbc', new Uint8Array(systemKey), new Uint8Array(iv));
			let privateKey = decipher.update(metadata.encryptedKey, 'hex', 'utf8');
			privateKey += decipher.final('utf8');

			return privateKey;
		} else {
			// Legacy password-based keys
			throw new Error('Password-based keys require user password for decryption');
		}
	}

	/**
	 * Decrypt message text for a specific user (auto-version)
	 */
	static async decryptMessageAuto(
		messageId: string,
		userId: User['id']
	): Promise<DecryptionResult> {
		// Get the message encryption key for this user
		const messageKey = await MessageEncryptionKeys.findOneBy({
			messageId,
			userId,
		});

		if (!messageKey) {
			throw new Error('No decryption key available for this message');
		}

		// Get user's private key
		const userKey = await UserEncryptionKeys.findOneBy({
			userId,
			isActive: true,
		});

		if (!userKey) {
			throw new Error('No encryption key found for user');
		}

		// Decrypt user's private key (auto-generated keys don't need password)
		let privateKey: string;
		try {
			privateKey = await this.decryptPrivateKeyAuto(userKey.privateKeyEncrypted);
		} catch (error) {
			throw new Error('Unable to decrypt private key automatically');
		}

		// Decrypt the symmetric key
		const encryptedSymmetricKey = Buffer.from(messageKey.encryptedKey, 'base64');
		const symmetricKeyBuffer = crypto.privateDecrypt(
			{
				key: privateKey,
				padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
			},
			new Uint8Array(encryptedSymmetricKey)
		);

		// Get the message and decrypt it
		const message = await import('@/models/index.js').then(m => m.MessagingMessages.findOneBy({ id: messageId }));
		if (!message || !message.encryptedText) {
			throw new Error('Message not found or not encrypted');
		}

		const encryptedData = JSON.parse(message.encryptedText);
		const iv = Buffer.from(message.encryptionIv!, 'hex');

		const decipher = crypto.createDecipheriv(SYMMETRIC_ALGORITHM, new Uint8Array(symmetricKeyBuffer), new Uint8Array(iv));
		let decryptedText = decipher.update(encryptedData.data, 'hex', 'utf8');
		decryptedText += decipher.final('utf8');

		return {
			text: decryptedText,
			isLegacy: false,
		};
	}

	/**
	 * Check if user should encrypt messages by default
	 */
	static async shouldEncryptByDefault(userId: User['id']): Promise<boolean> {
		const preferences = await UserEncryptionPreferences.findOneBy({ userId });
		return preferences?.encryptByDefault ?? false;
	}

	/**
	 * Check if user can receive legacy messages
	 */
	static async canReceiveLegacyMessages(userId: User['id']): Promise<boolean> {
		const preferences = await UserEncryptionPreferences.findOneBy({ userId });
		return preferences?.allowLegacyMessages ?? true;
	}

	/**
	 * Check if user's keys need rotation
	 */
	static async needsKeyRotation(userId: User['id']): Promise<boolean> {
		const userKey = await UserEncryptionKeys.findOneBy({
			userId,
			isActive: true,
		});

		if (!userKey) return true;

		const preferences = await UserEncryptionPreferences.findOneBy({ userId });
		if (!preferences) return false;

		const daysSinceCreation = Math.floor(
			(Date.now() - userKey.createdAt.getTime()) / (1000 * 60 * 60 * 24)
		);

		return daysSinceCreation >= preferences.keyRotationDays;
	}

	/**
	 * Rotate user's encryption keys
	 */
	static async rotateUserKeys(userId: User['id'], userPassword: string): Promise<UserEncryptionKey> {
		// Deactivate current keys
		await UserEncryptionKeys.update(
			{ userId, isActive: true },
			{ isActive: false }
		);

		// Generate new keys
		const newKey = await this.initializeUserKeysAuto(userId);

		// Update last rotation date
		await UserEncryptionPreferences.update(
			{ userId },
			{ lastKeyRotation: new Date(), updatedAt: new Date() }
		);

		return newKey;
	}

	/**
	 * Get message text (encrypted or legacy)
	 */
	static async getMessageText(
		messageId: string,
		userId: User['id'],
		userPassword?: string
	): Promise<DecryptionResult> {
		const message = await import('@/models/index.js').then(m => m.MessagingMessages.findOneBy({ id: messageId }));
		if (!message) {
			throw new Error('Message not found');
		}

		// If message is encrypted, decrypt it
		if (message.isEncrypted && message.encryptedText) {
			try {
				// Try auto-decryption first (for auto-generated keys)
				return await this.decryptMessageAuto(messageId, userId);
			} catch (error) {
				// Fall back to password-based decryption if available
				if (userPassword) {
					return await this.decryptMessage(messageId, userId, userPassword);
				} else {
					throw new Error('Message is encrypted but user password is required for decryption');
				}
			}
		}

		// Legacy unencrypted message
		if (message.text) {
			return {
				text: message.text,
				isLegacy: true,
			};
		}

		throw new Error('Message has no content');
	}
}
