<template>
  <div class="message-composer">
    <div class="composer-container">
      <!-- File Preview -->
      <div v-if="attachedFile" class="file-preview">
        <div class="file-info">
          <div class="file-icon">
            <i v-if="isImageFile(attachedFile)" class="ph-image-bold"></i>
            <i v-else-if="isVideoFile(attachedFile)" class="ph-video-bold"></i>
            <i v-else class="ph-file-bold"></i>
          </div>
          <div class="file-details">
            <span class="file-name">{{ attachedFile.name }}</span>
            <span class="file-size">{{ formatFileSize(attachedFile.size || 0) }}</span>
          </div>
        </div>
        <button class="remove-file" @click="removeFile" title="Remove file">
          <i class="ph-x-bold"></i>
        </button>
      </div>

      <!-- Input Container -->
      <div class="input-container">
        <!-- Attachment Button -->
        <button 
          class="attachment-btn" 
          @click="selectFile"
          title="Attach file"
          :disabled="disabled"
        >
          <i class="ph-paperclip-bold"></i>
        </button>

        <!-- Text Input -->
        <div class="text-input-container">
          <textarea
            ref="textInput"
            v-model="text"
            :placeholder="placeholder"
            :disabled="disabled"
            class="text-input"
            @keydown="onKeyDown"
            @input="onInput"
            @paste="onPaste"
            @compositionstart="isComposing = true"
            @compositionend="isComposing = false"
          ></textarea>
        </div>

        <!-- Emoji Button -->
        <button 
          class="emoji-btn" 
          @click="selectEmoji"
          title="Add emoji"
          :disabled="disabled"
        >
          <i class="ph-smiley-bold"></i>
        </button>

        <!-- GIF Button -->
        <button 
          class="gif-btn" 
          @click="selectGif"
          title="Add GIF"
          :disabled="disabled"
        >
          <i class="ph-gif-bold"></i>
        </button>

        <!-- Send Button -->
        <button 
          class="send-btn" 
          @click="send"
          :disabled="!canSend || disabled"
          title="Send message"
        >
          <i class="ph-paper-plane-right-fill"></i>
        </button>
      </div>
    </div>

    <!-- Hidden File Input -->
    <input
      ref="fileInput"
      type="file"
      style="display: none"
      @change="onFileSelected"
      accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.zip,.rar"
    />
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, nextTick, onMounted } from 'vue';
import * as os from '@/os';
import { uploadFile } from '@/scripts/upload';
import { defaultStore } from '@/store';
import { i18n } from '@/i18n';

const props = defineProps<{
  placeholder?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: 'send', data: { text?: string; file?: any }): void;
  (e: 'typing'): void;
}>();

const textInput = ref<HTMLTextAreaElement>();
const fileInput = ref<HTMLInputElement>();

const text = ref('');
const attachedFile = ref<any>(null);
const isComposing = ref(false);
const uploading = ref(false);

// Computed
const canSend = computed(() => {
  return (text.value.trim().length > 0 || attachedFile.value) && !uploading.value;
});

const hasContent = computed(() => {
  return text.value.length > 0 || attachedFile.value;
});

// Methods
function onInput() {
  if (!isComposing.value) {
    emit('typing');
    autoResize();
  }
}

function onKeyDown(ev: KeyboardEvent) {
  if (!isComposing.value) {
    emit('typing');
  }

  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const sendOnEnter = defaultStore.state.enterSendsMessage;
  
  if (sendOnEnter && !isMobile) {
    if (ev.key === 'Enter' && !ev.shiftKey && !ev.ctrlKey && !ev.metaKey && canSend.value) {
      ev.preventDefault();
      send();
    }
  } else {
    if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey) && canSend.value) {
      ev.preventDefault();
      send();
    }
  }
}

function onPaste(ev: ClipboardEvent) {
  if (!ev.clipboardData) return;

  const items = Array.from(ev.clipboardData.items);
  const imageItem = items.find(item => item.type.startsWith('image/'));
  
  if (imageItem && imageItem.kind === 'file') {
    ev.preventDefault();
    const file = imageItem.getAsFile();
    if (file) {
      handleFile(file);
    }
  }
}

async function selectFile() {
  if (fileInput.value) {
    fileInput.value.click();
  }
}

function onFileSelected(ev: Event) {
  const target = ev.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    handleFile(file);
  }
  // Reset input
  if (target) target.value = '';
}

async function handleFile(file: File) {
  if (file.size > 100 * 1024 * 1024) { // 100MB limit
    os.alert({
      type: 'error',
      text: 'File is too large. Maximum size is 100MB.'
    });
    return;
  }

  uploading.value = true;
  
  try {
    const uploadedFile = await uploadFile(file, defaultStore.state.uploadFolder);
    attachedFile.value = uploadedFile;
  } catch (error) {
    console.error('Failed to upload file:', error);
    os.alert({
      type: 'error',
      text: 'Failed to upload file. Please try again.'
    });
  } finally {
    uploading.value = false;
  }
}

function removeFile() {
  attachedFile.value = null;
}

async function selectEmoji(ev: MouseEvent) {
  os.openEmojiPicker(ev.currentTarget ?? ev.target, {}, textInput.value);
}

function selectGif(ev: MouseEvent) {
  os.openGifPicker(ev.currentTarget ?? ev.target, {}, (driveFile) => {
    if (driveFile && driveFile.id) {
      attachedFile.value = driveFile;
    }
  });
}

function send() {
  if (!canSend.value) return;

  const messageData: { text?: string; file?: any } = {};
  
  if (text.value.trim()) {
    messageData.text = text.value.trim();
  }
  
  if (attachedFile.value) {
    messageData.file = attachedFile.value;
  }

  emit('send', messageData);
  
  // Clear form
  clear();
}

function clear() {
  text.value = '';
  attachedFile.value = null;
  if (textInput.value) {
    textInput.value.style.height = 'auto';
  }
}

function focus() {
  nextTick(() => {
    textInput.value?.focus();
  });
}

function autoResize() {
  nextTick(() => {
    if (textInput.value) {
      textInput.value.style.height = 'auto';
      textInput.value.style.height = `${Math.min(textInput.value.scrollHeight, 120)}px`;
    }
  });
}

function isImageFile(file: any): boolean {
  return file?.type?.startsWith('image/') || false;
}

function isVideoFile(file: any): boolean {
  return file?.type?.startsWith('video/') || false;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Auto-resize on mount
onMounted(() => {
  autoResize();
});

// Expose methods for parent component
defineExpose({
  focus,
  clear
});
</script>

<style lang="scss" scoped>
.message-composer {
  padding: 1rem;
  background: var(--panel);

  .composer-container {
    max-width: 100%;

    .file-preview {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--X2);
      border-radius: 12px;
      padding: 0.75rem;
      margin-bottom: 0.75rem;

      .file-info {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex: 1;
        min-width: 0;

        .file-icon {
          width: 40px;
          height: 40px;
          border-radius: 8px;
          background: var(--accent);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;

          i {
            font-size: 1.2rem;
          }
        }

        .file-details {
          flex: 1;
          min-width: 0;

          .file-name {
            display: block;
            font-weight: 500;
            color: var(--fg);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            font-size: 0.9rem;
          }

          .file-size {
            display: block;
            font-size: 0.8rem;
            color: var(--fgTransparentWeak);
            margin-top: 0.125rem;
          }
        }
      }

      .remove-file {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: var(--error);
        color: white;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        flex-shrink: 0;

        &:hover {
          background: var(--errorLighten);
        }

        i {
          font-size: 0.9rem;
        }
      }
    }

    .input-container {
      display: flex;
      align-items: flex-end;
      gap: 0.5rem;
      background: var(--X2);
      border-radius: 24px;
      padding: 0.5rem;
      transition: all 0.2s;

      &:focus-within {
        background: var(--X3);
        box-shadow: 0 0 0 2px var(--accent);
      }

      .attachment-btn,
      .emoji-btn,
      .gif-btn {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: transparent;
        border: none;
        color: var(--fgTransparentWeak);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        flex-shrink: 0;

        &:hover:not(:disabled) {
          background: var(--X4);
          color: var(--accent);
        }

        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        i {
          font-size: 1.1rem;
        }
      }

      .text-input-container {
        flex: 1;
        min-width: 0;

        .text-input {
          width: 100%;
          min-height: 36px;
          max-height: 120px;
          border: none;
          background: transparent;
          color: var(--fg);
          font-size: 0.95rem;
          line-height: 1.4;
          padding: 8px 12px;
          resize: none;
          font-family: inherit;

          &:focus {
            outline: none;
          }

          &::placeholder {
            color: var(--fgTransparentWeak);
          }

          &:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
        }
      }

      .send-btn {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: var(--accent);
        color: white;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        flex-shrink: 0;

        &:hover:not(:disabled) {
          background: var(--accentLighten);
          transform: scale(1.05);
        }

        &:disabled {
          background: var(--fgTransparentWeak);
          cursor: not-allowed;
          transform: none;
        }

        i {
          font-size: 1.1rem;
        }
      }
    }
  }
}

@media (max-width: 768px) {
  .message-composer {
    padding: 0.75rem;

    .composer-container {
      .file-preview {
        padding: 0.6rem;

        .file-info {
          gap: 0.6rem;

          .file-icon {
            width: 36px;
            height: 36px;
          }
        }
      }

      .input-container {
        padding: 0.4rem;

        .attachment-btn,
        .emoji-btn,
        .gif-btn,
        .send-btn {
          width: 32px;
          height: 32px;

          i {
            font-size: 1rem;
          }
        }

        .text-input-container .text-input {
          min-height: 32px;
          padding: 6px 10px;
          font-size: 0.9rem;
        }
      }
    }
  }
}
</style>
