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
// IP ban system disabled for now - uncomment when tables are stable
// import { isIpBanned } from '@/misc/security/ip-ban.js';
// import { logSecurityEvent } from '@/services/security-event.js';
// import { SecurityEventType } from '@/models/entities/security-event.js';

const logger = new Logger('webhook-middleware');

const userIpHistories = new Map<User['id'], Set<string>>();
setInterval(() => {
    userIpHistories.clear();
}, 1000 * 60 * 60);

export default (endpoint: IEndpoint, ctx: Koa.Context) => new Promise<void>(async (res) => {
    try {
        // IP ban check disabled for now
        // TODO: Re-enable when ip_ban table is stable
        /*
        const clientIp = ctx.ip;
        try {
            if (await isIpBanned(clientIp)) {
                logSecurityEvent(SecurityEventType.ACCESS_DENIED, {
                    ipAddress: clientIp,
                    userAgent: ctx.headers['user-agent'] || null,
                    details: {
                        reason: 'IP address is banned',
                        endpoint: endpoint.name,
                    },
                    severity: 'medium',
                }).catch(() => {});
    
                ctx.status = 403;
                ctx.body = {
                    error: {
                        message: 'Access denied',
                        code: 'IP_BANNED',
                        id: 'ip_banned',
                        kind: 'client',
                    },
                };
                res();
                return;
            }
        } catch (error) {
            console.error('IP ban check failed:', error);
        }
        */

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
                    // Log all errors for debugging
                    console.error(`API Error [${endpoint.name}]:`, {
                        message: y!.message,
                        code: y!.code,
                        id: y!.id,
                        kind: y!.kind,
                        info: y!.info,
                        stack: y!.stack,
                    });

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
            } catch (err: any) {
                logger.error(`Error processing Mux webhook: ${err?.message || err}`);
                reply(400, new ApiError({
                    message: 'Invalid webhook payload: ' + (err?.message || 'Unknown error'),
                    code: 'INVALID_PAYLOAD',
                    id: '5d504554-1a7e-4a7b-9fcf-88b17365f92e',
                }));
                return;
            }
        }

        // Authentication
        authenticate(ctx.headers.authorization, ctx.method === 'GET' ? null : body['i']).then(([user, app]) => {
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
                    const ip = ctx.ip;
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
        }).catch(e => {
            if (e instanceof AuthenticationError) {
                logger.warn('Authentication failed:', {
                    error: e.message,
                    hasAuthorization: !!ctx.headers.authorization,
                    endpoint: endpoint.name,
                    timestamp: new Date().toISOString()
                });

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
            } else {
                reply(500, new ApiError());
            }
        });
    } catch (err: any) {
        // Catch any unhandled errors in the handler
        console.error(`[API Handler Error] ${endpoint.name}:`, err);
        ctx.status = 500;
        ctx.body = {
            error: {
                message: 'Internal server error',
                code: 'INTERNAL_ERROR',
                id: '5d37dbcb-891e-41ca-a3d6-e690c97775ac',
                kind: 'server',
            },
        };
        res();
    }
});