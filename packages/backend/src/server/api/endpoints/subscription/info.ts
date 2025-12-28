import { Users } from '@/models/index.js';
import { SubscriptionStatus } from '@/types/subscription-status.enum.js';
import define from '../../define.js';
import { ApiError } from '../../error.js';
import { HOUR } from '@/const.js';

export const meta = {
  tags: ['account', 'subscription'],
  requireCredential: true,
  limit: {
    duration: HOUR,
    max: 60,
  },
  errors: {
    NO_SUCH_USER: {
      message: 'No such user.',
      code: 'NO_SUCH_USER',
      id: '4362f8dc-731f-4ad8-a694-be5a88922a24',
    },
  },
  res: {
    type: 'object',
    properties: {
      subscription: {
        type: 'object',
        nullable: true,
        properties: {
          plan: { type: 'string', enum: ['plus', 'mplus', 'none'] },
          endDate: { type: 'string', format: 'date-time', nullable: true },
          status: { type: 'string', enum: ['active', 'expiring', 'expired', 'paused'] },
          isGift: { type: 'boolean' }
        }
      },
      credits: {
        type: 'object',
        nullable: true,
        properties: {
          barklePlus: {
            type: 'object',
            nullable: true,
            properties: {
              amount: { type: 'number' },
              expiryDate: { type: 'string', format: 'date-time', nullable: true }
            }
          },
          miniPlus: {
            type: 'object',
            nullable: true,
            properties: {
              amount: { type: 'number' },
              expiryDate: { type: 'string', format: 'date-time', nullable: true }
            }
          }
        }
      },
      giftCredit: {
        type: 'object',
        nullable: true,
        properties: {
          plan: { type: 'string', enum: ['plus', 'mplus'] },
          endDate: { type: 'string', format: 'date-time' }
        }
      },
      previousSubscription: {
        type: 'object',
        nullable: true,
        properties: {
          plan: { type: 'string', enum: ['plus', 'mplus'] }
        }
      }
    }
  },
} as const;

export const paramDef = {
  type: 'object',
  properties: {},
  required: [],
} as const;

/**
 * Get the user's subscription information and gift credits
 */
export default define(meta, paramDef, async (ps, user) => {
  // Get the current user record with all subscription details
  const currentUser = await Users.findOneBy({ id: user.id });
  
  if (!currentUser) {
    throw new ApiError(meta.errors.NO_SUCH_USER);
  }
  
  // Determine current subscription status using the new subscription status field
  let subscriptionStatus: 'active' | 'expiring' | 'expired' | 'paused' = 'expired';
  let currentPlan: 'plus' | 'mplus' | 'none' = 'none';
  
  // Use the subscription status field to determine current plan and status
  switch (currentUser.subscriptionStatus) {
    case SubscriptionStatus.BARKLE_PLUS:
    case SubscriptionStatus.BARKLE_PLUS_CREDIT:
      currentPlan = 'plus';
      subscriptionStatus = 'active';
      break;
    case SubscriptionStatus.MINI_PLUS:
    case SubscriptionStatus.MINI_PLUS_CREDIT:
      currentPlan = 'mplus';
      subscriptionStatus = 'active';
      break;
    case SubscriptionStatus.BARKLE_PLUS_PAUSED:
    case SubscriptionStatus.MINI_PLUS_PAUSED:
      // Determine plan from paused status
      currentPlan = currentUser.subscriptionStatus === SubscriptionStatus.BARKLE_PLUS_PAUSED ? 'plus' : 'mplus';
      subscriptionStatus = 'paused';
      break;
    case SubscriptionStatus.FREE:
    default:
      currentPlan = 'none';
      subscriptionStatus = 'expired';
      break;
  }
  
  // Determine the effective end date based on subscription type
  let effectiveEndDate: Date | null = null;
  
  if (currentPlan !== 'none') {
    switch (currentUser.subscriptionStatus) {
      case SubscriptionStatus.BARKLE_PLUS_CREDIT:
        // For credit-based Barkle+, use credit expiry
        effectiveEndDate = currentUser.barklePlusCreditsExpiry;
        break;
      case SubscriptionStatus.MINI_PLUS_CREDIT:
        // For credit-based Mini+, use credit expiry
        effectiveEndDate = currentUser.miniPlusCreditsExpiry;
        break;
      default:
        // For active/paused subscriptions, use subscription end date
        effectiveEndDate = currentUser.subscriptionEndDate;
        break;
    }
  }

  // Check if subscription is active but expiring soon (within 7 days)
  if (subscriptionStatus === 'active' && effectiveEndDate) {
    const now = new Date();
    const expiryDate = new Date(effectiveEndDate);
    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setDate(now.getDate() + 7);
    
    if (expiryDate <= sevenDaysFromNow) {
      subscriptionStatus = 'expiring';
    }
  }
  
  // Build response object
  const response: any = {
    subscription: currentPlan !== 'none' ? {
      plan: currentPlan,
      endDate: effectiveEndDate?.toISOString() || null,
      status: subscriptionStatus,
      isGift: Boolean(currentUser.previousSubscriptionPlan) // If we have a previous plan, it's likely from a gift
    } : null,
    
    // New credit system information
    credits: {
      barklePlus: (currentUser.barklePlusCredits && currentUser.barklePlusCredits > 0) ? {
        amount: currentUser.barklePlusCredits,
        expiryDate: currentUser.barklePlusCreditsExpiry?.toISOString() || null
      } : null,
      miniPlus: (currentUser.miniPlusCredits && currentUser.miniPlusCredits > 0) ? {
        amount: currentUser.miniPlusCredits,
        expiryDate: currentUser.miniPlusCreditsExpiry?.toISOString() || null
      } : null
    },
    
    // Legacy gift credit (for backward compatibility)
    giftCredit: currentUser.giftCreditPlan ? {
      plan: currentUser.giftCreditPlan,
      endDate: currentUser.giftCreditEndDate!.toISOString()
    } : null,
    
    previousSubscription: currentUser.previousSubscriptionPlan ? {
      plan: currentUser.previousSubscriptionPlan
    } : null
  };
  
  return response;
});
