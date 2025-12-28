<template>
    <div v-if="song && song.isPlaying" class="fields system">
        <div class="musicNP">
            <div class="service-logo">
                <i v-if="song.service === 'spotify'" class="ph ph-spotify-logo" style="display: flex; font-size: 20px;"></i>
                <i v-else-if="song.service === 'lastfm'" class="ph ph-music-note" style="display: flex; font-size: 20px;"></i>
            </div>
            <div class="SNPContent">
                <img v-if="proxiedCoverArt" 
                     class="SNPCover" 
                     :src="proxiedCoverArt" 
                     :alt="`${song.title} cover art`"
                     @error="handleImageError"/>
                <div class="music-note-placeholder" v-else>
                    <i class="ph ph-music-note ph-fw"></i>
                </div>
                <div class="SNPTextWrapper">
                    <a :href="song.url" target="_blank" rel="noopener noreferrer" class="SNPText title">{{ song.title }}</a>
                    <span class="SNPText artist">{{ song.artist }}</span>
                    <span v-if="song.album" class="SNPText album">{{ song.album }}</span>
                </div>
            </div>
            <div v-if="song.durationMs > 0" class="progress-container">
                <div class="progress-bar">
                    <div class="progress" :style="{ width: progressPercentage + '%' }"></div>
                </div>
                <div class="time">
                    <span>{{ formatTime(progressMs) }}</span>
                    <span>{{ formatTime(song.durationMs) }}</span>
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { computed, ref, onMounted, onUnmounted, watch } from 'vue';
import { getStaticImageUrl } from '@/scripts/get-static-image-url';

// Duplicated type from backend
export type NowPlayingSong = {
    coverArtUrl: string;
    title: string;
    artist: string;
    album: string;
    url: string;
    progressMs: number;
    durationMs: number;
    isPlaying: boolean;
    service: 'spotify' | 'lastfm';
};

const props = defineProps<{
    song: NowPlayingSong | null;
}>();

const progressMs = ref(props.song?.progressMs || 0);
let interval: NodeJS.Timeout | null = null;

const progressPercentage = computed(() => {
    if (!props.song || !props.song.durationMs) return 0;
    return (progressMs.value / props.song.durationMs) * 100;
});

// Create a proxied cover art URL as fallback
const proxiedCoverArt = computed(() => {
    if (!props.song?.coverArtUrl || props.song.coverArtUrl.trim() === '') {
        return '';
    }
    
    // Check if it's an external URL that needs proxying
    if (props.song.coverArtUrl.startsWith('http') && 
        !props.song.coverArtUrl.includes(window.location.hostname)) {
        return getStaticImageUrl(props.song.coverArtUrl);
    }
    
    return props.song.coverArtUrl;
});

function formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function handleImageError(event: Event) {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
}

function startProgressTimer() {
    if (interval) clearInterval(interval);
    if (props.song?.isPlaying && props.song.durationMs > 0) {
        interval = setInterval(() => {
            if (props.song && progressMs.value < props.song.durationMs) {
                progressMs.value += 1000;
            } else {
                if (interval) clearInterval(interval);
            }
        }, 1000);
    }
}

watch(() => props.song, (newSong) => {
    progressMs.value = newSong?.progressMs || 0;
    startProgressTimer();
}, { immediate: true, deep: true });


onMounted(() => {
    startProgressTimer();
});

onUnmounted(() => {
    if (interval) clearInterval(interval);
});
</script>

<style lang="scss" scoped>
.fields.system {
    margin-top: 12px;
}

.musicNP {
    background: var(--bg);
    color: var(--fg);
    border: 1px solid var(--divider);
    border-radius: 8px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    position: relative;
    transition: all 0.2s ease;

    &:hover {
        background: var(--panel);
        border-color: var(--accent);
    }
}

.service-logo {
    position: absolute;
    top: 8px;
    right: 8px;
    opacity: 0.6;
    font-size: 16px;
    color: var(--fgTransparentWeak);
}

.SNPContent {
    display: flex;
    align-items: flex-start;
    gap: 10px;
}

.SNPCover {
    width: 48px;
    height: 48px;
    border-radius: 6px;
    object-fit: cover;
    flex-shrink: 0;
    background: var(--panel);
    border: 1px solid var(--divider);
    transition: all 0.2s ease;

    &:hover {
        transform: scale(1.02);
    }
}

.music-note-placeholder {
    width: 48px;
    height: 48px;
    border-radius: 6px;
    background: var(--panel);
    border: 1px solid var(--divider);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--fgTransparentWeak);
    font-size: 20px;
    flex-shrink: 0;
    opacity: 0.7;
}

.SNPTextWrapper {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    flex: 1;
    gap: 1px;
    min-width: 0;
}

.SNPText {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.2;
    transition: all 0.2s ease;

    &.title {
        font-size: 0.95em;
        font-weight: 600;
        color: var(--fg);
        text-decoration: none;
        margin-bottom: 1px;
        
        &:hover {
            color: var(--accent);
        }
    }

    &.artist {
        font-size: 0.85em;
        font-weight: 500;
        color: var(--fgTransparentWeak);
        margin-bottom: 1px;
    }

    &.album {
        font-size: 0.8em;
        font-weight: 400;
        color: var(--fgTransparentWeak);
        opacity: 0.8;
    }
}

.progress-container {
    margin-top: 6px;
}

.progress-bar {
    width: 100%;
    height: 3px;
    background: var(--panel);
    border-radius: 2px;
    overflow: hidden;
    margin-bottom: 4px;

    .progress {
        height: 100%;
        background: var(--accent);
        border-radius: 2px;
        transition: width 0.2s linear;
    }
}

.time {
    display: flex;
    justify-content: space-between;
    font-size: 0.7em;
    font-weight: 500;
    color: var(--fgTransparentWeak);
    font-family: ui-monospace, 'SF Mono', 'Monaco', 'Cascadia Code', monospace;
}

// Subtle animation for playing state
@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.96; }
}

.musicNP {
    animation: pulse 5s ease-in-out infinite;
}

// Mobile responsiveness
@media (max-width: 500px) {
    .musicNP {
        padding: 10px;
        gap: 6px;
    }
    
    .SNPContent {
        gap: 8px;
    }
    
    .SNPCover, .music-note-placeholder {
        width: 44px;
        height: 44px;
    }
    
    .service-logo {
        top: 6px;
        right: 6px;
        font-size: 14px;
    }
    
    .SNPText {
        &.title {
            font-size: 0.9em;
        }
        
        &.artist {
            font-size: 0.8em;
        }
        
        &.album {
            font-size: 0.75em;
        }
    }
}
</style>
