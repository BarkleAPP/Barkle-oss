import { Users, GiftedSubscriptions } from '@/models/index.js';
import define from '../../define.js';
import { ApiError } from '../../error.js';
import { HOUR } from '@/const.js';
import { User } from '@/models/entities/user.js';
import { SubscriptionManager } from '@/services/subscription-manager.js';
import { SubscriptionStatus } from '@/types/subscription-status.enum.js';
import Logger from '@/services/logger.js';

const logger = new Logger('giftRedeem');

export const meta = {
  tags: ['gift'],
  requireCredential: true,
  limit: {
    duration: HOUR,
    max: 10,
  },
  errors: {
    INVALID_TOKEN: {
      message: 'Invalid or already redeemed gift token.',
      code: 'INVALID_TOKEN',
      id: '1b72e2f8-82e8-4ab6-8a3d-8fd729ac13f1',
    },
    GIFT_EXPIRED: {
      message: 'This gift token has expired.',
      code: 'GIFT_EXPIRED',
      id: 'f2a789d1-2c9b-4b1a-9458-9e6e0a7d3b5c',
    },
  },
  res: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
      plan: { type: 'string', nullable: true },
      subscriptionEndDate: { type: 'string', format: 'date-time', nullable: true },
      action: { type: 'string', nullable: true },
    },
  },
} as const;

export const paramDef = {
  type: 'object',
  properties: {
    token: { type: 'string', minLength: 16, maxLength: 64 },
  },
  required: ['token'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
  // Use our enhanced repository method to find active gift
  const gift = await GiftedSubscriptions.findActiveGiftByToken(ps.token);

  if (!gift) {
    throw new ApiError(meta.errors.INVALID_TOKEN);
  }

  // Double-check status (should already be filtered by repository method)
  if (gift.status === 'redeemed') {
    throw new ApiError(meta.errors.INVALID_TOKEN, { message: 'This gift has already been redeemed.' });
  }

  if (gift.status === 'expired') {
    throw new ApiError(meta.errors.GIFT_EXPIRED);
  }

  // Retrieve current user with subscription details
  const currentUser = await Users.findOneByOrFail({ id: user.id });
  
  // Mark the gift as redeemed FIRST to prevent race conditions
  // We'll determine the transition type based on the user's current state
  let transitionType: 'new' | 'extension' | 'upgrade' | 'credit' = 'new';
  
  // Determine transition type
  if (!currentUser.isPlus && !currentUser.isMPlus) {
    transitionType = 'new';
  } else if (currentUser.isMPlus && gift.plan === 'mplus') {
    transitionType = 'extension';
  } else if (currentUser.isPlus && gift.plan === 'plus') {
    transitionType = 'extension';
  } else if (currentUser.isMPlus && gift.plan === 'plus') {
    transitionType = 'upgrade';
  } else if (currentUser.isPlus && gift.plan === 'mplus') {
    transitionType = 'credit';
  }

  // Mark as redeemed first to prevent concurrent redemptions
  await GiftedSubscriptions.markGiftAsRedeemed(gift.id, user.id, transitionType);
  
  // Apply the gift subscription using SubscriptionManager
  const result = await applyGiftSubscription(currentUser, gift);

  // Return the result
  return {
    success: true,
    message: result.message,
    plan: gift.plan,
    subscriptionEndDate: result.subscriptionEndDate.toISOString(),
    action: result.action
  };
});

/**
 * Apply a gift subscription based on user's current state (updated for new credit system)
 */
async function applyGiftSubscription(user: User, gift: any) {
  let subscriptionEndDate: Date;
  let message: string;
  let action: string;
  let transitionType: 'new' | 'extension' | 'upgrade' | 'credit';

  try {
    // Get current user state first and update subscription status
    const currentUser = await Users.findOneByOrFail({ id: user.id });
    const updatedStatus = await SubscriptionManager.updateSubscriptionStatus(currentUser.id);

    // Use the new SubscriptionManager.applyGiftSubscription which handles all edge cases
    subscriptionEndDate = await SubscriptionManager.applyGiftSubscription(
      currentUser,
      gift.plan,
      gift.subscriptionType
    );

    // Determine the action and message based on the transition
    if (updatedStatus === SubscriptionStatus.FREE) {
      message = `Successfully activated ${gift.plan === 'plus' ? 'Barkle+' : 'Mini+'} for ${gift.subscriptionType}.`;
      action = 'activated';
      transitionType = 'new';
    }
    // Barkle+ user receives Barkle+ gift - pause billing and add to credits
    else if (gift.plan === 'plus' && (updatedStatus === SubscriptionStatus.BARKLE_PLUS || updatedStatus === SubscriptionStatus.BARKLE_PLUS_CREDIT)) {
      message = `Your Barkle+ subscription billing has been paused and the gift has been added to your credits.`;
      action = 'credited';
      transitionType = 'credit';
    }
    // Barkle+ user receives Mini+ gift - save as credit for later
    else if (gift.plan === 'mplus' && (updatedStatus === SubscriptionStatus.BARKLE_PLUS || updatedStatus === SubscriptionStatus.BARKLE_PLUS_CREDIT)) {
      message = `You're currently on Barkle+. Your Mini+ gift has been saved as credit for when your current subscription ends.`;
      action = 'credited';
      transitionType = 'credit';
    }
    // Mini+ user receives Barkle+ gift - upgrade temporarily
    else if (gift.plan === 'plus' && (updatedStatus === SubscriptionStatus.MINI_PLUS || updatedStatus === SubscriptionStatus.MINI_PLUS_CREDIT)) {
      message = `Your Mini+ subscription has been paused and you've been temporarily upgraded to Barkle+ for ${gift.subscriptionType}.`;
      action = 'upgraded';
      transitionType = 'upgrade';
    }
    // Same tier extension
    else if ((gift.plan === 'plus' && (updatedStatus === SubscriptionStatus.BARKLE_PLUS || updatedStatus === SubscriptionStatus.BARKLE_PLUS_CREDIT)) ||
             (gift.plan === 'mplus' && (updatedStatus === SubscriptionStatus.MINI_PLUS || updatedStatus === SubscriptionStatus.MINI_PLUS_CREDIT))) {
      message = `Successfully extended your ${gift.plan === 'plus' ? 'Barkle+' : 'Mini+'} subscription by 1 ${gift.subscriptionType}.`;
      action = 'extended';
      transitionType = 'extension';
    }
    else {
      // Fallback - should not reach here normally
      logger.warn(`Unexpected gift scenario for user ${user.id}, gift ${gift.id}, status ${updatedStatus}`);
      message = `Gift redeemed.`;
      action = 'activated';
      transitionType = 'new';
    }

    return { subscriptionEndDate, message, action };
  } catch (error) {
    logger.error(`Error applying gift subscription: ${error}`, { error, userId: user.id, giftId: gift.id });
    throw error;
  }
}
