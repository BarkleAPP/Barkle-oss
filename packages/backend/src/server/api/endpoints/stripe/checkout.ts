import Logger from '@/services/logger.js';
import define from '../../define.js';
import { ApiError } from '../../error.js';
import { HOUR } from '@/const.js';
import {
    StripeCheckoutService,
    StripeConfigError,
    StripeApiError,
} from '@/services/stripe/index.js';

const logger = new Logger('stripe-checkout');

export const meta = {
    tags: ['account'],
    requireCredential: true,
    limit: {
        duration: HOUR,
        max: 30,
    },
    errors: {
        'STRIPE_NOT_CONFIGURED': {
            message: 'Stripe is not configured properly',
            code: 'STRIPE_NOT_CONFIGURED',
            id: 'c0c9f693-bed3-4543-88aa-5a87e7bee9c3',
        },
        'INVALID_SUBSCRIPTION_TYPE': {
            message: 'Invalid subscription type specified',
            code: 'INVALID_SUBSCRIPTION_TYPE',
            id: '8deb5f8f-c39d-4954-a373-a8df052b56e6',
        },
        'INVALID_STRIPE_SIGNATURE': {
            message: 'Invalid Stripe signature',
            code: 'INVALID_STRIPE_SIGNATURE',
            id: 'f5f3e871-6eb2-4b60-9891-c4b0c4dde544',
        },
        'EMAIL_REQUIRED': {
            message: 'Email is required for subscription',
            code: 'EMAIL_REQUIRED',
            id: 'a3729a13-5dd1-4bfa-8e57-059c140d9c24',
        },
        'INVALID_PLAN_OR_TYPE': {
            message: 'Invalid plan or subscription type specified for the operation.',
            code: 'INVALID_PLAN_OR_TYPE',
            id: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
        },
    },
    res: {
        type: 'object',
        properties: {
            url: {
                type: 'string',
            },
            sessionId: {
                type: 'string',
            },
        },
        required: ['url'],
    },
};

export const paramDef = {
    type: 'object',
    properties: {
        subscriptionType: { type: 'string', enum: ['month', 'year'], nullable: true },
        stripeSignature: { type: 'string', nullable: true },
        promoCode: { type: 'string', nullable: true },
        plan: { type: 'string', enum: ['plus', 'mplus'], nullable: true },
        isGift: { type: 'boolean', nullable: true, default: false },
        giftMessage: { type: 'string', nullable: true },
    },
} as const;

export default define(meta, paramDef, async (ps, user) => {
    // Validate required parameters
    if (!ps.plan || !ps.subscriptionType) {
        throw new ApiError(meta.errors.INVALID_PLAN_OR_TYPE, { 
            message: 'Plan and subscriptionType are required.' 
        });
    }

    // This endpoint should only handle checkout session creation, not webhooks
    if (ps.stripeSignature) {
        throw new ApiError(meta.errors.INVALID_STRIPE_SIGNATURE, {
            message: 'Webhook handling should use the webhook endpoint'
        });
    }

    logger.info(`📋 CHECKOUT: Creating ${ps.isGift ? 'gift' : 'subscription'} checkout for user ${user.id}`);
    logger.info(`📋 CHECKOUT: Plan=${ps.plan}, Type=${ps.subscriptionType}, Gift=${ps.isGift || false}`);

    try {
        if (ps.isGift) {
            // Create gift checkout session
            const result = await StripeCheckoutService.createGiftCheckout(
                user.id,
                {
                    plan: ps.plan as 'plus' | 'mplus',
                    subscriptionType: ps.subscriptionType as 'month' | 'year',
                    giftMessage: ps.giftMessage || undefined,
                }
            );

            logger.info(`✅ CHECKOUT: Created gift session ${result.sessionId} for user ${user.id}`);

            return {
                url: result.url,
                sessionId: result.sessionId,
            };
        } else {
            // Create subscription checkout session
            const result = await StripeCheckoutService.createSubscriptionCheckout(
                user.id,
                {
                    plan: ps.plan as 'plus' | 'mplus',
                    subscriptionType: ps.subscriptionType as 'month' | 'year',
                    promoCode: ps.promoCode || undefined,
                }
            );

            logger.info(`✅ CHECKOUT: Created subscription session ${result.sessionId} for user ${user.id}`);

            return {
                url: result.url,
                sessionId: result.sessionId,
            };
        }
    } catch (error: unknown) {
        logger.error(`❌ CHECKOUT: Error creating checkout: ${error}`);

        if (error instanceof StripeConfigError) {
            throw new ApiError(meta.errors.STRIPE_NOT_CONFIGURED);
        }

        if (error instanceof StripeApiError) {
            switch (error.code) {
                case 'EMAIL_REQUIRED':
                    throw new ApiError(meta.errors.EMAIL_REQUIRED);
                case 'INVALID_SUBSCRIPTION_TYPE':
                    throw new ApiError(meta.errors.INVALID_SUBSCRIPTION_TYPE);
                default:
                    throw new ApiError({
                        message: error.message,
                        code: error.code,
                        id: 'stripe-api-error-checkout',
                        httpStatusCode: error.httpStatusCode,
                    });
            }
        }

        throw new ApiError({
            message: 'Failed to create checkout session',
            code: 'CHECKOUT_FAILED',
            id: 'checkout-session-creation-failed',
            httpStatusCode: 500,
        });
    }
});
