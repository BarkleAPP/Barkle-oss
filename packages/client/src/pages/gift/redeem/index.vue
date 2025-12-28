<template>
  <div class="gift-redeem-container">
    <div class="gift-card">
      <div class="gift-icon">
        <i class="ph-gift-bold"></i>
      </div>
      <h1 class="header">{{ i18n.ts._plus.gift.redeemGift }}</h1>

      <div v-if="!isTokenProvided" class="gift-code-input">
        <FormInput
          v-model="giftToken"
          :placeholder="i18n.ts._plus.gift.giftCodePlaceholder"
        >
          <template #label>{{ i18n.ts._plus.gift.enterGiftCode }}</template>
        </FormInput>
        <MkButton primary class="redeem-button" @click="redeemGift" :disabled="!giftToken">
          {{ i18n.ts._plus.gift.redeemButton }}
        </MkButton>
      </div>
      
      <div v-else-if="!redeemingComplete" class="gift-details">
        <div v-if="loadingGift" class="loading-gift">
          <MkLoading />
          <p>{{ i18n.ts.loading }}</p>
        </div>
        
        <div v-else-if="giftError" class="gift-error">
          <i class="ph-warning-circle-bold"></i>
          <p>{{ giftError }}</p>
          <MkButton @click="resetForm">{{ i18n.ts.tryAgain }}</MkButton>
        </div>
        
        <div v-else-if="giftDetails" class="gift-info">
          <p class="gift-type">
            {{ giftDetails.plan === 'plus' ? i18n.ts._plus.barklePlus : i18n.ts._plus.miniBarklePlus }}
            ({{ giftDetails.subscriptionType === 'month' ? i18n.ts._plus.monthly : i18n.ts._plus.yearly }})
          </p>
          
          <p class="gift-value">
            {{ getPriceDisplay(giftDetails.plan, giftDetails.subscriptionType) }}
          </p>
          
          <div v-if="giftDetails.message" class="gift-message">
            <p class="message-label">{{ i18n.ts._plus.gift.giftRecipientMessage }}:</p>
            <p class="message-content">{{ giftDetails.message }}</p>
          </div>
          
          <MkButton primary class="confirm-redeem-button" @click="confirmRedemption">
            {{ i18n.ts._plus.gift.redeemButton }}
          </MkButton>
        </div>
      </div>
      
      <div v-else class="redemption-success">
        <i class="ph-check-circle-bold"></i>
        <h2>{{ i18n.ts._plus.gift.redeemSuccess }}</h2>
        <p class="plan-details">
          {{ redeemResponse.plan === 'plus' ? i18n.ts._plus.barklePlus : i18n.ts._plus.miniBarklePlus }}
          {{ i18n.ts._plus.gift.redeemSuccess }}
        </p>
        <p class="subscription-details">
          {{ i18n.ts.expires }}:
          {{ new Date(redeemResponse.subscriptionEndDate).toLocaleDateString() }}
        </p>
        <div class="action-buttons">
          <MkButton primary class="explore-button" link to="/settings/manage-plus">
            {{ i18n.ts._plus.welcomeToBarklePlus }}
          </MkButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import MkButton from '@/components/MkButton.vue';
import FormInput from '@/components/form/input.vue';
//import MkLoading from '@/components/MkLoading.vue';
import * as os from '@/os';
import { i18n } from '@/i18n';
import { definePageMetadata } from '@/scripts/page-metadata';

const route = useRoute();
const giftToken = ref('');
const loadingGift = ref(false);
const giftDetails = ref(null);
const giftError = ref(null);
const redeemingComplete = ref(false);
const redeemResponse = ref(null);
const priceInfo = ref(null);
const loadingPrices = ref(true);

onMounted(async () => {
  try {
    // Fetch pricing information
    const prices = await os.api('stripe/prices');
    priceInfo.value = prices;
  } catch (error) {
    console.error('Error fetching prices:', error);
  } finally {
    loadingPrices.value = false;
  }

  if (route.params.token) {
    giftToken.value = route.params.token as string;
    await fetchGiftDetails();
  }
});

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
      ? (type === 'month' ? '$5/month' : '$50/year (Value of $60)')
      : (type === 'month' ? '$3/month' : '$30/year (Value of $36)');
  }
  
  try {
    const priceId = type === 'month' 
      ? (plan === 'plus' ? 'price_id_gift_month_plus' : 'price_id_gift_month_mplus')
      : (plan === 'plus' ? 'price_id_gift_year_plus' : 'price_id_gift_year_mplus');
      
    const price = priceInfo.value[priceId];
    if (!price) return '—';
    
    const formattedPrice = formatPrice(price.amount, price.currency);
    if (type === 'year') {
      // Calculate the value
      const monthlyPriceId = plan === 'plus' ? 'price_id_gift_month_plus' : 'price_id_gift_month_mplus';
      const monthlyPrice = priceInfo.value[monthlyPriceId];
      if (monthlyPrice) {
        const yearlyEquivalent = monthlyPrice.amount * 12;
        const formattedValue = formatPrice(yearlyEquivalent, price.currency);
        return `${formattedPrice} (Value of ${formattedValue})`;
      }
    }
    
    return `${formattedPrice}/${type === 'month' ? 'month' : 'year'}`;
  } catch (error) {
    console.error('Error displaying price:', error);
    return '—';
  }
}

const isTokenProvided = computed(() => {
  return !!route.params.token || !!giftToken.value;
});

const effectiveToken = computed(() => {
  return route.params.token || giftToken.value;
});

async function fetchGiftDetails() {
  if (!effectiveToken.value) return;
  
  loadingGift.value = true;
  giftError.value = null;
  
  try {
    // This would be an actual API call in the real implementation
    // For now, we're simulating it
    const response = await os.api('gift/check', {
      token: effectiveToken.value
    });
    
    giftDetails.value = response;
  } catch (error) {
    console.error('Error fetching gift details:', error);
    if (error.code === 'INVALID_TOKEN') {
      giftError.value = i18n.ts._plus.gift.invalidGiftCode;
    } else if (error.code === 'GIFT_EXPIRED') {
      giftError.value = i18n.ts._plus.gift.expiredGiftCode;
    } else if (error.code === 'ALREADY_REDEEMED') {
      giftError.value = i18n.ts._plus.gift.alreadyRedeemedGiftCode;
    } else {
      giftError.value = error.message || i18n.ts.somethingHappened;
    }
  } finally {
    loadingGift.value = false;
  }
}

async function redeemGift() {
  if (!giftToken.value) return;
  await fetchGiftDetails();
}

async function confirmRedemption() {
  try {
    loadingGift.value = true;
    
    const response = await os.api('gift/redeem', {
      token: effectiveToken.value
    });
    
    redeemResponse.value = response;
    redeemingComplete.value = true;
    
    // Refresh user data to reflect new subscription status
    os.stream.send('main', 'meUpdated');
  } catch (error) {
    console.error('Error redeeming gift:', error);
    if (error.code === 'INVALID_TOKEN') {
      giftError.value = i18n.ts._plus.gift.invalidGiftCode;
    } else if (error.code === 'GIFT_EXPIRED') {
      giftError.value = i18n.ts._plus.gift.expiredGiftCode;
    } else {
      giftError.value = error.message || i18n.ts.somethingHappened;
    }
  } finally {
    loadingGift.value = false;
  }
}

function resetForm() {
  giftToken.value = '';
  giftDetails.value = null;
  giftError.value = null;
  redeemingComplete.value = false;
  redeemResponse.value = null;
}

onMounted(async () => {
  if (route.params.token) {
    giftToken.value = route.params.token as string;
    await fetchGiftDetails();
  }
});

definePageMetadata({
  title: i18n.ts._plus.gift.redeemGift,
  icon: 'ph-gift-bold',
});
</script>

<style lang="scss" scoped>
.gift-redeem-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 70vh;
  padding: 20px;
}

.gift-card {
  width: 100%;
  max-width: 500px;
  background: var(--panel);
  border-radius: 16px;
  padding: 32px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
  text-align: center;
}

.gift-icon {
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
  
  i {
    font-size: 64px;
    color: var(--accent);
    animation: pulse 2s infinite;
  }
}

@keyframes pulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
  }
}

.header {
  margin-bottom: 24px;
  font-size: 24px;
  font-weight: bold;
}

.gift-code-input {
  margin-bottom: 24px;
}

.redeem-button, .confirm-redeem-button {
  margin-top: 16px;
  width: 100%;
  padding: 12px;
  font-size: 16px;
  font-weight: bold;
}

.loading-gift {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 32px 0;
  
  p {
    margin-top: 16px;
    color: var(--fg);
    opacity: 0.8;
  }
}

.gift-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 32px 0;
  
  i {
    font-size: 48px;
    color: var(--error);
    margin-bottom: 16px;
  }
  
  p {
    margin-bottom: 20px;
    color: var(--error);
  }
}

.gift-info {
  margin: 24px 0;
}

.gift-type {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 16px;
  color: var(--accent);
}

.gift-message {
  background: var(--bg);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 24px;
  text-align: left;
  
  .message-label {
    font-weight: bold;
    margin-bottom: 8px;
    font-size: 14px;
    color: var(--fg);
    opacity: 0.8;
  }
  
  .message-content {
    font-size: 16px;
    line-height: 1.5;
    white-space: pre-line;
  }
}

.redemption-success {
  display: flex;
  flex-direction: column;
  align-items: center;
  
  i {
    font-size: 64px;
    color: var(--success);
    margin-bottom: 16px;
  }
  
  h2 {
    font-size: 24px;
    font-weight: bold;
    margin-bottom: 16px;
    color: var(--success);
  }
  
  .plan-details, .subscription-details {
    margin-bottom: 12px;
    font-size: 16px;
  }
  
  .action-buttons {
    margin-top: 24px;
  }
  
  .explore-button {
    padding: 10px 24px;
    font-size: 16px;
  }
}
</style>
