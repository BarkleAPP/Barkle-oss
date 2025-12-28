import { ApiError } from './error.js';
import Logger from '@/services/logger.js';

const oauthLogger = new Logger('oauth', 'blue');

/**
 * OAuth 2.0 Error Codes as defined in RFC 6749
 */
export const OAuth2ErrorCodes = {
	// Authorization endpoint errors (Section 4.1.2.1)
	INVALID_REQUEST: 'invalid_request',
	UNAUTHORIZED_CLIENT: 'unauthorized_client',
	ACCESS_DENIED: 'access_denied',
	UNSUPPORTED_RESPONSE_TYPE: 'unsupported_response_type',
	INVALID_SCOPE: 'invalid_scope',
	SERVER_ERROR: 'server_error',
	TEMPORARILY_UNAVAILABLE: 'temporarily_unavailable',
	
	// Token endpoint errors (Section 5.2)
	INVALID_CLIENT: 'invalid_client',
	INVALID_GRANT: 'invalid_grant',
	UNSUPPORTED_GRANT_TYPE: 'unsupported_grant_type',
} as const;

/**
 * OAuth 2.0 Error Descriptions
 */
export const OAuth2ErrorDescriptions = {
	[OAuth2ErrorCodes.INVALID_REQUEST]: 'The request is missing a required parameter, includes an invalid parameter value, includes a parameter more than once, or is otherwise malformed.',
	[OAuth2ErrorCodes.INVALID_CLIENT]: 'Client authentication failed (e.g., unknown client, no client authentication included, or unsupported authentication method).',
	[OAuth2ErrorCodes.INVALID_GRANT]: 'The provided authorization grant (e.g., authorization code, resource owner credentials) or refresh token is invalid, expired, revoked, does not match the redirection URI used in the authorization request, or was issued to another client.',
	[OAuth2ErrorCodes.UNAUTHORIZED_CLIENT]: 'The authenticated client is not authorized to use this authorization grant type.',
	[OAuth2ErrorCodes.UNSUPPORTED_GRANT_TYPE]: 'The authorization grant type is not supported by the authorization server.',
	[OAuth2ErrorCodes.INVALID_SCOPE]: 'The requested scope is invalid, unknown, or malformed.',
	[OAuth2ErrorCodes.ACCESS_DENIED]: 'The resource owner or authorization server denied the request.',
	[OAuth2ErrorCodes.UNSUPPORTED_RESPONSE_TYPE]: 'The authorization server does not support obtaining an authorization code using this method.',
	[OAuth2ErrorCodes.SERVER_ERROR]: 'The authorization server encountered an unexpected condition that prevented it from fulfilling the request.',
	[OAuth2ErrorCodes.TEMPORARILY_UNAVAILABLE]: 'The authorization server is currently unable to handle the request due to a temporary overloading or maintenance of the server.',
} as const;

/**
 * HTTP Status Codes for OAuth 2.0 Errors
 */
export const OAuth2ErrorStatusCodes = {
	[OAuth2ErrorCodes.INVALID_REQUEST]: 400,
	[OAuth2ErrorCodes.INVALID_CLIENT]: 401,
	[OAuth2ErrorCodes.INVALID_GRANT]: 400,
	[OAuth2ErrorCodes.UNAUTHORIZED_CLIENT]: 400,
	[OAuth2ErrorCodes.UNSUPPORTED_GRANT_TYPE]: 400,
	[OAuth2ErrorCodes.INVALID_SCOPE]: 400,
	[OAuth2ErrorCodes.ACCESS_DENIED]: 400,
	[OAuth2ErrorCodes.UNSUPPORTED_RESPONSE_TYPE]: 400,
	[OAuth2ErrorCodes.SERVER_ERROR]: 500,
	[OAuth2ErrorCodes.TEMPORARILY_UNAVAILABLE]: 503,
} as const;

/**
 * Create a standardized OAuth 2.0 API Error
 */
export function createOAuth2Error(
	errorCode: keyof typeof OAuth2ErrorCodes,
	customDescription?: string,
	additionalInfo?: any
): ApiError {
	const code = OAuth2ErrorCodes[errorCode];
	const description = customDescription || OAuth2ErrorDescriptions[code];
	const httpStatusCode = OAuth2ErrorStatusCodes[code];
	
	// Log the OAuth error for debugging
	oauthLogger.error(`OAuth 2.0 Error: ${code}`, {
		errorCode: code,
		description,
		httpStatusCode,
		additionalInfo,
		timestamp: new Date().toISOString(),
	});

	return new ApiError({
		message: description,
		code: code,
		id: generateErrorId(code),
		kind: httpStatusCode >= 500 ? 'server' : 'client',
		httpStatusCode,
	}, additionalInfo);
}

/**
 * Generate consistent error IDs for OAuth errors
 */
function generateErrorId(errorCode: string): string {
	const errorIds = {
		[OAuth2ErrorCodes.INVALID_REQUEST]: '36ad1124-aa99-4c1f-8693-be906064e991',
		[OAuth2ErrorCodes.INVALID_CLIENT]: '5b864652-6ed0-4ea2-9de5-da7e0861a9fd',
		[OAuth2ErrorCodes.INVALID_GRANT]: 'ce8a5390-0313-4fd2-9be9-b3aaaef4e5c8',
		[OAuth2ErrorCodes.UNAUTHORIZED_CLIENT]: '7f214e73-9b8c-4f98-a6a0-c951a41f7a5c',
		[OAuth2ErrorCodes.UNSUPPORTED_GRANT_TYPE]: '91bab962-a3d5-4d9d-82f6-87562cf6a290',
		[OAuth2ErrorCodes.INVALID_SCOPE]: 'def863c8-c956-46a3-aa64-89a0c872b9c2',
		[OAuth2ErrorCodes.ACCESS_DENIED]: '9ae5723b-5b61-4a59-a28b-f590c3b3a6ee',
		[OAuth2ErrorCodes.UNSUPPORTED_RESPONSE_TYPE]: '63d86ade-d035-4f0f-88b8-e55da0ff5e48',
		[OAuth2ErrorCodes.SERVER_ERROR]: '5d37dbcb-891e-41ca-a3d6-e690c97775ac',
		[OAuth2ErrorCodes.TEMPORARILY_UNAVAILABLE]: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
	};
	
	return errorIds[errorCode] || '5d37dbcb-891e-41ca-a3d6-e690c97775ac';
}

/**
 * Log OAuth 2.0 request for debugging
 */
export function logOAuthRequest(endpoint: string, params: any, clientId?: string): void {
	oauthLogger.info(`OAuth 2.0 Request: ${endpoint}`, {
		endpoint,
		clientId,
		params: {
			...params,
			// Redact sensitive information
			client_secret: params.client_secret ? '[REDACTED]' : undefined,
			code: params.code ? `${params.code.substring(0, 8)}...` : undefined,
			refresh_token: params.refresh_token ? `${params.refresh_token.substring(0, 8)}...` : undefined,
			code_verifier: params.code_verifier ? `${params.code_verifier.substring(0, 8)}...` : undefined,
		},
		timestamp: new Date().toISOString(),
	});
}

/**
 * Log successful OAuth 2.0 response for debugging
 */
export function logOAuthSuccess(endpoint: string, clientId?: string, additionalInfo?: any): void {
	oauthLogger.info(`OAuth 2.0 Success: ${endpoint}`, {
		endpoint,
		clientId,
		additionalInfo,
		timestamp: new Date().toISOString(),
	});
}

/**
 * Create redirect URL with OAuth error parameters for authorization endpoint
 */
export function createErrorRedirectUrl(
	redirectUri: string,
	errorCode: keyof typeof OAuth2ErrorCodes,
	state?: string,
	customDescription?: string
): string {
	try {
		const url = new URL(redirectUri);
		const code = OAuth2ErrorCodes[errorCode];
		const description = customDescription || OAuth2ErrorDescriptions[code];
		
		url.searchParams.append('error', code);
		url.searchParams.append('error_description', description);
		
		if (state) {
			url.searchParams.append('state', state);
		}
		
		// Log the error redirect for debugging
		oauthLogger.warn(`OAuth 2.0 Error Redirect`, {
			redirectUri,
			errorCode: code,
			description,
			state,
			timestamp: new Date().toISOString(),
		});
		
		return url.toString();
	} catch (error) {
		// If redirect URI is invalid, log the error and throw
		oauthLogger.error(`Invalid redirect URI: ${redirectUri}`, {
			redirectUri,
			error: error.message,
			timestamp: new Date().toISOString(),
		});
		throw createOAuth2Error('INVALID_REQUEST', 'Invalid redirect_uri parameter');
	}
}