import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { initTestDb, clearDb, closeDb } from '../utils/test-db.js';
import { GiftedSubscriptions, Users } from '@/models/index.js';
import { User } from '@/models/entities/user.js';
import { SubscriptionManager } from '@/services/subscription-manager.js';
import fetch from 'node-fetch';
import { createAppAndServer } from '@/server/index.js';

describe('Gift Subscription System', () => {
  let app: any;
  let server: any;
  let baseUrl: string;
  let testUsers: { [key: string]: User } = {};
  let testGifts: any[] = [];

  // Set up test database and server
  beforeAll(async () => {
    await initTestDb();
    const appServer = await createAppAndServer();
    app = appServer.app;
    server = appServer.server;
    baseUrl = `http://localhost:${server.address().port}/api`;

    // Create test users
    testUsers.noSub = await createTestUser('nosub');
    testUsers.miniPlus = await createTestUser('miniplus', { isMPlus: true });
    testUsers.barklePlus = await createTestUser('barkleplus', { isPlus: true });
  });

  afterAll(async () => {
    await closeDb();
    if (server) await server.close();
  });

  afterEach(async () => {
    // Clean up created gifts
    for (const gift of testGifts) {
      try {
        await GiftedSubscriptions.delete(gift.id);
      } catch (e) {
        // Ignore errors
      }
    }
    testGifts = [];
  });

  // Helper to create test users
  async function createTestUser(username: string, flags = {}): Promise<User> {
    const user = await Users.insert({
      username,
      usernameLower: username.toLowerCase(),
      host: null,
      createdAt: new Date(),
      ...flags
    } as Partial<User>).then(result => Users.findOneBy({ id: result.identifiers[0].id }));
    return user!;
  }

  // Helper to create test gifts
  async function createTestGift(options: {
    purchasedByUserId: string;
    plan: 'plus' | 'mplus';
    subscriptionType: 'month' | 'year';
  }) {
    const gift = await GiftedSubscriptions.createGift(options);
    testGifts.push(gift);
    return gift;
  }

  test('Case 1: User with no subscription accepts a Mini+ gift', async () => {
    // Create a gift
    const gift = await createTestGift({
      purchasedByUserId: testUsers.barklePlus.id,
      plan: 'mplus',
      subscriptionType: 'month',
    });

    // Apply the gift to the user with no subscription
    const now = new Date();
    const endDate = await SubscriptionManager.applyGiftSubscription(
      testUsers.noSub,
      'mplus',
      'month'
    );

    // Reload user
    const updatedUser = await Users.findOneByOrFail({ id: testUsers.noSub.id });

    // Check that user now has Mini+
    expect(updatedUser.isMPlus).toBe(true);
    expect(updatedUser.isPlus).toBe(false);
    expect(updatedUser.subscriptionEndDate).not.toBeNull();
    
    // Check that end date is approximately 1 month later (within 5 minutes)
    const expectedEndDate = new Date(now);
    expectedEndDate.setMonth(expectedEndDate.getMonth() + 1);
    const timeDiff = Math.abs(expectedEndDate.getTime() - endDate.getTime());
    expect(timeDiff).toBeLessThan(5 * 60 * 1000);
  });

  test('Case 2: User with Mini+ accepts Mini+ gift (extension)', async () => {
    // Set up user with existing Mini+ subscription ending in 15 days
    const now = new Date();
    const existingEndDate = new Date(now);
    existingEndDate.setDate(existingEndDate.getDate() + 15);
    
    await Users.update({ id: testUsers.miniPlus.id }, {
      subscriptionEndDate: existingEndDate
    });
    
    // Reload user
    const user = await Users.findOneByOrFail({ id: testUsers.miniPlus.id });
    
    // Create a gift
    const gift = await createTestGift({
      purchasedByUserId: testUsers.barklePlus.id,
      plan: 'mplus',
      subscriptionType: 'month',
    });
    
    // Apply the gift to extend the subscription
    const newEndDate = await SubscriptionManager.extendSubscription(
      user,
      'month',
      'mplus'
    );
    
    // Reload user
    const updatedUser = await Users.findOneByOrFail({ id: testUsers.miniPlus.id });
    
    // Check that end date is extended by 1 month from original end date
    const expectedEndDate = new Date(existingEndDate);
    expectedEndDate.setMonth(expectedEndDate.getMonth() + 1);
    const timeDiff = Math.abs(expectedEndDate.getTime() - newEndDate.getTime());
    expect(timeDiff).toBeLessThan(5 * 60 * 1000);
    
    // Check that user still has Mini+
    expect(updatedUser.isMPlus).toBe(true);
    expect(updatedUser.isPlus).toBe(false);
  });

  test('Case 3: User with Barkle+ accepts Barkle+ gift (extension)', async () => {
    // Set up user with existing Barkle+ subscription ending in 15 days
    const now = new Date();
    const existingEndDate = new Date(now);
    existingEndDate.setDate(existingEndDate.getDate() + 15);
    
    await Users.update({ id: testUsers.barklePlus.id }, {
      subscriptionEndDate: existingEndDate
    });
    
    // Reload user
    const user = await Users.findOneByOrFail({ id: testUsers.barklePlus.id });
    
    // Create a gift
    const gift = await createTestGift({
      purchasedByUserId: testUsers.miniPlus.id,
      plan: 'plus',
      subscriptionType: 'month',
    });
    
    // Apply the gift to extend the subscription
    const newEndDate = await SubscriptionManager.extendSubscription(
      user,
      'month',
      'plus'
    );
    
    // Reload user
    const updatedUser = await Users.findOneByOrFail({ id: testUsers.barklePlus.id });
    
    // Check that end date is extended by 1 month from original end date
    const expectedEndDate = new Date(existingEndDate);
    expectedEndDate.setMonth(expectedEndDate.getMonth() + 1);
    const timeDiff = Math.abs(expectedEndDate.getTime() - newEndDate.getTime());
    expect(timeDiff).toBeLessThan(5 * 60 * 1000);
    
    // Check that user still has Barkle+
    expect(updatedUser.isPlus).toBe(true);
    expect(updatedUser.isMPlus).toBe(false);
  });

  test('Case 4: User with Mini+ accepts Barkle+ gift (upgrade)', async () => {
    // Create a gift
    const gift = await createTestGift({
      purchasedByUserId: testUsers.barklePlus.id,
      plan: 'plus',
      subscriptionType: 'month',
    });
    
    // Apply the gift to upgrade from Mini+ to Barkle+
    const endDate = await SubscriptionManager.applyGiftSubscription(
      testUsers.miniPlus,
      'plus',
      'month'
    );
    
    // Reload user
    const updatedUser = await Users.findOneByOrFail({ id: testUsers.miniPlus.id });
    
    // Check that user now has Barkle+ instead of Mini+
    expect(updatedUser.isPlus).toBe(true);
    expect(updatedUser.isMPlus).toBe(false);
    
    // Check that previous subscription plan is stored
    expect(updatedUser.previousSubscriptionPlan).toBe('mplus');
    
    // Check end date
    expect(updatedUser.subscriptionEndDate).not.toBeNull();
    const now = new Date();
    const expectedEndDate = new Date(now);
    expectedEndDate.setMonth(expectedEndDate.getMonth() + 1);
    const timeDiff = Math.abs(expectedEndDate.getTime() - endDate.getTime());
    expect(timeDiff).toBeLessThan(5 * 60 * 1000);
  });

  test('Case 5: User with Barkle+ accepts Mini+ gift (store credit)', async () => {
    // Create a gift
    const gift = await createTestGift({
      purchasedByUserId: testUsers.miniPlus.id,
      plan: 'mplus',
      subscriptionType: 'month',
    });
    
    // Apply the gift to store as credit
    const creditEndDate = await SubscriptionManager.storeGiftCredit(
      testUsers.barklePlus,
      'mplus',
      'month'
    );
    
    // Reload user
    const updatedUser = await Users.findOneByOrFail({ id: testUsers.barklePlus.id });
    
    // Check that user still has Barkle+
    expect(updatedUser.isPlus).toBe(true);
    expect(updatedUser.isMPlus).toBe(false);
    
    // Check that gift credit is stored
    expect(updatedUser.giftCreditPlan).toBe('mplus');
    expect(updatedUser.giftCreditEndDate).not.toBeNull();
    
    // Check credit end date
    const now = new Date();
    const expectedEndDate = new Date(now);
    expectedEndDate.setMonth(expectedEndDate.getMonth() + 1);
    const timeDiff = Math.abs(expectedEndDate.getTime() - creditEndDate.getTime());
    expect(timeDiff).toBeLessThan(5 * 60 * 1000);
  });

  test('Case 6: User with gift credit has subscription expire', async () => {
    // Set up user with Barkle+ expiring today and Mini+ credit
    const now = new Date();
    const creditEndDate = new Date(now);
    creditEndDate.setMonth(creditEndDate.getMonth() + 1);
    
    await Users.update({ id: testUsers.barklePlus.id }, {
      subscriptionEndDate: now,
      giftCreditPlan: 'mplus',
      giftCreditEndDate: creditEndDate
    });
    
    // Reload user
    const user = await Users.findOneByOrFail({ id: testUsers.barklePlus.id });
    
    // Simulate checking for expired subscriptions
    await SubscriptionManager.applyGiftCredit(user, 'mplus', 'month');
    
    // Reload user
    const updatedUser = await Users.findOneByOrFail({ id: testUsers.barklePlus.id });
    
    // Check that user now has Mini+ instead of Barkle+
    expect(updatedUser.isPlus).toBe(false);
    expect(updatedUser.isMPlus).toBe(true);
    
    // Check that gift credit is cleared
    expect(updatedUser.giftCreditPlan).toBeNull();
    expect(updatedUser.giftCreditEndDate).toBeNull();
    
    // Check that subscription end date is set to credit end date
    expect(updatedUser.subscriptionEndDate).not.toBeNull();
    const timeDiff = Math.abs(creditEndDate.getTime() - updatedUser.subscriptionEndDate!.getTime());
    expect(timeDiff).toBeLessThan(5 * 60 * 1000);
  });

  test('Case 7: Barkle+ gift expires, user had Mini+ before (downgrade)', async () => {
    // Set up user with Barkle+ expiring today and previous Mini+ subscription
    const now = new Date();
    
    await Users.update({ id: testUsers.miniPlus.id }, {
      isPlus: true,
      isMPlus: false,
      subscriptionEndDate: now,
      previousSubscriptionPlan: 'mplus'
    });
    
    // Reload user
    const user = await Users.findOneByOrFail({ id: testUsers.miniPlus.id });
    
    // Simulate gift expiration
    await SubscriptionManager.handleExpiredGift(user);
    
    // Reload user
    const updatedUser = await Users.findOneByOrFail({ id: testUsers.miniPlus.id });
    
    // Check that user now has Mini+ instead of Barkle+
    expect(updatedUser.isPlus).toBe(false);
    expect(updatedUser.isMPlus).toBe(true);
    
    // Check that previous subscription plan is cleared
    expect(updatedUser.previousSubscriptionPlan).toBeNull();
    
    // Check that subscription end date is cleared
    expect(updatedUser.subscriptionEndDate).toBeNull();
  });

  // Add these helper functions to properly test the gift redeem endpoint
  async function authenticateUser(user: User): Promise<string> {
    // This would depend on your application's authentication method
    // For testing purposes, you might need to create an API token for the user
    return 'dummy-token-for-testing';
  }

  async function redeemGift(token: string, authToken: string): Promise<any> {
    const response = await fetch(`${baseUrl}/gift/redeem`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ token })
    });
    
    return response.json();
  }
});
