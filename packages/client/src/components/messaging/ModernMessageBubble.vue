<template>
  <div 
    ref="messageElement"
    class="modern-message-bubble"
    :class="{ 
      'own-message': isOwn,
      'other-message': !isOwn,
      'has-reactions': message.reactionCounts && Object.keys(message.reactionCounts).length > 0,
      'has-reply': message.reply,
      'long-pressing': isLongPressing
    }"
    @contextmenu="showMessageMenu"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    @touchstart="handleTouchStart"
    @touchend="handleTouchEnd"
    @touchcancel="handleTouchCancel"
  >
    <!-- Reply Preview -->
    <div v-if="message.reply" class="reply-preview">
      <div class="reply-indicator"></div>
      <div class="reply-content">
        <span class="reply-author">{{ getReplyAuthor() }}</span>
        <span class="reply-text">{{ getReplyText() }}</span>
      </div>
    </div>

    <!-- Message Content -->
    <div class="message-content">
      <!-- File Attachment -->
      <div v-if="message.file" class="message-file">
        <MessageFile :file="message.file" />
      </div>

      <!-- Text Content -->
      <div v-if="message.text" class="message-text">
        <span v-html="formatMessage(message.text)"></span>
      </div>

      <!-- Message Meta -->
      <div class="message-meta">
        <span v-if="showTime" class="message-time">
          {{ formatTime(message.createdAt) }}
        </span>
        
        <!-- Read Status for own messages -->
        <div v-if="isOwn && isLastInCluster" class="read-status">
          <i 
            v-if="message.isRead" 
            class="ph-checks-bold read"
            title="Read"
          ></i>
          <i 
            v-else 
            class="ph-check-bold sent"
            title="Sent"
          ></i>
        </div>

        <!-- Edit Indicator -->
        <span v-if="message.isEdited" class="edit-indicator" title="Edited">
          <i class="ph-pencil-simple-bold"></i>
        </span>
      </div>
    </div>

    <!-- Message Reactions -->
    <div v-if="message.reactionCounts && Object.keys(message.reactionCounts).length > 0" class="message-reactions">
      <button
        v-for="reaction in groupedReactions"
        :key="reaction.emoji"
        class="reaction-item"
        :class="{ 'user-reacted': reaction.userReacted }"
        @click="toggleReaction(reaction.emoji)"
        :title="getReactionTooltip(reaction)"
      >
        <span class="reaction-emoji">{{ reaction.emoji }}</span>
        <span class="reaction-count">{{ reaction.count }}</span>
      </button>
      
      <button class="add-reaction" @click="showReactionPicker" title="Add reaction">
        <i class="ph-smiley-bold"></i>
      </button>
    </div>

    <!-- Quick Actions -->
    <div class="quick-actions" :class="{ visible: showQuickActions }">
      <button class="quick-action" @click="handleReply" title="Reply">
        <i class="ph-arrow-bend-up-left-bold"></i>
      </button>
      
      <button 
        class="quick-action" 
        @click="showReactionPicker" 
        title="React"
      >
        <i class="ph-smiley-bold"></i>
      </button>
      
      <button class="quick-action" @click="copyMessage" title="Copy">
        <i class="ph-copy-bold"></i>
      </button>
      
      <button 
        v-if="isOwn" 
        class="quick-action delete" 
        @click="handleDelete" 
        title="Delete"
      >
        <i class="ph-trash-bold"></i>
      </button>
    </div>

    <!-- Reaction Picker -->
    <div v-if="showReactionPickerState" class="reaction-picker-overlay" @click="showReactionPickerState = false">
      <div class="reaction-picker" @click.stop>
        <button
          v-for="emoji in quickReactions"
          :key="emoji"
          class="reaction-option"
          @click="addReaction(emoji)"
        >
          {{ emoji }}
        </button>
        <button class="more-reactions" @click="openFullEmojiPicker">
          <i class="ph-plus-bold"></i>
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import MessageFile from './MessageFile.vue';

interface Message {
  id: string;
  text?: string;
  file?: any;
  userId: string;
  user?: any;
  createdAt: string;
  isRead?: boolean;
  isEdited?: boolean;
  reactions?: Array<{
    emoji: string;
    userId: string;
    user?: any;
  }>;
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

interface Props {
  message: Message;
  isOwn: boolean;
  showTime?: boolean;
  isLastInCluster?: boolean;
}

interface Emits {
  (e: 'delete', id: string): void;
  (e: 'edit', message: Message): void;
  (e: 'reply', message: Message): void;
  (e: 'react', message: Message, emoji: string): void;
}

const props = withDefaults(defineProps<Props>(), {
  showTime: false,
  isLastInCluster: false
});

const emit = defineEmits<Emits>();

// State
const showQuickActions = ref(false);
const showReactionPickerState = ref(false);
const messageElement = ref<HTMLElement>();
const longPressTimer = ref<ReturnType<typeof setTimeout> | null>(null);
const touchStartTime = ref(0);
const isTouchDevice = ref(false);
const isLongPressing = ref(false);

// Quick reactions for picker
const quickReactions = ['👍', '❤️', '😂', '😮', '😢', '😡', '👎', '🎉'];

// Computed
const groupedReactions = computed(() => {
  const reactionCounts = props.message.reactionCounts || {};
  const userReactions = props.message.userReactions || [];
  
  if (Object.keys(reactionCounts).length === 0) return [];
  
  return Object.entries(reactionCounts)
    .filter(([emoji, count]) => count > 0)
    .map(([emoji, count]) => ({
      emoji,
      count,
      userReacted: userReactions.includes(emoji),
      users: [] // We don't have detailed user info in this structure
    }))
    .sort((a, b) => b.count - a.count);
});

// Methods
// Security: HTML escape function to prevent XSS attacks
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatMessage(text: string): string {
  // Security: FIRST escape HTML to prevent XSS attacks (CVE-2021-XXXX pattern)
  let formatted = escapeHtml(text);
  
  // Convert URLs to links (now safe because text is escaped)
  // URL regex - only match http/https URLs with safe characters
  const urlRegex = /(https?:\/\/[^\s<>"']+)/g;
  formatted = formatted.replace(urlRegex, (match) => {
    // Double-check URL safety before creating link
    try {
      const url = new URL(match);
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        // Escape the URL for href attribute
        const safeHref = match.replace(/"/g, '&quot;');
        return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${match}</a>`;
      }
    } catch {
      // Invalid URL, return escaped text
    }
    return match;
  });
  
  // Convert line breaks
  formatted = formatted.replace(/\n/g, '<br>');
  
  return formatted;
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString(undefined, { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
}

function getReplyAuthor(): string {
  return props.message.reply?.user?.name || 
         props.message.reply?.user?.username || 
         'Unknown';
}

function getReplyText(): string {
  if (props.message.reply?.file && !props.message.reply?.text) {
    return `📎 ${props.message.reply.file.name || 'File'}`;
  }
  return props.message.reply?.text || 'Message';
}

function getReactionTooltip(reaction: any): string {
  if (reaction.count === 1) {
    return reaction.userReacted ? 'You reacted' : '1 person reacted';
  }
  
  if (reaction.userReacted) {
    return reaction.count === 2 ? 'You and 1 other' : `You and ${reaction.count - 1} others`;
  }
  
  return `${reaction.count} people reacted`;
}

function showMessageMenu(event: MouseEvent) {
  event.preventDefault();
  
  // Only show on right-click for desktop (non-touch devices)
  if (!isTouchDevice.value) {
    showQuickActions.value = true;
    
    // Hide after a delay if not interacting
    setTimeout(() => {
      if (!showReactionPickerState.value) {
        showQuickActions.value = false;
      }
    }, 3000);
  }
}

function showReactionPicker() {
  showReactionPickerState.value = true;
  showQuickActions.value = false;
}

function addReaction(emoji: string) {
  emit('react', props.message, emoji);
  showReactionPickerState.value = false;
  // Hide quick actions on mobile after reaction
  if (isTouchDevice.value) {
    showQuickActions.value = false;
  }
}

function toggleReaction(emoji: string) {
  emit('react', props.message, emoji);
}

function copyMessage() {
  if (props.message.text) {
    navigator.clipboard?.writeText(props.message.text).catch(console.error);
  }
  showQuickActions.value = false;
  
  // Show feedback on mobile
  if (isTouchDevice.value) {
    // Could add toast notification here
  }
}

function openFullEmojiPicker() {
  // TODO: Implement full emoji picker
  showReactionPickerState.value = false;
}

// Action handlers that hide menu on mobile
function handleReply() {
  emit('reply', props.message);
  if (isTouchDevice.value) {
    showQuickActions.value = false;
  }
}

function handleEdit() {
  emit('edit', props.message);
  if (isTouchDevice.value) {
    showQuickActions.value = false;
  }
}

function handleDelete() {
  emit('delete', props.message.id);
  if (isTouchDevice.value) {
    showQuickActions.value = false;
  }
}

// Mouse events for quick actions
function handleMouseEnter() {
  if (!isTouchDevice.value) {
    showQuickActions.value = true;
  }
}

function handleMouseLeave() {
  if (!isTouchDevice.value && !showReactionPickerState.value) {
    showQuickActions.value = false;
  }
}

// Touch events for mobile long press
function handleTouchStart(event: TouchEvent) {
  isTouchDevice.value = true;
  touchStartTime.value = Date.now();
  isLongPressing.value = false;
  
  // Clear any existing timer
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value);
  }
  
  // Set up long press timer (500ms)
  longPressTimer.value = setTimeout(() => {
    isLongPressing.value = true;
    showQuickActions.value = true;
    // Add haptic feedback if available
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
  }, 500);
}

function handleTouchEnd(event: TouchEvent) {
  // Clear the long press timer
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value);
    longPressTimer.value = null;
  }
  
  const touchDuration = Date.now() - touchStartTime.value;
  
  // If it was a quick tap and menu is showing, hide it
  if (touchDuration < 500 && showQuickActions.value && !showReactionPickerState.value) {
    showQuickActions.value = false;
  }
  
  isLongPressing.value = false;
}

function handleTouchCancel(event: TouchEvent) {
  // Clear the long press timer on cancel
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value);
    longPressTimer.value = null;
  }
  isLongPressing.value = false;
}

onMounted(() => {
  // Detect if this is a touch device
  isTouchDevice.value = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  if (messageElement.value) {
    messageElement.value.addEventListener('mouseenter', handleMouseEnter);
    messageElement.value.addEventListener('mouseleave', handleMouseLeave);
  }
  
  // Add global click/touch listener to hide menu when tapping outside on mobile
  if (isTouchDevice.value) {
    document.addEventListener('touchstart', handleGlobalTouch);
  }
});

onUnmounted(() => {
  // Clear any pending timer
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value);
  }
  
  if (messageElement.value) {
    messageElement.value.removeEventListener('mouseenter', handleMouseEnter);
    messageElement.value.removeEventListener('mouseleave', handleMouseLeave);
  }
  
  // Remove global touch listener
  if (isTouchDevice.value) {
    document.removeEventListener('touchstart', handleGlobalTouch);
  }
});

// Handle global touch to hide menu when tapping outside
function handleGlobalTouch(event: TouchEvent) {
  if (!showQuickActions.value || !messageElement.value) return;
  
  const target = event.target as Node;
  if (!messageElement.value.contains(target)) {
    showQuickActions.value = false;
  }
}
</script>

<style lang="scss" scoped>
.modern-message-bubble {
  position: relative;
  margin-bottom: 2px;
  transition: all 0.2s ease;
  
  &:last-child {
    margin-bottom: 8px;
  }
  
  &:hover {
    .quick-actions {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  &.own-message {
    .message-content {
      background: linear-gradient(135deg, var(--accent) 0%, var(--accentDarken) 100%);
      color: white;
      border-radius: 20px 20px 6px 20px;
      margin-left: auto;
      margin-right: 0;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      border: none;
      
      .message-text {
        a {
          color: rgba(255, 255, 255, 0.9);
          text-decoration: underline;
        }
      }
      
      .message-meta {
        .message-time {
          color: rgba(255, 255, 255, 0.8);
        }
        
        .read-status i {
          &.sent {
            color: rgba(255, 255, 255, 0.8);
          }
          
          &.read {
            color: rgba(255, 255, 255, 0.9);
          }
        }
        
        .edit-indicator {
          color: rgba(255, 255, 255, 0.7);
        }
      }
    }
    
    .reply-preview {
      .reply-content {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        padding: 8px 12px;
        backdrop-filter: blur(10px);
        
        .reply-author {
          color: rgba(255, 255, 255, 0.9);
        }
        
        .reply-text {
          color: rgba(255, 255, 255, 0.7);
        }
      }
    }
    
    .quick-actions {
      right: 0;
      left: auto;
    }
  }
  
  &.other-message {
    .message-content {
      background: var(--panel);
      color: var(--fg);
      border: 1px solid var(--divider);
      border-radius: 20px 20px 20px 6px;
      margin-left: 0;
      margin-right: auto;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
      
      .message-text {
        a {
          color: var(--accent);
        }
      }
      
      .message-meta {
        .message-time {
          color: var(--fgTransparentWeak);
        }
        
        .edit-indicator {
          color: var(--fgTransparentWeak);
        }
      }
    }
    
    .reply-preview {
      .reply-content {
        background: var(--X2);
        border-radius: 12px;
        padding: 8px 12px;
        border-left: 3px solid var(--accent);
        
        .reply-author {
          color: var(--accent);
        }
        
        .reply-text {
          color: var(--fgTransparentWeak);
        }
      }
    }
    
    .quick-actions {
      left: 0;
      right: auto;
    }
  }
}

.reply-preview {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  padding-left: 12px;
  
  .reply-indicator {
    width: 3px;
    height: 100%;
    min-height: 32px;
    background: linear-gradient(135deg, var(--accent) 0%, var(--accentLighten) 100%);
    border-radius: 2px;
    flex-shrink: 0;
    margin-top: 2px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }
  
  .reply-content {
    flex: 1;
    min-width: 0;
    border-radius: 8px;
    transition: all 0.2s ease;
    
    &:hover {
      transform: translateY(-1px);
    }
    
    .reply-author {
      display: block;
      font-size: 0.8rem;
      font-weight: 600;
      margin-bottom: 0.125rem;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    
    .reply-text {
      display: block;
      font-size: 0.85rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.3;
    }
  }
}

.message-content {
  position: relative;
  max-width: 400px;
  padding: 12px 16px;
  word-wrap: break-word;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  
  .message-file {
    margin-bottom: 0.5rem;
    
    &:last-child {
      margin-bottom: 0;
    }
  }
  
  .message-text {
    line-height: 1.4;
    
    :deep(a) {
      text-decoration: none;
      transition: opacity 0.2s;
      
      &:hover {
        opacity: 0.8;
        text-decoration: underline;
      }
    }
  }
  
  .message-meta {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.375rem;
    margin-top: 0.25rem;
    
    .message-time {
      font-size: 0.75rem;
      font-weight: 500;
      white-space: nowrap;
    }
    
    .read-status i {
      font-size: 0.8rem;
    }
    
    .edit-indicator {
      font-size: 0.7rem;
    }
  }
}

.message-reactions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-top: 0.75rem;
  margin-left: 12px;
  
  .reaction-item {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.375rem 0.625rem;
    background: var(--panel);
    border: 1.5px solid var(--divider);
    border-radius: 16px;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    font-size: 0.8rem;
    position: relative;
    overflow: hidden;
    
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(135deg, var(--accent) 0%, var(--accentLighten) 100%);
      opacity: 0;
      transition: opacity 0.2s ease;
    }
    
    &:hover {
      background: var(--X2);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      border-color: var(--accent);
      
      &::before {
        opacity: 0.1;
      }
    }
    
    &.user-reacted {
      background: var(--accentedBg);
      border-color: var(--accent);
      color: var(--accent);
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      
      &::before {
        opacity: 0.15;
      }
      
      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
      }
    }
    
    .reaction-emoji {
      font-size: 1rem;
      z-index: 1;
      position: relative;
    }
    
    .reaction-count {
      font-weight: 600;
      font-size: 0.75rem;
      z-index: 1;
      position: relative;
    }
  }
  
  .add-reaction {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: var(--panel);
    border: 1.5px solid var(--divider);
    border-radius: 50%;
    cursor: pointer;
    color: var(--fgTransparentWeak);
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
    
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(135deg, var(--accent) 0%, var(--accentLighten) 100%);
      opacity: 0;
      transition: opacity 0.2s ease;
    }
    
    &:hover {
      background: var(--X2);
      color: var(--accent);
      transform: translateY(-2px) scale(1.05);
      border-color: var(--accent);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      
      &::before {
        opacity: 0.1;
      }
    }
    
    i {
      font-size: 0.875rem;
      z-index: 1;
      position: relative;
    }
  }
}

.quick-actions {
  position: absolute;
  top: -18px;
  background: var(--panel);
  border: 1px solid var(--divider);
  border-radius: 22px;
  padding: 0.375rem;
  display: flex;
  gap: 0.25rem;
  opacity: 0;
  transform: translateY(6px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 10;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  backdrop-filter: blur(12px);
  
  &.visible {
    opacity: 1;
    transform: translateY(0);
  }
  
  .quick-action {
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--fgTransparentWeak);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
    
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(135deg, var(--accent) 0%, var(--accentLighten) 100%);
      opacity: 0;
      transition: opacity 0.2s ease;
    }
    
    &:hover {
      background: var(--X2);
      color: var(--accent);
      transform: translateY(-2px) scale(1.1);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      
      &::before {
        opacity: 0.1;
      }
    }
    
    &.delete {
      &::before {
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      }
      
      &:hover {
        background: #fef2f2;
        color: #dc2626;
        
        &::before {
          opacity: 0.1;
        }
      }
    }
    
    i {
      font-size: 1rem;
      z-index: 1;
      position: relative;
    }
  }
}

.reaction-picker-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(4px);
  
  .reaction-picker {
    background: var(--panel);
    border: 1px solid var(--divider);
    border-radius: 24px;
    padding: 1rem;
    display: flex;
    gap: 0.75rem;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15);
    backdrop-filter: blur(20px);
    transform: scale(0.9);
    animation: popIn 0.2s ease forwards;
    
    .reaction-option {
      width: 48px;
      height: 48px;
      border: none;
      border-radius: 50%;
      background: transparent;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: hidden;
      
      &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(135deg, var(--accent) 0%, var(--accentLighten) 100%);
        opacity: 0;
        transition: opacity 0.2s ease;
      }
      
      &:hover {
        background: var(--X2);
        transform: scale(1.2);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
        
        &::before {
          opacity: 0.1;
        }
      }
    }
    
    .more-reactions {
      width: 48px;
      height: 48px;
      border: none;
      border-radius: 50%;
      background: var(--X2);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--fgTransparentWeak);
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: hidden;
      
      &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(135deg, var(--accent) 0%, var(--accentLighten) 100%);
        opacity: 0;
        transition: opacity 0.2s ease;
      }
      
      &:hover {
        background: var(--X3);
        color: var(--accent);
        transform: scale(1.2);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
        
        &::before {
          opacity: 0.1;
        }
      }
      
      i {
        font-size: 1.1rem;
        z-index: 1;
        position: relative;
      }
    }
  }
}

@keyframes popIn {
  to {
    transform: scale(1);
  }
}

// Mobile specific styles
@media (max-width: 768px) {
  .modern-message-bubble {
    .message-content {
      max-width: 280px;
      padding: 10px 14px;
      user-select: none; // Prevent text selection during long press
      -webkit-user-select: none;
    }
    
    .quick-actions {
      .quick-action {
        width: 36px;
        height: 36px;
        min-width: 44px; // Better touch targets
        min-height: 44px;
        
        i {
          font-size: 1rem;
        }
      }
    }
    
    .reaction-picker-overlay .reaction-picker {
      .reaction-option,
      .more-reactions {
        width: 40px;
        height: 40px;
        min-width: 44px;
        min-height: 44px;
        font-size: 1.2rem;
      }
    }
    
    // Add visual feedback for touch interactions
    .message-content {
      transition: transform 0.1s ease, background-color 0.1s ease;
    }
  }
}

// Touch device improvements
@media (hover: none) {
  .modern-message-bubble {
    // Remove always-visible quick actions on touch devices
    .quick-actions {
      opacity: 0;
      transform: translateY(4px);
      
      &.visible {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    // Add visual feedback for long press
    &.long-pressing {
      .message-content {
        transform: scale(0.98);
        background-color: var(--X2);
        transition: transform 0.1s ease, background-color 0.1s ease;
      }
    }
    
    // Regular touch feedback
    &:active:not(.long-pressing) {
      .message-content {
        transform: scale(0.99);
        transition: transform 0.05s ease;
      }
    }
    
    // Improve touch targets
    .quick-actions .quick-action {
      min-width: 44px;
      min-height: 44px;
      touch-action: manipulation;
    }
    
    // Better spacing for touch
    .reaction-picker-overlay .reaction-picker {
      .reaction-option,
      .more-reactions {
        min-width: 44px;
        min-height: 44px;
        touch-action: manipulation;
      }
    }
  }
}
</style>
