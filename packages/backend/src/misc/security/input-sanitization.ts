/**
 * Input sanitization utilities
 * Provides functions to sanitize and validate user input
 */

/**
 * Sanitize string input to prevent XSS attacks
 * - Removes HTML tags
 * - Escapes special characters
 * - Normalizes whitespace
 */
export function sanitizeString(input: string, options: {
	allowHtml?: boolean;
	maxLength?: number;
	trim?: boolean;
} = {}): string {
	let sanitized = input;

	// Trim whitespace if requested
	if (options.trim !== false) {
		sanitized = sanitized.trim();
	}

	// Remove HTML tags unless explicitly allowed
	if (options.allowHtml !== true) {
		sanitized = sanitized.replace(/<[^>]*>/g, '');
	}

	// Escape HTML entities
	sanitized = sanitized
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#x27;')
		.replace(/\//g, '&#x2F;');

	// Enforce maximum length
	if (options.maxLength && sanitized.length > options.maxLength) {
		sanitized = sanitized.substring(0, options.maxLength);
	}

	return sanitized;
}

/**
 * Sanitize username according to Barkle's rules
 * - Only alphanumeric, underscores, and hyphens
 * - Must start with a letter
 * - Case insensitive
 * - Limited length
 */
export function sanitizeUsername(username: string): string {
	// Remove any characters that aren't alphanumeric, underscore, or hyphen
	let sanitized = username.replace(/[^a-zA-Z0-9_-]/g, '');

	// Ensure it starts with a letter
	if (sanitized.length > 0 && !/^[a-zA-Z]/.test(sanitized)) {
		sanitized = 'a' + sanitized;
	}

	// Limit length (typical max username length)
	if (sanitized.length > 30) {
		sanitized = sanitized.substring(0, 30);
	}

	return sanitized.toLowerCase();
}

/**
 * Sanitize email address
 * - Lowercase
 * - Trim whitespace
 * - Basic format validation
 */
export function sanitizeEmail(email: string): string {
	let sanitized = email.toLowerCase().trim();

	// Basic email validation
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	if (!emailRegex.test(sanitized)) {
		throw new Error('Invalid email format');
	}

	return sanitized;
}

/**
 * Sanitize URL to prevent XSS and SSRF
 * - Validates URL format
 * - Only allows http/https protocols
 * - Removes credentials and fragments
 */
export function sanitizeUrl(url: string): string {
	try {
		const parsed = new URL(url);

		// Only allow http and https
		if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
			throw new Error('Invalid URL protocol');
		}

		// Remove username/password if present
		parsed.username = '';
		parsed.password = '';

		// Remove fragment
		parsed.hash = '';

		return parsed.toString();
	} catch (e) {
		throw new Error('Invalid URL format');
	}
}

/**
 * Sanitize ID string (e.g., user IDs, note IDs)
 * - Validates format
 * - Removes any non-alphanumeric characters (except hyphens)
 */
export function sanitizeId(id: string): string {
	// Remove any characters that aren't alphanumeric or hyphen
	return id.replace(/[^a-zA-Z0-9-]/g, '');
}

/**
 * Sanitize array input to prevent injection
 * - Removes empty values
 * - Validates each element
 */
export function sanitizeArray<T>(arr: T[], validator?: (item: T) => boolean): T[] {
	// Remove null/undefined values
	const sanitized = arr.filter(item => item != null) as T[];

	// Apply custom validator if provided
	if (validator) {
		return sanitized.filter(validator);
	}

	return sanitized;
}

/**
 * Sanitize number input
 * - Ensures value is within range
 * - Removes NaN/Infinity
 */
export function sanitizeNumber(num: number, options: {
	min?: number;
	max?: number;
	integer?: boolean;
} = {}): number {
	// Check for invalid values
	if (!Number.isFinite(num)) {
		throw new Error('Invalid number');
	}

	let sanitized = num;

	// Enforce integer constraint
	if (options.integer) {
		sanitized = Math.trunc(sanitized);
	}

	// Enforce min/max constraints
	if (options.min !== undefined && sanitized < options.min) {
		sanitized = options.min;
	}

	if (options.max !== undefined && sanitized > options.max) {
		sanitized = options.max;
	}

	return sanitized;
}

/**
 * Deep sanitize object to remove prototype pollution attempts
 * - Removes __proto__ properties
 * - Removes constructor properties
 * - Removes prototype properties
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): Partial<T> {
	const sanitized: Partial<T> = {};

	for (const key of Object.keys(obj)) {
		// Skip dangerous properties
		if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
			continue;
		}

		const value = obj[key];

		// Recursively sanitize nested objects
		if (value && typeof value === 'object' && !Array.isArray(value)) {
			sanitized[key as keyof T] = sanitizeObject(value) as T[keyof T];
		} else if (Array.isArray(value)) {
			sanitized[key as keyof T] = value.map(item =>
				typeof item === 'object' && item !== null ? sanitizeObject(item) : item
			) as T[keyof T];
		} else {
			sanitized[key as keyof T] = value;
		}
	}

	return sanitized;
}

/**
 * Validate and sanitize user mention
 * - Format: @username@host
 */
export function sanitizeMention(mention: string): string {
	const trimmed = mention.trim();

	// Check if it matches the mention format
	const mentionRegex = /^@?[a-zA-Z0-9_-]+(?:@[\w.-]+)?$/;

	if (!mentionRegex.test(trimmed)) {
		throw new Error('Invalid mention format');
	}

	// Ensure it starts with @
	return trimmed.startsWith('@') ? trimmed : '@' + trimmed;
}

/**
 * Sanitize hashtag
 * - Remove # prefix if present
 * - Validate format
 * - Limit length
 */
export function sanitizeHashtag(tag: string): string {
	// Remove # prefix if present
	let sanitized = tag.startsWith('#') ? tag.slice(1) : tag;

	// Only allow alphanumeric, underscores, and hyphens
	sanitized = sanitized.replace(/[^a-zA-Z0-9_-]/g, '');

	// Limit length
	if (sanitized.length > 100) {
		sanitized = sanitized.substring(0, 100);
	}

	return sanitized.toLowerCase();
}

/**
 * Sanitize bio/description text
 * - Allows some HTML (MFM)
 * - Sanitizes potentially dangerous content
 */
export function sanitizeBio(text: string): string {
	// Note: This is a basic sanitization
	// The actual MFM parser should handle detailed HTML sanitization
	let sanitized = text.trim();

	// Remove script tags and their content
	sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

	// Remove iframe tags
	sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');

	// Remove object tags
	sanitized = sanitized.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '');

	// Remove embed tags
	sanitized = sanitized.replace(/<embed\b[^>]*>/gi, '');

	// Limit length
	const maxLength = 5000;
	if (sanitized.length > maxLength) {
		sanitized = sanitized.substring(0, maxLength);
	}

	return sanitized;
}
