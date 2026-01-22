/**
 * Security utilities for preventing mass assignment attacks
 */

/**
 * Fields that should never be modifiable via API endpoints
 */
export const PROTECTED_FIELDS = [
	'id',
	'isAdmin',
	'isModerator',
	'isBot',
	'isDeleted',
	'isLocked',
	'createdAt',
	'updatedAt',
	'host',
	'uri',
	'token',
	'secret',
	'password',
	'lastUsedAt',
	'userId',
	'noteId',
	'fileId',
	'appId',
	'followerId',
	'followeeId',
	'blockerId',
	'blockeeId',
] as const;

/**
 * Fields that should only be modifiable by administrators
 */
export const ADMIN_ONLY_FIELDS = [
	'driveCapacity',
	'isSilenced',
	'isSuspended',
	'moderationNote',
] as const;

/**
 * Filter out protected fields from user input to prevent mass assignment attacks
 *
 * @param input - User input object
 * @param isAdmin - Whether the user is an administrator
 * @returns Filtered object with only allowed fields
 */
export function filterProtectedFields<T extends Record<string, any>>(
	input: T,
	isAdmin: boolean = false
): Partial<T> {
	const filtered: Partial<T> = {};

	for (const key of Object.keys(input)) {
		// Skip protected fields entirely
		if (PROTECTED_FIELDS.includes(key as any)) {
			continue;
		}

		// Skip admin-only fields if user is not admin
		if (!isAdmin && ADMIN_ONLY_FIELDS.includes(key as any)) {
			continue;
		}

		filtered[key as keyof T] = input[key];
	}

	return filtered;
}

/**
 * Filter object to only include specified keys
 *
 * @param input - User input object
 * @param allowedKeys - Array of allowed field names
 * @returns Filtered object with only allowed fields
 */
export function allowOnlyFields<T extends Record<string, any>>(
	input: T,
	allowedKeys: readonly (keyof T | string)[]
): Partial<T> {
	const filtered: Partial<T> = {};

	for (const key of allowedKeys) {
		if (key in input) {
			filtered[key as keyof T] = input[key];
		}
	}

	return filtered;
}

/**
 * Check if input contains any protected fields
 *
 * @param input - User input object
 * @returns Array of detected protected field names (empty if none found)
 */
export function detectProtectedFields<T extends Record<string, any>>(input: T): string[] {
	const detected: string[] = [];

	for (const key of Object.keys(input)) {
		if (PROTECTED_FIELDS.includes(key as any)) {
			detected.push(key);
		}
	}

	return detected;
}
