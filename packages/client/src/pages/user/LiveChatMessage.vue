<template>
  <div class="chat-message" :class="{ 'is-me': isMe }">
    <div class="avatar">
      <MkAvatar :user="message.user" :show-indicator="true" class="avatar-image"/>
    </div>
    <div class="content">
      <div class="header">
        <span class="name" :class="{ mod: message.user.isAdmin || message.user.isModerator }">
          {{ message.user.name || '@' + message.user.username }}
        </span>
        <span v-if="message.user.name" class="username">@{{ message.user.username }}</span>
        <span class="time">{{ formatTime(message.createdAt) }}</span>
      </div>
      <div class="text">{{ message.text }}</div>
    </div>
    <button v-if="isMod && !isMe" class="delete-btn" @click="$emit('delete', message.id)">
      <i class="ph-x-bold"></i>
    </button>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import * as Misskey from 'calckey-js';
import { $i } from '@/account';

const props = defineProps<{
  message: any; // Will be LiveChatMessage type when types are available
  isMod: boolean;
}>();

const emit = defineEmits<{
  (e: 'delete', id: string): void;
}>();

const isMe = computed(() => props.message.userId === $i?.id);

function formatTime(date: string): string {
  const messageDate = new Date(date);
  return messageDate.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit',
  });
}
</script>

<style lang="scss" scoped>
.chat-message {
  display: flex;
  gap: 0.75rem;
  padding: 0.5rem;
  border-radius: 8px;
  position: relative;
  transition: background-color 0.2s;

  &:hover {
    background: var(--X2);

    .delete-btn {
      opacity: 1;
    }
  }

  &.is-me {
    background: var(--X3);
  }

  .avatar {
    flex-shrink: 0;

    .avatar-image {
      width: 32px;
      height: 32px;
      border-radius: 50%;
    }
  }

  .content {
    flex-grow: 1;
    min-width: 0;

    .header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.25rem;
      font-size: 0.9rem;

      .name {
        font-weight: bold;
        color: var(--fg);
        
        &.mod {
          color: var(--accent);
          &::after {
            content: "MOD";
            font-size: 0.7rem;
            background: var(--accent);
            color: #fff;
            padding: 0.1rem 0.3rem;
            border-radius: 3px;
            margin-left: 0.5rem;
            vertical-align: middle;
          }
        }
      }

      .username {
        color: var(--fgTransparentWeak);
      }

      .time {
        color: var(--fgTransparentWeak);
        font-size: 0.8rem;
      }
    }

    .text {
      word-wrap: break-word;
      white-space: pre-wrap;
      line-height: 1.4;
      color: var(--fg);
    }
  }

  .delete-btn {
    position: absolute;
    right: 0.5rem;
    top: 0.5rem;
    opacity: 0;
    transition: opacity 0.2s;
    padding: 0.25rem;
    line-height: 1;
    border-radius: 4px;
    color: var(--fgTransparentWeak);

    &:hover {
      background: var(--X4);
      color: var(--error);
    }

    > i {
      font-size: 1rem;
    }
  }
}
</style>