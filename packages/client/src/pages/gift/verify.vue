<template>
  <div class="gift-verify-container">
    <div class="gift-card">
      <div class="gift-icon">
        <i class="ph-gift-bold"></i>
      </div>
      <h1 class="header">{{ i18n.ts._plus.gift.verifyGift }}</h1>

      <div v-if="loadingGift" class="loading-gift">
        <MkLoading />
        <p>{{ i18n.ts.loading }}</p>
      </div>

      <div v-else-if="giftError" class="gift-error">
        <i class="ph-warning-circle-bold"></i>
        <p>{{ giftError }}</p>
        <MkButton link to="/gift/redeem">{{ i18n.ts._plus.gift.tryAnotherCode }}</MkButton>
      </div>

      <div v-else-if="verificationComplete && giftDetails?.verified" class="verification-success">
        <i class="ph-check-circle-bold"></i>
        <h2>{{ i18n.ts._plus.gift.verificationSuccess }}</h2>
        
        <div class="gift-details">
          <p class="gift-type">
            {{ giftDetails.plan === 'plus' ? i18n.ts._plus.barklePlus : i18n.ts._plus.miniBarklePlus }}
            ({{ giftDetails.subscriptionType === 'month' ? i18n.ts.month : i18n.ts.year }})
          </p>
          
          <div v-if="giftDetails.purchasedBy" class="gift-from">
            <p class="from-label">{{ i18n.ts._plus.gift.giftFrom }}:</p>
            <div class="from-content">
              <MkUserName :user="giftDetails.purchasedBy" />
            </div>
          </div>
          
          <div v-if="giftDetails.message" class="gift-message">
            <p class="message-label">{{ i18n.ts._plus.gift.giftRecipientMessage }}:</p>
            <p class="message-content">{{ giftDetails.message }}</p>
          </div>
        
        </div>
        
        <div class="action-buttons">
          <MkButton primary class="redeem-button" @click="redeemVerifiedGift">
            {{ i18n.ts._plus.gift.redeemNow }}
          </MkButton>
          <MkButton class="later-button" link to="/">
            {{ i18n.ts._plus.gift.redeemLater }}
          </MkButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, watch, computed } from 'vue';
import MkButton from '@/components/MkButton.vue';
import * as os from '@/os';
import { i18n } from '@/i18n';
import { definePageMetadata } from '@/scripts/page-metadata';
import { useRouter } from '@/router';

const props = defineProps<{
  token?: string;
}>();

const router = useRouter();
const loadingGift = ref(true);
const giftError = ref<string | null>(null);
const giftDetails = ref<{
  verified: boolean;
  plan: string;
  subscriptionType: string;
  purchasedBy: {
    id: string;
    username: string;
    name: string | null;
  } | null;
  message: string | null;
  createdAt: string;
  expiresAt: string | null;
} | null>(null);
const verificationComplete = ref(false);

watch(() => props.token, (newToken) => {
  if (newToken !== undefined) {
    verifyGift();
  }
}, { immediate: true });

onMounted(() => {
  if (!props.token) {
    giftError.value = i18n.ts._plus.gift.invalidVerificationLink || 'The verification link is invalid.';
    loadingGift.value = false;
  }
});

async function verifyGift() {
  if (!props.token) return;
  
  loadingGift.value = true;
  giftError.value = null;

  try {
    // Call the gift/verify API to validate the token
    const response = await os.api('gift/verify', {
      token: props.token
    });
    
    giftDetails.value = response;
    verificationComplete.value = true;
  } catch (error: any) {
    if (error.code === 'NO_SUCH_ENDPOINT') {
      giftError.value = 'The gift subscription system is currently under maintenance. Please try again later.';
    } else if (error.code === 'INVALID_TOKEN') {
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

function formatDate(dateString?: string | null): string {
  if (!dateString) return i18n.ts._plus.gift.noExpiration || 'No expiration';
  return new Date(dateString).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

async function redeemVerifiedGift() {
  if (!props.token) return;
  
  try {
    loadingGift.value = true;
    
    const response = await os.api('gift/redeem', {
      token: props.token
    });
    
    // Update user data to reflect the new subscription status
    if (os.stream && typeof os.stream.send === 'function') {
      os.stream.send('main', 'meUpdated');
    }
    
    // Show success notification - make sure os.success is available
    if (typeof os.success === 'function') {
      os.success(i18n.ts._plus.gift.redeemSuccess || 'Gift successfully redeemed!');
    }
    
    // Redirect to the subscription management page
    setTimeout(() => {
      router.push('/settings/manage-plus');
    }, 500);
  } catch (error: any) {
    
    if (error.code === 'NO_SUCH_ENDPOINT') {
      giftError.value = 'The gift subscription system is currently under maintenance. Please try again later.';
      verificationComplete.value = false;
    } else if (error.code === 'INVALID_TOKEN') {
      giftError.value = i18n.ts._plus.gift.invalidGiftCode;
      verificationComplete.value = false;
    } else if (error.code === 'GIFT_EXPIRED') {
      giftError.value = i18n.ts._plus.gift.expiredGiftCode;
      verificationComplete.value = false;
    } else if (error.code === 'ALREADY_REDEEMED') {
      giftError.value = i18n.ts._plus.gift.alreadyRedeemedGiftCode;
      verificationComplete.value = false;
    } else if (error.code === 'SYSTEM_UNAVAILABLE') {
      giftError.value = 'The gift system is temporarily unavailable. Your gift is valid, but please try redeeming it again later.';
      verificationComplete.value = false;
    } else {
      if (typeof os.alert === 'function') {
        os.alert({
          type: 'error',
          text: error.message || i18n.ts.somethingHappened || 'Something went wrong'
        });
      } else {
        giftError.value = error.message || i18n.ts.somethingHappened || 'Something went wrong';
        verificationComplete.value = false;
      }
    }
  } finally {
    loadingGift.value = false;
  }
}

definePageMetadata(
  computed(() => ({
    title: i18n.ts._plus.gift.verifyGift || 'Verify Gift',
    icon: 'ph-gift-bold',
    path: `/gift/verify/${props.token}`,
  })),
);
</script>

<style lang="scss" scoped>
.gift-verify-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 85vh;
  padding: var(--margin);
  position: relative;
  
  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: var(--bg);
    background-image: 
      radial-gradient(circle at 20% 80%, var(--X2) 0%, transparent 25%),
      radial-gradient(circle at 80% 20%, var(--buttonGradateA) 0%, transparent 25%),
      radial-gradient(circle at 50% 50%, var(--X3) 0%, transparent 60%);
    opacity: 0.6;
    pointer-events: none;
    z-index: -1;
    filter: blur(40px);
  }
}

.gift-card {
  width: 100%;
  max-width: 540px;
  background: var(--panel);
  border-radius: var(--radius);
  padding: 40px 32px;
  box-shadow: 0px 4px 32px var(--shadow);
  text-align: center;
  position: relative;
  overflow: hidden;
  animation: cardAppear 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
  transform-origin: center;
  
  @media (max-width: 500px) {
    padding: 32px 24px;
  }
  
  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 5px;
    background: linear-gradient(90deg, var(--buttonGradateA), var(--buttonGradateB));
  }
  
  &::after {
    content: "";
    position: absolute;
    bottom: 0;
    right: 0;
    width: 120px;
    height: 120px;
    background: var(--buttonGradateA);
    opacity: 0.05;
    border-radius: 50% 0 0 0;
    z-index: 0;
  }
}

@keyframes cardAppear {
  0% {
    opacity: 0;
    transform: translateY(20px) scale(0.98);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.gift-icon {
  display: flex;
  justify-content: center;
  margin-bottom: 28px;
  position: relative;
  
  &::after {
    content: "";
    position: absolute;
    width: 120px;
    height: 120px;
    background: var(--X2);
    border-radius: 50%;
    z-index: -1;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    opacity: 0.2;
  }
  
  i {
    font-size: 80px;
    color: var(--accent);
    animation: giftBounce 3s ease-in-out infinite;
  }
}

@keyframes giftBounce {
  0%, 100% {
    transform: translateY(0) rotate(0deg);
  }
  25% {
    transform: translateY(-8px) rotate(-5deg);
  }
  75% {
    transform: translateY(-5px) rotate(5deg);
  }
}

.header {
  margin-bottom: 32px;
  font-size: 26px;
  font-weight: bold;
  background: linear-gradient(90deg, var(--accent), var(--buttonGradateB));
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  display: inline-block;
  text-shadow: 0px 2px 2px rgba(0, 0, 0, 0.05);
}

.loading-gift {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 40px 0;
  
  p {
    margin-top: 20px;
    color: var(--fg);
    opacity: 0.8;
    font-size: 16px;
  }
}

.gift-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 32px 0;
  animation: fadeIn 0.5s ease-out forwards;
  
  i {
    font-size: 64px;
    color: var(--error);
    margin-bottom: 20px;
    opacity: 0.9;
  }
  
  p {
    margin-bottom: 24px;
    color: var(--error);
    font-size: 16px;
    line-height: 1.5;
    max-width: 400px;
  }
}

.verification-success {
  animation: successPop 0.5s cubic-bezier(0.17, 0.89, 0.32, 1.28) forwards;
  
  i {
    font-size: 64px;
    color: var(--success);
    margin-bottom: 20px;
    filter: drop-shadow(0 2px 4px rgba(0, 150, 50, 0.1));
  }
  
  h2 {
    font-size: 24px;
    font-weight: bold;
    margin-bottom: 20px;
    color: var(--success);
    opacity: 0.9;
  }
}

@keyframes successPop {
  0% {
    opacity: 0;
    transform: scale(0.95);
  }
  50% {
    transform: scale(1.03);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes fadeIn {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

.gift-details {
  margin: 32px 0;
  position: relative;
}

.gift-type {
  font-size: 20px;
  font-weight: bold;
  margin-bottom: 24px;
  color: var(--accent);
  display: inline-block;
  padding: 8px 16px;
  background: var(--X1);
  border-radius: 24px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
  animation: pulseGlow 2s ease-in-out infinite alternate;
}

@keyframes pulseGlow {
  0% {
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
  }
  100% {
    box-shadow: 0 4px 12px rgba(var(--accentRGB), 0.25);
  }
}

.gift-message, .gift-from, .gift-expiry {
  background: var(--X1);
  border-radius: var(--radius);
  padding: 18px;
  margin-bottom: 16px;
  text-align: left;
  border-left: 3px solid var(--accent);
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
  position: relative;
  z-index: 1;
  overflow: hidden;
  
  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, var(--buttonGradateA), transparent);
    opacity: 0.03;
    z-index: -1;
  }
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  }
  
  .message-label, .from-label, .expiry-label {
    font-weight: bold;
    margin-bottom: 8px;
    font-size: 14px;
    color: var(--fg);
    opacity: 0.8;
    display: flex;
    align-items: center;
    
    &::before {
      content: "";
      display: inline-block;
      width: 6px;
      height: 6px;
      background: var(--accent);
      border-radius: 50%;
      margin-right: 8px;
    }
  }
  
  .message-content, .from-content, .expiry-date {
    font-size: 16px;
    line-height: 1.6;
    white-space: pre-line;
  }
}

.action-buttons {
  display: flex;
  gap: 14px;
  margin-top: 32px;
  justify-content: center;
}

.redeem-button, .later-button {
  padding: 14px 24px;
  font-size: 16px;
  font-weight: bold;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.redeem-button {
  background: linear-gradient(90deg, var(--buttonGradateA), var(--buttonGradateB));
  border-radius: calc(var(--radius) - 2px);
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(var(--accentRGB), 0.3);
  }
  
  &:active {
    transform: translateY(0);
    box-shadow: 0 2px 6px rgba(var(--accentRGB), 0.2);
  }
}

.later-button {
  opacity: 0.85;
  transition: opacity 0.2s ease, transform 0.2s ease;
  
  &:hover {
    opacity: 1;
    transform: translateY(-1px);
  }
  
  &:active {
    transform: translateY(0);
  }
}
</style>