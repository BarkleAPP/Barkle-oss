import { describe, test, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { initTestDb, clearDb, closeDb } from '../utils/test-db.js';
import { GiftedSubscriptions, Users } from '@/models/index.js';
import { User } from '@/models/entities/user.js';
import { SubscriptionManager } from '@/services/subscription-manager.js';
import Stripe from 'stripe';

// Mock Stripe API
vi.mock('stripe', () => {
  const mockSubscription = {
    id: 'sub_123456',
    status: 'active',
    customer: 'cus_123456',
    pause_collection: null
  };

  const mockStripe = {
    subscriptions: {
      list: vi.fn().mockResolvedValue({
        data: [mockSubscription]
      }),
      update: vi.fn().mockResolvedValue({
        ...mockSubscription,
        pause_collection: { behavior: 'keep_as_draft' }
      })
    }
  };

  return {
    default: vi.fn().mockImplementation(() => mockStripe)
  };
});

// Mock fetch-meta module
vi.mock('@/misc/fetch-meta.js', () => ({
  fetchMeta: vi.fn().mockResolvedValue({
    stripe_key: 'fake_stripe_key'
  })
}));

describe('Stripe Gift Subscription Pause/Resume', () => {
  let testUsers: { [key: string]: User } = {};

  beforeAll(async () => {
    await initTestDb();

    // Create test users
    testUsers.miniPlus = await createTestUser('miniplus', { 
      isMPlus: true, 
      stripe_user: 'cus_123456' 
    });
    testUsers.barklePlus = await createTestUser('barkleplus', { 
      isPlus: true, 
      stripe_user: 'cus_789012' 
    });
  });

  afterAll(async () => {
    await closeDb();
  });

  afterEach(async () => {
    vi.clearAllMocks();
  });

  // Helper to create test users
  async function createTestUser(username: string, flags = {}): Promise<User> {
    const user = await Users.save({
      id: `user-${Math.random().toString(36).substring(2, 9)}`,
      username,
      usernameLower: username.toLowerCase(),
      ...flags
    });
    return user;
  }

  test('Gift acceptance should pause Stripe subscription for Mini+ user getting Barkle+ gift', async () => {
    const user = testUsers.miniPlus;
    
    // Apply a gift subscription (Mini+ user receiving Barkle+ gift)
    const giftEndDate = await SubscriptionManager.applyGiftSubscription(
      user,
      'plus',
      'month'
    );
    
    // Get the Stripe instance
    const stripe = (Stripe as any).mock.results[0].value;
    
    // Verify Stripe subscriptions.list was called with correct parameters
    expect(stripe.subscriptions.list).toHaveBeenCalledWith({
      customer: 'cus_123456',
      status: 'active',
      limit: 1
    });
    
    // Verify Stripe subscriptions.update was called to pause the subscription
    expect(stripe.subscriptions.update).toHaveBeenCalledWith('sub_123456', {
      pause_collection: {
        behavior: 'keep_as_draft'
      }
    });
    
    // Verify user record has been updated with pausedSubscriptionId
    const updatedUser = await Users.findOneByOrFail({ id: user.id });
    expect(updatedUser.pausedSubscriptionId).toBe('sub_123456');
    expect(updatedUser.isPlus).toBe(true);
    expect(updatedUser.isMPlus).toBe(false);
    expect(updatedUser.previousSubscriptionPlan).toBe('mplus');
  });

  test('Gift expiration should resume paused Stripe subscription', async () => {
    // First set up a user with a paused subscription
    const userId = testUsers.miniPlus.id;
    await Users.update({ id: userId }, {
      isPlus: true,
      isMPlus: false,
      previousSubscriptionPlan: 'mplus',
      pausedSubscriptionId: 'sub_123456'
    });
    
    // Reload user
    const user = await Users.findOneByOrFail({ id: userId });
    
    // Simulate gift expiration
    const { handleExpiredGift } = await import('@/queue/processors/subscription.js');
    await handleExpiredGift(user);
    
    // Get the Stripe instance
    const stripe = (Stripe as any).mock.results[0].value;
    
    // Verify Stripe subscriptions.update was called to resume the subscription
    expect(stripe.subscriptions.update).toHaveBeenCalledWith('sub_123456', {
      pause_collection: null
    });
    
    // Verify user record has been updated correctly
    const updatedUser = await Users.findOneByOrFail({ id: userId });
    expect(updatedUser.pausedSubscriptionId).toBeNull();
    expect(updatedUser.isPlus).toBe(false);
    expect(updatedUser.isMPlus).toBe(true);
    expect(updatedUser.previousSubscriptionPlan).toBeNull();
  });
});
