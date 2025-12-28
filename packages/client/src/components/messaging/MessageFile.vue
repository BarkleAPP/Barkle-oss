<template>
  <div class="message-file">
    <div v-if="isImage" class="image-container">
      <img 
        :src="file.url || file.thumbnailUrl" 
        :alt="file.name"
        class="image-preview"
        @click="openImageViewer"
      />
      <div class="image-overlay">
        <button class="download-btn" @click="downloadFile" title="Download">
          <i class="ph-download-bold"></i>
        </button>
      </div>
    </div>

    <div v-else-if="isVideo" class="video-container">
      <video 
        :src="file.url"
        class="video-preview"
        controls
        preload="metadata"
      >
        Your browser does not support the video tag.
      </video>
      <div class="video-overlay">
        <button class="download-btn" @click="downloadFile" title="Download">
          <i class="ph-download-bold"></i>
        </button>
      </div>
    </div>

    <div v-else-if="isAudio" class="audio-container">
      <div class="audio-info">
        <div class="audio-icon">
          <i class="ph-music-note-bold"></i>
        </div>
        <div class="audio-details">
          <span class="file-name">{{ file.name }}</span>
          <span class="file-size">{{ formatFileSize(file.size) }}</span>
        </div>
        <button class="download-btn" @click="downloadFile" title="Download">
          <i class="ph-download-bold"></i>
        </button>
      </div>
      <audio 
        :src="file.url"
        class="audio-player"
        controls
        preload="metadata"
      >
        Your browser does not support the audio tag.
      </audio>
    </div>

    <div v-else class="file-container">
      <div class="file-info">
        <div class="file-icon">
          <i :class="getFileIcon()"></i>
        </div>
        <div class="file-details">
          <span class="file-name">{{ file.name }}</span>
          <span class="file-size">{{ formatFileSize(file.size) }}</span>
        </div>
        <button class="download-btn" @click="downloadFile" title="Download">
          <i class="ph-download-bold"></i>
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import * as os from '@/os';

const props = defineProps<{
  file: {
    id: string;
    name: string;
    type: string;
    size: number;
    url: string;
    thumbnailUrl?: string;
  };
}>();

const isImage = computed(() => props.file.type.startsWith('image/'));
const isVideo = computed(() => props.file.type.startsWith('video/'));
const isAudio = computed(() => props.file.type.startsWith('audio/'));

function getFileIcon(): string {
  const type = props.file.type.toLowerCase();
  const extension = props.file.name.split('.').pop()?.toLowerCase();

  if (type.includes('pdf') || extension === 'pdf') {
    return 'ph-file-pdf-bold';
  }
  if (type.includes('word') || extension === 'doc' || extension === 'docx') {
    return 'ph-file-doc-bold';
  }
  if (type.includes('sheet') || extension === 'xls' || extension === 'xlsx') {
    return 'ph-file-xls-bold';
  }
  if (type.includes('powerpoint') || extension === 'ppt' || extension === 'pptx') {
    return 'ph-file-ppt-bold';
  }
  if (type.includes('zip') || type.includes('rar') || type.includes('7z')) {
    return 'ph-file-zip-bold';
  }
  if (type.includes('text') || extension === 'txt') {
    return 'ph-file-text-bold';
  }
  if (type.includes('code') || ['js', 'ts', 'html', 'css', 'json', 'xml'].includes(extension || '')) {
    return 'ph-file-code-bold';
  }

  return 'ph-file-bold';
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function downloadFile() {
  const link = document.createElement('a');
  link.href = props.file.url;
  link.download = props.file.name;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function openImageViewer() {
  if (isImage.value) {
    os.popup({
      src: () => import('@/components/MkImageViewer.vue'),
      props: {
        image: props.file,
        images: [props.file]
      }
    });
  }
}
</script>

<style lang="scss" scoped>
.message-file {
  max-width: 400px;
  border-radius: 12px;
  overflow: hidden;
  background: var(--X2);

  .image-container {
    position: relative;
    
    .image-preview {
      width: 100%;
      height: auto;
      max-height: 300px;
      object-fit: cover;
      cursor: pointer;
      transition: all 0.2s;
      
      &:hover {
        filter: brightness(0.9);
      }
    }
    
    .image-overlay {
      position: absolute;
      top: 8px;
      right: 8px;
      opacity: 0;
      transition: opacity 0.2s;
      
      .download-btn {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.6);
        color: white;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        
        &:hover {
          background: rgba(0, 0, 0, 0.8);
        }
        
        i {
          font-size: 1rem;
        }
      }
    }
    
    &:hover .image-overlay {
      opacity: 1;
    }
  }

  .video-container {
    position: relative;
    
    .video-preview {
      width: 100%;
      height: auto;
      max-height: 300px;
      border-radius: 12px;
    }
    
    .video-overlay {
      position: absolute;
      top: 8px;
      right: 8px;
      
      .download-btn {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.6);
        color: white;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        
        &:hover {
          background: rgba(0, 0, 0, 0.8);
        }
        
        i {
          font-size: 1rem;
        }
      }
    }
  }

  .audio-container {
    padding: 0.75rem;
    
    .audio-info {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.5rem;
      
      .audio-icon {
        width: 40px;
        height: 40px;
        border-radius: 50%;
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
      
      .audio-details {
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
      
      .download-btn {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: var(--X4);
        color: var(--fg);
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        flex-shrink: 0;
        
        &:hover {
          background: var(--accent);
          color: white;
        }
        
        i {
          font-size: 1rem;
        }
      }
    }
    
    .audio-player {
      width: 100%;
      height: 32px;
    }
  }

  .file-container {
    padding: 0.75rem;
    
    .file-info {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      
      .file-icon {
        width: 48px;
        height: 48px;
        border-radius: 8px;
        background: var(--accent);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        
        i {
          font-size: 1.5rem;
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
          font-size: 0.95rem;
        }
        
        .file-size {
          display: block;
          font-size: 0.85rem;
          color: var(--fgTransparentWeak);
          margin-top: 0.25rem;
        }
      }
      
      .download-btn {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: var(--X4);
        color: var(--fg);
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        flex-shrink: 0;
        
        &:hover {
          background: var(--accent);
          color: white;
        }
        
        i {
          font-size: 1.1rem;
        }
      }
    }
  }
}

@media (max-width: 768px) {
  .message-file {
    max-width: 280px;
    
    .image-container .image-preview {
      max-height: 200px;
    }
    
    .video-container .video-preview {
      max-height: 200px;
    }
    
    .audio-container,
    .file-container {
      padding: 0.6rem;
      
      .audio-info,
      .file-info {
        gap: 0.6rem;
        
        .audio-icon,
        .file-icon {
          width: 40px;
          height: 40px;
        }
        
        .download-btn {
          width: 32px;
          height: 32px;
        }
      }
    }
  }
}
</style>
