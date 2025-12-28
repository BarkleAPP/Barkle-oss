import { Users } from '@/models/index.js';
import { User } from '@/models/entities/user.js';
import { subscriptionQueue } from '@/queue/queues.js';
import Logger from '@/services/logger.js';
import { GiftedSubscriptionType } from '@/models/entities/gifted-subscription.js';
import { calculateSubscriptionEndDate } from '@/misc/date-utils.js';
import { SubscriptionStatus, SubscriptionStatusHelper } from '@/types/subscription-status.enum.js';
import { fetchMeta } from '@/misc/fetch-meta.js';
import Stripe from 'stripe';

const logger = new Logger('subscriptionManagerComprehensive');

/**
 * COMPREHENSIVE Subscription Manager
 * Handles complex billing/credit interactions with proper priority system:
 * 1. Paid subscriptions take priority over credits
 * 2. Credits are paused while on paid subscriptions
 * 3. Credits resume when paid subscriptions end
 * 4. Different credit types have different durations
 * 5. Credits stack properly
 */
export class SubscriptionManagerComprehensive {

  /**
   * Add credits to a user's account with proper stacking and duration
   */
  public static async addCredits(
    userId: string,
    plan: 'plus' | 'mplus',
    creditType: 'invitation' | 'gift',
    giftDuration?: GiftedSubscriptionType
  ): Promise<boolean> {
    try {
      const user = await Users.findOneBy({ id: userId });
      if (!user) {
        console.error(`❌ CREDIT ERROR: User ${userId} not found`);
        return false;
      }

      console.log(`🎁 CREDIT: Adding ${creditType} ${plan} credit to user ${userId}`);

      // Calculate credit duration based on type
      let creditDuration: number; // in days
      if (creditType === 'invitation') {
        creditDuration = 7; // 1 week for invitation rewards
      } else if (creditType === 'gift') {
        if (giftDuration === 'month') {
          creditDuration = 30; // 1 month for gifted monthly
        } else if (giftDuration === 'year') {
          creditDuration = 365; // 1 year for gifted yearly
        } else {
          creditDuration = 30; // default to month
        }
      } else {
        creditDuration = 7; // default fallback
      }

      const now = new Date();
      const creditEndDate = new Date();
      creditEndDate.setDate(creditEndDate.getDate() + creditDuration);

      // Determine which credit fields to update
      const updateData: Partial<User> = {};

      if (plan === 'plus') {
        const currentCredits = user.barklePlusCredits || 0;
        const currentExpiry = user.barklePlusCreditsExpiry;

        // Stack credits: add to existing count
        updateData.barklePlusCredits = currentCredits + 1;

        // Extend expiry: if existing credits, extend from the later date
        if (currentExpiry && currentExpiry > now) {
          // Extend from existing expiry date
          const extendedDate = new Date(currentExpiry);
          extendedDate.setDate(extendedDate.getDate() + creditDuration);
          updateData.barklePlusCreditsExpiry = extendedDate;
        } else {
          // No existing credits or expired, use new end date
          updateData.barklePlusCreditsExpiry = creditEndDate;
        }

        console.log(`🎁 CREDIT: Barkle+ credits ${currentCredits} -> ${updateData.barklePlusCredits}, expires: ${updateData.barklePlusCreditsExpiry.toISOString()}`);
      } else {
        const currentCredits = user.miniPlusCredits || 0;
        const currentExpiry = user.miniPlusCreditsExpiry;

        // Stack credits: add to existing count
        updateData.miniPlusCredits = currentCredits + 1;

        // Extend expiry: if existing credits, extend from the later date
        if (currentExpiry && currentExpiry > now) {
          // Extend from existing expiry date
          const extendedDate = new Date(currentExpiry);
          extendedDate.setDate(extendedDate.getDate() + creditDuration);
          updateData.miniPlusCreditsExpiry = extendedDate;
        } else {
          // No existing credits or expired, use new end date
          updateData.miniPlusCreditsExpiry = creditEndDate;
        }

        console.log(`🎁 CREDIT: Mini+ credits ${currentCredits} -> ${updateData.miniPlusCredits}, expires: ${updateData.miniPlusCreditsExpiry.toISOString()}`);
      }

      // Update the user
      await Users.update({ id: userId }, updateData);

      // Update subscription status based on new state
      await this.updateSubscriptionStatus(userId);

      console.log(`🎁 CREDIT SUCCESS: Added ${creditType} ${plan} credit to user ${userId}`);
      logger.info(`Added ${creditType} ${plan} credit to user ${userId}, duration: ${creditDuration} days`);

      return true;
    } catch (error) {
      console.error(`❌ CREDIT ERROR: Failed to add credits to user ${userId}:`, error);
      logger.error(`Failed to add credits to user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Grant paid subscription (supports all platforms: Stripe, Google Play, App Store)
   */
  public static async grantPaidSubscription(
    userId: string,
    plan: 'plus' | 'mplus',
    endDate: Date,
    platform: 'stripe' | 'google_play' | 'app_store' = 'stripe'
  ): Promise<boolean> {
    try {
      const user = await Users.findOneBy({ id: userId });
      if (!user) {
        console.error(`❌ SUBSCRIPTION ERROR: User ${userId} not found`);
        return false;
      }

      console.log(`💳 SUBSCRIPTION: Granting paid ${plan} to user ${userId} until ${endDate.toISOString()}`);

      // Check if user has active credits that should be paused
      const shouldPauseCredits = await this.shouldPauseCreditsForPaidSubscription(user, plan);

      const updateData: Partial<User> = {
        subscriptionEndDate: endDate,
        subscriptionPlatform: platform, // Track which platform the subscription is from
      };

      if (plan === 'plus') {
        updateData.isPlus = true;
        updateData.isMPlus = false; // Barkle+ overrides Mini+
        updateData.subscriptionStatus = SubscriptionStatus.BARKLE_PLUS;
      } else {
        updateData.isMPlus = true;
        // Don't downgrade from Barkle+ to Mini+ if user already has Barkle+
        if (!user.isPlus || (user.subscriptionEndDate && user.subscriptionEndDate <= new Date())) {
          updateData.isPlus = false;
          updateData.subscriptionStatus = SubscriptionStatus.MINI_PLUS;
        }
      }

      await Users.update({ id: userId }, updateData);

      console.log(`💳 SUBSCRIPTION SUCCESS: Granted paid ${plan} to user ${userId}`);
      logger.info(`Granted paid ${plan} subscription to user ${userId} until ${endDate.toISOString()}`);

      return true;
    } catch (error) {
      console.error(`❌ SUBSCRIPTION ERROR: Failed to grant paid subscription to user ${userId}:`, error);
      logger.error(`Failed to grant paid subscription to user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Update subscription status based on current user state
   * This is the core logic that determines priority: Paid > Credits > Free
   */
  public static async updateSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
    try {
      const user = await Users.findOneBy({ id: userId });
      if (!user) {
        console.error(`❌ STATUS ERROR: User ${userId} not found`);
        return SubscriptionStatus.FREE;
      }

      const now = new Date();
      let newStatus: SubscriptionStatus = SubscriptionStatus.FREE;

      // PRIORITY 1: Active paid subscriptions
      if (user.subscriptionEndDate && user.subscriptionEndDate > now) {
        if (user.isPlus) {
          newStatus = SubscriptionStatus.BARKLE_PLUS;
        } else if (user.isMPlus) {
          newStatus = SubscriptionStatus.MINI_PLUS;
        }

        console.log(`📊 STATUS: User ${userId} has active paid subscription: ${newStatus}`);
      }
      // PRIORITY 2: Active credits (only if no paid subscription)
      else {
        // Check Barkle+ credits first (higher tier)
        if (user.barklePlusCredits && user.barklePlusCredits > 0 &&
          user.barklePlusCreditsExpiry && user.barklePlusCreditsExpiry > now) {
          newStatus = SubscriptionStatus.BARKLE_PLUS_CREDIT;

          // Activate Barkle+ access
          await Users.update({ id: userId }, {
            isPlus: true,
            isMPlus: false,
            subscriptionEndDate: user.barklePlusCreditsExpiry
          });

          console.log(`📊 STATUS: User ${userId} using Barkle+ credits: ${user.barklePlusCredits} remaining`);
        }
        // Check Mini+ credits if no Barkle+ credits
        else if (user.miniPlusCredits && user.miniPlusCredits > 0 &&
          user.miniPlusCreditsExpiry && user.miniPlusCreditsExpiry > now) {
          newStatus = SubscriptionStatus.MINI_PLUS_CREDIT;

          // Activate Mini+ access
          await Users.update({ id: userId }, {
            isPlus: false,
            isMPlus: true,
            subscriptionEndDate: user.miniPlusCreditsExpiry
          });

          console.log(`📊 STATUS: User ${userId} using Mini+ credits: ${user.miniPlusCredits} remaining`);
        }
        // No active subscription or credits
        else {
          newStatus = SubscriptionStatus.FREE;

          // Remove subscription access
          await Users.update({ id: userId }, {
            isPlus: false,
            isMPlus: false,
            subscriptionEndDate: null
          });

          console.log(`📊 STATUS: User ${userId} reverted to FREE tier`);
        }
      }

      // Update status if changed
      if (user.subscriptionStatus !== newStatus) {
        await Users.update({ id: userId }, { subscriptionStatus: newStatus });
        console.log(`📊 STATUS: Updated user ${userId} status: ${user.subscriptionStatus} -> ${newStatus}`);
        logger.info(`Updated subscription status for user ${userId}: ${user.subscriptionStatus} -> ${newStatus}`);
      }

      return newStatus;
    } catch (error) {
      console.error(`❌ STATUS ERROR: Failed to update subscription status for user ${userId}:`, error);
      logger.error(`Failed to update subscription status for user ${userId}:`, error);
      return SubscriptionStatus.FREE;
    }
  }

  /**
   * Check if credits should be paused for paid subscription
   */
  private static async shouldPauseCreditsForPaidSubscription(user: User, plan: 'plus' | 'mplus'): Promise<boolean> {
    const now = new Date();

    if (plan === 'plus') {
      // Barkle+ subscription should pause both Barkle+ and Mini+ credits
      return (user.barklePlusCredits && user.barklePlusCredits > 0 &&
        user.barklePlusCreditsExpiry && user.barklePlusCreditsExpiry > now) ||
        (user.miniPlusCredits && user.miniPlusCredits > 0 &&
          user.miniPlusCreditsExpiry && user.miniPlusCreditsExpiry > now);
    } else {
      // Mini+ subscription should only pause Mini+ credits (Barkle+ credits take priority)
      return user.miniPlusCredits && user.miniPlusCredits > 0 &&
        user.miniPlusCreditsExpiry && user.miniPlusCreditsExpiry > now;
    }
  }

  /**
   * Handle subscription expiration and credit fallback
   */
  public static async handleSubscriptionExpiration(userId: string): Promise<void> {
    try {
      const user = await Users.findOneBy({ id: userId });
      if (!user) {
        console.error(`❌ EXPIRY ERROR: User ${userId} not found`);
        return;
      }

      const now = new Date();
      console.log(`⏰ EXPIRY: Handling expiration for user ${userId}`);

      // Check if paid subscription has expired
      if (user.subscriptionEndDate && user.subscriptionEndDate <= now) {
        console.log(`⏰ EXPIRY: Paid subscription expired for user ${userId}`);

        // Check for available credits to fall back to
        const hasBarklePlusCredits = user.barklePlusCredits && user.barklePlusCredits > 0 &&
          user.barklePlusCreditsExpiry && user.barklePlusCreditsExpiry > now;
        const hasMiniPlusCredits = user.miniPlusCredits && user.miniPlusCredits > 0 &&
          user.miniPlusCreditsExpiry && user.miniPlusCreditsExpiry > now;

        if (hasBarklePlusCredits) {
          console.log(`⏰ EXPIRY: Falling back to Barkle+ credits for user ${userId}`);
          // Use one Barkle+ credit
          await Users.update({ id: userId }, {
            barklePlusCredits: user.barklePlusCredits - 1,
            isPlus: true,
            isMPlus: false,
            subscriptionEndDate: user.barklePlusCreditsExpiry,
            subscriptionStatus: SubscriptionStatus.BARKLE_PLUS_CREDIT
          });
        } else if (hasMiniPlusCredits) {
          console.log(`⏰ EXPIRY: Falling back to Mini+ credits for user ${userId}`);
          // Use one Mini+ credit
          await Users.update({ id: userId }, {
            miniPlusCredits: user.miniPlusCredits - 1,
            isPlus: false,
            isMPlus: true,
            subscriptionEndDate: user.miniPlusCreditsExpiry,
            subscriptionStatus: SubscriptionStatus.MINI_PLUS_CREDIT
          });
        } else {
          console.log(`⏰ EXPIRY: No credits available, reverting to FREE for user ${userId}`);
          // No credits available, revert to free
          await Users.update({ id: userId }, {
            isPlus: false,
            isMPlus: false,
            subscriptionEndDate: null,
            subscriptionStatus: SubscriptionStatus.FREE
          });
        }
      }

      // Update status to reflect current state
      await this.updateSubscriptionStatus(userId);

      logger.info(`Handled subscription expiration for user ${userId}`);
    } catch (error) {
      console.error(`❌ EXPIRY ERROR: Failed to handle expiration for user ${userId}:`, error);
      logger.error(`Failed to handle subscription expiration for user ${userId}:`, error);
    }
  }

  /**
   * Clean up expired subscriptions and credits
   */
  public static async cleanupExpiredSubscriptions(): Promise<number> {
    try {
      console.log('🔧 CLEANUP: Starting comprehensive subscription cleanup');

      const now = new Date();
      let cleanedCount = 0;

      // Find users with expired paid subscriptions
      const usersWithExpiredSubscriptions = await Users.createQueryBuilder('user')
        .where('user.subscriptionEndDate < :now', { now })
        .andWhere('(user.isPlus = true OR user.isMPlus = true)')
        .getMany();

      console.log(`🔧 CLEANUP: Found ${usersWithExpiredSubscriptions.length} users with expired paid subscriptions`);

      for (const user of usersWithExpiredSubscriptions) {
        await this.handleSubscriptionExpiration(user.id);
        cleanedCount++;
      }

      // Find users with expired credits
      const usersWithExpiredCredits = await Users.createQueryBuilder('user')
        .where('(user.barklePlusCreditsExpiry < :now OR user.miniPlusCreditsExpiry < :now)', { now })
        .andWhere('(user.barklePlusCredits > 0 OR user.miniPlusCredits > 0)')
        .getMany();

      console.log(`🔧 CLEANUP: Found ${usersWithExpiredCredits.length} users with expired credits`);

      for (const user of usersWithExpiredCredits) {
        const updateData: Partial<User> = {};

        // Clear expired Barkle+ credits
        if (user.barklePlusCreditsExpiry && user.barklePlusCreditsExpiry < now) {
          updateData.barklePlusCredits = 0;
          updateData.barklePlusCreditsExpiry = null;
          console.log(`🔧 CLEANUP: Cleared expired Barkle+ credits for user ${user.id}`);
        }

        // Clear expired Mini+ credits
        if (user.miniPlusCreditsExpiry && user.miniPlusCreditsExpiry < now) {
          updateData.miniPlusCredits = 0;
          updateData.miniPlusCreditsExpiry = null;
          console.log(`🔧 CLEANUP: Cleared expired Mini+ credits for user ${user.id}`);
        }

        if (Object.keys(updateData).length > 0) {
          await Users.update({ id: user.id }, updateData);
          await this.updateSubscriptionStatus(user.id);
          cleanedCount++;
        }
      }

      console.log(`🔧 CLEANUP: Completed cleanup, processed ${cleanedCount} users`);
      logger.info(`Cleaned up ${cleanedCount} expired subscriptions and credits`);

      return cleanedCount;
    } catch (error) {
      console.error('❌ CLEANUP ERROR: Failed to cleanup expired subscriptions:', error);
      logger.error('Failed to cleanup expired subscriptions:', error);
      return 0;
    }
  }

  /**
   * Get comprehensive subscription status for a user
   */
  public static async getSubscriptionStatus(userId: string): Promise<{
    hasBarklePlus: boolean;
    hasMiniPlus: boolean;
    subscriptionStatus: SubscriptionStatus;
    subscriptionEndDate: Date | null;
    barklePlusCredits: number;
    miniPlusCredits: number;
    barklePlusCreditsExpiry: Date | null;
    miniPlusCreditsExpiry: Date | null;
    isPaidSubscription: boolean;
    isCreditSubscription: boolean;
  }> {
    try {
      const user = await Users.findOneBy({ id: userId });
      if (!user) {
        return {
          hasBarklePlus: false,
          hasMiniPlus: false,
          subscriptionStatus: SubscriptionStatus.FREE,
          subscriptionEndDate: null,
          barklePlusCredits: 0,
          miniPlusCredits: 0,
          barklePlusCreditsExpiry: null,
          miniPlusCreditsExpiry: null,
          isPaidSubscription: false,
          isCreditSubscription: false,
        };
      }

      const status = user.subscriptionStatus || SubscriptionStatus.FREE;

      return {
        hasBarklePlus: SubscriptionStatusHelper.hasBarklePlusAccess(status),
        hasMiniPlus: SubscriptionStatusHelper.hasMiniPlusAccess(status),
        subscriptionStatus: status,
        subscriptionEndDate: user.subscriptionEndDate,
        barklePlusCredits: user.barklePlusCredits || 0,
        miniPlusCredits: user.miniPlusCredits || 0,
        barklePlusCreditsExpiry: user.barklePlusCreditsExpiry,
        miniPlusCreditsExpiry: user.miniPlusCreditsExpiry,
        isPaidSubscription: SubscriptionStatusHelper.isPaidSubscription(status),
        isCreditSubscription: SubscriptionStatusHelper.isCreditSubscription(status),
      };
    } catch (error) {
      console.error(`❌ STATUS ERROR: Failed to get subscription status for user ${userId}:`, error);
      return {
        hasBarklePlus: false,
        hasMiniPlus: false,
        subscriptionStatus: SubscriptionStatus.FREE,
        subscriptionEndDate: null,
        barklePlusCredits: 0,
        miniPlusCredits: 0,
        barklePlusCreditsExpiry: null,
        miniPlusCreditsExpiry: null,
        isPaidSubscription: false,
        isCreditSubscription: false,
      };
    }
  }

  /**
   * CRITICAL FIX: Pause active Stripe subscription when user receives gift
   */
  public static async pauseStripeSubscription(
    userId: string,
    reason: string = 'gift_received'
  ): Promise<boolean> {
    try {
      const user = await Users.findOneBy({ id: userId });
      if (!user || !user.stripe_user) {
        console.log(`⚠️ STRIPE: No Stripe customer for user ${userId}, nothing to pause`);
        return false;
      }

      const instance = await fetchMeta();
      if (!instance.stripe_key) {
        console.error(`❌ STRIPE ERROR: Stripe not configured`);
        return false;
      }

      const stripe = new Stripe(instance.stripe_key, {
        apiVersion: '2024-06-20',
      });

      // Get user's Stripe customer ID
      const stripeCustomerId = Array.isArray(user.stripe_user)
        ? user.stripe_user[0]
        : user.stripe_user;

      // Find active subscriptions
      const subscriptions = await stripe.subscriptions.list({
        customer: stripeCustomerId,
        status: 'active',
        limit: 1,
      });

      if (subscriptions.data.length === 0) {
        console.log(`⚠️ STRIPE: No active subscriptions for user ${userId}`);
        return false;
      }

      const subscription = subscriptions.data[0];

      // CRITICAL FIX: Pause the subscription
      await stripe.subscriptions.update(subscription.id, {
        pause_collection: {
          behavior: 'mark_uncollectible',
        },
        metadata: {
          ...subscription.metadata,
          pauseReason: reason,
          pausedAt: new Date().toISOString(),
        },
      });

      // Store the paused subscription ID
      await Users.update({ id: userId }, {
        pausedSubscriptionId: subscription.id,
      });

      console.log(`✅ STRIPE: Paused subscription ${subscription.id} for user ${userId}`);
      logger.info(`Paused Stripe subscription ${subscription.id} for user ${userId} - reason: ${reason}`);

      return true;
    } catch (error) {
      console.error(`❌ STRIPE ERROR: Failed to pause subscription for user ${userId}:`, error);
      logger.error(`Failed to pause Stripe subscription for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * CRITICAL FIX: Resume paused Stripe subscription
   */
  public static async resumeStripeSubscription(
    userId: string,
    subscriptionId?: string
  ): Promise<boolean> {
    try {
      const user = await Users.findOneBy({ id: userId });
      if (!user) {
        console.error(`❌ STRIPE ERROR: User ${userId} not found`);
        return false;
      }

      const subId = subscriptionId || user.pausedSubscriptionId;
      if (!subId) {
        console.log(`⚠️ STRIPE: No paused subscription to resume for user ${userId}`);
        return false;
      }

      const instance = await fetchMeta();
      if (!instance.stripe_key) {
        console.error(`❌ STRIPE ERROR: Stripe not configured`);
        return false;
      }

      const stripe = new Stripe(instance.stripe_key, {
        apiVersion: '2024-06-20',
      });

      // Resume the subscription
      await stripe.subscriptions.update(subId, {
        pause_collection: null, // Remove pause
        metadata: {
          resumedAt: new Date().toISOString(),
        },
      });

      // Clear paused subscription ID
      await Users.update({ id: userId }, {
        pausedSubscriptionId: null,
      });

      console.log(`✅ STRIPE: Resumed subscription ${subId} for user ${userId}`);
      logger.info(`Resumed Stripe subscription ${subId} for user ${userId}`);

      return true;
    } catch (error) {
      console.error(`❌ STRIPE ERROR: Failed to resume subscription for user ${userId}:`, error);
      logger.error(`Failed to resume Stripe subscription for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Apply a gift subscription to a user
   * Handles all scenarios: new subscriptions, upgrades, extensions, and credit storage
   */
  public static async applyGiftSubscription(
    user: User,
    plan: 'plus' | 'mplus',
    subscriptionType: GiftedSubscriptionType
  ): Promise<Date> {
    const now = new Date();
    let subscriptionEndDate: Date;
    
    // Calculate the duration in days
    const durationDays = subscriptionType === 'month' ? 30 : 365;
    
    logger.info(`🎁 GIFT: Applying ${plan} ${subscriptionType} gift to user ${user.id}`);
    
    // Get current subscription status
    const currentStatus = await this.updateSubscriptionStatus(user.id);
    
    // Case 1: User is FREE - activate immediately
    if (currentStatus === SubscriptionStatus.FREE) {
      subscriptionEndDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
      
      await Users.update({ id: user.id }, {
        isPlus: plan === 'plus',
        isMPlus: plan === 'mplus',
        subscriptionEndDate: subscriptionEndDate,
        subscriptionStatus: plan === 'plus' ? SubscriptionStatus.BARKLE_PLUS_CREDIT : SubscriptionStatus.MINI_PLUS_CREDIT,
        subscriptionPlatform: 'credit',
      });
      
      logger.info(`✅ GIFT: Activated ${plan} for FREE user ${user.id} until ${subscriptionEndDate.toISOString()}`);
      return subscriptionEndDate;
    }
    
    // Case 2: Same tier - extend the subscription
    if ((plan === 'plus' && (currentStatus === SubscriptionStatus.BARKLE_PLUS || currentStatus === SubscriptionStatus.BARKLE_PLUS_CREDIT)) ||
        (plan === 'mplus' && (currentStatus === SubscriptionStatus.MINI_PLUS || currentStatus === SubscriptionStatus.MINI_PLUS_CREDIT))) {
      
      // Extend from current end date or now if expired
      const baseDate = user.subscriptionEndDate && user.subscriptionEndDate > now 
        ? user.subscriptionEndDate 
        : now;
      subscriptionEndDate = new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
      
      await Users.update({ id: user.id }, {
        subscriptionEndDate: subscriptionEndDate,
      });
      
      logger.info(`✅ GIFT: Extended ${plan} for user ${user.id} until ${subscriptionEndDate.toISOString()}`);
      return subscriptionEndDate;
    }
    
    // Case 3: Upgrade from Mini+ to Barkle+
    if (plan === 'plus' && (currentStatus === SubscriptionStatus.MINI_PLUS || currentStatus === SubscriptionStatus.MINI_PLUS_CREDIT)) {
      subscriptionEndDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
      
      // Store current Mini+ status for later
      await Users.update({ id: user.id }, {
        isPlus: true,
        isMPlus: false,
        subscriptionEndDate: subscriptionEndDate,
        subscriptionStatus: SubscriptionStatus.BARKLE_PLUS_CREDIT,
        previousSubscriptionPlan: 'mplus', // Remember they had Mini+
        subscriptionPlatform: 'credit',
      });
      
      // Pause their Mini+ subscription if they have one
      await this.pauseStripeSubscription(user.id, 'gift_upgrade');
      
      logger.info(`✅ GIFT: Upgraded Mini+ user ${user.id} to Barkle+ until ${subscriptionEndDate.toISOString()}`);
      return subscriptionEndDate;
    }
    
    // Case 4: Barkle+ user receives Mini+ gift - store as credit
    if (plan === 'mplus' && (currentStatus === SubscriptionStatus.BARKLE_PLUS || currentStatus === SubscriptionStatus.BARKLE_PLUS_CREDIT)) {
      // Store the gift as credit for later use
      await this.addCredits(user.id, 'mplus', 'gift', subscriptionType);
      
      // Return current subscription end date since gift is stored as credit
      subscriptionEndDate = user.subscriptionEndDate || new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
      
      logger.info(`✅ GIFT: Stored Mini+ gift as credit for Barkle+ user ${user.id}`);
      return subscriptionEndDate;
    }
    
    // Case 5: Barkle+ user receives Barkle+ gift - pause billing and add to credits
    if (plan === 'plus' && (currentStatus === SubscriptionStatus.BARKLE_PLUS || currentStatus === SubscriptionStatus.BARKLE_PLUS_CREDIT)) {
      // Pause their Stripe subscription if they have one
      await this.pauseStripeSubscription(user.id, 'gift_received');
      
      // Add the gift as credit
      await this.addCredits(user.id, 'plus', 'gift', subscriptionType);
      
      // Return current subscription end date since gift is stored as credit
      subscriptionEndDate = user.subscriptionEndDate || new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
      
      logger.info(`✅ GIFT: Paused billing and added Barkle+ gift as credit for user ${user.id}`);
      return subscriptionEndDate;
    }
    
    // Default fallback - add as credit
    await this.addCredits(user.id, plan, 'gift', subscriptionType);
    subscriptionEndDate = user.subscriptionEndDate || new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
    
    logger.info(`✅ GIFT: Added ${plan} gift as credit (fallback) for user ${user.id}`);
    return subscriptionEndDate;
  }
}