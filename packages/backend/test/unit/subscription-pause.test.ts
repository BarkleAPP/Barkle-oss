import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
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

// Mock logger
vi.mock('@/services/logger.js', () => {
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  };
  return {
    default: vi.fn().mockImplementation(() => mockLogger)
  };
});

describe('Subscription Pause/Resume', () => {
  const mockUser = {
    id: 'user123',
    stripe_user: 'cus_123456',
    isPlus: false,
    isMPlus: true
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('pauseStripeSubscription should pause a subscription and return the subscription ID', async () => {
    const pausedId = await SubscriptionManager.pauseStripeSubscription(mockUser);
    
    // Should have called Stripe to find active subscriptions
    expect(Stripe).toHaveBeenCalledWith('fake_stripe_key', { apiVersion: '2024-06-20' });
    
    const stripeInstance = (Stripe as any).mock.results[0].value;
    expect(stripeInstance.subscriptions.list).toHaveBeenCalledWith({
      customer: 'cus_123456',
      status: 'active',
      limit: 1
    });
    
    // Should have called Stripe to pause the subscription
    expect(stripeInstance.subscriptions.update).toHaveBeenCalledWith('sub_123456', {
      pause_collection: {
        behavior: 'keep_as_draft'
      }
    });
    
    // Should return the subscription ID
    expect(pausedId).toBe('sub_123456');
  });

  test('resumeStripeSubscription should resume a paused subscription', async () => {
    const result = await SubscriptionManager.resumeStripeSubscription('sub_123456', 'user123');
    
    // Should have called Stripe to resume the subscription
    const stripeInstance = (Stripe as any).mock.results[0].value;
    expect(stripeInstance.subscriptions.update).toHaveBeenCalledWith('sub_123456', {
      pause_collection: null
    });
    
    // Should return true on success
    expect(result).toBe(true);
  });

  test('pauseStripeSubscription should handle errors gracefully', async () => {
    // Mock Stripe to throw an error
    const stripeInstance = (Stripe as any).mock.results[0].value;
    stripeInstance.subscriptions.update.mockRejectedValueOnce(new Error('Stripe API error'));
    
    const pausedId = await SubscriptionManager.pauseStripeSubscription(mockUser);
    
    // Should return null on error
    expect(pausedId).toBeNull();
  });

  test('pauseStripeSubscription should handle missing Stripe customer ID', async () => {
    const userWithoutStripe = { ...mockUser, stripe_user: null };
    
    const pausedId = await SubscriptionManager.pauseStripeSubscription(userWithoutStripe);
    
    // Should return null if user has no Stripe customer ID
    expect(pausedId).toBeNull();
  });
});
