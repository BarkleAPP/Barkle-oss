import Logger from '@/services/logger.js';
import define from '../../define.js';
import { ApiError } from '../../error.js';
import {
    StripeCheckoutService,
    StripeSubscriptionService,
    StripeConfigError,
    StripeApiError,
} from '@/services/stripe/index.js';

const logger = new Logger('stripe-manage');

export const meta = {
    tags: ['account'],
    requireCredential: true,
    errors: {
        'STRIPE_NOT_CONFIGURED': {
            message: 'Stripe is not configured properly',
            code: 'STRIPE_NOT_CONFIGURED',
            id: 'c0c9f693-bed3-4543-88aa-5a87e7bee9c3',
        },
        'NO_ACTIVE_SUBSCRIPTION': {
            message: 'No active subscription found',
            code: 'NO_ACTIVE_SUBSCRIPTION',
            id: 'd0e8f123-4567-89ab-cdef-123456789abc',
        },
        'INVALID_SUBSCRIPTION_ACTION': {
            message: 'Invalid subscription action specified',
            code: 'INVALID_SUBSCRIPTION_ACTION',
            id: 'e1f2g345-6789-0hij-klmn-opqrstuvwxyz',
        },
        'STRIPE_API_ERROR': {
            message: 'Error communicating with Stripe API',
            code: 'STRIPE_API_ERROR',
            id: 'f2g3h456-7890-1ijk-lmno-pqrstuvwxyz1',
        },
        'WRONG_PLATFORM': {
            message: 'Cannot manage subscription from different platform',
            code: 'WRONG_PLATFORM',
            id: 'k3l4m5n6-o7p8-9012-klmn-o12345678910',
        },
    },
};

export const paramDef = {
    type: 'object',
    properties: {
        action: { type: 'string', enum: ['view', 'cancel', 'portal', 'pause', 'resume', 'sync'], default: 'view' },
    },
} as const;

export default define(meta, paramDef, async (ps, user) => {
    // Check if user's subscription is managed by a different platform
    if (user.subscriptionPlatform && 
        user.subscriptionPlatform !== 'stripe' && 
        user.subscriptionPlatform !== 'credit') {
        throw new ApiError(meta.errors.WRONG_PLATFORM, {
            message: `Your subscription is managed through ${user.subscriptionPlatform === 'revenuecat' ? 'your mobile app' : 'another platform'}. Please manage your subscription there.`,
        });
    }

    logger.info(`📋 MANAGE: Processing ${ps.action} action for user ${user.id}`);

    try {
        switch (ps.action) {
            case 'view':
                return await handleView(user.id);

            case 'cancel':
                return await handleCancel(user.id);

            case 'portal':
                return await handlePortal(user.id);

            case 'pause':
                return await handlePause(user.id);

            case 'resume':
                return await handleResume(user.id);

            case 'sync':
                return await handleSync(user.id);

            default:
                throw new ApiError(meta.errors.INVALID_SUBSCRIPTION_ACTION);
        }
    } catch (error: unknown) {
        if (error instanceof ApiError) {
            throw error;
        }

        if (error instanceof StripeConfigError) {
            throw new ApiError(meta.errors.STRIPE_NOT_CONFIGURED);
        }

        if (error instanceof StripeApiError) {
            logger.error(`❌ MANAGE: Stripe API error: ${error.message}`);
            throw new ApiError(meta.errors.STRIPE_API_ERROR);
        }

        logger.error(`❌ MANAGE: Unexpected error: ${error}`);
        throw new ApiError({
            message: 'An unexpected error occurred',
            code: 'INTERNAL_ERROR',
            id: 'manage-internal-error',
            httpStatusCode: 500,
        });
    }
});

async function handleView(userId: string) {
    const subscriptionInfo = await StripeSubscriptionService.getSubscriptionInfo(userId);

    if (!subscriptionInfo) {
        return {
            hasSubscription: false,
            message: 'No active subscription found',
        };
    }

    return {
        hasSubscription: true,
        status: subscriptionInfo.status,
        plan: subscriptionInfo.priceNickname,
        currentPeriodEnd: subscriptionInfo.currentPeriodEnd.toISOString(),
        currentPeriodStart: subscriptionInfo.currentPeriodStart.toISOString(),
        cancelAtPeriodEnd: subscriptionInfo.cancelAtPeriodEnd,
        priceAmount: subscriptionInfo.priceAmount,
        priceCurrency: subscriptionInfo.priceCurrency,
    };
}

async function handleCancel(userId: string) {
    const result = await StripeSubscriptionService.cancelSubscription(userId, { immediately: false });

    if (!result.success) {
        throw new ApiError({
            message: result.error || 'Failed to cancel subscription',
            code: 'CANCEL_FAILED',
            id: 'subscription-cancel-failed',
            httpStatusCode: 400,
        });
    }

    return {
        success: true,
        message: 'Subscription will be cancelled at the end of the current billing period',
        subscriptionId: result.subscriptionId,
    };
}

async function handlePortal(userId: string) {
    const result = await StripeCheckoutService.createPortalSession(userId);

    return {
        url: result.url,
    };
}

async function handlePause(userId: string) {
    const result = await StripeSubscriptionService.pauseSubscription(userId, 'user_requested');

    if (!result.success) {
        throw new ApiError({
            message: result.error || 'Failed to pause subscription',
            code: 'PAUSE_FAILED',
            id: 'subscription-pause-failed',
            httpStatusCode: 400,
        });
    }

    return {
        success: true,
        message: 'Subscription billing has been paused',
        subscriptionId: result.subscriptionId,
    };
}

async function handleResume(userId: string) {
    const result = await StripeSubscriptionService.resumeSubscription(userId);

    if (!result.success) {
        throw new ApiError({
            message: result.error || 'Failed to resume subscription',
            code: 'RESUME_FAILED',
            id: 'subscription-resume-failed',
            httpStatusCode: 400,
        });
    }

    return {
        success: true,
        message: 'Subscription billing has been resumed',
        subscriptionId: result.subscriptionId,
        subscriptionEndDate: result.subscriptionEndDate?.toISOString(),
    };
}

async function handleSync(userId: string) {
    const result = await StripeSubscriptionService.syncSubscriptionStatus(userId);

    return {
        success: result.success,
        updated: result.updated,
        newStatus: result.newStatus,
        subscriptionEndDate: result.subscriptionEndDate?.toISOString(),
        message: result.updated 
            ? `Subscription status synced to ${result.newStatus}`
            : 'Subscription status is already up to date',
    };
}
