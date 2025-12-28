/**
 * Test file to verify OAuth 2.0 error handling implementation
 * This file demonstrates the standardized error handling patterns
 */

import { createOAuth2Error, logOAuthRequest, logOAuthSuccess, createErrorRedirectUrl } from './oauth-error.js';

// Test OAuth 2.0 error creation
export function testOAuth2Errors() {
	console.log('Testing OAuth 2.0 Error Handling...');

	// Test invalid client error
	try {
		throw createOAuth2Error('INVALID_CLIENT', undefined, {
			client_id: 'test-client-123',
			reason: 'Client not found'
		});
	} catch (error) {
		console.log('Invalid Client Error:', {
			code: error.code,
			message: error.message,
			httpStatusCode: error.httpStatusCode,
			kind: error.kind,
			info: error.info
		});
	}

	// Test invalid grant error
	try {
		throw createOAuth2Error('INVALID_GRANT', 'Authorization code has expired', {
			code: 'abc123...',
			expiresAt: new Date(),
			currentTime: new Date()
		});
	} catch (error) {
		console.log('Invalid Grant Error:', {
			code: error.code,
			message: error.message,
			httpStatusCode: error.httpStatusCode,
			kind: error.kind,
			info: error.info
		});
	}

	// Test invalid request error
	try {
		throw createOAuth2Error('INVALID_REQUEST', 'Missing required parameter: redirect_uri');
	} catch (error) {
		console.log('Invalid Request Error:', {
			code: error.code,
			message: error.message,
			httpStatusCode: error.httpStatusCode,
			kind: error.kind
		});
	}

	// Test error redirect URL creation
	const errorRedirectUrl = createErrorRedirectUrl(
		'https://example.com/callback',
		'ACCESS_DENIED',
		'state123',
		'User denied the authorization request'
	);
	console.log('Error Redirect URL:', errorRedirectUrl);

	// Test logging functions
	logOAuthRequest('token', {
		client_id: 'test-client',
		grant_type: 'authorization_code',
		code: 'test-code-123456789',
		client_secret: 'secret-value'
	}, 'test-client');

	logOAuthSuccess('authorize', 'test-client', {
		userId: 'user123',
		scope: ['read', 'write'],
		hasPKCE: true,
		hasState: true
	});

	console.log('OAuth 2.0 Error Handling Tests Completed');
}

// Example usage patterns for different endpoints

export const tokenEndpointErrorExamples = {
	// Invalid client credentials
	invalidClient: () => createOAuth2Error('INVALID_CLIENT', undefined, {
		client_id: 'unknown-client',
		reason: 'Client not found or invalid credentials'
	}),

	// Invalid authorization code
	invalidGrant: () => createOAuth2Error('INVALID_GRANT', 'Authorization code not found or invalid', {
		code: 'abc123...',
		appId: 'app-123'
	}),

	// Missing required parameters
	invalidRequest: () => createOAuth2Error('INVALID_REQUEST', 'Missing required parameters: code and redirect_uri are required for authorization_code grant'),

	// Unsupported grant type
	unsupportedGrantType: () => createOAuth2Error('UNSUPPORTED_GRANT_TYPE', 'Grant type \'client_credentials\' is not supported', {
		provided_grant_type: 'client_credentials',
		supported_grant_types: ['authorization_code', 'refresh_token']
	})
};

export const authorizeEndpointErrorExamples = {
	// Invalid redirect URI
	invalidRequest: () => createOAuth2Error('INVALID_REQUEST', 'Redirect URI does not match any registered URIs', {
		provided: 'https://malicious.com/callback',
		registered: ['https://example.com/callback']
	}),

	// Unauthorized client
	unauthorizedClient: () => createOAuth2Error('UNAUTHORIZED_CLIENT', 'Client not found or not OAuth2 enabled', {
		client_id: 'non-oauth-client'
	}),

	// Unsupported response type
	unsupportedResponseType: () => createOAuth2Error('UNSUPPORTED_RESPONSE_TYPE', 'Response type \'token\' is not supported', {
		provided: 'token',
		supported: ['code']
	}),

	// Invalid scope
	invalidScope: () => createOAuth2Error('INVALID_SCOPE', 'One or more requested scopes exceed the app\'s registered permissions', {
		requested: ['read', 'write', 'admin'],
		invalid: ['admin'],
		allowed: ['read', 'write']
	})
};

export const authenticationErrorExamples = {
	// Token expired
	tokenExpired: () => ({
		error: 'invalid_token',
		error_description: 'The access token provided is expired, revoked, malformed, or invalid for other reasons.'
	}),

	// Invalid token format
	invalidToken: () => ({
		error: 'invalid_token',
		error_description: 'The access token provided is expired, revoked, malformed, or invalid for other reasons.'
	}),

	// Refresh token used for API access
	refreshTokenMisuse: () => ({
		error: 'invalid_token',
		error_description: 'The access token provided is expired, revoked, malformed, or invalid for other reasons.'
	})
};