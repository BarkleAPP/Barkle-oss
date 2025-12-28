<template>
  <div class="chat-list">
    <div class="header">
      <h2 class="title">Messages</h2>
      <button class="new-chat-btn" @click="$emit('new-chat')">
        <i class="ph-plus-bold"></i>
      </button>
    </div>
    
    <div class="search-container">
      <div class="search-box">
        <i class="ph-magnifying-glass-bold"></i>
        <input 
          v-model="searchQuery" 
          type="text" 
          :placeholder="i18n.ts.search"
          class="search-input"
        />
      </div>
    </div>

    <div class="chat-tabs">
      <button 
        v-for="tab in tabs" 
        :key="tab.key"
        class="tab"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        <i :class="tab.icon"></i>
        <span>{{ tab.label }}</span>
        <span v-if="tab.unreadCount > 0" class="unread-badge">{{ tab.unreadCount }}</span>
      </button>
    </div>

    <div class="chat-list-content">
      <div v-if="filteredChats.length === 0" class="empty-state">
        <i class="ph-chat-circle-dots-bold"></i>
        <h3>{{ activeTab === 'direct' ? i18n.ts.noDirectMessages : i18n.ts.noGroupMessages }}</h3>
        <p>{{ activeTab === 'direct' ? i18n.ts.startMessagingWithSomeone : i18n.ts.createOrJoinGroup }}</p>
        <button class="start-btn" @click="$emit('new-chat')">
          <i class="ph-plus-bold"></i>
          {{ activeTab === 'direct' ? i18n.ts.newMessage : i18n.ts.newGroup }}
        </button>
      </div>

      <div v-else class="chats">
        <div 
          v-for="chat in filteredChats" 
          :key="chat.id"
          class="chat-item"
          :class="{ 
            active: selectedChatId === chat.id,
            unread: chat.unreadCount > 0 
          }"
          @click="$emit('select-chat', chat)"
        >
          <div class="avatar-container">
            <MkAvatar 
              :user="chat.type === 'direct' ? chat.participant : null" 
              :show-indicator="true" 
              class="avatar"
            />
            <div v-if="chat.type === 'group'" class="group-avatar">
              <i class="ph-users-three-bold"></i>
            </div>
            <div v-if="chat.isOnline" class="online-indicator"></div>
          </div>

          <div class="chat-info">
            <div class="chat-header">
              <h4 class="chat-name">{{ getChatName(chat) }}</h4>
              <span class="last-message-time">{{ getRelativeTime(chat.lastMessageAt) }}</span>
            </div>
            
            <div class="last-message">
              <span v-if="chat.lastMessage?.userId === $i?.id" class="you-prefix">You: </span>
              <span class="message-preview">{{ getMessagePreview(chat.lastMessage) }}</span>
            </div>
          </div>

          <div class="chat-meta">
            <div v-if="chat.unreadCount > 0" class="unread-count">{{ chat.unreadCount }}</div>
            <div v-if="chat.lastMessage?.isRead === false && chat.lastMessage?.userId === $i?.id" class="message-status">
              <i class="ph-check-bold"></i>
            </div>
            <div v-else-if="chat.lastMessage?.isRead === true && chat.lastMessage?.userId === $i?.id" class="message-status read">
              <i class="ph-checks-bold"></i>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import { i18n } from '@/i18n';
import { $i } from '@/account';

const props = defineProps<{
  chats: any[];
  selectedChatId?: string;
}>();

const emit = defineEmits<{
  (e: 'select-chat', chat: any): void;
  (e: 'new-chat'): void;
}>();

const searchQuery = ref('');
const activeTab = ref('direct');

const tabs = computed(() => [
  {
    key: 'direct',
    label: i18n.ts.directMessages || 'Direct',
    icon: 'ph-user-bold',
    unreadCount: props.chats.filter(c => c.type === 'direct' && c.unreadCount > 0).length
  },
  {
    key: 'groups',
    label: i18n.ts.groups || 'Groups',
    icon: 'ph-users-three-bold',
    unreadCount: props.chats.filter(c => c.type === 'group' && c.unreadCount > 0).length
  }
]);

const filteredChats = computed(() => {
  let chats = props.chats.filter(chat => chat.type === activeTab.value);
  
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    chats = chats.filter(chat => 
      getChatName(chat).toLowerCase().includes(query)
    );
  }
  
  return chats.sort((a, b) => {
    // Sort by unread first, then by last message time
    if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
    if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
    return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
  });
});

function getChatName(chat: any): string {
  if (chat.type === 'direct') {
    return chat.participant?.name || `@${chat.participant?.username}` || 'Unknown User';
  }
  return chat.name || 'Unnamed Group';
}

function getMessagePreview(message: any): string {
  if (!message) return 'No messages yet';
  if (message.text) {
    return message.text.length > 50 ? message.text.slice(0, 50) + '...' : message.text;
  }
  if (message.file) {
    return `📎 ${message.file.name || 'File'}`;
  }
  return 'Message';
}

function getRelativeTime(date: string): string {
  const now = new Date();
  const messageDate = new Date(date);
  const diffInMinutes = Math.floor((now.getTime() - messageDate.getTime()) / (1000 * 60));
  
  if (diffInMinutes < 1) return 'now';
  if (diffInMinutes < 60) return `${diffInMinutes}m`;
  if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`;
  if (diffInMinutes < 10080) return `${Math.floor(diffInMinutes / 1440)}d`;
  
  return messageDate.toLocaleDateString();
}
</script>

<style lang="scss" scoped>
.chat-list {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border-right: 1px solid var(--divider);

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    border-bottom: 1px solid var(--divider);

    .title {
      font-size: 1.25rem;
      font-weight: 600;
      margin: 0;
      color: var(--fg);
    }

    .new-chat-btn {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: var(--accent);
      color: white;
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        background: var(--accentLighten);
        transform: scale(1.05);
      }

      i {
        font-size: 1.1rem;
      }
    }
  }

  .search-container {
    padding: 1rem;
    border-bottom: 1px solid var(--divider);

    .search-box {
      position: relative;
      
      i {
        position: absolute;
        left: 12px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--fgTransparentWeak);
        font-size: 1rem;
      }

      .search-input {
        width: 100%;
        padding: 12px 12px 12px 40px;
        border: 1px solid var(--divider);
        border-radius: 12px;
        background: var(--X2);
        color: var(--fg);
        font-size: 0.95rem;
        transition: all 0.2s;

        &:focus {
          outline: none;
          border-color: var(--accent);
          background: var(--X3);
        }

        &::placeholder {
          color: var(--fgTransparentWeak);
        }
      }
    }
  }

  .chat-tabs {
    display: flex;
    background: var(--X2);
    border-bottom: 1px solid var(--divider);

    .tab {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.75rem;
      border: none;
      background: transparent;
      color: var(--fgTransparentWeak);
      cursor: pointer;
      transition: all 0.2s;
      position: relative;

      &.active {
        color: var(--accent);
        background: var(--panel);

        &::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: var(--accent);
        }
      }

      &:hover:not(.active) {
        background: var(--X3);
        color: var(--fg);
      }

      i {
        font-size: 1rem;
      }

      span {
        font-size: 0.9rem;
        font-weight: 500;
      }

      .unread-badge {
        background: var(--accent);
        color: white;
        border-radius: 10px;
        padding: 0.1rem 0.4rem;
        font-size: 0.75rem;
        min-width: 1.2rem;
        text-align: center;
        margin-left: 0.25rem;
      }
    }
  }

  .chat-list-content {
    flex: 1;
    overflow-y: auto;

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 2rem;
      text-align: center;
      color: var(--fgTransparentWeak);

      i {
        font-size: 4rem;
        margin-bottom: 1rem;
        opacity: 0.5;
      }

      h3 {
        margin: 0 0 0.5rem 0;
        font-size: 1.1rem;
        color: var(--fg);
      }

      p {
        margin: 0 0 1.5rem 0;
        font-size: 0.95rem;
        line-height: 1.4;
      }

      .start-btn {
        padding: 0.75rem 1.5rem;
        background: var(--accent);
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 0.95rem;
        cursor: pointer;
        transition: background 0.2s;
        display: flex;
        align-items: center;
        gap: 0.5rem;

        &:hover {
          background: var(--accentLighten);
        }
      }
    }

    .chats {
      .chat-item {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem 1rem;
        cursor: pointer;
        transition: all 0.2s;
        border-bottom: 1px solid transparent;
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;

        &:hover {
          background: var(--X2);
        }

        &.active {
          background: var(--accentedBg);
          border-color: var(--accent);
        }

        &.unread {
          background: var(--X2);

          .chat-name {
            font-weight: 600;
          }

          .last-message {
            font-weight: 500;
          }
        }

        .avatar-container {
          position: relative;
          flex-shrink: 0;

          .avatar {
            width: 48px;
            height: 48px;
          }

          .group-avatar {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: var(--accent);
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
            width: 12px;
            height: 12px;
            background: var(--success);
            border: 2px solid var(--panel);
            border-radius: 50%;
          }
        }

        .chat-info {
          flex: 1;
          min-width: 0;

          .chat-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 0.25rem;

            .chat-name {
              font-size: 0.95rem;
              font-weight: 500;
              margin: 0;
              color: var(--fg);
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }

            .last-message-time {
              font-size: 0.8rem;
              color: var(--fgTransparentWeak);
              flex-shrink: 0;
            }
          }

          .last-message {
            font-size: 0.85rem;
            color: var(--fgTransparentWeak);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;

            .you-prefix {
              color: var(--accent);
              font-weight: 500;
            }
          }
        }

        .chat-meta {
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.25rem;

          .unread-count {
            background: var(--accent);
            color: white;
            border-radius: 10px;
            padding: 0.1rem 0.4rem;
            font-size: 0.75rem;
            min-width: 1.2rem;
            text-align: center;
            font-weight: 600;
          }

          .message-status {
            color: var(--fgTransparentWeak);

            &.read {
              color: var(--accent);
            }

            i {
              font-size: 0.9rem;
            }
          }
        }
      }
    }
  }
}

@media (max-width: 768px) {
  .chat-list {
    height: 100vh;
    height: 100dvh; /* Use dynamic viewport height for mobile */

    .header {
      padding: 1.25rem 1rem 1rem;
      position: sticky;
      top: 0;
      background: var(--panel);
      z-index: 10;

      .title {
        font-size: 1.4rem;
        font-weight: 700;
      }

      .new-chat-btn {
        width: 40px;
        height: 40px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);

        &:active {
          transform: scale(0.95);
        }

        i {
          font-size: 1.2rem;
        }
      }
    }

    .search-container {
      padding: 0 1rem 1rem;
      background: var(--panel);
      position: sticky;
      top: 80px;
      z-index: 9;

      .search-box {
        i {
          left: 14px;
          font-size: 1.1rem;
        }

        .search-input {
          padding: 14px 16px 14px 44px;
          font-size: 1rem;
          border-radius: 14px;
          min-height: 52px;
          appearance: none;
          -webkit-appearance: none;
          -webkit-tap-highlight-color: transparent;
          border: 2px solid var(--divider);

          &:focus {
            border-color: var(--accent);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          }
        }
      }
    }

    .chat-tabs {
      position: sticky;
      top: 152px;
      z-index: 8;

      .tab {
        padding: 1rem 0.75rem;
        min-height: 56px;
        -webkit-tap-highlight-color: transparent;

        &:active {
          transform: scale(0.98);
        }

        span:not(.unread-badge) {
          font-size: 0.9rem;
        }
      }
    }

    .chat-list-content {
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      padding-bottom: env(safe-area-inset-bottom);

      .empty-state {
        padding: 3rem 1.5rem;

        i {
          font-size: 4.5rem;
          margin-bottom: 2rem;
        }

        h3 {
          font-size: 1.3rem;
          margin-bottom: 0.75rem;
        }

        p {
          font-size: 1rem;
          line-height: 1.5;
          margin-bottom: 2.5rem;
        }

        .start-btn {
          padding: 1rem 2rem;
          font-size: 1rem;
          border-radius: 14px;
          min-height: 52px;
          -webkit-tap-highlight-color: transparent;

          &:active {
            transform: scale(0.95);
          }
        }
      }

      .chats {
        .chat-item {
          padding: 1rem;
          margin: 0 0.5rem 0.5rem;
          border-radius: 14px;
          border-bottom: none;
          border: 2px solid transparent;
          -webkit-tap-highlight-color: transparent;

          &:last-child {
            margin-bottom: 1rem;
          }

          &:hover {
            background: var(--accentedBg);
          }

          &.active {
            background: var(--accentedBg);
            border-color: var(--accent);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          }

          &:active {
            transform: scale(0.98);
          }

          .avatar-container {
            .avatar,
            .group-avatar {
              width: 52px;
              height: 52px;
            }

            .online-indicator {
              width: 14px;
              height: 14px;
              border: 3px solid var(--panel);
            }
          }

          .chat-info {
            .chat-header {
              margin-bottom: 0.375rem;

              .chat-name {
                font-size: 1rem;
                font-weight: 600;
              }

              .last-message-time {
                font-size: 0.85rem;
              }
            }

            .last-message {
              font-size: 0.9rem;
              line-height: 1.3;
            }
          }

          .chat-meta {
            .unread-count {
              font-size: 0.8rem;
              padding: 0.25rem 0.5rem;
              min-width: 24px;
              height: 24px;
              display: flex;
              align-items: center;
              justify-content: center;
            }
          }
        }
      }
    }
  }
}

@media (max-width: 480px) {
  .chat-list {
    .header {
      padding: 1rem 0.875rem 0.875rem;

      .title {
        font-size: 1.25rem;
      }

      .new-chat-btn {
        width: 36px;
        height: 36px;

        i {
          font-size: 1.1rem;
        }
      }
    }

    .search-container {
      padding: 0 0.875rem 0.875rem;

      .search-box .search-input {
        padding: 12px 14px 12px 42px;
        min-height: 48px;
        font-size: 0.95rem;
      }
    }

    .chat-tabs .tab {
      padding: 0.875rem 0.5rem;

      span:not(.unread-badge) {
        display: none;
      }
    }

    .chat-list-content .chats .chat-item {
      padding: 0.875rem;
      margin: 0 0.375rem 0.375rem;
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;

      .avatar-container {
        .avatar,
        .group-avatar {
          width: 48px;
          height: 48px;
        }

        .online-indicator {
          width: 12px;
          height: 12px;
        }
      }

      .chat-info {
        .chat-header .chat-name {
          font-size: 0.95rem;
        }

        .last-message {
          font-size: 0.85rem;
        }
      }
    }
  }
}
</style>
