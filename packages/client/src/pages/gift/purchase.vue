<template>
  <div class="gift-purchase-container">
    <h1 class="header">{{ i18n.ts._plus.gift.giftSubscription }}</h1>

    <div v-if="systemUnavailable" class="gift-system-unavailable">
      <i class="ph-warning-circle-bold"></i>
      <h3>Gift System Unavailable</h3>
      <p>The gift subscription system is currently under maintenance. Please try again later.</p>
      <MkButton link to="/settings/manage-plus" class="back-button">
        <i class="ph-arrow-left-bold"></i>
        Back to Barkle+
      </MkButton>
    </div>
    
    <template v-else>
      <div class="gift-description">
        <p>{{ i18n.ts._plus.gift.giftDescription }}</p>
      </div>
      
      <div class="plans-container">
        <div class="plan-card mini" :class="{ selected: selectedPlan === 'mplus' }" @click="selectPlan('mplus')">
          <h3>{{ i18n.ts._plus.gift.giftMini }}</h3>
        <div class="plan-features">
          <div class="feature">
            <i class="ph-cloud-arrow-up-bold"></i>
            <span>{{ i18n.ts._plus.uploads1GB }}</span>
          </div>
          <div class="feature">
            <i class="ph-sparkle-bold"></i>
            <span>{{ i18n.ts._plus.someDecorations }}</span>
          </div>
          <div class="feature">
            <i class="ph-dog-bold"></i>
            <span>{{ i18n.ts._plus.barklePlusBadge }}</span>
          </div>
        </div>
        <FormSelect v-model="subscriptionType" class="subscription-select">
          <option value="month">{{ i18n.ts.month }}</option>
          <option value="year">{{ i18n.ts.year }}</option>
        </FormSelect>
        <p class="pricing-info">
          {{ getPriceDisplay('mplus', subscriptionType) }}
        </p>
      </div>

      <div class="plan-card plus" :class="{ selected: selectedPlan === 'plus' }" @click="selectPlan('plus')">
        <h3>{{ i18n.ts._plus.gift.giftBarkle }}</h3>
        <div class="plan-features">
          <div class="feature">
            <i class="ph-cloud-arrow-up-bold"></i>
            <span>{{ i18n.ts._plus.uploads5GB }}</span>
          </div>
          <div class="feature">
            <i class="ph-sparkle-bold"></i>
            <span>{{ i18n.ts._plus.allDecorations }}</span>
          </div>
          <div class="feature">
            <i class="ph-code-bold"></i>
            <span>{{ i18n.ts._plus.profileCSS }}</span>
          </div>
          <div class="feature">
            <i class="ph-dog-bold"></i>
            <span>{{ i18n.ts._plus.barklePlusBadge }}</span>
          </div>
        </div>
        <FormSelect v-model="subscriptionType" class="subscription-select">
          <option value="month">{{ i18n.ts.month }}</option>
          <option value="year">{{ i18n.ts.year }}</option>
        </FormSelect>
        <p class="pricing-info">
          {{ getPriceDisplay('plus', subscriptionType) }}
        </p>
      </div>
    </div>

    <div class="gift-message-container">
      <FormTextarea
        v-model="giftMessage"
        :max="250"
        :placeholder="i18n.ts._plus.gift.giftMessagePlaceholder"
      >
        <template #label>{{ i18n.ts._plus.gift.giftRecipientMessage }}</template>
      </FormTextarea>
    </div>

    <div class="action-buttons">
      <MkButton primary class="purchase-button" @click="purchaseGift" :disabled="!selectedPlan">
        {{ i18n.ts._plus.gift.purchaseGift }}
      </MkButton>
    </div>
    </template>
    
    <div v-if="giftData" class="gift-success">
      <h2>{{ i18n.ts._plus.gift.giftSuccess }}</h2>
      <div class="gift-link-container">
        <p class="gift-link-label">{{ i18n.ts._plus.gift.giftLink }}</p>
        <div class="gift-link">
          <input type="text" readonly :value="giftLink" ref="giftLinkInput" />
          <MkButton class="copy-button" @click="copyGiftLink">
            <i class="ph-copy-bold"></i>
            {{ i18n.ts._plus.gift.copyGiftLink }}
          </MkButton>
        </div>
      </div>
      <p class="gift-expiry-note">{{ i18n.ts._plus.gift.giftExpiry }}</p>
      <div class="share-options">
        <p>{{ i18n.ts._plus.gift.shareVia }}</p>
        <div class="share-buttons">
          <MkButton class="share-button" @click="shareViaEmail">
            <i class="ph-envelope-bold"></i>
            Email
          </MkButton>
          <MkButton class="share-button" @click="shareAsMessage">
            <i class="ph-chat-bold"></i>
            {{ i18n.ts.shareAsMessage }}
          </MkButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import MkButton from '@/components/MkButton.vue';
import FormTextarea from '@/components/form/textarea.vue';
import FormSelect from '@/components/form/select.vue';
import * as os from '@/os';
import { i18n } from '@/i18n';
import { definePageMetadata } from '@/scripts/page-metadata';
import { $i } from '@/account';
import { Router } from '@/nirax';
const subscriptionType = ref<'month' | 'year'>('month');
const selectedPlan = ref<'mplus' | 'plus' | null>(null);
const giftMessage = ref('');
const giftData = ref(null);
const giftLinkInput = ref(null);
const priceInfo = ref(null);
const loadingPrices = ref(true);
const systemUnavailable = ref(false);

onMounted(async () => {
  try {
    // Check if the gift system is available
    await checkGiftSystemAvailability();
    
    if (!systemUnavailable.value) {
      // Only fetch prices if the system is available
      const prices = await os.api('stripe/prices');
      priceInfo.value = prices;
    }
  } catch (error) {
    console.error('Error during initialization:', error);
  } finally {
    loadingPrices.value = false;
  }
});

async function checkGiftSystemAvailability() {
  try {
    // Try to access the gift endpoints to see if they exist
    await os.api('gift/list-purchased', {});
    systemUnavailable.value = false;
  } catch (error) {
    console.error('Error checking gift system availability:', error);
    
    // If the endpoint doesn't exist, mark as unavailable
    if (error.code === 'NO_SUCH_ENDPOINT') {
      systemUnavailable.value = true;
    } else {
      // For other errors, still allow access but log the error
      systemUnavailable.value = false;
    }
  }
}

const giftLink = computed(() => {
  if (!giftData.value) return '';
  return `${window.location.origin}/gift/verify/${giftData.value.token}`;
});

function selectPlan(plan: 'mplus' | 'plus') {
  selectedPlan.value = plan;
}

function formatPrice(amount, currency) {
  if (!amount) return '';
  
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 2
  });
  
  return formatter.format(amount / 100); // Stripe prices are in cents
}

function getPriceDisplay(plan, type) {
  if (loadingPrices.value) {
    return i18n.ts.loading;
  }
  
  if (!priceInfo.value) {
    return plan === 'plus' 
      ? (type === 'month' ? '$4.99' : '$49.99 (Save 17%)')
      : (type === 'month' ? '$0.99' : '$9.99 (Save 17%)');
  }
  
  try {
    const priceId = type === 'month' 
      ? (plan === 'plus' ? 'price_id_gift_month_plus' : 'price_id_gift_month_mplus')
      : (plan === 'plus' ? 'price_id_gift_year_plus' : 'price_id_gift_year_mplus');
      
    const price = priceInfo.value[priceId];
    if (!price) return '—';
    
    const formattedPrice = formatPrice(price.amount, price.currency);
    if (type === 'year') {
      // Calculate the savings
      const monthlyPriceId = plan === 'plus' ? 'price_id_gift_month_plus' : 'price_id_gift_month_mplus';
      const monthlyPrice = priceInfo.value[monthlyPriceId];
      if (monthlyPrice) {
        const yearlyEquivalent = monthlyPrice.amount * 12;
        const savings = yearlyEquivalent - price.amount;
        if (savings > 0) {
          const formattedSavings = formatPrice(savings, price.currency);
          return `${formattedPrice}`;
        }
      }
    }
    
    return `${formattedPrice}`;
  } catch (error) {
    console.error('Error displaying price:', error);
    return '—';
  }
}

async function purchaseGift() {
  if (!selectedPlan.value) {
    os.alert({
      type: 'error',
      text: i18n.ts._plus.gift.giftToPurchase,
    });
    return;
  }

  console.log('[Debug] purchaseGift: selectedPlan =', selectedPlan.value);
  console.log('[Debug] purchaseGift: subscriptionType =', subscriptionType.value);
  console.log('[Debug] purchaseGift: giftMessage =', giftMessage.value);

  if (subscriptionType.value !== 'month' && subscriptionType.value !== 'year') {
    console.error('CRITICAL: subscriptionType is invalid before preparing payload:', subscriptionType.value);
    os.alert({
      type: 'error',
      title: 'Invalid Selection',
      text: 'The selected subscription duration is invalid. Please choose monthly or yearly and try again.',
    });
    return;
  }

  const payload = {
    plan: selectedPlan.value,
    subscriptionType: subscriptionType.value,
    isGift: true,
    giftMessage: giftMessage.value || undefined,
  };

  console.log('[Debug] purchaseGift: API Payload =', JSON.stringify(payload));

  try {
    const response = await os.api('plus/checkout', { ...payload });
    
    if (response.url) {
      window.open(response.url, '_blank');
      
      // Wait for the webhook to complete and fetch the gift token
      const pollForGift = async (attempts = 0) => {
        try {
          const gifts = await os.api('gift/list-purchased');
          const latestGift = gifts[0]; // Assuming sorted by most recent first
          if (latestGift && latestGift.status === 'pending_redemption') {
            giftData.value = latestGift;
          } else if (attempts < 5) { // Limit retries to 5 attempts
            // If not found, retry in a few seconds
            setTimeout(() => pollForGift(attempts + 1), 3000);
          } else {
            // After max attempts, show message but don't treat as error
            os.alert({
              type: 'info',
              title: 'Gift Purchase Processing',
              text: 'Your gift purchase is being processed. You can check your purchased gifts in the "My Gifts" section when the transaction is complete.',
            });
          }
        } catch (error) {
          console.error('Error polling for gift:', error);
          if (attempts < 5) {
            setTimeout(() => pollForGift(attempts + 1), 3000);
          }
        }
      };
      
      // Start polling after a brief delay to allow the checkout to complete
      setTimeout(() => pollForGift(), 5000);
    }
  } catch (error) {
    console.error('Error during gift purchase:', error);
    if (error.code === 'EMAIL_REQUIRED') {
      os.alert({
        type: 'error',
        title: i18n.ts._plus.emailRequiredTitle,
        text: i18n.ts._plus.emailRequiredMessage,
      });
    } else if (error.code === 'NO_SUCH_ENDPOINT') {
      os.alert({
        type: 'error',
        title: 'Gift System Unavailable',
        text: 'The gift subscription system is currently unavailable. Please try again later or contact support.',
      });
    } else if (error.code === 'STRIPE_ERROR') {
      os.alert({
        type: 'error',
        title: 'Payment Processing Error',
        text: 'There was an error processing your payment. Please check your payment details and try again.',
      });
    } else {
      // Show a general error alert instead of trying to redirect
      os.alert({
        type: 'error',
        title: 'Purchase Error',
        text: 'There was an error processing your gift purchase. Please try again later or contact support.'
      });
    }
  }
}

function copyGiftLink() {
  if (giftLinkInput.value) {
    giftLinkInput.value.select();
    document.execCommand('copy');
    os.success(i18n.ts._plus.gift.giftLinkCopied);
  }
}

function shareViaEmail() {
  const subject = encodeURIComponent('Gift Subscription to Barkle+');
  const body = encodeURIComponent(`I've sent you a gift subscription to Barkle+!\n\nClick here to redeem: ${giftLink.value}\n\n${giftMessage.value ? `Message: ${giftMessage.value}` : ''}\n\nThis gift link will expire in 1 year if not redeemed.`);
  window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
}

function shareAsMessage() {
  os.post({
    initialText: `I've purchased a gift subscription for you! Click here to redeem: ${giftLink.value}${giftMessage.value ? `\n\nMessage: ${giftMessage.value}` : ''}`,
    reply: null,
  });
}

definePageMetadata({
  title: i18n.ts._plus.gift.giftSubscription,
  icon: 'ph-gift-bold',
});
</script>

<style lang="scss" scoped>
.gift-purchase-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.header {
  text-align: center;
  margin-bottom: 24px;
  font-size: 24px;
  font-weight: bold;
}

.gift-system-unavailable {
  background: var(--errorBg, #f8d7da);
  border: 1px dashed var(--errorBorder, #f5c2c7);
  border-radius: 12px;
  padding: 2rem;
  text-align: center;
  margin: 2rem auto;
  max-width: 500px;
  
  i {
    font-size: 3rem;
    color: var(--error, #dc3545);
    margin-bottom: 1rem;
  }
  
  h3 {
    font-size: 1.5rem;
    margin-bottom: 1rem;
    color: var(--error, #dc3545);
  }
  
  p {
    font-size: 1.1rem;
    margin-bottom: 1.5rem;
  }
  
  .back-button {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    
    i {
      font-size: 1.2rem;
      margin: 0;
    }
  }
}

.gift-description {
  text-align: center;
  margin-bottom: 32px;
  font-size: 16px;
  color: var(--fg);
  opacity: 0.8;
}

.plans-container {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  justify-content: center;
  margin-bottom: 32px;
}

.plan-card {
  width: 300px;
  border-radius: 10px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: var(--panel);
  border: 2px solid transparent;

  &.selected {
    border-color: var(--accent);
    transform: translateY(-4px);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
  }

  &.mini {
    background: linear-gradient(135deg, var(--panel) 0%, var(--panel) 100%);
    
    &.selected {
      border-color: #AD90E4;
    }
  }
  
  &.plus {
    background: linear-gradient(135deg, var(--panel) 0%, var(--panel) 100%);
    
    &.selected {
      border-color: #90CAE4;
    }
  }

  h3 {
    text-align: center;
    margin-bottom: 16px;
    font-size: 18px;
    font-weight: bold;
  }
}

.plan-features {
  margin-bottom: 20px;
}

.feature {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  
  i {
    margin-right: 10px;
    color: var(--accent);
    font-size: 18px;
  }
}

.subscription-select {
  margin-bottom: 12px;
  width: 100%;
}

.pricing-info {
  text-align: center;
  font-size: 14px;
  margin-top: 12px;
  color: var(--fg);
  opacity: 0.8;
}

.gift-message-container {
  margin-bottom: 24px;
}

.action-buttons {
  display: flex;
  justify-content: center;
  margin-bottom: 32px;
}

.purchase-button {
  padding: 10px 36px;
  font-size: 16px;
  font-weight: bold;
}

.gift-success {
  background: var(--panel);
  border-radius: 10px;
  padding: 24px;
  margin-top: 32px;
  
  h2 {
    text-align: center;
    margin-bottom: 24px;
    font-size: 20px;
    font-weight: bold;
    color: var(--accent);
  }
}

.gift-link-container {
  margin-bottom: 20px;
}

.gift-link-label {
  font-weight: bold;
  margin-bottom: 8px;
}

.gift-link {
  display: flex;
  align-items: center;
  gap: 10px;
  
  input {
    flex: 1;
    padding: 8px 12px;
    border-radius: 4px;
    border: 1px solid var(--divider);
    background: var(--bg);
    color: var(--fg);
  }
}

.gift-expiry-note {
  text-align: center;
  margin: 16px 0;
  font-size: 14px;
  color: var(--fg);
  opacity: 0.8;
}

.share-options {
  margin-top: 24px;
  
  p {
    text-align: center;
    margin-bottom: 16px;
  }
}

.share-buttons {
  display: flex;
  justify-content: center;
  gap: 16px;
}

.share-button {
  display: flex;
  align-items: center;
  
  i {
    margin-right: 8px;
  }
}
</style>
