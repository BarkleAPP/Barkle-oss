<template>
  <div class="_formRoot">
    <FormInfo class="_formBlock">
      {{ i18n.ts.inviteFriendsDescription || 'Share your invite link to help friends join Barkle.' }}
    </FormInfo>

    <FormInput
      v-model="inviteLink"
      readonly
      class="_formBlock"
    >
      <template #label>{{ i18n.ts.yourInviteLink || 'Your Invite Link' }}</template>
      <template #prefix><i class="ph-link-bold ph-lg"></i></template>
      <template #caption>{{ i18n.ts.shareThisLinkWithFriends || 'Share this link with friends to invite them' }}</template>
    </FormInput>

    <div class="_formBlock">
      <MkButton @click="copyLink" primary :disabled="!inviteLink" inline style="margin-right: 8px;">
        <i class="ph-copy-bold ph-lg"></i> {{ copyButtonText }}
      </MkButton>
      <MkButton v-if="canShare" @click="shareToSocial('native')" :disabled="!inviteLink" inline>
        <i class="ph-share-bold ph-lg"></i> {{ i18n.ts.share || 'Share' }}
      </MkButton>
    </div>

    <FormSection>
      <template #label>{{ i18n.ts.shareOn || 'Share On' }}</template>
      
      <div class="social-buttons _formBlock">
        <MkButton @click="shareToSocial('twitter')" class="social-btn" :disabled="!inviteLink" inline>
          <i class="ph-twitter-logo-bold ph-lg"></i> Twitter
        </MkButton>
        <MkButton @click="shareToSocial('whatsapp')" class="social-btn" :disabled="!inviteLink" inline>
          <i class="ph-whatsapp-logo-bold ph-lg"></i> WhatsApp
        </MkButton>
        <MkButton @click="shareToSocial('telegram')" class="social-btn" :disabled="!inviteLink" inline>
          <i class="ph-telegram-logo-bold ph-lg"></i> Telegram
        </MkButton>
        <MkButton @click="shareToSocial('sms')" class="social-btn" :disabled="!inviteLink" inline>
          <i class="ph-chat-bold ph-lg"></i> SMS
        </MkButton>
      </div>
    </FormSection>

    <FormTextarea
      v-model="personalMessage"
      :max-length="200"
      class="_formBlock"
    >
      <template #label>{{ i18n.ts.personalMessage || 'Personal Message' }} ({{ i18n.ts.optional || 'Optional' }})</template>
      <template #caption>{{ personalMessage.length }}/200 - {{ i18n.ts.addPersonalMessageToInvite || 'Add a personal message to your invitation' }}</template>
    </FormTextarea>

    <FormSection v-if="invitationStats.totalSignups > 0">
      <template #label>{{ i18n.ts.invitationProgress || 'Your Stats' }}</template>
      
      <div class="stats-display _formBlock">
        <div class="stat-item">
          <i class="ph-user-plus-bold ph-lg"></i>
          <span class="stat-number">{{ invitationStats.totalSignups }}</span>
          <span class="stat-label">{{ i18n.ts.friendsJoined || 'Friends Joined' }}</span>
        </div>
      </div>
    </FormSection>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import * as os from '@/os';
import { i18n } from '@/i18n';
import { $i } from '@/account';
import { url } from '@/config';
import FormInput from '@/components/form/input.vue';
import FormTextarea from '@/components/form/textarea.vue';
import FormSection from '@/components/form/section.vue';
import FormInfo from '@/components/form/info.vue';
import MkButton from '@/components/MkButton.vue';

const personalMessage = ref('');
const inviteLink = ref('');
const copyButtonText = ref(i18n.ts.copy || 'Copy');
const copyTimeout = ref<any>(null);

const invitationStats = ref({
  totalSignups: 0,
  acceptanceRate: 0
});

const canShare = computed(() => {
  return typeof navigator !== 'undefined' && 'share' in navigator;
});

onMounted(async () => {
  // Generate invite link using user ID
  if ($i) {
    inviteLink.value = `${url}/invite/${$i.id}`;
  }
  await loadInvitationStats();
});

async function loadInvitationStats() {
  try {
    // Simple stats - just count signups from this user's invite code
    const result = await os.api('users/stats', {});
    if (result) {
      invitationStats.value = {
        totalSignups: result.inviteSignups || 0,
        acceptanceRate: result.inviteSignups > 0 ? 1 : 0
      };
    }
  } catch (error) {
    console.error('Failed to load invitation stats:', error);
  }
}

async function copyLink() {
  if (!inviteLink.value) return;

  try {
    await navigator.clipboard.writeText(inviteLink.value);
    copyButtonText.value = i18n.ts.copied || 'Copied!';
    os.success();

    // Reset button text after 2 seconds
    if (copyTimeout.value) clearTimeout(copyTimeout.value);
    copyTimeout.value = setTimeout(() => {
      copyButtonText.value = i18n.ts.copy || 'Copy';
    }, 2000);
  } catch (error) {
    console.error('Failed to copy link:', error);
    // Fallback for older browsers
    const input = document.createElement('input');
    input.value = inviteLink.value;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    copyButtonText.value = i18n.ts.copied || 'Copied!';
    os.success();
    if (copyTimeout.value) clearTimeout(copyTimeout.value);
    copyTimeout.value = setTimeout(() => {
      copyButtonText.value = i18n.ts.copy || 'Copy';
    }, 2000);
  }
}

async function shareToSocial(platform: string) {
  if (!inviteLink.value) return;

  const message = personalMessage.value ||
    `Join me on Barkle!`;
  const fullMessage = `${message}\n\n${inviteLink.value}`;

  if (platform === 'native' && navigator.share) {
    try {
      await navigator.share({
        title: 'Join Barkle!',
        text: message,
        url: inviteLink.value
      });
      return;
    } catch (error) {
      // User cancelled or share failed
      console.error('Share failed:', error);
    }
  }

  const urls = {
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(fullMessage)}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(fullMessage)}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent(inviteLink.value)}&text=${encodeURIComponent(message)}`,
    sms: `sms:?body=${encodeURIComponent(fullMessage)}`,
  };

  if (urls[platform]) {
    window.open(urls[platform], '_blank');
  }
}
</script>

<style lang="scss" scoped>
.social-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;

  .social-btn {
    display: flex;
    align-items: center;
    gap: 6px;
  }
}

.stats-display {
  .stat-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    background: var(--panel);
    border: 1px solid var(--divider);
    border-radius: 6px;

    i {
      color: var(--accent);
    }

    .stat-number {
      font-size: 24px;
      font-weight: 700;
      color: var(--accent);
    }

    .stat-label {
      font-size: 14px;
      color: var(--fg);
      opacity: 0.7;
    }
  }
}

@media (max-width: 600px) {
  .social-buttons {
    flex-direction: column;

    .social-btn {
      width: 100%;
      justify-content: center;
    }
  }
}
</style>