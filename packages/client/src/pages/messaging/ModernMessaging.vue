<template>
  <div class="modern-messaging-app">
    <div class="messaging-layout">
      <!-- Chat List -->
      <div class="chat-list-container">
        <ModernChatList 
          :chats="chats"
          :selected-chat-id="undefined"
          :loading="loadingChats"
          :typing-users="typingUsersByChat"
          @select-chat="selectChat"
          @new-chat="showNewChatDialog"
          @pin-chat="pinChat"
          @mute-chat="muteChat"
        />
      </div>
    </div>

    <!-- New Chat Dialog -->
    <Transition name="modal">
      <div v-if="showNewChat" class="new-chat-overlay" @click="closeNewChatDialog">
        <div class="new-chat-dialog" @click.stop>
          <div class="dialog-header">
            <h3>Start New Conversation</h3>
            <button class="close-btn" @click="closeNewChatDialog">
              <i class="ph-x-bold"></i>
            </button>
          </div>
          
          <div class="dialog-content">
            <div class="chat-type-tabs">
              <button 
                class="tab"
                :class="{ active: newChatType === 'direct' }"
                @click="newChatType = 'direct'"
              >
                <i class="ph-user-bold"></i>
                <span>Direct Message</span>
              </button>
              <button 
                class="tab"
                :class="{ active: newChatType === 'group' }"
                @click="newChatType = 'group'"
              >
                <i class="ph-users-three-bold"></i>
                <span>Group Chat</span>
              </button>
            </div>

            <div v-if="newChatType === 'direct'" class="user-search">
              <div class="search-box">
                <i class="ph-magnifying-glass-bold"></i>
                <input 
                  v-model="userSearchQuery"
                  type="text" 
                  placeholder="Search for a user..."
                  @input="searchUsers"
                />
              </div>
              
              <div v-if="searchingUsers" class="loading-state">
                <MkLoading />
                <span>Searching users...</span>
              </div>
              
              <div v-else-if="foundUsers.length > 0" class="user-results">
                <div 
                  v-for="user in foundUsers" 
                  :key="user.id"
                  class="user-item"
                  @click="startDirectChat(user)"
                >
                  <MkAvatar :user="user" :show-indicator="true" class="avatar" />
                  <div class="user-info">
                    <div class="name">{{ user.name || user.username }}</div>
                    <div class="username">@{{ user.username }}</div>
                  </div>
                  <div class="user-actions">
                    <i class="ph-arrow-right-bold"></i>
                  </div>
                </div>
              </div>
              
              <div v-else-if="userSearchQuery && !searchingUsers" class="empty-state">
                <i class="ph-magnifying-glass-bold"></i>
                <h4>No users found</h4>
                <p>Try searching with different keywords</p>
              </div>
              
              <div v-else class="empty-state">
                <i class="ph-user-bold"></i>
                <h4>Find someone to chat with</h4>
                <p>Search for users by name or username</p>
              </div>
            </div>

            <div v-else class="group-selection">
              <div v-if="loadingGroups" class="loading-state">
                <MkLoading />
                <span>Loading groups...</span>
              </div>
              
              <div v-else-if="availableGroups.length > 0" class="group-list">
                <div 
                  v-for="group in availableGroups" 
                  :key="group.id"
                  class="group-item"
                  @click="startGroupChat(group)"
                >
                  <div class="group-avatar">
                    <i class="ph-users-three-bold"></i>
                  </div>
                  <div class="group-info">
                    <div class="name">{{ group.name }}</div>
                    <div class="members">{{ group.memberCount || 0 }} members</div>
                  </div>
                  <div class="group-actions">
                    <i class="ph-arrow-right-bold"></i>
                  </div>
                </div>
              </div>
              
              <div v-else class="empty-state">
                <i class="ph-users-three-bold"></i>
                <h4>No groups available</h4>
                <p>You need to create or join a group first</p>
                <button class="create-group-btn" @click="createGroup">
                  <i class="ph-plus-bold"></i>
                  Create Group
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>


  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useRouter } from '@/router';
import * as os from '@/os';
import { stream } from '@/stream';
import { $i } from '@/account';
import { i18n } from '@/i18n';
import { definePageMetadata } from '@/scripts/page-metadata';
import { deviceKind } from '@/scripts/device-kind';
import ModernChatList from '@/components/messaging/ModernChatList.vue';
import ModernChatView from '@/components/messaging/ModernChatView.vue';
import * as Acct from 'calckey-js/built/acct';

const router = useRouter();

// Reactive state
const loadingChats = ref(false);
const chats = ref<any[]>([]);
const typingUsersByChat = ref<Record<string, any[]>>({});
const showNewChat = ref(false);
const newChatType = ref<'direct' | 'group'>('direct');
const userSearchQuery = ref('');
const foundUsers = ref<any[]>([]);
const searchingUsers = ref(false);
const availableGroups = ref<any[]>([]);
const loadingGroups = ref(false);

// Connections
let connection: any = null;
let messagingConnection: any = null;

// Computed
const isMobile = computed(() => deviceKind === 'smartphone');

async function loadChats() {
  loadingChats.value = true;
  try {
    // Load direct messages
    const directMessages = await os.api('messaging/history', {
      group: false,
      limit: 50
    });
    
    // Load group messages  
    const groupMessages = await os.api('messaging/history', {
      group: true,
      limit: 50
    });

    // Transform and combine data
    const transformedDirects = directMessages.map((msg: any) => {
      // Determine the other participant (not the current user)
      const isCurrentUserSender = msg.userId === $i?.id;
      const otherParticipant = isCurrentUserSender ? msg.recipient : msg.user;
      const otherParticipantId = isCurrentUserSender ? msg.recipientId : msg.userId;
      
      // For unread count: if current user sent the message, check if recipient read it
      // If other user sent the message, check if current user read it
      let unreadCount = 0;
      if (isCurrentUserSender) {
        // Message sent by current user - unread if recipient hasn't read it
        unreadCount = msg.isRead ? 0 : 0; // Don't show unread for own messages in chat list
      } else {
        // Message sent by other user - unread if current user hasn't read it
        unreadCount = msg.isRead ? 0 : 1;
      }
      
      return {
        id: `direct-${otherParticipantId}`,
        type: 'direct',
        participant: otherParticipant,
        lastMessage: msg,
        lastMessageAt: msg.createdAt,
        unreadCount,
        isOnline: otherParticipant?.onlineStatus === 'online',
        isPinned: false, // TODO: Implement pinning
        isMuted: false  // TODO: Implement muting
      };
    });

    const transformedGroups = groupMessages.map((msg: any) => ({
      id: `group-${msg.groupId}`,
      type: 'group',
      name: msg.group?.name || 'Unknown Group',
      lastMessage: msg,
      lastMessageAt: msg.createdAt,
      unreadCount: msg.reads?.includes($i?.id) ? 0 : 1,
      memberCount: msg.group?.memberCount || 0,
      isPinned: false, // TODO: Implement pinning
      isMuted: false  // TODO: Implement muting
    }));

    chats.value = [...transformedDirects, ...transformedGroups];
  } catch (error) {
    console.error('Failed to load chats:', error);
    os.alert({
      type: 'error',
      text: 'Failed to load conversations'
    });
  } finally {
    loadingChats.value = false;
  }
}

async function selectChat(chat: any) {
  // Navigate to the specific chat route instead of just setting state
  if (chat.type === 'direct') {
    const userAcct = Acct.toString(chat.participant);
    router.push(`/my/messaging/${userAcct}`);
  } else if (chat.type === 'group') {
    const groupId = chat.id.replace('group-', '');
    router.push(`/my/messaging/group/${groupId}`);
  }
}

// New methods for enhanced features
function pinChat(chat: any) {
  const chatIndex = chats.value.findIndex(c => c.id === chat.id);
  if (chatIndex !== -1) {
    chats.value[chatIndex].isPinned = !chats.value[chatIndex].isPinned;
    // TODO: Persist to backend
  }
}

function muteChat(chat: any) {
  const chatIndex = chats.value.findIndex(c => c.id === chat.id);
  if (chatIndex !== -1) {
    chats.value[chatIndex].isMuted = !chats.value[chatIndex].isMuted;
    // TODO: Persist to backend
  }
}

// New chat dialog
function showNewChatDialog() {
  showNewChat.value = true;
  if (newChatType.value === 'group') {
    loadAvailableGroups();
  }
}

function closeNewChatDialog() {
  showNewChat.value = false;
  newChatType.value = 'direct';
  userSearchQuery.value = '';
  foundUsers.value = [];
}

let searchTimeout: any = null;
function searchUsers() {
  if (searchTimeout) clearTimeout(searchTimeout);
  
  if (!userSearchQuery.value.trim()) {
    foundUsers.value = [];
    return;
  }
  
  searchTimeout = setTimeout(async () => {
    searchingUsers.value = true;
    try {
      const response = await os.api('users/search', {
        query: userSearchQuery.value,
        limit: 10
      });
      foundUsers.value = Array.isArray(response) ? response : [];
    } catch (error) {
      console.error('Failed to search users:', error);
      foundUsers.value = [];
    } finally {
      searchingUsers.value = false;
    }
  }, 300);
}

async function startDirectChat(user: any) {
  closeNewChatDialog();
  
  // Check if chat already exists
  const existingChat = chats.value.find(c => 
    c.type === 'direct' && c.participant.id === user.id
  );
  
  if (existingChat) {
    selectChat(existingChat);
  } else {
    // Create new chat
    const newChat = {
      id: `direct-${user.id}`,
      type: 'direct',
      participant: user,
      lastMessage: null,
      lastMessageAt: new Date().toISOString(),
      unreadCount: 0,
      isOnline: user.onlineStatus === 'online'
    };
    
    chats.value.unshift(newChat);
    selectChat(newChat);
  }
}

async function loadAvailableGroups() {
  loadingGroups.value = true;
  try {
    const [ownedGroups, joinedGroups] = await Promise.all([
      os.api('users/groups/owned').catch(() => []),
      os.api('users/groups/joined').catch(() => [])
    ]);
    
    const owned = Array.isArray(ownedGroups) ? ownedGroups : [];
    const joined = Array.isArray(joinedGroups) ? joinedGroups : [];
    availableGroups.value = [...owned, ...joined];
  } catch (error) {
    console.error('Failed to load groups:', error);
    availableGroups.value = [];
  } finally {
    loadingGroups.value = false;
  }
}

async function startGroupChat(group: any) {
  closeNewChatDialog();
  
  // Check if chat already exists
  const existingChat = chats.value.find(c => 
    c.type === 'group' && c.id === `group-${group.id}`
  );
  
  if (existingChat) {
    selectChat(existingChat);
  } else {
    // Create new chat
    const newChat = {
      id: `group-${group.id}`,
      type: 'group',
      name: group.name,
      lastMessage: null,
      lastMessageAt: new Date().toISOString(),
      unreadCount: 0,
      memberCount: group.memberCount || 0
    };
    
    chats.value.unshift(newChat);
    selectChat(newChat);
  }
}

function createGroup() {
  router.push('/my/groups');
}

// Global connection for general messaging events
function connectToMessaging() {
  connection = stream.useChannel('main');
  connection.on('readAllMessagingMessages', () => {
    // Mark all chats as read
    chats.value.forEach(chat => {
      chat.unreadCount = 0;
    });
  });
  
  connection.on('unreadMessagingMessage', () => {
    // Refresh chats to get updated unread counts
    loadChats();
  });
}

// Lifecycle
onMounted(async () => {
  await loadChats();
  connectToMessaging();
});

onUnmounted(() => {
  if (connection) connection.dispose();
  if (messagingConnection) messagingConnection.dispose();
});

definePageMetadata({
  title: i18n.ts.messaging,
  icon: 'ph-chats-teardrop-bold'
});
</script>

<style lang="scss" scoped>
.modern-messaging-app {
  height: 100vh;
  height: 100dvh; // Use dynamic viewport height for mobile
  display: flex;
  flex-direction: column;
  background: var(--bg);
  overflow: hidden;

  .messaging-layout {
    flex: 1;
    display: flex;
    overflow: hidden;
    position: relative;

    .chat-list-sidebar {
      width: 380px;
      flex-shrink: 0;
      border-right: 1px solid var(--divider);
      background: var(--panel);
      display: flex;
      flex-direction: column;
    }

    .chat-view-main {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
    }

    // Mobile layout transitions
    &.mobile-chat-open {
      .chat-list-sidebar.mobile-hidden {
        transform: translateX(-100%);
        opacity: 0;
        pointer-events: none;
      }
      
      .chat-view-main {
        width: 100%;
      }
    }

    .mobile-hidden {
      @media (max-width: 768px) {
        display: none;
      }
    }
  }

  // New chat dialog
  .new-chat-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;

    .new-chat-dialog {
      background: var(--panel);
      border-radius: 20px;
      width: 100%;
      max-width: 500px;
      max-height: 85vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);

      .dialog-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1.5rem;
        border-bottom: 1px solid var(--divider);
        background: var(--panel);

        h3 {
          margin: 0;
          font-size: 1.375rem;
          font-weight: 700;
          color: var(--fg);
          letter-spacing: -0.01em;
        }

        .close-btn {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: var(--buttonBg);
          border: none;
          color: var(--fgTransparentWeak);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

          &:hover {
            background: var(--buttonHoverBg);
            color: var(--fg);
            transform: scale(1.05);
          }

          i {
            font-size: 1.1rem;
          }
        }
      }

      .dialog-content {
        flex: 1;
        overflow-y: auto;
        min-height: 0;

        .chat-type-tabs {
          display: flex;
          border-bottom: 1px solid var(--divider);
          background: var(--panel);

          .tab {
            flex: 1;
            padding: 1.25rem 1rem;
            border: none;
            background: transparent;
            color: var(--fgTransparentWeak);
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.75rem;
            position: relative;
            font-weight: 500;

            &.active {
              color: var(--accent);
              background: var(--accentedBg);

              &::after {
                content: '';
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                height: 3px;
                background: var(--accent);
                border-radius: 3px 3px 0 0;
              }
            }

            &:hover:not(.active) {
              background: var(--X2);
              color: var(--fg);
            }

            i {
              font-size: 1.2rem;
            }

            span {
              font-size: 0.95rem;
            }
          }
        }

        .user-search,
        .group-selection {
          padding: 1.5rem;

          .search-box {
            position: relative;
            margin-bottom: 1.5rem;

            i {
              position: absolute;
              left: 16px;
              top: 50%;
              transform: translateY(-50%);
              color: var(--fgTransparentWeak);
              font-size: 1.1rem;
              z-index: 1;
            }

            input {
              width: 100%;
              padding: 16px 20px 16px 52px;
              border: 2px solid var(--divider);
              border-radius: 16px;
              background: var(--bg);
              color: var(--fg);
              font-size: 1rem;
              transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);

              &:focus {
                outline: none;
                border-color: var(--accent);
                background: var(--panel);
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
                transform: translateY(-1px);
              }

              &::placeholder {
                color: var(--fgTransparentWeak);
                font-size: 0.95rem;
              }
            }
          }

          .loading-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 3rem 1rem;
            gap: 1rem;
            color: var(--fgTransparentWeak);

            span {
              font-size: 0.9rem;
            }
          }

          .user-results,
          .group-list {
            max-height: 320px;
            overflow-y: auto;
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
            }

            .user-item,
            .group-item {
              display: flex;
              align-items: center;
              gap: 1rem;
              padding: 1rem;
              border-radius: 16px;
              cursor: pointer;
              transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
              border: 1px solid transparent;
              margin-bottom: 0.5rem;

              &:hover {
                background: var(--accentedBg);
                border-color: var(--accent);
                transform: translateY(-2px);
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
              }

              &:active {
                transform: translateY(0);
              }

              .avatar,
              .group-avatar {
                width: 52px;
                height: 52px;
                flex-shrink: 0;
              }

              .group-avatar {
                border-radius: 50%;
                background: linear-gradient(135deg, var(--accent), var(--accentLighten));
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;

                i {
                  font-size: 1.5rem;
                }
              }

              .user-info,
              .group-info {
                flex: 1;
                min-width: 0;

                .name {
                  font-weight: 600;
                  color: var(--fg);
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  font-size: 1rem;
                  margin-bottom: 0.25rem;
                }

                .username,
                .members {
                  font-size: 0.85rem;
                  color: var(--fgTransparentWeak);
                }
              }

              .user-actions,
              .group-actions {
                color: var(--fgTransparentWeak);
                transition: all 0.2s;

                i {
                  font-size: 1rem;
                }
              }

              &:hover {
                .user-actions,
                .group-actions {
                  color: var(--accent);
                  transform: translateX(4px);
                }
              }
            }
          }

          .empty-state {
            text-align: center;
            padding: 3rem 1rem;
            color: var(--fgTransparentWeak);

            i {
              font-size: 3.5rem;
              margin-bottom: 1.5rem;
              opacity: 0.5;
              color: var(--accent);
            }

            h4 {
              margin: 0 0 0.75rem 0;
              color: var(--fg);
              font-size: 1.25rem;
              font-weight: 600;
            }

            p {
              margin: 0 0 2rem 0;
              font-size: 0.95rem;
              line-height: 1.5;
            }

            .create-group-btn {
              padding: 1rem 2rem;
              background: var(--accent);
              color: white;
              border: none;
              border-radius: 16px;
              cursor: pointer;
              transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
              display: inline-flex;
              align-items: center;
              gap: 0.75rem;
              font-weight: 600;

              &:hover {
                background: var(--accentLighten);
                transform: translateY(-2px);
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
              }

              &:active {
                transform: translateY(0);
              }

              i {
                font-size: 1.1rem;
                margin: 0;
              }
            }
          }
        }
      }
    }
  }

  // Loading overlay
  .loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--bg);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;

    .loading-content {
      text-align: center;
      max-width: 300px;

      h3 {
        margin: 1.5rem 0 0.5rem 0;
        font-size: 1.5rem;
        font-weight: 600;
        color: var(--fg);
      }

      p {
        margin: 0;
        color: var(--fgTransparentWeak);
        font-size: 0.95rem;
      }
    }
  }
}

// Transitions
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
  
  .new-chat-dialog {
    transform: scale(0.9) translateY(20px);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

// Mobile responsive design
@media (max-width: 768px) {
  .modern-messaging-app {
    height: 100vh;
    height: 100dvh;

    .messaging-layout {
      .chat-list-sidebar {
        width: 100%;
        border-right: none;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }

      &:not(.mobile-chat-open) {
        .chat-view-main.mobile-hidden {
          display: none;
        }

        .chat-list-sidebar:not(.mobile-hidden) {
          display: flex;
          flex-direction: column;
        }
      }

      &.mobile-chat-open {
        .chat-list-sidebar.mobile-hidden {
          display: none;
        }

        .chat-view-main:not(.mobile-hidden) {
          display: flex;
          flex-direction: column;
          width: 100%;
        }
      }
    }

    .new-chat-overlay {
      padding: 1rem;

      .new-chat-dialog {
        width: 100%;
        max-width: none;
        max-height: 90vh;
        border-radius: 20px;
        margin: 0;

        .dialog-header {
          padding: 1.25rem;

          h3 {
            font-size: 1.25rem;
          }

          .close-btn {
            width: 36px;
            height: 36px;
          }
        }

        .dialog-content {
          .chat-type-tabs {
            .tab {
              padding: 1rem 0.75rem;
              font-size: 0.9rem;
              gap: 0.5rem;

              i {
                font-size: 1.1rem;
              }

              span {
                font-size: 0.85rem;
              }
            }
          }

          .user-search,
          .group-selection {
            padding: 1.25rem;

            .search-box {
              margin-bottom: 1.25rem;

              input {
                padding: 14px 18px 14px 48px;
                font-size: 16px; // Prevent zoom on iOS
                border-radius: 14px;
              }
            }

            .user-results,
            .group-list {
              max-height: 280px;

              .user-item,
              .group-item {
                padding: 0.875rem;
                margin-bottom: 0.375rem;
                border-radius: 14px;

                .avatar,
                .group-avatar {
                  width: 48px;
                  height: 48px;
                }

                .user-info,
                .group-info {
                  .name {
                    font-size: 0.95rem;
                  }

                  .username,
                  .members {
                    font-size: 0.8rem;
                  }
                }
              }
            }

            .empty-state {
              padding: 2.5rem 1rem;

              i {
                font-size: 3rem;
                margin-bottom: 1.25rem;
              }

              h4 {
                font-size: 1.1rem;
                margin-bottom: 0.5rem;
              }

              p {
                font-size: 0.9rem;
                margin-bottom: 1.5rem;
              }

              .create-group-btn {
                padding: 0.875rem 1.5rem;
                font-size: 0.9rem;
                border-radius: 14px;
              }
            }
          }
        }
      }
    }
  }
}

@media (max-width: 480px) {
  .modern-messaging-app {
    .new-chat-overlay {
      padding: 0.5rem;

      .new-chat-dialog {
        .dialog-header {
          padding: 1rem;

          h3 {
            font-size: 1.1rem;
          }
        }

        .dialog-content {
          .chat-type-tabs .tab {
            padding: 0.875rem 0.5rem;
            gap: 0.375rem;

            i {
              font-size: 1rem;
            }

            span {
              font-size: 0.8rem;
            }
          }

          .user-search,
          .group-selection {
            padding: 1rem;

            .search-box input {
              padding: 12px 16px 12px 44px;
              font-size: 16px;
              border-radius: 12px;
            }

            .user-results,
            .group-list {
              .user-item,
              .group-item {
                padding: 0.75rem;

                .avatar,
                .group-avatar {
                  width: 44px;
                  height: 44px;
                }
              }
            }
          }
        }
      }
    }
  }
}

// Dark mode optimizations
@media (prefers-color-scheme: dark) {
  .modern-messaging-app {
    .new-chat-overlay {
      background: rgba(0, 0, 0, 0.8);
    }
  }
}

// High contrast mode support
@media (prefers-contrast: high) {
  .modern-messaging-app {
    .new-chat-dialog {
      border: 2px solid var(--divider);
    }
  }
}

// Reduced motion support
@media (prefers-reduced-motion: reduce) {
  .modern-messaging-app {
    .messaging-layout .chat-list-sidebar,
    .new-chat-overlay .new-chat-dialog,
    .user-item,
    .group-item {
      transition: none;
    }
  }
}
</style>
