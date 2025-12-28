import { describe, test, beforeEach, expect, vi } from 'vitest';
import * as adminSubscriptionEndpoint from '@/server/api/endpoints/admin/subscription/manage.js';
import { Users } from '@/models/index.js';
import { User } from '@/models/entities/user.js';
import { SubscriptionManager } from '@/services/subscription-manager.js';

// Mock dependencies
vi.mock('@/models/index.js', () => ({
  Users: {
    findOneBy: vi.fn(),
    findOneByOrFail: vi.fn(),
    update: vi.fn().mockResolvedValue({}),
  }
}));

vi.mock('@/services/subscription-manager.js', () => ({
  SubscriptionManager: {
    applyGiftSubscription: vi.fn().mockResolvedValue(new Date('2025-06-21T00:00:00Z')),
    extendSubscription: vi.fn().mockResolvedValue(new Date('2025-06-21T00:00:00Z')),
    storeGiftCredit: vi.fn().mockResolvedValue(new Date('2025-06-21T00:00:00Z')),
  }
}));

describe('Admin Subscription Management Endpoint Tests', () => {
  // Test fixture data
  const adminUser = {
    id: 'admin123',
    isAdmin: true,
  } as User;
  
  // Create mock users with different states
  let targetUser: User;
  
  beforeEach(() => {
    vi.resetAllMocks();
    
    // Create a target user
    targetUser = {
      id: 'user1',
      username: 'testuser',
      isPlus: false,
      isMPlus: true,
      subscriptionEndDate: new Date('2025-06-21T00:00:00Z'),
      pausedSubscriptionId: null,
      giftCreditPlan: null,
      giftCreditEndDate: null,
      previousSubscriptionPlan: null,
    } as User;
    
    // Mock finding the target user
    (Users.findOneBy as any).mockResolvedValue(targetUser);
    (Users.findOneByOrFail as any).mockResolvedValue(targetUser);
  });
  
  test('Admin can add a new subscription', async () => {
    // Call the endpoint to add a subscription
    const result = await adminSubscriptionEndpoint.default({
      userId: targetUser.id,
      action: 'add',
      plan: 'plus',
      duration: 'month'
    }, adminUser);
    
    // Verify SubscriptionManager was called correctly
    expect(SubscriptionManager.applyGiftSubscription).toHaveBeenCalledWith(
      targetUser,
      'plus',
      'month'
    );
    
    // Check the response
    expect(result.success).toBe(true);
    expect(result.message).toContain('Added Barkle+ subscription');
  });
  
  test('Admin can extend an existing subscription', async () => {
    // Call the endpoint to extend a subscription
    const result = await adminSubscriptionEndpoint.default({
      userId: targetUser.id,
      action: 'extend',
      duration: 'year'
    }, adminUser);
    
    // Verify SubscriptionManager was called correctly
    expect(SubscriptionManager.extendSubscription).toHaveBeenCalledWith(
      targetUser,
      'year',
      'mplus'
    );
    
    // Check the response
    expect(result.success).toBe(true);
    expect(result.message).toContain('Extended Mini+ subscription');
  });
  
  test('Admin can remove a subscription', async () => {
    // Call the endpoint to remove a subscription
    const result = await adminSubscriptionEndpoint.default({
      userId: targetUser.id,
      action: 'remove'
    }, adminUser);
    
    // Verify user record is updated
    expect(Users.update).toHaveBeenCalledWith(
      { id: targetUser.id },
      expect.objectContaining({
        isPlus: false,
        isMPlus: false,
        subscriptionEndDate: null,
        previousSubscriptionPlan: null,
        pausedSubscriptionId: null
      })
    );
    
    // Check the response
    expect(result.success).toBe(true);
    expect(result.message).toBe('Removed subscription.');
  });
  
  test('Admin can upgrade a user from Mini+ to Barkle+', async () => {
    // Call the endpoint to upgrade
    const result = await adminSubscriptionEndpoint.default({
      userId: targetUser.id,
      action: 'upgrade'
    }, adminUser);
    
    // Verify user record is updated
    expect(Users.update).toHaveBeenCalledWith(
      { id: targetUser.id },
      expect.objectContaining({
        isPlus: true,
        isMPlus: false
      })
    );
    
    // Check the response
    expect(result.success).toBe(true);
    expect(result.message).toContain('Upgraded from Mini+ to Barkle+');
  });
  
  test('Admin can downgrade a user from Barkle+ to Mini+', async () => {
    // Change target user to Barkle+
    targetUser.isPlus = true;
    targetUser.isMPlus = false;
    
    // Call the endpoint to downgrade
    const result = await adminSubscriptionEndpoint.default({
      userId: targetUser.id,
      action: 'downgrade'
    }, adminUser);
    
    // Verify user record is updated
    expect(Users.update).toHaveBeenCalledWith(
      { id: targetUser.id },
      expect.objectContaining({
        isPlus: false,
        isMPlus: true
      })
    );
    
    // Check the response
    expect(result.success).toBe(true);
    expect(result.message).toContain('Downgraded from Barkle+ to Mini+');
  });
  
  test('Admin can add a gift credit', async () => {
    // Call the endpoint to add gift credit
    const result = await adminSubscriptionEndpoint.default({
      userId: targetUser.id,
      action: 'add-gift-credit',
      plan: 'mplus',
      duration: 'month'
    }, adminUser);
    
    // Verify SubscriptionManager was called correctly
    expect(SubscriptionManager.storeGiftCredit).toHaveBeenCalledWith(
      targetUser,
      'mplus',
      'month'
    );
    
    // Check the response
    expect(result.success).toBe(true);
    expect(result.message).toContain('Added Mini+ gift credit');
  });
  
  test('Throws error for invalid action', async () => {
    // Expect the endpoint to throw an error for invalid action
    await expect(adminSubscriptionEndpoint.default({
      userId: targetUser.id,
      action: 'invalid-action' as any
    }, adminUser)).rejects.toThrow();
  });
  
  test('Throws error for missing required parameters', async () => {
    // Expect the endpoint to throw an error when parameters are missing
    await expect(adminSubscriptionEndpoint.default({
      userId: targetUser.id,
      action: 'add',
      // Missing plan and duration
    }, adminUser)).rejects.toThrow();
  });
  
  test('Throws error when user not found', async () => {
    // Mock user not found
    (Users.findOneBy as any).mockResolvedValue(null);
    
    // Expect the endpoint to throw an error
    await expect(adminSubscriptionEndpoint.default({
      userId: 'non-existent-id',
      action: 'add',
      plan: 'plus',
      duration: 'month'
    }, adminUser)).rejects.toThrow();
  });
});
