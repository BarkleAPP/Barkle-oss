<template>
  <div class="modern-chat-view">
    <!-- No Chat Selected State -->
    <div v-if="!selectedChat" class="no-chat-state">
      <div class="welcome-container">
        <div class="welcome-animation">
          <div class="chat-bubbles">
            <div class="bubble bubble-1"></div>
            <div class="bubble bubble-2"></div>
            <div class="bubble bubble-3"></div>
          </div>
        </div>
        
        <div class="welcome-content">
          <p class="welcome-subtitle">
            Select a conversation from the sidebar or start a new one to begin chatting.
          </p>
          
          <div class="welcome-actions">
            <button class="welcome-btn primary" @click="$emit('new-chat')">
              <i class="ph-plus-bold"></i>
              Start New Conversation
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Chat View -->
    <div v-else class="chat-container">
      <!-- Chat Header -->
      <div class="chat-header">
        <div class="header-left">
          <button class="back-btn" @click="$emit('back')">
            <i class="ph-arrow-left-bold"></i>
          </button>
          
          <div class="chat-info" @click="$emit('show-chat-info')">
            <div class="avatar-container">
              <MkAvatar 
                v-if="selectedChat.type === 'direct'"
                :user="selectedChat.participant" 
                :show-indicator="false"
                class="chat-avatar"
              />
              <div v-else class="group-avatar">
                <i class="ph-users-three-bold"></i>
              </div>
              
              <div 
                v-if="selectedChat.type === 'direct' && isParticipantOnline" 
                class="online-indicator"
              ></div>
            </div>
            
            <div class="info-text">
              <h3 class="chat-name">{{ getChatName(selectedChat) }}</h3>
              <p class="chat-status">
                <span v-if="selectedChat.type === 'direct'">
                  <span v-if="typingUsers.length > 0" class="typing-status">
                    typing...
                  </span>
                  <span v-else-if="isParticipantOnline" class="online-status">
                    Online
                  </span>
                  <span v-else class="offline-status">
                    {{ getLastSeenText() }}
                  </span>
                </span>
                <span v-else>
                  <span v-if="typingUsers.length > 0" class="typing-status">
                    {{ formatTypingUsers() }}
                  </span>
                  <span v-else>
                    {{ selectedChat.memberCount || 0 }} members
                  </span>
                </span>
              </p>
            </div>
          </div>
        </div>

        <div class="header-actions">

          
          <button 
            class="header-btn" 
            @click="$emit('show-chat-info')"
            title="Chat info"
          >
            <i class="ph-info-bold"></i>
          </button>
        </div>
      </div>

      <!-- Message Search Bar -->
      <Transition name="search-slide">
        <div v-if="showSearchMessages" class="message-search-bar">
          <div class="search-container">
            <i class="ph-magnifying-glass-bold search-icon"></i>
            <input 
              v-model="messageSearchQuery"
              type="text" 
              placeholder="Search in this conversation..."
              class="search-input"
            />
            <button 
              v-if="messageSearchQuery" 
              class="clear-search"
              @click="messageSearchQuery = ''"
            >
              <i class="ph-x-bold"></i>
            </button>
          </div>
        </div>
      </Transition>

      <!-- Messages Area -->
      <div class="messages-area">
        <div ref="messagesContainer" class="messages-container" @scroll="onScroll">
          <!-- Loading State -->
          <div v-if="loadingMessages" class="loading-messages">
            <div class="loading-content">
              <MkLoading />
              <span>Loading messages...</span>
            </div>
          </div>

          <!-- Empty Messages State -->
          <div v-else-if="filteredMessages.length === 0" class="empty-messages">
            <div class="empty-content">
              <div class="empty-icon">
                <i v-if="messageSearchQuery" class="ph-magnifying-glass-bold"></i>
                <i v-else class="ph-chat-dots-bold"></i>
              </div>
              <h3>
                {{ messageSearchQuery ? 'No messages found' : 'No messages yet' }}
              </h3>
              <p>
                {{ messageSearchQuery ? 'Try different search terms' : 'Send a message to start the conversation' }}
              </p>
            </div>
          </div>

          <!-- Messages -->
          <div v-else class="messages-list">
            <!-- Load More Button -->
            <button 
              v-if="canLoadMore && !loadingMessages" 
              class="load-more-btn" 
              @click="$emit('load-more')"
              :disabled="loadingMore"
            >
              <MkLoading v-if="loadingMore" :em="1" />
              <span v-else>Load older messages</span>
            </button>

            <!-- Message Groups -->
            <div 
              v-for="(group, groupIndex) in groupedMessages" 
              :key="groupIndex" 
              class="message-group"
            >
              <!-- Date Separator -->
              <div v-if="group.date" class="date-separator">
                <span class="date-text">{{ formatDate(group.date) }}</span>
              </div>

              <!-- Message Cluster -->
              <div 
                v-for="(cluster, clusterIndex) in group.clusters" 
                :key="clusterIndex"
                class="message-cluster"
                :class="{ 
                  'own-messages': cluster.isOwn,
                  'other-messages': !cluster.isOwn 
                }"
              >
                <!-- Avatar for other user's messages -->
                <div v-if="!cluster.isOwn && selectedChat.type === 'group'" class="cluster-avatar">
                  <MkAvatar :user="cluster.user" class="message-avatar" />
                </div>

                <div class="cluster-content">
                  <!-- User name for group messages -->
                  <div 
                    v-if="!cluster.isOwn && selectedChat.type === 'group'" 
                    class="sender-name"
                  >
                    {{ cluster.user?.name || cluster.user?.username }}
                  </div>

                  <!-- Messages in cluster -->
                  <div class="cluster-messages">
                    <ModernMessageBubble
                      v-for="message in cluster.messages"
                      :key="message.id"
                      :message="message"
                      :is-own="cluster.isOwn"
                      :show-time="shouldShowTime(message, cluster.messages)"
                      :is-last-in-cluster="message === cluster.messages[cluster.messages.length - 1]"
                      @delete="$emit('delete-message', message.id)"
                      @edit="editMessage(message)"
                      @reply="replyToMessage(message)"
                      @react="reactToMessage"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- Typing Indicator -->
            <div v-if="typingUsers.length > 0" class="typing-indicator-container">
              <div class="typing-indicator">
                <div class="typing-avatar">
                  <MkAvatar 
                    v-if="typingUsers.length === 1"
                    :user="typingUsers[0]" 
                    class="typing-user-avatar"
                  />
                  <div v-else class="multiple-typing">
                    <i class="ph-users-bold"></i>
                  </div>
                </div>
                
                <div class="typing-bubble">
                  <div class="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Scroll to bottom button -->
        <Transition name="fade">
          <button 
            v-if="showScrollToBottom" 
            class="scroll-to-bottom"
            @click="() => scrollToBottom()"
          >
            <i class="ph-arrow-down-bold"></i>
            <span v-if="newMessagesCount > 0" class="new-messages-badge">
              {{ newMessagesCount }}
            </span>
          </button>
        </Transition>
      </div>

      <!-- Message Composer -->
      <div class="composer-area">
        <ModernMessageComposer
          :disabled="composerDisabled"
          :reply-to="replyingTo"
          :editing="editingMessage"
          @send="handleSendMessage"
          @edit="handleEditMessage"
          @typing="$emit('typing')"
          @cancel-reply="replyingTo = null"
          @cancel-edit="editingMessage = null"
        />
      </div>
    </div>

    <!-- Keyboard Shortcuts Modal -->
    <div v-if="showShortcuts" class="shortcuts-modal" @click="showShortcuts = false">
      <div class="shortcuts-content" @click.stop>
        <div class="shortcuts-header">
          <h3>Keyboard Shortcuts</h3>
          <button class="close-btn" @click="showShortcuts = false">
            <i class="ph-x-bold"></i>
          </button>
        </div>
        
        <div class="shortcuts-list">
          <div class="shortcut-item">
            <span class="keys"><kbd>Ctrl</kbd> + <kbd>K</kbd></span>
            <span class="description">Quick search conversations</span>
          </div>
          <div class="shortcut-item">
            <span class="keys"><kbd>Ctrl</kbd> + <kbd>N</kbd></span>
            <span class="description">Start new conversation</span>
          </div>
          <div class="shortcut-item">
            <span class="keys"><kbd>Ctrl</kbd> + <kbd>F</kbd></span>
            <span class="description">Search in conversation</span>
          </div>
          <div class="shortcut-item">
            <span class="keys"><kbd>Enter</kbd></span>
            <span class="description">Send message</span>
          </div>
          <div class="shortcut-item">
            <span class="keys"><kbd>Shift</kbd> + <kbd>Enter</kbd></span>
            <span class="description">New line</span>
          </div>
          <div class="shortcut-item">
            <span class="keys"><kbd>Esc</kbd></span>
            <span class="description">Cancel reply/edit</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { i18n } from '@/i18n';
import { $i } from '@/account';
import ModernMessageBubble from './ModernMessageBubble.vue';
import ModernMessageComposer from './ModernMessageComposer.vue';

interface Message {
  id: string;
  text?: string;
  file?: any;
  userId: string;
  user?: any;
  createdAt: string;
  isRead?: boolean;
  reactions?: any[];
  reactionCounts?: Record<string, number>;
  userReactions?: string[];
  replyId?: string;
  reply?: {
    id: string;
    text?: string;
    user?: any;
    file?: any;
  };
}

interface Chat {
  id: string;
  type: 'direct' | 'group';
  participant?: any;
  name?: string;
  memberCount?: number;
}

interface Props {
  selectedChat?: Chat;
  messages: Message[];
  typingUsers: any[];
  loadingMessages?: boolean;
  loadingMore?: boolean;
  canLoadMore?: boolean;
  isMobile?: boolean;
  hideCallButtons?: boolean;
}

interface Emits {
  (e: 'send-message', data: { text?: string; file?: any; replyTo?: string }): void;
  (e: 'delete-message', id: string): void;
  (e: 'edit-message', id: string, text: string): void;
  (e: 'react-message', messageId: string, reaction: string): void;
  (e: 'load-more'): void;
  (e: 'typing'): void;
  (e: 'new-chat'): void;
  (e: 'back'): void;
  (e: 'start-call', type: 'voice' | 'video'): void;
  (e: 'show-chat-info'): void;
}

const props = withDefaults(defineProps<Props>(), {
  messages: () => [],
  typingUsers: () => [],
  loadingMessages: false,
  loadingMore: false,
  canLoadMore: false,
  isMobile: false,
  hideCallButtons: false
});

const emit = defineEmits<Emits>();

// State
const showSearchMessages = ref(false);
const messageSearchQuery = ref('');
const showShortcuts = ref(false);
const showScrollToBottom = ref(false);
const newMessagesCount = ref(0);
const replyingTo = ref<Message | null>(null);
const editingMessage = ref<Message | null>(null);
const messagesContainer = ref<HTMLElement>();
const lastScrollTop = ref(0);
const isUserScrolling = ref(false);

// Computed
const isParticipantOnline = computed(() => {
  return props.selectedChat?.type === 'direct' && 
         props.selectedChat.participant?.onlineStatus === 'online';
});

const composerDisabled = computed(() => {
  return props.loadingMessages || !props.selectedChat;
});

const filteredMessages = computed(() => {
  if (!messageSearchQuery.value.trim()) {
    return props.messages;
  }
  
  const query = messageSearchQuery.value.toLowerCase();
  return props.messages.filter(message => 
    message.text?.toLowerCase().includes(query)
  );
});

const groupedMessages = computed(() => {
  const groups: any[] = [];
  let currentDate = '';
  let currentCluster: any = null;
  
  filteredMessages.value.forEach((message, index) => {
    const messageDate = new Date(message.createdAt).toDateString();
    const isOwn = message.userId === $i?.id;
    
    // Check if we need a new date group
    if (messageDate !== currentDate) {
      currentDate = messageDate;
      groups.push({
        date: messageDate,
        clusters: []
      });
      currentCluster = null;
    }
    
    const currentGroup = groups[groups.length - 1];
    
    // Check if we need a new cluster (different user or time gap > 5 minutes)
    const needNewCluster = !currentCluster || 
                          currentCluster.isOwn !== isOwn ||
                          currentCluster.userId !== message.userId ||
                          (new Date(message.createdAt).getTime() - 
                           new Date(currentCluster.lastMessageTime).getTime()) > 5 * 60 * 1000;
    
    if (needNewCluster) {
      currentCluster = {
        isOwn,
        userId: message.userId,
        user: message.user,
        messages: [message],
        lastMessageTime: message.createdAt
      };
      currentGroup.clusters.push(currentCluster);
    } else {
      currentCluster.messages.push(message);
      currentCluster.lastMessageTime = message.createdAt;
    }
  });
  
  return groups;
});

// Methods
function getChatName(chat: Chat): string {
  if (chat.type === 'direct') {
    return chat.participant?.name || chat.participant?.username || 'Unknown User';
  }
  return chat.name || 'Group Chat';
}

function getLastSeenText(): string {
  if (!props.selectedChat?.participant?.lastActiveAt) {
    return 'Offline';
  }
  
  const lastActive = new Date(props.selectedChat.participant.lastActiveAt);
  const now = new Date();
  const diffMs = now.getTime() - lastActive.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMinutes < 1) return 'Active now';
  if (diffMinutes < 60) return `Active ${diffMinutes}m ago`;
  if (diffHours < 24) return `Active ${diffHours}h ago`;
  if (diffDays < 7) return `Active ${diffDays}d ago`;
  
  return 'Offline';
}

function formatTypingUsers(): string {
  const users = props.typingUsers;
  if (users.length === 1) {
    return `${users[0].name || users[0].username} is typing...`;
  }
  if (users.length === 2) {
    return `${users[0].name || users[0].username} and ${users[1].name || users[1].username} are typing...`;
  }
  return `${users.length} people are typing...`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString(undefined, { weekday: 'long' });
  
  return date.toLocaleDateString(undefined, { 
    month: 'long', 
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}

function shouldShowTime(message: Message, clusterMessages: Message[]): boolean {
  const messageIndex = clusterMessages.indexOf(message);
  
  // Always show time for the last message in cluster
  if (messageIndex === clusterMessages.length - 1) return true;
  
  // Show time if there's a significant gap to next message
  const nextMessage = clusterMessages[messageIndex + 1];
  if (nextMessage) {
    const timeDiff = new Date(nextMessage.createdAt).getTime() - new Date(message.createdAt).getTime();
    return timeDiff > 2 * 60 * 1000; // 2 minutes
  }
  
  return false;
}

function onScroll() {
  if (!messagesContainer.value) return;
  
  const { scrollTop, scrollHeight, clientHeight } = messagesContainer.value;
  const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
  
  showScrollToBottom.value = !isAtBottom;
  isUserScrolling.value = scrollTop < lastScrollTop.value;
  lastScrollTop.value = scrollTop;
  
  if (isAtBottom) {
    newMessagesCount.value = 0;
  }
}

function scrollToBottom(smooth = true) {
  if (!messagesContainer.value) return;
  
  messagesContainer.value.scrollTo({
    top: messagesContainer.value.scrollHeight,
    behavior: smooth ? 'smooth' : 'auto'
  });
  
  showScrollToBottom.value = false;
  newMessagesCount.value = 0;
}

function handleSendMessage(data: any) {
  const messageData: any = { ...data };
  
  if (replyingTo.value) {
    messageData.replyTo = replyingTo.value.id;
    replyingTo.value = null;
  }
  
  emit('send-message', messageData);
  
  // Auto scroll to bottom when sending
  nextTick(() => {
    scrollToBottom();
  });
}

function handleEditMessage(messageId: string, text: string) {
  emit('edit-message', messageId, text);
  editingMessage.value = null;
  
  // Auto scroll to bottom when editing
  nextTick(() => {
    scrollToBottom();
  });
}

function editMessage(message: Message) {
  editingMessage.value = message;
  replyingTo.value = null;
}

function replyToMessage(message: Message) {
  replyingTo.value = message;
  editingMessage.value = null;
}

function reactToMessage(message: Message, reaction: string) {
  emit('react-message', message.id, reaction);
}

// Watch for new messages to handle auto-scroll and notifications
watch(() => props.messages.length, (newLength, oldLength) => {
  if (newLength > oldLength) {
    const isAtBottom = !showScrollToBottom.value;
    
    if (isAtBottom || !isUserScrolling.value) {
      nextTick(() => {
        scrollToBottom(true);
      });
    } else {
      newMessagesCount.value += (newLength - oldLength);
    }
  }
});

// Watch for chat changes to reset state
watch(() => props.selectedChat?.id, () => {
  showSearchMessages.value = false;
  messageSearchQuery.value = '';
  replyingTo.value = null;
  editingMessage.value = null;
  showScrollToBottom.value = false;
  newMessagesCount.value = 0;
  
  nextTick(() => {
    scrollToBottom(false);
  });
});

// Keyboard shortcuts
function handleKeydown(event: KeyboardEvent) {
  if (event.ctrlKey || event.metaKey) {
    switch (event.key) {
      case 'f':
        event.preventDefault();
        showSearchMessages.value = !showSearchMessages.value;
        break;
      case 'n':
        event.preventDefault();
        emit('new-chat');
        break;
    }
  }
  
  if (event.key === 'Escape') {
    if (replyingTo.value || editingMessage.value) {
      replyingTo.value = null;
      editingMessage.value = null;
    } else if (showSearchMessages.value) {
      showSearchMessages.value = false;
      messageSearchQuery.value = '';
    }
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
  
  // Auto scroll to bottom on mount
  nextTick(() => {
    scrollToBottom(false);
  });
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
});
</script>

<style lang="scss" scoped>
.modern-chat-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  position: relative;
}

.no-chat-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  
  .welcome-container {
    text-align: center;
    max-width: 400px;
    
    .welcome-animation {
      margin-bottom: 2rem;
      
      .chat-bubbles {
        position: relative;
        width: 120px;
        height: 80px;
        margin: 0 auto;
        
        .bubble {
          position: absolute;
          border-radius: 18px;
          animation: bubble-float 3s ease-in-out infinite;
          
          &.bubble-1 {
            width: 40px;
            height: 32px;
            background: var(--accent);
            top: 20px;
            left: 0;
            animation-delay: 0s;
          }
          
          &.bubble-2 {
            width: 48px;
            height: 36px;
            background: var(--accentLighten);
            top: 10px;
            left: 35px;
            animation-delay: 0.5s;
          }
          
          &.bubble-3 {
            width: 36px;
            height: 28px;
            background: var(--accentedBg);
            border: 2px solid var(--accent);
            top: 25px;
            right: 0;
            animation-delay: 1s;
          }
        }
      }
    }
    
    .welcome-content {
      .welcome-title {
        font-size: 1.75rem;
        font-weight: 700;
        color: var(--fg);
        margin: 0 0 0.5rem 0;
      }
      
      .welcome-subtitle {
        color: var(--fgTransparentWeak);
        line-height: 1.6;
        margin: 0 0 2rem 0;
      }
      
      .welcome-actions {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        
        .welcome-btn {
          padding: 1rem 1.5rem;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          font-weight: 500;
          
          &.primary {
            background: var(--accent);
            color: white;
            
            &:hover {
              background: var(--accentLighten);
              transform: translateY(-1px);
            }
          }
          
          &.secondary {
            background: var(--buttonBg);
            color: var(--fg);
            border: 1px solid var(--divider);
            
            &:hover {
              background: var(--buttonHoverBg);
            }
          }
          
          &:active {
            transform: translateY(0);
          }
        }
      }
    }
  }
}

@keyframes bubble-float {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-10px) scale(1.05); }
}

.chat-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.chat-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  background: var(--panel);
  border-bottom: 1px solid var(--divider);
  
  .header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex: 1;
    min-width: 0;
    
    .back-btn {
      width: 44px;
      height: 44px;
      border: none;
      border-radius: 12px;
      background: var(--buttonBg);
      color: var(--fg);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      
      &:hover {
        background: var(--buttonHoverBg);
      }
      
      i {
        font-size: 1.1rem;
      }
    }
    
    .chat-info {
      display: flex;
      align-items: center;
      gap: 0.875rem;
      cursor: pointer;
      transition: opacity 0.2s;
      flex: 1;
      min-width: 0;
      
      &:hover {
        opacity: 0.8;
      }
      
      .avatar-container {
        position: relative;
        flex-shrink: 0;
        
        .chat-avatar {
          width: 44px;
          height: 44px;
          border-radius: 50%;
        }
        
        .group-avatar {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--accent), var(--accentLighten));
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          
          i {
            font-size: 1.2rem;
          }
        }
        
        .online-indicator {
          position: absolute;
          bottom: 0;
          right: 0;
          width: 12px;
          height: 12px;
          background: #10b981;
          border: 2px solid var(--panel);
          border-radius: 50%;
        }
      }
      
      .info-text {
        flex: 1;
        min-width: 0;
        
        .chat-name {
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--fg);
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .chat-status {
          font-size: 0.85rem;
          margin: 0.125rem 0 0 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          
          .online-status {
            color: #10b981;
            font-weight: 500;
          }
          
          .typing-status {
            color: var(--accent);
            font-style: italic;
          }
          
          .offline-status {
            color: var(--fgTransparentWeak);
          }
        }
      }
    }
  }
  
  .header-actions {
    display: flex;
    gap: 0.5rem;
    
    .header-btn {
      width: 44px;
      height: 44px;
      border: none;
      border-radius: 12px;
      background: var(--buttonBg);
      color: var(--fg);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      
      &:hover {
        background: var(--buttonHoverBg);
      }
      
      &.active {
        background: var(--accent);
        color: white;
      }
      
      i {
        font-size: 1.1rem;
      }
    }
  }
}

.message-search-bar {
  flex-shrink: 0;
  padding: 0.75rem 1.5rem;
  background: var(--panel);
  border-bottom: 1px solid var(--divider);
  
  .search-container {
    position: relative;
    
    .search-icon {
      position: absolute;
      left: 16px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--fgTransparentWeak);
      font-size: 1rem;
      pointer-events: none;
    }
    
    .search-input {
      width: 100%;
      padding: 12px 44px 12px 44px;
      border: 2px solid var(--divider);
      border-radius: 12px;
      background: var(--bg);
      color: var(--fg);
      font-size: 0.95rem;
      transition: all 0.3s;
      
      &:focus {
        outline: none;
        border-color: var(--accent);
        background: var(--panel);
      }
      
      &::placeholder {
        color: var(--fgTransparentWeak);
      }
    }
    
    .clear-search {
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      width: 24px;
      height: 24px;
      border: none;
      border-radius: 50%;
      background: var(--X2);
      color: var(--fgTransparentWeak);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      
      &:hover {
        background: var(--X3);
        color: var(--fg);
      }
      
      i {
        font-size: 0.8rem;
      }
    }
  }
}

.messages-area {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.messages-container {
  height: 100%;
  overflow-y: auto;
  scroll-behavior: smooth;
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbarHandle) transparent;
  
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  
  &::-webkit-scrollbar-thumb {
    background: var(--scrollbarHandle);
    border-radius: 3px;
    
    &:hover {
      background: var(--scrollbarHandleHover);
    }
  }
}

.loading-messages {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  
  .loading-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    color: var(--fgTransparentWeak);
  }
}

.empty-messages {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 2rem;
  
  .empty-content {
    text-align: center;
    
    .empty-icon {
      margin-bottom: 1rem;
      
      i {
        font-size: 3rem;
        color: var(--fgTransparentWeak);
        opacity: 0.5;
      }
    }
    
    h3 {
      font-size: 1.25rem;
      color: var(--fg);
      margin: 0 0 0.5rem 0;
    }
    
    p {
      color: var(--fgTransparentWeak);
      margin: 0;
    }
  }
}

.messages-list {
  padding: 1rem 1.5rem;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.load-more-btn {
  align-self: center;
  padding: 0.75rem 1.5rem;
  margin-bottom: 1rem;
  border: 1px solid var(--divider);
  border-radius: 12px;
  background: var(--panel);
  color: var(--fg);
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover:not(:disabled) {
    background: var(--buttonHoverBg);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.message-group {
  margin-bottom: 1.5rem;
  
  &:last-child {
    margin-bottom: 0;
  }
}

.date-separator {
  text-align: center;
  margin: 1.5rem 0;
  
  .date-text {
    display: inline-block;
    padding: 0.5rem 1rem;
    background: var(--panel);
    color: var(--fgTransparentWeak);
    border-radius: 16px;
    font-size: 0.85rem;
    font-weight: 500;
    border: 1px solid var(--divider);
  }
}

.message-cluster {
  display: flex;
  margin-bottom: 1rem;
  
  &.own-messages {
    justify-content: flex-end;
    
    .cluster-content {
      .sender-name {
        text-align: right;
      }
    }
  }
  
  &.other-messages {
    justify-content: flex-start;
  }
  
  .cluster-avatar {
    width: 36px;
    margin-right: 0.75rem;
    flex-shrink: 0;
    
    .message-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
    }
  }
  
  .cluster-content {
    flex: 1;
    min-width: 0;
    max-width: 70%;
    
    .sender-name {
      font-size: 0.8rem;
      color: var(--fgTransparentWeak);
      margin-bottom: 0.25rem;
      font-weight: 500;
    }
    
    .cluster-messages {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
    }
  }
}

.typing-indicator-container {
  display: flex;
  justify-content: flex-start;
  margin-top: 1rem;
  
  .typing-indicator {
    display: flex;
    align-items: flex-end;
    gap: 0.75rem;
    
    .typing-avatar {
      width: 36px;
      height: 36px;
      flex-shrink: 0;
      
      .typing-user-avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
      }
      
      .multiple-typing {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: var(--accent);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        
        i {
          font-size: 1rem;
        }
      }
    }
    
    .typing-bubble {
      background: var(--panel);
      border: 1px solid var(--divider);
      border-radius: 18px 18px 18px 4px;
      padding: 12px 16px;
      
      .typing-dots {
        display: flex;
        gap: 0.25rem;
        
        span {
          width: 6px;
          height: 6px;
          background: var(--fgTransparentWeak);
          border-radius: 50%;
          animation: typing-bounce 1.4s ease-in-out infinite both;
          
          &:nth-child(2) {
            animation-delay: 0.16s;
          }
          
          &:nth-child(3) {
            animation-delay: 0.32s;
          }
        }
      }
    }
  }
}

@keyframes typing-bounce {
  0%, 80%, 100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}

.scroll-to-bottom {
  position: absolute;
  bottom: 1rem;
  right: 1rem;
  width: 48px;
  height: 48px;
  border: none;
  border-radius: 50%;
  background: var(--accent);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: all 0.2s;
  
  &:hover {
    background: var(--accentLighten);
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
  }
  
  &:active {
    transform: translateY(0);
  }
  
  .new-messages-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    background: #ef4444;
    color: white;
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.125rem 0.375rem;
    border-radius: 10px;
    min-width: 16px;
    text-align: center;
  }
}

.composer-area {
  flex-shrink: 0;
  background: var(--panel);
  border-top: 1px solid var(--divider);
}

.shortcuts-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  
  .shortcuts-content {
    background: var(--panel);
    border-radius: 16px;
    width: 90%;
    max-width: 500px;
    max-height: 80vh;
    overflow: hidden;
    
    .shortcuts-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.5rem;
      border-bottom: 1px solid var(--divider);
      
      h3 {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 600;
        color: var(--fg);
      }
      
      .close-btn {
        width: 32px;
        height: 32px;
        border: none;
        border-radius: 50%;
        background: var(--buttonBg);
        color: var(--fgTransparentWeak);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        
        &:hover {
          background: var(--buttonHoverBg);
          color: var(--fg);
        }
      }
    }
    
    .shortcuts-list {
      padding: 1.5rem;
      
      .shortcut-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem 0;
        border-bottom: 1px solid var(--divider);
        
        &:last-child {
          border-bottom: none;
        }
        
        .keys {
          display: flex;
          gap: 0.25rem;
          
          kbd {
            padding: 0.25rem 0.5rem;
            background: var(--bg);
            border: 1px solid var(--divider);
            border-radius: 6px;
            font-size: 0.8rem;
            font-family: monospace;
            color: var(--fg);
          }
        }
        
        .description {
          color: var(--fgTransparentWeak);
          font-size: 0.9rem;
        }
      }
    }
  }
}

// Transitions
.search-slide-enter-active,
.search-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.search-slide-enter-from,
.search-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.fade-enter-active,
.fade-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

// Mobile Responsive
@media (max-width: 768px) {
  .chat-header {
    padding: 0.875rem 1rem;
    
    .header-left {
      gap: 0.75rem;
      
      .back-btn {
        width: 40px;
        height: 40px;
      }
      
      .chat-info {
        gap: 0.75rem;
        
        .avatar-container {
          .chat-avatar,
          .group-avatar {
            width: 40px;
            height: 40px;
          }
        }
        
        .info-text {
          .chat-name {
            font-size: 1rem;
          }
          
          .chat-status {
            font-size: 0.8rem;
          }
        }
      }
    }
    
    .header-actions {
      .header-btn {
        width: 40px;
        height: 40px;
        
        i {
          font-size: 1rem;
        }
      }
    }
  }
  
  .message-search-bar {
    padding: 0.625rem 1rem;
    
    .search-input {
      padding: 10px 40px 10px 40px;
      font-size: 16px; // Prevent zoom on iOS
    }
  }
  
  .messages-list {
    padding: 0.75rem 1rem;
  }
  
  .message-cluster {
    .cluster-content {
      max-width: 85%;
    }
  }
  
  .scroll-to-bottom {
    bottom: 0.75rem;
    right: 0.75rem;
    width: 44px;
    height: 44px;
  }
}
</style>
