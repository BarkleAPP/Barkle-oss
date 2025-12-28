import { Users } from '@/models/index.js';
import define from '../../../define.js';
import { ApiError } from '../../../error.js';
import { DAY } from '@/const.js';
import { SubscriptionManager } from '@/services/subscription-manager.js';
import Logger from '@/services/logger.js';

const logger = new Logger('adminSubscriptionManagement');

export const meta = {
  tags: ['admin', 'subscription'],
  requireCredential: true,
  requireAdmin: true,
  limit: {
    duration: DAY,
    max: 30,
  },
  errors: {
    NO_SUCH_USER: {
      message: 'No such user.',
      code: 'NO_SUCH_USER',
      id: '9725d0f3-ba21-4421-b98a-964bbb3761e3',
    },
    INVALID_PARAMETERS: {
      message: 'Invalid parameters.',
      code: 'INVALID_PARAMETERS',
      id: 'b629d826-5f05-4fcb-8d8b-91c845547a99',
    },
  },
  res: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      user: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          username: { type: 'string' },
          isPlus: { type: 'boolean' },
          isMPlus: { type: 'boolean' },
          subscriptionEndDate: { type: 'string', format: 'date-time', nullable: true },
          giftCreditPlan: { type: 'string', nullable: true },
          giftCreditEndDate: { type: 'string', format: 'date-time', nullable: true },
          previousSubscriptionPlan: { type: 'string', nullable: true },
        }
      },
      message: { type: 'string' }
    }
  },
} as const;

export const paramDef = {
  type: 'object',
  properties: {
    userId: { type: 'string' },
    action: { type: 'string', enum: ['add', 'extend', 'remove', 'downgrade', 'upgrade', 'add-gift-credit'] },
    plan: { type: 'string', enum: ['plus', 'mplus'], nullable: true },
    duration: { type: 'string', enum: ['month', 'year'], nullable: true },
  },
  required: ['userId', 'action'],
} as const;

/**
 * Admin endpoint for managing user subscriptions
 */
export default define(meta, paramDef, async (ps, user) => {
  // Get the target user
  const targetUser = await Users.findOneBy({ id: ps.userId });
  
  if (!targetUser) {
    throw new ApiError(meta.errors.NO_SUCH_USER);
  }
  
  let message = '';
  
  // Handle different actions
  switch (ps.action) {
    case 'add':
      // Validate required parameters
      if (!ps.plan || !ps.duration) {
        throw new ApiError(meta.errors.INVALID_PARAMETERS, { message: 'Plan and duration are required for add action.' });
      }
      
      // Add a new subscription
      await SubscriptionManager.applyGiftSubscription(targetUser, ps.plan, ps.duration);
      message = `Added ${ps.plan === 'plus' ? 'Barkle+' : 'Mini+'} subscription for ${ps.duration}.`;
      break;
      
    case 'extend':
      // Validate required parameters
      if (!ps.duration) {
        throw new ApiError(meta.errors.INVALID_PARAMETERS, { message: 'Duration is required for extend action.' });
      }
      
      // Determine the plan to extend
      const extendPlan = targetUser.isPlus ? 'plus' : (targetUser.isMPlus ? 'mplus' : null);
      
      if (!extendPlan) {
        throw new ApiError(meta.errors.INVALID_PARAMETERS, { message: 'User does not have an active subscription to extend.' });
      }
      
      // Extend the subscription
      await SubscriptionManager.extendSubscription(targetUser, ps.duration, extendPlan);
      message = `Extended ${extendPlan === 'plus' ? 'Barkle+' : 'Mini+'} subscription by ${ps.duration}.`;
      break;
      
    case 'remove':
      // Remove subscription by setting it to expire now
      await Users.update({ id: targetUser.id }, {
        isPlus: false,
        isMPlus: false,
        subscriptionEndDate: null,
        previousSubscriptionPlan: null,
        pausedSubscriptionId: null
      });
      
      message = 'Removed subscription.';
      break;
      
    case 'downgrade':
      // Downgrade from Barkle+ to Mini+
      if (!targetUser.isPlus) {
        throw new ApiError(meta.errors.INVALID_PARAMETERS, { message: 'User is not on Barkle+ to downgrade.' });
      }
      
      await Users.update({ id: targetUser.id }, {
        isPlus: false,
        isMPlus: true
      });
      
      message = 'Downgraded from Barkle+ to Mini+.';
      break;
      
    case 'upgrade':
      // Upgrade from Mini+ to Barkle+
      if (!targetUser.isMPlus) {
        throw new ApiError(meta.errors.INVALID_PARAMETERS, { message: 'User is not on Mini+ to upgrade.' });
      }
      
      await Users.update({ id: targetUser.id }, {
        isPlus: true,
        isMPlus: false
      });
      
      message = 'Upgraded from Mini+ to Barkle+.';
      break;
      
    case 'add-gift-credit':
      // Validate required parameters
      if (!ps.plan || !ps.duration) {
        throw new ApiError(meta.errors.INVALID_PARAMETERS, { message: 'Plan and duration are required for add-gift-credit action.' });
      }
      
      // Add a gift credit
      await SubscriptionManager.storeGiftCredit(targetUser, ps.plan, ps.duration);
      message = `Added ${ps.plan === 'plus' ? 'Barkle+' : 'Mini+'} gift credit for ${ps.duration}.`;
      break;
      
    default:
      throw new ApiError(meta.errors.INVALID_PARAMETERS, { message: 'Unknown action.' });
  }
  
  // Reload user to get updated state
  const updatedUser = await Users.findOneByOrFail({ id: ps.userId });
  
  logger.info(`Admin ${user.id} performed subscription action '${ps.action}' on user ${targetUser.id}`);
  
  return {
    success: true,
    user: {
      id: updatedUser.id,
      username: updatedUser.username,
      isPlus: updatedUser.isPlus,
      isMPlus: updatedUser.isMPlus,
      subscriptionEndDate: updatedUser.subscriptionEndDate?.toISOString() || null,
      giftCreditPlan: updatedUser.giftCreditPlan,
      giftCreditEndDate: updatedUser.giftCreditEndDate?.toISOString() || null,
      previousSubscriptionPlan: updatedUser.previousSubscriptionPlan
    },
    message
  };
});
