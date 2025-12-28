<template>
  <div class="modern-messaging-room">
    <div class="room-layout">
      <!-- Modern Chat View -->
      <ModernChatView 
        :selected-chat="currentChat"
        :messages="messages"
        :typing-users="typingUsers"
        :loading-messages="loadingMessages"
        :can-load-more="canLoadMore"
        :is-mobile="isMobile"
        :hide-call-buttons="isMobile"
        @send-message="sendMessage"
        @delete-message="deleteMessage"
        @edit-message="editMessage"
        @react-message="reactToMessage"
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
import { useRouter } from '@/router';
import * as os from '@/os';
import { stream } from '@/stream';
import { $i } from '@/account';
import { i18n } from '@/i18n';
import { definePageMetadata } from '@/scripts/page-metadata';
import { deviceKind } from '@/scripts/device-kind';
import * as Acct from 'calckey-js/built/acct';
import ModernChatView from '@/components/messaging/ModernChatView.vue';

const router = useRouter();

// Props from route
const userAcct = computed(() => router.current.props.get('userAcct') as string);
const groupId = computed(() => router.current.props.get('groupId') as string);

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
const isMobile = computed(() => deviceKind === 'smartphone');

const currentChat = computed(() => {
  if (user.value) {
    return {
      id: `direct-${user.value.id}`,
      type: 'direct' as const,
      participant: user.value
    };
  } else if (group.value) {
    return {
      id: `group-${group.value.id}`,
      type: 'group' as const,
      name: group.value.name,
      memberCount: group.value.memberCount || 0
    };
  }
  return undefined;
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
        host: acct.host || undefined
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
  connection.on('reaction', onReactionAdded);
  connection.on('reactionRemoved', onReactionRemoved);
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

function onReactionAdded(data: any) {
  // Update message reactions
  const message = messages.value.find(m => m.id === data.messageId);
  if (message) {
    // Update reaction counts
    if (!message.reactionCounts) {
      message.reactionCounts = {};
    }
    message.reactionCounts = { ...message.reactionCounts, ...data.reactionCounts };
    
    // Update user reactions
    if (!message.userReactions) {
      message.userReactions = [];
    }
    if (data.userId === $i?.id && !message.userReactions.includes(data.reaction)) {
      message.userReactions.push(data.reaction);
    }
  }
}

function onReactionRemoved(data: any) {
  // Update message reactions
  const message = messages.value.find(m => m.id === data.messageId);
  if (message) {
    // Update reaction counts
    if (message.reactionCounts) {
      message.reactionCounts = { ...message.reactionCounts, ...data.reactionCounts };
    }
    
    // Update user reactions
    if (message.userReactions && data.userId === $i?.id) {
      const index = message.userReactions.indexOf(data.reaction);
      if (index > -1) {
        message.userReactions.splice(index, 1);
      }
    }
  }
}

async function sendMessage(data: { text?: string; file?: any; replyTo?: string }) {
  try {
    const params: any = {
      text: data.text,
      fileId: data.file?.id
    };
    
    // Add reply support
    if (data.replyTo) {
      params.replyId = data.replyTo;
    }
    
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

async function editMessage(messageId: string, newText: string) {
  try {
    await (os.api as any)('messaging/messages/edit', {
      messageId,
      text: newText
    });
  } catch (error) {
    console.error('Failed to edit message:', error);
    os.alert({
      type: 'error',
      text: 'Failed to edit message'
    });
  }
}

async function reactToMessage(messageId: string, reaction: string) {
  try {
    const result = await (os.api as any)('messaging/messages/reactions/toggle-reaction', {
      messageId,
      reaction
    });
    
    // Update local message state immediately
    const message = messages.value.find(m => m.id === messageId);
    if (message) {
      message.reactionCounts = result.reactionCounts;
      
      if (!message.userReactions) {
        message.userReactions = [];
      }
      
      if (result.userReacted) {
        if (!message.userReactions.includes(reaction)) {
          message.userReactions.push(reaction);
        }
      } else {
        const index = message.userReactions.indexOf(reaction);
        if (index > -1) {
          message.userReactions.splice(index, 1);
        }
      }
    }
  } catch (error) {
    console.error('Failed to react to message:', error);
    os.alert({
      type: 'error',
      text: 'Failed to add reaction'
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
  }
}
</style>
