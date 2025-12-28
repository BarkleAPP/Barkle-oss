import Koa from 'koa';
import rndstr from 'rndstr';
import bcrypt from 'bcryptjs';
import Stripe from 'stripe';
import { fetchMeta } from '@/misc/fetch-meta.js';
import { verifyHcaptcha, verifyRecaptcha } from '@/misc/captcha.js';
import { Users, RegistrationTickets, UserPendings } from '@/models/index.js';
import { signup } from '../common/signup.js';
import config from '@/config/index.js';
import { sendEmail } from '@/services/send-email.js';
import { genId } from '@/misc/gen-id.js';
import { validateEmailForAccount } from '@/services/validate-email-for-account.js';

interface SignupBody {
  username: string;
  password: string;
  host?: string;
  invitationCode?: string;
  emailAddress?: string;
  'hcaptcha-response'?: string;
  'g-recaptcha-response'?: string;
}

/**
 * Create Stripe customer asynchronously (non-blocking)
 */
async function createStripeCustomerAsync(
  userId: string, 
  username: string, 
  emailAddress: string | undefined, 
  stripeKey: string
): Promise<void> {
  try {
    console.log(`🔧 STRIPE: Creating customer for user ${userId} in background`);
    
    const stripe = new Stripe(stripeKey, {
      apiVersion: '2024-06-20',
    });

    // Create Stripe customer
    const customer = await stripe.customers.create({
      email: emailAddress || undefined,
      metadata: { userId, username },
    });

    // Update user with Stripe customer ID
    await Users.update({ id: userId }, { stripe_user: [customer.id] });
    
    console.log(`🔧 STRIPE: Customer ${customer.id} created for user ${userId}`);
  } catch (error) {
    console.error(`❌ STRIPE ERROR: Failed to create customer for user ${userId}:`, error);
    // Don't throw - this is non-blocking
  }
}

export default async (ctx: Koa.Context) => {
  const body = ctx.request.body as SignupBody;
  const instance = await fetchMeta(true);

  // Verify *Captcha
  if (process.env.NODE_ENV !== 'test') {
    if (instance.enableHcaptcha && instance.hcaptchaSecretKey) {
      await verifyHcaptcha(instance.hcaptchaSecretKey, body['hcaptcha-response'] || '').catch(e => {
        ctx.throw(400, e);
      });
    }
    if (instance.enableRecaptcha && instance.recaptchaSecretKey) {
      await verifyRecaptcha(instance.recaptchaSecretKey, body['g-recaptcha-response'] || '').catch(e => {
        ctx.throw(400, e);
      });
    }
  }

  const username = body.username;
  const password = body.password;
  const host: string | null = process.env.NODE_ENV === 'test' ? (body.host || null) : null;
  const invitationCode = body.invitationCode;
  const emailAddress = body.emailAddress;

  if (instance.emailRequiredForSignup) {
    if (emailAddress == null || typeof emailAddress !== 'string') {
      ctx.status = 400;
      return;
    }
    const available = await validateEmailForAccount(emailAddress);
    if (!available) {
      ctx.status = 400;
      return;
    }
  }

  if (instance.disableRegistration) {
    if (invitationCode == null || typeof invitationCode !== 'string') {
      ctx.status = 400;
      return;
    }
    const ticket = await RegistrationTickets.findOneBy({
      code: invitationCode,
    });
    if (ticket == null) {
      ctx.status = 400;
      return;
    }
    RegistrationTickets.delete(ticket.id);
  }

  // Check pre-release restrictions
  if (instance.preReleaseMode) {
    ctx.status = 403;
    ctx.body = {
      error: {
        message: 'Registration is currently restricted to select users during our pre-release phase.',
        code: 'PRE_RELEASE_REGISTRATION_DISABLED',
        id: 'pre-release-registration-disabled'
      }
    };
    return;
  }

  if (instance.emailRequiredForSignup) {
    const code = rndstr('a-z0-9', 16);
    const salt = await bcrypt.genSalt(8);
    const hash = await bcrypt.hash(password, salt);

    await UserPendings.insert({
      id: genId(),
      createdAt: new Date(),
      code,
      email: emailAddress,
      username: username,
      password: hash,
    });

    const link = `${config.url}/signup-complete/${code}`;
    sendEmail(emailAddress, 'Signup',
      `To complete signup, please click this link:<br><a href="${link}">${link}</a>`,
      `To complete signup, please click this link: ${link}`);

    ctx.status = 204;
  } else {
    try {
      const { account, secret } = await signup({
        username, password, host,
      });

      // Handle invitation code if provided
      if (invitationCode) {
        console.log(`🎁 SIGNUP DEBUG: Processing invitation code ${invitationCode} for new user ${account.id}`);
        try {
          // Import invitation service
          const { InvitationService } = await import('@/services/invitation-service.js');
          const invitationService = new InvitationService();

          console.log(`🎁 SIGNUP DEBUG: InvitationService imported and instantiated successfully`);

          // Process the invitation for the new user and distribute rewards
          const result = await invitationService.processInvitationForNewUser(invitationCode, account.id);
          console.log(`🎁 SIGNUP DEBUG: Invitation processing completed successfully:`, result);
        } catch (inviteError) {
          console.error('❌ SIGNUP ERROR: Failed to process invitation during signup:', inviteError);
          console.error('❌ SIGNUP ERROR: Stack trace:', inviteError.stack);
          // Don't fail the signup if invitation processing fails
        }
      } else {
        console.log(`🎁 SIGNUP DEBUG: No invitation code provided for user ${account.id}`);
      }

      // Create Stripe customer if stripe_key is available (NON-BLOCKING)
      if (instance.stripe_key) {
        // Run Stripe customer creation in background to avoid blocking signup
        this.createStripeCustomerAsync(account.id, account.username, emailAddress, instance.stripe_key)
          .catch(error => {
            console.error('❌ STRIPE ERROR: Failed to create customer for user', account.id, ':', error);
          });
      }

      const res = await Users.pack(account, account, {
        detail: true,
        includeSecrets: true,
      });
      (res as any).token = secret;
      ctx.body = res;
    } catch (e) {
      ctx.throw(400, e instanceof Error ? e.message : 'Unknown error');
    }
  }
};