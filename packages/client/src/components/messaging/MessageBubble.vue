<template>
  <div 
    class="message-bubble"
    :class="{ 
      'own-message': isOwnMessage,
      'has-file': message.file,
      'system-message': isSystemMessage
    }"
  >
    <div v-if="!isOwnMessage && !hideAvatar" class="message-avatar">
      <MkAvatar :user="message.user" :show-indicator="false" class="avatar" />
    </div>

    <div class="message-content">
      <!-- System messages -->
      <div v-if="isSystemMessage" class="system-content">
        <i class="ph-info-bold"></i>
        <span>{{ message.text }}</span>
      </div>

      <!-- Regular messages -->
      <div v-else class="bubble">
        <!-- File attachment -->
        <MessageFile v-if="message.file" :file="message.file" />
        
        <!-- Text content -->
        <div v-if="message.text" class="text-content">
          <Mfm :text="message.text" :author="message.user" />
        </div>

        <!-- Message metadata -->
        <div class="message-meta">
          <span class="timestamp" :title="getFullTimestamp()">
            {{ getRelativeTime() }}
          </span>
          
          <!-- Message status indicators -->
          <div v-if="isOwnMessage" class="status-indicators">
            <i 
              v-if="message.isRead" 
              class="ph-check-circle-fill status-read" 
              title="Read"
            ></i>
            <i 
              v-else-if="message.id" 
              class="ph-check-bold status-sent" 
              title="Sent"
            ></i>
            <i 
              v-else 
              class="ph-clock-bold status-sending" 
              title="Sending..."
            ></i>
          </div>
        </div>
      </div>

      <!-- Message actions -->
      <div v-if="!isSystemMessage" class="message-actions">
        <button 
          class="action-btn"
          @click="$emit('reply', message)"
          title="Reply"
        >
          <i class="ph-arrow-bend-up-left-bold"></i>
        </button>
        
        <button 
          v-if="canDelete"
          class="action-btn delete-btn"
          @click="$emit('delete', message.id)"
          title="Delete"
        >
          <i class="ph-trash-bold"></i>
        </button>
        
        <button 
          class="action-btn"
          @click="copyMessage"
          title="Copy"
        >
          <i class="ph-copy-bold"></i>
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { $i } from '@/account';
import * as os from '@/os';
import MessageFile from './MessageFile.vue';

const props = defineProps<{
  message: {
    id?: string;
    text?: string;
    file?: any;
    user: any;
    userId: string;
    createdAt: string;
    isRead?: boolean;
    isSystem?: boolean;
  };
  hideAvatar?: boolean;
}>();

const emit = defineEmits<{
  (e: 'reply', message: any): void;
  (e: 'delete', messageId: string): void;
}>();

const isOwnMessage = computed(() => props.message.userId === $i?.id);
const isSystemMessage = computed(() => props.message.isSystem || false);

const canDelete = computed(() => {
  return isOwnMessage.value || $i?.isAdmin || $i?.isModerator;
});

function getRelativeTime(): string {
  const now = new Date();
  const messageTime = new Date(props.message.createdAt);
  const diffInMinutes = Math.floor((now.getTime() - messageTime.getTime()) / (1000 * 60));
  
  if (diffInMinutes < 1) return 'now';
  if (diffInMinutes < 60) return `${diffInMinutes}m`;
  if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`;
  if (diffInMinutes < 10080) return `${Math.floor(diffInMinutes / 1440)}d`;
  
  // For messages older than a week, show date
  const isToday = messageTime.toDateString() === now.toDateString();
  const isYesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toDateString() === messageTime.toDateString();
  
  if (isToday) {
    return messageTime.toLocaleTimeString(undefined, { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  } else if (isYesterday) {
    return 'Yesterday';
  } else {
    return messageTime.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric' 
    });
  }
}

function getFullTimestamp(): string {
  return new Date(props.message.createdAt).toLocaleString();
}

async function copyMessage() {
  if (!props.message.text) return;
  
  try {
    await navigator.clipboard.writeText(props.message.text);
    os.success('Message copied to clipboard');
  } catch (error) {
    console.error('Failed to copy message:', error);
    os.alert({
      type: 'error',
      text: 'Failed to copy message'
    });
  }
}
</script>

<style lang="scss" scoped>
.message-bubble {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  max-width: 100%;
  opacity: 0;
  animation: slideIn 0.3s ease-out forwards;

  &.own-message {
    flex-direction: row-reverse;

    .message-content {
      align-items: flex-end;

      .bubble {
        background: var(--accent);
        color: white;
        border-bottom-right-radius: 6px;

        .message-meta {
          .timestamp {
            color: rgba(255, 255, 255, 0.8);
          }

          .status-indicators {
            .status-read {
              color: rgba(255, 255, 255, 0.9);
            }

            .status-sent {
              color: rgba(255, 255, 255, 0.7);
            }

            .status-sending {
              color: rgba(255, 255, 255, 0.5);
              animation: pulse 1.5s infinite;
            }
          }
        }
      }
    }

    .message-actions {
      flex-direction: row-reverse;
    }
  }

  &.system-message {
    justify-content: center;
    margin: 1rem 0;

    .message-content {
      align-items: center;

      .system-content {
        background: var(--X2);
        color: var(--fgTransparentWeak);
        padding: 0.5rem 1rem;
        border-radius: 16px;
        font-size: 0.85rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;

        i {
          font-size: 1rem;
        }
      }
    }
  }

  .message-avatar {
    flex-shrink: 0;
    margin-top: 0.25rem;

    .avatar {
      width: 32px;
      height: 32px;
    }
  }

  .message-content {
    display: flex;
    flex-direction: column;
    max-width: 70%;
    min-width: 0;
    position: relative;

    .bubble {
      background: var(--panel);
      border: 1px solid var(--divider);
      border-radius: 18px;
      border-bottom-left-radius: 6px;
      padding: 0.75rem 1rem;
      position: relative;
      word-wrap: break-word;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      transition: all 0.2s ease;

      &:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }

      .text-content {
        margin-bottom: 0.5rem;
        line-height: 1.4;

        &:last-child {
          margin-bottom: 0;
        }
      }

      .message-meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        margin-top: 0.25rem;

        .timestamp {
          font-size: 0.75rem;
          color: var(--fgTransparentWeak);
          flex-shrink: 0;
        }

        .status-indicators {
          display: flex;
          align-items: center;
          gap: 0.25rem;

          i {
            font-size: 0.8rem;
          }

          .status-read {
            color: var(--success);
          }

          .status-sent {
            color: var(--accent);
          }

          .status-sending {
            color: var(--fgTransparentWeak);
          }
        }
      }
    }

    .message-actions {
      display: flex;
      gap: 0.25rem;
      margin-top: 0.25rem;
      opacity: 0;
      transition: opacity 0.2s ease;

      .action-btn {
        background: var(--X2);
        border: none;
        color: var(--fgTransparentWeak);
        width: 28px;
        height: 28px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;

        &:hover {
          background: var(--X4);
          color: var(--fg);
        }

        &.delete-btn:hover {
          background: var(--error);
          color: white;
        }

        i {
          font-size: 0.8rem;
        }
      }
    }

    &:hover .message-actions {
      opacity: 1;
    }
  }

  &.has-file {
    .message-content .bubble {
      padding: 0.5rem;

      .text-content {
        margin: 0.5rem;
        margin-bottom: 0.25rem;
      }

      .message-meta {
        margin: 0.5rem;
        margin-top: 0.25rem;
      }
    }
  }
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 0.5;
  }
  50% {
    opacity: 1;
  }
}

@media (max-width: 768px) {
  .message-bubble {
    margin-bottom: 0.5rem;

    .message-content {
      max-width: 85%;

      .bubble {
        padding: 0.6rem 0.8rem;
        border-radius: 16px;

        .message-meta {
          .timestamp {
            font-size: 0.7rem;
          }
        }
      }
    }

    .message-avatar .avatar {
      width: 28px;
      height: 28px;
    }

    &.own-message .message-content .bubble {
      border-bottom-right-radius: 4px;
    }

    &:not(.own-message) .message-content .bubble {
      border-bottom-left-radius: 4px;
    }
  }
}
</style>
