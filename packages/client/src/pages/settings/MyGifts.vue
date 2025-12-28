<template>
  <div class="my-gifts-container">
    <div class="header-container">
      <h1 class="header">{{ i18n.ts._gift?.myPurchasedGifts || "My Purchased Gifts" }}</h1>
      <div class="actions">
        <MkButton class="action-button" link to="/gift/purchase">
          <i class="ph-plus-bold ph-lg"></i>
          {{ "Purchase Gift" }}
        </MkButton>
      </div>
    </div>
    <div v-if="loading" class="loading-state">
      <p>{{ i18n.ts.loading }}</p>
    </div>
    <div v-else-if="error" class="error-state">
      <p>{{ i18n.ts.errorOccurred }}: {{ error }}</p>
      <div class="error-actions">
        <MkButton primary @click="fetchPurchasedGifts">{{ i18n.ts.retry }}</MkButton>
        <MkButton link to="/gift/purchase" style="margin-left: 1rem;">{{ "Purchase Gift Now" }}</MkButton>
      </div>
    </div>
    <div v-else-if="gifts.length === 0" class="empty-state">
      <p>{{ "You haven't purchased any gift subscriptions yet." }}</p>
      <MkButton link to="/gift/purchase">{{ "Purchase Gift Now" }}</MkButton>
    </div>
    <div v-else class="gifts-list">
      <div v-for="gift in gifts" :key="gift.id" class="gift-card">
        <div class="gift-card-header">
          <h3>{{ (gift.plan === 'mplus' ? i18n.ts._plus?.miniBarklePlus : i18n.ts._plus?.barklePlus) || 'Gift Subscription' }} - {{ (gift.subscriptionType === 'month' ? i18n.ts._plus?.monthly : i18n.ts._plus?.yearly) || 'Subscription' }}</h3>
          <span :class="['status-badge', gift.status || 'unknown']">{{ formatStatus(gift.status) }}</span>
        </div>
        <div class="gift-details">
          <p><strong>{{ i18n.ts._gift?.purchasedOn || 'Purchased On' }}:</strong> {{ formatDate(gift.createdAt) }}</p>
          <p v-if="gift.expiresAt"><strong>{{ i18n.ts._gift?.expiresOn || 'Expires On' }}:</strong> {{ formatDate(gift.expiresAt) }}</p>
          <p v-if="gift.message"><strong>{{ i18n.ts.message || 'Message' }}:</strong> {{ gift.message }}</p>

          <div v-if="gift.status === 'pending_redemption' && gift.token" class="gift-actions">
            <p><strong>{{ i18n.ts._gift?.giftLink || 'Gift Link' }}:</strong></p>
            <div class="gift-link-container">
              <input type="text" :value="getGiftLink(gift.token)" readonly @focus="($event.target as HTMLInputElement).select()" />
              <MkButton small @click="copyGiftLink(gift.token)">{{ i18n.ts.copy || 'Copy' }}</MkButton>
            </div>
          </div>
          <div v-else-if="gift.status === 'pending_redemption' && !gift.token" class="gift-actions gift-error">
            <p><strong>Error:</strong> Gift link is not available. Please contact support.</p>
          </div>

          <div v-if="gift.status === 'redeemed' && gift.redeemedBy" class="redeemed-info">
            <p><strong>{{ i18n.ts._gift?.redeemedBy || 'Redeemed By' }}:</strong> {{ gift.redeemedBy.name || gift.redeemedBy.username }}</p>
            <p><strong>{{ i18n.ts._gift?.redeemedOn || 'Redeemed On' }}:</strong> {{ formatDate(gift.redeemedAt) }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import MkButton from '@/components/MkButton.vue';
import * as os from '@/os';
import { i18n } from '@/i18n';
import { definePageMetadata } from '@/scripts/page-metadata';

interface RedeemedBy {
  id: string;
  username: string;
  name?: string | null;
}

interface Gift {
  id: string;
  createdAt: string; // date-time
  status: 'pending_redemption' | 'redeemed' | 'expired';
  plan: 'plus' | 'mplus';
  subscriptionType: 'month' | 'year';
  token: string;
  expiresAt?: string | null; // date-time
  redeemedByUserId?: string | null;
  redeemedAt?: string | null; // date-time
  message?: string | null;
  redeemedBy?: RedeemedBy | null;
}

const gifts = ref<Gift[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

definePageMetadata({
  title: i18n.ts._gift?.myPurchasedGifts || 'My Purchased Gifts', // Fallback title with optional chaining
  icon: 'ph-gift-bold',
  
  // Adding a custom property to ensure the page has loaded properly
  __initialized: true,
});

async function fetchPurchasedGifts() {
  loading.value = true;
  error.value = null;
  try {
    // Use a try/catch block specifically for the API call
    let response;
    try {
      console.log('Calling gift/list-purchased API...');
      const apiResponse = await os.api('gift/list-purchased', {});
      console.log('API Response raw:', apiResponse);
      
      // Check if the response is valid
      if (!apiResponse) {
        throw new Error('Empty response from server');
      }
      
      // Handle both direct array response and object response with data property
      if (Array.isArray(apiResponse)) {
        response = apiResponse as Gift[];
      } else if (apiResponse && typeof apiResponse === 'object') {
        // Try to extract data if it's wrapped in an object
        response = (apiResponse.data || apiResponse) as Gift[];
      } else {
        response = apiResponse as Gift[];
      }
      
      if (!Array.isArray(response)) {
        console.error('Response is not an array:', response);
        throw new Error('Invalid response format: expected an array');
      }
    } catch (apiError: any) {
      console.error('API Error details:', apiError);
      if (apiError.code === 'NO_SUCH_ENDPOINT') {
        error.value = 'The gift subscription system is currently under maintenance. Please try again later.';
      } else if (apiError.code === 'INTERNAL_ERROR') {
        error.value = 'The gift system encountered an internal error. Please try again later.';
      } else {
        error.value = apiError?.message || 'Failed to fetch gift data. Please try again later.';
      }
      loading.value = false;
      return;
    }
    
    // Process the response
    console.log('Raw gift response:', response);
    if (response && Array.isArray(response) && response.length > 0) {
      console.log('First gift object:', response[0]);
      console.log('Gift token available:', !!response[0]?.token);
      console.log('Gift status:', response[0]?.status);
      console.log('Total gifts found:', response.length);
    } else {
      console.log('Gift response is empty or not in expected format');
    }
    
    // Ensure we assign the array to gifts.value
    gifts.value = Array.isArray(response) ? response : [];
    console.log('Assigned gifts to component state:', gifts.value);
  } catch (err: any) {
    console.error('Error in gift processing:', err);
    error.value = err?.message || (typeof err === 'string' ? err : 'An unknown error occurred');
  } finally {
    loading.value = false;
  }
}

function getGiftLink(token: string | null | undefined): string {
  // Use the verification system to prevent accidental redemptions
  if (!token) {
    console.error('Attempted to generate gift link with null/undefined token');
    return '#invalid-token';
  }
  
  // Check if window.location.origin works correctly and if not, use a fallback
  try {
    const baseUrl = window.location.origin || 'https://dev.barkle.chat';
    
    // Make sure the URL follows the correct pattern
    console.log(`Creating gift link with token: ${token}`);
    // Ensure the path is correctly formatted without double slashes
    const path = `/gift/verify/${encodeURIComponent(token)}`;
    return `${baseUrl}${path}`;
  } catch (err) {
    console.error('Error generating gift link:', err);
    // Fallback to a relative URL which should work regardless of origin issues
    return `/gift/verify/${encodeURIComponent(token)}`;
  }
}

async function copyGiftLink(token: string) {
  try {
    const link = getGiftLink(token);
    console.log(`Copying gift link to clipboard: ${link}`);
    
    await navigator.clipboard.writeText(link);
    os.success(i18n.ts._gift?.linkCopied || 'Gift link copied to clipboard!'); // Using success notification
  } catch (err) {
    console.error('Failed to copy link:', err);
    
    // Try a fallback method
    try {
      const input = document.createElement('input');
      input.value = getGiftLink(token);
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      os.success(i18n.ts._gift?.linkCopied || 'Gift link copied to clipboard!');
    } catch (fallbackErr) {
      console.error('Fallback copy also failed:', fallbackErr);
      os.alert({
        type: 'error',
        text: 'Failed to copy link. Please manually copy the link from the text field.'
      });
    }
  }
}

function formatDate(dateString?: string | null): string {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatStatus(status: Gift['status'] | string | undefined): string {
  // Provide fallbacks for i18n strings and handle unexpected values
  if (!status) return 'Unknown';
  
  switch (status) {
    case 'pending_redemption':
      return (i18n.ts._gift?.status?.pendingRedemption) || 'Pending Redemption';
    case 'redeemed':
      return (i18n.ts._gift?.status?.redeemed) || 'Redeemed';
    case 'expired':
      return (i18n.ts._gift?.status?.expired) || 'Expired';
    default:
      console.warn(`Unexpected gift status: ${status}`);
      return String(status);
  }
}

onMounted(() => {
  fetchPurchasedGifts();
});
</script>

<style lang="scss" scoped>
.my-gifts-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 1rem;
  color: var(--fg);
}

.header-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  padding-bottom: 0.7rem;
  border-bottom: solid 1px var(--divider);
}

.header {
  margin: 0;
  font-size: 1.5rem;
  font-weight: bold;
  color: var(--accent);
}

.refresh-button {
  margin-left: 1rem;
}

.loading-state, .error-state, .empty-state {
  text-align: center;
  padding: 2rem;
  background-color: var(--panel);
  border-radius: var(--radius);
  margin-top: 1rem;
}

.error-state {
  border-left: 4px solid var(--error);
  
  .error-actions {
    margin-top: 1.5rem;
  }
}

.empty-state {
  border-left: 4px solid var(--info);
  
  p {
    margin-bottom: 1.5rem;
  }
  
  .mk-button { /* Styling for MkButton if needed */
    margin-top: 1rem;
  }
}

.gifts-list {
  display: grid;
  gap: 1.5rem;
}

.gift-card {
  background-color: var(--panel);
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transition: transform 0.2s ease-in-out;

  &:hover {
    transform: translateY(-3px);
  }
}

.gift-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--divider);

  h3 {
    margin: 0;
    font-size: 1.3rem;
    font-weight: 600;
    color: var(--text-strong); // Assuming a stronger text color variable
  }
}

.status-badge {
  padding: 0.4rem 0.9rem;
  border-radius: 16px;
  font-size: 0.85rem;
  font-weight: 500;
  letter-spacing: 0.5px;

  &.pending_redemption {
    background-color: var(--warn-bg, #fff3cd);
    color: var(--warn-fg, #856404);
    border: 1px solid var(--warn-fg, #ffeeba);
  }
  &.redeemed {
    background-color: var(--accent-bg, #d4edda);
    color: var(--accent-fg, #155724);
    border: 1px solid var(--accent-fg, #c3e6cb);
  }
  &.expired {
    background-color: var(--disabled-bg, #f8f9fa); // A more neutral bg for expired
    color: var(--disabled-fg, #6c757d);    // A more neutral fg for expired
    border: 1px solid var(--disabled-fg, #adb5bd);
    opacity: 0.8;
  }
}

.gift-details {
  p {
    margin: 0.6rem 0;
    font-size: 0.95rem;
    color: var(--text-semifaded, #5a5a5a);
    strong {
      color: var(--text, #333);
      font-weight: 500;
    }
  }
}

.gift-actions {
  margin-top: 1.2rem;
  padding-top: 1rem;
  border-top: 1px dashed var(--divider-light, #e0e0e0);
  p {
    margin-bottom: 0.6rem;
    font-weight: 500;
  }
}

.gift-link-container {
  display: flex;
  gap: 0.75rem;
  align-items: center;

  input[type="text"] {
    flex-grow: 1;
    padding: 0.6rem 0.8rem;
    border: 1px solid var(--input-border-color, #ced4da);
    border-radius: 6px;
    background-color: var(--input-bg, #fff);
    color: var(--input-fg, #495057);
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
    font-size: 0.9rem;
    box-shadow: inset 0 1px 2px rgba(0,0,0,0.075);
  }
}

.redeemed-info {
  margin-top: 1.2rem;
  padding-top: 1rem;
  border-top: 1px dashed var(--divider-light, #e0e0e0);
   p {
    font-size: 0.95rem;
   }
}
</style>
