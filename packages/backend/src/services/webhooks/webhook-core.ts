import crypto from 'crypto';
import Logger from '@/services/logger.js';
import { ApiError } from '@/server/api/error.js';

const logger = new Logger('webhook-core');

/**
 * Webhook Provider Types
 * As Barkle grows, new webhook providers can be added here
 */
export type WebhookProvider = 'stripe' | 'mux' | 'revenuecat' | 'custom';

/**
 * Webhook signature verification algorithms
 */
export type SignatureAlgorithm = 'hmac-sha256' | 'stripe-v1' | 'mux-v1' | 'none';

/**
 * Base webhook event interface
 */
export interface WebhookEvent<T = unknown> {
	id: string;
	type: string;
	provider: WebhookProvider;
	timestamp: Date;
	data: T;
	signature?: string;
	verified: boolean;
}

/**
 * Webhook configuration for a provider
 */
export interface WebhookProviderConfig {
	name: WebhookProvider;
	signatureHeader: string;
	signatureAlgorithm: SignatureAlgorithm;
	secretKey: string | null;
	enabled: boolean;
	timestampTolerance?: number; // in seconds
}

/**
 * Result of webhook verification
 */
export interface VerificationResult {
	valid: boolean;
	error?: string;
	event?: WebhookEvent;
}

/**
 * Result of webhook processing
 */
export interface ProcessingResult {
	success: boolean;
	duplicate?: boolean;
	error?: string;
	userId?: string | null;
}

/**
 * Webhook handler function type
 */
export type WebhookHandler<T = unknown> = (event: WebhookEvent<T>) => Promise<ProcessingResult>;

/**
 * Core Webhook Service
 * Provides centralized webhook handling for all providers
 */
export class WebhookCoreService {
	private static handlers: Map<string, WebhookHandler[]> = new Map();

	/**
	 * Verify HMAC-SHA256 signature
	 */
	public static verifyHmacSha256(
		payload: string,
		signature: string,
		secret: string
	): boolean {
		try {
			const hmac = crypto.createHmac('sha256', secret);
			hmac.update(payload);
			const expectedSignature = hmac.digest('hex');

			// Use timing-safe comparison to prevent timing attacks
			return crypto.timingSafeEqual(
				Buffer.from(signature, 'hex'),
				Buffer.from(expectedSignature, 'hex')
			);
		} catch (error) {
			logger.error(`HMAC verification error: ${error}`);
			return false;
		}
	}

	/**
	 * Verify Stripe-style signature (timestamp + signature)
	 */
	public static verifyStripeSignature(
		payload: string,
		signatureHeader: string,
		secret: string,
		toleranceSeconds: number = 300
	): boolean {
		try {
			// Parse Stripe signature header: t=timestamp,v1=signature
			const elements = signatureHeader.split(',');
			let timestamp: number | null = null;
			let signature: string | null = null;

			for (const element of elements) {
				const [key, value] = element.split('=');
				if (key === 't') {
					timestamp = parseInt(value, 10);
				} else if (key === 'v1') {
					signature = value;
				}
			}

			if (!timestamp || !signature) {
				logger.error('Invalid Stripe signature format');
				return false;
			}

			// Check timestamp tolerance
			const now = Math.floor(Date.now() / 1000);
			if (Math.abs(now - timestamp) > toleranceSeconds) {
				logger.error('Stripe webhook timestamp outside tolerance');
				return false;
			}

			// Compute expected signature
			const signedPayload = `${timestamp}.${payload}`;
			const expectedSignature = crypto
				.createHmac('sha256', secret)
				.update(signedPayload)
				.digest('hex');

			return crypto.timingSafeEqual(
				Buffer.from(signature, 'hex'),
				Buffer.from(expectedSignature, 'hex')
			);
		} catch (error) {
			logger.error(`Stripe signature verification error: ${error}`);
			return false;
		}
	}

	/**
	 * Verify Mux-style signature (t=timestamp,v1=signature)
	 */
	public static verifyMuxSignature(
		payload: string,
		signatureHeader: string,
		secret: string,
		toleranceSeconds: number = 300
	): boolean {
		try {
			// Parse Mux signature header: t=timestamp,v1=signature
			const parts = signatureHeader.split(',');
			let timestamp: string | null = null;
			let signature: string | null = null;

			for (const part of parts) {
				const [key, value] = part.split('=');
				if (key === 't') {
					timestamp = value;
				} else if (key === 'v1') {
					signature = value;
				}
			}

			if (!timestamp || !signature) {
				logger.error('Invalid Mux signature format');
				return false;
			}

			// Check timestamp tolerance
			const timestampNum = parseInt(timestamp, 10);
			const now = Math.floor(Date.now() / 1000);
			if (Math.abs(now - timestampNum) > toleranceSeconds) {
				logger.error('Mux webhook timestamp outside tolerance');
				return false;
			}

			// Compute expected signature
			const signedPayload = `${timestamp}.${payload}`;
			const expectedSignature = crypto
				.createHmac('sha256', secret)
				.update(signedPayload)
				.digest('hex');

			return signature === expectedSignature;
		} catch (error) {
			logger.error(`Mux signature verification error: ${error}`);
			return false;
		}
	}

	/**
	 * Verify webhook signature based on algorithm
	 */
	public static verifySignature(
		payload: string,
		signature: string,
		secret: string,
		algorithm: SignatureAlgorithm,
		toleranceSeconds?: number
	): boolean {
		switch (algorithm) {
			case 'hmac-sha256':
				return this.verifyHmacSha256(payload, signature, secret);
			case 'stripe-v1':
				return this.verifyStripeSignature(payload, signature, secret, toleranceSeconds);
			case 'mux-v1':
				return this.verifyMuxSignature(payload, signature, secret, toleranceSeconds);
			case 'none':
				return true;
			default:
				logger.error(`Unknown signature algorithm: ${algorithm}`);
				return false;
		}
	}

	/**
	 * Register a webhook handler for a specific event type
	 */
	public static registerHandler(eventType: string, handler: WebhookHandler): void {
		const existingHandlers = this.handlers.get(eventType) || [];
		existingHandlers.push(handler);
		this.handlers.set(eventType, existingHandlers);
		logger.info(`📋 WEBHOOK: Registered handler for ${eventType}`);
	}

	/**
	 * Process a webhook event
	 */
	public static async processEvent(event: WebhookEvent): Promise<ProcessingResult> {
		const handlers = this.handlers.get(event.type) || [];

		if (handlers.length === 0) {
			logger.info(`📋 WEBHOOK: No handlers registered for ${event.type}`);
			return { success: true };
		}

		let lastResult: ProcessingResult = { success: true };

		for (const handler of handlers) {
			try {
				lastResult = await handler(event);
				if (!lastResult.success) {
					logger.error(`❌ WEBHOOK: Handler failed for ${event.type}: ${lastResult.error}`);
				}
			} catch (error) {
				logger.error(`❌ WEBHOOK: Handler threw for ${event.type}: ${error}`);
				lastResult = { success: false, error: String(error) };
			}
		}

		return lastResult;
	}

	/**
	 * Create a standardized webhook event
	 */
	public static createEvent<T>(
		provider: WebhookProvider,
		type: string,
		data: T,
		options?: {
			id?: string;
			timestamp?: Date;
			signature?: string;
			verified?: boolean;
		}
	): WebhookEvent<T> {
		return {
			id: options?.id || crypto.randomUUID(),
			type,
			provider,
			timestamp: options?.timestamp || new Date(),
			data,
			signature: options?.signature,
			verified: options?.verified ?? false,
		};
	}
}

/**
 * Custom error class for webhook errors
 */
export class WebhookError extends Error {
	public readonly code: string;
	public readonly httpStatusCode: number;
	public readonly provider?: WebhookProvider;

	constructor(
		message: string,
		code: string = 'WEBHOOK_ERROR',
		httpStatusCode: number = 500,
		provider?: WebhookProvider
	) {
		super(message);
		this.name = 'WebhookError';
		this.code = code;
		this.httpStatusCode = httpStatusCode;
		this.provider = provider;
	}

	/**
	 * Convert to ApiError for endpoint responses
	 */
	public toApiError(): ApiError {
		return new ApiError({
			message: this.message,
			code: this.code,
			id: `webhook-${this.provider || 'unknown'}-error`,
			httpStatusCode: this.httpStatusCode,
		});
	}
}

/**
 * Webhook signature verification error
 */
export class SignatureVerificationError extends WebhookError {
	constructor(provider: WebhookProvider, reason?: string) {
		super(
			reason || 'Invalid webhook signature',
			'INVALID_SIGNATURE',
			400,
			provider
		);
		this.name = 'SignatureVerificationError';
	}
}

/**
 * Webhook configuration error
 */
export class WebhookConfigError extends WebhookError {
	constructor(provider: WebhookProvider, reason?: string) {
		super(
			reason || `${provider} webhook is not configured properly`,
			`${provider.toUpperCase()}_MISCONFIGURED`,
			500,
			provider
		);
		this.name = 'WebhookConfigError';
	}
}

export default WebhookCoreService;
