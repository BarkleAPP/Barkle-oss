import * as crypto from 'crypto';
import define from '../../define.js';
import { AuthSessions, AccessTokens, Apps } from '@/models/index.js';
import { genId } from '@/misc/gen-id.js';
import { generateAuthorizationCode, generateAccessToken } from '@/misc/token-security.js';
import { createOAuth2Error, logOAuthSuccess } from '../../oauth-error.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['auth'],
	requireCredential: true,
	secure: true,

	errors: {
		noSuchSession: {
			message: 'No such session.',
			code: 'NO_SUCH_SESSION',
			id: '9c72d8de-391a-43c1-9d06-08d29efde8df',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		token: { type: 'string' },
	},
	required: ['token'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	// Fetch token
	const session = await AuthSessions
		.findOneBy({ token: ps.token });

	if (session == null) {
		throw new ApiError(meta.errors.noSuchSession);
	}

	// Lookup app
	const app = await Apps.findOneByOrFail({ id: session.appId });

	// Handle OAuth2 authorization code flow
	if (app.oauth2 && session.redirectUri) {
		// Generate secure authorization code with 10-minute expiration
		const authCodeData = generateAuthorizationCode();

		// Update session with authorization code and user ID
		await AuthSessions.update(session.id, {
			userId: user.id,
			authorizationCode: authCodeData.token,
			authorizationCodeExpiresAt: authCodeData.expiresAt,
		});

		// Construct redirect URI with authorization code
		const redirectUrl = new URL(session.redirectUri);
		redirectUrl.searchParams.append('code', authCodeData.token);
		
		// Add state parameter if it was provided in the original request
		if (session.state) {
			redirectUrl.searchParams.append('state', session.state);
		}

		// Log successful authorization acceptance
		logOAuthSuccess('auth/accept', app.id, {
			userId: user.id,
			scope: session.scope,
			hasState: !!session.state,
			hasPKCE: !!session.codeChallenge
		});
		
		// Return authorization code and redirect URI
		return {
			authorizationCode: authCodeData.token,
			redirectUri: redirectUrl.toString(),
		};
	}
	
	// Legacy MiAuth flow for non-OAuth2 apps
	// Fetch existing access token
	const exist = await AccessTokens.findOneBy({
		appId: session.appId,
		userId: user.id,
	});

	if (exist == null) {
		// Generate secure access token for legacy flow
		const accessTokenData = generateAccessToken();

		// Insert access token doc
		await AccessTokens.insert({
			id: genId(),
			createdAt: accessTokenData.createdAt,
			lastUsedAt: accessTokenData.createdAt,
			appId: session.appId,
			userId: user.id,
			token: accessTokenData.token,
			hash: accessTokenData.hash,
		});
	}

	// Update session
	await AuthSessions.update(session.id, {
		userId: user.id,
	});
	
	// Return an empty object for non-OAuth2 flow
	return {};
});
