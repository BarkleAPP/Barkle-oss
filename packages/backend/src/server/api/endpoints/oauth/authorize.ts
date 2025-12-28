import { URL } from 'url';
import define from '../../define.js';
import { AuthSessions, Apps } from '@/models/index.js';
import { genId } from '@/misc/gen-id.js';
import { secureRndstr } from '@/misc/secure-rndstr.js';
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
		redirect_uri: { type: 'string' },
		response_type: { type: 'string', enum: ['code'] },
		scope: { type: 'string', nullable: true },
		state: { type: 'string', nullable: true },
		code_challenge: { type: 'string', nullable: true },
		code_challenge_method: { 
			type: 'string',
			enum: ['S256', 'plain'],
			nullable: true,
		},
	},
	required: ['client_id', 'redirect_uri', 'response_type'],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	// Log the OAuth request for debugging
	logOAuthRequest('authorize', ps, ps.client_id);

	// Find the application
	const app = await Apps.findOneBy({
		id: ps.client_id,
		oauth2: true,
	});

	if (app == null) {
		throw createOAuth2Error('UNAUTHORIZED_CLIENT', 'Client not found or not OAuth2 enabled', {
			client_id: ps.client_id
		});
	}

	// Validate redirect URI
	let redirectUri: URL;
	try {
		redirectUri = new URL(ps.redirect_uri);
	} catch (error) {
		throw createOAuth2Error('INVALID_REQUEST', 'Invalid redirect_uri format', {
			redirect_uri: ps.redirect_uri,
			error: error.message
		});
	}

	const normalizedRedirectUri = redirectUri.origin + redirectUri.pathname;
	
	// Check if the redirect URI matches any of the registered URIs
	const isValidRedirectUri = app.redirectUris.some((registeredUri: string) => {
		try {
			const registered = new URL(registeredUri);
			return registered.origin + registered.pathname === normalizedRedirectUri;
		} catch {
			return false;
		}
	});
	
	if (!isValidRedirectUri) {
		throw createOAuth2Error('INVALID_REQUEST', 'Redirect URI does not match any registered URIs', {
			provided: ps.redirect_uri,
			registered: app.redirectUris
		});
	}

	// Currently only 'code' response type is supported
	if (ps.response_type !== 'code') {
		throw createOAuth2Error('UNSUPPORTED_RESPONSE_TYPE', `Response type '${ps.response_type}' is not supported`, {
			provided: ps.response_type,
			supported: ['code']
		});
	}

	// Parse the requested scopes
	const requestedScopes = ps.scope?.split(' ').filter(Boolean) || [];

	// Validate that all requested scopes are within the app's registered permissions
	if (requestedScopes.length > 0) {
		// Check if any requested scope is not included in the app's permissions
		const invalidScopes = requestedScopes.filter((scope: string) => !app.permission.includes(scope));
		
		if (invalidScopes.length > 0) {
			throw createOAuth2Error('INVALID_SCOPE', 'One or more requested scopes exceed the app\'s registered permissions', {
				requested: requestedScopes,
				invalid: invalidScopes,
				allowed: app.permission
			});
		}
	}

	// Create an authorization session
	const token = secureRndstr(32);

	await AuthSessions.insert({
		id: genId(),
		createdAt: new Date(),
		token: token,
		userId: me?.id ?? null,
		appId: app.id,
		redirectUri: ps.redirect_uri,
		scope: requestedScopes,
		codeChallenge: ps.code_challenge ?? null,
		codeChallengeMethod: ps.code_challenge_method ?? null,
		state: ps.state ?? null,
	});

	// Log successful authorization session creation
	logOAuthSuccess('authorize', app.id, {
		userId: me?.id,
		scope: requestedScopes,
		hasPKCE: !!ps.code_challenge,
		hasState: !!ps.state
	});

	return {
		token,
		app: {
			id: app.id,
			name: app.name,
			description: app.description,
		},
	};
});
