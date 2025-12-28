<template>
  <MkModal ref="modal" @click="cancel" @closed="$emit('closed')">
    <div class="moderation-dialog">
      <div class="header">
        <h2>{{ i18n.ts.manageStreamModerators }}</h2>
        <button class="close-btn" @click="cancel">
          <i class="ph-x-bold"></i>
        </button>
      </div>
      
      <div class="content">
        <!-- Add new moderator section -->
        <div class="add-moderator-section">
          <h3>{{ i18n.ts.addModerator }}</h3>
          <div class="add-form">
            <MkInput 
              v-model="newModeratorUsername" 
              :placeholder="i18n.ts.username"
              class="username-input"
            />
            <MkButton 
              :disabled="!newModeratorUsername.trim() || adding"
              @click="addModerator"
              primary
            >
              <i class="ph-plus-bold" v-if="!adding"></i>
              <MkLoading v-else :em="true"/>
              {{ i18n.ts.add }}
            </MkButton>
          </div>
        </div>

        <!-- Current moderators list -->
        <div class="moderators-section">
          <h3>{{ i18n.ts.currentModerators }} ({{ moderators.length }})</h3>
          <div v-if="moderators.length === 0" class="no-moderators">
            {{ i18n.ts.noModerators }}
          </div>
          <div v-else class="moderators-list">
            <div 
              v-for="moderator in moderators" 
              :key="moderator.id"
              class="moderator-item"
            >
              <MkAvatar :user="moderator.user || { id: moderator.userId, username: moderator.username, host: null, name: moderator.name, avatarUrl: moderator.avatarUrl }" class="avatar"/>
              <div class="info">
                <div class="name">{{ moderator.name || `@${moderator.username}` }}</div>
                <div class="username" v-if="moderator.name">@{{ moderator.username }}</div>
                <div class="meta">Added {{ formatDate(moderator.createdAt) }}</div>
              </div>
              <MkButton 
                :disabled="removing === moderator.id"
                @click="removeModerator(moderator)"
                danger
              >
                <i class="ph-trash-bold" v-if="removing !== moderator.id"></i>
                <MkLoading v-else :em="true"/>
                {{ i18n.ts.remove }}
              </MkButton>
            </div>
          </div>
        </div>
      </div>
      
      <div class="footer">
        <MkButton @click="cancel">{{ i18n.ts.cancel }}</MkButton>
        <MkButton @click="done" primary>{{ i18n.ts.done }}</MkButton>
      </div>
    </div>
  </MkModal>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import MkModal from '@/components/MkModal.vue';
import MkInput from '@/components/form/input.vue';
import MkButton from '@/components/MkButton.vue';
import * as os from '@/os';
import { i18n } from '@/i18n';

const props = defineProps<{
  streamId: string;
  moderators: any[];
}>();

const emit = defineEmits<{
  (e: 'closed'): void;
  (e: 'done', result: { updated: boolean }): void;
}>();

const modal = ref<InstanceType<typeof MkModal>>();
const newModeratorUsername = ref('');
const adding = ref(false);
const removing = ref<string | null>(null);
const moderators = ref([...props.moderators]);

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString();
}

async function addModerator() {
  if (!newModeratorUsername.value.trim() || adding.value) return;
  
  adding.value = true;
  try {
    const result = await os.api('live/moderators/add', {
      streamId: props.streamId,
      username: newModeratorUsername.value.trim(),
    });
    
    // Add to local list
    moderators.value.push({
      id: result.id,
      userId: result.userId,
      username: newModeratorUsername.value.trim(),
      name: null, // Will be updated when dialog refreshes
      avatarUrl: null,
      assignedBy: result.assignedBy,
      createdAt: result.createdAt,
    });
    
    newModeratorUsername.value = '';
    os.success();
  } catch (err) {
    console.error('Failed to add moderator:', err);
    os.alert({
      type: 'error',
      text: err.message || i18n.ts.failedToAddModerator || 'Failed to add moderator',
    });
  } finally {
    adding.value = false;
  }
}

async function removeModerator(moderator: any) {
  if (removing.value) return;
  
  const confirmed = await os.confirm({
    type: 'warning',
    text: i18n.t('confirmRemoveModerator', { username: moderator.username }),
  });
  
  if (!confirmed.canceled) {
    removing.value = moderator.id;
    try {
      await os.api('live/moderators/remove', {
        streamId: props.streamId,
        moderatorId: moderator.id,
      });
      
      // Remove from local list
      moderators.value = moderators.value.filter(m => m.id !== moderator.id);
      os.success();
    } catch (err) {
      console.error('Failed to remove moderator:', err);
      os.alert({
        type: 'error',
        text: err.message || i18n.ts.failedToRemoveModerator || 'Failed to remove moderator',
      });
    } finally {
      removing.value = null;
    }
  }
}

function cancel() {
  modal.value?.close();
}

function done() {
  emit('done', { updated: true });
  modal.value?.close();
}
</script>

<style lang="scss" scoped>
.moderation-dialog {
  background: var(--panel);
  border-radius: 16px;
  padding: 0;
  max-width: 600px;
  width: 90vw;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid var(--divider);
  
  h2 {
    margin: 0;
    font-size: 1.2rem;
    font-weight: bold;
    color: var(--accent);
  }
  
  .close-btn {
    padding: 0.5rem;
    background: none;
    border: none;
    color: var(--fg);
    cursor: pointer;
    border-radius: 6px;
    
    &:hover {
      background: var(--buttonHoverBg);
    }
  }
}

.content {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.add-moderator-section {
  margin-bottom: 2rem;
  
  h3 {
    margin: 0 0 1rem 0;
    font-size: 1rem;
    font-weight: 600;
  }
  
  .add-form {
    display: flex;
    gap: 0.75rem;
    align-items: flex-end;
    
    .username-input {
      flex: 1;
    }
  }
}

.moderators-section {
  h3 {
    margin: 0 0 1rem 0;
    font-size: 1rem;
    font-weight: 600;
  }
}

.no-moderators {
  text-align: center;
  padding: 2rem;
  opacity: 0.7;
  font-style: italic;
}

.moderators-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.moderator-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: var(--bg);
  border-radius: 12px;
  border: 1px solid var(--divider);
  
  .avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
  }
  
  .info {
    flex: 1;
    
    .name {
      font-weight: 600;
      line-height: 1.2;
    }
    
    .username {
      opacity: 0.7;
      font-size: 0.9rem;
      line-height: 1.2;
    }
    
    .meta {
      opacity: 0.6;
      font-size: 0.8rem;
      margin-top: 0.25rem;
    }
  }
}

.footer {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  padding: 1.5rem;
  border-top: 1px solid var(--divider);
  background: var(--bg);
}

@media (max-width: 500px) {
  .moderation-dialog {
    width: 95vw;
    max-height: 90vh;
  }
  
  .add-form {
    flex-direction: column;
    align-items: stretch !important;
  }
  
  .moderator-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
    
    .info {
      align-self: stretch;
    }
  }
  
  .footer {
    flex-direction: column-reverse;
  }
}
</style>
