/**
 * Webhook Services Module
 * Centralized webhook handling for Barkle
 * 
 * Architecture:
 * - WebhookCoreService: Core utilities for signature verification and event processing
 * - WebhookRegistry: Provider configuration and management
 * - WebhookEventStore: Idempotent event storage and history
 * 
 * Supported Providers:
 * - Stripe: Payment and subscription webhooks
 * - Mux: Video streaming webhooks
 * - RevenueCat: iOS/Android in-app purchase webhooks
 * 
 * Usage:
 * ```typescript
 * import { WebhookService } from '@/services/webhooks/index.js';
 * 
 * // Initialize the registry (done once at startup)
 * await WebhookService.initialize();
 * 
 * // Verify a webhook signature
 * const isValid = WebhookService.verifySignature('stripe', payload, signature);
 * 
 * // Check if event was already processed
 * const processed = await WebhookService.isEventProcessed('stripe', eventId);
 * 
 * // Mark event as processed
 * await WebhookService.markEventProcessed('stripe', eventId, 'payment.succeeded', data);
 * ```
 */

// Core webhook service
export {
	WebhookCoreService,
	WebhookEvent,
	WebhookProvider,
	WebhookProviderConfig,
	SignatureAlgorithm,
	VerificationResult,
	ProcessingResult,
	WebhookHandler,
	WebhookError,
	SignatureVerificationError,
	WebhookConfigError,
} from './webhook-core.js';

// Provider registry
export { WebhookRegistry } from './webhook-registry.js';

// Event store
export { WebhookEventStore } from './webhook-event-store.js';

// Import for facade
import { WebhookCoreService, WebhookProvider } from './webhook-core.js';
import { WebhookRegistry } from './webhook-registry.js';
import { WebhookEventStore } from './webhook-event-store.js';

/**
 * Unified Webhook Service Facade
 * Provides a single entry point for common webhook operations
 */
export class WebhookService {
	// Core utilities
	static core = WebhookCoreService;

	// Provider registry
	static registry = WebhookRegistry;

	// Event store
	static events = WebhookEventStore;

	/**
	 * Initialize the webhook system
	 * Call this at application startup
	 */
	static async initialize(): Promise<void> {
		await WebhookRegistry.initialize();
	}

	/**
	 * Verify a webhook signature
	 */
	static verifySignature(
		provider: WebhookProvider,
		payload: string,
		signature: string
	): boolean {
		return WebhookRegistry.verifySignature(provider, payload, signature);
	}

	/**
	 * Check if an event has already been processed
	 */
	static async isEventProcessed(provider: string, eventId: string): Promise<boolean> {
		return WebhookEventStore.isEventProcessed(provider, eventId);
	}

	/**
	 * Mark an event as processed
	 */
	static async markEventProcessed(
		provider: string,
		eventId: string,
		eventType: string,
		data?: Record<string, unknown>,
		userId?: string | null
	): Promise<void> {
		return WebhookEventStore.markEventProcessed(provider, eventId, eventType, data, userId);
	}

	/**
	 * Get provider status for monitoring
	 */
	static getProviderStatus() {
		return WebhookRegistry.getProviderStatus();
	}

	/**
	 * Check if a provider is enabled
	 */
	static isProviderEnabled(provider: WebhookProvider): boolean {
		return WebhookRegistry.isProviderEnabled(provider);
	}

	/**
	 * Get signature header name for a provider
	 */
	static getSignatureHeader(provider: WebhookProvider): string | null {
		return WebhookRegistry.getSignatureHeader(provider);
	}

	/**
	 * Clean up old webhook events
	 */
	static async cleanupOldEvents(daysOld: number = 30): Promise<number> {
		return WebhookEventStore.cleanupOldEvents(daysOld);
	}

	/**
	 * Get webhook event statistics
	 */
	static async getStatistics(): Promise<Record<string, number>> {
		return WebhookEventStore.getEventStatistics();
	}

	/**
	 * Refresh provider configurations
	 */
	static async refreshProviders(): Promise<void> {
		return WebhookRegistry.refresh();
	}
}

export default WebhookService;
