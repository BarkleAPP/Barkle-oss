import isNativeToken from './common/is-native-token.js';
import { CacheableLocalUser, ILocalUser } from '@/models/entities/user.js';
import { Users, AccessTokens, Apps } from '@/models/index.js';
import { AccessToken } from '@/models/entities/access-token.js';
import { Cache } from '@/misc/cache.js';
import { App } from '@/models/entities/app.js';
import { localUserByIdCache, localUserByNativeTokenCache } from '@/services/user-cache.js';
import { isTokenExpired } from '@/misc/token-security.js';
import { validateTokenFormat, generateTokenHash } from '@/misc/secure-rndstr.js';
import Logger from '@/services/logger.js';

const appCache = new Cache<App>(Infinity);
const authLogger = new Logger('auth', 'green');

export class AuthenticationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'AuthenticationError';
	}
}

export default async (authorization: string | null | undefined, bodyToken: string | null): Promise<[CacheableLocalUser | null | undefined, AccessToken | null | undefined]> => {
	let token: string | null = null;

	authLogger.debug('Authentication attempt:', {
		hasAuthorization: !!authorization,
		hasBodyToken: !!bodyToken,
		authorizationScheme: authorization ? authorization.split(' ')[0] : null,
		timestamp: new Date().toISOString()
	});

	// check if there is an authorization header set
	if (authorization != null) {
		if (bodyToken != null) {
			authLogger.warn('Multiple authorization schemes provided');
			throw new AuthenticationError('using multiple authorization schemes');
		}

		// check if OAuth 2.0 Bearer tokens are being used
		// Authorization schemes are case insensitive
		if (authorization.substring(0, 7).toLowerCase() === 'bearer ') {
			token = authorization.substring(7);
		} else {
			authLogger.warn('Unsupported authentication scheme:', {
				scheme: authorization.split(' ')[0],
				timestamp: new Date().toISOString()
			});
			throw new AuthenticationError('unsupported authentication scheme');
		}
	} else if (bodyToken != null) {
		token = bodyToken;
	} else {
		return [null, null];
	}

	if (isNativeToken(token)) {
		const user = await localUserByNativeTokenCache.fetch(token,
			() => Users.findOneBy({ token }) as Promise<ILocalUser | null>);

		if (user == null) {
			authLogger.warn('Native token not found:', {
				tokenPrefix: token.substring(0, 8) + '...',
				timestamp: new Date().toISOString()
			});
			throw new AuthenticationError('unknown token');
		}

		authLogger.debug('Native token authentication successful:', {
			userId: user.id,
			username: user.username,
			timestamp: new Date().toISOString()
		});

		return [user, null];
	} else {
		// Basic token format validation (more lenient for backward compatibility)
		if (token.length < 8 || !/^[0-9a-zA-Z]+$/.test(token)) {
			authLogger.warn('Invalid token format:', {
				tokenPrefix: token.substring(0, 8) + '...',
				tokenLength: token.length,
				timestamp: new Date().toISOString()
			});
			throw new AuthenticationError('invalid token format');
		}

		authLogger.debug('Looking up access token:', {
			tokenPrefix: token.substring(0, 10) + '...',
			tokenLowercase: token.toLowerCase().substring(0, 10) + '...',
			timestamp: new Date().toISOString()
		});

		// Enhanced token lookup with consistent hash generation
		const tokenHash = generateTokenHash(token);
		const accessToken = await AccessTokens.findOne({
			where: [{
				hash: tokenHash, // OAuth2 tokens with consistent hash
			}, {
				token: token, // Legacy MiAuth tokens
			}, {
				hash: token.toLowerCase(), // Fallback for existing tokens
			}],
		});

		if (accessToken == null) {
			authLogger.warn('Access token not found:', {
				tokenPrefix: token.substring(0, 8) + '...',
				hashPrefix: tokenHash.substring(0, 8) + '...',
				timestamp: new Date().toISOString()
			});
			throw new AuthenticationError('unknown token');
		}

		// Enhanced token expiration validation
		if (isTokenExpired(accessToken.expiresAt)) {
			authLogger.warn('Access token expired:', {
				tokenId: accessToken.id,
				expiresAt: accessToken.expiresAt,
				currentTime: new Date(),
				timestamp: new Date().toISOString()
			});
			
			// Clean up expired token for security
			AccessTokens.delete(accessToken.id).catch(error => {
				authLogger.error('Failed to clean up expired token:', error);
			});
			
			throw new AuthenticationError('token expired');
		}

		// Enhanced refresh token validation - don't allow refresh tokens for API authentication
		if (accessToken.isRefreshToken) {
			authLogger.warn('Refresh token used for authentication:', {
				tokenId: accessToken.id,
				timestamp: new Date().toISOString()
			});
			throw new AuthenticationError('refresh token cannot be used for authentication');
		}

		// Additional security check: ensure token hasn't been tampered with
		if (accessToken.hash && accessToken.hash !== tokenHash && accessToken.token !== token) {
			authLogger.warn('Token hash mismatch detected:', {
				tokenId: accessToken.id,
				expectedHash: tokenHash,
				storedHash: accessToken.hash,
				timestamp: new Date().toISOString()
			});
			throw new AuthenticationError('token validation failed');
		}

		AccessTokens.update(accessToken.id, {
			lastUsedAt: new Date(),
		});

		const user = await localUserByIdCache.fetch(accessToken.userId,
			() => Users.findOneBy({
				id: accessToken.userId,
			}) as Promise<ILocalUser>);

		if (accessToken.appId) {
			const app = await appCache.fetch(accessToken.appId,
				() => Apps.findOneByOrFail({ id: accessToken.appId! }));

			// For OAuth2 apps, use the token's scope instead of app permissions
			const effectivePermissions = app.oauth2 && accessToken.scope?.length > 0 
				? accessToken.scope 
				: app.permission;

			authLogger.debug('Access token authentication successful:', {
				userId: user.id,
				username: user.username,
				appId: accessToken.appId,
				appName: app.name,
				isOAuth2: app.oauth2,
				scope: accessToken.scope,
				permissions: effectivePermissions,
				timestamp: new Date().toISOString()
			});

			return [user, {
				id: accessToken.id,
				permission: effectivePermissions,
				scope: accessToken.scope || [],
				appId: accessToken.appId,
				userId: accessToken.userId,
				token: accessToken.token,
				hash: accessToken.hash,
				createdAt: accessToken.createdAt,
				lastUsedAt: accessToken.lastUsedAt,
				expiresAt: accessToken.expiresAt,
				refreshToken: accessToken.refreshToken,
				isRefreshToken: accessToken.isRefreshToken,
			} as AccessToken];
		} else {
			authLogger.debug('Access token authentication successful (no app):', {
				userId: user.id,
				username: user.username,
				tokenId: accessToken.id,
				timestamp: new Date().toISOString()
			});
			return [user, accessToken];
		}
	}
};
