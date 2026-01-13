# Barkle Modifications to Calckey/Misskey

This document lists all modifications made by Barkle to the upstream Calckey/Misskey codebase, as required by AGPL-3.0.

## Database Schema Changes

### New Tables

- `quick_bark` - Ephemeral posts that expire after 24 hours
- `quick_bark_view` - View tracking for quick barks
- `gifted_subscription` - Gift subscription management
- `stripe_event` - Webhook event tracking for idempotency
- `live_chat_message` - Real-time chat for live streams
- `contact_import` - Privacy-preserving contact matching
- `webhook_event` - Generic webhook event tracking
- `algorithm_experiment` - A/B testing framework

### Modified Tables

**User table additions:**
- `isVerified`, `isStaff`, `isTranslator`, `isOG`, `hasAlgoBeta`, `isPlus`, `isMPlus`, `isLive`
- `subscriptionEndDate`, `subscriptionStatus`, `pausedSubscriptionId`
- `giftCreditPlan`, `giftCreditEndDate`
- `barklePlusCredits`, `miniPlusCredits`, `barklePlusCreditsExpiry`, `miniPlusCreditsExpiry`
- `previousSubscriptionPlan`

**Meta table additions:**
- `preReleaseMode`, `preReleaseAllowedRoles`, `preReleaseAllowedUserIds`
- `price_id_gift_month_plus`, `price_id_gift_year_plus`, `price_id_gift_month_mplus`, `price_id_gift_year_mplus`

## New Directories

- `packages/backend/src/services/stripe/` - Stripe payment integration
- `packages/backend/src/services/webhooks/` - Webhook framework
- `packages/backend/src/services/subscription-*.ts` - Subscription management
- `packages/backend/src/services/contact-*.ts` - Contact import services
- `packages/backend/src/services/positive-reinforcement.ts` - Engagement system
- `packages/backend/src/services/algorithm-*.ts` - Algorithm integration
- `packages/backend/src/daemons/subscription-expiry-daemon.ts` - Subscription expiry
- `packages/backend/src/daemons/quick-bark-janitor.ts` - Cleanup expired barks
- `packages/backend/src/queue/processors/subscription.ts` - Subscription jobs
- `packages/backend/src/server/api/endpoints/stripe/` - Stripe API endpoints
- `packages/backend/src/server/api/endpoints/subscription/` - Subscription endpoints
- `packages/backend/src/server/api/endpoints/quick-barks/` - Quick barks endpoints
- `packages/backend/src/server/api/endpoints/live-*.ts` - Live streaming endpoints
- `packages/backend/src/server/api/endpoints/live-chat/` - Live chat endpoints
- `packages/backend/src/server/api/endpoints/contacts/` - Contact import endpoints
- `packages/backend/src/server/api/endpoints/gift/` - Gift subscription endpoints
- `packages/backend/src/server/api/endpoints/positive-reinforcement/` - Engagement endpoints
- `packages/backend/src/server/api/stream/channels/stream-chat.ts` - Live chat streaming
- `packages/backend/src/models/entities/quick-bark*.ts` - Quick barks models
- `packages/backend/src/models/entities/gifted-subscription.ts` - Gift subscription model
- `packages/backend/src/models/entities/stripe-event.ts` - Stripe event model
- `packages/backend/src/models/entities/live-chat-message.ts` - Live chat model
- `packages/backend/src/models/entities/contact-import.ts` - Contact import model
- `packages/backend/src/models/entities/webhook-event.ts` - Webhook event model
- `packages/backend/src/models/entities/algorithm-experiment.ts` - A/B testing model
- `packages/backend/src/types/subscription-status.enum.ts` - Subscription status enum
- `packages/algorithm/` - Complete algorithm package
- `packages/client/src/pages/quick-barks/` - Quick barks UI
- `packages/client/src/pages/gift/` - Gift subscription UI
- `packages/client/src/components/MkQuickBark*.vue` - Quick barks components
- `packages/client/src/components/growth/` - Growth features
- `packages/client/src/services/positive-reinforcement.ts` - Client engagement service

## Modified Files

### Branding Changes
- `packages/client/src/pages/about-barkle.vue` - Barkle-specific about page
- `packages/client/src/ui/_common_/navbar-guest.vue` - Added open source menu

### Configuration
- `packages/backend/src/config/types.ts` - Added Stripe and subscription config
- `packages/backend/src/config/load.ts` - Load subscription configuration

### Boot/Initialization
- `packages/backend/src/boot/index.ts` - Initialize Stripe and algorithm services
- `packages/backend/src/boot/master.ts` - Register subscription daemons
- `packages/client/src/init.ts` - Initialize algorithm tracking

### API Endpoints Registration
- `packages/backend/src/server/api/endpoints.ts` - Register new endpoints

### Models
- `packages/backend/src/models/index.ts` - Add new entity exports
- `packages/backend/src/db/postgre.ts` - Add new repository exports

### User Entity
- `packages/backend/src/models/entities/user.ts` - Add subscription fields

### Services
- `packages/backend/src/services/note/create.ts` - Integration with algorithm service
- `packages/backend/src/services/note/reaction/create.ts` - Integration with positive reinforcement

### Client Router
- `packages/client/src/router.ts` - Add new routes

### Client Store
- `packages/client/src/store.ts` - Add subscription state

## New Features

### 1. Stripe Integration
- Complete payment processing via Stripe
- Checkout session creation for subscriptions and gifts
- Webhook handling for subscription events
- Customer portal for subscription management
- Trial user management

### 2. Subscription System
- Barkle+ and Mini+ subscription tiers
- Credit-based pause/resume functionality
- Gift subscription purchase and redemption
- Subscription expiry tracking

### 3. Quick Barks
- Ephemeral posts (text, image, video, GIF)
- Automatic expiry after 24 hours
- View tracking
- Real-time timeline

### 4. Live Streaming
- Live chat for streams
- Moderator management
- Message deletion

### 5. Contact Import
- Privacy-preserving contact upload (SHA-256 hashed)
- Contact matching to existing users
- Social graph inference

### 6. Algorithm Package
- Advanced timeline ranking
- A/B testing framework
- Real-time learning
- Content quality assessment
- Diversification engine
- Performance optimization

### 7. User Roles
- Verified, Staff, Translator, Plus, Mini+, OG, AlgoBeta, Live roles

## Database Migrations

All Barkle-specific migrations:
- `1704067200000-CreateLiveChatMessageTable.js`
- `1730232000000-AddStripeEventTable.js`
- `1730590000000-RevenueCatIntegration.js`
- `1730926000000-AddSourceToContactImport.js`
- `1732866000000-AddWebhookEventTable.js`
- `20250509000000-CreateGiftedSubscriptionTable.js`
- `20250509100000-CreateGiftedSubscriptionTable.js`
- `20250521000000-AddSubscriptionFieldsToUser.js`
- `20250524000000-AddCreditSystemToUser.js`
- `20250710000001-AddAllMissingColumns.js`
- `20250710000002-AddAllMissingColumnsComprehensive.js`
- `20250710000003-AddAllMissingColumnsComprehensive.js`
- `20250710100000-AddAllMissingColumns.js`
- `20250710210000-AddMissingColumns.js`
- `20250712000001-UpdateStreamsIdLength.js`
- `20250715000001-FixLiveChatMessageStreamIdLength.js`
- `20250903000000-CreateContactImportTable.js`
- `20251016000000-FixSubscriptionSystemComprehensive.js`
- `20251102000000-CreateQuickBarksTables.js`

## Dependencies Added

Key new dependencies:
- `stripe` - Stripe payment processing
- Additional algorithm and psychology-related packages

## Removed Files

None - Barkle is additive to Calckey/Misskey, no core features removed.

## Upstream Fork

Barkle is forked from:
- [Misskey](https://github.com/misskey-dev/misskey)
- [Calckey](https://codeberg.org/calckey/calckey)

Original license: GNU Affero General Public License v3.0 (AGPL-3.0)
