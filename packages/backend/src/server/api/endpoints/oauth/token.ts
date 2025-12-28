import * as crypto from 'node:crypto';
import define from '../../define.js';
import { AuthSessions, AccessTokens, Apps } from '@/models/index.js';
import { genId } from '@/misc/gen-id.js';
import { secureRndstr } from '@/misc/secure-rndstr.js';
import { 
	generateAccessToken, 
	generateRefreshToken, 
	isTokenExpired,
	validateRefreshTokenSecurity,
	secureTokenCompare
} from '@/misc/token-security.js';
import { createOAuth2Error, logOAuthRequest, logOAuthSuccess } from '../../oauth-error.js';

export const meta = {
	tags: ['oauth'],
	requireCredential: false,
	secure: false,
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		client_id: { type: 'string' },
		client_secret: { type: 'string' },
		grant_type: { type: 'string', enum: ['authorization_code', 'refresh_token', 'user_credentials'] },
		code: { type: 'string', nullable: true },
		redirect_uri: { type: 'string', nullable: true },
		code_verifier: { type: 'string', nullable: true },
		refresh_token: { type: 'string', nullable: true },
		// For user_credentials grant type (miauth-like)
		session: { type: 'string', nullable: true },
		name: { type: 'string', nullable: true },
		description: { type: 'string', nullable: true },
		iconUrl: { type: 'string', nullable: true },
		permission: { type: 'array', uniqueItems: true, items: { type: 'string' }, nullable: true },
	},
	required: ['client_id', 'client_secret', 'grant_type'],
} as const;

export default define(meta, paramDef, async (ps) => {
	// Log the OAuth request for debugging
	logOAuthRequest('token', ps, ps.client_id);

	// Find the application
	const app = await Apps.findOneBy({
		id: ps.client_id,
		secret: ps.client_secret,
		oauth2: true,
	});

	if (app == null) {
		throw createOAuth2Error('INVALID_CLIENT', undefined, {
			client_id: ps.client_id,
			reason: 'Client not found or invalid credentials'
		});
	}

	// Handle different grant types
	if (ps.grant_type === 'authorization_code') {
		if (!ps.code || !ps.redirect_uri) {
			throw createOAuth2Error('INVALID_REQUEST', 'Missing required parameters: code and redirect_uri are required for authorization_code grant');
		}

		// Fetch the session by authorization code
		const session = await AuthSessions.findOneBy({
			authorizationCode: ps.code,
			appId: app.id,
		});

		if (session == null) {
			throw createOAuth2Error('INVALID_GRANT', 'Authorization code not found or invalid', {
				code: ps.code.substring(0, 8) + '...',
				appId: app.id
			});
		}

		// Validate redirect URI
		if (session.redirectUri !== ps.redirect_uri) {
			throw createOAuth2Error('INVALID_GRANT', 'Redirect URI does not match the one used in the authorization request', {
				provided: ps.redirect_uri,
				expected: session.redirectUri
			});
		}

		// Check authorization code expiration (10 minutes) - enhanced validation
		if (isTokenExpired(session.authorizationCodeExpiresAt)) {
			// Clean up expired session
			await AuthSessions.delete(session.id);
			throw createOAuth2Error('INVALID_GRANT', 'Authorization code has expired', {
				expiresAt: session.authorizationCodeExpiresAt,
				currentTime: new Date()
			});
		}

		// Verify PKCE challenge if provided
		if (session.codeChallenge) {
			if (!ps.code_verifier) {
				throw createOAuth2Error('INVALID_REQUEST', 'Missing code_verifier parameter required for PKCE');
			}

			let codeVerifier = ps.code_verifier;
			if (session.codeChallengeMethod === 'S256') {
				const hash = crypto.createHash('sha256');
				hash.update(codeVerifier);
				codeVerifier = hash.digest('base64')
					.replace(/=/g, '')
					.replace(/\+/g, '-')
					.replace(/\//g, '_');
			}

			// Use secure comparison to prevent timing attacks
			if (!secureTokenCompare(session.codeChallenge, codeVerifier)) {
				throw createOAuth2Error('INVALID_GRANT', 'PKCE code verifier does not match the code challenge', {
					method: session.codeChallengeMethod
				});
			}
		}

		if (!session.userId) {
			throw createOAuth2Error('INVALID_GRANT', 'Authorization session is not associated with a user');
		}

		// Generate secure tokens with enhanced entropy validation
		const expiresIn = 60 * 60 * 24 * 30; // 30 days in seconds
		const accessTokenData = generateAccessToken(expiresIn);
		const refreshTokenData = generateRefreshToken();
		
		// Validate refresh token security
		if (!validateRefreshTokenSecurity(refreshTokenData.token, accessTokenData.token)) {
			throw createOAuth2Error('SERVER_ERROR', 'Failed to generate secure refresh token');
		}

		// Insert access token with enhanced security
		await AccessTokens.insert({
			id: genId(),
			createdAt: accessTokenData.createdAt,
			lastUsedAt: accessTokenData.createdAt,
			appId: app.id,
			userId: session.userId,
			token: accessTokenData.token,
			hash: accessTokenData.hash,
			scope: session.scope,
			expiresAt: accessTokenData.expiresAt,
			refreshToken: refreshTokenData.token,
		});

		// Delete the authorization session
		await AuthSessions.delete(session.id);

		// Log successful token generation
		logOAuthSuccess('token', app.id, {
			grant_type: 'authorization_code',
			userId: session.userId,
			scope: session.scope
		});

		return {
			access_token: accessTokenData.token,
			token_type: 'Bearer',
			expires_in: expiresIn,
			refresh_token: refreshTokenData.token,
			scope: session.scope.join(' '),
		};
	} else if (ps.grant_type === 'refresh_token') {
		if (!ps.refresh_token) {
			throw createOAuth2Error('INVALID_REQUEST', 'Missing required parameter: refresh_token');
		}

		// Find the token with enhanced validation
		const token = await AccessTokens.findOneBy({
			appId: app.id,
			refreshToken: ps.refresh_token,
		});

		if (token == null) {
			throw createOAuth2Error('INVALID_GRANT', 'Refresh token not found or invalid', {
				appId: app.id,
				refresh_token: ps.refresh_token.substring(0, 8) + '...'
			});
		}

		// Validate refresh token security
		if (!validateRefreshTokenSecurity(ps.refresh_token)) {
			throw createOAuth2Error('INVALID_GRANT', 'Refresh token failed security validation', {
				appId: app.id
			});
		}

		// Check if the access token associated with this refresh token has expired
		// This is additional security to ensure we don't refresh tokens for expired sessions
		if (isTokenExpired(token.expiresAt)) {
			// Clean up expired token
			await AccessTokens.delete(token.id);
			throw createOAuth2Error('INVALID_GRANT', 'Associated access token has expired', {
				tokenId: token.id,
				expiresAt: token.expiresAt
			});
		}

		// Generate new secure access token
		const expiresIn = 60 * 60 * 24 * 30; // 30 days in seconds
		const newAccessTokenData = generateAccessToken(expiresIn);
		
		// Validate the new token is different from the refresh token
		if (!validateRefreshTokenSecurity(token.refreshToken!, newAccessTokenData.token)) {
			throw createOAuth2Error('SERVER_ERROR', 'Failed to generate secure access token');
		}

		// Update token with enhanced security
		await AccessTokens.update(token.id, {
			token: newAccessTokenData.token,
			hash: newAccessTokenData.hash,
			lastUsedAt: newAccessTokenData.createdAt,
			expiresAt: newAccessTokenData.expiresAt,
		});

		// Log successful token refresh
		logOAuthSuccess('token', app.id, {
			grant_type: 'refresh_token',
			userId: token.userId,
			scope: token.scope
		});

		return {
			access_token: newAccessTokenData.token,
			token_type: 'Bearer',
			expires_in: expiresIn,
			refresh_token: token.refreshToken,
			scope: token.scope.join(' '),
		};
	} else if (ps.grant_type === 'user_credentials') {
		// miauth-like user credential token generation
		if (!ps.session || !ps.permission) {
			throw createOAuth2Error('INVALID_REQUEST', 'Missing required parameters: session and permission are required for user_credentials grant');
		}

		// For user_credentials, we need to find the session to get the user
		const authSession = await AuthSessions.findOneBy({
			token: ps.session,
			appId: app.id,
		});

		if (!authSession || !authSession.userId) {
			throw createOAuth2Error('INVALID_GRANT', 'Invalid session or session not associated with a user', {
				session: ps.session.substring(0, 8) + '...',
				appId: app.id
			});
		}

		// Generate simple user auth token like miauth
		const userToken = secureRndstr(32, true);
		const now = new Date();

		// Insert access token with user credentials style
		await AccessTokens.insert({
			id: genId(),
			createdAt: now,
			lastUsedAt: now,
			session: ps.session,
			userId: authSession.userId,
			token: userToken,
			hash: userToken,
			name: ps.name,
			description: ps.description,
			iconUrl: ps.iconUrl,
			permission: ps.permission,
			appId: app.id,
			// No OAuth2-specific fields for user credentials
			scope: [],
			refreshToken: null,
			expiresAt: null,
		});

		// Log successful user token generation
		logOAuthSuccess('token', app.id, {
			grant_type: 'user_credentials',
			userId: authSession.userId,
			permissions: ps.permission
		});

		return {
			token: userToken,
			token_type: 'Bearer',
			// No expiration for user credentials tokens
		};
	} else {
		throw createOAuth2Error('UNSUPPORTED_GRANT_TYPE', `Grant type '${ps.grant_type}' is not supported`, {
			provided_grant_type: ps.grant_type,
			supported_grant_types: ['authorization_code', 'refresh_token', 'user_credentials']
		});
	}
});
