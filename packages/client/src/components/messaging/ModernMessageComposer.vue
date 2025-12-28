<template>
  <div class="modern-message-composer" :class="{ disabled }">
    <!-- Reply Preview -->
    <Transition name="reply-slide">
      <div v-if="replyTo" class="reply-preview">
        <div class="reply-content">
          <div class="reply-header">
            <i class="ph-arrow-bend-up-left-bold"></i>
            <span class="reply-label">Replying to {{ getReplyAuthor() }}</span>
            <button class="cancel-reply" @click="$emit('cancel-reply')">
              <i class="ph-x-bold"></i>
            </button>
          </div>
          <div class="reply-message">
            {{ getReplyText() }}
          </div>
        </div>
      </div>
    </Transition>

    <!-- Edit Preview -->
    <Transition name="edit-slide">
      <div v-if="editing" class="edit-preview">
        <div class="edit-content">
          <div class="edit-header">
            <i class="ph-pencil-simple-bold"></i>
            <span class="edit-label">Edit message</span>
            <button class="cancel-edit" @click="$emit('cancel-edit')">
              <i class="ph-x-bold"></i>
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- File Upload Progress -->
    <Transition name="upload-slide">
      <div v-if="uploadingFiles.length > 0" class="upload-progress">
        <div 
          v-for="upload in uploadingFiles" 
          :key="upload.id"
          class="upload-item"
        >
          <div class="upload-info">
            <i class="ph-file-bold"></i>
            <span class="upload-name">{{ upload.name }}</span>
          </div>
          <div class="upload-progress-bar">
            <div 
              class="upload-progress-fill"
              :style="{ width: upload.progress + '%' }"
            ></div>
          </div>
          <button class="cancel-upload" @click="cancelUpload(upload.id)">
            <i class="ph-x-bold"></i>
          </button>
        </div>
      </div>
    </Transition>

    <!-- Composer Input Area -->
    <div class="composer-input">
      <!-- File Attachments Preview -->
      <div v-if="attachedFiles.length > 0" class="attachments-preview">
        <div 
          v-for="file in attachedFiles" 
          :key="file.id"
          class="attachment-item"
        >
          <div class="attachment-preview">
            <img 
              v-if="isImageFile(file)" 
              :src="file.thumbnailUrl || file.url" 
              :alt="file.name"
              class="attachment-thumbnail"
            />
            <div v-else class="attachment-file">
              <i class="ph-file-bold"></i>
              <span class="file-name">{{ file.name }}</span>
            </div>
          </div>
          <button class="remove-attachment" @click="removeAttachment(file.id)">
            <i class="ph-x-bold"></i>
          </button>
        </div>
      </div>

      <!-- Input Container -->
      <div class="input-container">
        <!-- Emoji Button -->
        <button 
          class="composer-btn emoji-btn"
          @click="toggleEmojiPicker"
          title="Add emoji"
        >
          <i class="ph-smiley-bold"></i>
        </button>

        <!-- Text Input -->
        <div class="input-wrapper">
          <textarea
            ref="textInput"
            v-model="inputText"
            :placeholder="getPlaceholder()"
            :disabled="disabled"
            class="message-input"
            :rows="inputRows"
            @input="onInput"
            @keydown="onKeyDown"
            @paste="onPaste"
            @focus="onFocus"
            @blur="onBlur"
          ></textarea>
          
          <!-- Input Overlay for mentions, etc. -->
          <div v-if="showMentions" class="input-overlay mentions-popup">
            <div class="mentions-list">
              <div 
                v-for="(user, index) in mentionSuggestions" 
                :key="user.id"
                class="mention-item"
                :class="{ active: mentionSelectedIndex === index }"
                @click="selectMention(user)"
              >
                <MkAvatar :user="user" class="mention-avatar" />
                <div class="mention-info">
                  <span class="mention-name">{{ user.name || user.username }}</span>
                  <span class="mention-username">@{{ user.username }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- File Upload Button -->
        <button 
          class="composer-btn file-btn"
          @click="triggerFileUpload"
          :disabled="disabled"
          title="Attach file"
        >
          <i class="ph-paperclip-bold"></i>
        </button>

        <!-- Send Button -->
        <button 
          class="composer-btn send-btn"
          :class="{ 
            'can-send': canSend,
            'sending': isSending 
          }"
          @click="sendMessage"
          :disabled="!canSend || isSending"
          title="Send message"
        >
          <MkLoading v-if="isSending" :em="1" />
          <i v-else class="ph-paper-plane-right-bold"></i>
        </button>
      </div>
    </div>

    <!-- Typing Indicator Trigger -->
    <div class="typing-trigger" style="display: none;">{{ typingTrigger }}</div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { $i } from '@/account';
import { i18n } from '@/i18n';
import * as os from '@/os';
import { selectFiles } from '@/scripts/select-file';

interface FileUpload {
  id: string;
  name: string;
  progress: number;
}

interface AttachedFile {
  id: string;
  name: string;
  url: string;
  thumbnailUrl?: string;
  type: string;
  size: number;
}

interface User {
  id: string;
  username: string;
  name?: string;
  avatarUrl?: string;
}

interface Props {
  disabled?: boolean;
  replyTo?: any;
  editing?: any;
}

interface Emits {
  (e: 'send', data: { text?: string; file?: any; replyTo?: string }): void;
  (e: 'edit', messageId: string, text: string): void;
  (e: 'typing'): void;
  (e: 'cancel-reply'): void;
  (e: 'cancel-edit'): void;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false
});

const emit = defineEmits<Emits>();

// Refs
const textInput = ref<HTMLTextAreaElement>();
const fileInput = ref<HTMLInputElement>();

// State
const inputText = ref('');
const isSending = ref(false);
const attachedFiles = ref<AttachedFile[]>([]);
const uploadingFiles = ref<FileUpload[]>([]);
const showEmojiPicker = ref(false);
const activeEmojiCategory = ref('recent');
const showMentions = ref(false);
const mentionQuery = ref('');
const mentionSuggestions = ref<User[]>([]);
const mentionSelectedIndex = ref(0);
const typingTrigger = ref(0);
const lastTypingTime = ref(0);

// Emoji categories and data
const emojiCategories = [
  { key: 'recent', name: 'Recently Used', icon: 'ph-clock-bold' },
  { key: 'people', name: 'Smileys & People', icon: 'ph-smiley-bold' },
  { key: 'nature', name: 'Animals & Nature', icon: 'ph-leaf-bold' },
  { key: 'food', name: 'Food & Drink', icon: 'ph-coffee-bold' },
  { key: 'activity', name: 'Activity', icon: 'ph-football-bold' },
  { key: 'travel', name: 'Travel & Places', icon: 'ph-airplane-bold' },
  { key: 'objects', name: 'Objects', icon: 'ph-lightbulb-bold' },
  { key: 'symbols', name: 'Symbols', icon: 'ph-heart-bold' },
  { key: 'flags', name: 'Flags', icon: 'ph-flag-bold' }
];

const emojiSets = {
  recent: ['😀', '😂', '😍', '👍', '❤️', '😊', '😢', '😮'],
  people: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰'],
  nature: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔'],
  food: ['🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆'],
  activity: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍'],
  travel: ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🏍️', '🛵'],
  objects: ['⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️', '🗜️', '💽', '💾', '💿', '📀', '📼'],
  symbols: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖'],
  flags: ['🏁', '🚩', '🎌', '🏴', '🏳️', '🏳️‍🌈', '🏳️‍⚧️', '🏴‍☠️', '🇦🇫', '🇦🇽', '🇦🇱', '🇩🇿', '🇦🇸', '🇦🇩', '🇦🇴', '🇦🇮']
};

// Computed
const inputRows = computed(() => {
  const lines = inputText.value.split('\n').length;
  return Math.min(Math.max(lines, 1), 5);
});

const canSend = computed(() => {
  return (inputText.value.trim() || attachedFiles.value.length > 0) && !props.disabled;
});

const currentEmojis = computed(() => {
  return emojiSets[activeEmojiCategory.value as keyof typeof emojiSets] || emojiSets.recent;
});

// Methods
function getPlaceholder(): string {
  if (props.editing) return i18n.ts.edit || 'Edit your message...';
  if (props.replyTo) return i18n.ts.reply || 'Reply to message...';
  return i18n.ts.inputMessageHere || 'Type a message...';
}

function getReplyAuthor(): string {
  return props.replyTo?.user?.name || props.replyTo?.user?.username || 'someone';
}

function getReplyText(): string {
  if (props.replyTo?.file && !props.replyTo?.text) {
    return `📎 ${props.replyTo.file.name || 'File'}`;
  }
  return props.replyTo?.text || 'Message';
}

function onInput() {
  adjustTextareaHeight();
  handleMentions();
  handleTyping();
}

function adjustTextareaHeight() {
  nextTick(() => {
    if (textInput.value) {
      textInput.value.style.height = 'auto';
      textInput.value.style.height = textInput.value.scrollHeight + 'px';
    }
  });
}

function handleMentions() {
  const text = inputText.value;
  const cursorPos = textInput.value?.selectionStart || 0;
  const textBeforeCursor = text.substring(0, cursorPos);
  const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
  
  if (mentionMatch) {
    mentionQuery.value = mentionMatch[1];
    showMentions.value = true;
    searchMentions(mentionQuery.value);
  } else {
    showMentions.value = false;
  }
}

async function searchMentions(query: string) {
  if (!query.trim()) {
    mentionSuggestions.value = [];
    return;
  }
  
  try {
    const users = await os.api('users/search', {
      query,
      limit: 5
    });
    mentionSuggestions.value = Array.isArray(users) ? users : [];
    mentionSelectedIndex.value = 0;
  } catch (error) {
    console.error('Failed to search users for mentions:', error);
    mentionSuggestions.value = [];
  }
}

function selectMention(user: User) {
  const text = inputText.value;
  const cursorPos = textInput.value?.selectionStart || 0;
  const textBeforeCursor = text.substring(0, cursorPos);
  const textAfterCursor = text.substring(cursorPos);
  
  const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
  if (mentionMatch) {
    const beforeMention = textBeforeCursor.substring(0, mentionMatch.index);
    inputText.value = beforeMention + `@${user.username} ` + textAfterCursor;
    
    nextTick(() => {
      const newCursorPos = beforeMention.length + user.username.length + 2;
      textInput.value?.setSelectionRange(newCursorPos, newCursorPos);
      textInput.value?.focus();
    });
  }
  
  showMentions.value = false;
}

function handleTyping() {
  const now = Date.now();
  if (now - lastTypingTime.value > 1000) {
    emit('typing');
    lastTypingTime.value = now;
  }
  
  typingTrigger.value++;
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    if (event.shiftKey) {
      // Allow new line
      return;
    } else {
      // Send message
      event.preventDefault();
      if (canSend.value) {
        sendMessage();
      }
    }
  }
  
  if (showMentions.value) {
    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
        mentionSelectedIndex.value = Math.max(0, mentionSelectedIndex.value - 1);
        break;
      case 'ArrowDown':
        event.preventDefault();
        mentionSelectedIndex.value = Math.min(
          mentionSuggestions.value.length - 1,
          mentionSelectedIndex.value + 1
        );
        break;
      case 'Enter':
      case 'Tab':
        event.preventDefault();
        if (mentionSuggestions.value[mentionSelectedIndex.value]) {
          selectMention(mentionSuggestions.value[mentionSelectedIndex.value]);
        }
        break;
      case 'Escape':
        showMentions.value = false;
        break;
    }
  }
  
  if (event.key === 'Escape') {
    if (props.replyTo) {
      emit('cancel-reply');
    } else if (props.editing) {
      emit('cancel-edit');
    }
  }
}

async function onPaste(event: ClipboardEvent) {
  const items = event.clipboardData?.items;
  if (!items) return;
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.type.startsWith('image/')) {
      event.preventDefault();
      const file = item.getAsFile();
      if (file) {
        await uploadFile(file);
      }
    }
  }
}

function onFocus() {
  // Hide emoji picker when focusing on input
  if (showEmojiPicker.value) {
    showEmojiPicker.value = false;
  }
}

function onBlur() {
  // Hide mentions popup when losing focus (with delay for clicks)
  setTimeout(() => {
    showMentions.value = false;
  }, 150);
}

async function sendMessage() {
  if (!canSend.value || isSending.value) return;
  
  isSending.value = true;
  
  try {
    if (props.editing) {
      // Handle editing existing message
      if (inputText.value.trim()) {
        emit('edit', props.editing.id, inputText.value.trim());
      }
    } else {
      // Handle sending new message
      const messageData: any = {};
      
      if (inputText.value.trim()) {
        messageData.text = inputText.value.trim();
      }
      
      if (attachedFiles.value.length > 0) {
        messageData.file = attachedFiles.value[0]; // For now, send first file
      }
      
      if (props.replyTo) {
        messageData.replyTo = props.replyTo.id;
      }
      
      emit('send', messageData);
    }
    
    // Clear input
    inputText.value = '';
    attachedFiles.value = [];
    adjustTextareaHeight();
    
  } catch (error) {
    console.error('Failed to send message:', error);
  } finally {
    isSending.value = false;
  }
}

function triggerFileUpload(event: MouseEvent) {
  selectFiles(event.currentTarget ?? event.target, 'Attach file').then(files => {
    for (const file of files) {
      attachedFiles.value.push({
        id: file.id,
        name: file.name,
        url: file.url,
        thumbnailUrl: file.thumbnailUrl,
        type: file.type,
        size: file.size
      });
    }
  });
}

async function onFileSelect(event: Event) {
  const files = (event.target as HTMLInputElement).files;
  if (!files) return;
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    await uploadFile(file);
  }
  
  // Reset input
  if (fileInput.value) {
    fileInput.value.value = '';
  }
}

async function uploadFile(file: File) {
  const uploadId = Math.random().toString(36).substring(7);
  
  // Add to uploading list
  uploadingFiles.value.push({
    id: uploadId,
    name: file.name,
    progress: 0
  });
  
  try {
    // Simulate upload progress (replace with actual upload)
    const upload = uploadingFiles.value.find(u => u.id === uploadId);
    if (upload) {
      const interval = setInterval(() => {
        upload.progress += 10;
        if (upload.progress >= 100) {
          clearInterval(interval);
        }
      }, 100);
    }
    
    // TODO: Implement actual file upload to your API
    const uploadedFile = await simulateFileUpload(file);
    
    // Remove from uploading and add to attached
    uploadingFiles.value = uploadingFiles.value.filter(u => u.id !== uploadId);
    attachedFiles.value.push(uploadedFile);
    
  } catch (error) {
    console.error('Failed to upload file:', error);
    uploadingFiles.value = uploadingFiles.value.filter(u => u.id !== uploadId);
    
    os.alert({
      type: 'error',
      text: 'Failed to upload file'
    });
  }
}

async function simulateFileUpload(file: File): Promise<AttachedFile> {
  // This is a placeholder - implement actual upload logic
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        id: Math.random().toString(36).substring(7),
        name: file.name,
        url: URL.createObjectURL(file),
        type: file.type,
        size: file.size
      });
    }, 1000);
  });
}

function cancelUpload(uploadId: string) {
  uploadingFiles.value = uploadingFiles.value.filter(u => u.id !== uploadId);
}

function removeAttachment(fileId: string) {
  attachedFiles.value = attachedFiles.value.filter(f => f.id !== fileId);
}

function isImageFile(file: AttachedFile): boolean {
  return file.type.startsWith('image/');
}

function toggleEmojiPicker(event: MouseEvent) {
  os.openEmojiPicker(event.currentTarget as HTMLElement ?? event.target as HTMLElement, {}, textInput.value || null);
}

function setEmojiCategory(category: string) {
  activeEmojiCategory.value = category;
}

function insertEmoji(emoji: string) {
  const cursorPos = textInput.value?.selectionStart || inputText.value.length;
  const textBefore = inputText.value.substring(0, cursorPos);
  const textAfter = inputText.value.substring(cursorPos);
  
  inputText.value = textBefore + emoji + textAfter;
  
  nextTick(() => {
    const newCursorPos = cursorPos + emoji.length;
    textInput.value?.setSelectionRange(newCursorPos, newCursorPos);
    textInput.value?.focus();
  });
  
  showEmojiPicker.value = false;
}

// Watch for editing mode
watch(() => props.editing, (editing) => {
  if (editing?.text) {
    inputText.value = editing.text;
    nextTick(() => {
      adjustTextareaHeight();
      textInput.value?.focus();
    });
  }
});

// Auto-focus on mount
onMounted(() => {
  textInput.value?.focus();
});

// Cleanup
onUnmounted(() => {
  // Revoke object URLs to prevent memory leaks
  attachedFiles.value.forEach(file => {
    if (file.url.startsWith('blob:')) {
      URL.revokeObjectURL(file.url);
    }
  });
});
</script>

<style lang="scss" scoped>
.modern-message-composer {
  background: var(--panel);
  border-top: 1px solid var(--divider);
  position: relative;
  
  &.disabled {
    opacity: 0.6;
    pointer-events: none;
  }
}

.reply-preview,
.edit-preview {
  padding: 1rem 1.5rem 0;
  
  .reply-content,
  .edit-content {
    background: var(--X2);
    border-radius: 12px;
    padding: 0.875rem 1rem;
    border-left: 3px solid var(--accent);
    
    .reply-header,
    .edit-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
      
      i {
        color: var(--accent);
        font-size: 0.9rem;
      }
      
      .reply-label,
      .edit-label {
        font-size: 0.85rem;
        font-weight: 500;
        color: var(--accent);
        flex: 1;
      }
      
      .cancel-reply,
      .cancel-edit {
        width: 24px;
        height: 24px;
        border: none;
        border-radius: 50%;
        background: transparent;
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
    
    .reply-message {
      font-size: 0.85rem;
      color: var(--fgTransparentWeak);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
}

.upload-progress {
  padding: 1rem 1.5rem 0;
  
  .upload-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: var(--X2);
    border-radius: 12px;
    margin-bottom: 0.5rem;
    
    &:last-child {
      margin-bottom: 0;
    }
    
    .upload-info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      
      i {
        color: var(--accent);
        font-size: 1.1rem;
      }
      
      .upload-name {
        font-size: 0.9rem;
        color: var(--fg);
      }
    }
    
    .upload-progress-bar {
      flex: 1;
      height: 4px;
      background: var(--X3);
      border-radius: 2px;
      overflow: hidden;
      
      .upload-progress-fill {
        height: 100%;
        background: var(--accent);
        transition: width 0.3s ease;
      }
    }
    
    .cancel-upload {
      width: 24px;
      height: 24px;
      border: none;
      border-radius: 50%;
      background: transparent;
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
    }
  }
}

.composer-input {
  padding: 1rem 1.5rem;
}

.attachments-preview {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  
  .attachment-item {
    position: relative;
    border-radius: 12px;
    overflow: hidden;
    background: var(--X2);
    
    .attachment-preview {
      .attachment-thumbnail {
        width: 80px;
        height: 80px;
        object-fit: cover;
        display: block;
      }
      
      .attachment-file {
        width: 80px;
        height: 80px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.25rem;
        padding: 0.5rem;
        
        i {
          font-size: 1.5rem;
          color: var(--accent);
        }
        
        .file-name {
          font-size: 0.7rem;
          color: var(--fgTransparentWeak);
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          width: 100%;
        }
      }
    }
    
    .remove-attachment {
      position: absolute;
      top: 4px;
      right: 4px;
      width: 20px;
      height: 20px;
      border: none;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.7);
      color: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      
      &:hover {
        background: rgba(0, 0, 0, 0.9);
      }
      
      i {
        font-size: 0.7rem;
      }
    }
  }
}

.input-container {
  display: flex;
  align-items: flex-end;
  gap: 0.75rem;
  background: var(--bg);
  border: 2px solid var(--divider);
  border-radius: 24px;
  padding: 0.5rem;
  transition: all 0.3s ease;
  
  &:focus-within {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(var(--accent-rgb), 0.1);
  }
  
  .composer-btn {
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
    transition: all 0.2s;
    flex-shrink: 0;
    
    &:hover:not(:disabled) {
      background: var(--X2);
      color: var(--fg);
    }
    
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    &.active {
      background: var(--accent);
      color: white;
    }
    
    &.send-btn {
      &.can-send {
        background: var(--accent);
        color: white;
        
        &:hover {
          background: var(--accentLighten);
        }
      }
      
      &.sending {
        background: var(--accent);
        color: white;
        cursor: not-allowed;
      }
    }
    
    i {
      font-size: 1.1rem;
    }
  }
  
  .input-wrapper {
    flex: 1;
    position: relative;
    
    .message-input {
      width: 100%;
      border: none;
      background: transparent;
      color: var(--fg);
      font-size: 1rem;
      line-height: 1.4;
      resize: none;
      outline: none;
      padding: 0.5rem 0;
      font-family: inherit;
      
      &::placeholder {
        color: var(--fgTransparentWeak);
      }
      
      &:disabled {
        opacity: 0.5;
      }
    }
    
    .input-overlay {
      position: absolute;
      bottom: 100%;
      left: 0;
      right: 0;
      margin-bottom: 0.5rem;
    }
    
    .mentions-popup {
      background: var(--panel);
      border: 1px solid var(--divider);
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
      overflow: hidden;
      
      .mentions-list {
        max-height: 200px;
        overflow-y: auto;
        
        .mention-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem;
          cursor: pointer;
          transition: background 0.2s;
          
          &:hover,
          &.active {
            background: var(--X2);
          }
          
          .mention-avatar {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            flex-shrink: 0;
          }
          
          .mention-info {
            flex: 1;
            min-width: 0;
            
            .mention-name {
              display: block;
              font-weight: 500;
              color: var(--fg);
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            
            .mention-username {
              display: block;
              font-size: 0.85rem;
              color: var(--fgTransparentWeak);
            }
          }
        }
      }
    }
  }
}

.emoji-picker-container {
  position: absolute;
  bottom: 100%;
  left: 1.5rem;
  right: 1.5rem;
  margin-bottom: 0.5rem;
  
  .emoji-picker {
    background: var(--panel);
    border: 1px solid var(--divider);
    border-radius: 16px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15);
    overflow: hidden;
    
    .emoji-categories {
      display: flex;
      border-bottom: 1px solid var(--divider);
      
      .emoji-category {
        flex: 1;
        padding: 0.75rem;
        border: none;
        background: transparent;
        color: var(--fgTransparentWeak);
        cursor: pointer;
        transition: all 0.2s;
        
        &:hover {
          background: var(--X2);
          color: var(--fg);
        }
        
        &.active {
          background: var(--accentedBg);
          color: var(--accent);
        }
        
        i {
          font-size: 1.1rem;
        }
      }
    }
    
    .emoji-grid {
      display: grid;
      grid-template-columns: repeat(8, 1fr);
      gap: 0.25rem;
      padding: 1rem;
      max-height: 200px;
      overflow-y: auto;
      
      .emoji-item {
        width: 36px;
        height: 36px;
        border: none;
        border-radius: 8px;
        background: transparent;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.2rem;
        transition: all 0.2s;
        
        &:hover {
          background: var(--X2);
          transform: scale(1.1);
        }
      }
    }
  }
}

// Transitions
.reply-slide-enter-active,
.reply-slide-leave-active,
.edit-slide-enter-active,
.edit-slide-leave-active,
.upload-slide-enter-active,
.upload-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.reply-slide-enter-from,
.reply-slide-leave-to,
.edit-slide-enter-from,
.edit-slide-leave-to,
.upload-slide-enter-from,
.upload-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.emoji-slide-enter-active,
.emoji-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.emoji-slide-enter-from,
.emoji-slide-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

// Mobile responsive
@media (max-width: 768px) {
  .modern-message-composer {
    .reply-preview,
    .edit-preview,
    .upload-progress,
    .composer-input {
      padding-left: 1rem;
      padding-right: 1rem;
    }
    
    .input-container {
      gap: 0.5rem;
      padding: 0.375rem;
      
      .composer-btn {
        width: 32px;
        height: 32px;
        
        i {
          font-size: 1rem;
        }
      }
      
      .input-wrapper .message-input {
        font-size: 16px; // Prevent zoom on iOS
      }
    }
    
    .emoji-picker-container {
      left: 1rem;
      right: 1rem;
      
      .emoji-picker {
        .emoji-categories .emoji-category {
          padding: 0.625rem 0.5rem;
          
          i {
            font-size: 1rem;
          }
        }
        
        .emoji-grid {
          grid-template-columns: repeat(6, 1fr);
          padding: 0.75rem;
          
          .emoji-item {
            width: 32px;
            height: 32px;
            font-size: 1.1rem;
          }
        }
      }
    }
  }
}

@media (max-width: 480px) {
  .attachments-preview {
    .attachment-item .attachment-preview {
      .attachment-thumbnail,
      .attachment-file {
        width: 60px;
        height: 60px;
      }
    }
  }
  
  .emoji-picker-container .emoji-picker {
    .emoji-grid {
      grid-template-columns: repeat(5, 1fr);
      
      .emoji-item {
        width: 28px;
        height: 28px;
        font-size: 1rem;
      }
    }
  }
}
</style>
