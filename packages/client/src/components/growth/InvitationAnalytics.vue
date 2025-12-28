<template>
  <div class="invitation-analytics">
    <div class="analytics-header">
      <h2>{{ i18n.ts.invitationAnalytics }}</h2>
      <p>{{ i18n.ts.invitationAnalyticsDescription }}</p>
    </div>

    <div v-if="loading" class="loading">
      <MkLoading />
    </div>

    <div v-else class="analytics-content">
      <div class="stats-overview">
        <div class="stat-card total">
          <div class="stat-icon">
            <i class="ph-paper-plane-tilt-bold"></i>
          </div>
          <div class="stat-info">
            <div class="stat-number">{{ stats.totalSent }}</div>
            <div class="stat-label">{{ i18n.ts.totalInvitesSent }}</div>
          </div>
        </div>

        <div class="stat-card accepted">
          <div class="stat-icon">
            <i class="ph-check-circle-bold"></i>
          </div>
          <div class="stat-info">
            <div class="stat-number">{{ stats.accepted }}</div>
            <div class="stat-label">{{ i18n.ts.friendsJoined }}</div>
          </div>
        </div>

        <div class="stat-card pending">
          <div class="stat-icon">
            <i class="ph-hourglass-bold"></i>
          </div>
          <div class="stat-info">
            <div class="stat-number">{{ stats.pending }}</div>
            <div class="stat-label">{{ i18n.ts.pendingInvitations }}</div>
          </div>
        </div>

        <div class="stat-card rate">
          <div class="stat-icon">
            <i class="ph-chart-line-up-bold"></i>
          </div>
          <div class="stat-info">
            <div class="stat-number">{{ Math.round(stats.acceptanceRate * 100) }}%</div>
            <div class="stat-label">{{ i18n.ts.acceptanceRate }}</div>
          </div>
        </div>
      </div>

      <div v-if="stats.accepted > 0" class="success-celebration">
        <div class="celebration-content">
          <i class="ph-confetti-bold"></i>
          <h3>{{ i18n.ts.congratulations }}</h3>
          <p>{{ stats.accepted > 1 ? `${stats.accepted} of your friends have joined Barkle thanks to you!` : `${stats.accepted} friend has joined Barkle thanks to you!` }}</p>
        </div>
      </div>

      <div v-if="recentInvitations.length > 0" class="recent-invitations">
        <h3>{{ i18n.ts.recentInvitations }}</h3>
        <div class="invitations-list">
          <div 
            v-for="invitation in recentInvitations" 
            :key="invitation.id"
            class="invitation-item"
            :class="{ 
              accepted: invitation.isAccepted, 
              expired: invitation.isExpired,
              pending: !invitation.isAccepted && !invitation.isExpired
            }"
          >
            <div class="invitation-main">
              <div class="recipient-info">
                <div class="recipient-name">
                  {{ invitation.recipientName || invitation.recipientIdentifier }}
                </div>
                <div class="invitation-meta">
                  <span class="method">
                    <i :class="getMethodIcon(invitation.method)"></i>
                    {{ getMethodLabel(invitation.method) }}
                  </span>
                  <span class="date">
                    <MkTime :time="invitation.createdAt" />
                  </span>
                </div>
              </div>
              
              <div class="invitation-status">
                <div v-if="invitation.isAccepted" class="status accepted">
                  <i class="ph-check-circle-bold"></i>
                  <span>{{ i18n.ts.accepted }}</span>
                </div>
                <div v-else-if="invitation.isExpired" class="status expired">
                  <i class="ph-clock-bold"></i>
                  <span>{{ i18n.ts.expired }}</span>
                </div>
                <div v-else class="status pending">
                  <i class="ph-hourglass-bold"></i>
                  <span>{{ i18n.ts.pending }}</span>
                </div>
              </div>
            </div>

            <div v-if="invitation.isAccepted && invitation.acceptedUser" class="accepted-user">
              <MkAvatar :user="invitation.acceptedUser" class="user-avatar" />
              <div class="user-info">
                <div class="user-name">
                  {{ invitation.acceptedUser.name || invitation.acceptedUser.username }}
                </div>
                <div class="joined-date">
                  {{ i18n.ts.joined }} <MkTime :time="invitation.acceptedAt" />
                </div>
              </div>
              <MkButton 
                @click="viewProfile(invitation.acceptedUser)" 
                outlined 
                small
              >
                {{ i18n.ts.viewProfile }}
              </MkButton>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="stats.totalSent === 0" class="no-invitations">
        <div class="no-invitations-icon">
          <i class="ph-users-three-bold ph-3x"></i>
        </div>
        <h3>{{ i18n.ts.noInvitationsSent }}</h3>
        <p>{{ i18n.ts.startInvitingFriends }}</p>
        <MkButton @click="openInviteInterface" primary>
          <i class="ph-paper-plane-tilt-bold"></i>
          {{ i18n.ts.inviteFriends }}
        </MkButton>
      </div>

      <div class="analytics-actions">
        <MkButton @click="refreshStats" outlined>
          <i class="ph-arrows-clockwise-bold"></i>
          {{ i18n.ts.refresh }}
        </MkButton>
        <MkButton @click="openInviteInterface" primary>
          <i class="ph-plus-bold"></i>
          {{ i18n.ts.inviteMoreFriends }}
        </MkButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import * as os from '@/os';
import { i18n } from '@/i18n';
import { useRouter } from '@/router';

const router = useRouter();

const loading = ref(true);
const stats = ref({
  totalSent: 0,
  accepted: 0,
  pending: 0,
  acceptanceRate: 0,
});
const recentInvitations = ref([]);

onMounted(async () => {
  await loadAnalytics();
});

async function loadAnalytics() {
  try {
    loading.value = true;
    const result = await os.api('invitations/status', {
      includeDetails: true,
      limit: 20,
    });
    
    stats.value = result.stats;
    recentInvitations.value = result.recentInvitations;
  } catch (error) {
    console.error('Failed to load invitation analytics:', error);
    os.alert({
      type: 'error',
      text: i18n.ts.failedToLoadAnalytics,
    });
  } finally {
    loading.value = false;
  }
}

async function refreshStats() {
  await loadAnalytics();
  os.success(i18n.ts.analyticsRefreshed);
}

function openInviteInterface() {
  router.push('/invite-friends');
}

function viewProfile(user: any) {
  router.push(`/@${user.username}`);
}

function getMethodIcon(method: string): string {
  const icons = {
    email: 'ph-envelope-bold',
    sms: 'ph-chat-bold',
    social: 'ph-share-network-bold',
    link: 'ph-link-bold',
  };
  return icons[method] || 'ph-question-bold';
}

function getMethodLabel(method: string): string {
  const labels = {
    email: i18n.ts.email,
    sms: 'SMS',
    social: i18n.ts.social,
    link: i18n.ts.link,
  };
  return labels[method] || method;
}
</script>

<style lang="scss" scoped>
.invitation-analytics {
  .analytics-header {
    text-align: center;
    margin-bottom: 2rem;

    h2 {
      margin: 0 0 0.5rem 0;
      color: var(--accent);
      font-size: 1.5rem;
      font-weight: 600;
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
    padding: 3rem 0;
  }

  .analytics-content {
    .stats-overview {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;

      .stat-card {
        background: var(--panel);
        border-radius: 12px;
        padding: 1.5rem;
        border: 1px solid var(--divider);
        display: flex;
        align-items: center;
        gap: 1rem;
        transition: all 0.2s ease;

        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .stat-icon {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
        }

        &.total .stat-icon {
          background: rgba(var(--accent), 0.1);
          color: var(--accent);
        }

        &.accepted .stat-icon {
          background: rgba(var(--success), 0.1);
          color: var(--success);
        }

        &.pending .stat-icon {
          background: rgba(var(--warn), 0.1);
          color: var(--warn);
        }

        &.rate .stat-icon {
          background: rgba(var(--info), 0.1);
          color: var(--info);
        }

        .stat-info {
          flex: 1;

          .stat-number {
            font-size: 2rem;
            font-weight: 700;
            color: var(--fg);
            margin-bottom: 0.25rem;
          }

          .stat-label {
            font-size: 0.9rem;
            color: var(--fg);
            opacity: 0.7;
            font-weight: 500;
          }
        }
      }
    }

    .success-celebration {
      background: linear-gradient(135deg, rgba(var(--success), 0.1) 0%, rgba(var(--success), 0.05) 100%);
      border: 1px solid var(--success);
      border-radius: 12px;
      padding: 2rem;
      margin-bottom: 2rem;
      text-align: center;

      .celebration-content {
        i {
          font-size: 3rem;
          color: var(--success);
          margin-bottom: 1rem;
        }

        h3 {
          margin: 0 0 0.5rem 0;
          color: var(--success);
          font-size: 1.3rem;
          font-weight: 600;
        }

        p {
          margin: 0;
          color: var(--fg);
          font-size: 1.1rem;
        }
      }
    }

    .recent-invitations {
      margin-bottom: 2rem;

      h3 {
        margin: 0 0 1.5rem 0;
        color: var(--fg);
        font-size: 1.2rem;
      }

      .invitations-list {
        .invitation-item {
          background: var(--panel);
          border-radius: 12px;
          padding: 1.5rem;
          margin-bottom: 1rem;
          border: 1px solid var(--divider);
          transition: all 0.2s ease;

          &.accepted {
            border-color: var(--success);
            background: rgba(var(--success), 0.02);
          }

          &.expired {
            opacity: 0.6;
          }

          &.pending {
            border-color: var(--warn);
            background: rgba(var(--warn), 0.02);
          }

          .invitation-main {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;

            .recipient-info {
              flex: 1;

              .recipient-name {
                font-weight: 600;
                color: var(--fg);
                margin-bottom: 0.5rem;
                font-size: 1.1rem;
              }

              .invitation-meta {
                display: flex;
                gap: 1rem;
                font-size: 0.8rem;
                color: var(--fg);
                opacity: 0.7;

                .method {
                  display: flex;
                  align-items: center;
                  gap: 0.25rem;
                }
              }
            }

            .invitation-status {
              .status {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                padding: 0.5rem 1rem;
                border-radius: 20px;
                font-size: 0.8rem;
                font-weight: 500;

                &.accepted {
                  background: rgba(var(--success), 0.1);
                  color: var(--success);
                }

                &.expired {
                  background: rgba(var(--warn), 0.1);
                  color: var(--warn);
                }

                &.pending {
                  background: rgba(var(--accent), 0.1);
                  color: var(--accent);
                }
              }
            }
          }

          .accepted-user {
            display: flex;
            align-items: center;
            gap: 1rem;
            padding: 1rem;
            background: var(--bg);
            border-radius: 8px;
            border: 1px solid var(--divider);

            .user-avatar {
              width: 40px;
              height: 40px;
              flex-shrink: 0;
            }

            .user-info {
              flex: 1;

              .user-name {
                font-weight: 600;
                color: var(--fg);
                margin-bottom: 0.25rem;
              }

              .joined-date {
                font-size: 0.8rem;
                color: var(--fg);
                opacity: 0.7;
              }
            }
          }
        }
      }
    }

    .no-invitations {
      text-align: center;
      padding: 3rem 2rem;

      .no-invitations-icon {
        color: var(--fg);
        opacity: 0.3;
        margin-bottom: 1.5rem;
      }

      h3 {
        margin: 0 0 1rem 0;
        color: var(--fg);
        font-size: 1.3rem;
      }

      p {
        margin: 0 0 2rem 0;
        color: var(--fg);
        opacity: 0.8;
        line-height: 1.5;
      }
    }

    .analytics-actions {
      display: flex;
      gap: 1rem;
      justify-content: center;
      margin-top: 2rem;

      @media (max-width: 600px) {
        flex-direction: column;
      }
    }
  }
}

@media (max-width: 600px) {
  .invitation-analytics {
    .stats-overview {
      grid-template-columns: repeat(2, 1fr);
    }

    .invitation-main {
      flex-direction: column;
      align-items: flex-start;
      gap: 1rem;
    }

    .accepted-user {
      flex-direction: column;
      text-align: center;
    }
  }
}
</style>