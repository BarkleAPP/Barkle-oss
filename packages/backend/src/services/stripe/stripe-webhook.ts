import Stripe from 'stripe';
import { StripeEvents, Users, GiftedSubscriptions } from '@/models/index.js';
import Logger from '@/services/logger.js';
import { StripeCoreService, StripeConfigError } from './stripe-core.js';
import { StripeCustomerService } from './stripe-customer.js';
import { StripeSubscriptionService } from './stripe-subscription.js';
import { createNotification } from '@/services/create-notification.js';

const logger = new Logger('stripe-webhook');

/**
 * Stripe Webhook Service
 * Handles incoming webhook events with idempotency and proper event processing
 * 
 * NOTE: For the main webhook endpoint (stripe/webhook), signature verification
 * is handled by api-handler.ts middleware BEFORE the endpoint is called.
 * The middleware:
 * - Extracts 'stripe-signature' header
 * - Uses ctx.request.rawBody for verification  
 * - Calls stripe.webhooks.constructEvent()
 * - Only passes verified event to the endpoint
 * 
 * The verifyAndParseWebhook method below is kept for:
 * - Alternative webhook endpoints that bypass the middleware
 * - Testing and debugging scenarios
 * - External service integrations
 */
export class StripeWebhookService {
	/**
	 * Verify and parse webhook payload
	 * 
	 * NOTE: For the main webhook endpoint, this is handled by api-handler.ts
	 * This method is available for alternative use cases.
	 */
	public static async verifyAndParseWebhook(
		rawBody: string,
		signature: string
	): Promise<Stripe.Event> {
		const config = await StripeCoreService.getConfig();

		if (!config.webhookSecret) {
			throw new StripeConfigError('Stripe webhook secret is not configured');
		}

		const stripe = await StripeCoreService.getClient();

		try {
			const event = stripe.webhooks.constructEvent(
				rawBody,
				signature,
				config.webhookSecret
			);
			return event;
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Unknown error';
			logger.error(`❌ WEBHOOK: Invalid signature: ${errorMessage}`);
			throw new WebhookVerificationError(`Invalid webhook signature: ${errorMessage}`);
		}
	}

	/**
	 * Check if event has already been processed (idempotency)
	 */
	public static async isEventProcessed(eventId: string): Promise<boolean> {
		const existingEvent = await StripeEvents.findOne({ where: { id: eventId } });
		return !!existingEvent;
	}

	/**
	 * Mark event as processed
	 */
	public static async markEventProcessed(
		event: Stripe.Event,
		userId: string | null = null
	): Promise<void> {
		await StripeEvents.save({
			id: event.id,
			type: event.type,
			processedAt: new Date(),
			eventData: event.data.object as Record<string, unknown>,
			userId,
		});
	}

	/**
	 * Process a webhook event
	 */
	public static async processEvent(event: Stripe.Event): Promise<WebhookResult> {
		// Check for duplicate processing
		if (await this.isEventProcessed(event.id)) {
			logger.info(`🔄 WEBHOOK: Event ${event.id} already processed, skipping`);
			return { success: true, duplicate: true };
		}

		logger.info(`📥 WEBHOOK: Processing event ${event.type} (${event.id})`);

		let userId: string | null = null;

		try {
			// Handle the event based on type
			switch (event.type) {
				// Subscription events
				case 'customer.subscription.created':
					userId = await this.handleSubscriptionCreated(event.data.object as Stripe.Subscription);
					break;

				case 'customer.subscription.updated':
					userId = await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
					break;

				case 'customer.subscription.deleted':
					userId = await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
					break;

				// Invoice events
				case 'invoice.payment_succeeded':
					userId = await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
					break;

				case 'invoice.payment_failed':
					userId = await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
					break;

				case 'invoice.upcoming':
					userId = await this.handleUpcomingInvoice(event.data.object as Stripe.Invoice);
					break;

				// Checkout events
				case 'checkout.session.completed':
					userId = await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
					break;

				case 'checkout.session.expired':
					userId = await this.handleCheckoutExpired(event.data.object as Stripe.Checkout.Session);
					break;

				// Customer events
				case 'customer.updated':
					userId = await this.handleCustomerUpdated(event.data.object as Stripe.Customer);
					break;

				case 'customer.deleted':
					userId = await this.handleCustomerDeleted(event.data.object as Stripe.Customer);
					break;

				// Payment method events
				case 'payment_method.attached':
				case 'payment_method.detached':
					// Log but don't process
					logger.info(`📋 WEBHOOK: Payment method event ${event.type}`);
					break;

				default:
					logger.info(`📋 WEBHOOK: Unhandled event type ${event.type}`);
			}

			// Mark event as processed
			await this.markEventProcessed(event, userId);

			logger.info(`✅ WEBHOOK: Successfully processed ${event.type}`);
			return { success: true, userId };
		} catch (error) {
			logger.error(`❌ WEBHOOK: Error processing ${event.type}: ${error}`);

			// Re-check if event was successfully processed by another concurrent request
			// This prevents overwriting a successful record with an error
			const alreadyProcessed = await this.isEventProcessed(event.id);
			if (alreadyProcessed) {
				// Another process handled it - check if it was successful
				const existingEvent = await StripeEvents.findOne({ where: { id: event.id } });
				if (existingEvent && !existingEvent.eventData?.processingError) {
					logger.info(`⚠️ WEBHOOK: Event ${event.id} was successfully processed by another request`);
					return { success: false, error: String(error), duplicate: true };
				}
			}

			// Mark as processed with error status to prevent infinite retries
			try {
				await StripeEvents.save({
					id: event.id,
					type: event.type,
					processedAt: new Date(),
					eventData: {
						...event.data.object as Record<string, unknown>,
						processingError: String(error),
						processingErrorAt: new Date().toISOString(),
					},
					userId,
				});
			} catch (saveError) {
				logger.error(`❌ WEBHOOK: Failed to save error event: ${saveError}`);
				// Don't throw - we still want to return the error result
			}

			return { success: false, error: String(error) };
		}
	}

	/**
	 * Handle subscription created
	 */
	private static async handleSubscriptionCreated(
		subscription: Stripe.Subscription
	): Promise<string | null> {
		const result = await StripeSubscriptionService.handleSubscriptionCreated(subscription);
		return result.userId || null;
	}

	/**
	 * Handle subscription updated
	 */
	private static async handleSubscriptionUpdated(
		subscription: Stripe.Subscription
	): Promise<string | null> {
		const result = await StripeSubscriptionService.handleSubscriptionUpdated(subscription);
		return result.userId || null;
	}

	/**
	 * Handle subscription deleted
	 */
	private static async handleSubscriptionDeleted(
		subscription: Stripe.Subscription
	): Promise<string | null> {
		const result = await StripeSubscriptionService.handleSubscriptionDeleted(subscription);
		return result.userId || null;
	}

	/**
	 * Handle payment succeeded
	 */
	private static async handlePaymentSucceeded(
		invoice: Stripe.Invoice
	): Promise<string | null> {
		const customerId = invoice.customer as string;

		if (!invoice.subscription) {
			logger.info(`📋 WEBHOOK: Payment succeeded but no subscription (one-time payment)`);
			return null;
		}

		const user = await StripeCustomerService.findUserByCustomerId(customerId);
		if (!user) {
			logger.warn(`⚠️ WEBHOOK: No user found for customer ${customerId} on payment success`);
			return null;
		}

		const stripe = await StripeCoreService.getClient();
		const subscriptionData = await stripe.subscriptions.retrieve(invoice.subscription as string);
		const subscriptionEndDate = new Date(subscriptionData.current_period_end * 1000);

		// Validate the end date is reasonable
		const now = new Date();
		const maxFutureDate = new Date();
		maxFutureDate.setFullYear(maxFutureDate.getFullYear() + 2);

		if (subscriptionEndDate <= now) {
			logger.error(`❌ WEBHOOK: Subscription end date is in the past for user ${user.id}`);
			return user.id;
		}

		if (subscriptionEndDate > maxFutureDate) {
			logger.error(`❌ WEBHOOK: Subscription end date too far in future for user ${user.id}`);
			return user.id;
		}

		await Users.update({ id: user.id }, {
			subscriptionEndDate: subscriptionEndDate,
		});

		logger.info(`✅ WEBHOOK: Updated subscription end date for user ${user.id} to ${subscriptionEndDate.toISOString()}`);
		return user.id;
	}

	/**
	 * Handle payment failed
	 */
	private static async handlePaymentFailed(
		invoice: Stripe.Invoice
	): Promise<string | null> {
		const customerId = invoice.customer as string;

		const user = await StripeCustomerService.findUserByCustomerId(customerId);
		if (!user) {
			logger.warn(`⚠️ WEBHOOK: No user found for customer ${customerId} on payment failure`);
			return null;
		}

		logger.warn(`⚠️ WEBHOOK: Payment failed for user ${user.id}`);

		// Send notification to user
		try {
			await createNotification(user.id, 'app', {
				customHeader: '⚠️ Payment Failed',
				customBody: 'Your subscription payment failed. Please update your payment method to avoid service interruption.',
				customIcon: '💳',
			});
			logger.info(`✅ WEBHOOK: Sent payment failure notification to user ${user.id}`);
		} catch (notifError) {
			logger.error(`❌ WEBHOOK: Failed to send notification: ${notifError}`);
		}

		return user.id;
	}

	/**
	 * Handle upcoming invoice (sent ~72 hours before payment)
	 */
	private static async handleUpcomingInvoice(
		invoice: Stripe.Invoice
	): Promise<string | null> {
		const customerId = invoice.customer as string;

		const user = await StripeCustomerService.findUserByCustomerId(customerId);
		if (!user) {
			return null;
		}

		// Optionally notify user about upcoming payment
		logger.info(`📋 WEBHOOK: Upcoming invoice for user ${user.id}`);
		return user.id;
	}

	/**
	 * Handle checkout session completed
	 */
	private static async handleCheckoutCompleted(
		session: Stripe.Checkout.Session
	): Promise<string | null> {
		logger.info(`📥 WEBHOOK: Checkout completed - mode: ${session.mode}, status: ${session.payment_status}`);

		// Handle gift purchases
		if (
			session.metadata &&
			session.metadata.isGift === 'true' &&
			session.mode === 'payment' &&
			session.payment_status === 'paid'
		) {
			return this.handleGiftPurchase(session);
		}

		// Regular subscription checkout is handled by subscription.created event
		return null;
	}

	/**
	 * Handle gift purchase from checkout
	 */
	private static async handleGiftPurchase(
		session: Stripe.Checkout.Session
	): Promise<string | null> {
		const { metadata } = session;

		if (!metadata) {
			logger.error(`❌ WEBHOOK: No metadata in checkout session`);
			return null;
		}

		const plan = metadata.plan as 'plus' | 'mplus';
		const subscriptionType = metadata.subscriptionType as 'month' | 'year';
		const purchaserUserId = metadata.purchaserUserId;
		const giftMessage = metadata.giftMessage || null;

		if (!plan || !subscriptionType || !purchaserUserId) {
			logger.error(`❌ WEBHOOK: Missing gift metadata: ${JSON.stringify(metadata)}`);
			return null;
		}

		try {
			const gift = await GiftedSubscriptions.createGift({
				plan,
				subscriptionType,
				purchasedByUserId: purchaserUserId,
				stripeCheckoutSessionId: session.id,
				message: giftMessage || undefined,
			});

			if (!gift || !gift.token) {
				logger.error(`❌ WEBHOOK: Gift creation failed`);
				return purchaserUserId;
			}

			const config = await StripeCoreService.getConfig();
			const giftLink = `${config.instanceUrl}/gift/verify/${gift.token}`;

			logger.info(`✅ WEBHOOK: Gift created with token ${gift.token}`);
			logger.info(`🔗 WEBHOOK: Gift redemption link: ${giftLink}`);

			// Notify purchaser
			try {
				await createNotification(purchaserUserId, 'app', {
					customHeader: '🎁 Gift Purchase Successful!',
					customBody: `Your ${plan === 'plus' ? 'Barkle+' : 'Mini+'} gift is ready to share! Check your purchased gifts to get the link.`,
					customIcon: '🎁',
				});
			} catch (notifError) {
				logger.error(`❌ WEBHOOK: Failed to notify purchaser: ${notifError}`);
			}

			return purchaserUserId;
		} catch (error) {
			logger.error(`❌ WEBHOOK: Error creating gift: ${error}`);
			return purchaserUserId;
		}
	}

	/**
	 * Handle checkout session expired
	 */
	private static async handleCheckoutExpired(
		session: Stripe.Checkout.Session
	): Promise<string | null> {
		logger.info(`📋 WEBHOOK: Checkout session expired: ${session.id}`);
		
		// Could notify user or clean up any pending state
		return null;
	}

	/**
	 * Handle customer updated
	 */
	private static async handleCustomerUpdated(
		customer: Stripe.Customer
	): Promise<string | null> {
		const userId = customer.metadata.userId;
		if (!userId) {
			return null;
		}

		// Could sync customer data to user record if needed
		logger.info(`📋 WEBHOOK: Customer updated for user ${userId}`);
		return userId;
	}

	/**
	 * Handle customer deleted
	 */
	private static async handleCustomerDeleted(
		customer: Stripe.Customer
	): Promise<string | null> {
		const userId = customer.metadata.userId;
		if (!userId) {
			return null;
		}

		// Clear stripe_user from user record
		const user = await Users.findOneBy({ id: userId });
		if (user) {
			const currentCustomerId = StripeCustomerService.extractCustomerId(user.stripe_user);
			if (currentCustomerId === customer.id) {
				await Users.update({ id: userId }, {
					stripe_user: [],
				});
				logger.info(`✅ WEBHOOK: Cleared customer ID for user ${userId}`);
			}
		}

		return userId;
	}

	/**
	 * Get event history for debugging
	 */
	public static async getEventHistory(
		options: { limit?: number; userId?: string; type?: string } = {}
	): Promise<any[]> {
		const queryBuilder = StripeEvents.createQueryBuilder('event');

		if (options.userId) {
			queryBuilder.where('event.userId = :userId', { userId: options.userId });
		}

		if (options.type) {
			queryBuilder.andWhere('event.type LIKE :type', { type: `%${options.type}%` });
		}

		queryBuilder.orderBy('event.processedAt', 'DESC');
		queryBuilder.limit(options.limit || 50);

		return queryBuilder.getMany();
	}
}

/**
 * Webhook verification error
 */
export class WebhookVerificationError extends Error {
	public readonly code = 'INVALID_WEBHOOK_SIGNATURE';
	public readonly httpStatusCode = 400;

	constructor(message: string) {
		super(message);
		this.name = 'WebhookVerificationError';
	}
}

/**
 * Result of webhook processing
 */
export interface WebhookResult {
	success: boolean;
	duplicate?: boolean;
	userId?: string | null;
	error?: string;
}

export default StripeWebhookService;
