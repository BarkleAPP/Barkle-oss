<template>
    <XModalWindow
      ref="dialog"
      :width="450"
      @close="dialog?.close()"
      @closed="emit('closed')"
    >
      <template #header>{{ i18n.ts._stream.streamKeys }}</template>
    
      <div class="_monolithic_">
        <div class="_section">
          <div class="key-block">
            <span class="key-label">{{ i18n.ts._stream.streamServer }}</span>
            <div class="key-content">
              <span class="value">{{ streamData.streamUrl }}</span>
              <MkButton class="copy-button" @click="copyToClipboard(streamData.streamUrl)">
                <i class="ph-copy-bold ph-lg"></i>
              </MkButton>
            </div>
          </div>
    
          <div class="key-block">
            <span class="key-label">{{ i18n.ts._stream.streamKey }}</span>
            <div class="key-content">
              <span class="value">{{ streamData.streamKey }}</span>
              <MkButton class="copy-button" @click="copyToClipboard(streamData.streamKey)">
                <i class="ph-copy-bold ph-lg"></i>
              </MkButton>
            </div>
          </div>
    
          <div class="warning">
            {{ i18n.ts._stream.keysWarning }}
          </div>
        </div>
      </div>
    </XModalWindow>
    </template>
    
    <script lang="ts" setup>
    import { } from 'vue';
    import * as os from '@/os';
    import { i18n } from '@/i18n';
    import XModalWindow from '@/components/MkModalWindow.vue';
    import MkButton from '@/components/MkButton.vue';
    
    const props = defineProps<{
      streamData: {
        streamKey: string;
        streamUrl: string;
      }
    }>();
    
    const emit = defineEmits<{
      (ev: 'closed'): void;
    }>();
    
    const dialog = $ref<InstanceType<typeof XModalWindow>>();
    
    async function copyToClipboard(text: string) {
      await navigator.clipboard.writeText(text);
      os.success();
    }
    </script>
    
    <style lang="scss" scoped>
    ._section {
      padding: 20px;
    
      .key-block {
        margin-bottom: 16px;
    
        .key-label {
          display: block;
          margin-bottom: 8px;
          font-size: 0.9em;
          opacity: 0.7;
        }
    
        .key-content {
          display: flex;
          gap: 8px;
          background: var(--panel);
          padding: 10px;
          border-radius: 6px;
    
          .value {
            flex-grow: 1;
            font-family: monospace;
            word-break: break-all;
          }
    
          .copy-button {
            flex-shrink: 0;
          }
        }
      }
    
      .warning {
        color: var(--warn);
        font-size: 0.9em;
        padding: 10px;
        background: var(--infoDanger);
        border-radius: 6px;
      }
    }
    </style>