<template>
  <div class="follow-suggestions" :class="{ compact: props.compact }">
    <div v-if="props.showHeader" class="header">
      <h2>{{ props.compact ? i18n.ts._growth.peopleToFollow : i18n.ts._growth.discoverInterestingPeople }}</h2>
      <p v-if="!props.compact">{{ i18n.ts._growth.followSuggestionsDescription }}</p>
    </div>
    
    <div v-if="loading" class="loading">
      <MkLoading />
    </div>
    
    <div v-else-if="suggestions.length > 0" class="suggestions-list">
      <div 
        v-for="user in displayedSuggestions" 
        :key="user.id" 
        class="suggestion-item"
        :class="{ followed: followedUsers.has(user.id) }"
      >
        <MkAvatar :user="user" class="avatar" />
        <div class="info">
          <div class="name">{{ user.name || user.username }}</div>
          <div class="username">@{{ user.username }}</div>
          <div v-if="user.description" class="description">
            {{ truncateDescription(user.description) }}
          </div>
          <div v-if="user.socialProof" class="social-proof">
            <span v-if="user.socialProof.mutualConnections > 0" class="mutual">
              <i class="ph-users-bold ph-sm"></i>
              {{ i18n.t('_growth.mutualConnections', { count: user.socialProof.mutualConnections }) }}
            </span>
            <span v-if="user.socialProof.isContactMatch" class="contact-match">
              <i class="ph-address-book-bold ph-sm"></i>
              {{ i18n.ts._growth.fromYourContacts }}
            </span>
          </div>
          <div class="stats">
            <span class="followers">
              <i class="ph-users-bold ph-sm"></i>
              {{ formatNumber(user.followersCount) }} {{ i18n.ts.followers }}
            </span>
            <span class="notes">
              <i class="ph-note-bold ph-sm"></i>
              {{ formatNumber(user.notesCount) }} {{ i18n.ts.notes }}
            </span>
          </div>
        </div>
        <div class="actions">
          <MkFollowButton 
            :user="user" 
            class="follow-btn"
            @update:following="onFollowUpdate(user.id, $event)"
          />
        </div>
      </div>
    </div>
    
    <div v-if="!props.compact" class="progress-section">
      <div class="progress-info">
        <h3>{{ i18n.ts._growth.buildYourNetwork }}</h3>
        <p>{{ i18n.t('_growth.followProgressDescription', { current: followedCount, target: targetFollows }) }}</p>
      </div>
      <div class="progress-bar">
        <div 
          class="progress-fill" 
          :style="{ width: `${Math.min(progressPercentage, 100)}%` }"
        ></div>
      </div>
      <div class="progress-text">
        {{ followedCount }} / {{ targetFollows }} {{ i18n.ts.people }}
      </div>
    </div>
    
    <div v-if="!props.compact" class="actions-footer">
      <MkButton @click="loadMore" outlined rounded :disabled="loading">
        {{ i18n.ts._growth.showMore }}
      </MkButton>
      <MkButton 
        @click="complete" 
        primary 
        rounded 
        :disabled="followedCount < minFollows"
      >
        {{ followedCount >= targetFollows ? i18n.ts._growth.continue : i18n.t('_growth.followXMorePeople', { count: Math.max(0, minFollows - followedCount) }) }}
      </MkButton>
    </div>
    
    <div v-else class="compact-footer">
      <MkButton @click="viewAllSuggestions" outlined rounded>
        {{ i18n.ts._growth.viewAllSuggestions }}
      </MkButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import * as os from '@/os';
import { i18n } from '@/i18n';
import { GrowthAnalytics } from '@/services/GrowthAnalytics';

const props = withDefaults(defineProps<{
  compact?: boolean;
  showHeader?: boolean;
  maxSuggestions?: number;
}>(), {
  compact: false,
  showHeader: true,
  maxSuggestions: 6,
});

const emit = defineEmits<{
  (ev: 'complete', data: { followedCount: number }): void;
}>();

const loading = ref(false);
const suggestions = ref([]);
const followedUsers = ref(new Set());
const offset = ref(0);
const targetFollows = 10;
const minFollows = 3;

const followedCount = computed(() => followedUsers.value.size);
const progressPercentage = computed(() => (followedCount.value / targetFollows) * 100);
const displayedSuggestions = computed(() => {
  return props.compact ? suggestions.value.slice(0, props.maxSuggestions) : suggestions.value;
});

onMounted(() => {
  loadSuggestions();
  // Track when component is viewed
  GrowthAnalytics.trackRecommendationEngagement('onboarding', 'view');
});

async function loadSuggestions() {
  if (loading.value) return;
  
  loading.value = true;
  try {
    const result = await os.api('users/recommendation', { 
      limit: 20,
      offset: offset.value 
    });
    
    if (offset.value === 0) {
      suggestions.value = result;
    } else {
      suggestions.value.push(...result);
    }
    
    offset.value += result.length;
  } catch (error) {
    console.error('Failed to load suggestions:', error);
    os.alert({
      type: 'error',
      text: i18n.ts.somethingHappened,
    });
  } finally {
    loading.value = false;
  }
}

async function loadMore() {
  await loadSuggestions();
}

function onFollowUpdate(userId: string, isFollowing: boolean) {
  if (isFollowing) {
    followedUsers.value.add(userId);
    // Track follow action
    GrowthAnalytics.trackFollowSuggestionInteraction('follow', userId);
  } else {
    followedUsers.value.delete(userId);
  }
}

function truncateDescription(description: string): string {
  if (!description) return '';
  return description.length > 100 ? description.substring(0, 100) + '...' : description;
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

function complete() {
  emit('complete', { followedCount: followedCount.value });
}

function viewAllSuggestions() {
  // Navigate to the full follow suggestions page
  window.location.href = '/onboarding/follow-suggestions';
}
</script>

<style lang="scss" scoped>
.follow-suggestions {
  max-width: 600px;
  margin: 0 auto;
  padding: 2rem;

  .header {
    text-align: center;
    margin-bottom: 2rem;

    h2 {
      margin: 0 0 0.5rem 0;
      color: var(--accent);
      font-size: 1.5rem;
    }

    p {
      margin: 0;
      color: var(--fg);
      opacity: 0.8;
      line-height: 1.4;
    }
  }

  .loading {
    text-align: center;
    padding: 2rem 0;
  }

  .suggestions-list {
    margin-bottom: 2rem;

    .suggestion-item {
      display: flex;
      align-items: flex-start;
      padding: 1.5rem;
      margin-bottom: 1rem;
      background: var(--panel);
      border-radius: 12px;
      border: 1px solid var(--divider);
      transition: all 0.2s ease;

      &:hover {
        border-color: var(--accent);
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      }

      &.followed {
        background: rgba(var(--accent), 0.05);
        border-color: var(--accent);
      }

      .avatar {
        width: 56px;
        height: 56px;
        margin-right: 1rem;
        flex-shrink: 0;
      }

      .info {
        flex: 1;
        min-width: 0;

        .name {
          font-weight: 600;
          color: var(--fg);
          margin-bottom: 0.25rem;
          font-size: 1.1rem;
        }

        .username {
          font-size: 0.9rem;
          color: var(--fg);
          opacity: 0.7;
          margin-bottom: 0.5rem;
        }

        .description {
          font-size: 0.9rem;
          color: var(--fg);
          opacity: 0.8;
          line-height: 1.4;
          margin-bottom: 0.5rem;
        }

        .social-proof {
          display: flex;
          gap: 1rem;
          margin-bottom: 0.5rem;

          .mutual, .contact-match {
            display: flex;
            align-items: center;
            gap: 0.25rem;
            font-size: 0.8rem;
            color: var(--accent);
            font-weight: 500;

            i {
              opacity: 0.8;
            }
          }
        }

        .stats {
          display: flex;
          gap: 1rem;
          font-size: 0.8rem;
          color: var(--fg);
          opacity: 0.7;

          span {
            display: flex;
            align-items: center;
            gap: 0.25rem;
          }
        }
      }

      .actions {
        margin-left: 1rem;
        flex-shrink: 0;
      }
    }
  }

  .progress-section {
    background: var(--panel);
    border-radius: 12px;
    padding: 1.5rem;
    margin-bottom: 2rem;
    border: 1px solid var(--divider);

    .progress-info {
      text-align: center;
      margin-bottom: 1rem;

      h3 {
        margin: 0 0 0.5rem 0;
        color: var(--accent);
        font-size: 1.1rem;
      }

      p {
        margin: 0;
        color: var(--fg);
        opacity: 0.8;
        font-size: 0.9rem;
      }
    }

    .progress-bar {
      width: 100%;
      height: 8px;
      background: var(--divider);
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 0.5rem;

      .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, var(--accent), var(--accentLighten));
        border-radius: 4px;
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

  .actions-footer {
    display: flex;
    gap: 1rem;
    justify-content: center;

    @media (max-width: 600px) {
      flex-direction: column;
    }
  }

  .compact-footer {
    text-align: center;
    margin-top: 1rem;
  }

  &.compact {
    padding: 1rem;
    max-width: none;

    .header {
      margin-bottom: 1rem;

      h2 {
        font-size: 1.2rem;
      }
    }

    .suggestions-list {
      margin-bottom: 1rem;

      .suggestion-item {
        padding: 1rem;
        margin-bottom: 0.75rem;

        .avatar {
          width: 48px;
          height: 48px;
        }

        .info {
          .name {
            font-size: 1rem;
          }

          .description {
            display: none; // Hide description in compact mode
          }

          .stats {
            font-size: 0.8rem;
          }
        }
      }
    }
  }
}
</style>