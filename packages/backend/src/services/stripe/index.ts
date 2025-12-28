/**
 * Stripe Services Module
 * Centralized, modular Stripe integration for Barkle
 * 
 * Architecture:
 * - StripeCoreService: Stripe client management and configuration
 * - StripeCustomerService: Customer lifecycle and deduplication
 * - StripeSubscriptionService: Subscription management
 * - StripeWebhookService: Webhook event processing
 * - StripeCheckoutService: Checkout session creation
 */

export { StripeCoreService, StripeConfigError, StripeApiError, STRIPE_API_VERSION } from './stripe-core.js';
export type { StripeConfig } from './stripe-core.js';
export { StripeCustomerService } from './stripe-customer.js';
export type { CustomerOptions, CustomerResult, ValidationResult, MergeResult } from './stripe-customer.js';
export { StripeSubscriptionService } from './stripe-subscription.js';
export type { CancelOptions, CancelResult, PauseResult, ResumeResult, SyncResult, HandleResult, SubscriptionInfo } from './stripe-subscription.js';
export { StripeWebhookService, WebhookVerificationError } from './stripe-webhook.js';
export type { WebhookResult } from './stripe-webhook.js';
export { StripeCheckoutService } from './stripe-checkout.js';
export type { SubscriptionCheckoutOptions, GiftCheckoutOptions, CheckoutResult, PortalResult } from './stripe-checkout.js';

// Re-export main service classes for convenience
import { StripeCoreService } from './stripe-core.js';
import { StripeCustomerService } from './stripe-customer.js';
import { StripeSubscriptionService } from './stripe-subscription.js';
import { StripeWebhookService } from './stripe-webhook.js';
import { StripeCheckoutService } from './stripe-checkout.js';

/**
 * Unified Stripe Service Facade
 * Provides a single entry point for common Stripe operations
 */
export class StripeService {
	// Core operations
	static core = StripeCoreService;

	// Customer operations
	static customer = StripeCustomerService;

	// Subscription operations
	static subscription = StripeSubscriptionService;

	// Webhook operations
	static webhook = StripeWebhookService;

	// Checkout operations
	static checkout = StripeCheckoutService;

	/**
	 * Check if Stripe is properly configured
	 */
	static async isConfigured(): Promise<boolean> {
		return StripeCoreService.isConfigured();
	}

	/**
	 * Create a subscription checkout session
	 */
	static async createSubscriptionCheckout(
		userId: string,
		plan: 'plus' | 'mplus',
		subscriptionType: 'month' | 'year',
		promoCode?: string
	) {
		return StripeCheckoutService.createSubscriptionCheckout(userId, {
			plan,
			subscriptionType,
			promoCode,
		});
	}

	/**
	 * Create a gift checkout session
	 */
	static async createGiftCheckout(
		userId: string,
		plan: 'plus' | 'mplus',
		subscriptionType: 'month' | 'year',
		giftMessage?: string
	) {
		return StripeCheckoutService.createGiftCheckout(userId, {
			plan,
			subscriptionType,
			giftMessage,
		});
	}

	/**
	 * Create a billing portal session
	 */
	static async createPortalSession(userId: string, returnUrl?: string) {
		return StripeCheckoutService.createPortalSession(userId, returnUrl);
	}

	/**
	 * Cancel a user's subscription
	 */
	static async cancelSubscription(userId: string, immediately: boolean = false) {
		return StripeSubscriptionService.cancelSubscription(userId, { immediately });
	}

	/**
	 * Pause a user's subscription
	 */
	static async pauseSubscription(userId: string, reason?: string) {
		return StripeSubscriptionService.pauseSubscription(userId, reason);
	}

	/**
	 * Resume a paused subscription
	 */
	static async resumeSubscription(userId: string) {
		return StripeSubscriptionService.resumeSubscription(userId);
	}

	/**
	 * Sync subscription status from Stripe
	 */
	static async syncSubscription(userId: string) {
		return StripeSubscriptionService.syncSubscriptionStatus(userId);
	}

	/**
	 * Get subscription info for display
	 */
	static async getSubscriptionInfo(userId: string) {
		return StripeSubscriptionService.getSubscriptionInfo(userId);
	}

	/**
	 * Process a webhook event
	 */
	static async processWebhook(event: import('stripe').Stripe.Event) {
		return StripeWebhookService.processEvent(event);
	}

	/**
	 * Verify webhook signature
	 */
	static async verifyWebhook(rawBody: string, signature: string) {
		return StripeWebhookService.verifyAndParseWebhook(rawBody, signature);
	}

	/**
	 * Get or create a customer for a user
	 */
	static async getOrCreateCustomer(userId: string, email: string, planType?: string) {
		return StripeCustomerService.getOrCreateCustomer(userId, email, { planType });
	}

	/**
	 * Get customer for a user
	 */
	static async getCustomerForUser(userId: string) {
		return StripeCustomerService.getCustomerForUser(userId);
	}

	/**
	 * Find user by Stripe customer ID
	 */
	static async findUserByCustomerId(customerId: string) {
		return StripeCustomerService.findUserByCustomerId(customerId);
	}
}

export default StripeService;
