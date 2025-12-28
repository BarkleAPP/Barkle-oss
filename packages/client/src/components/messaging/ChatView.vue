<template>
  <div class="chat-view">
    <div v-if="!selectedChat" class="no-chat-selected">
      <div class="welcome-content">
        <i class="ph-chat-circle-bold"></i>
        <h2>{{ i18n.ts.selectAConversation }}</h2>
        <p>{{ i18n.ts.chooseFromExistingOrStartNew }}</p>
        <button class="start-new-btn" @click="$emit('new-chat')">
          <i class="ph-plus-bold"></i>
          {{ i18n.ts.startNewConversation }}
        </button>
      </div>
    </div>

    <div v-else class="chat-container">
      <!-- Chat Header -->
      <div class="chat-header">
        <button v-if="isMobile" class="back-btn" @click="$emit('back')">
          <i class="ph-arrow-left-bold"></i>
        </button>
        
        <div class="chat-info">
          <div class="avatar-container">
            <MkAvatar 
              v-if="selectedChat.type === 'direct'"
              :user="selectedChat.participant" 
              :show-indicator="true" 
              class="avatar"
            />
            <div v-else class="group-avatar">
              <i class="ph-users-three-bold"></i>
            </div>
            <div v-if="isParticipantOnline" class="online-indicator"></div>
          </div>
          
          <div class="info">
            <h3 class="name">{{ getChatName(selectedChat) }}</h3>
            <p class="status">
              <span v-if="selectedChat.type === 'direct'">
                <span v-if="isParticipantOnline" class="online-status">Online</span>
                <span v-else-if="selectedChat.participant?.lastActiveAt" class="last-seen">
                  Last seen {{ getRelativeTime(selectedChat.participant.lastActiveAt) }}
                </span>
                <span v-else class="offline-status">Offline</span>
              </span>
              <span v-else>
                {{ selectedChat.memberCount }} members
              </span>
            </p>
          </div>
        </div>

        <div class="header-actions">
          <button v-if="selectedChat.type === 'direct'" class="action-btn" @click="startCall('voice')" title="Voice call">
            <i class="ph-phone-bold"></i>
          </button>
          <button v-if="selectedChat.type === 'direct'" class="action-btn" @click="startCall('video')" title="Video call">
            <i class="ph-video-camera-bold"></i>
          </button>
          <button class="action-btn" @click="showChatInfo" title="Chat info">
            <i class="ph-info-bold"></i>
          </button>
        </div>
      </div>

      <!-- Messages Container -->
      <div ref="messagesContainer" class="messages-container" @scroll="onScroll">
        <div v-if="loadingMessages" class="loading-container">
          <MkLoading />
        </div>

        <div v-else-if="messages.length === 0" class="empty-messages">
          <div class="empty-content">
            <i class="ph-chat-dots-bold"></i>
            <h3>No messages yet</h3>
            <p>Send a message to start the conversation</p>
          </div>
        </div>

        <div v-else class="messages">
          <!-- Load More Button -->
          <button 
            v-if="canLoadMore" 
            class="load-more-btn" 
            @click="loadMoreMessages"
            :disabled="loadingMore"
          >
            <MkLoading v-if="loadingMore" :em="1" />
            <span v-else>Load older messages</span>
          </button>

          <!-- Messages -->
          <div v-for="(group, index) in groupedMessages" :key="index" class="message-group">
            <!-- Date Separator -->
            <div v-if="group.date" class="date-separator">
              <span>{{ formatDate(group.date) }}</span>
            </div>

            <!-- Message Cluster -->
            <div 
              v-for="cluster in group.clusters" 
              :key="cluster.id"
              class="message-cluster"
              :class="{ 
                'is-me': cluster.isMe,
                'is-continuous': cluster.isContinuous 
              }"
            >
              <div v-if="!cluster.isMe && !cluster.isContinuous" class="sender-avatar">
                <MkAvatar :user="cluster.sender" :show-indicator="false" class="avatar" />
              </div>

              <div class="message-content">
                <div v-if="!cluster.isMe && !cluster.isContinuous" class="sender-name">
                  {{ cluster.sender?.name || cluster.sender?.username }}
                </div>

                <div class="message-bubbles">
                  <div 
                    v-for="message in cluster.messages" 
                    :key="message.id"
                    class="message-bubble"
                    :class="{ 
                      'has-file': message.file,
                      'is-deleted': message.isDeleted 
                    }"
                  >
                    <!-- Delete Button -->
                    <button 
                      v-if="canDeleteMessage(message)" 
                      class="delete-btn"
                      @click="deleteMessage(message)"
                      title="Delete message"
                    >
                      <i class="ph-x-bold"></i>
                    </button>

                    <!-- Message Content -->
                    <div v-if="message.isDeleted" class="deleted-message">
                      <i class="ph-trash-bold"></i>
                      <span>This message was deleted</span>
                    </div>

                    <div v-else class="message-text">
                      <!-- File Attachment -->
                      <div v-if="message.file" class="file-attachment">
                        <MessageFile :file="message.file" />
                      </div>

                      <!-- Text Content -->
                      <div v-if="message.text" class="text-content">
                        <Mfm :text="message.text" :i="$i" />
                      </div>

                      <!-- URL Previews -->
                      <div v-if="message.urls?.length" class="url-previews">
                        <MkUrlPreview 
                          v-for="url in message.urls" 
                          :key="url" 
                          :url="url" 
                        />
                      </div>
                    </div>

                    <!-- Message Status -->
                    <div class="message-status">
                      <span class="time">{{ formatMessageTime(message.createdAt) }}</span>
                      <div v-if="cluster.isMe" class="delivery-status">
                        <i v-if="!message.isRead" class="ph-check-bold"></i>
                        <i v-else class="ph-checks-bold read"></i>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Typing Indicator -->
          <div v-if="typingUsers.length > 0" class="typing-indicator">
            <div class="typing-bubble">
              <div class="typing-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
            <div class="typing-text">
              <span v-if="typingUsers.length === 1">
                {{ typingUsers[0].name || typingUsers[0].username }} is typing...
              </span>
              <span v-else>
                {{ typingUsers.length }} people are typing...
              </span>
            </div>
          </div>
        </div>

        <!-- Scroll to Bottom Button -->
        <button 
          v-if="showScrollToBottom" 
          class="scroll-to-bottom"
          @click="scrollToBottom"
        >
          <i class="ph-arrow-down-bold"></i>
          <span v-if="unreadCount > 0" class="unread-count">{{ unreadCount }}</span>
        </button>
      </div>

      <!-- Message Composer -->
      <div class="message-composer">
        <MessageComposer 
          :disabled="!canSendMessage"
          :placeholder="getComposerPlaceholder()"
          @send="sendMessage"
          @typing="onTyping"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue';
import { i18n } from '@/i18n';
import { $i } from '@/account';
import MessageComposer from './MessageComposer.vue';
import MessageFile from './MessageFile.vue';

const props = defineProps<{
  selectedChat: any;
  messages: any[];
  typingUsers: any[];
  loadingMessages: boolean;
  canLoadMore: boolean;
  isMobile?: boolean;
}>();

const emit = defineEmits<{
  (e: 'send-message', data: { text?: string; file?: any }): void;
  (e: 'delete-message', messageId: string): void;
  (e: 'load-more'): void;
  (e: 'typing'): void;
  (e: 'new-chat'): void;
  (e: 'back'): void;
  (e: 'start-call', type: 'voice' | 'video'): void;
  (e: 'show-chat-info'): void;
}>();

const messagesContainer = ref<HTMLElement>();
const loadingMore = ref(false);
const showScrollToBottom = ref(false);
const unreadCount = ref(0);

// Computed Properties
const isParticipantOnline = computed(() => {
  return props.selectedChat?.type === 'direct' && 
         props.selectedChat?.participant?.isOnline;
});

const canSendMessage = computed(() => {
  return props.selectedChat && !props.selectedChat.isBlocked;
});

const groupedMessages = computed(() => {
  if (!props.messages.length) return [];

  const groups: any[] = [];
  let currentGroup: any = null;
  let currentCluster: any = null;

  for (const message of props.messages) {
    const messageDate = new Date(message.createdAt).toDateString();
    
    // Create new date group if needed
    if (!currentGroup || currentGroup.date !== messageDate) {
      currentGroup = { date: messageDate, clusters: [] };
      groups.push(currentGroup);
      currentCluster = null;
    }

    const isMe = message.userId === $i?.id;
    const canContinueCluster = currentCluster && 
                              currentCluster.isMe === isMe &&
                              currentCluster.senderId === message.userId &&
                              (new Date(message.createdAt).getTime() - currentCluster.lastMessageTime) < 300000; // 5 minutes

    if (canContinueCluster) {
      // Add to existing cluster
      currentCluster.messages.push(message);
      currentCluster.lastMessageTime = new Date(message.createdAt).getTime();
    } else {
      // Create new cluster
      currentCluster = {
        id: `cluster-${message.id}`,
        isMe,
        senderId: message.userId,
        sender: message.user,
        messages: [message],
        lastMessageTime: new Date(message.createdAt).getTime(),
        isContinuous: false
      };
      
      // Check if this cluster is continuous with the previous one
      if (currentGroup.clusters.length > 0) {
        const prevCluster = currentGroup.clusters[currentGroup.clusters.length - 1];
        currentCluster.isContinuous = prevCluster.isMe === isMe && prevCluster.senderId === message.userId;
      }
      
      currentGroup.clusters.push(currentCluster);
    }
  }

  return groups;
});

// Methods
function getChatName(chat: any): string {
  if (chat.type === 'direct') {
    return chat.participant?.name || `@${chat.participant?.username}` || 'Unknown User';
  }
  return chat.name || 'Unnamed Group';
}

function getRelativeTime(date: string): string {
  const now = new Date();
  const time = new Date(date);
  const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
  
  if (diffInMinutes < 1) return 'just now';
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
  return `${Math.floor(diffInMinutes / 1440)}d ago`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString(undefined, { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }
}

function formatMessageTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

function canDeleteMessage(message: any): boolean {
  return message.userId === $i?.id && !message.isDeleted;
}

function getComposerPlaceholder(): string {
  if (!props.selectedChat) return '';
  
  if (props.selectedChat.type === 'direct') {
    const name = props.selectedChat.participant?.name || props.selectedChat.participant?.username;
    return `Message ${name}...`;
  }
  
  return `Message ${props.selectedChat.name}...`;
}

function sendMessage(data: { text?: string; file?: any }) {
  emit('send-message', data);
}

function deleteMessage(message: any) {
  emit('delete-message', message.id);
}

function onTyping() {
  emit('typing');
}

function startCall(type: 'voice' | 'video') {
  emit('start-call', type);
}

function showChatInfo() {
  emit('show-chat-info');
}

async function loadMoreMessages() {
  if (loadingMore.value) return;
  loadingMore.value = true;
  emit('load-more');
  // Reset in parent component after loading
  setTimeout(() => {
    loadingMore.value = false;
  }, 1000);
}

function onScroll() {
  if (!messagesContainer.value) return;
  
  const { scrollTop, scrollHeight, clientHeight } = messagesContainer.value;
  const isNearBottom = scrollHeight - clientHeight - scrollTop < 100;
  
  showScrollToBottom.value = !isNearBottom;
  
  if (isNearBottom) {
    unreadCount.value = 0;
  }
}

function scrollToBottom(smooth = true) {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTo({
        top: messagesContainer.value.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      });
    }
  });
}

// Watch for new messages to auto-scroll
watch(() => props.messages.length, () => {
  if (!showScrollToBottom.value) {
    scrollToBottom();
  } else {
    unreadCount.value++;
  }
});

// Watch for selected chat changes
watch(() => props.selectedChat, () => {
  showScrollToBottom.value = false;
  unreadCount.value = 0;
  nextTick(() => {
    scrollToBottom(false);
  });
});

onMounted(() => {
  scrollToBottom(false);
});
</script>

<style lang="scss" scoped>
.chat-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg);

  .no-chat-selected {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;

    .welcome-content {
      text-align: center;
      max-width: 400px;

      i {
        font-size: 5rem;
        color: var(--fgTransparentWeak);
        margin-bottom: 1.5rem;
      }

      h2 {
        margin: 0 0 1rem 0;
        color: var(--fg);
        font-size: 1.5rem;
        font-weight: 600;
      }

      p {
        margin: 0 0 2rem 0;
        color: var(--fgTransparentWeak);
        line-height: 1.5;
      }

      .start-new-btn {
        padding: 0.75rem 1.5rem;
        background: var(--accent);
        color: white;
        border: none;
        border-radius: 12px;
        font-size: 1rem;
        cursor: pointer;
        transition: all 0.2s;
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;

        &:hover {
          background: var(--accentLighten);
          transform: translateY(-1px);
        }
      }
    }
  }

  .chat-container {
    height: 100%;
    display: flex;
    flex-direction: column;

    .chat-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem;
      background: var(--panel);
      border-bottom: 1px solid var(--divider);
      flex-shrink: 0;

      .back-btn {
        background: none;
        border: none;
        color: var(--fg);
        cursor: pointer;
        padding: 0.5rem;
        border-radius: 8px;
        transition: background 0.2s;

        &:hover {
          background: var(--X2);
        }

        i {
          font-size: 1.2rem;
        }
      }

      .chat-info {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex: 1;

        .avatar-container {
          position: relative;

          .avatar {
            width: 42px;
            height: 42px;
          }

          .group-avatar {
            width: 42px;
            height: 42px;
            border-radius: 50%;
            background: var(--accent);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;

            i {
              font-size: 1.3rem;
            }
          }

          .online-indicator {
            position: absolute;
            bottom: 2px;
            right: 2px;
            width: 10px;
            height: 10px;
            background: var(--success);
            border: 2px solid var(--panel);
            border-radius: 50%;
          }
        }

        .info {
          .name {
            margin: 0 0 0.25rem 0;
            font-size: 1rem;
            font-weight: 600;
            color: var(--fg);
          }

          .status {
            margin: 0;
            font-size: 0.85rem;
            color: var(--fgTransparentWeak);

            .online-status {
              color: var(--success);
            }
          }
        }
      }

      .header-actions {
        display: flex;
        gap: 0.5rem;

        .action-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: transparent;
          border: none;
          color: var(--fgTransparentWeak);
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;

          &:hover {
            background: var(--X2);
            color: var(--fg);
          }

          i {
            font-size: 1.1rem;
          }
        }
      }
    }

    .messages-container {
      flex: 1;
      overflow-y: auto;
      padding: 0 1rem;
      position: relative;
      scroll-behavior: smooth;

      .loading-container {
        display: flex;
        justify-content: center;
        padding: 2rem;
      }

      .empty-messages {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        padding: 2rem;

        .empty-content {
          text-align: center;
          color: var(--fgTransparentWeak);

          i {
            font-size: 3rem;
            margin-bottom: 1rem;
            opacity: 0.5;
          }

          h3 {
            margin: 0 0 0.5rem 0;
            color: var(--fg);
          }

          p {
            margin: 0;
            font-size: 0.9rem;
          }
        }
      }

      .messages {
        padding: 1rem 0;

        .load-more-btn {
          display: block;
          margin: 0 auto 1rem auto;
          padding: 0.5rem 1rem;
          background: var(--X2);
          border: none;
          border-radius: 20px;
          color: var(--fg);
          cursor: pointer;
          transition: background 0.2s;

          &:hover:not(:disabled) {
            background: var(--X3);
          }

          &:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }
        }

        .message-group {
          margin-bottom: 1.5rem;

          .date-separator {
            text-align: center;
            margin: 1rem 0;
            
            span {
              background: var(--X2);
              padding: 0.25rem 0.75rem;
              border-radius: 12px;
              font-size: 0.8rem;
              color: var(--fgTransparentWeak);
              font-weight: 500;
            }
          }

          .message-cluster {
            display: flex;
            gap: 0.5rem;
            margin-bottom: 0.75rem;

            &.is-me {
              flex-direction: row-reverse;

              .message-content {
                align-items: flex-end;

                .message-bubbles .message-bubble {
                  background: var(--accent);
                  color: var(--fgOnAccent);
                  margin-left: auto;
                }
              }
            }

            &.is-continuous {
              margin-bottom: 0.25rem;
            }

            .sender-avatar {
              width: 32px;
              height: 32px;
              flex-shrink: 0;

              .avatar {
                width: 32px;
                height: 32px;
              }
            }

            .message-content {
              flex: 1;
              display: flex;
              flex-direction: column;
              min-width: 0;

              .sender-name {
                font-size: 0.8rem;
                font-weight: 600;
                color: var(--fgTransparentWeak);
                margin-bottom: 0.25rem;
                padding-left: 0.75rem;
              }

              .message-bubbles {
                display: flex;
                flex-direction: column;
                gap: 0.125rem;

                .message-bubble {
                  position: relative;
                  background: var(--X2);
                  border-radius: 16px;
                  padding: 0.5rem 0.75rem;
                  max-width: 70%;
                  word-wrap: break-word;

                  &:hover .delete-btn {
                    opacity: 1;
                  }

                  .delete-btn {
                    position: absolute;
                    top: -8px;
                    right: -8px;
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    background: var(--error);
                    color: white;
                    border: none;
                    cursor: pointer;
                    opacity: 0;
                    transition: opacity 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;

                    i {
                      font-size: 0.7rem;
                    }
                  }

                  .deleted-message {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    color: var(--fgTransparentWeak);
                    font-style: italic;
                    font-size: 0.9rem;

                    i {
                      font-size: 0.8rem;
                    }
                  }

                  .message-text {
                    .file-attachment {
                      margin-bottom: 0.5rem;
                    }

                    .text-content {
                      line-height: 1.4;
                      word-break: break-word;
                    }

                    .url-previews {
                      margin-top: 0.5rem;
                    }
                  }

                  .message-status {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    gap: 0.25rem;
                    margin-top: 0.25rem;
                    font-size: 0.7rem;
                    color: var(--fgTransparentWeak);

                    .delivery-status i {
                      font-size: 0.7rem;

                      &.read {
                        color: var(--accent);
                      }
                    }
                  }
                }
              }
            }
          }
        }

        .typing-indicator {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-top: 1rem;

          .typing-bubble {
            background: var(--X2);
            border-radius: 16px;
            padding: 0.75rem;

            .typing-dots {
              display: flex;
              gap: 0.25rem;

              span {
                width: 6px;
                height: 6px;
                background: var(--fgTransparentWeak);
                border-radius: 50%;
                animation: typing 1.4s infinite ease-in-out;

                &:nth-child(2) {
                  animation-delay: 0.2s;
                }

                &:nth-child(3) {
                  animation-delay: 0.4s;
                }
              }
            }
          }

          .typing-text {
            font-size: 0.8rem;
            color: var(--fgTransparentWeak);
          }
        }
      }

      .scroll-to-bottom {
        position: absolute;
        bottom: 1rem;
        right: 1rem;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: var(--accent);
        color: white;
        border: none;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;

        &:hover {
          transform: scale(1.05);
        }

        .unread-count {
          position: absolute;
          top: -6px;
          right: -6px;
          background: var(--error);
          color: white;
          border-radius: 10px;
          padding: 0.1rem 0.3rem;
          font-size: 0.7rem;
          min-width: 1rem;
          text-align: center;
        }
      }
    }

    .message-composer {
      flex-shrink: 0;
      background: var(--panel);
      border-top: 1px solid var(--divider);
    }
  }
}

@keyframes typing {
  0%, 80%, 100% {
    transform: scale(0.8);
    opacity: 0.6;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

@media (max-width: 768px) {
  .chat-view .chat-container {
    .chat-header {
      padding: 0.75rem;

      .chat-info .info .name {
        font-size: 0.95rem;
      }

      .header-actions .action-btn {
        width: 32px;
        height: 32px;
      }
    }

    .messages-container {
      padding: 0 0.75rem;

      .messages .message-group .message-cluster .message-content .message-bubbles .message-bubble {
        max-width: 85%;
      }
    }
  }
}
</style>
