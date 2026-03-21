import Koa from 'koa';
import { User } from '@/models/entities/user.js';
import { UserIps } from '@/models/index.js';
import { fetchMeta } from '@/misc/fetch-meta.js';
import { IEndpoint } from './endpoints.js';
import authenticate, { AuthenticationError } from './authenticate.js';
import call from './call.js';
import { ApiError } from './error.js';
import Stripe from 'stripe';
import crypto from 'crypto';
import Logger from '@/services/logger.js';
import { apiLogger } from './logger.js';
// IP ban system disabled for now - uncomment when tables are stable
// import { isIpBanned } from '@/misc/security/ip-ban.js';
// import { logSecurityEvent } from '@/services/security-event.js';
// import { SecurityEventType } from '@/models/entities/security-event.js';

const logger = new Logger('webhook-middleware');

/**
 * Sanitize request parameters to prevent sensitive data from being logged
 * Redacts passwords, tokens, API keys, and other sensitive information
 */
function sanitizeParams(params: any): any {
    if (!params || typeof params !== 'object') {
        return params;
    }

    const sensitiveFields = [
        'password',
        'token',
        'accessToken',
        'refreshToken',
        'secret',
        'apiKey',
        'apiSecret',
        'privateKey',
        'sessionToken',
        'credential',
        'i',
        'stripeSignature',
        'muxSignature',
    ];

    const sanitized = Array.isArray(params) ? [...params] : { ...params };

    for (const key in sanitized) {
        if (sensitiveFields.includes(key)) {
            sanitized[key] = '[REDACTED]';
        } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
            sanitized[key] = sanitizeParams(sanitized[key]);
        }
    }

    return sanitized;
}

/**
 * Extract real client IP from request headers
 * Prioritizes Cloudflare's CF-Connecting-IP header, then falls back to X-Forwarded-For
 * Returns ctx.ip as final fallback (direct connection IP)
 *
 * Security: This does NOT enable proxy trust - it only reads headers for logging purposes
 * The ctx.ip is still used for authentication/rate limiting decisions
 */
function getClientIp(ctx: Koa.Context): string {
    // Cloudflare provides the verified client IP - this is trustworthy when using CF
    // Cloudflare provides the verified client IP - this is trustworthy when using CF
    const cfConnectingIp = ctx.headers['cf-connecting-ip'];
    if (cfConnectingIp) {
        return Array.isArray(cfConnectingIp) ? cfConnectingIp[0] : cfConnectingIp;
    }

    // X-Real-IP is commonly used by proxies and is a safe fallback
    const xRealIp = ctx.headers['x-real-ip'];
    if (xRealIp) {
        return Array.isArray(xRealIp) ? xRealIp[0] : xRealIp;
    }

    // X-Forwarded-For may contain multiple IPs, first one is typically the client
    // Note: This header can be spoofed, so ctx.ip should be used for security decisions
    const xForwardedFor = ctx.headers['x-forwarded-for'];
    if (xForwardedFor) {
        const headerVal = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor;
        return headerVal.split(',')[0].trim();
    }

    // Fallback to direct connection IP
    return ctx.ip;
}

const userIpHistories = new Map<User['id'], Set<string>>();
setInterval(() => {
    userIpHistories.clear();
}, 1000 * 60 * 60);

export default (endpoint: IEndpoint, ctx: Koa.Context) => new Promise<void>(async (res) => {
    const body = ctx.is('multipart/form-data')
        ? (ctx.request as any).body
        : ctx.method === 'GET'
            ? ctx.query
            : ctx.request.body;

    const reply = (x?: any, y?: ApiError) => {
        if (x == null) {
            ctx.status = 204;
        } else if (typeof x === 'number' && y) {
            ctx.status = x;

            // Add WWW-Authenticate header for 401 responses, but NOT for OAuth token endpoint
            // RFC 6749 Section 5.2: Token endpoint errors should not include WWW-Authenticate header
            if (x === 401 && endpoint.name !== 'oauth/token') {
                ctx.set('WWW-Authenticate', 'Bearer');
            }

            // Format OAuth 2.0 compliant error response for OAuth endpoints
            if (endpoint.meta.tags?.includes('oauth') && y.code && y.code.includes('_')) {
                // OAuth 2.0 error format (RFC 6749)
                ctx.body = {
                    error: y.code,
                    error_description: y.message,
                    ...(y.info ? y.info : {}),
                };
            } else {
                // Standard API error format
                ctx.body = {
                    error: {
                        message: y!.message,
                        code: y!.code,
                        id: y!.id,
                        kind: y!.kind,
                        ...(y!.info ? { info: y!.info } : {}),
                    },
                };
            }
        } else {
            ctx.body = typeof x === 'string' ? JSON.stringify(x) : x;
        }
        res();
    };

    // Stripe webhook handling
    if (endpoint.name === 'stripe/webhook') {
        const sig = ctx.headers['stripe-signature'] as string;
        if (!sig) {
            reply(400, new ApiError({
                message: 'No Stripe signature provided',
                code: 'NO_SIGNATURE',
                id: '9f8e1fc0-9f9a-4f5a-8f5e-3f8f8f8f8f8f',
            }));
            return;
        }

        const instance = await fetchMeta();
        if (!instance.stripe_key || !instance.stripe_webhook_secret) {
            reply(500, new ApiError({
                message: 'Stripe is not configured properly',
                code: 'STRIPE_MISCONFIGURED',
                id: 'c02b9a7d-2a8b-4c24-b99c-f4e33ccb1292',
            }));
            return;
        }

        const stripe = new Stripe(instance.stripe_key, {
            apiVersion: '2024-06-20',
        });

        let event: Stripe.Event;

        try {
            event = stripe.webhooks.constructEvent(
                ctx.request.rawBody,
                sig,
                instance.stripe_webhook_secret
            );
        } catch (err) {
            reply(400, new ApiError({
                message: 'Invalid signature',
                code: 'INVALID_SIGNATURE',
                id: '5d504554-1a7e-4a7b-9fcf-88b17365f92f',
            }));
            return;
        }

        // If we get here, the signature is valid
        body.event = event;
    }

    // Mux webhook handling
    if (endpoint.name === 'mux/webhook') {
        const sig = ctx.headers['mux-signature'] as string;
        logger.info(`Received Mux webhook`);

        try {
            // Parse the raw webhook data
            const webhookData = JSON.parse(ctx.request.rawBody);
            logger.info(`Received Mux webhook type: ${webhookData.type}`);

            if (!webhookData.type || !webhookData.data) {
                throw new Error('Missing required webhook data');
            }

            const instance = await fetchMeta();
            if (!instance.mux_webhook_secret) {
                reply(500, new ApiError({
                    message: 'Mux is not configured properly',
                    code: 'MUX_MISCONFIGURED',
                    id: 'c02b9a7d-2a8b-4c24-b99c-f4e33ccb1293',
                }));
                return;
            }

            // Verify signature if provided
            if (sig) {
                const [timestampPart, signaturePart] = sig.split(',');
                const timestamp = timestampPart.split('=')[1];
                const signature = signaturePart.split('=')[1];

                const expectedSignature = crypto
                    .createHmac('sha256', instance.mux_webhook_secret)
                    .update(timestamp + '.' + ctx.request.rawBody)
                    .digest('hex');

                if (signature !== expectedSignature) {
                    logger.error('Invalid Mux signature');
                    reply(400, new ApiError({
                        message: 'Invalid signature',
                        code: 'INVALID_SIGNATURE',
                        id: '5d504554-1a7e-4a7b-9fcf-88b17365f92e',
                    }));
                    return;
                }
            }

            // Pass through the webhook data
            body.type = webhookData.type;
            body.data = webhookData.data;

            logger.info('Successfully processed Mux webhook');
        } catch (err) {
            logger.error(`Error processing Mux webhook: ${err.message}`);
            reply(400, new ApiError({
                message: 'Invalid webhook payload: ' + err.message,
                code: 'INVALID_PAYLOAD',
                id: '5d504554-1a7e-4a7b-9fcf-88b17365f92e',
            }));
            return;
        }
    }

    // Authentication
    authenticate(ctx.headers.authorization, ctx.method === 'GET' ? null : body['i']).then(([user, app]) => {
        // Log API request with sanitized parameters
        const sanitizedParams = sanitizeParams(body);
        const clientIp = getClientIp(ctx);
        apiLogger.info(`${endpoint.name} called`, {
            endpoint: endpoint.name,
            ip: clientIp,
            directIp: ctx.ip,
            userId: user?.id || null,
            params: sanitizedParams,
        });

        // API invoking
        call(endpoint.name, user, app, body, ctx).then((res: any) => {
            if (ctx.method === 'GET' && endpoint.meta.cacheSec && !body['i'] && !user) {
                ctx.set('Cache-Control', `public, max-age=${endpoint.meta.cacheSec}`);
            }
            reply(res);
        }).catch((e: ApiError) => {
            reply(e.httpStatusCode ? e.httpStatusCode : e.kind === 'client' ? 400 : 500, e);
        });

        // Log IP
        if (user) {
            fetchMeta().then(meta => {
                if (!meta.enableIpLogging) return;
                const ip = getClientIp(ctx);
                const ips = userIpHistories.get(user.id);
                if (ips == null || !ips.has(ip)) {
                    if (ips == null) {
                        userIpHistories.set(user.id, new Set([ip]));
                    } else {
                        ips.add(ip);
                    }
                    try {
                        UserIps.createQueryBuilder().insert().values({
                            createdAt: new Date(),
                            userId: user.id,
                            ip: ip,
                        }).orIgnore(true).execute();
                    } catch {
                        // Do nothing
                    }
                }
            });
        }
    }).catch((e: Error) => {
        // Authentication failed
        logger.error(`Authentication failed for endpoint ${endpoint.name}: ${e.message}`);

        // Use 401 for authentication failures (RFC 7235)
        ctx.response.status = 401;

        // Add WWW-Authenticate header for 401 responses, but NOT for OAuth token endpoint
        // RFC 6749 Section 5.2: Token endpoint errors should not include WWW-Authenticate header
        if (endpoint.name !== 'oauth/token') {
            ctx.response.set('WWW-Authenticate', 'Bearer');
        }

        // Format response based on endpoint type
        if (endpoint.meta.tags?.includes('oauth')) {
            // OAuth 2.0 error format
            ctx.response.body = {
                error: 'invalid_token',
                error_description: 'The access token provided is expired, revoked, malformed, or invalid for other reasons.',
            };
        } else {
            // Standard API error format
            ctx.response.body = {
                error: {
                    message: 'Authentication failed: ' + e.message,
                    code: 'AUTHENTICATION_FAILED',
                    id: 'b0a7f5f8-dc2f-4171-b91f-de88ad238e14',
                    kind: 'client',
                },
            };
        }
        res();
    });
});