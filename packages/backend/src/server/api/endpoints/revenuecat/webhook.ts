import crypto from 'crypto';
import { fetchMeta } from '@/misc/fetch-meta.js';
import { Users } from '@/models/index.js';
import { SubscriptionManagerComprehensive } from '@/services/subscription-manager-comprehensive.js';
import Logger from '@/services/logger.js';
import define from '../../define.js';
import { ApiError } from '../../error.js';

const logger = new Logger('revenuecat-webhook');

export const meta = {
    tags: ['webhook'],
    requireCredential: false,
    secure: false,
    errors: {
        'REVENUECAT_NOT_CONFIGURED': {
            message: 'RevenueCat is not configured',
            code: 'REVENUECAT_NOT_CONFIGURED',
            id: 'rc1a2b3c-d4e5-6789-0abc-def123456789',
        },
        'INVALID_SIGNATURE': {
            message: 'Invalid webhook signature',
            code: 'INVALID_SIGNATURE',
            id: 'rc2b3c4d-e5f6-7890-1bcd-ef0234567890',
        },
    },
} as const;

export const paramDef = {
    type: 'object',
    properties: {
        event: {
            type: 'object',
            properties: {
                type: { type: 'string' },
                app_user_id: { type: 'string' },
                product_id: { type: 'string' },
                period_type: { type: 'string' },
                purchased_at_ms: { type: 'number' },
                expiration_at_ms: { type: 'number', nullable: true },
                entitlement_ids: { type: 'array', items: { type: 'string' } },
                store: { type: 'string' },
                environment: { type: 'string' },
            },
            required: ['type', 'app_user_id'],
        },
    },
    required: ['event'],
} as const;

/**
 * RevenueCat Webhook Handler
 * Handles subscription lifecycle events from RevenueCat for iOS and Android purchases
 */
export default define(meta, paramDef, async (ps, _user, _token, ctx) => {
    try {
        const instance = await fetchMeta();

        if (!instance.enableRevenueCat || !instance.revenueCatWebhookSecret) {
            throw new ApiError(meta.errors.REVENUECAT_NOT_CONFIGURED);
        }

        // Verify webhook signature
        const signature = ctx?.headers?.['x-revenuecat-signature'];
        if (signature && instance.revenueCatWebhookSecret) {
            const isValid = verifyWebhookSignature(
                JSON.stringify(ps),
                signature as string,
                instance.revenueCatWebhookSecret
            );

            if (!isValid) {
                logger.error('Invalid RevenueCat webhook signature');
                throw new ApiError(meta.errors.INVALID_SIGNATURE);
            }
        }

        logger.info('Received RevenueCat webhook:', { type: ps.event.type, userId: ps.event.app_user_id });

        // Handle the event
        await handleRevenueCatEvent(ps.event);

        return { success: true };

    } catch (error: any) {
        logger.error(`RevenueCat webhook error: ${error.message}`);

        if (error instanceof ApiError) {
            throw error;
        }

        throw new ApiError({
            message: 'Failed to process RevenueCat webhook',
            code: 'WEBHOOK_PROCESSING_ERROR',
            id: 'rc3c4d5e-f6g7-8901-2cde-f01345678901',
            httpStatusCode: 500,
        });
    }
});

/**
 * Verify webhook signature using HMAC SHA256
 */
function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    try {
        const hmac = crypto.createHmac('sha256', secret);
        hmac.update(payload);
        const calculatedSignature = hmac.digest('hex');

        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(calculatedSignature)
        );
    } catch (error) {
        logger.error('Error verifying webhook signature:', error);
        return false;
    }
}

/**
 * Handle RevenueCat event
 */
async function handleRevenueCatEvent(event: any): Promise<void> {
    const {
        type,
        app_user_id: revenueCatUserId,
        product_id: productId,
        expiration_at_ms: expirationMs,
        entitlement_ids: entitlementIds,
        store,
        environment,
    } = event;

    // Find user by RevenueCat user ID
    const user = await Users.findOneBy({ revenueCatUserId });

    if (!user) {
        logger.warn(`No user found with RevenueCat ID: ${revenueCatUserId}`);
        // This might be a new user - we'll handle this on first app launch
        return;
    }

    // Map product/entitlement to Barkle plan
    const plan = mapProductToPlan(productId, entitlementIds);

    logger.info(`Processing ${type} event for user ${user.id}, plan: ${plan}, store: ${store}, env: ${environment}`);

    switch (type) {
        case 'INITIAL_PURCHASE':
        case 'RENEWAL':
        case 'UNCANCELLATION':
            // Grant or renew subscription
            if (plan && expirationMs) {
                const expiryDate = new Date(expirationMs);
                await SubscriptionManagerComprehensive.grantPaidSubscription(
                    user.id,
                    plan,
                    expiryDate,
                    'revenuecat'
                );
                logger.info(`✅ Granted ${plan} subscription to user ${user.id} until ${expiryDate.toISOString()}`);
            }
            break;

        case 'CANCELLATION':
            // User cancelled - subscription remains active until expiry
            logger.info(`User ${user.id} cancelled subscription, will expire at scheduled time`);
            // No action needed - subscription will naturally expire
            break;

        case 'EXPIRATION':
            // Subscription expired
            logger.info(`Subscription expired for user ${user.id}`);
            await SubscriptionManagerComprehensive.handleSubscriptionExpiration(user.id);
            break;

        case 'BILLING_ISSUE':
            // Payment failed - subscription might enter grace period
            logger.warn(`Billing issue for user ${user.id}`);
            // RevenueCat handles grace period - we'll get EXPIRATION if it fully fails
            break;

        case 'PRODUCT_CHANGE':
            // User changed subscription tier
            if (plan && expirationMs) {
                const expiryDate = new Date(expirationMs);
                await SubscriptionManagerComprehensive.grantPaidSubscription(
                    user.id,
                    plan,
                    expiryDate,
                    'revenuecat'
                );
                logger.info(`✅ Updated subscription to ${plan} for user ${user.id}`);
            }
            break;

        case 'NON_RENEWING_PURCHASE':
            // One-time purchase (not applicable for subscriptions)
            logger.info(`Non-renewing purchase for user ${user.id} - ignoring`);
            break;

        case 'TRANSFER':
            // Subscription transferred between users
            logger.info(`Subscription transferred for RevenueCat ID ${revenueCatUserId}`);
            // Handle transfer if needed
            break;

        default:
            logger.warn(`Unknown RevenueCat event type: ${type}`);
    }
}

/**
 * Map RevenueCat product ID or entitlement to Barkle plan
 */
function mapProductToPlan(productId: string, entitlementIds?: string[]): 'plus' | 'mplus' | null {
    // Check entitlements first (recommended approach)
    if (entitlementIds) {
        if (entitlementIds.includes('barkle_plus') || entitlementIds.includes('plus')) {
            return 'plus';
        }
        if (entitlementIds.includes('mini_plus') || entitlementIds.includes('mplus')) {
            return 'mplus';
        }
    }

    // Fallback to product ID mapping
    const productLower = productId?.toLowerCase() || '';

    // Barkle+ patterns
    if (productLower.includes('plus') && !productLower.includes('mini')) {
        return 'plus';
    }

    // Mini+ patterns
    if (productLower.includes('mini') || productLower.includes('mplus')) {
        return 'mplus';
    }

    logger.warn(`Could not map product ${productId} or entitlements ${entitlementIds} to Barkle plan`);
    return null;
}
