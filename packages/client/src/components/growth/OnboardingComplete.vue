<template>
  <div class="onboarding-complete">
    <div class="celebration">
      <div class="icon">
        <i class="ph-check-circle-bold ph-lg"></i>
      </div>
      <h2>{{ i18n.ts._growth.welcomeToBarkle }}</h2>
      <p>{{ i18n.ts._growth.onboardingCompleteMessage }}</p>
    </div>

    <!-- Positive Reinforcement for completing onboarding -->
    <div class="positive-reinforcement">
      <div class="encouragement-card">
        <div class="encouragement-icon">
          <MkEmoji emoji="🎉" :custom-emojis="[]" :is-reaction="false" />
        </div>
        <div class="encouragement-content">
          <h4>{{ i18n.ts.congratulations || 'Congratulations!' }}</h4>
          <p>{{ i18n.ts.onboardingPositiveMessage || 'You\'ve taken the first step in building your community on Barkle. We\'re excited to see what you\'ll share!' }}</p>
        </div>
      </div>
    </div>

    <div class="stats">
      <div class="stat-item">
        <div class="number">{{ stats.followedCount }}</div>
        <div class="label">{{ i18n.ts._growth.peopleFollowed }}</div>
      </div>
      <div class="stat-item">
        <div class="number">{{ stats.timelineReady ? '✓' : '...' }}</div>
        <div class="label">{{ i18n.ts._growth.timelineReady }}</div>
      </div>
    </div>

    <div class="next-steps">
      <h3>{{ i18n.ts._growth.nextSteps }}</h3>
      <div class="steps-list">
        <div class="step-item">
          <i class="ph-note-pencil-bold ph-lg"></i>
          <div>
            <div class="step-title">{{ i18n.ts._growth.shareYourFirstNote }}</div>
            <div class="step-desc">{{ i18n.ts._growth.shareYourFirstNoteDesc }}</div>
          </div>
        </div>
        <div class="step-item">
          <i class="ph-user-plus-bold ph-lg"></i>
          <div>
            <div class="step-title">{{ i18n.ts._growth.inviteFriends }}</div>
            <div class="step-desc">{{ i18n.ts._growth.inviteFriendsDesc }}</div>
          </div>
        </div>
        <div class="step-item">
          <i class="ph-compass-bold ph-lg"></i>
          <div>
            <div class="step-title">{{ i18n.ts._growth.exploreMore }}</div>
            <div class="step-desc">{{ i18n.ts._growth.exploreMoreDesc }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="actions">
      <MkButton @click="goToTimeline" primary rounded large>
        <i class="ph-house-bold ph-lg"></i>
        {{ i18n.ts._growth.goToTimeline }}
      </MkButton>
      <MkButton @click="exploreUsers" outlined rounded>
        <i class="ph-compass-bold ph-lg"></i>
        {{ i18n.ts._growth.exploreUsers }}
      </MkButton>
    </div>

    <div class="encouragement">
      <p>{{ i18n.ts._growth.onboardingEncouragement }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { i18n } from '@/i18n';
import { useRouter } from '@/router';

const props = defineProps<{
  stats: {
    followedCount: number;
    timelineReady: boolean;
  };
}>();

const router = useRouter();

onMounted(() => {
  // Track onboarding completion
  trackOnboardingCompletion();
});

function trackOnboardingCompletion() {
  // Analytics tracking for onboarding completion
  if (typeof (window as any).gtag !== 'undefined') {
    (window as any).gtag('event', 'onboarding_complete', {
      followed_count: props.stats.followedCount,
      timeline_ready: props.stats.timelineReady,
    });
  }
}

function goToTimeline() {
  router.push('/');
}

function exploreUsers() {
  router.push('/explore/users');
}
</script>

<style lang="scss" scoped>
.onboarding-complete {
  max-width: 500px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;

  .celebration {
    margin-bottom: 2rem;

    .icon {
      font-size: 4rem;
      color: var(--success);
      margin-bottom: 1rem;
      animation: bounce 1s ease-in-out;
    }

    h2 {
      margin: 0 0 1rem 0;
      color: var(--accent);
      font-size: 1.8rem;
      font-weight: 700;
    }

    p {
      margin: 0;
      color: var(--fg);
      opacity: 0.8;
      font-size: 1.1rem;
      line-height: 1.5;
    }
  }

  .stats {
    display: flex;
    justify-content: center;
    gap: 2rem;
    margin-bottom: 2rem;
    padding: 1.5rem;
    background: var(--panel);
    border-radius: 12px;
    border: 1px solid var(--divider);

    .stat-item {
      text-align: center;

      .number {
        font-size: 2rem;
        font-weight: 700;
        color: var(--accent);
        margin-bottom: 0.5rem;
      }

      .label {
        font-size: 0.9rem;
        color: var(--fg);
        opacity: 0.8;
      }
    }
  }

  .next-steps {
    margin-bottom: 2rem;
    text-align: left;

    h3 {
      text-align: center;
      margin: 0 0 1.5rem 0;
      color: var(--accent);
      font-size: 1.2rem;
    }

    .steps-list {
      .step-item {
        display: flex;
        align-items: flex-start;
        gap: 1rem;
        padding: 1rem;
        margin-bottom: 0.5rem;
        background: var(--panel);
        border-radius: 8px;
        border: 1px solid var(--divider);

        i {
          color: var(--accent);
          margin-top: 0.25rem;
          flex-shrink: 0;
        }

        .step-title {
          font-weight: 600;
          color: var(--fg);
          margin-bottom: 0.25rem;
        }

        .step-desc {
          font-size: 0.9rem;
          color: var(--fg);
          opacity: 0.8;
          line-height: 1.4;
        }
      }
    }
  }

  .actions {
    display: flex;
    gap: 1rem;
    justify-content: center;
    margin-bottom: 2rem;

    @media (max-width: 600px) {
      flex-direction: column;
    }
  }

  .encouragement {
    p {
      margin: 0;
      font-size: 0.9rem;
      color: var(--fg);
      opacity: 0.7;
      font-style: italic;
    }
  }

  .positive-reinforcement {
    margin-bottom: 2rem;

    .encouragement-card {
      background: linear-gradient(135deg, var(--accent) 0%, var(--accent-lighten) 100%);
      border-radius: 12px;
      padding: 1.5rem;
      display: flex;
      align-items: center;
      gap: 1rem;
      color: white;
      animation: glow 2s ease-in-out infinite alternate;

      .encouragement-icon {
        font-size: 2rem;
        flex-shrink: 0;
      }

      .encouragement-content {
        flex: 1;

        h4 {
          font-weight: bold;
          margin: 0 0 0.5rem 0;
          font-size: 1.1rem;
        }

        p {
          margin: 0;
          opacity: 0.9;
          line-height: 1.4;
          font-style: normal;
        }
      }

      @media (max-width: 600px) {
        flex-direction: column;
        text-align: center;
      }
    }
  }
}

@keyframes bounce {
  0%, 20%, 50%, 80%, 100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-10px);
  }
  60% {
    transform: translateY(-5px);
  }
}

@keyframes glow {
  0% {
    box-shadow: 0 0 20px rgba(var(--accent-rgb), 0.3);
  }
  100% {
    box-shadow: 0 0 30px rgba(var(--accent-rgb), 0.5);
  }
}
</style>