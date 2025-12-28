import { Users } from '@/models/index.js';
import define from '../../define.js';
import { ApiError } from '../../error.js';
import { HOUR } from '@/const.js';
import { SubscriptionManager } from '@/services/subscription-manager.js';
import Logger from '@/services/logger.js';

const logger = new Logger('applyGiftCredit');

export const meta = {
  tags: ['account', 'subscription'],
  requireCredential: true,
  limit: {
    duration: HOUR,
    max: 10,
  },
  errors: {
    NO_GIFT_CREDIT: {
      message: 'You don\'t have any gift credits to apply.',
      code: 'NO_GIFT_CREDIT',
      id: 'cd4e9f4d-78c6-4761-b89a-2e34c872de25',
    },
    ALREADY_SUBSCRIBED: {
      message: 'You already have an active subscription. Gift credits can only be applied when you don\'t have an active subscription.',
      code: 'ALREADY_SUBSCRIBED',
      id: '5c9c3342-0f2d-4280-8f1c-f9e98856e97b',
    },
    CREDIT_EXPIRED: {
      message: 'Your gift credit has expired.',
      code: 'CREDIT_EXPIRED',
      id: 'a3d2f9b6-7a8e-4c9f-bc12-731a456b890c',
    },
  },
  res: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      subscription: {
        type: 'object',
        properties: {
          plan: { type: 'string', enum: ['plus', 'mplus'] },
          endDate: { type: 'string', format: 'date-time' }
        }
      },
      message: { type: 'string' }
    }
  },
} as const;

export const paramDef = {
  type: 'object',
  properties: {},
  required: [],
} as const;

/**
 * Apply a stored gift credit to the user's account
 */
export default define(meta, paramDef, async (ps, user) => {
  // Get the current user record with all subscription details
  const currentUser = await Users.findOneByOrFail({ id: user.id });
  
  // Check if user has a gift credit
  if (!currentUser.giftCreditPlan || !currentUser.giftCreditEndDate) {
    throw new ApiError(meta.errors.NO_GIFT_CREDIT);
  }
  
  // Check if user already has an active subscription
  if (currentUser.isPlus || currentUser.isMPlus) {
    throw new ApiError(meta.errors.ALREADY_SUBSCRIBED);
  }
  
  // CRITICAL FIX: Add 24-hour grace period for credit expiry
  const now = new Date();
  const creditExpiry = new Date(currentUser.giftCreditEndDate);
  const gracePeriodHours = 24;
  const gracePeriodEnd = new Date(creditExpiry.getTime() + (gracePeriodHours * 60 * 60 * 1000));
  
  if (creditExpiry < now) {
    // Check if we're still in grace period
    if (now > gracePeriodEnd) {
      // Outside grace period - clear expired credit
      await Users.update({ id: user.id }, {
        giftCreditPlan: null,
        giftCreditEndDate: null
      });
      
      logger.warn(`Gift credit expired for user ${user.id} at ${creditExpiry.toISOString()}`);
      throw new ApiError(meta.errors.CREDIT_EXPIRED);
    } else {
      // Within grace period - allow with warning
      logger.info(`✅ CREDIT: Applying expired credit within ${gracePeriodHours}h grace period for user ${user.id}`);
    }
  }
  
  try {
    // Apply the gift credit
    const plan = currentUser.giftCreditPlan;
    const endDate = currentUser.giftCreditEndDate;
    
    // Update user record with the applied gift credit
    await Users.update({ id: user.id }, {
      isPlus: plan === 'plus',
      isMPlus: plan === 'mplus',
      subscriptionEndDate: endDate,
      giftCreditPlan: null,
      giftCreditEndDate: null
    });
    
    logger.info(`✅ CREDIT: Applied ${plan} gift credit for user ${user.id} until ${endDate.toISOString()}`);
    
    // No need to call extendSubscription - credit is already applied
    
    return {
      success: true,
      subscription: {
        plan: plan,
        endDate: endDate.toISOString()
      },
      message: `Successfully applied your ${plan === 'plus' ? 'Barkle+' : 'Mini+'} gift credit.`
    };
  } catch (error) {
    logger.error(`❌ CREDIT ERROR: Failed to apply gift credit for user ${user.id}: ${error}`);
    throw error;
  }
});
