import { db } from '@/db/postgre.js';
import { FirebaseToken } from '@/models/entities/firebase-token.js';
import { genId } from '@/misc/gen-id.js';

export const FirebaseTokenRepository = db.getRepository(FirebaseToken).extend({
	/**
	 * Register or update a Firebase token for a user
	 */
	async registerToken(
		userId: string,
		token: string,
		deviceId?: string,
		platform: string = 'web',
		appVersion?: string
	): Promise<FirebaseToken> {
		// First, check if this user already has this token registered
		const existingForUser = await this.findOne({
			where: { userId, token },
		});

		if (existingForUser) {
			// Update existing token for this user
			existingForUser.deviceId = deviceId || existingForUser.deviceId;
			existingForUser.platform = platform;
			existingForUser.appVersion = appVersion || existingForUser.appVersion;
			existingForUser.isActive = true;
			existingForUser.lastUsed = new Date();
			existingForUser.updatedAt = new Date();
			
			return await this.save(existingForUser);
		}

		// Clean up any old tokens for this user on the same device/platform combination
		// This prevents multiple tokens per device/platform for the same user
		if (deviceId) {
			await this.update(
				{ userId, deviceId, platform, isActive: true },
				{ isActive: false }
			);
		}

		// Create new token for this user
		const firebaseToken = new FirebaseToken();
		firebaseToken.id = genId();
		firebaseToken.userId = userId;
		firebaseToken.token = token;
		firebaseToken.deviceId = deviceId || null;
		firebaseToken.platform = platform;
		firebaseToken.appVersion = appVersion || null;
		firebaseToken.isActive = true;
		firebaseToken.lastUsed = new Date();

		try {
			return await this.save(firebaseToken);
		} catch (error) {
			// Handle unique constraint violation (in case of race condition)
			if (error.code === '23505' || error.message.includes('duplicate key')) {
				// Try to find and update the existing token instead
				const existingToken = await this.findOne({
					where: { userId, token },
				});
				if (existingToken) {
					existingToken.deviceId = deviceId || existingToken.deviceId;
					existingToken.platform = platform;
					existingToken.appVersion = appVersion || existingToken.appVersion;
					existingToken.isActive = true;
					existingToken.lastUsed = new Date();
					existingToken.updatedAt = new Date();
					return await this.save(existingToken);
				}
			}
			throw error;
		}
	},

	/**
	 * Get active tokens for a user (ensures no duplicates)
	 */
	async getActiveTokensForUser(userId: string): Promise<FirebaseToken[]> {
		// Use DISTINCT to ensure no duplicate tokens even if somehow they exist in DB
		const tokens = await this.createQueryBuilder('token')
			.where('token.userId = :userId', { userId })
			.andWhere('token.isActive = true')
			.orderBy('token.lastUsed', 'DESC')
			.getMany();

		// Additional deduplication by token value as a safety measure
		const seenTokens = new Set<string>();
		const uniqueTokens: FirebaseToken[] = [];

		for (const token of tokens) {
			if (!seenTokens.has(token.token)) {
				seenTokens.add(token.token);
				uniqueTokens.push(token);
			}
		}

		return uniqueTokens;
	},

	/**
	 * Get all active tokens for a device (for multi-account notifications)
	 */
	async getActiveTokensForDevice(deviceId: string): Promise<FirebaseToken[]> {
		return await this.find({
			where: {
				deviceId,
				isActive: true,
			},
			order: {
				lastUsed: 'DESC',
			},
		});
	},

	/**
	 * Mark a token as inactive (when FCM returns invalid token error)
	 */
	async deactivateToken(token: string): Promise<void> {
		await this.update({ token }, { isActive: false });
	},

	/**
	 * Update last used timestamp for a token
	 */
	async updateLastUsed(token: string): Promise<void> {
		await this.update({ token }, { lastUsed: new Date() });
	},

	/**
	 * Clean up old inactive tokens (older than 30 days)
	 */
	async cleanupOldTokens(): Promise<void> {
		const thirtyDaysAgo = new Date();
		thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

		await this.createQueryBuilder()
			.delete()
			.where('isActive = false')
			.andWhere('updatedAt < :date', { date: thirtyDaysAgo })
			.execute();
	},

	/**
	 * Clean up duplicate tokens for the same user (keeps the most recently used)
	 */
	async cleanupDuplicateTokens(): Promise<void> {
		// Find users with multiple active tokens of the same value
		const duplicateTokens = await this.createQueryBuilder('token1')
			.select('token1.userId', 'userId')
			.addSelect('token1.token', 'token')
			.addSelect('COUNT(*)', 'count')
			.where('token1.isActive = true')
			.groupBy('token1.userId')
			.addGroupBy('token1.token')
			.having('COUNT(*) > 1')
			.getRawMany();

		for (const dup of duplicateTokens) {
			// Keep the most recently used token, deactivate others
			const tokensToDeactivate = await this.createQueryBuilder('token')
				.where('token.userId = :userId', { userId: dup.userId })
				.andWhere('token.token = :token', { token: dup.token })
				.andWhere('token.isActive = true')
				.orderBy('token.lastUsed', 'DESC')
				.skip(1) // Skip the first (most recent) one
				.getMany();

			if (tokensToDeactivate.length > 0) {
				await this.update(
					tokensToDeactivate.map(t => t.id),
					{ isActive: false }
				);
				console.log(`Deactivated ${tokensToDeactivate.length} duplicate tokens for user ${dup.userId}`);
			}
		}
	},

	/**
	 * Get token statistics for analytics
	 */
	async getTokenStats(): Promise<{
		total: number;
		active: number;
		byPlatform: Record<string, number>;
	}> {
		const total = await this.count();
		const active = await this.count({ where: { isActive: true } });
		
		const platformStats = await this.createQueryBuilder('token')
			.select('token.platform', 'platform')
			.addSelect('COUNT(*)', 'count')
			.where('token.isActive = true')
			.groupBy('token.platform')
			.getRawMany();

		const byPlatform: Record<string, number> = {};
		platformStats.forEach(stat => {
			byPlatform[stat.platform] = parseInt(stat.count);
		});

		return { total, active, byPlatform };
	},
});