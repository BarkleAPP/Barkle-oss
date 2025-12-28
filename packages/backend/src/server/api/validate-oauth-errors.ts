/**
 * Validation script for OAuth 2.0 error handling
 * This script validates that all error codes and responses are RFC 6749 compliant
 */

import { OAuth2ErrorCodes, OAuth2ErrorDescriptions, OAuth2ErrorStatusCodes, createOAuth2Error } from './oauth-error.js';

export function validateOAuth2ErrorCompliance(): boolean {
	let isValid = true;
	const errors: string[] = [];

	// Validate that all error codes have descriptions
	for (const [key, code] of Object.entries(OAuth2ErrorCodes)) {
		if (!OAuth2ErrorDescriptions[code]) {
			errors.push(`Missing description for error code: ${code}`);
			isValid = false;
		}
	}

	// Validate that all error codes have status codes
	for (const [key, code] of Object.entries(OAuth2ErrorCodes)) {
		if (!OAuth2ErrorStatusCodes[code]) {
			errors.push(`Missing HTTP status code for error code: ${code}`);
			isValid = false;
		}
	}

	// Validate HTTP status codes are appropriate
	const validStatusCodes = [400, 401, 403, 500, 503];
	for (const [code, statusCode] of Object.entries(OAuth2ErrorStatusCodes)) {
		if (!validStatusCodes.includes(statusCode)) {
			errors.push(`Invalid HTTP status code ${statusCode} for error code: ${code}`);
			isValid = false;
		}
	}

	// Validate error creation works correctly
	try {
		const error = createOAuth2Error('INVALID_CLIENT');
		if (error.code !== 'invalid_client') {
			errors.push(`Error creation failed: expected 'invalid_client', got '${error.code}'`);
			isValid = false;
		}
		if (error.httpStatusCode !== 401) {
			errors.push(`Error creation failed: expected status 401, got ${error.httpStatusCode}`);
			isValid = false;
		}
	} catch (e) {
		errors.push(`Error creation threw exception: ${e.message}`);
		isValid = false;
	}

	// Validate RFC 6749 compliance
	const requiredTokenEndpointErrors = [
		'invalid_request',
		'invalid_client', 
		'invalid_grant',
		'unauthorized_client',
		'unsupported_grant_type',
		'invalid_scope'
	];

	const requiredAuthorizationEndpointErrors = [
		'invalid_request',
		'unauthorized_client',
		'access_denied',
		'unsupported_response_type',
		'invalid_scope',
		'server_error',
		'temporarily_unavailable'
	];

	for (const errorCode of requiredTokenEndpointErrors) {
		if (!Object.values(OAuth2ErrorCodes).includes(errorCode as any)) {
			errors.push(`Missing required token endpoint error: ${errorCode}`);
			isValid = false;
		}
	}

	for (const errorCode of requiredAuthorizationEndpointErrors) {
		if (!Object.values(OAuth2ErrorCodes).includes(errorCode as any)) {
			errors.push(`Missing required authorization endpoint error: ${errorCode}`);
			isValid = false;
		}
	}

	// Log results
	if (isValid) {
		console.log('✅ OAuth 2.0 error handling validation passed');
	} else {
		console.log('❌ OAuth 2.0 error handling validation failed:');
		errors.forEach(error => console.log(`  - ${error}`));
	}

	return isValid;
}

// Validate error response formats
export function validateErrorResponseFormats(): boolean {
	let isValid = true;
	const errors: string[] = [];

	// Test OAuth 2.0 error format
	try {
		const error = createOAuth2Error('INVALID_CLIENT', 'Test description', { test: 'info' });
		
		// Check required fields
		if (!error.code || !error.message || !error.httpStatusCode) {
			errors.push('OAuth error missing required fields');
			isValid = false;
		}

		// Check error code format (should be snake_case)
		if (!/^[a-z_]+$/.test(error.code)) {
			errors.push(`Invalid error code format: ${error.code}`);
			isValid = false;
		}

	} catch (e) {
		errors.push(`Error response format validation failed: ${e.message}`);
		isValid = false;
	}

	if (isValid) {
		console.log('✅ Error response format validation passed');
	} else {
		console.log('❌ Error response format validation failed:');
		errors.forEach(error => console.log(`  - ${error}`));
	}

	return isValid;
}

// Run all validations
export function runAllValidations(): boolean {
	console.log('Running OAuth 2.0 error handling validations...\n');
	
	const complianceValid = validateOAuth2ErrorCompliance();
	const formatValid = validateErrorResponseFormats();
	
	const allValid = complianceValid && formatValid;
	
	console.log(`\n${allValid ? '✅' : '❌'} Overall validation: ${allValid ? 'PASSED' : 'FAILED'}`);
	
	return allValid;
}