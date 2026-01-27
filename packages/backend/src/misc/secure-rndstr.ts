import * as crypto from 'crypto';

const L_CHARS = '0123456789abcdefghijklmnopqrstuvwxyz';
const LU_CHARS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function secureRndstr(length = 32, useLU = true): string {
	const chars = useLU ? LU_CHARS : L_CHARS;
	const chars_len = chars.length;

	let str = '';
	const randomBytes = crypto.randomBytes(length);

	for (let i = 0; i < length; i++) {
		str += chars.charAt(randomBytes[i] % chars_len);
	}

	return str;
}

/**
 * Generates a consistent SHA-256 hash of a token for storage
 * @param token The token to hash
 * @returns The hex-encoded SHA-256 hash
 */
export function generateTokenHash(token: string): string {
	return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * Validates that a token has the correct format
 * @param token The token to validate
 * @returns true if the token format is valid
 */
export function validateTokenFormat(token: string): boolean {
	// Tokens should be at least 8 characters and contain only alphanumeric characters
	if (token.length < 8) return false;
	return /^[0-9a-zA-Z]+$/.test(token);
}

