import Stripe from 'stripe';
import { Users } from '@/models/index.js';
import { User } from '@/models/entities/user.js';
import Logger from '@/services/logger.js';
import { StripeCoreService, StripeApiError } from './stripe-core.js';
import { StripeCustomerService } from './stripe-customer.js';
import { SubscriptionStatus } from '@/types/subscription-status.enum.js';

const logger = new Logger('stripe-subscription');

/**
 * Stripe Subscription Service
 * Handles subscription lifecycle: creation, updates, cancellation, pause/resume
 */
export class StripeSubscriptionService {
	/**
	 * Get active subscription for a user
	 */
	public static async getActiveSubscription(userId: string): Promise<Stripe.Subscription | null> {
		const user = await Users.findOneBy({ id: userId });
		if (!user) {
			logger.warn(`User ${userId} not found`);
			return null;
		}

		const customerId = StripeCustomerService.extractCustomerId(user.stripe_user);
		if (!customerId) {
			logger.info(`No Stripe customer ID for user ${userId}`);
			return null;
		}

		return this.getActiveSubscriptionByCustomerId(customerId);
	}

	/**
	 * Get active subscription by customer ID
	 */
	public static async getActiveSubscriptionByCustomerId(
		customerId: string
	): Promise<Stripe.Subscription | null> {
		const stripe = await StripeCoreService.getClient();

		try {
			const subscriptions = await stripe.subscriptions.list({
				customer: customerId,
				status: 'active',
				limit: 1,
			});

			return subscriptions.data[0] || null;
		} catch (error) {
			logger.error(`❌ SUBSCRIPTION: Failed to get subscription for customer ${customerId}: ${error}`);
			return null;
		}
	}

	/**
	 * Get all subscriptions for a customer (including inactive)
	 */
	public static async getAllSubscriptions(
		customerId: string,
		status?: Stripe.Subscription.Status
	): Promise<Stripe.Subscription[]> {
		const stripe = await StripeCoreService.getClient();

		const params: Stripe.SubscriptionListParams = {
			customer: customerId,
			limit: 100,
		};

		if (status) {
			params.status = status;
		}

		const subscriptions = await stripe.subscriptions.list(params);
		return subscriptions.data;
	}

	/**
	 * Cancel a subscription
	 */
	public static async cancelSubscription(
		userId: string,
		options: CancelOptions = {}
	): Promise<CancelResult> {
		const stripe = await StripeCoreService.getClient();
		const user = await Users.findOneBy({ id: userId });

		if (!user) {
			return { success: false, error: 'User not found' };
		}

		const customerId = StripeCustomerService.extractCustomerId(user.stripe_user);
		if (!customerId) {
			return { success: false, error: 'No Stripe customer found' };
		}

		const subscription = await this.getActiveSubscriptionByCustomerId(customerId);
		if (!subscription) {
			return { success: false, error: 'No active subscription found' };
		}

		try {
			if (options.immediately) {
				// Cancel immediately
				await stripe.subscriptions.cancel(subscription.id);
				logger.info(`✅ SUBSCRIPTION: Immediately cancelled subscription ${subscription.id} for user ${userId}`);
			} else {
				// Cancel at period end
				await stripe.subscriptions.update(subscription.id, {
					cancel_at_period_end: true,
				});
				logger.info(`✅ SUBSCRIPTION: Scheduled cancellation for subscription ${subscription.id} at period end`);
			}

			// Update user status if cancelled immediately
			if (options.immediately) {
				await Users.update({ id: userId }, {
					isPlus: false,
					isMPlus: false,
					subscriptionStatus: SubscriptionStatus.FREE,
					subscriptionEndDate: new Date(),
				});
			}

			return { success: true, subscriptionId: subscription.id };
		} catch (error) {
			logger.error(`❌ SUBSCRIPTION: Failed to cancel subscription for user ${userId}: ${error}`);
			return { success: false, error: String(error) };
		}
	}

	/**
	 * Pause a subscription (billing pause)
	 */
	public static async pauseSubscription(
		userId: string,
		reason: string = 'user_requested'
	): Promise<PauseResult> {
		const stripe = await StripeCoreService.getClient();
		const user = await Users.findOneBy({ id: userId });

		if (!user) {
			return { success: false, error: 'User not found' };
		}

		const customerId = StripeCustomerService.extractCustomerId(user.stripe_user);
		if (!customerId) {
			return { success: false, error: 'No Stripe customer found' };
		}

		const subscription = await this.getActiveSubscriptionByCustomerId(customerId);
		if (!subscription) {
			return { success: false, error: 'No active subscription found' };
		}

		try {
			await stripe.subscriptions.update(subscription.id, {
				pause_collection: {
					behavior: 'mark_uncollectible',
				},
				metadata: {
					...subscription.metadata,
					pauseReason: reason,
					pausedAt: new Date().toISOString(),
					pausedByUserId: userId,
				},
			});

			// Store paused subscription ID in user record
			await Users.update({ id: userId }, {
				pausedSubscriptionId: subscription.id,
			});

			logger.info(`✅ SUBSCRIPTION: Paused subscription ${subscription.id} for user ${userId} - reason: ${reason}`);
			return { success: true, subscriptionId: subscription.id };
		} catch (error) {
			logger.error(`❌ SUBSCRIPTION: Failed to pause subscription for user ${userId}: ${error}`);
			return { success: false, error: String(error) };
		}
	}

	/**
	 * Resume a paused subscription
	 */
	public static async resumeSubscription(userId: string): Promise<ResumeResult> {
		const stripe = await StripeCoreService.getClient();
		const user = await Users.findOneBy({ id: userId });

		if (!user) {
			return { success: false, error: 'User not found' };
		}

		const subscriptionId = user.pausedSubscriptionId;
		if (!subscriptionId) {
			return { success: false, error: 'No paused subscription found' };
		}

		try {
			const subscription = await stripe.subscriptions.update(subscriptionId, {
				pause_collection: null, // Remove pause
				metadata: {
					resumedAt: new Date().toISOString(),
					resumedByUserId: userId,
				},
			});

			// Clear paused subscription ID
			await Users.update({ id: userId }, {
				pausedSubscriptionId: null,
			});

			logger.info(`✅ SUBSCRIPTION: Resumed subscription ${subscriptionId} for user ${userId}`);
			return { 
				success: true, 
				subscriptionId,
				subscriptionEndDate: new Date(subscription.current_period_end * 1000),
			};
		} catch (error) {
			logger.error(`❌ SUBSCRIPTION: Failed to resume subscription for user ${userId}: ${error}`);
			return { success: false, error: String(error) };
		}
	}

	/**
	 * Sync subscription status from Stripe to database
	 */
	public static async syncSubscriptionStatus(userId: string): Promise<SyncResult> {
		const user = await Users.findOneBy({ id: userId });
		if (!user) {
			return { success: false, error: 'User not found', updated: false };
		}

		const customerId = StripeCustomerService.extractCustomerId(user.stripe_user);
		if (!customerId) {
			// No Stripe customer, ensure user is on free tier
			if (user.subscriptionPlatform === 'stripe' && (user.isPlus || user.isMPlus)) {
				await Users.update({ id: userId }, {
					isPlus: false,
					isMPlus: false,
					subscriptionStatus: SubscriptionStatus.FREE,
					subscriptionEndDate: null,
				});
				return { success: true, updated: true, newStatus: SubscriptionStatus.FREE };
			}
			return { success: true, updated: false };
		}

		const subscription = await this.getActiveSubscriptionByCustomerId(customerId);
		
		if (!subscription) {
			// No active subscription, check if we need to downgrade
			if (user.subscriptionPlatform === 'stripe' && (user.isPlus || user.isMPlus)) {
				// Only downgrade if subscription end date has passed
				if (!user.subscriptionEndDate || user.subscriptionEndDate <= new Date()) {
					await Users.update({ id: userId }, {
						isPlus: false,
						isMPlus: false,
						subscriptionStatus: SubscriptionStatus.FREE,
						subscriptionEndDate: null,
					});
					logger.info(`✅ SUBSCRIPTION: Synced user ${userId} to FREE (no active subscription)`);
					return { success: true, updated: true, newStatus: SubscriptionStatus.FREE };
				}
			}
			return { success: true, updated: false };
		}

		// Active subscription found, update user status
		const customer = await StripeCustomerService.getCustomer(customerId);
		const planType = customer?.metadata.planType || 'plus';
		const endDate = new Date(subscription.current_period_end * 1000);

		const updateData: Partial<User> = {
			subscriptionEndDate: endDate,
			subscriptionPlatform: 'stripe',
		};

		if (planType === 'plus') {
			updateData.isPlus = true;
			updateData.isMPlus = false;
			updateData.subscriptionStatus = SubscriptionStatus.BARKLE_PLUS;
		} else if (planType === 'mplus') {
			updateData.isPlus = false;
			updateData.isMPlus = true;
			updateData.subscriptionStatus = SubscriptionStatus.MINI_PLUS;
		}

		await Users.update({ id: userId }, updateData);
		logger.info(`✅ SUBSCRIPTION: Synced user ${userId} to ${planType} until ${endDate.toISOString()}`);

		return { 
			success: true, 
			updated: true, 
			newStatus: updateData.subscriptionStatus,
			subscriptionEndDate: endDate,
		};
	}

	/**
	 * Handle subscription created event from webhook
	 */
	public static async handleSubscriptionCreated(
		subscription: Stripe.Subscription
	): Promise<HandleResult> {
		const customerId = subscription.customer as string;
		const user = await StripeCustomerService.findUserByCustomerId(customerId);

		if (!user) {
			logger.error(`❌ SUBSCRIPTION: No user found for customer ${customerId}`);
			return { success: false, error: 'User not found for customer' };
		}

		// Get customer to check plan type
		const customer = await StripeCustomerService.getCustomer(customerId);
		if (!customer) {
			logger.error(`❌ SUBSCRIPTION: Customer ${customerId} not found`);
			return { success: false, error: 'Customer not found' };
		}

		const planType = customer.metadata.planType || 'plus';
		const endDate = new Date(subscription.current_period_end * 1000);

		const updateData: Partial<User> = {
			subscriptionEndDate: endDate,
			subscriptionPlatform: 'stripe',
		};

		if (planType === 'plus') {
			updateData.isPlus = true;
			updateData.isMPlus = false;
			updateData.subscriptionStatus = SubscriptionStatus.BARKLE_PLUS;
		} else {
			updateData.isPlus = false;
			updateData.isMPlus = true;
			updateData.subscriptionStatus = SubscriptionStatus.MINI_PLUS;
		}

		await Users.update({ id: user.id }, updateData);
		logger.info(`✅ SUBSCRIPTION: Created subscription for user ${user.id}, plan: ${planType}`);

		return { success: true, userId: user.id };
	}

	/**
	 * Handle subscription updated event from webhook
	 */
	public static async handleSubscriptionUpdated(
		subscription: Stripe.Subscription
	): Promise<HandleResult> {
		const customerId = subscription.customer as string;
		const user = await StripeCustomerService.findUserByCustomerId(customerId);

		if (!user) {
			logger.warn(`⚠️ SUBSCRIPTION: No user found for customer ${customerId} on update`);
			return { success: false, error: 'User not found for customer' };
		}

		const endDate = new Date(subscription.current_period_end * 1000);

		// Handle different subscription statuses
		switch (subscription.status) {
			case 'active':
			case 'trialing':
				await Users.update({ id: user.id }, {
					subscriptionEndDate: endDate,
				});
				logger.info(`✅ SUBSCRIPTION: Updated subscription end date for user ${user.id} to ${endDate.toISOString()}`);
				break;

			case 'past_due':
				logger.warn(`⚠️ SUBSCRIPTION: Subscription ${subscription.id} is past_due for user ${user.id}`);
				// Don't immediately revoke access, just log for now
				break;

			case 'canceled':
			case 'unpaid':
				// Subscription has been cancelled or unpaid
				if (user.subscriptionPlatform === 'stripe') {
					await Users.update({ id: user.id }, {
						isPlus: false,
						isMPlus: false,
						subscriptionStatus: SubscriptionStatus.FREE,
						subscriptionEndDate: null,
					});
					logger.info(`✅ SUBSCRIPTION: Revoked access for user ${user.id} due to ${subscription.status}`);
				}
				break;

			default:
				logger.info(`📋 SUBSCRIPTION: Received status ${subscription.status} for subscription ${subscription.id}`);
		}

		return { success: true, userId: user.id };
	}

	/**
	 * Handle subscription deleted event from webhook
	 */
	public static async handleSubscriptionDeleted(
		subscription: Stripe.Subscription
	): Promise<HandleResult> {
		const customerId = subscription.customer as string;
		const user = await StripeCustomerService.findUserByCustomerId(customerId);

		if (!user) {
			logger.warn(`⚠️ SUBSCRIPTION: No user found for customer ${customerId} on deletion`);
			return { success: false, error: 'User not found for customer' };
		}

		// Only update if user's subscription was through Stripe
		if (user.subscriptionPlatform === 'stripe' || !user.subscriptionPlatform) {
			// Check if user has credits to fall back to
			const now = new Date();
			const hasPlusCredits = user.barklePlusCredits > 0 && 
				user.barklePlusCreditsExpiry && 
				user.barklePlusCreditsExpiry > now;
			const hasMiniCredits = user.miniPlusCredits > 0 && 
				user.miniPlusCreditsExpiry && 
				user.miniPlusCreditsExpiry > now;

			if (hasPlusCredits) {
				await Users.update({ id: user.id }, {
					isPlus: true,
					isMPlus: false,
					subscriptionStatus: SubscriptionStatus.BARKLE_PLUS_CREDIT,
					subscriptionEndDate: user.barklePlusCreditsExpiry,
					subscriptionPlatform: 'credit',
				});
				logger.info(`✅ SUBSCRIPTION: User ${user.id} fell back to Barkle+ credits`);
			} else if (hasMiniCredits) {
				await Users.update({ id: user.id }, {
					isPlus: false,
					isMPlus: true,
					subscriptionStatus: SubscriptionStatus.MINI_PLUS_CREDIT,
					subscriptionEndDate: user.miniPlusCreditsExpiry,
					subscriptionPlatform: 'credit',
				});
				logger.info(`✅ SUBSCRIPTION: User ${user.id} fell back to Mini+ credits`);
			} else {
				await Users.update({ id: user.id }, {
					isPlus: false,
					isMPlus: false,
					subscriptionStatus: SubscriptionStatus.FREE,
					subscriptionEndDate: null,
					subscriptionPlatform: null,
				});
				logger.info(`✅ SUBSCRIPTION: User ${user.id} reverted to FREE tier`);
			}
		}

		return { success: true, userId: user.id };
	}

	/**
	 * Get subscription info for display
	 */
	public static async getSubscriptionInfo(userId: string): Promise<SubscriptionInfo | null> {
		const user = await Users.findOneBy({ id: userId });
		if (!user) return null;

		const customerId = StripeCustomerService.extractCustomerId(user.stripe_user);
		if (!customerId) return null;

		const subscription = await this.getActiveSubscriptionByCustomerId(customerId);
		if (!subscription) return null;

		return {
			id: subscription.id,
			status: subscription.status,
			currentPeriodStart: new Date(subscription.current_period_start * 1000),
			currentPeriodEnd: new Date(subscription.current_period_end * 1000),
			cancelAtPeriodEnd: subscription.cancel_at_period_end,
			priceNickname: subscription.items.data[0]?.price?.nickname || null,
			priceAmount: subscription.items.data[0]?.price?.unit_amount || null,
			priceCurrency: subscription.items.data[0]?.price?.currency || null,
		};
	}
}

/**
 * Options for cancellation
 */
export interface CancelOptions {
	immediately?: boolean;
}

/**
 * Result of cancel operation
 */
export interface CancelResult {
	success: boolean;
	subscriptionId?: string;
	error?: string;
}

/**
 * Result of pause operation
 */
export interface PauseResult {
	success: boolean;
	subscriptionId?: string;
	error?: string;
}

/**
 * Result of resume operation
 */
export interface ResumeResult {
	success: boolean;
	subscriptionId?: string;
	subscriptionEndDate?: Date;
	error?: string;
}

/**
 * Result of sync operation
 */
export interface SyncResult {
	success: boolean;
	updated: boolean;
	newStatus?: SubscriptionStatus;
	subscriptionEndDate?: Date;
	error?: string;
}

/**
 * Result of webhook handle operation
 */
export interface HandleResult {
	success: boolean;
	userId?: string;
	error?: string;
}

/**
 * Subscription info for display
 */
export interface SubscriptionInfo {
	id: string;
	status: Stripe.Subscription.Status;
	currentPeriodStart: Date;
	currentPeriodEnd: Date;
	cancelAtPeriodEnd: boolean;
	priceNickname: string | null;
	priceAmount: number | null;
	priceCurrency: string | null;
}

export default StripeSubscriptionService;
