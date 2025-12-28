<template>
  <div class="invite-page-wrapper">
    <!-- Loading State -->
    <div v-if="loading" class="state-screen loading">
      <div class="state-content">
        <MkLoading />
        <h2>{{ i18n.ts.checking }}</h2>
        <p>{{ i18n.ts.validatingInvitation }}</p>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="state-screen error">
      <div class="state-content">
        <div class="state-icon error">
          <i class="ph-x-circle-bold"></i>
        </div>
        <h2>{{ getErrorTitle() }}</h2>
        <p>{{ errorMessage }}</p>
        <MkButton @click="goHome" primary class="action-btn">
          <i class="ph-house-bold"></i>
          {{ i18n.ts.goToHome }}
        </MkButton>
      </div>
    </div>

    <!-- Success State -->
    <div v-else-if="accepted" class="state-screen success">
      <div class="state-content">
        <div class="state-icon success">
          <i class="ph-check-circle-bold"></i>
        </div>
        <h2>{{ i18n.ts.welcomeToBarkle }}</h2>
        <p>{{ i18n.ts.invitationAcceptedSuccessfully }}</p>

        <div v-if="acceptedInvitation?.inviter" class="connection-info">
          <MkAvatar :user="acceptedInvitation.inviter" class="connection-avatar" :disableDecorations="false"
            :showIndicator="false" />
          <p>{{ i18n.t('nowConnectedWith', {
            name: acceptedInvitation.inviter.name ||
              acceptedInvitation.inviter.username
          }) || `You're now connected with ${acceptedInvitation.inviter.name ||
          acceptedInvitation.inviter.username}!` }}</p>
        </div>

        <div class="success-actions">
          <MkButton @click="goToTimeline" primary class="action-btn">
            <i class="ph-house-bold"></i>
            {{ i18n.ts.goToTimeline }}
          </MkButton>
          <MkButton @click="exploreUsers" class="action-btn">
            <i class="ph-users-bold"></i>
            {{ i18n.ts.exploreUsers }}
          </MkButton>
        </div>
      </div>
    </div>

    <!-- Invitation Details -->
    <div v-else-if="invitation" class="invite-screen">
      <div class="invite-container">
        <!-- Header -->
        <div class="invite-header">
          <div class="inviter-section">
            <MkAvatar v-if="invitation.inviter" :user="invitation.inviter" class="inviter-avatar"
              :disableDecorations="true" :showIndicator="false" />
            <div v-else class="default-avatar">
              <i class="ph-user-bold"></i>
            </div>
            <div class="invite-text">
              <h1>{{ i18n.ts.youAreInvited }}</h1>
              <p v-if="invitation.inviter" class="inviter-message">
                <strong>{{ invitation.inviter.name || invitation.inviter.username }}</strong> {{
                  i18n.ts.invitedYouToBarkle }}
              </p>
              <p v-else class="inviter-message">
                {{ i18n.ts.invitedToBarkle }}
              </p>
            </div>
          </div>
        </div>

        <!-- Personal Message -->
        <div v-if="invitation.personalMessage" class="personal-message-section">
          <div class="message-card">
            <div class="message-icon">
              <i class="ph-chat-circle-bold"></i>
            </div>
            <div class="message-content">
              <h3>{{ i18n.ts.personalMessage }}</h3>
              <p>"{{ invitation.personalMessage }}"</p>
            </div>
          </div>
        </div>

        <!-- About Barkle -->
        <div class="about-section">
          <h3>{{ i18n.ts.aboutBarkle }}</h3>
          <p>{{ i18n.ts.barkleDescription }}</p>

          <div class="features-grid">
            <div class="feature-item">
              <div class="feature-icon">
                <i class="ph-chat-circle-bold"></i>
              </div>
              <span>{{ i18n.ts.shareThoughts }}</span>
            </div>
            <div class="feature-item">
              <div class="feature-icon">
                <i class="ph-users-bold"></i>
              </div>
              <span>{{ i18n.ts.connectWithFriends }}</span>
            </div>
            <div class="feature-item">
              <div class="feature-icon">
                <i class="ph-heart-bold"></i>
              </div>
              <span>{{ i18n.ts.expressReactions }}</span>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="actions-section">
          <!-- Existing Account Info -->
          <div v-if="$i" class="eligibility-warning">
            <div class="warning-icon">
              <i class="ph-info-bold"></i>
            </div>
            <div class="warning-content">
              <h4>{{ i18n.ts.alreadyHaveAccount }}</h4>
              <p>{{ i18n.ts.inviteOnlyForNewSignups }}</p>
            </div>
            <MkButton @click="goToTimeline" class="action-btn">
              <i class="ph-house-bold"></i>
              {{ i18n.ts.goToTimeline }}
            </MkButton>
          </div>

          <!-- Guest Actions -->
          <div v-else class="guest-actions">
            <div class="cta-section">
              <h4>{{ i18n.ts.joinBarkleToday }}</h4>
              <p>{{ i18n.ts.createAccountToAcceptInvite }}</p>
              <div class="invite-note">
                <i class="ph-info-bold"></i>
                <span>{{ i18n.ts.inviteOnlyForNewSignups }}</span>
              </div>
            </div>

            <div class="action-buttons">
              <MkButton @click="signupWithInvite" primary class="action-btn primary">
                <i class="ph-user-plus-bold"></i>
                {{ i18n.ts.signUpAndAccept }}
              </MkButton>
              <MkButton @click="signinWithInvite" class="action-btn secondary">
                <i class="ph-sign-in-bold"></i>
                {{ i18n.ts.signIn }}
              </MkButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from '@/router';
import * as os from '@/os';
import { i18n } from '@/i18n';
import { $i } from '@/account';
import { definePageMetadata } from '@/scripts/page-metadata';

import MkSigninDialog from '@/components/MkSigninDialog.vue';
import MkSignupDialog from '@/components/MkSignupDialog.vue';
import MkButton from '@/components/MkButton.vue';

const props = defineProps<{
  code: string;
}>();

const router = useRouter();

const loading = ref(true);
const error = ref(false);
const errorMessage = ref('');
const invitation = ref(null);
const accepted = ref(false);
const acceptedInvitation = ref<{ inviter?: any } | null>(null);

definePageMetadata(
  computed(() => ({
    title: i18n.ts.invitation,
    icon: 'ph-envelope-bold',
    path: `/invite/${props.code}`,
  })),
);

watch(() => props.code, (newCode) => {
  if (newCode) {
    validateInvitation();
  }
}, { immediate: true });

onMounted(async () => {
  if (!props.code) {
    error.value = true;
    errorMessage.value = i18n.ts.invalidInviteCode;
    loading.value = false;
    return;
  }
  await validateInvitation();
});

async function validateInvitation() {
  if (!props.code) {
    error.value = true;
    errorMessage.value = i18n.ts.invalidInviteCode;
    loading.value = false;
    return;
  }

  try {
    loading.value = true;
    error.value = false;

    const result = await os.api('invitations/validate', {
      inviteCode: props.code
    });

    if (result.isValid) {
      invitation.value = result.invitation;


    } else {
      error.value = true;
      errorMessage.value = getErrorMessage(result.error);
    }
  } catch (err: any) {
    console.error('Failed to validate invitation:', err);
    error.value = true;
    errorMessage.value = i18n.ts.invitationValidationFailed;
  } finally {
    loading.value = false;
  }
}



function signupWithInvite() {
  sessionStorage.setItem('pendingInviteCode', props.code);
  os.popup(MkSignupDialog, { autoSet: true }, {
    done: () => {
      // Invitation is processed during signup, show success
      accepted.value = true;
      acceptedInvitation.value = { inviter: invitation.value?.inviter };
    }
  }, 'closed');
}

function signinWithInvite() {
  sessionStorage.setItem('pendingInviteCode', props.code);
  os.popup(MkSigninDialog, { autoSet: true }, {
    done: () => {
      // Just go to timeline for existing users
      goToTimeline();
    }
  }, 'closed');
}



function goHome() {
  router.push('/');
}

function goToTimeline() {
  router.push('/');
}

function exploreUsers() {
  router.push('/explore');
}

function getErrorMessage(error: string): string {
  const errorMessages = {
    'Invitation not found': i18n.ts.invitationNotFound,
    'Invitation already used': i18n.ts.invitationAlreadyUsed,
    'Invitation expired': i18n.ts.invitationExpired,
    'User not eligible': i18n.ts.inviteOnlyForNewAccounts,
  };
  return errorMessages[error] || i18n.ts.invalidInviteCode;
}

function getErrorTitle(): string {
  if (errorMessage.value.includes('not eligible') || errorMessage.value.includes('new accounts')) {
    return i18n.ts.existingAccountNotEligible;
  }
  return i18n.ts.invitationError || 'Invitation Error';
}
</script>

<style lang="scss" scoped>
.invite-page-wrapper {
  min-height: 100vh;
  background: linear-gradient(135deg, var(--bg) 0%, var(--panel) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.state-screen {
  max-width: 500px;
  width: 100%;
  text-align: center;

  .state-content {
    background: var(--panel);
    border-radius: 20px;
    padding: 48px 32px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
    border: 1px solid var(--divider);

    .state-icon {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      font-size: 32px;

      &.error {
        background: var(--error);
        color: white;
      }

      &.success {
        background: var(--success);
        color: white;
      }
    }

    h2 {
      margin: 0 0 12px 0;
      font-size: 28px;
      font-weight: 700;
      color: var(--fg);
    }

    p {
      margin: 0 0 32px 0;
      color: var(--fgTransparent);
      font-size: 16px;
      line-height: 1.6;
    }

    .connection-info {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 24px;
      background: var(--accentedBg);
      border-radius: 12px;
      margin-bottom: 32px;

      .connection-avatar {
        width: 60px;
        height: 60px;
        border: 3px solid var(--accent);
      }

      p {
        margin: 0;
        color: var(--accent);
        font-weight: 600;
        font-size: 16px;
      }
    }

    .success-actions {
      display: flex;
      justify-content: center;
      gap: 12px;
    }
  }

  &.loading .state-content {
    .state-icon {
      background: var(--accent);
      color: var(--fgOnAccent);
    }
  }
}

.invite-screen {
  max-width: 600px;
  width: 100%;

  .invite-container {
    background: var(--panel);
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
    border: 1px solid var(--divider);
  }

  .invite-header {
    background: linear-gradient(135deg, var(--accent), var(--accentLighten));
    color: white;
    padding: 40px 32px;
    text-align: center;

    .inviter-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;

      .inviter-avatar {
        width: 100px;
        height: 100px;
        border: 4px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
      }

      .default-avatar {
        width: 100px;
        height: 100px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 40px;
        color: white;
      }

      .invite-text {
        h1 {
          margin: 0 0 8px 0;
          font-size: 32px;
          font-weight: 700;
          color: white;
        }

        .inviter-message {
          margin: 0;
          font-size: 18px;
          opacity: 0.9;
          line-height: 1.5;

          strong {
            font-weight: 600;
          }
        }
      }
    }
  }

  .personal-message-section {
    padding: 32px;
    border-bottom: 1px solid var(--divider);

    .message-card {
      display: flex;
      gap: 16px;
      padding: 20px;
      background: var(--bg);
      border-radius: 12px;
      border-left: 4px solid var(--accent);

      .message-icon {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: var(--accent);
        color: var(--fgOnAccent);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        flex-shrink: 0;
      }

      .message-content {
        h3 {
          margin: 0 0 8px 0;
          font-size: 16px;
          font-weight: 600;
          color: var(--fg);
        }

        p {
          margin: 0;
          font-style: italic;
          color: var(--fgTransparent);
          line-height: 1.6;
        }
      }
    }
  }

  .about-section {
    padding: 32px;
    border-bottom: 1px solid var(--divider);

    h3 {
      margin: 0 0 16px 0;
      font-size: 20px;
      font-weight: 600;
      color: var(--fg);
    }

    p {
      margin: 0 0 24px 0;
      color: var(--fgTransparent);
      line-height: 1.6;
    }

    .features-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;

      .feature-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px;
        background: var(--bg);
        border-radius: 12px;
        border: 1px solid var(--divider);
        transition: all 0.2s ease;

        &:hover {
          background: var(--panelHighlight);
          transform: translateY(-2px);
        }

        .feature-icon {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: var(--accent);
          color: var(--fgOnAccent);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          flex-shrink: 0;
        }

        span {
          color: var(--fg);
          font-weight: 500;
        }
      }
    }
  }

  .actions-section {
    padding: 32px;
    background: var(--bg);

    .eligibility-warning {
      text-align: center;
      padding: 24px;
      background: var(--infoWarnBg);
      border: 1px solid var(--warn);
      border-radius: 12px;
      margin-bottom: 24px;

      .warning-icon {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: var(--warn);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 16px;
        font-size: 24px;
      }

      .warning-content {
        margin-bottom: 24px;

        h4 {
          margin: 0 0 8px 0;
          font-size: 18px;
          font-weight: 600;
          color: var(--warn);
        }

        p {
          margin: 0;
          color: var(--infoWarnFg);
          line-height: 1.5;
        }
      }
    }

    .logged-in-actions {
      text-align: center;
    }

    .guest-actions {
      .cta-section {
        text-align: center;
        margin-bottom: 32px;

        h4 {
          margin: 0 0 8px 0;
          font-size: 24px;
          font-weight: 700;
          color: var(--fg);
        }

        p {
          margin: 0;
          color: var(--fgTransparent);
          font-size: 16px;
          line-height: 1.6;
        }
      }

      .action-buttons {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 12px;
        width: 100%;
      }

      .invite-note {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 16px;
        background: var(--infoBg);
        border: 1px solid var(--accent);
        border-radius: 8px;
        margin-top: 16px;
        font-size: 14px;

        i {
          color: var(--accent);
          font-size: 16px;
          flex-shrink: 0;
        }

        span {
          color: var(--infoFg);
          line-height: 1.4;
        }
      }
    }
  }
}

.action-btn {
  padding: 16px 24px;
  font-size: 16px;
  font-weight: 600;
  border-radius: 12px;
  transition: all 0.2s ease;

  &.primary {
    background: var(--accent);
    color: var(--fgOnAccent);
    border: none;

    &:hover {
      background: var(--accentDarken);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
  }

  &.secondary {
    background: var(--buttonBg);
    color: var(--fg);
    border: 1px solid var(--divider);

    &:hover {
      background: var(--buttonHoverBg);
      transform: translateY(-2px);
    }
  }
}

@media (max-width: 768px) {
  .invite-page-wrapper {
    padding: 16px;
  }

  .state-screen .state-content {
    padding: 32px 24px;
  }

  .invite-screen {
    .invite-header {
      padding: 32px 24px;

      .inviter-section {

        .inviter-avatar,
        .default-avatar {
          width: 80px;
          height: 80px;
        }

        .default-avatar {
          font-size: 32px;
        }

        .invite-text h1 {
          font-size: 28px;
        }
      }
    }

    .personal-message-section,
    .about-section,
    .actions-section {
      padding: 24px;
    }

    .about-section .features-grid {
      grid-template-columns: 1fr;
    }

    .guest-actions .action-buttons {
      flex-direction: column;
      gap: 8px;
    }

    .success-actions {
      flex-direction: column;
      gap: 8px;
    }
  }
}

@media (max-width: 480px) {
  .invite-screen {
    .invite-header {
      padding: 24px 20px;

      .inviter-section .invite-text h1 {
        font-size: 24px;
      }
    }

    .personal-message-section,
    .about-section,
    .actions-section {
      padding: 20px;
    }
  }
}
</style>