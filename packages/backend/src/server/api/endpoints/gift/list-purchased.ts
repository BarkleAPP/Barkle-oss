import { GiftedSubscriptions } from '@/models/index.js';
import define from '../../define.js';
import { HOUR } from '@/const.js';

export const meta = {
  tags: ['gift'],
  requireCredential: true,
  limit: {
    duration: HOUR,
    max: 220,
  },
  res: {
    type: 'array',
    optional: false, nullable: false,
    items: {
      type: 'object',
      optional: false, nullable: false,
      properties: {
        id: { type: 'string', optional: false, nullable: false },
        createdAt: { type: 'string', format: 'date-time', optional: false, nullable: false },
        status: { type: 'string', enum: ['pending_redemption', 'redeemed', 'expired'], optional: false, nullable: false },
        plan: { type: 'string', enum: ['plus', 'mplus'], optional: false, nullable: false },
        subscriptionType: { type: 'string', enum: ['month', 'year'], optional: false, nullable: false },
        token: { type: 'string', optional: false, nullable: false },
        expiresAt: { type: 'string', format: 'date-time', optional: false, nullable: true },
        redeemedByUserId: { type: 'string', optional: false, nullable: true },
        redeemedAt: { type: 'string', format: 'date-time', optional: false, nullable: true },
        message: { type: 'string', optional: false, nullable: true },
        redeemedBy: { 
          type: 'object',
          optional: false, nullable: true,
          properties: {
            id: { type: 'string', optional: false, nullable: false },
            username: { type: 'string', optional: false, nullable: false },
            name: { type: 'string', optional: false, nullable: true },
          }
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

export default define(meta, paramDef, async (ps, user) => {
  if (!user) return []; // Handle null user case
  
  try {
    // Find gifts purchased by the user
    const gifts = await GiftedSubscriptions.findAllByPurchaser(user.id);
    
    return gifts.map((gift: any) => {
    // Create the base gift object with all properties
    // Handle missing message column (added as null if it doesn't exist in the DB)
    const formattedGift: any = {
      id: gift.id,
      createdAt: gift.createdAt.toISOString(),
      status: gift.status,
      plan: gift.plan,
      subscriptionType: gift.subscriptionType,
      token: gift.token,
      expiresAt: gift.expiresAt ? gift.expiresAt.toISOString() : null,
      redeemedByUserId: gift.redeemedByUserId,
      redeemedAt: gift.redeemedAt ? gift.redeemedAt.toISOString() : null,
      message: gift.message,
      redeemedBy: null
    };
    
    // Add redeemer info if available
    if (gift.redeemedByUser) {
      formattedGift.redeemedBy = {
        id: gift.redeemedByUser.id,
        username: gift.redeemedByUser.username,
        name: gift.redeemedByUser.name
      };
    }
    
    return formattedGift;
  });
  } catch (error) {
    throw error; // Re-throw so the API client sees the error
  }
});
