# OAuth 2.0 Error Handling Implementation

This document describes the enhanced OAuth 2.0 error handling implementation that ensures RFC 6749 compliance across all OAuth endpoints.

## Overview

The error handling system provides:
- Standardized OAuth 2.0 error response formats
- Proper HTTP status codes for different error types
- Comprehensive error logging for debugging
- WWW-Authenticate headers for 401 responses (except OAuth token endpoint)
- Consistent error handling across all OAuth endpoints

## Error Response Formats

### OAuth 2.0 Token Endpoint Errors (RFC 6749 Section 5.2)

Token endpoint errors return JSON responses with the following format:

```json
{
  "error": "invalid_client",
  "error_description": "Client authentication failed (e.g., unknown client, no client authentication included, or unsupported authentication method)."
}
```

### OAuth 2.0 Authorization Endpoint Errors (RFC 6749 Section 4.1.2.1)

Authorization endpoint errors redirect to the client's redirect_uri with error parameters:

```
https://client.example.com/callback?error=invalid_scope&error_description=The%20requested%20scope%20is%20invalid&state=xyz
```

### API Authentication Errors

API authentication failures return structured responses with WWW-Authenticate headers (except for OAuth token endpoint per RFC 6749):

```json
{
  "error": "invalid_token",
  "error_description": "The access token provided is expired, revoked, malformed, or invalid for other reasons."
}
```

## Error Codes and HTTP Status Codes

| Error Code | HTTP Status | Description | Usage |
|------------|-------------|-------------|-------|
| `invalid_request` | 400 | Missing or malformed parameters | Authorization & Token endpoints |
| `invalid_client` | 401 | Client authentication failed | Token endpoint |
| `invalid_grant` | 400 | Invalid authorization grant | Token endpoint |
| `unauthorized_client` | 400 | Client not authorized for grant type | Authorization & Token endpoints |
| `unsupported_grant_type` | 400 | Grant type not supported | Token endpoint |
| `invalid_scope` | 400 | Invalid or unknown scope | Authorization & Token endpoints |
| `access_denied` | 400 | User denied authorization | Authorization endpoint |
| `unsupported_response_type` | 400 | Response type not supported | Authorization endpoint |
| `server_error` | 500 | Internal server error | All endpoints |
| `temporarily_unavailable` | 503 | Service temporarily unavailable | All endpoints |
| `invalid_token` | 401 | Invalid access token | API endpoints |

## Implementation Details

### OAuth Error Module (`oauth-error.ts`)

The centralized error handling module provides:

- `createOAuth2Error()`: Creates standardized OAuth 2.0 errors
- `logOAuthRequest()`: Logs OAuth requests for debugging
- `logOAuthSuccess()`: Logs successful OAuth operations
- `createErrorRedirectUrl()`: Creates error redirect URLs for authorization endpoint

### Enhanced Endpoints

#### Token Endpoint (`/api/oauth/token`)

- Validates client credentials with detailed error messages
- Handles authorization code and refresh token grant types
- Implements PKCE validation with specific error responses
- Provides comprehensive logging for debugging

#### Authorization Endpoint (`/api/oauth/authorize`)

- Validates client_id and OAuth2 enablement
- Performs exact redirect URI matching
- Validates requested scopes against app permissions
- Supports PKCE and state parameters

#### Authentication Middleware

- Extracts Bearer tokens from Authorization headers
- Validates token expiration and type
- Provides detailed authentication logging
- Returns proper WWW-Authenticate headers (except for token endpoint)

### API Handler Enhancements

The API handler now:

- Adds WWW-Authenticate headers for 401 responses (except OAuth token endpoint)
- Formats OAuth 2.0 compliant error responses for OAuth endpoints
- Maintains backward compatibility with standard API error format
- Provides proper HTTP status codes based on error type

## Error Logging

All OAuth operations are logged with appropriate detail levels:

### Debug Logging
- Successful authentications
- Token lookups and validations
- Authorization session creation

### Info Logging
- OAuth request initiation
- Successful OAuth operations
- Token generation and refresh

### Warning Logging
- Authentication failures
- Invalid tokens or credentials
- Error redirects

### Error Logging
- OAuth 2.0 specification violations
- Server errors and exceptions
- Invalid redirect URIs

## Usage Examples

### Creating OAuth 2.0 Errors

```typescript
// Invalid client error
throw createOAuth2Error('INVALID_CLIENT', undefined, {
  client_id: ps.client_id,
  reason: 'Client not found or invalid credentials'
});

// Invalid grant with custom description
throw createOAuth2Error('INVALID_GRANT', 'Authorization code has expired', {
  expiresAt: session.authorizationCodeExpiresAt,
  currentTime: new Date()
});
```

### Logging OAuth Operations

```typescript
// Log OAuth request
logOAuthRequest('token', ps, ps.client_id);

// Log successful operation
logOAuthSuccess('authorize', app.id, {
  userId: user.id,
  scope: requestedScopes,
  hasPKCE: !!ps.code_challenge
});
```

### Creating Error Redirect URLs

```typescript
const errorUrl = createErrorRedirectUrl(
  redirectUri,
  'ACCESS_DENIED',
  state,
  'User denied the authorization request'
);
```

## Testing

The implementation includes comprehensive test examples in `test-oauth-errors.ts` that demonstrate:

- Error creation and formatting
- Logging functionality
- Redirect URL generation
- Different error scenarios for each endpoint

## Compliance

This implementation ensures compliance with:

- RFC 6749 (OAuth 2.0 Authorization Framework)
- RFC 7235 (HTTP Authentication)
- RFC 7636 (PKCE)

All error responses follow the exact format specified in these RFCs, ensuring interoperability with OAuth 2.0 clients and libraries.

## Migration Notes

The enhanced error handling is backward compatible with existing implementations:

- Standard API endpoints continue to use the existing error format
- OAuth endpoints now use RFC 6749 compliant error format
- Authentication errors include proper WWW-Authenticate headers (except token endpoint)
- Comprehensive logging provides better debugging capabilities

## Important: WWW-Authenticate Header Usage

According to RFC 6749 Section 5.2, the OAuth 2.0 token endpoint **MUST NOT** include WWW-Authenticate headers in error responses. This is a critical distinction:

- **Token Endpoint (`/api/oauth/token`)**: No WWW-Authenticate header in error responses
- **Resource Endpoints (API endpoints)**: Include WWW-Authenticate header for 401 responses
- **Authorization Endpoint (`/api/oauth/authorize`)**: No WWW-Authenticate header (uses redirects)

This implementation correctly handles this distinction to ensure RFC 6749 compliance and prevent issues with OAuth 2.0 client libraries.

## Security Considerations

The error handling implementation includes security best practices:

- Sensitive information (tokens, secrets) is redacted in logs
- Error messages provide sufficient detail for debugging without exposing internal state
- Rate limiting and timing attack protection considerations are maintained
- Proper HTTP status codes prevent information leakage