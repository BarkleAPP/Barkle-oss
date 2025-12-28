<template>
    <MkStickyContainer>
      <template #header>
      </template>
  
      <div class="mk-stream-settings">
        <FormSection>
          <template #label>{{ i18n.ts._stream.streamSettings }}</template>
  
          <div class="stream-status" v-if="currentStream">
            <div class="status-header">
              <i class="ph-broadcast-bold ph-lg"></i>
              <span class="title">{{ currentStream.title }}</span>
              <span class="status">{{ currentStream.isActive ? i18n.ts._stream.live : i18n.ts._stream.offline }}</span>
            </div>
          </div>
  
          <div class="stream-controls">
            <MkButton primary @click="createStream">
              <i class="ph-broadcast-bold ph-lg"></i> {{ i18n.ts._stream.createStream }}
            </MkButton>
          </div>
  
          <FormSection>
            <template #label>{{ i18n.ts._stream.attachNote }}</template>
  
            <MkForm class="bark-form">
              <MkInput v-model="noteInput">
                <template #label>{{ i18n.ts._stream.noteUrlOrId }}</template>
                <template #prefix><i class="ph-note-bold ph-lg"></i></template>
              </MkInput>
  
              <div class="action">
                <MkButton primary @click="attachNote">
                  <i class="ph-link-bold ph-lg"></i> {{ i18n.ts._stream.attachNoteButton }}
                </MkButton>
              </div>
            </MkForm>
          </FormSection>
        </FormSection>
  
        <FormSection v-if="currentStream">
          <template #label>{{ i18n.ts._stream.preview }}</template>
  
          <div class="stream-preview">
            <div class="player-container">
              <mux-player
                v-if="currentStream.isActive"
                :playback-id="currentStream.playbackId"
                stream-type="live"
                :metadata-video-title="streamTitle"
                :metadata-viewer-user-id="$i.id"
                class="mux-player"
                primary-color="var(--accent)"
                default-hidden-captions
              />
              <div v-else class="offline-message">
                <i class="ph-broadcast-bold ph-lg"></i>
                <span>{{ i18n.ts.streamOffline }}</span>
              </div>
            </div>
          </div>
        </FormSection>
      </div>
  
      <StreamKeysDialog
        v-if="showingKeys"
        :stream-data="streamKeys"
        @closed="showingKeys = false"
      />
    </MkStickyContainer>
  </template>
  
  <script lang="ts" setup>
  import { ref, computed } from 'vue';
  import '@mux/mux-player';
  import MkButton from '@/components/MkButton.vue';
  import MkInput from '@/components/form/input.vue';
  import * as os from '@/os';
  import { i18n } from '@/i18n';
  import { $i } from '@/account';
  import StreamKeysDialog from './StreamKeysDialog.vue';
  import { definePageMetadata } from '@/scripts/page-metadata';
  
  const streamTitle = ref('');
  const noteInput = ref('');
  const currentStream = ref(null);
  const showingKeys = ref(false);
  const streamKeys = ref(null);
  
  const headerActions = computed(() => []);
  const headerTabs = computed(() => []);
  
  async function createStream() {
    const { canceled, result: title } = await os.inputText({
      title: i18n.ts._stream.enterTitle,
      type: 'text',
      minLength: 1,
      maxLength: 128,
    });
    
    if (canceled || !title) return;
  
    try {
      const stream = await os.apiWithDialog('live/create', {
        title: title,
        autoPost: false
      });
      currentStream.value = stream;
      streamKeys.value = {
        streamKey: stream.streamKey,
        streamUrl: stream.streamUrl
      };
      streamTitle.value = title;
      showingKeys.value = true;
    } catch (error) {
      await os.alert({
        type: 'error',
        text: error.message,
      });
    }
  }
  
  async function attachNote() {
    if (!noteInput.value) return;
  
    try {
      await os.apiWithDialog('live/add-note', {
        noteInput: noteInput.value,
      });
      noteInput.value = '';
      await checkExistingStream();
      await os.success();
    } catch (error) {
      await os.alert({
        type: 'error',
        text: error.message,
      });
    }
  }
  
  async function checkExistingStream() {
    try {
      const stream = await os.api('live/get', {
        userId: $i.id
      });
      if (stream) {
        currentStream.value = stream;
        streamTitle.value = stream.title || '';
      }
    } catch (error) {
      console.error('Error fetching stream:', error);
    }
  }
  
  // Call on component mount
  checkExistingStream();
  
  definePageMetadata({
    title: i18n.ts._stream.streamSettings,
    icon: 'ph-broadcast-bold ph-lg',
  });
  </script>
  
  <style lang="scss" scoped>
  .mk-stream-settings {
    padding: var(--margin);
    max-width: 1000px;
    margin: 0 auto;
    box-sizing: border-box;
  
    .stream-status {
      margin-bottom: 16px;
      
      .status-header {
        display: flex;
        align-items: center;
        gap: 8px;
  
        .title {
          font-weight: bold;
        }
  
        .status {
          margin-left: auto;
          opacity: 0.7;
        }
      }
    }
  
    .stream-controls {
      margin: 16px 0;
    }
  
    .bark-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
  
      .action {
        margin-top: -8px;  // Adjust for form spacing
      }
    }
  
    .stream-preview {
      .player-container {
        background: var(--panel);
        border-radius: 6px;
        overflow: hidden;
        margin-top: 8px;
  
        .mux-player {
          width: 100%;
          aspect-ratio: 16/9;
  
          :deep(video) {
            object-fit: contain;
          }
        }
  
        .offline-message {
          width: 100%;
          aspect-ratio: 16/9;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
  
          i {
            font-size: 2.4em;
            opacity: 0.7;
          }
  
          span {
            opacity: 0.7;
          }
        }
      }
    }
  }
  </style>