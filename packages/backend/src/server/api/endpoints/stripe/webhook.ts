import Stripe from 'stripe';
import Logger from '@/services/logger.js';
import define from '../../define.js';
import { ApiError } from '@/server/api/error.js';
import { StripeWebhookService } from '@/services/stripe/index.js';

const logger = new Logger('stripe-webhook');

export const meta = {
    tags: ['webhook'],
    requireCredential: false,
    secure: false,
} as const;

export const paramDef = {
    type: 'object',
    properties: {
        // The event is passed from api-handler.ts after signature verification
        // The api-handler.ts middleware handles:
        // 1. Extracting stripe-signature header
        // 2. Using ctx.request.rawBody for signature verification
        // 3. Verifying with Stripe SDK using webhook secret
        // 4. Passing verified event as body.event
        event: { 
            type: 'object',
            properties: {
                id: { type: 'string' },
                type: { type: 'string' },
                data: { type: 'object' },
            },
            required: ['id', 'type'],
        },
    },
    required: ['event'],
} as const;

/**
 * Stripe Webhook Endpoint
 * 
 * IMPORTANT: Signature verification is handled by api-handler.ts middleware
 * before this endpoint is called. The middleware:
 * - Extracts the 'stripe-signature' header
 * - Uses ctx.request.rawBody for verification
 * - Verifies using stripe.webhooks.constructEvent()
 * - Only passes the event here if signature is valid
 * 
 * This endpoint receives pre-verified events and processes them.
 */
export default define(meta, paramDef, async (ps) => {
    try {
        // The event is already verified by api-handler.ts middleware
        // which checks stripe-signature header against rawBody
        const event = ps.event as Stripe.Event;
        
        if (!event || !event.id || !event.type) {
            logger.error('❌ WEBHOOK: Received invalid or empty event');
            throw new ApiError({
                message: 'Invalid webhook event',
                code: 'INVALID_EVENT',
                id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                httpStatusCode: 400,
            });
        }
        
        logger.info(`📥 WEBHOOK: Processing verified event ${event.type} (${event.id})`);
        
        // Process the event using the webhook service
        const result = await StripeWebhookService.processEvent(event);
        
        if (result.duplicate) {
            logger.info(`🔄 WEBHOOK: Event ${event.id} was already processed`);
        } else if (result.success) {
            logger.info(`✅ WEBHOOK: Event ${event.type} processed successfully`);
        } else {
            logger.warn(`⚠️ WEBHOOK: Event ${event.type} processing had issues: ${result.error}`);
        }
        
        return { 
            received: true, 
            duplicate: result.duplicate || false,
            success: result.success
        };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`❌ WEBHOOK: Error processing webhook: ${errorMessage}`);
        
        if (error instanceof ApiError) {
            throw error;
        }
        
        throw new ApiError({
            message: 'Internal server error processing webhook',
            code: 'INTERNAL_SERVER_ERROR',
            id: '5d3f2d7a-8c8f-4b9c-9b6a-9b6a9b6a9b6a',
            httpStatusCode: 500,
        });
    }
});
