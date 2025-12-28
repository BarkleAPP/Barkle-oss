import define from '../../../define.js';
import { ApiError } from '../../../error.js';
import { SubscriptionManager } from '@/services/subscription-manager.js';
import { Users } from '@/models/index.js';

export const meta = {
  tags: ['admin'],
  requireCredential: true,
  requireModerator: true,
  
  errors: {
    'USER_NOT_FOUND': {
      message: 'User not found',
      code: 'USER_NOT_FOUND',
      id: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    },
  },

  res: {
    type: 'object',
    optional: false, nullable: false,
    properties: {
      success: {
        type: 'boolean',
        optional: false, nullable: false,
      },
      message: {
        type: 'string',
        optional: false, nullable: false,
      },
    },
  },
} as const;

export const paramDef = {
  type: 'object',
  properties: {
    userId: { type: 'string' },
    cleanupAll: { type: 'boolean', default: false },
  },
  required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
  if (ps.cleanupAll) {
    // Clean up all users with duplicate customers
    const usersWithStripeCustomers = await Users.createQueryBuilder('user')
      .where('user.stripe_user IS NOT NULL')
      .getMany();

    let cleanedCount = 0;
    for (const targetUser of usersWithStripeCustomers) {
      try {
        await SubscriptionManager.cleanupDuplicateCustomers(targetUser.id);
        cleanedCount++;
      } catch (error) {
        console.error(`Failed to cleanup customers for user ${targetUser.id}:`, error);
      }
    }

    return {
      success: true,
      message: `Cleaned up duplicate customers for ${cleanedCount} users`,
    };
  } else if (ps.userId) {
    // Clean up specific user
    const targetUser = await Users.findOneBy({ id: ps.userId });
    if (!targetUser) {
      throw new ApiError(meta.errors.USER_NOT_FOUND);
    }

    await SubscriptionManager.cleanupDuplicateCustomers(ps.userId);

    return {
      success: true,
      message: `Cleaned up duplicate customers for user ${ps.userId}`,
    };
  } else {
    return {
      success: false,
      message: 'Either userId or cleanupAll must be specified',
    };
  }
});