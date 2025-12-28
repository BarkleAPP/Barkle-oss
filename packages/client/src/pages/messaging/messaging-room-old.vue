<template>
  <div class="modern-messaging-room">
    <div class="room-layout">
      <!-- Mobile Back Button (full width on mobile) -->
      <div v-if="isMobile" class="mobile-header">
        <button class="back-btn" @click="goBack">
          <i class="ph-arrow-left-bold"></i>
        </button>
        <div class="room-info">
          <div class="avatar-container">
            <MkAvatar 
              v-if="user"
              :user="user" 
              :show-indicator="true" 
              class="avatar"
            />
            <div v-else-if="group" class="group-avatar">
              <i class="ph-users-three-bold"></i>
            </div>
          </div>
          <div class="info">
            <h3 class="name">{{ getRoomName() }}</h3>
            <p v-if="user" class="status">
              <span v-if="user.isOnline" class="online-status">Online</span>
              <span v-else-if="user.lastActiveAt" class="last-seen">
                Last seen {{ getRelativeTime(user.lastActiveAt) }}
              </span>
              <span v-else class="offline-status">Offline</span>
            </p>
            <p v-else-if="group" class="status">
              {{ group.memberCount || 0 }} members
            </p>
          </div>
        </div>
      </div>

      <!-- Modern Chat View -->
      <ChatView 
        :selected-chat="currentChat"
        :messages="messages"
        :typing-users="typingUsers"
        :loading-messages="loadingMessages"
        :can-load-more="canLoadMore"
        :is-mobile="isMobile"
        @send-message="sendMessage"
        @delete-message="deleteMessage"
        @load-more="loadMoreMessages"
        @typing="onTyping"
        @back="goBack"
        @start-call="startCall"
        @show-chat-info="showInfo"
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from '@/router';
import * as os from '@/os';
import { stream } from '@/stream';
import { $i } from '@/account';
import { i18n } from '@/i18n';
import { definePageMetadata } from '@/scripts/page-metadata';
import { deviceKind } from '@/scripts/device-kind';
import * as Acct from 'calckey-js/built/acct';
import ChatView from '@/components/messaging/ChatView.vue';

const route = useRoute();
const router = useRouter();

// Props from route
const userAcct = computed(() => route.params.userAcct as string);
const groupId = computed(() => route.params.groupId as string);

// Reactive state
const user = ref<any>(null);
const group = ref<any>(null);
const messages = ref<any[]>([]);
const typingUsers = ref<any[]>([]);
const loadingMessages = ref(false);
const canLoadMore = ref(false);

// Connections
let connection: any = null;

// Computed
const isMobile = computed(() => deviceKind === 'mobile');

const currentChat = computed(() => {
  if (user.value) {
    return {
      id: `direct-${user.value.id}`,
      type: 'direct',
      participant: user.value,
      lastMessage: messages.value[messages.value.length - 1] || null,
      lastMessageAt: new Date().toISOString(),
      unreadCount: 0,
      isOnline: user.value.isOnline || false
    };
  } else if (group.value) {
    return {
      id: `group-${group.value.id}`,
      type: 'group',
      name: group.value.name,
      lastMessage: messages.value[messages.value.length - 1] || null,
      lastMessageAt: new Date().toISOString(),
      unreadCount: 0,
      memberCount: group.value.memberCount || 0
    };
  }
  return null;
});

// Methods
function getRoomName(): string {
  if (user.value) {
    return user.value.name || `@${user.value.username}` || 'Unknown User';
  }
  if (group.value) {
    return group.value.name || 'Unnamed Group';
  }
  return 'Chat';
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

async function loadRoom() {
  try {
    if (userAcct.value) {
      // Load user info
      const acct = Acct.parse(userAcct.value);
      user.value = await os.api('users/show', {
        username: acct.username,
        host: acct.host
      });
      
      // Load messages
      await loadMessages();
      
      // Connect to messaging
      connectToMessaging();
    } else if (groupId.value) {
      // Load group info
      group.value = await os.api('users/groups/show', {
        groupId: groupId.value
      });
      
      // Load messages
      await loadMessages();
      
      // Connect to messaging
      connectToMessaging();
    }
  } catch (error) {
    console.error('Failed to load room:', error);
    os.alert({
      type: 'error',
      text: 'Failed to load conversation'
    });
    goBack();
  }
}

async function loadMessages() {
  loadingMessages.value = true;
  canLoadMore.value = false;
  
  try {
    const params: any = { limit: 50, reversed: true };
    
    if (user.value) {
      params.userId = user.value.id;
    } else if (group.value) {
      params.groupId = group.value.id;
    }
    
    const msgs = await os.api('messaging/messages', params);
    messages.value = msgs.reverse();
    canLoadMore.value = msgs.length === 50;
  } catch (error) {
    console.error('Failed to load messages:', error);
    messages.value = [];
  } finally {
    loadingMessages.value = false;
  }
}

async function loadMoreMessages() {
  if (!canLoadMore.value || loadingMessages.value) return;
  
  const oldestMessage = messages.value[0];
  if (!oldestMessage) return;
  
  try {
    const params: any = {
      limit: 30,
      untilId: oldestMessage.id,
      reversed: true
    };
    
    if (user.value) {
      params.userId = user.value.id;
    } else if (group.value) {
      params.groupId = group.value.id;
    }
    
    const olderMessages = await os.api('messaging/messages', params);
    messages.value.unshift(...olderMessages.reverse());
    canLoadMore.value = olderMessages.length === 30;
  } catch (error) {
    console.error('Failed to load more messages:', error);
  }
}

function connectToMessaging() {
  // Disconnect previous connection
  if (connection) {
    connection.dispose();
  }
  
  // Connect to new chat
  const params: any = {};
  if (user.value) {
    params.otherparty = user.value.id;
  } else if (group.value) {
    params.group = group.value.id;
  }
  
  connection = stream.useChannel('messaging', params);
  connection.on('message', onNewMessage);
  connection.on('read', onMessageRead);
  connection.on('deleted', onMessageDeleted);
  connection.on('typers', onTypersUpdate);
}

function onNewMessage(message: any) {
  messages.value.push(message);
  
  // Mark as read if we sent it or if the chat is active
  if (message.userId === $i?.id || document.hasFocus()) {
    markAsRead(message.id);
  }
}

function onMessageRead(data: any) {
  // Update message read status
  if (Array.isArray(data)) {
    data.forEach(id => {
      const msg = messages.value.find(m => m.id === id);
      if (msg) msg.isRead = true;
    });
  } else {
    const msg = messages.value.find(m => m.id === data);
    if (msg) msg.isRead = true;
  }
}

function onMessageDeleted(id: string) {
  const index = messages.value.findIndex(m => m.id === id);
  if (index !== -1) {
    messages.value.splice(index, 1);
  }
}

function onTypersUpdate(typers: any[]) {
  typingUsers.value = typers.filter(u => u.id !== $i?.id);
}

async function sendMessage(data: { text?: string; file?: any }) {
  try {
    const params: any = {
      text: data.text,
      fileId: data.file?.id
    };
    
    if (user.value) {
      params.userId = user.value.id;
    } else if (group.value) {
      params.groupId = group.value.id;
    }
    
    await os.api('messaging/messages/create', params);
  } catch (error) {
    console.error('Failed to send message:', error);
    os.alert({
      type: 'error',
      text: 'Failed to send message'
    });
  }
}

async function deleteMessage(messageId: string) {
  try {
    await os.api('messaging/messages/delete', { messageId });
  } catch (error) {
    console.error('Failed to delete message:', error);
    os.alert({
      type: 'error',
      text: 'Failed to delete message'
    });
  }
}

function onTyping() {
  if (!connection) return;
  
  if (user.value) {
    connection.send('typing', {
      partner: user.value.id
    });
  } else if (group.value) {
    connection.send('typing', {
      group: group.value.id
    });
  }
}

function markAsRead(messageId: string) {
  os.api('messaging/messages/read', { messageId }).catch(console.error);
}

function goBack() {
  router.push('/my/messaging');
}

function startCall(type: 'voice' | 'video') {
  os.alert({
    type: 'info',
    text: `${type === 'voice' ? 'Voice' : 'Video'} calling feature coming soon!`
  });
}

function showInfo() {
  if (user.value) {
    router.push(`/@${user.value.username}`);
  } else if (group.value) {
    router.push(`/my/groups/${group.value.id}`);
  }
}

// Watch for route changes
watch([userAcct, groupId], () => {
  if (userAcct.value || groupId.value) {
    loadRoom();
  }
}, { immediate: true });

// Lifecycle
onMounted(() => {
  loadRoom();
});

onUnmounted(() => {
  if (connection) {
    connection.dispose();
  }
});

// Page metadata
definePageMetadata(computed(() => ({
  title: getRoomName(),
  icon: user.value ? 'ph-user-bold' : 'ph-users-three-bold'
})));
</script>

<style lang="scss" scoped>
.modern-messaging-room {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg);

  .room-layout {
    height: 100%;
    display: flex;
    flex-direction: column;

    .mobile-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
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
        flex-shrink: 0;

        &:hover {
          background: var(--X2);
        }

        i {
          font-size: 1.2rem;
        }
      }

      .room-info {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex: 1;
        min-width: 0;

        .avatar-container {
          position: relative;
          flex-shrink: 0;

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
        }

        .info {
          flex: 1;
          min-width: 0;

          .name {
            margin: 0 0 0.25rem 0;
            font-size: 1rem;
            font-weight: 600;
            color: var(--fg);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
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
    }
  }
}

@media (min-width: 769px) {
  .modern-messaging-room .room-layout .mobile-header {
    display: none;
  }
}
</style>
