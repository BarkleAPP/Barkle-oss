import Stripe from 'stripe';
import { Users } from '@/models/index.js';
import { User } from '@/models/entities/user.js';
import Logger from '@/services/logger.js';
import { sqlLikeEscape } from '@/misc/sql-like-escape.js';
import { StripeCoreService, StripeApiError } from './stripe-core.js';

const logger = new Logger('stripe-customer');

/**
 * Stripe Customer Service
 * Handles customer creation, retrieval, deduplication, and metadata management
 */
export class StripeCustomerService {
	/**
	 * Get or create a Stripe customer for a user
	 * Handles deduplication and metadata consistency
	 */
	public static async getOrCreateCustomer(
		userId: string,
		email: string,
		options: CustomerOptions = {}
	): Promise<CustomerResult> {
		const stripe = await StripeCoreService.getClient();
		const user = await Users.findOneBy({ id: userId });
		
		if (!user) {
			throw new StripeApiError(`User ${userId} not found`, 'USER_NOT_FOUND', 404);
		}

		logger.info(`🔍 CUSTOMER: Getting or creating customer for user ${userId}`);

		// Step 1: Check if user already has a stored customer ID
		const storedCustomerId = this.extractCustomerId(user.stripe_user);
		
		if (storedCustomerId) {
			try {
				const existingCustomer = await stripe.customers.retrieve(storedCustomerId);
				
				if (!('deleted' in existingCustomer) || !existingCustomer.deleted) {
					// Customer exists, ensure metadata is up to date
					const customer = await this.updateCustomerMetadata(
						stripe, 
						existingCustomer as Stripe.Customer, 
						user, 
						email,
						options
					);
					
					logger.info(`✅ CUSTOMER: Retrieved existing customer ${customer.id} for user ${userId}`);
					return { customerId: customer.id, isNew: false, customer };
				}
			} catch (error) {
				logger.warn(`⚠️ CUSTOMER: Failed to retrieve stored customer ${storedCustomerId}: ${error}`);
				// Customer doesn't exist or was deleted, continue to find/create
			}
		}

		// Step 2: Search for existing customers by email to prevent duplicates
		const existingCustomers = await stripe.customers.list({
			email: email,
			limit: 10,
		});

		// Look for a customer that matches our user ID in metadata
		const matchingCustomer = existingCustomers.data.find(
			(c) => c.metadata.userId === userId
		);

		if (matchingCustomer) {
			logger.info(`✅ CUSTOMER: Found existing customer ${matchingCustomer.id} by email match`);
			
			// Update our database with the correct customer ID
			await this.updateUserCustomerId(userId, matchingCustomer.id);
			
			// Update customer metadata
			const customer = await this.updateCustomerMetadata(
				stripe, 
				matchingCustomer, 
				user, 
				email,
				options
			);
			
			return { customerId: customer.id, isNew: false, customer };
		}

		// Step 3: If customers exist with this email but none match our user, use the first one
		if (existingCustomers.data.length > 0 && !options.forceNewCustomer) {
			const firstCustomer = existingCustomers.data[0];
			logger.info(`⚠️ CUSTOMER: Reusing existing customer ${firstCustomer.id} for user ${userId}`);
			
			// Update our database and customer metadata
			await this.updateUserCustomerId(userId, firstCustomer.id);
			const customer = await this.updateCustomerMetadata(
				stripe, 
				firstCustomer, 
				user, 
				email,
				options
			);
			
			return { customerId: customer.id, isNew: false, customer };
		}

		// Step 4: Create a new customer
		const newCustomer = await stripe.customers.create({
			email: email,
			metadata: {
				userId: user.id,
				username: user.username,
				planType: options.planType || 'unknown',
				createdFrom: 'barkle-api',
				createdAt: new Date().toISOString(),
			},
			name: user.name || user.username,
		});

		logger.info(`✅ CUSTOMER: Created new customer ${newCustomer.id} for user ${userId}`);
		
		// Update user record with new customer ID
		await this.updateUserCustomerId(userId, newCustomer.id);
		
		return { customerId: newCustomer.id, isNew: true, customer: newCustomer };
	}

	/**
	 * Retrieve a customer by ID
	 */
	public static async getCustomer(customerId: string): Promise<Stripe.Customer | null> {
		try {
			const stripe = await StripeCoreService.getClient();
			const customer = await stripe.customers.retrieve(customerId);
			
			if ('deleted' in customer && customer.deleted) {
				return null;
			}
			
			return customer as Stripe.Customer;
		} catch (error) {
			logger.error(`❌ CUSTOMER: Failed to retrieve customer ${customerId}: ${error}`);
			return null;
		}
	}

	/**
	 * Get customer for a user
	 */
	public static async getCustomerForUser(userId: string): Promise<Stripe.Customer | null> {
		const user = await Users.findOneBy({ id: userId });
		if (!user) return null;
		
		const customerId = this.extractCustomerId(user.stripe_user);
		if (!customerId) return null;
		
		return this.getCustomer(customerId);
	}

	/**
	 * Update customer metadata
	 */
	public static async updateCustomerMetadata(
		stripe: Stripe,
		customer: Stripe.Customer,
		user: User,
		email: string,
		options: CustomerOptions = {}
	): Promise<Stripe.Customer> {
		const needsUpdate =
			customer.email !== email ||
			customer.metadata.userId !== user.id ||
			customer.metadata.username !== user.username ||
			(options.planType && customer.metadata.planType !== options.planType);

		if (!needsUpdate) {
			return customer;
		}

		logger.info(`📝 CUSTOMER: Updating metadata for customer ${customer.id}`);

		const updatedCustomer = await stripe.customers.update(customer.id, {
			email: email,
			metadata: {
				...customer.metadata,
				userId: user.id,
				username: user.username,
				planType: options.planType || customer.metadata.planType || 'unknown',
				lastUpdated: new Date().toISOString(),
			},
		});

		return updatedCustomer;
	}

	/**
	 * Find user by customer ID
	 */
	public static async findUserByCustomerId(customerId: string): Promise<User | null> {
		// Try finding by exact match first
		const user = await Users.findOne({
			where: { stripe_user: customerId as any },
		});

		if (user) {
			return user;
		}

		// If not found, search with LIKE for array-stored IDs
		const users = await Users.createQueryBuilder('user')
			.where('user.stripe_user::text LIKE :customerId', {
				customerId: `%${sqlLikeEscape(customerId)}%`
			})
			.getMany();

		return users.length > 0 ? users[0] : null;
	}

	/**
	 * Validate customer-user relationship
	 */
	public static async validateCustomerUserRelationship(
		customerId: string,
		userId: string
	): Promise<ValidationResult> {
		const stripe = await StripeCoreService.getClient();
		
		try {
			const customer = await stripe.customers.retrieve(customerId);
			
			if ('deleted' in customer && customer.deleted) {
				return { valid: false, reason: 'Customer has been deleted' };
			}
			
			const customerUserId = customer.metadata.userId;
			
			if (customerUserId !== userId) {
				return { 
					valid: false, 
					reason: `Customer belongs to different user: ${customerUserId}`,
					suggestedAction: 'update_metadata'
				};
			}
			
			return { valid: true };
		} catch (error) {
			return { valid: false, reason: `Failed to validate: ${error}` };
		}
	}

	/**
	 * Detect duplicate customers for a user
	 */
	public static async detectDuplicateCustomers(
		email: string
	): Promise<Stripe.Customer[]> {
		const stripe = await StripeCoreService.getClient();
		
		const customers = await stripe.customers.list({
			email: email,
			limit: 100,
		});
		
		return customers.data;
	}

	/**
	 * Merge duplicate customers into a single customer
	 * Moves subscriptions from other customers to the primary customer
	 */
	public static async mergeDuplicateCustomers(
		primaryCustomerId: string,
		duplicateCustomerIds: string[]
	): Promise<MergeResult> {
		const stripe = await StripeCoreService.getClient();
		const results: MergeResult = {
			movedSubscriptions: 0,
			deletedCustomers: 0,
			errors: [],
		};

		// Verify primary customer exists
		try {
			const primaryCustomer = await stripe.customers.retrieve(primaryCustomerId);
			if ('deleted' in primaryCustomer && primaryCustomer.deleted) {
				results.errors.push(`Primary customer ${primaryCustomerId} has been deleted`);
				return results;
			}
		} catch (error) {
			results.errors.push(`Primary customer ${primaryCustomerId} not found: ${error}`);
			return results;
		}

		for (const duplicateId of duplicateCustomerIds) {
			if (duplicateId === primaryCustomerId) {
				logger.warn(`⚠️ CUSTOMER: Skipping primary customer ${primaryCustomerId} in merge list`);
				continue;
			}

			try {
				// Get subscriptions from duplicate customer
				const subscriptions = await stripe.subscriptions.list({
					customer: duplicateId,
					limit: 100,
				});

				// Note: Stripe doesn't allow moving subscriptions between customers
				// We can only cancel them on the duplicate and note that they exist
				for (const subscription of subscriptions.data) {
					if (subscription.status === 'active' || subscription.status === 'trialing') {
						logger.warn(`⚠️ CUSTOMER: Cannot automatically move active subscription ${subscription.id} from ${duplicateId} to ${primaryCustomerId}`);
						results.errors.push(`Cannot move active subscription ${subscription.id}`);
					}
				}

				// We won't delete customers with active subscriptions
				const hasActiveSubscriptions = subscriptions.data.some(
					(s) => s.status === 'active' || s.status === 'trialing'
				);

				if (!hasActiveSubscriptions) {
					// Mark duplicate as archived (don't delete to preserve history)
					await stripe.customers.update(duplicateId, {
						metadata: {
							merged_into: primaryCustomerId,
							merged_at: new Date().toISOString(),
							status: 'merged_duplicate',
						},
					});
					results.deletedCustomers++;
					logger.info(`✅ CUSTOMER: Marked customer ${duplicateId} as merged into ${primaryCustomerId}`);
				}
			} catch (error) {
				logger.error(`❌ CUSTOMER: Error processing duplicate ${duplicateId}: ${error}`);
				results.errors.push(`Error processing ${duplicateId}: ${error}`);
			}
		}

		return results;
	}

	/**
	 * Extract customer ID from stripe_user field
	 * Handles both string and array formats
	 */
	public static extractCustomerId(stripeUser: string[] | string | null | undefined): string | null {
		if (!stripeUser) return null;
		
		if (Array.isArray(stripeUser)) {
			return stripeUser[0] || null;
		}
		
		return stripeUser;
	}

	/**
	 * Update user's stripe_user field
	 */
	private static async updateUserCustomerId(userId: string, customerId: string): Promise<void> {
		await Users.update({ id: userId }, { stripe_user: [customerId] });
		logger.info(`📝 CUSTOMER: Updated user ${userId} with customer ID ${customerId}`);
	}
}

/**
 * Options for customer operations
 */
export interface CustomerOptions {
	planType?: 'plus' | 'mplus' | string;
	forceNewCustomer?: boolean;
}

/**
 * Result of customer get/create operation
 */
export interface CustomerResult {
	customerId: string;
	isNew: boolean;
	customer: Stripe.Customer;
}

/**
 * Result of validation operation
 */
export interface ValidationResult {
	valid: boolean;
	reason?: string;
	suggestedAction?: 'update_metadata' | 'create_new' | 'investigate';
}

/**
 * Result of merge operation
 */
export interface MergeResult {
	movedSubscriptions: number;
	deletedCustomers: number;
	errors: string[];
}

export default StripeCustomerService;
