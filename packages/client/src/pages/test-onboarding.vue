<template>
  <div class="test-onboarding">
    <MkSpacer :content-max="800">
      <div class="test-header">
        <h1>Onboarding Components Test</h1>
        <p>This page is for testing the enhanced onboarding components.</p>
      </div>

      <div class="test-section">
        <h2>Follow Suggestions Component</h2>
        <FollowSuggestions @complete="onFollowComplete" />
      </div>

      <div v-if="showCompletion" class="test-section">
        <h2>Onboarding Complete Component</h2>
        <OnboardingComplete :stats="completionStats" />
      </div>

      <div class="test-section">
        <h2>Enhanced User Recommendations</h2>
        <p>Check the "Recommended for You" section in <MkA to="/explore/users">Explore Users</MkA>
        </p>
      </div>
    </MkSpacer>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import FollowSuggestions from '@/components/growth/FollowSuggestions.vue';
import OnboardingComplete from '@/components/growth/OnboardingComplete.vue';
import { definePageMetadata } from '@/scripts/page-metadata';

const showCompletion = ref(false);
const completionStats = ref({
  followedCount: 0,
  timelineReady: false,
});

function onFollowComplete(data: { followedCount: number }) {
  completionStats.value = {
    followedCount: data.followedCount,
    timelineReady: data.followedCount > 0,
  };
  showCompletion.value = true;
}

definePageMetadata({
  title: 'Test Onboarding Components',
  icon: 'ph-test-tube-bold ph-lg',
});
</script>

<style lang="scss" scoped>
.test-onboarding {
  padding: 2rem 0;

  .test-header {
    text-align: center;
    margin-bottom: 3rem;

    h1 {
      color: var(--accent);
      margin-bottom: 1rem;
    }

    p {
      color: var(--fg);
      opacity: 0.8;
    }
  }

  .test-section {
    margin-bottom: 3rem;
    padding: 2rem;
    background: var(--panel);
    border-radius: 12px;
    border: 1px solid var(--divider);

    h2 {
      color: var(--accent);
      margin-bottom: 1rem;
      font-size: 1.2rem;
    }

    p {
      color: var(--fg);
      opacity: 0.8;
      margin-bottom: 1rem;
    }
  }
}
</style>