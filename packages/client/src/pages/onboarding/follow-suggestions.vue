<template>
  <div class="onboarding-page">
    <div class="progress-header">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: `${progressPercentage}%` }"></div>
      </div>
      <div class="progress-text">
        {{ i18n.t('_growth.onboardingStep', { current: currentStep, total: totalSteps }) }}
      </div>
    </div>

    <div class="content">
      <FollowSuggestions 
        v-if="currentStep === 1"
        @complete="onFollowSuggestionsComplete"
      />
      
      <OnboardingComplete 
        v-else-if="currentStep === 2"
        :stats="completionStats"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import FollowSuggestions from '@/components/growth/FollowSuggestions.vue';
import OnboardingComplete from '@/components/growth/OnboardingComplete.vue';
import { i18n } from '@/i18n';
import { definePageMetadata } from '@/scripts/page-metadata';

const currentStep = ref(1);
const totalSteps = 2;
const completionStats = ref({
  followedCount: 0,
  timelineReady: false,
});

const progressPercentage = computed(() => (currentStep.value / totalSteps) * 100);

function onFollowSuggestionsComplete(data: { followedCount: number }) {
  completionStats.value = {
    followedCount: data.followedCount,
    timelineReady: data.followedCount > 0,
  };
  
  currentStep.value = 2;
  
  // Track analytics
  if (typeof gtag !== 'undefined') {
    gtag('event', 'onboarding_follow_complete', {
      followed_count: data.followedCount,
    });
  }
}

definePageMetadata({
  title: i18n.ts._growth.onboarding,
  icon: 'ph-user-plus-bold ph-lg',
});
</script>

<style lang="scss" scoped>
.onboarding-page {
  min-height: 100vh;
  background: var(--bg);

  .progress-header {
    position: sticky;
    top: 0;
    z-index: 10;
    background: var(--panel);
    border-bottom: 1px solid var(--divider);
    padding: 1rem 2rem;

    .progress-bar {
      width: 100%;
      height: 4px;
      background: var(--divider);
      border-radius: 2px;
      overflow: hidden;
      margin-bottom: 0.5rem;

      .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, var(--accent), var(--accentLighten));
        border-radius: 2px;
        transition: width 0.3s ease;
      }
    }

    .progress-text {
      text-align: center;
      font-size: 0.9rem;
      color: var(--fg);
      opacity: 0.8;
      font-weight: 500;
    }
  }

  .content {
    padding: 2rem 1rem;
  }
}

@media (max-width: 600px) {
  .onboarding-page {
    .progress-header {
      padding: 1rem;
    }

    .content {
      padding: 1rem;
    }
  }
}
</style>