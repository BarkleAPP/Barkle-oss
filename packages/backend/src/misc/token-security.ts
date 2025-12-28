import * as crypto from 'crypto';
import { secureRndstr, generateTokenHash, validateTokenFormat } from './secure-rndstr.js';
import Logger from '@/services/logger.js';

const tokenLogger = new Logger('token-security', 'yellow');

export interface TokenGenerationOptions {
	length?: number;
	useLU?: boolean;
	type?: 'access_token' | 'refresh_token' | 'authorization_code';
	expiresIn?: number; // seconds
}

export interface GeneratedToken {
	token: string;
	hash: string;
	expiresAt: Date | null;
	createdAt: Date;
}

/**
 * Generates a secure token with proper entropy validation and consistent hashing
 * @param options Token generation options
 * @returns Generated token with hash and expiration
 */
export function generateSecureToken(options: TokenGenerationOptions = {}): GeneratedToken {
	const {
		length = 32,
		useLU = true,
		type = 'access_token',
		expiresIn
	} = options;

	tokenLogger.debug('Generating secure token:', {
		type,
		length,
		useLU,
		expiresIn,
		timestamp: new Date().toISOString()
	});

	// Generate the token with entropy validation
	const token = secureRndstr(length, useLU);
	
	// Validate the generated token
	if (!validateTokenFormat(token)) {
		tokenLogger.error('Generated token failed format validation:', {
			type,
			tokenLength: token.length,
			timestamp: new Date().toISOString()
		});
		throw new Error(`Generated ${type} failed security validation`);
	}

	// Generate consistent hash
	const hash = generateTokenHash(token);
	
	// Calculate expiration
	const createdAt = new Date();
	let expiresAt: Date | null = null;
	
	if (expiresIn) {
		expiresAt = new Date(createdAt.getTime() + expiresIn * 1000);
	}

	tokenLogger.debug('Token generated successfully:', {
		type,
		tokenPrefix: token.substring(0, 8) + '...',
		hashPrefix: hash.substring(0, 8) + '...',
		expiresAt,
		timestamp: new Date().toISOString()
	});

	return {
		token,
		hash,
		expiresAt,
		createdAt
	};
}

/**
 * Validates if a token has expired
 * @param expiresAt Token expiration date
 * @param currentTime Current time (defaults to now)
 * @returns true if token is expired
 */
export function isTokenExpired(expiresAt: Date | null, currentTime: Date = new Date()): boolean {
	if (!expiresAt) return false; // No expiration set
	return currentTime > expiresAt;
}

/**
 * Validates refresh token security requirements
 * @param refreshToken The refresh token to validate
 * @param associatedAccessToken The access token it's associated with
 * @returns true if refresh token is valid and secure
 */
export function validateRefreshTokenSecurity(refreshToken: string, associatedAccessToken?: string): boolean {
	// Basic format validation
	if (!validateTokenFormat(refreshToken)) {
		tokenLogger.warn('Refresh token failed format validation');
		return false;
	}

	// Ensure refresh token is different from access token
	if (associatedAccessToken && refreshToken === associatedAccessToken) {
		tokenLogger.warn('Refresh token is identical to access token');
		return false;
	}

	// Additional entropy validation for refresh tokens (they're long-lived)
	if (refreshToken.length < 32) {
		tokenLogger.warn('Refresh token is too short for security requirements');
		return false;
	}

	return true;
}

/**
 * Securely compares two tokens to prevent timing attacks
 * @param tokenA First token
 * @param tokenB Second token
 * @returns true if tokens match
 */
export function secureTokenCompare(tokenA: string, tokenB: string): boolean {
	if (tokenA.length !== tokenB.length) {
		return false;
	}

	// Use crypto.timingSafeEqual for constant-time comparison
	try {
		const bufferA = Buffer.from(tokenA, 'utf8');
		const bufferB = Buffer.from(tokenB, 'utf8');
		return crypto.timingSafeEqual(bufferA, bufferB);
	} catch (error) {
		tokenLogger.error('Error in secure token comparison:', error);
		return false;
	}
}

/**
 * Generates a secure authorization code with short expiration
 * @returns Generated authorization code with 10-minute expiration
 */
export function generateAuthorizationCode(): GeneratedToken {
	return generateSecureToken({
		length: 32,
		useLU: true,
		type: 'authorization_code',
		expiresIn: 10 * 60 // 10 minutes as per RFC 6749
	});
}

/**
 * Generates a secure access token with configurable expiration
 * @param expiresIn Expiration time in seconds (default: 30 days)
 * @returns Generated access token
 */
export function generateAccessToken(expiresIn: number = 60 * 60 * 24 * 30): GeneratedToken {
	return generateSecureToken({
		length: 32,
		useLU: true,
		type: 'access_token',
		expiresIn
	});
}

/**
 * Generates a secure refresh token (long-lived, no expiration by default)
 * @returns Generated refresh token
 */
export function generateRefreshToken(): GeneratedToken {
	return generateSecureToken({
		length: 32,
		useLU: true,
		type: 'refresh_token'
		// No expiration for refresh tokens by default
	});
}