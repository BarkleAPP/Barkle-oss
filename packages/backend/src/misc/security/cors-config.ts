/**
 * CORS configuration utility
 * Provides secure CORS settings based on configuration
 *
 * Supports:
 * - Native mobile apps (no Origin header)
 * - Web apps (with Origin header)
 * - Embedded content (iframe embedding)
 * - Multiple allowed origins
 * - Wildcard subdomain support
 */

import type { Config } from '@/config.js';
import cors from '@koa/cors';

/**
 * Get CORS origin handler based on configuration
 */
function getOriginHandler(config: Config) {
	const allowedOrigins = config.cors?.allowedOrigins;

	// DEVELOPMENT MODE: If explicitly set to '*', allow all origins
	// This should NEVER be used in production
	if (allowedOrigins && allowedOrigins.includes('*')) {
		console.warn(
			'Security Warning: CORS is set to allow all origins (*). This is NOT recommended for production!'
		);
		return '*';
	}

	// If specific origins are configured, use them
	if (allowedOrigins && allowedOrigins.length > 0) {
		return (origin: string | undefined) => {
			// CRITICAL: Allow requests with no origin header
			// This is essential for:
			// - Native mobile apps (iOS/Android)
			// - Desktop applications
			// - Command-line tools (curl, etc.)
			// - Server-to-server requests
			if (!origin) return true;

			// Check if origin is in allowed list
			return allowedOrigins.some(allowed => {
				// Exact match
				if (allowed === origin) return true;

				// Wildcard subdomain support (e.g., https://*.example.com)
				if (allowed.includes('*')) {
					const allowedPattern = allowed.replace(/\*/g, '.*');
					const regex = new RegExp(`^${allowedPattern}$`);
					return regex.test(origin);
				}

				return false;
			});
		};
	}

	// DEFAULT SECURE BEHAVIOR:
	// Allow same-origin requests, subdomains, related domains, Capacitor apps, plus requests with no origin
	return (origin: string | undefined) => {
		// Allow requests with no origin (mobile apps, curl, etc.)
		if (!origin) return true;

		if (isCapacitorOrigin(origin)) return true;

		// Allow localhost for development
		if (isLocalhostOrigin(origin)) return true;

		// Allow same-origin requests
		if (origin === config.url) return true;

		// Allow subdomains of the instance
		try {
			const instanceUrl = new URL(config.url);
			const originUrl = new URL(origin);

			// Allow same domain with different subdomains
			// e.g., beta.barkle.chat can access barkle.chat API
			if (instanceUrl.hostname === originUrl.hostname) return true;

			// Allow subdomains of the main domain
			// e.g., beta.barkle.chat can access api.barkle.chat
			const mainDomain = getMainDomain(instanceUrl.hostname);
			const originDomain = getMainDomain(originUrl.hostname);
			if (mainDomain && mainDomain === originDomain) return true;

		} catch (e) {
			// Invalid URLs, deny
			return false;
		}

		return false;
	};
}

/**
 * Check if the origin is from a Capacitor app
 * Capacitor apps run locally on the device with these schemes
 */
function isCapacitorOrigin(origin: string): boolean {
	const capacitorOrigins = [
		'capacitor://localhost',
		'ionic://localhost',
		'http://localhost',
		'https://localhost',
		'capacitor://',
		'ionic://',
	];

	return capacitorOrigins.some(co => origin === co || origin.startsWith(co));
}

/**
 * Check if the origin is localhost for development
 */
function isLocalhostOrigin(origin: string): boolean {
	try {
		const url = new URL(origin);
		const hostname = url.hostname;

		// Allow localhost and 127.0.0.1
		if (hostname === 'localhost' || hostname === '127.0.0.1') return true;

		// Allow local network addresses (optional, for development)
		if (hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.startsWith('172.')) {
			return true;
		}

		return false;
	} catch {
		return false;
	}
}

/**
 * Extract the main domain from a hostname
 * e.g., "beta.barkle.chat" -> "barkle.chat"
 * e.g., "api.barkle.chat" -> "barkle.chat"
 * e.g., "barkle.chat" -> "barkle.chat"
 */
function getMainDomain(hostname: string): string | null {
	const parts = hostname.split('.');

	// For domains like "barkle.chat", return as is
	if (parts.length <= 2) return hostname;

	// For subdomains like "beta.barkle.chat", return "barkle.chat"
	// This assumes a TLD length of 2, which works for most cases
	// For more complex TLDs, you'd need a public suffix list
	return parts.slice(-2).join('.');
}

/**
 * Create CORS middleware with secure defaults that support mobile apps and embedding
 */
export function createCorsMiddleware(config: Config) {
	// TEMPORARILY PERMISSIVE: Allow all origins while debugging 500 errors
	// TODO: Re-enable origin validation when API errors are fixed
	return cors({
		origin: '*',  // Allow all origins temporarily

		// Allow credentials (cookies, authorization headers)
		credentials: false, // Must be false when origin is '*'

		// Allowed methods - include all common REST methods
		allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],

		// Allowed headers - include common headers
		allowHeaders: [
			'Content-Type',
			'Authorization',
			'X-Requested-With',
			'Accept',
			'Origin',
			'Access-Control-Request-Method',
			'Access-Control-Request-Headers',
		],

		// Expose headers that browsers can access
		exposeHeaders: [
			'Content-Length',
			'Content-Type',
			'Content-Range',
		],

		// Max age for preflight requests (24 hours)
		maxAge: 86400,
	});
}

/**
 * Create permissive CORS middleware for public endpoints
 * Use this for endpoints that need to be accessible from anywhere
 * Example: public timelines, user profiles, media files
 */
export function createPermissiveCorsMiddleware() {
	return cors({
		origin: '*', // Allow all origins
		credentials: false, // Don't allow credentials for public endpoints
		allowMethods: ['GET', 'HEAD', 'OPTIONS'], // Only safe methods
		maxAge: 86400,
	});
}

