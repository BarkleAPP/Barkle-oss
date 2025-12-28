import { describe, test, expect, beforeEach } from 'vitest';
import {
	generateSecureToken,
	generateAccessToken,
	generateRefreshToken,
	generateAuthorizationCode,
	isTokenExpired,
	validateRefreshTokenSecurity,
	secureTokenCompare
} from '../../src/misc/token-security.js';
import { secureRndstr, generateTokenHash, validateTokenFormat } from '../../src/misc/secure-rndstr.js';

describe('Token Security', () => {
	describe('secureRndstr', () => {
		test('should generate tokens with correct length', () => {
			const token16 = secureRndstr(16);
			const token32 = secureRndstr(32);
			const token64 = secureRndstr(64);

			expect(token16).toHaveLength(16);
			expect(token32).toHaveLength(32);
			expect(token64).toHaveLength(64);
		});

		test('should generate tokens with valid characters', () => {
			const token = secureRndstr(32, true);
			const validChars = /^[0-9a-zA-Z]+$/;
			expect(validChars.test(token)).toBe(true);
		});

		test('should generate different tokens on each call', () => {
			const token1 = secureRndstr(32);
			const token2 = secureRndstr(32);
			expect(token1).not.toBe(token2);
		});

		test('should generate tokens with sufficient entropy for security-critical lengths', () => {
			// Test multiple generations to ensure entropy validation works
			for (let i = 0; i < 5; i++) {
				const token = secureRndstr(32, true);
				expect(validateTokenFormat(token)).toBe(true);
			}
		});
	});

	describe('generateTokenHash', () => {
		test('should generate consistent lowercase hashes', () => {
			const token = 'TestToken123';
			const hash1 = generateTokenHash(token);
			const hash2 = generateTokenHash(token);

			expect(hash1).toBe(hash2);
			expect(hash1).toBe('testtoken123');
		});

		test('should handle already lowercase tokens', () => {
			const token = 'testtoken123';
			const hash = generateTokenHash(token);
			expect(hash).toBe(token);
		});
	});

	describe('validateTokenFormat', () => {
		test('should validate correct token formats', () => {
			const validToken = secureRndstr(32, true);
			expect(validateTokenFormat(validToken)).toBe(true);
		});

		test('should reject tokens that are too short', () => {
			const shortToken = secureRndstr(8);
			expect(validateTokenFormat(shortToken)).toBe(false);
		});

		test('should reject tokens with invalid characters', () => {
			const invalidToken = 'token-with-invalid-chars!@#';
			expect(validateTokenFormat(invalidToken)).toBe(false);
		});

		test('should reject tokens with all same characters', () => {
			const sameCharToken = 'aaaaaaaaaaaaaaaa';
			expect(validateTokenFormat(sameCharToken)).toBe(false);
		});
	});

	describe('generateSecureToken', () => {
		test('should generate access tokens with correct properties', () => {
			const tokenData = generateAccessToken();

			expect(tokenData.token).toBeDefined();
			expect(tokenData.hash).toBeDefined();
			expect(tokenData.expiresAt).toBeDefined();
			expect(tokenData.createdAt).toBeDefined();
			expect(tokenData.token).toHaveLength(32);
			expect(tokenData.hash).toBe(tokenData.token.toLowerCase());
		});

		test('should generate refresh tokens without expiration', () => {
			const tokenData = generateRefreshToken();

			expect(tokenData.token).toBeDefined();
			expect(tokenData.hash).toBeDefined();
			expect(tokenData.expiresAt).toBeNull();
			expect(tokenData.createdAt).toBeDefined();
		});

		test('should generate authorization codes with 10-minute expiration', () => {
			const tokenData = generateAuthorizationCode();
			const expectedExpiration = new Date(tokenData.createdAt.getTime() + 10 * 60 * 1000);

			expect(tokenData.token).toBeDefined();
			expect(tokenData.expiresAt).toBeDefined();
			expect(Math.abs(tokenData.expiresAt!.getTime() - expectedExpiration.getTime())).toBeLessThan(1000);
		});

		test('should generate different tokens for access and refresh', () => {
			const accessToken = generateAccessToken();
			const refreshToken = generateRefreshToken();

			expect(accessToken.token).not.toBe(refreshToken.token);
			expect(accessToken.hash).not.toBe(refreshToken.hash);
		});
	});

	describe('isTokenExpired', () => {
		test('should return false for non-expiring tokens', () => {
			expect(isTokenExpired(null)).toBe(false);
		});

		test('should return false for future expiration dates', () => {
			const futureDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
			expect(isTokenExpired(futureDate)).toBe(false);
		});

		test('should return true for past expiration dates', () => {
			const pastDate = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
			expect(isTokenExpired(pastDate)).toBe(true);
		});

		test('should use custom current time for testing', () => {
			const expirationDate = new Date('2023-01-01T12:00:00Z');
			const testCurrentTime = new Date('2023-01-01T11:00:00Z');
			const testCurrentTimeFuture = new Date('2023-01-01T13:00:00Z');

			expect(isTokenExpired(expirationDate, testCurrentTime)).toBe(false);
			expect(isTokenExpired(expirationDate, testCurrentTimeFuture)).toBe(true);
		});
	});

	describe('validateRefreshTokenSecurity', () => {
		test('should validate correct refresh tokens', () => {
			const refreshToken = secureRndstr(32, true);
			expect(validateRefreshTokenSecurity(refreshToken)).toBe(true);
		});

		test('should reject refresh tokens that are too short', () => {
			const shortToken = secureRndstr(16);
			expect(validateRefreshTokenSecurity(shortToken)).toBe(false);
		});

		test('should reject refresh tokens identical to access tokens', () => {
			const token = secureRndstr(32, true);
			expect(validateRefreshTokenSecurity(token, token)).toBe(false);
		});

		test('should accept refresh tokens different from access tokens', () => {
			const refreshToken = secureRndstr(32, true);
			const accessToken = secureRndstr(32, true);
			expect(validateRefreshTokenSecurity(refreshToken, accessToken)).toBe(true);
		});
	});

	describe('secureTokenCompare', () => {
		test('should return true for identical tokens', () => {
			const token = secureRndstr(32, true);
			expect(secureTokenCompare(token, token)).toBe(true);
		});

		test('should return false for different tokens', () => {
			const token1 = secureRndstr(32, true);
			const token2 = secureRndstr(32, true);
			expect(secureTokenCompare(token1, token2)).toBe(false);
		});

		test('should return false for tokens of different lengths', () => {
			const shortToken = secureRndstr(16);
			const longToken = secureRndstr(32);
			expect(secureTokenCompare(shortToken, longToken)).toBe(false);
		});

		test('should handle empty strings', () => {
			expect(secureTokenCompare('', '')).toBe(true);
			expect(secureTokenCompare('token', '')).toBe(false);
		});

		test('should be resistant to timing attacks', () => {
			// This test ensures the function uses constant-time comparison
			const token1 = 'a'.repeat(32);
			const token2 = 'b'.repeat(32);
			const token3 = 'a'.repeat(31) + 'b';

			// All comparisons should take similar time (constant-time)
			const start1 = process.hrtime.bigint();
			secureTokenCompare(token1, token2);
			const end1 = process.hrtime.bigint();

			const start2 = process.hrtime.bigint();
			secureTokenCompare(token1, token3);
			const end2 = process.hrtime.bigint();

			// The timing difference should be minimal (within reasonable bounds)
			const diff1 = Number(end1 - start1);
			const diff2 = Number(end2 - start2);
			const timingDifference = Math.abs(diff1 - diff2);

			// Allow for some variance but ensure it's not dramatically different
			expect(timingDifference).toBeLessThan(diff1 * 0.5); // Less than 50% difference
		});
	});

	describe('Token Security Integration', () => {
		test('should generate secure token pairs for OAuth flow', () => {
			const accessToken = generateAccessToken();
			const refreshToken = generateRefreshToken();
			const authCode = generateAuthorizationCode();

			// All tokens should be different
			expect(accessToken.token).not.toBe(refreshToken.token);
			expect(accessToken.token).not.toBe(authCode.token);
			expect(refreshToken.token).not.toBe(authCode.token);

			// All should pass security validation
			expect(validateTokenFormat(accessToken.token)).toBe(true);
			expect(validateTokenFormat(refreshToken.token)).toBe(true);
			expect(validateTokenFormat(authCode.token)).toBe(true);

			// Refresh token should pass security validation against access token
			expect(validateRefreshTokenSecurity(refreshToken.token, accessToken.token)).toBe(true);
		});

		test('should handle token expiration correctly', () => {
			const accessToken = generateAccessToken(60); // 1 minute expiration
			const authCode = generateAuthorizationCode(); // 10 minute expiration

			// Tokens should not be expired immediately
			expect(isTokenExpired(accessToken.expiresAt)).toBe(false);
			expect(isTokenExpired(authCode.expiresAt)).toBe(false);

			// Test with future time
			const futureTime = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes from now
			expect(isTokenExpired(accessToken.expiresAt, futureTime)).toBe(true);
			expect(isTokenExpired(authCode.expiresAt, futureTime)).toBe(false);
		});
	});
});