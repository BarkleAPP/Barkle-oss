import Stripe from 'stripe';
import { fetchMeta } from '@/misc/fetch-meta.js';
import Logger from '@/services/logger.js';

const logger = new Logger('stripe-core');

// Stripe API version to use across all services
export const STRIPE_API_VERSION = '2024-06-20' as const;

/**
 * Stripe Core Service
 * Provides centralized Stripe client management and configuration validation
 */
export class StripeCoreService {
	private static instance: Stripe | null = null;
	private static lastConfigCheck: Date | null = null;
	private static configCheckInterval = 5 * 60 * 1000; // 5 minutes

	/**
	 * Get a configured Stripe instance
	 * Caches the instance but periodically validates configuration
	 */
	public static async getClient(): Promise<Stripe> {
		const now = new Date();
		
		// Check if we need to refresh the configuration
		if (this.instance && this.lastConfigCheck) {
			const timeSinceCheck = now.getTime() - this.lastConfigCheck.getTime();
			if (timeSinceCheck < this.configCheckInterval) {
				return this.instance;
			}
		}

		const meta = await fetchMeta();
		
		if (!meta.stripe_key) {
			throw new StripeConfigError('Stripe API key is not configured');
		}

		this.instance = new Stripe(meta.stripe_key, {
			apiVersion: STRIPE_API_VERSION,
		});
		this.lastConfigCheck = now;

		return this.instance;
	}

	/**
	 * Get Stripe configuration from instance meta
	 */
	public static async getConfig(): Promise<StripeConfig> {
		const meta = await fetchMeta();

		return {
			stripeKey: meta.stripe_key,
			webhookSecret: meta.stripe_webhook_secret,
			instanceUrl: meta.url || 'https://barkle.chat',
			prices: {
				// Regular subscription prices
				monthPlus: meta.price_id_month,
				yearPlus: meta.price_id_year,
				monthMPlus: meta.price_id_month_mp,
				yearMPlus: meta.price_id_year_mp,
				// Gift prices
				giftMonthPlus: meta.price_id_gift_month_plus,
				giftYearPlus: meta.price_id_gift_year_plus,
				giftMonthMPlus: meta.price_id_gift_month_mplus,
				giftYearMPlus: meta.price_id_gift_year_mplus,
			},
		};
	}

	/**
	 * Validate that Stripe is properly configured
	 */
	public static async isConfigured(): Promise<boolean> {
		try {
			const config = await this.getConfig();
			return !!config.stripeKey && !!config.webhookSecret;
		} catch {
			return false;
		}
	}

	/**
	 * Get the price ID for a given plan and subscription type
	 */
	public static async getPriceId(
		plan: 'plus' | 'mplus',
		subscriptionType: 'month' | 'year',
		isGift: boolean = false
	): Promise<string | null> {
		const config = await this.getConfig();
		
		if (isGift) {
			if (plan === 'plus') {
				return subscriptionType === 'month' 
					? config.prices.giftMonthPlus 
					: config.prices.giftYearPlus;
			} else {
				return subscriptionType === 'month'
					? config.prices.giftMonthMPlus
					: config.prices.giftYearMPlus;
			}
		} else {
			if (plan === 'plus') {
				return subscriptionType === 'month'
					? config.prices.monthPlus
					: config.prices.yearPlus;
			} else {
				return subscriptionType === 'month'
					? config.prices.monthMPlus
					: config.prices.yearMPlus;
			}
		}
	}

	/**
	 * Reset the cached client (useful for testing or after config changes)
	 */
	public static resetClient(): void {
		this.instance = null;
		this.lastConfigCheck = null;
	}
}

/**
 * Stripe configuration interface
 */
export interface StripeConfig {
	stripeKey: string | null;
	webhookSecret: string | null;
	instanceUrl: string;
	prices: {
		monthPlus: string | null;
		yearPlus: string | null;
		monthMPlus: string | null;
		yearMPlus: string | null;
		giftMonthPlus: string | null;
		giftYearPlus: string | null;
		giftMonthMPlus: string | null;
		giftYearMPlus: string | null;
	};
}

/**
 * Custom error class for Stripe configuration issues
 */
export class StripeConfigError extends Error {
	public readonly code = 'STRIPE_NOT_CONFIGURED';
	public readonly httpStatusCode = 500;

	constructor(message: string) {
		super(message);
		this.name = 'StripeConfigError';
	}
}

/**
 * Custom error class for Stripe API errors
 */
export class StripeApiError extends Error {
	public readonly code: string;
	public readonly httpStatusCode: number;
	public readonly stripeError?: Stripe.StripeRawError;

	constructor(message: string, code: string = 'STRIPE_API_ERROR', httpStatusCode: number = 500, stripeError?: Stripe.StripeRawError) {
		super(message);
		this.name = 'StripeApiError';
		this.code = code;
		this.httpStatusCode = httpStatusCode;
		this.stripeError = stripeError;
	}
}

export default StripeCoreService;
