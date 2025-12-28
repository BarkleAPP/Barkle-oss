import { describe, test, beforeEach, afterEach, expect, vi } from 'vitest';
import * as redeemEndpoint from '@/server/api/endpoints/gift/redeem.js';
import { GiftedSubscriptions, Users } from '@/models/index.js';
import { User } from '@/models/entities/user.js';
import { GiftedSubscription, GiftedSubscriptionStatus } from '@/models/entities/gifted-subscription.js';
import { SubscriptionManager } from '@/services/subscription-manager.js';

// Mock dependencies
vi.mock('@/models/index.js', () => ({
  Users: {
    findOneByOrFail: vi.fn(),
    update: vi.fn().mockResolvedValue({}),
  },
  GiftedSubscriptions: {
    findActiveGiftByToken: vi.fn(),
    markGiftAsRedeemed: vi.fn().mockResolvedValue({}),
  }
}));

vi.mock('@/services/subscription-manager.js', () => ({
  SubscriptionManager: {
    applyGiftSubscription: vi.fn().mockResolvedValue(new Date('2025-06-21T00:00:00Z')),
    extendSubscription: vi.fn().mockResolvedValue(new Date('2025-06-21T00:00:00Z')),
    storeGiftCredit: vi.fn().mockResolvedValue(new Date('2025-06-21T00:00:00Z')),
  }
}));

describe('Gift Redemption Endpoint Tests', () => {
  // Test fixture data
  const testToken = 'test-gift-token-123';
  const testUser = {
    id: 'user123',
  } as User;
  
  // Create mock gifts and users with different states
  let noSubUser: User;
  let miniPlusUser: User;
  let barklePlusUser: User;
  let miniPlusGift: GiftedSubscription;
  let barklePlusGift: GiftedSubscription;
  
  beforeEach(() => {
    vi.resetAllMocks();
    
    // Create users with different subscription states
    noSubUser = {
      id: 'user1',
      isPlus: false,
      isMPlus: false,
      subscriptionEndDate: null,
      pausedSubscriptionId: null,
      giftCreditPlan: null,
      giftCreditEndDate: null,
      previousSubscriptionPlan: null,
    } as User;
    
    miniPlusUser = {
      id: 'user2',
      isPlus: false,
      isMPlus: true,
      subscriptionEndDate: new Date('2025-06-21T00:00:00Z'),
      pausedSubscriptionId: null,
      giftCreditPlan: null,
      giftCreditEndDate: null,
      previousSubscriptionPlan: null,
    } as User;
    
    barklePlusUser = {
      id: 'user3',
      isPlus: true,
      isMPlus: false,
      subscriptionEndDate: new Date('2025-06-21T00:00:00Z'),
      pausedSubscriptionId: null,
      giftCreditPlan: null,
      giftCreditEndDate: null,
      previousSubscriptionPlan: null,
    } as User;
    
    // Create gift fixtures
    miniPlusGift = {
      id: 'gift1',
      token: testToken,
      plan: 'mplus',
      subscriptionType: 'month',
      status: 'pending_redemption' as GiftedSubscriptionStatus,
    } as GiftedSubscription;
    
    barklePlusGift = {
      id: 'gift2',
      token: testToken,
      plan: 'plus',
      subscriptionType: 'month',
      status: 'pending_redemption' as GiftedSubscriptionStatus,
    } as GiftedSubscription;
  });
  
  test('Scenario 1: User with no subscription accepts a gift', async () => {
    // Set up mocks
    (GiftedSubscriptions.findActiveGiftByToken as any).mockResolvedValue(miniPlusGift);
    (Users.findOneByOrFail as any).mockResolvedValue(noSubUser);
    
    // Call the endpoint
    const result = await redeemEndpoint.default({
      token: testToken,
    }, testUser);
    
    // Verify SubscriptionManager was called correctly
    expect(SubscriptionManager.applyGiftSubscription).toHaveBeenCalledWith(
      noSubUser,
      'mplus',
      'month'
    );
    
    // Verify the gift was marked as redeemed
    expect(GiftedSubscriptions.markGiftAsRedeemed).toHaveBeenCalledWith(
      miniPlusGift.id,
      testUser.id,
      'new'
    );
    
    // Check the response
    expect(result.success).toBe(true);
    expect(result.plan).toBe('mplus');
    expect(result.action).toBe('activated');
  });
  
  test('Scenario 2: User with Mini+ accepts Mini+ gift (extension)', async () => {
    // Set up mocks
    (GiftedSubscriptions.findActiveGiftByToken as any).mockResolvedValue(miniPlusGift);
    (Users.findOneByOrFail as any).mockResolvedValue(miniPlusUser);
    
    // Call the endpoint
    const result = await redeemEndpoint.default({
      token: testToken,
    }, testUser);
    
    // Verify SubscriptionManager was called correctly
    expect(SubscriptionManager.extendSubscription).toHaveBeenCalledWith(
      miniPlusUser,
      'month',
      'mplus'
    );
    
    // Verify the gift was marked as redeemed
    expect(GiftedSubscriptions.markGiftAsRedeemed).toHaveBeenCalledWith(
      miniPlusGift.id,
      testUser.id,
      'extension'
    );
    
    // Check the response
    expect(result.success).toBe(true);
    expect(result.action).toBe('extended');
  });
  
  test('Scenario 3: User with Barkle+ accepts Barkle+ gift (extension)', async () => {
    // Set up mocks
    (GiftedSubscriptions.findActiveGiftByToken as any).mockResolvedValue(barklePlusGift);
    (Users.findOneByOrFail as any).mockResolvedValue(barklePlusUser);
    
    // Call the endpoint
    const result = await redeemEndpoint.default({
      token: testToken,
    }, testUser);
    
    // Verify SubscriptionManager was called correctly
    expect(SubscriptionManager.extendSubscription).toHaveBeenCalledWith(
      barklePlusUser,
      'month',
      'plus'
    );
    
    // Verify the gift was marked as redeemed
    expect(GiftedSubscriptions.markGiftAsRedeemed).toHaveBeenCalledWith(
      barklePlusGift.id,
      testUser.id,
      'extension'
    );
    
    // Check the response
    expect(result.success).toBe(true);
    expect(result.action).toBe('extended');
  });
  
  test('Scenario 4: User with Mini+ accepts Barkle+ gift (upgrade)', async () => {
    // Set up mocks
    (GiftedSubscriptions.findActiveGiftByToken as any).mockResolvedValue(barklePlusGift);
    (Users.findOneByOrFail as any).mockResolvedValue(miniPlusUser);
    
    // Call the endpoint
    const result = await redeemEndpoint.default({
      token: testToken,
    }, testUser);
    
    // Verify SubscriptionManager was called correctly
    expect(SubscriptionManager.applyGiftSubscription).toHaveBeenCalledWith(
      miniPlusUser,
      'plus',
      'month'
    );
    
    // Verify the gift was marked as redeemed
    expect(GiftedSubscriptions.markGiftAsRedeemed).toHaveBeenCalledWith(
      barklePlusGift.id,
      testUser.id,
      'upgrade'
    );
    
    // Check the response
    expect(result.success).toBe(true);
    expect(result.action).toBe('upgraded');
  });
  
  test('Scenario 5: User with Barkle+ accepts Mini+ gift (store credit)', async () => {
    // Set up mocks
    (GiftedSubscriptions.findActiveGiftByToken as any).mockResolvedValue(miniPlusGift);
    (Users.findOneByOrFail as any).mockResolvedValue(barklePlusUser);
    
    // Call the endpoint
    const result = await redeemEndpoint.default({
      token: testToken,
    }, testUser);
    
    // Verify SubscriptionManager was called correctly
    expect(SubscriptionManager.storeGiftCredit).toHaveBeenCalledWith(
      barklePlusUser,
      'mplus',
      'month'
    );
    
    // Verify the gift was marked as redeemed
    expect(GiftedSubscriptions.markGiftAsRedeemed).toHaveBeenCalledWith(
      miniPlusGift.id,
      testUser.id,
      'credit'
    );
    
    // Check the response
    expect(result.success).toBe(true);
    expect(result.action).toBe('credited');
  });
  
  test('Handles invalid token error', async () => {
    // Mock no gift found
    (GiftedSubscriptions.findActiveGiftByToken as any).mockResolvedValue(null);
    
    // Expect the endpoint to throw an error
    await expect(redeemEndpoint.default({
      token: 'invalid-token',
    }, testUser)).rejects.toThrow();
  });
});
