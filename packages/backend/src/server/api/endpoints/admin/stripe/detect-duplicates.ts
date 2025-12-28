import define from '../../../define.js';
import { fetchMeta } from '@/misc/fetch-meta.js';
import { Users } from '@/models/index.js';
import Stripe from 'stripe';

export const meta = {
  tags: ['admin'],
  requireCredential: true,
  requireModerator: true,

  res: {
    type: 'object',
    optional: false, nullable: false,
    properties: {
      duplicateUsers: {
        type: 'array',
        optional: false, nullable: false,
        items: {
          type: 'object',
          properties: {
            userId: { type: 'string' },
            username: { type: 'string' },
            email: { type: 'string' },
            customerCount: { type: 'number' },
            customers: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  created: { type: 'number' },
                  hasActiveSubscriptions: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
      totalDuplicates: { type: 'number' },
    },
  },
} as const;

export const paramDef = {
  type: 'object',
  properties: {},
  required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
  const instance = await fetchMeta();
  if (!instance.stripe_key) {
    return {
      duplicateUsers: [],
      totalDuplicates: 0,
    };
  }

  const stripe = new Stripe(instance.stripe_key, {
    apiVersion: '2024-06-20',
  });

  // Get all users with Stripe customers
  const usersWithStripeCustomers = await Users.createQueryBuilder('user')
    .leftJoinAndSelect('user.profile', 'profile')
    .where('user.stripe_user IS NOT NULL')
    .getMany();

  const duplicateUsers = [];

  for (const targetUser of usersWithStripeCustomers) {
    const userEmail = targetUser.profile?.email;
    if (!userEmail) continue;

    try {
      // Find all customers with this email
      const customers = await stripe.customers.list({
        email: userEmail,
        limit: 100
      });

      const userCustomers = customers.data.filter(customer => 
        customer.metadata.userId === targetUser.id
      );

      if (userCustomers.length > 1) {
        // Check for active subscriptions on each customer
        const customerDetails = await Promise.all(
          userCustomers.map(async (customer) => {
            const subscriptions = await stripe.subscriptions.list({
              customer: customer.id,
              status: 'active',
              limit: 10
            });

            return {
              id: customer.id,
              created: customer.created,
              hasActiveSubscriptions: subscriptions.data.length > 0,
            };
          })
        );

        duplicateUsers.push({
          userId: targetUser.id,
          username: targetUser.username,
          email: userEmail,
          customerCount: userCustomers.length,
          customers: customerDetails,
        });
      }
    } catch (error) {
      console.error(`Error checking duplicates for user ${targetUser.id}:`, error);
    }
  }

  return {
    duplicateUsers,
    totalDuplicates: duplicateUsers.length,
  };
});