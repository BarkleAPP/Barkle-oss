<template>
  <div class="barkle-plus-container">
    <h1 class="header">{{ headerText }}</h1>
  
    <div v-if="$i.isPlus || $i.isMPlus" class="profile-section">
      <div class="banner" :style="{ backgroundImage: $i.bannerUrl ? `url(${ $i.bannerUrl })` : null }">
        <div class="avatar-container">
          <MkAvatar class="avatar" :user="$i" :disable-link="true" @click="changeAvatar"/>
        </div>
      </div>
      <h2 class="profile-name">{{ $i.name }}</h2>
          
      <MkButton primary rounded class="decorations-button" link to="/settings/decorations">
        {{ i18n.ts._plus.goToDecorations }}
      </MkButton>
  
      <FormTextarea
      v-if="$i.isPlus"
        v-model="profile.profileCss"
        :max="2000"
        tall
        class="css-textarea"
      >
        <template #label>{{ i18n.ts.customCss }}</template>
        <template #caption>{{ i18n.ts.customCss }}</template>
      </FormTextarea>
  
      <MkButton v-if="$i.isPlus" primary @click="saveProfileCss" class="save-button">{{ i18n.ts.save }}</MkButton>
  
      <div class="manage-subscription">
        <MkButton primary @click="manageSubscription">{{ i18n.ts._plus.manageSubscription }}</MkButton>
      </div>
      
      <div class="gift-subscription">
        <h2>{{ i18n.ts._plus.gift?.giftSubscription || "Gift Barkle+" }}</h2>
        <p class="gift-description">{{ i18n.ts._plus.gift?.giftDescription || "Share Barkle+ with friends and family! Purchase a gift subscription for someone special." }}</p>
        <div class="gift-tag">
          <span>{{ "BETA" }}</span>
        </div>
        
        <div v-if="!giftSystemAvailable" class="gift-maintenance">
          <i class="ph-wrench-bold"></i>
          <p>Gift subscriptions are currently under maintenance. Please check back soon.</p>
        </div>
        
        <div v-else class="gift-buttons">
          <MkButton class="gift-button" link to="/gift/purchase">
            <i class="ph-gift-bold"></i>
            <span>{{ i18n.ts._plus.gift?.purchaseGift || "Purchase Gift Subscription" }}</span>
          </MkButton>
          <MkButton class="my-gifts-button" link to="/settings/my-gifts">
            <i class="ph-eye-bold"></i>
            <span>{{ "View My Gifts" }}</span>
          </MkButton>
        </div>
      </div>
    </div>
  
    <div class="subscription-section" v-if="!$i.isPlus && !$i.isAdmin && !$i.isMPlus">
      <h2>{{ i18n.ts._plus.subscribeNow }}</h2>
      <div class="plans-container">
        <div class="plan-card mini">
          <h3>{{ i18n.ts._plus.miniBarklePlus }}</h3>
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
          <FormSelect v-model="miniSubscriptionType" class="subscription-select">
            <option value="month">{{ i18n.ts._plus.monthly }}</option>
            <option value="year">{{ i18n.ts._plus.yearly }}</option>
          </FormSelect>
          <MkButton primary class="subscribe-button" @click="subscribe('mplus')">
            {{ i18n.ts._plus.subscribe }}
          </MkButton>
          <p class="pricing-info">{{ miniSubscriptionPricing }}</p>
        </div>
  
        <div class="plan-card plus">
          <h3>{{ i18n.ts._plus.barklePlus }}</h3>
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
              <span>{{ i18n.ts._plus.customCss }}</span>
            </div>
            <div class="feature">
              <i class="ph-dog-bold"></i>
              <span>{{ i18n.ts._plus.barklePlusBadge }}</span>
            </div>
          </div>
          <FormSelect v-model="plusSubscriptionType" class="subscription-select">
            <option value="month">{{ i18n.ts._plus.monthly }}</option>
            <option value="year">{{ i18n.ts._plus.yearly }}</option>
          </FormSelect>
          <MkButton primary class="subscribe-button" @click="subscribe('plus')">
            {{ i18n.ts._plus.subscribe }}
          </MkButton>
          <p class="pricing-info">{{ plusSubscriptionPricing }}</p>
        </div>
      </div>
      
      <div class="gift-section">
        <div class="gift-divider">
          <span>{{ "Or Gift a Subscription" }}</span>
        </div>
        
        <div class="gift-subscription non-subscriber">
          <h3>{{ i18n.ts._plus.gift?.giftSubscription || "Gift Barkle+" }}</h3>
          <p class="gift-description">{{ i18n.ts._plus.gift?.giftDescription || "Share Barkle+ with friends and family! Purchase a gift subscription for someone special." }}</p>
          <div class="gift-tag">
            <span>{{ "BETA" }}</span>
          </div>
          
          <div v-if="!giftSystemAvailable" class="gift-maintenance">
            <i class="ph-wrench-bold"></i>
            <p>Gift subscriptions are currently under maintenance. Please check back soon.</p>
          </div>
          
          <div v-else class="gift-buttons">
            <MkButton class="gift-button" link to="/gift/purchase">
              <i class="ph-gift-bold"></i>
              <span>{{ i18n.ts._plus.gift?.purchaseGift || "Purchase Gift Subscription" }}</span>
            </MkButton>
            <MkButton class="view-gifts-button" link to="/settings/my-gifts">
              <i class="ph-eye-bold"></i>
              <span>{{ "View My Gifts" }}</span>
            </MkButton>
          </div>
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
  import Ripple from '@/components/MkRipple.vue';

  const profile = ref({
    profileCss: $i.profileCss || '',
  });

  const miniSubscriptionType = ref('month');
  const plusSubscriptionType = ref('month');
  const giftSystemAvailable = ref(true);
  const prices = ref({
    plus: {
      month: null,
      year: null
    },
    mplus: {
      month: null,
      year: null
    }
  });

  function formatPrice(priceObj) {
    if (!priceObj) return '';
    const amount = (priceObj.amount / 100).toFixed(2);
    return `$${amount} ${priceObj.currency.toUpperCase()}`;
  }

  const headerText = computed(() => {
    return $i.isPlus
      ? i18n.ts._plus.welcomeToBarklePlus
      : i18n.ts._plus.joinBarklePlus;
  });

  const miniSubscriptionPricing = computed(() => {
    const price = prices.value.mplus[miniSubscriptionType.value];
    return price ? formatPrice(price) : (miniSubscriptionType.value === 'month'
      ? i18n.ts._plus.miniMonthlyPrice
      : i18n.ts._plus.miniYearlyPrice);
  });

  const plusSubscriptionPricing = computed(() => {
    const price = prices.value.plus[plusSubscriptionType.value];
    return price ? formatPrice(price) : (plusSubscriptionType.value === 'month'
      ? i18n.ts._plus.monthlyPrice
      : i18n.ts._plus.yearlyPrice);
  });

  async function fetchPrices() {
    try {
      const response = await os.api('stripe/prices', {});
      prices.value = {
        plus: {
          month: response.price_id_month,
          year: response.price_id_gift_year_plus
        },
        mplus: {
          month: response.price_id_gift_month_mplus,
          year: response.price_id_gift_year_mplus
        }
      };
    } catch (error) {
      console.error('Error fetching prices:', error);
      // Fall back to i18n prices if API call fails
    }
  }

  function saveProfileCss() {
    if ($i.isPlus) {
      os.apiWithDialog('i/update', {
        profileCss: profile.value.profileCss,
      });
    }
  }
  
  async function subscribe(plan: 'plus' | 'mplus', ev?: MouseEvent) {
    const el = ev && (ev.currentTarget ?? ev.target) as HTMLElement | null | undefined;
    const rect = el?.getBoundingClientRect();
    const x = rect ? rect.left + (el.offsetWidth / 2) : 0;
    const y = rect ? rect.top + (el.offsetHeight / 2) : 0;
    os.popup(Ripple, { x, y }, {}, 'end');
  
    try {
      const subscriptionType = plan === 'plus' ? plusSubscriptionType.value : miniSubscriptionType.value;
      const response = await os.api('plus/checkout', { 
        subscriptionType,
        plan 
      });
      if (response.url) {
        window.open(response.url, '_blank');
      }
    } catch (error) {
      console.error('Error during subscription:', error);
      if (error.code === 'EMAIL_REQUIRED') {
        os.alert({
          type: 'error',
          title: i18n.ts._plus.emailRequiredTitle,
          text: i18n.ts._plus.emailRequiredMessage,
        });
      } else {
        os.alert({
          type: 'error',
          text: i18n.ts._plus.subscriptionError,
        });
      }
    }
  }
  
  async function manageSubscription() {
    try {
      const response = await os.api('plus/manage', { action: 'portal' });
      if (response.url) {
        window.open(response.url, '_blank');
      }
    } catch (error) {
      console.error('Error managing subscription:', error);
      os.alert({
        type: 'error',
        text: i18n.ts._plus.managementError,
      });
    }
  }
  
  function changeAvatar() {
    os.selectFile(i18n.ts.avatar).then(async (file) => {
      const { canceled } = await os.confirm({
        type: 'info',
        text: i18n.ts.cropImageAsk,
      });
      if (canceled) return;
  
      os.cropImage(file, {
        aspectRatio: 1,
        size: {
          width: 200,
          height: 200,
        },
      }).then((cropped) => {
        os.api('i/update', {
          avatarId: cropped.id,
        });
      });
    });
  }
  
  const headerActions = $computed(() => []);
  const headerTabs = $computed(() => []);
  
  async function checkGiftSystemAvailability() {
    try {
      // Try to access the gift endpoints to see if they exist
      await os.api('gift/list-purchased', {});
      giftSystemAvailable.value = true;
    } catch (error) {
      console.error('Error checking gift system availability:', error);
      // If the endpoint doesn't exist, mark as unavailable
      if (error.code === 'NO_SUCH_ENDPOINT') {
        giftSystemAvailable.value = false;
      } else {
        // For other errors, we'll still consider the system available
        // as they might be temporary issues with the user's specific request
        giftSystemAvailable.value = true;
      }
    }
  }
  
  onMounted(() => {
    checkGiftSystemAvailability();
    fetchPrices();
  });

  definePageMetadata({
    title: i18n.ts._plus.barklePlus,
    icon: 'ph-star-bold ph-lg',
  });
  </script>
  
  <style lang="scss" scoped>
  .barkle-plus-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
  }
  
  .header {
    font-size: 2.5rem;
    text-align: center;
    margin-bottom: 2rem;
    color: var(--accent);
  }
  
  .content-wrapper {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  
    &.plus-user {
      .perks-section {
        margin-bottom: 2rem;
      }
    }
  }
  
  .plans-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2rem;
    margin: 0 auto;
    max-width: 900px;
  }
  
  .plan-card {
    background: var(--panel);
    border-radius: 12px;
    padding: 2rem;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  
    h3 {
      font-size: 1.8rem;
      color: var(--accent);
    }
  
    &.plus {
      border: 2px solid var(--accent);
    }
  }
  
  .plan-features {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin: 1rem 0;
  
    .feature {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 1.1rem;
  
      i {
        color: var(--accent);
        font-size: 1.3rem;
      }
    }
  }
  
  .profile-section {
    background: var(--panel);
    border-radius: 12px;
    padding: 1.5rem;
    
    .banner {
      height: 200px;
      background-size: cover;
      background-position: center;
      border-radius: 12px;
      position: relative;
      margin-bottom: 60px;
    }
  
    .avatar-container {
      position: absolute;
      bottom: -50px;
      left: 20px;
    }
  
    .avatar {
      width: 100px;
      height: 100px;
      border: 4px solid var(--panel);
      border-radius: 50%;
    }
  
    .profile-name {
      font-size: 1.5rem;
      margin-bottom: 1rem;
    }
  }
  
  .perks-section {
    h2 {
      font-size: 1.8rem;
      margin-bottom: 1rem;
    }
  
    &.marquee {
      .perks-marquee {
        display: flex;
        overflow: hidden;
        width: 100%;
  
        &:hover .perks-track {
          animation-play-state: paused;
        }
      }
  
      .perks-track {
        display: flex;
        animation: marquee 8s linear infinite;
        width: 100%;
        flex-shrink: 0;
      }
  
      .perk-card {
        flex: 0 0 200px;
        margin-right: 1rem;
      }
  
      @keyframes marquee {
        0% {
          transform: translateX(0);
        }
        100% {
          transform: translateX(-100%);
        }
      }
    }
  }
  
  .subscription-select {
    margin-bottom: 1rem;
  }
  
  .subscribe-button {
    width: 100%;
    margin-bottom: 1rem;
  }
  
  .pricing-info {
    font-size: 1.1rem;
    color: var(--accent);
  }
  
  .decorations-button,
  .save-button,
  .manage-subscription {
    margin-top: 1rem;
  }
  
  .css-textarea {
    margin-top: 2rem;
  }

  .gift-section {
    margin-top: 3rem;
  }

  .gift-divider {
    position: relative;
    text-align: center;
    margin: 3rem 0 2.5rem;
    
    &:before {
      content: '';
      position: absolute;
      top: 50%;
      left: 0;
      right: 0;
      height: 1px;
      background: linear-gradient(to right, 
        transparent, 
        var(--divider) 10%, 
        var(--divider) 90%, 
        transparent);
    }
    
    span {
      display: inline-block;
      background: var(--bg);
      padding: 0 1.5rem;
      position: relative;
      font-size: 1.2rem;
      font-weight: 600;
      color: var(--fgTransparent);
      text-transform: uppercase;
      letter-spacing: 0.05rem;
    }
  }

  .gift-subscription {
    margin-top: 2rem;
    background: var(--panel);
    border-radius: 16px;
    padding: 2.5rem;
    text-align: center;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.07);
    position: relative;
    z-index: 1;
    overflow: hidden;
    
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: radial-gradient(circle at top right, rgba(var(--accentRgb), 0.05), transparent 60%);
      z-index: -1;
    }
    
    h2, h3 {
      font-size: 2rem;
      color: var(--accent);
      margin-bottom: 1rem;
      font-weight: 700;
      letter-spacing: -0.01rem;
    }
    
    h3 {
      font-size: 1.7rem;
    }
    
    .gift-description {
      font-size: 1.15rem;
      line-height: 1.6;
      margin-bottom: 1.8rem;
      max-width: 600px;
      margin-left: auto;
      margin-right: auto;
      opacity: 0.85;
    }
    
    .gift-tag {
      margin-bottom: 2rem;
      position: relative;
      
      span {
        display: inline-block;
        background: linear-gradient(135deg, var(--warning) 0%, var(--warning-lighten, var(--warning)) 100%);
        color: var(--fg);
        padding: 0.3rem 0.9rem;
        border-radius: 100px;
        font-size: 0.8rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.08rem;
        box-shadow: 0 2px 8px rgba(var(--warningRgb, 230, 150, 0), 0.25);
        position: relative;
        transition: all 0.3s ease;
        
        &::before, &::after {
          content: '';
          position: absolute;
          top: 50%;
          width: 20px;
          height: 2px;
          background: var(--divider);
          opacity: 0.8;
        }
        
        &::before {
          left: -30px;
          transform: translateY(-50%);
        }
        
        &::after {
          right: -30px;
          transform: translateY(-50%);
        }
      }
    }
    
    .gift-maintenance {
      background: var(--infoBg, #f8f9fa);
      border: 1px dashed var(--infoBorder, #adb5bd);
      border-radius: 12px;
      padding: 2rem;
      margin: 1.5rem 0;
      box-shadow: inset 0 0 15px rgba(var(--infoRgb, 23, 162, 184), 0.05);
      
      i {
        font-size: 2.5rem;
        color: var(--info, #17a2b8);
        margin-bottom: 1rem;
        opacity: 0.9;
        animation: pulse 2s infinite ease-in-out;
      }
      
      p {
        color: var(--fg);
        font-size: 1.05rem;
        line-height: 1.6;
        max-width: 500px;
        margin: 0 auto;
      }
      
      @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.08); }
        100% { transform: scale(1); }
      }
    }
    
    .gift-buttons {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 1.5rem;
      margin-top: 1.5rem;
    }

    .gift-button, .my-gifts-button, .view-gifts-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      min-width: 220px;
      padding: 0.85rem 1.75rem;
      font-size: 1.1rem;
      font-weight: 600;
      letter-spacing: 0.02rem;
      border-radius: 12px;
      transition: all 0.3s cubic-bezier(0.25, 1, 0.5, 1);
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
      position: relative;
      overflow: hidden;
      
      &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(to right, rgba(255,255,255,0.1), rgba(255,255,255,0));
        transform: translateX(-100%);
        transition: transform 0.6s cubic-bezier(0.165, 0.84, 0.44, 1);
      }
      
      i {
        font-size: 1.5rem;
        transition: transform 0.3s ease;
      }
      
      &:hover {
        transform: translateY(-3px);
        box-shadow: 0 6px 15px rgba(0, 0, 0, 0.1);
        
        &::before {
          transform: translateX(100%);
        }
        
        i {
          transform: scale(1.2);
        }
      }
      
      &:active {
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }
    }
    
    .gift-button {
      background: linear-gradient(135deg, var(--accent) 0%, var(--accent-darken, var(--accent)) 100%);
      color: #fff;
      
      &:hover {
        background: linear-gradient(135deg, var(--accent-darken, var(--accent)) 0%, var(--accent) 100%);
      }
    }
    
    .my-gifts-button, .view-gifts-button {
      background: linear-gradient(135deg, var(--buttonBg) 0%, var(--buttonHoverBg, var(--buttonBg)) 100%);
      color: var(--buttonFg);
      border: 1px solid var(--divider);
      
      &:hover {
        background: linear-gradient(135deg, var(--buttonHoverBg, var(--buttonBg)) 0%, var(--buttonBg) 100%);
      }
    }
    
    &.non-subscriber {
      background: linear-gradient(135deg, var(--panel) 0%, var(--panelHighlight, var(--panel)) 100%);
      border: 2px solid var(--accent);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
      transform: translateY(0);
      transition: transform 0.4s cubic-bezier(0.165, 0.84, 0.44, 1), box-shadow 0.4s ease;
      
      &:hover {
        transform: translateY(-5px);
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.15);
      }
      
      &::after {
        content: '';
        position: absolute;
        top: -5px;
        right: -5px;
        width: 100px;
        height: 100px;
        background: radial-gradient(circle, rgba(var(--accentRgb), 0.1) 0%, transparent 70%);
        border-radius: 50%;
        z-index: -1;
      }
    }
  }
</style>