import { GiftedSubscriptions } from '@/models/index.js';
import define from '../../define.js';
import { ApiError } from '../../error.js';
import { HOUR } from '@/const.js';

export const meta = {
  tags: ['gift'],
  requireCredential: true,
  limit: {
    duration: HOUR,
    max: 30,
  },
  errors: {
    INVALID_TOKEN: {
      message: 'Invalid gift token.',
      code: 'INVALID_TOKEN',
      id: '1b72e2f8-82e8-4ab6-8a3d-8fd729ac13f1',
    },
    GIFT_EXPIRED: {
      message: 'This gift token has expired.',
      code: 'GIFT_EXPIRED',
      id: 'f2a789d1-2c9b-4b1a-9458-9e6e0a7d3b5c',
    },
    ALREADY_REDEEMED: {
      message: 'This gift token has already been redeemed.',
      code: 'ALREADY_REDEEMED',
      id: 'e3a789d1-2c9b-4b1a-9458-9e6e0a7d3b5c',
    },
  },
  res: {
    type: 'object',
    properties: {
      plan: { type: 'string', enum: ['plus', 'mplus'] },
      subscriptionType: { type: 'string', enum: ['month', 'year'] },
      purchasedBy: { 
        type: 'object',
        nullable: true,
        properties: {
          id: { type: 'string' },
          username: { type: 'string' },
          name: { type: 'string', nullable: true },
        }
      },
      message: { type: 'string', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
      expiresAt: { type: 'string', format: 'date-time', nullable: true },
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
  // Use our repository method to find active gift
  const gift = await GiftedSubscriptions.findActiveGiftByToken(ps.token);

  if (!gift) {
    throw new ApiError(meta.errors.INVALID_TOKEN);
  }

  // Double-check status
  if (gift.status === 'redeemed') {
    throw new ApiError(meta.errors.ALREADY_REDEEMED);
  }

  if (gift.status === 'expired') {
    throw new ApiError(meta.errors.GIFT_EXPIRED);
  }

  // Removed expiration check since gifts don't expire anymore

  // Get purchaser info if available
  let purchasedBy = null;
  if (gift.purchasedByUser) {
    purchasedBy = {
      id: gift.purchasedByUser.id,
      username: gift.purchasedByUser.username,
      name: gift.purchasedByUser.name,
    };
  }

  return {
    plan: gift.plan,
    subscriptionType: gift.subscriptionType,
    purchasedBy,
    message: gift.message,
    createdAt: gift.createdAt.toISOString(),
    expiresAt: gift.expiresAt ? gift.expiresAt.toISOString() : null,
  };
});
