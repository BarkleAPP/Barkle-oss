import Stripe from 'stripe';
import { UserProfiles } from '@/models/index.js';
import Logger from '@/services/logger.js';
import { StripeCoreService, StripeApiError } from './stripe-core.js';
import { StripeCustomerService } from './stripe-customer.js';

const logger = new Logger('stripe-checkout');

/**
 * Stripe Checkout Service
 * Handles checkout session creation for subscriptions and one-time payments
 */
export class StripeCheckoutService {
	/**
	 * Create a checkout session for subscription
	 */
	public static async createSubscriptionCheckout(
		userId: string,
		options: SubscriptionCheckoutOptions
	): Promise<CheckoutResult> {
		const stripe = await StripeCoreService.getClient();
		const config = await StripeCoreService.getConfig();

		// Get price ID for the plan
		const priceId = await StripeCoreService.getPriceId(
			options.plan,
			options.subscriptionType,
			false // Not a gift
		);

		if (!priceId) {
			throw new StripeApiError(
				`No price configured for ${options.plan} ${options.subscriptionType}`,
				'INVALID_SUBSCRIPTION_TYPE',
				400
			);
		}

		// Get user's email
		const userProfile = await UserProfiles.findOneBy({ userId });
		if (!userProfile?.email) {
			throw new StripeApiError(
				'Email is required for subscription',
				'EMAIL_REQUIRED',
				400
			);
		}

		// Get or create customer
		const { customerId, customer } = await StripeCustomerService.getOrCreateCustomer(
			userId,
			userProfile.email,
			{ planType: options.plan }
		);

		// Create checkout session params
		const sessionParams: Stripe.Checkout.SessionCreateParams = {
			mode: 'subscription',
			payment_method_types: ['card'],
			line_items: [
				{
					price: priceId,
					quantity: 1,
				},
			],
			customer: customerId,
			allow_promotion_codes: true,
			success_url: `${config.instanceUrl}/stripe/success?plan=${options.plan}`,
			cancel_url: `${config.instanceUrl}/stripe/cancelled?plan=${options.plan}`,
			metadata: {
				userId,
				plan: options.plan,
				subscriptionType: options.subscriptionType,
			},
			subscription_data: {
				metadata: {
					userId,
					plan: options.plan,
					subscriptionType: options.subscriptionType,
				},
			},
		};

		// Add promo code if provided
		if (options.promoCode) {
			sessionParams.discounts = [
				{
					promotion_code: options.promoCode,
				},
			];
		}

		const session = await stripe.checkout.sessions.create(sessionParams);

		logger.info(`✅ CHECKOUT: Created subscription session ${session.id} for user ${userId}`);

		return {
			sessionId: session.id,
			url: session.url,
		};
	}

	/**
	 * Create a checkout session for gift purchase
	 */
	public static async createGiftCheckout(
		userId: string,
		options: GiftCheckoutOptions
	): Promise<CheckoutResult> {
		const stripe = await StripeCoreService.getClient();
		const config = await StripeCoreService.getConfig();

		// Get gift price ID
		let priceId = await StripeCoreService.getPriceId(
			options.plan,
			options.subscriptionType,
			true // Is a gift
		);

		// Fall back to regular prices if gift prices not configured
		if (!priceId) {
			logger.warn(`⚠️ CHECKOUT: Gift price not found, falling back to regular price`);
			priceId = await StripeCoreService.getPriceId(
				options.plan,
				options.subscriptionType,
				false
			);
		}

		if (!priceId) {
			throw new StripeApiError(
				`No price configured for ${options.plan} ${options.subscriptionType} gift`,
				'INVALID_SUBSCRIPTION_TYPE',
				400
			);
		}

		// Get user's email
		const userProfile = await UserProfiles.findOneBy({ userId });
		if (!userProfile?.email) {
			throw new StripeApiError(
				'Email is required for gift purchase',
				'EMAIL_REQUIRED',
				400
			);
		}

		// Get or create customer
		const { customerId } = await StripeCustomerService.getOrCreateCustomer(
			userId,
			userProfile.email,
			{ planType: options.plan }
		);

		// Create checkout session for one-time payment
		const sessionParams: Stripe.Checkout.SessionCreateParams = {
			mode: 'payment',
			payment_method_types: ['card'],
			line_items: [
				{
					price: priceId,
					quantity: 1,
				},
			],
			customer: customerId,
			success_url: `${config.instanceUrl}/stripe/success?session_id={CHECKOUT_SESSION_ID}&plan=${options.plan}&gift=true`,
			cancel_url: `${config.instanceUrl}/stripe/cancelled?plan=${options.plan}&gift=true`,
			metadata: {
				isGift: 'true',
				plan: options.plan,
				subscriptionType: options.subscriptionType,
				purchaserUserId: userId,
				giftMessage: options.giftMessage || '',
			},
		};

		const session = await stripe.checkout.sessions.create(sessionParams);

		logger.info(`✅ CHECKOUT: Created gift session ${session.id} for user ${userId}`);

		return {
			sessionId: session.id,
			url: session.url,
		};
	}

	/**
	 * Create a billing portal session for subscription management
	 */
	public static async createPortalSession(
		userId: string,
		returnUrl?: string
	): Promise<PortalResult> {
		const stripe = await StripeCoreService.getClient();
		const config = await StripeCoreService.getConfig();

		// Get user's customer ID
		const customer = await StripeCustomerService.getCustomerForUser(userId);
		if (!customer) {
			throw new StripeApiError(
				'No Stripe customer found for user',
				'NO_CUSTOMER',
				404
			);
		}

		const session = await stripe.billingPortal.sessions.create({
			customer: customer.id,
			return_url: returnUrl || `${config.instanceUrl}/settings/manage-plus`,
		});

		logger.info(`✅ CHECKOUT: Created portal session for user ${userId}`);

		return {
			url: session.url,
		};
	}

	/**
	 * Retrieve checkout session details
	 */
	public static async getCheckoutSession(
		sessionId: string
	): Promise<Stripe.Checkout.Session | null> {
		const stripe = await StripeCoreService.getClient();

		try {
			const session = await stripe.checkout.sessions.retrieve(sessionId, {
				expand: ['line_items', 'subscription', 'customer'],
			});
			return session;
		} catch (error) {
			logger.error(`❌ CHECKOUT: Failed to retrieve session ${sessionId}: ${error}`);
			return null;
		}
	}

	/**
	 * Expire a checkout session
	 */
	public static async expireCheckoutSession(sessionId: string): Promise<boolean> {
		const stripe = await StripeCoreService.getClient();

		try {
			await stripe.checkout.sessions.expire(sessionId);
			logger.info(`✅ CHECKOUT: Expired session ${sessionId}`);
			return true;
		} catch (error) {
			logger.error(`❌ CHECKOUT: Failed to expire session ${sessionId}: ${error}`);
			return false;
		}
	}
}

/**
 * Options for subscription checkout
 */
export interface SubscriptionCheckoutOptions {
	plan: 'plus' | 'mplus';
	subscriptionType: 'month' | 'year';
	promoCode?: string;
}

/**
 * Options for gift checkout
 */
export interface GiftCheckoutOptions {
	plan: 'plus' | 'mplus';
	subscriptionType: 'month' | 'year';
	giftMessage?: string;
}

/**
 * Result of checkout session creation
 */
export interface CheckoutResult {
	sessionId: string;
	url: string | null;
}

/**
 * Result of portal session creation
 */
export interface PortalResult {
	url: string;
}

export default StripeCheckoutService;
