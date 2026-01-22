import { IpBans } from '@/models/index.js';

/**
 * Check if an IP address is banned
 * @param ip - IP address to check
 * @returns Promise<boolean> - true if banned
 */
export async function isIpBanned(ip: string): Promise<boolean> {
	return await IpBans.isBanned(ip);
}

/**
 * Create an IP ban
 * @param ip - IP address to ban
 * @param userId - User ID that caused the ban (optional)
 * @param reason - Reason for the ban (optional)
 * @param expiresAt - When the ban expires (optional, null for permanent)
 */
export async function createIpBan(
	ip: string,
	userId: string | null = null,
	reason: string | null = null,
	expiresAt: Date | null = null
): Promise<void> {
	await IpBans.createBan(ip, userId, reason, expiresAt);
}

/**
 * Remove an IP ban
 * @param ip - IP address to unban
 */
export async function removeIpBan(ip: string): Promise<void> {
	await IpBans.removeBan(ip);
}

/**
 * Remove all IP bans for a specific user
 * @param userId - User ID whose IPs should be unbanned
 */
export async function removeUserIpBans(userId: string): Promise<void> {
	await IpBans.removeBansByUserId(userId);
}
