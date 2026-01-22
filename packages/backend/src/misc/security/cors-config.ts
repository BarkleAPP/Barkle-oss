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
	// Allow same-origin requests AND requests with no origin (mobile apps)
	return (origin: string | undefined) => {
		// Allow requests with no origin (mobile apps, curl, etc.)
		if (!origin) return true;

		// Allow same-origin requests
		return origin === config.url;
	};
}

/**
 * Create CORS middleware with secure defaults that support mobile apps and embedding
 */
export function createCorsMiddleware(config: Config) {
	const origin = getOriginHandler(config);

	return cors({
		origin,

		// Allow credentials (cookies, authorization headers)
		// This is safe because we validate origins above
		allowCredentials: config.cors?.allowCredentials ?? true,

		// Allowed methods - include all common REST methods
		allowMethods: config.cors?.allowedMethods ?? ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],

		// Allowed headers - include common headers
		allowHeaders: config.cors?.allowedHeaders ?? [
			'Content-Type',
			'Authorization',
			'X-Requested-With',
			'Accept',
			'Origin',
			'Access-Control-Request-Method',
			'Access-Control-Request-Headers',
		],

		// Expose headers that browsers can access
		// This allows frontend apps to read these headers
		exposeHeaders: config.cors?.exposeHeaders ?? [
			'Content-Length',
			'Content-Type',
			'Content-Range',
		],

		// Max age for preflight requests (24 hours)
		// This reduces the number of preflight requests
		maxAge: config.cors?.maxAge ?? 86400,

		// Allow successful preflight requests with 204 status
		// This is important for proper CORS handling
		optionsSuccessStatus: 204,
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

