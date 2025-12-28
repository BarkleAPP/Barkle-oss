<template>
  <div class="modern-chat-list">
    <!-- Header Section -->
    <div class="chat-list-header">
      <div class="header-top">
        <h1 class="title">Messages</h1>
        <div class="header-actions">
          <button class="action-btn new-chat" @click="$emit('new-chat')">
            <i class="ph-plus-bold"></i>
          </button>
        </div>
      </div>
      
      <!-- Search Bar -->
      <Transition name="search-slide">
        <div v-if="showSearch" class="search-container">
          <div class="search-wrapper">
            <i class="ph-magnifying-glass-bold search-icon"></i>
            <input 
              ref="searchInput"
              v-model="searchQuery" 
              type="text" 
              placeholder="Search conversations..."
              class="search-input"
              @keydown.escape="closeSearch"
            />
            <button v-if="searchQuery" class="clear-search" @click="clearSearch">
              <i class="ph-x-bold"></i>
            </button>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Filter Tabs -->
    <div class="filter-tabs">
      <button 
        v-for="filter in filters" 
        :key="filter.key"
        class="filter-tab"
        :class="{ active: activeFilter === filter.key }"
        @click="setActiveFilter(filter.key)"
      >
        <span class="tab-label">{{ filter.label }}</span>
        <span v-if="filter.count > 0" class="tab-count">{{ filter.count }}</span>
      </button>
    </div>

    <!-- Chat List -->
    <div class="chat-list-container">
      <div v-if="loading" class="loading-state">
        <div class="loading-skeleton">
          <div v-for="i in 6" :key="i" class="skeleton-item">
            <div class="skeleton-avatar"></div>
            <div class="skeleton-content">
              <div class="skeleton-line skeleton-name"></div>
              <div class="skeleton-line skeleton-message"></div>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="filteredChats.length === 0" class="empty-state">
        <div class="empty-content">
          <div class="empty-icon">
            <i v-if="searchQuery" class="ph-magnifying-glass-bold"></i>
            <i v-else class="ph-chat-circle-dots-bold"></i>
          </div>
          <h3 class="empty-title">
            {{ searchQuery ? 'No conversations found' : getEmptyStateTitle() }}
          </h3>
          <p class="empty-description">
            {{ searchQuery ? 'Try searching with different keywords' : getEmptyStateDescription() }}
          </p>
          <button v-if="!searchQuery" class="empty-action" @click="$emit('new-chat')">
            <i class="ph-plus-bold"></i>
            Start a conversation
          </button>
        </div>
      </div>

      <div v-else class="chat-items">
        <TransitionGroup name="chat-list" tag="div">
          <div 
            v-for="chat in filteredChats" 
            :key="chat.id"
            class="chat-item"
            :class="{ 
              active: selectedChatId === chat.id,
              unread: chat.unreadCount > 0,
              pinned: chat.isPinned
            }"
            @click="selectChat(chat)"
            @contextmenu="showChatMenu($event, chat)"
          >
            <!-- Pin Indicator -->
            <div v-if="chat.isPinned" class="pin-indicator">
              <i class="ph-push-pin-bold"></i>
            </div>

            <!-- Avatar Section -->
            <div class="avatar-section">
              <div class="avatar-container">
                <MkAvatar 
                  v-if="chat.type === 'direct'"
                  :user="chat.participant" 
                  :show-indicator="false"
                  class="chat-avatar"
                />
                <div v-else class="group-avatar">
                  <i class="ph-users-three-bold"></i>
                </div>
                
                <!-- Online Status -->
                <div 
                  v-if="chat.type === 'direct' && chat.participant?.onlineStatus === 'online'" 
                  class="online-indicator"
                ></div>
                
                <!-- Unread Badge -->
                <div v-if="chat.unreadCount > 0" class="unread-badge">
                  {{ chat.unreadCount > 99 ? '99+' : chat.unreadCount }}
                </div>
              </div>
            </div>

            <!-- Chat Content -->
            <div class="chat-content">
              <div class="chat-header">
                <h4 class="chat-name">{{ getChatName(chat) }}</h4>
                <div class="chat-meta">
                  <span class="timestamp">{{ formatTimestamp(chat.lastMessageAt) }}</span>
                  <div v-if="chat.lastMessage?.userId === $i?.id" class="message-status">
                    <i 
                      v-if="chat.lastMessage.isRead" 
                      class="ph-checks-bold read"
                      title="Read"
                    ></i>
                    <i 
                      v-else 
                      class="ph-check-bold sent"
                      title="Sent"
                    ></i>
                  </div>
                </div>
              </div>
              
              <div class="chat-preview">
                <div class="message-preview">
                  <span v-if="chat.lastMessage?.userId === $i?.id" class="sender-prefix">You: </span>
                  <span v-else-if="chat.type === 'group' && chat.lastMessage?.user" class="sender-prefix">
                    {{ chat.lastMessage.user.name || chat.lastMessage.user.username }}: 
                  </span>
                  <span class="message-text">{{ getMessagePreview(chat.lastMessage) }}</span>
                </div>
                
                <!-- Typing Indicator -->
                <div v-if="typingUsers[chat.id]?.length > 0" class="typing-indicator">
                  <div class="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  <span class="typing-text">
                    {{ formatTypingUsers(typingUsers[chat.id]) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Quick Actions -->
            <div class="quick-actions">
              
            </div>
          </div>
        </TransitionGroup>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, nextTick, watch } from 'vue';
import { i18n } from '@/i18n';
import { $i } from '@/account';

interface Chat {
  id: string;
  type: 'direct' | 'group';
  participant?: any;
  name?: string;
  lastMessage?: any;
  lastMessageAt: string;
  unreadCount: number;
  isPinned?: boolean;
  isMuted?: boolean;
  memberCount?: number;
}

interface Props {
  chats: Chat[];
  selectedChatId?: string;
  loading?: boolean;
  typingUsers?: Record<string, any[]>;
}

interface Emits {
  (e: 'select-chat', chat: Chat): void;
  (e: 'new-chat'): void;
  (e: 'pin-chat', chat: Chat): void;
  (e: 'mute-chat', chat: Chat): void;
}

const props = withDefaults(defineProps<Props>(), {
  chats: () => [],
  loading: false,
  typingUsers: () => ({})
});

const emit = defineEmits<Emits>();

// State
const showSearch = ref(false);
const searchQuery = ref('');
const activeFilter = ref<'all' | 'unread' | 'groups' | 'direct'>('all');
const searchInput = ref<HTMLInputElement>();

// Computed
const filters = computed(() => {
  const allChats = props.chats;
  const unreadChats = allChats.filter(chat => chat.unreadCount > 0);
  const groupChats = allChats.filter(chat => chat.type === 'group');
  const directChats = allChats.filter(chat => chat.type === 'direct');

  return [
    { key: 'all', label: 'All', count: allChats.length },
    { key: 'unread', label: 'Unread', count: unreadChats.length },
    { key: 'groups', label: 'Groups', count: groupChats.length },
    { key: 'direct', label: 'Direct', count: directChats.length }
  ];
});

const filteredChats = computed(() => {
  let chats = [...props.chats];

  // Apply filter
  switch (activeFilter.value) {
    case 'unread':
      chats = chats.filter(chat => chat.unreadCount > 0);
      break;
    case 'groups':
      chats = chats.filter(chat => chat.type === 'group');
      break;
    case 'direct':
      chats = chats.filter(chat => chat.type === 'direct');
      break;
  }

  // Apply search
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase().trim();
    chats = chats.filter(chat => {
      const name = getChatName(chat).toLowerCase();
      const lastMessage = chat.lastMessage?.text?.toLowerCase() || '';
      return name.includes(query) || lastMessage.includes(query);
    });
  }

  // Sort: pinned first, then by last message time
  return chats.sort((a, b) => {
    if (a.isPinned !== b.isPinned) {
      return a.isPinned ? -1 : 1;
    }
    return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
  });
});

// Methods
function getChatName(chat: Chat): string {
  if (chat.type === 'direct') {
    return chat.participant?.name || chat.participant?.username || 'Unknown User';
  }
  return chat.name || 'Group Chat';
}

function getMessagePreview(message: any): string {
  if (!message) return 'No messages yet';
  
  if (message.file && !message.text) {
    return `📎 ${message.file.name || 'File'}`;
  }
  
  return message.text || 'Message';
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return 'now';
  if (diffMinutes < 60) return `${diffMinutes}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  
  return date.toLocaleDateString(undefined, { 
    month: 'short', 
    day: 'numeric' 
  });
}

function formatTypingUsers(users: any[]): string {
  if (!users || users.length === 0) return '';
  
  if (users.length === 1) {
    return `${users[0].name || users[0].username} is typing...`;
  }
  
  if (users.length === 2) {
    return `${users[0].name || users[0].username} and ${users[1].name || users[1].username} are typing...`;
  }
  
  return `${users.length} people are typing...`;
}

function getEmptyStateTitle(): string {
  switch (activeFilter.value) {
    case 'unread': return 'No unread messages';
    case 'groups': return 'No group chats';
    case 'direct': return 'No direct messages';
    default: return 'No conversations yet';
  }
}

function getEmptyStateDescription(): string {
  switch (activeFilter.value) {
    case 'unread': return 'All caught up! No new messages to read.';
    case 'groups': return 'Join or create a group to start chatting.';
    case 'direct': return 'Start a conversation with someone.';
    default: return 'Start a new conversation to get chatting.';
  }
}

// Actions
function toggleSearch() {
  showSearch.value = !showSearch.value;
  if (showSearch.value) {
    nextTick(() => {
      searchInput.value?.focus();
    });
  } else {
    searchQuery.value = '';
  }
}

function closeSearch() {
  showSearch.value = false;
  searchQuery.value = '';
}

function clearSearch() {
  searchQuery.value = '';
  searchInput.value?.focus();
}

function setActiveFilter(filter: string) {
  activeFilter.value = filter as any;
}

function selectChat(chat: Chat) {
  emit('select-chat', chat);
}

function togglePin(chat: Chat) {
  emit('pin-chat', chat);
}

function toggleMute(chat: Chat) {
  emit('mute-chat', chat);
}

function showChatMenu(event: MouseEvent, chat: Chat) {
  event.preventDefault();
  // TODO: Implement context menu
}

// Watch for search visibility to auto-focus
watch(showSearch, (visible) => {
  if (visible) {
    nextTick(() => {
      searchInput.value?.focus();
    });
  }
});
</script>

<style lang="scss" scoped>
.modern-chat-list {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--panel);
  overflow: hidden;
}

.chat-list-header {
  flex-shrink: 0;
  background: var(--panel);
  border-bottom: 1px solid var(--divider);
  
  .header-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem 1.5rem;
    
    .title {
      font-size: 1.75rem;
      font-weight: 700;
      color: var(--fg);
      margin: 0;
      letter-spacing: -0.02em;
    }
    
    .header-actions {
      display: flex;
      gap: 0.5rem;
      
      .action-btn {
        width: 44px;
        height: 44px;
        border-radius: 12px;
        border: none;
        background: var(--buttonBg);
        color: var(--fg);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
        
        &:hover {
          background: var(--buttonHoverBg);
          transform: translateY(-1px);
        }
        
        &:active {
          transform: translateY(0);
        }
        
        &.search-toggle.active {
          background: var(--accent);
          color: white;
        }
        
        &.new-chat {
          background: var(--accent);
          color: white;
          
          &:hover {
            background: var(--accentLighten);
          }
        }
        
        i {
          font-size: 1.25rem;
        }
      }
    }
  }
}

.search-container {
  padding: 0 1.5rem 1rem;
  
  .search-wrapper {
    position: relative;
    
    .search-icon {
      position: absolute;
      left: 16px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--fgTransparentWeak);
      font-size: 1.1rem;
      pointer-events: none;
    }
    
    .search-input {
      width: 100%;
      padding: 14px 50px 14px 50px;
      border: 2px solid var(--divider);
      border-radius: 16px;
      background: var(--bg);
      color: var(--fg);
      font-size: 1rem;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      
      &:focus {
        outline: none;
        border-color: var(--accent);
        background: var(--panel);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
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
      width: 28px;
      height: 28px;
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
        font-size: 0.9rem;
      }
    }
  }
}

.filter-tabs {
  display: flex;
  padding: 0 1.5rem;
  margin-bottom: 0.5rem;
  gap: 0.5rem;
  
  .filter-tab {
    padding: 0.75rem 1rem;
    border: none;
    border-radius: 12px;
    background: transparent;
    color: var(--fgTransparentWeak);
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    font-weight: 500;
    
    &:hover {
      background: var(--X2);
      color: var(--fg);
    }
    
    &.active {
      background: var(--accentedBg);
      color: var(--accent);
      
      .tab-count {
        background: var(--accent);
        color: white;
      }
    }
    
    .tab-count {
      background: var(--X3);
      color: var(--fgTransparentWeak);
      padding: 0.25rem 0.5rem;
      border-radius: 8px;
      font-size: 0.75rem;
      font-weight: 600;
      min-width: 1.5rem;
      text-align: center;
      transition: all 0.2s;
    }
  }
}

.chat-list-container {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.loading-state {
  padding: 1rem 1.5rem;
  
  .loading-skeleton {
    .skeleton-item {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem 0;
      
      .skeleton-avatar {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: linear-gradient(90deg, var(--X2) 25%, var(--X3) 50%, var(--X2) 75%);
        background-size: 400% 100%;
        animation: shimmer 1.5s ease-in-out infinite;
      }
      
      .skeleton-content {
        flex: 1;
        
        .skeleton-line {
          height: 12px;
          border-radius: 6px;
          background: linear-gradient(90deg, var(--X2) 25%, var(--X3) 50%, var(--X2) 75%);
          background-size: 400% 100%;
          animation: shimmer 1.5s ease-in-out infinite;
          
          &.skeleton-name {
            width: 40%;
            margin-bottom: 0.5rem;
          }
          
          &.skeleton-message {
            width: 70%;
          }
        }
      }
    }
  }
}

@keyframes shimmer {
  0% { background-position: -400% 0; }
  100% { background-position: 400% 0; }
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 2rem 1.5rem;
  width: 100%;
  box-sizing: border-box;
  margin: 0;
  
  .empty-content {
    text-align: center;
    max-width: 300px;
    width: 100%;
    margin: 0 auto;
    
    .empty-icon {
      margin-bottom: 1.5rem;
      
      i {
        font-size: 4rem;
        color: var(--fgTransparentWeak);
        opacity: 0.5;
      }
    }
    
    .empty-title {
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--fg);
      margin: 0 0 0.5rem 0;
    }
    
    .empty-description {
      color: var(--fgTransparentWeak);
      margin: 0 0 1.5rem 0;
      line-height: 1.5;
    }
    
    .empty-action {
      padding: 0.875rem 1.5rem;
      background: var(--accent);
      color: white;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 500;
      
      &:hover {
        background: var(--accentLighten);
        transform: translateY(-1px);
      }
      
      &:active {
        transform: translateY(0);
      }
    }
  }
}

.chat-items {
  height: 100%;
  overflow-y: auto;
  padding: 0 1rem;
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

.chat-item {
  position: relative;
  display: flex;
  align-items: flex-start;
  padding: 1rem 0.75rem;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  margin-bottom: 0.25rem;
  min-height: 80px;
  
  &:hover {
    background: var(--X2);
    
    .quick-actions {
      opacity: 1;
      transform: translateX(0);
    }
  }
  
  &.active {
    background: var(--accentedBg);
    
    .chat-name {
      color: var(--accent);
    }
  }
  
  &.unread {
    .chat-name {
      font-weight: 700;
    }
    
    .message-text {
      font-weight: 500;
    }
  }
  
  &.pinned {
    .pin-indicator {
      opacity: 1;
    }
  }
  
  .pin-indicator {
    position: absolute;
    top: 8px;
    left: 8px;
    width: 16px;
    height: 16px;
    opacity: 0;
    transition: opacity 0.2s;
    
    i {
      font-size: 0.75rem;
      color: var(--accent);
    }
  }
}

.avatar-section {
  flex-shrink: 0;
  margin-right: 1rem;
  
  .avatar-container {
    position: relative;
    
    .chat-avatar {
      width: 56px;
      height: 56px;
      border-radius: 50%;
    }
    
    .group-avatar {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--accent), var(--accentLighten));
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      
      i {
        font-size: 1.5rem;
      }
    }
    
    .online-indicator {
      position: absolute;
      bottom: 2px;
      right: 2px;
      width: 14px;
      height: 14px;
      background: #10b981;
      border: 2px solid var(--panel);
      border-radius: 50%;
    }
    
    .unread-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      background: var(--accent);
      color: white;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.25rem 0.5rem;
      border-radius: 12px;
      min-width: 20px;
      text-align: center;
      border: 2px solid var(--panel);
    }
  }
}

.chat-content {
  flex: 1;
  min-width: 0;
  
  .chat-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.25rem;
    
    .chat-name {
      font-size: 1rem;
      font-weight: 600;
      color: var(--fg);
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1;
      min-width: 0;
    }
    
    .chat-meta {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-shrink: 0;
      
      .timestamp {
        font-size: 0.8rem;
        color: var(--fgTransparentWeak);
        font-weight: 500;
      }
      
      .message-status {
        i {
          font-size: 0.9rem;
          
          &.sent {
            color: var(--fgTransparentWeak);
          }
          
          &.read {
            color: var(--accent);
          }
        }
      }
    }
  }
  
  .chat-preview {
    .message-preview {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      
      .sender-prefix {
        color: var(--fgTransparentWeak);
        font-size: 0.9rem;
        flex-shrink: 0;
      }
      
      .message-text {
        color: var(--fgTransparentWeak);
        font-size: 0.9rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        flex: 1;
        min-width: 0;
      }
    }
    
    .typing-indicator {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-top: 0.25rem;
      
      .typing-dots {
        display: flex;
        gap: 0.125rem;
        
        span {
          width: 4px;
          height: 4px;
          background: var(--accent);
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
      
      .typing-text {
        font-size: 0.8rem;
        color: var(--accent);
        font-style: italic;
      }
    }
  }
}

.quick-actions {
  position: absolute;
  top: 50%;
  right: 0.75rem;
  transform: translateY(-50%) translateX(8px);
  opacity: 0;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  gap: 0.25rem;
  
  .quick-action {
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 8px;
    background: var(--panel);
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
    
    &.active {
      background: var(--accent);
      color: white;
    }
    
    i {
      font-size: 0.9rem;
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

.chat-list-enter-active,
.chat-list-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.chat-list-enter-from,
.chat-list-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

.chat-list-move {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

// Mobile Responsive
@media (max-width: 768px) {
  .modern-chat-list {
    width: 100vw;
    max-width: 100vw;
    height: 100vh;
    height: 100dvh;
    
    .chat-list-container {
      width: 100%;
      height: 100%;
    }
    
    .chat-list-header {
      .header-top {
        padding: 1rem 1.25rem;
        
        .title {
          font-size: 1.5rem;
        }
        
        .action-btn {
          width: 40px;
          height: 40px;
          
          i {
            font-size: 1.1rem;
          }
        }
      }
    }
    
    .search-container {
      padding: 0 1.25rem 0.75rem;
      
      .search-input {
        padding: 12px 44px 12px 44px;
        font-size: 16px; // Prevent zoom on iOS
      }
    }
    
    .filter-tabs {
      padding: 0 1.25rem;
      
      .filter-tab {
        padding: 0.625rem 0.875rem;
        font-size: 0.85rem;
      }
    }
    
    .chat-items {
      padding: 0 0.75rem;
    }
    
    .empty-state {
      padding: 2rem 1rem;
      width: 100vw;
      height: 100%;
      box-sizing: border-box;
      margin: 0;
      
      .empty-content {
        max-width: 100%;
        width: 100%;
        margin: 0 auto;
        
        .empty-icon i {
          font-size: 3rem;
        }
        
        .empty-title {
          font-size: 1.1rem;
        }
        
        .empty-description {
          font-size: 0.9rem;
          margin: 0 0 1.25rem 0;
        }
        
        .empty-action {
          padding: 0.75rem 1.25rem;
          font-size: 0.9rem;
        }
      }
    }
    
    .chat-item {
      padding: 0.875rem 0.5rem;
      min-height: 72px;
      
      .avatar-section {
        margin-right: 0.875rem;
        
        .chat-avatar,
        .group-avatar {
          width: 52px;
          height: 52px;
        }
      }
      
      .chat-content {
        .chat-header {
          .chat-name {
            font-size: 0.95rem;
          }
          
          .timestamp {
            font-size: 0.75rem;
          }
        }
        
        .chat-preview {
          .message-preview {
            .sender-prefix,
            .message-text {
              font-size: 0.85rem;
            }
          }
        }
      }
    }
  }
}
</style>
