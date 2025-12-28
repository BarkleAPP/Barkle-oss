import { db } from '@/db/postgre.js';
import { GiftedSubscription, GiftedSubscriptionStatus, GiftedSubscriptionType } from '../entities/gifted-subscription.js';
import { genId } from '@/misc/gen-id.js';
import { secureRndstr } from '@/misc/secure-rndstr.js';

export const GiftedSubscriptionRepository = db.getRepository(GiftedSubscription).extend({
  async findActiveGiftByToken(token: string): Promise<GiftedSubscription | null> {
    const queryBuilder = this.createQueryBuilder('gift')
      .leftJoinAndSelect('gift.purchasedByUser', 'purchasedByUser')
      .where('gift.token = :token', { token })
      .andWhere('gift.status = :status', { status: 'pending_redemption' as GiftedSubscriptionStatus });
    // Removed expiration check since gifts don't expire anymore

    return queryBuilder.getOne();
  },

  async findGiftByToken(token: string): Promise<GiftedSubscription | null> {
    // Similar to findActiveGiftByToken but doesn't filter by status
    // Useful for the verification step where we need to check status
    const queryBuilder = this.createQueryBuilder('gift')
      .leftJoinAndSelect('gift.purchasedByUser', 'purchasedByUser')
      .where('gift.token = :token', { token });

    return queryBuilder.getOne();
  },

  async createGift(options: {
    purchasedByUserId: string;
    plan: GiftedSubscription['plan'];
    subscriptionType: GiftedSubscription['subscriptionType'];
    stripeCheckoutSessionId?: string;
    message?: string;
  }): Promise<GiftedSubscription> {
    const now = new Date();
    const token = secureRndstr(32);
    
    // Remove expiration date - gifts don't expire
    const expiresAt = null;

    const gift = this.create({
      id: genId(),
      createdAt: now,
      token,
      plan: options.plan,
      subscriptionType: options.subscriptionType,
      status: 'pending_redemption' as GiftedSubscriptionStatus,
      expiresAt,
      purchasedByUserId: options.purchasedByUserId,
      stripeCheckoutSessionId: options.stripeCheckoutSessionId ?? null,
      message: options.message ?? null,
    });

    return await this.save(gift);
  },

  async findAllByPurchaser(userId: string): Promise<GiftedSubscription[]> {
    return this.find({
      where: {
        purchasedByUserId: userId,
      },
      order: {
        createdAt: 'DESC',
      },
    });
  },

  async findAllByRedeemer(userId: string): Promise<GiftedSubscription[]> {
    return this.find({
      where: {
        redeemedByUserId: userId,
        status: 'redeemed' as GiftedSubscriptionStatus,
      },
      order: {
        redeemedAt: 'DESC',
      },
    });
  },

  async processExpiredGifts(): Promise<number> {
    const now = new Date();
    
    const result = await this.createQueryBuilder()
      .update()
      .set({ status: 'expired' as GiftedSubscriptionStatus })
      .where('status = :status', { status: 'pending_redemption' as GiftedSubscriptionStatus })
      .andWhere('expiresAt IS NOT NULL AND expiresAt <= :now', { now })
      .execute();
    
    return result.affected ?? 0;
  },

  calculateSubscriptionEndDate(startDate: Date, subscriptionType: GiftedSubscriptionType): Date {
    const endDate = new Date(startDate);
    if (subscriptionType === 'month') {
      endDate.setMonth(endDate.getMonth() + 1);
    } else if (subscriptionType === 'year') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }
    return endDate;
  },

  /**
   * Mark a gift as redeemed and record state transitions
   */
  async markGiftAsRedeemed(giftId: string, redeemerUserId: string, transitionType: 'new' | 'extension' | 'upgrade' | 'credit'): Promise<void> {
    const now = new Date();
    
    await this.update({ id: giftId }, {
      status: 'redeemed' as GiftedSubscriptionStatus,
      redeemedByUserId: redeemerUserId,
      redeemedAt: now,
      metadata: { transitionType, redeemedAt: now.toISOString() }
    });
  },

  /**
   * Apply a gift credit to a user account
   */
  async applyGiftCredit(userId: string, plan: 'plus' | 'mplus', subscriptionEndDate: Date): Promise<void> {
    // Create a record of the gift credit being applied
    const gift = await this.findOne({
      where: {
        redeemedByUserId: userId,
        status: 'redeemed' as GiftedSubscriptionStatus,
      },
      order: {
        redeemedAt: 'DESC',
      },
    });

    if (gift) {
      // Update the gift with metadata about credit application
      await this.update({ id: gift.id }, {
        metadata: { 
          ...gift.metadata,
          creditApplied: true,
          creditAppliedAt: new Date().toISOString(),
          plan,
          subscriptionEndDate: subscriptionEndDate.toISOString()
        }
      });
    }
  }
});
