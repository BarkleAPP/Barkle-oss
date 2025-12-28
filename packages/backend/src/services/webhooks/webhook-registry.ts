import { fetchMeta } from '@/misc/fetch-meta.js';
import Logger from '@/services/logger.js';
import {
	WebhookCoreService,
	WebhookProviderConfig,
	WebhookProvider,
	WebhookError,
	WebhookConfigError,
} from './webhook-core.js';

const logger = new Logger('webhook-registry');

/**
 * Webhook Provider Registry
 * Centralizes configuration and management of all webhook providers
 */
export class WebhookRegistry {
	private static providers: Map<WebhookProvider, WebhookProviderConfig> = new Map();
	private static initialized = false;

	/**
	 * Initialize the registry with configurations from instance meta
	 */
	public static async initialize(): Promise<void> {
		if (this.initialized) {
			return;
		}

		const meta = await fetchMeta();

		// Register Stripe webhook provider
		if (meta.stripe_key && meta.stripe_webhook_secret) {
			this.registerProvider({
				name: 'stripe',
				signatureHeader: 'stripe-signature',
				signatureAlgorithm: 'stripe-v1',
				secretKey: meta.stripe_webhook_secret,
				enabled: true,
				timestampTolerance: 300, // 5 minutes
			});
		}

		// Register Mux webhook provider
		if (meta.mux_token_id && meta.mux_webhook_secret) {
			this.registerProvider({
				name: 'mux',
				signatureHeader: 'mux-signature',
				signatureAlgorithm: 'mux-v1',
				secretKey: meta.mux_webhook_secret,
				enabled: true,
				timestampTolerance: 300, // 5 minutes
			});
		}

		// Register RevenueCat webhook provider
		if (meta.enableRevenueCat && meta.revenueCatWebhookSecret) {
			this.registerProvider({
				name: 'revenuecat',
				signatureHeader: 'x-revenuecat-signature',
				signatureAlgorithm: 'hmac-sha256',
				secretKey: meta.revenueCatWebhookSecret,
				enabled: true,
			});
		}

		this.initialized = true;
		logger.info(`📋 REGISTRY: Initialized ${this.providers.size} webhook providers`);
	}

	/**
	 * Register a webhook provider
	 */
	public static registerProvider(config: WebhookProviderConfig): void {
		this.providers.set(config.name, config);
		logger.info(`📋 REGISTRY: Registered webhook provider: ${config.name}`);
	}

	/**
	 * Get provider configuration
	 */
	public static getProvider(name: WebhookProvider): WebhookProviderConfig | null {
		return this.providers.get(name) || null;
	}

	/**
	 * Check if a provider is configured and enabled
	 */
	public static isProviderEnabled(name: WebhookProvider): boolean {
		const config = this.providers.get(name);
		return config?.enabled ?? false;
	}

	/**
	 * Get all enabled providers
	 */
	public static getEnabledProviders(): WebhookProvider[] {
		const enabled: WebhookProvider[] = [];
		for (const [name, config] of this.providers) {
			if (config.enabled) {
				enabled.push(name);
			}
		}
		return enabled;
	}

	/**
	 * Verify signature for a specific provider
	 */
	public static verifySignature(
		provider: WebhookProvider,
		payload: string,
		signature: string
	): boolean {
		const config = this.providers.get(provider);

		if (!config) {
			throw new WebhookConfigError(provider, `Provider ${provider} not registered`);
		}

		if (!config.enabled) {
			throw new WebhookConfigError(provider, `Provider ${provider} is not enabled`);
		}

		if (!config.secretKey) {
			throw new WebhookConfigError(provider, `No secret key configured for ${provider}`);
		}

		return WebhookCoreService.verifySignature(
			payload,
			signature,
			config.secretKey,
			config.signatureAlgorithm,
			config.timestampTolerance
		);
	}

	/**
	 * Get signature header name for a provider
	 */
	public static getSignatureHeader(provider: WebhookProvider): string | null {
		const config = this.providers.get(provider);
		return config?.signatureHeader || null;
	}

	/**
	 * Get provider info for status reporting
	 */
	public static getProviderStatus(): Record<WebhookProvider, { enabled: boolean; hasSecret: boolean }> {
		const status: Record<string, { enabled: boolean; hasSecret: boolean }> = {};

		for (const [name, config] of this.providers) {
			status[name] = {
				enabled: config.enabled,
				hasSecret: !!config.secretKey,
			};
		}

		return status as Record<WebhookProvider, { enabled: boolean; hasSecret: boolean }>;
	}

	/**
	 * Refresh provider configurations from meta
	 * Call this after meta settings are updated
	 */
	public static async refresh(): Promise<void> {
		this.initialized = false;
		this.providers.clear();
		await this.initialize();
		logger.info('📋 REGISTRY: Refreshed webhook provider configurations');
	}
}

export default WebhookRegistry;
