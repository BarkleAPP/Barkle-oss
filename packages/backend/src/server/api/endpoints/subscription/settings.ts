import { Users } from '@/models/index.js';
import define from '../../define.js';
import { ApiError } from '../../error.js';
import { HOUR } from '@/const.js';
import { subscriptionQueue } from '@/queue/queues.js';
import Logger from '@/services/logger.js';

const logger = new Logger('subscriptionSettings');

export const meta = {
  tags: ['account', 'subscription'],
  requireCredential: true,
  limit: {
    duration: HOUR,
    max: 10,
  },
  errors: {
    NO_SUCH_USER: {
      message: 'No such user.',
      code: 'NO_SUCH_USER',
      id: '63e71a1c-2a65-4050-98a2-5d7e40a6f6f9',
    },
    NO_ACTIVE_SUBSCRIPTION: {
      message: 'You don\'t have an active subscription.',
      code: 'NO_ACTIVE_SUBSCRIPTION',
      id: '4b5db3c9-91da-4b1f-a986-89db98b32f28',
    },
  },
  res: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' }
    }
  },
} as const;

export const paramDef = {
  type: 'object',
  properties: {
    action: { type: 'string', enum: ['cancel'] },
  },
  required: ['action'],
} as const;

/**
 * Manage subscription settings
 */
export default define(meta, paramDef, async (ps, user) => {
  // Get the current user record with all subscription details
  const currentUser = await Users.findOneBy({ id: user.id });
  
  if (!currentUser) {
    throw new ApiError(meta.errors.NO_SUCH_USER);
  }
  
  // Check if user has an active subscription
  if (!currentUser.isPlus && !currentUser.isMPlus) {
    throw new ApiError(meta.errors.NO_ACTIVE_SUBSCRIPTION);
  }
  
  // Handle different actions
  switch (ps.action) {
    case 'cancel':
      try {
        // If user has a paused subscription due to gift, resume it before cancelling
        if (currentUser.pausedSubscriptionId) {
          // Import the subscription manager to use Stripe integration
          const { SubscriptionManager } = await import('@/services/subscription-manager.js');
          
          // Resume the paused subscription
          await SubscriptionManager.resumeStripeSubscription(currentUser.pausedSubscriptionId, user.id);
          logger.info(`Resumed paused Stripe subscription ${currentUser.pausedSubscriptionId} for user ${user.id} as part of cancellation`);
          
          // Clear the paused subscription ID
          await Users.update({ id: user.id }, {
            pausedSubscriptionId: null
          });
        }
        
        // If user has a gift credit, apply it immediately instead of cancelling
        if (currentUser.giftCreditPlan && currentUser.giftCreditEndDate) {
          const giftPlan = currentUser.giftCreditPlan;
          const giftEndDate = currentUser.giftCreditEndDate;
          
          await Users.update({ id: user.id }, {
            isPlus: giftPlan === 'plus',
            isMPlus: giftPlan === 'mplus',
            subscriptionEndDate: giftEndDate,
            giftCreditPlan: null,
            giftCreditEndDate: null
          });
          
          logger.info(`Applied ${giftPlan} gift credit for user ${user.id} after cancellation`);
          
          return {
            success: true,
            message: `Your subscription has been changed to ${giftPlan === 'plus' ? 'Barkle+' : 'Mini+'} using your stored gift credit.`
          };
        }
        
        // Otherwise, set subscription to end now (cancelling)
        const now = new Date();
        
        await Users.update({ id: user.id }, {
          subscriptionEndDate: now
        });
        
        // Schedule immediate check for expiration to process the cancellation
        await subscriptionQueue.add({
          userId: user.id,
          action: 'check-expiring'
        }, {
          removeOnComplete: true,
          removeOnFail: true
        });
        
        logger.info(`Cancelled subscription for user ${user.id}`);
        
        return {
          success: true,
          message: 'Your subscription has been cancelled.'
        };
      } catch (error) {
        logger.error(`Error cancelling subscription for user ${user.id}: ${error}`);
        throw error;
      }
      
    default:
      return {
        success: false,
        message: 'Unknown action'
      };
  }
});
