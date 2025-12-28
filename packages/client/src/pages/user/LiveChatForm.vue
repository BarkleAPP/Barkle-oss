<template>
  <div class="chat-form">
    <textarea
      v-model="text"
      :disabled="disabled"
      class="input"
      :placeholder="disabled ? i18n.ts.streamOffline : i18n.ts.enterMessage"
      @keydown.enter.exact.prevent="onEnterPress"
      @keydown="typing"
      @input="onInput"
      ref="textareaEl"
    />
    <button 
      class="submit-btn" 
      :disabled="disabled || !text.trim()"
      @click="onSubmit"
    >
      <i class="ph-paper-plane-right-bold"></i>
    </button>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import { i18n } from '@/i18n';
import * as os from '@/os';

const props = defineProps<{
  disabled?: boolean;
  streamId?: string;
}>();

const emit = defineEmits<{
  (e: 'submit', text: string): void;
}>();

const text = ref('');
const textareaEl = ref<HTMLTextAreaElement>();
let typingTimeout: NodeJS.Timeout | null = null;

function onEnterPress(e: KeyboardEvent) {
  if (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
  onSubmit();
}

async function onSubmit() {
  const trimmedText = text.value?.trim();
  console.log('LiveChatForm onSubmit called:', { trimmedText, disabled: props.disabled, streamId: props.streamId });
  
  if (props.disabled || !trimmedText || !props.streamId) {
    console.log('Submission blocked:', { disabled: props.disabled, hasText: !!trimmedText, hasStreamId: !!props.streamId });
    return;
  }
  
  try {
    console.log('Sending chat message...', { text: trimmedText, streamId: props.streamId });
    await os.api('live-chat/create', {
      text: trimmedText,
      streamId: props.streamId,
    });
    
    console.log('Chat message sent successfully');
    emit('submit', trimmedText);
    text.value = '';
    
    // Reset textarea height
    if (textareaEl.value) {
      textareaEl.value.style.height = 'auto';
    }
  } catch (err) {
    console.error('Failed to send message:', err);
    os.alert({
      type: 'error',
      text: i18n.ts.failedToSend
    });
  }
}

function typing() {
  if (typingTimeout) clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    typingTimeout = null;
  }, 1000);
}

function onInput(e: Event) {
  const textarea = e.target as HTMLTextAreaElement;
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
}
</script>

<style lang="scss" scoped>
.chat-form {
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem;
  background: var(--panel);
  border-radius: 8px;

  .input {
    flex-grow: 1;
    min-height: 40px;
    max-height: 150px;
    padding: 0.5rem;
    background: var(--X2);
    border: none;
    border-radius: 4px;
    color: var(--fg);
    font-size: 0.95rem;
    resize: none;
    transition: background-color 0.2s;

    &::placeholder {
      color: var(--fgTransparentWeak);
    }

    &:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }

    &:focus {
      outline: none;
      background: var(--X3);
    }
  }

  .submit-btn {
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 4px;
    transition: opacity 0.2s;
    cursor: pointer;

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    &:not(:disabled):hover {
      opacity: 0.9;
    }

    > i {
      font-size: 1.2rem;
    }
  }
}
</style>