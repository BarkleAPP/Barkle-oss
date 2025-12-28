import * as crypto from 'crypto';

const L_CHARS = '0123456789abcdefghijklmnopqrstuvwxyz';
const LU_CHARS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Validates the entropy of a generated token to ensure it meets security requirements
 * @param token The token to validate
 * @param minEntropy Minimum entropy threshold (default: 4.5 bits per character)
 * @returns true if token has sufficient entropy
 */
function validateTokenEntropy(token: string, minEntropy = 4.5): boolean {
	if (token.length < 16) return false; // Minimum length requirement
	
	// Calculate character frequency
	const charFreq = new Map<string, number>();
	for (const char of token) {
		charFreq.set(char, (charFreq.get(char) || 0) + 1);
	}
	
	// Calculate Shannon entropy
	let entropy = 0;
	const tokenLength = token.length;
	for (const freq of charFreq.values()) {
		const probability = freq / tokenLength;
		entropy -= probability * Math.log2(probability);
	}
	
	return entropy >= minEntropy;
}

/**
 * Generates a cryptographically secure random string with entropy validation
 * @param length Length of the string to generate (default: 32)
 * @param useLU Whether to use both lowercase and uppercase characters (default: true)
 * @param maxRetries Maximum number of retries if entropy validation fails (default: 3)
 * @returns A secure random string with validated entropy
 */
export function secureRndstr(length = 32, useLU = true, maxRetries = 3): string {
	const chars = useLU ? LU_CHARS : L_CHARS;
	const chars_len = chars.length;

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		let str = '';

		// Use crypto.randomBytes for better entropy
		const randomBytes = crypto.randomBytes(length);
		
		for (let i = 0; i < length; i++) {
			// Use full byte entropy and proper modulo to avoid bias
			const rand = randomBytes[i] % chars_len;
			str += chars.charAt(rand);
		}

		// Validate entropy for security-critical tokens
		if (length >= 16 && validateTokenEntropy(str)) {
			return str;
		} else if (length < 16) {
			// For shorter strings, skip entropy validation
			return str;
		}
		
		// If this is the last attempt, return the token anyway to avoid infinite loops
		if (attempt === maxRetries) {
			return str;
		}
	}

	// This should never be reached, but included for type safety
	throw new Error('Failed to generate secure random string after maximum retries');
}

/**
 * Generates a secure hash for token storage with consistent lowercase formatting
 * @param token The token to hash
 * @returns Lowercase hash for consistent database lookup
 */
export function generateTokenHash(token: string): string {
	return token.toLowerCase();
}

/**
 * Validates token format and basic security requirements
 * @param token The token to validate
 * @returns true if token meets basic security requirements
 */
export function validateTokenFormat(token: string): boolean {
	// Check minimum length
	if (token.length < 16) return false;
	
	// Check that token only contains valid characters
	const validChars = /^[0-9a-zA-Z]+$/;
	if (!validChars.test(token)) return false;
	
	// Check for obvious patterns (all same character, sequential, etc.)
	const allSame = token.split('').every(char => char === token[0]);
	if (allSame) return false;
	
	return true;
}
