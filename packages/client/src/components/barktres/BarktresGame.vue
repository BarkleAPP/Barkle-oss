<template>
    <div class="game-area">
        <div class="_panel game-header">
            <div class="stat-item">
                <span class="label">Score</span>
                <span class="value">{{ score }}</span>
            </div>
            <div class="stat-item">
                <span class="label">Lines</span>
                <span class="value">{{ lines }}</span>
            </div>
            <div class="stat-item">
                <span class="label">Level</span>
                <span class="value">{{ level }}</span>
            </div>
        </div>

        <div class="game-layout">
            <!-- Hold Piece -->
            <div class="side-panel hold-panel _panel">
                <div class="panel-label">
                    <i class="ph-package-bold"></i>
                    <span>Hold</span>
                </div>
                <canvas ref="holdCanvas" class="preview-canvas" width="120" height="120"></canvas>
                <div class="panel-hint">Press C</div>
            </div>

            <!-- Main Game Board -->
            <div class="game-main">
                <canvas ref="gameCanvas" class="game-canvas" width="300" height="600"></canvas>

                <!-- Game Over Overlay -->
                <div v-if="isGameOver" class="game-over-overlay">
                    <div class="game-over-card">
                        <h2>
                            <i class="ph-game-controller-bold ph-lg"></i>
                            Game Over!
                        </h2>
                        <div class="final-stats">
                            <div class="final-stat">
                                <span class="label">Final Score</span>
                                <span class="value">{{ score }}</span>
                            </div>
                            <div class="final-stat">
                                <span class="label">Lines Cleared</span>
                                <span class="value">{{ lines }}</span>
                            </div>
                            <div class="final-stat">
                                <span class="label">Level Reached</span>
                                <span class="value">{{ level }}</span>
                            </div>
                        </div>
                        <div class="game-over-actions">
                            <MkButton primary large rounded @click="$emit('return-to-menu')">
                                <i class="ph-arrow-u-up-left-bold ph-lg"></i> Return to Menu
                            </MkButton>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Next Piece -->
            <div class="side-panel next-panel _panel">
                <div class="panel-label">
                    <i class="ph-arrow-right-bold"></i>
                    <span>Next</span>
                </div>
                <canvas ref="nextCanvas" class="preview-canvas" width="120" height="120"></canvas>
            </div>
        </div>

        <!-- Touch Controls -->
        <div class="touch-controls">
            <div class="control-row">
                <button class="control-btn" @click="$emit('move-left')" @touchstart.prevent="$emit('move-left')">
                    <i class="ph-caret-left-bold ph-lg"></i>
                </button>
                <button class="control-btn rotate-btn" @click="$emit('rotate')" @touchstart.prevent="$emit('rotate')">
                    <i class="ph-arrow-clockwise-bold ph-lg"></i>
                </button>
                <button class="control-btn" @click="$emit('move-right')" @touchstart.prevent="$emit('move-right')">
                    <i class="ph-caret-right-bold ph-lg"></i>
                </button>
            </div>
            <div class="control-row">
                <button class="control-btn" @click="$emit('hold-piece')" @touchstart.prevent="$emit('hold-piece')">
                    <i class="ph-package-bold ph-lg"></i> Hold
                </button>
                <button class="control-btn wide" @click="$emit('soft-drop')" @touchstart.prevent="$emit('soft-drop')">
                    <i class="ph-caret-down-bold ph-lg"></i> Soft
                </button>
                <button class="control-btn wide primary" @click="$emit('hard-drop')"
                    @touchstart.prevent="$emit('hard-drop')">
                    <i class="ph-caret-double-down-bold ph-lg"></i> Drop
                </button>
            </div>
        </div>
        <div class="game-instructions">
            <div class="instruction-group">
                <strong>Keyboard:</strong> Arrow keys to move • Space/↑ to rotate • Enter for hard drop • C/Shift to
                hold
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import MkButton from '@/components/MkButton.vue';

defineProps<{
    score: number;
    lines: number;
    level: number;
    isGameOver: boolean;
}>();

defineEmits<{
    (e: 'move-left'): void;
    (e: 'move-right'): void;
    (e: 'rotate'): void;
    (e: 'soft-drop'): void;
    (e: 'hard-drop'): void;
    (e: 'hold-piece'): void;
    (e: 'return-to-menu'): void;
}>();

const gameCanvas = ref<HTMLCanvasElement | null>(null);
const holdCanvas = ref<HTMLCanvasElement | null>(null);
const nextCanvas = ref<HTMLCanvasElement | null>(null);

defineExpose({
    gameCanvas,
    holdCanvas,
    nextCanvas,
});
</script>

<style lang="scss" scoped>
.game-area {
    .game-header {
        display: flex;
        justify-content: space-around;
        padding: 20px;
        margin-bottom: 20px;
        border-radius: 12px;

        .stat-item {
            text-align: center;

            .label {
                display: block;
                font-size: 0.85em;
                opacity: 0.7;
                margin-bottom: 4px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .value {
                display: block;
                font-weight: bold;
                font-size: 1.8em;
                color: var(--accent);
            }
        }
    }

    .game-layout {
        display: flex;
        gap: 16px;
        justify-content: center;
        align-items: flex-start;
        margin-bottom: 20px;

        .side-panel {
            padding: 16px;
            border-radius: 12px;
            text-align: center;
            min-width: 140px;

            .panel-label {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                font-size: 0.9em;
                font-weight: 600;
                margin-bottom: 12px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                opacity: 0.9;

                i {
                    font-size: 1.2em;
                }
            }

            .preview-canvas {
                display: block;
                border-radius: 8px;
                background: rgba(26, 26, 46, 0.5);
                border: 2px solid var(--accentedBg);
            }

            .panel-hint {
                margin-top: 8px;
                font-size: 0.75em;
                opacity: 0.5;
            }
        }
    }

    .game-main {
        position: relative;
        display: flex;
        justify-content: center;
        margin-bottom: 20px;

        .game-canvas {
            display: block;
            border: 4px solid var(--accent);
            border-radius: 12px;
            background: #1a1a2e;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            image-rendering: pixelated;
            image-rendering: crisp-edges;
        }

        .game-over-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(0, 0, 0, 0.9);
            border-radius: 12px;
            backdrop-filter: blur(4px);

            .game-over-card {
                text-align: center;
                padding: 40px;
                background: var(--panel);
                border-radius: 16px;
                max-width: 400px;

                h2 {
                    font-size: 2.5em;
                    margin-bottom: 24px;
                    font-weight: bold;
                }

                .final-stats {
                    display: flex;
                    gap: 24px;
                    justify-content: center;
                    margin-bottom: 32px;

                    .final-stat {
                        .label {
                            display: block;
                            font-size: 0.85em;
                            opacity: 0.7;
                            margin-bottom: 4px;
                        }

                        .value {
                            display: block;
                            font-size: 2em;
                            font-weight: bold;
                            color: var(--accent);
                        }
                    }
                }

                .game-over-actions {
                    display: flex;
                    justify-content: center;
                }
            }
        }
    }

    .touch-controls {
        max-width: 500px;
        margin: 0 auto 20px;

        .control-row {
            display: flex;
            gap: 8px;
            margin-bottom: 8px;

            .control-btn {
                flex: 1;
                padding: 18px 12px;
                background: var(--buttonBg);
                border: 2px solid var(--accentedBg);
                border-radius: 12px;
                color: var(--fg);
                font-size: 1em;
                font-weight: 600;
                cursor: pointer;
                user-select: none;
                touch-action: manipulation;
                transition: all 0.15s;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;

                &:hover {
                    background: var(--accentedBg);
                    border-color: var(--accent);
                }

                &:active {
                    transform: scale(0.96);
                    background: var(--accent);
                    color: var(--fgOnAccent);
                }

                &.rotate-btn {
                    flex: 1.2;
                }

                &.wide {
                    flex: 1.5;
                }

                &.primary {
                    background: var(--accent);
                    color: var(--fgOnAccent);
                    border-color: var(--accent);

                    &:hover {
                        background: var(--accentLighten);
                        border-color: var(--accentLighten);
                    }
                }
            }
        }
    }

    .game-instructions {
        text-align: center;
        padding: 16px;
        background: var(--accentedBg);
        border-radius: 12px;
        font-size: 0.9em;
        opacity: 0.8;

        .instruction-group {
            margin: 4px 0;
        }
    }
}

@media (max-width: 768px) {
    .game-area {
        .game-layout {
            flex-direction: column;
            align-items: center;

            .side-panel {
                min-width: 120px;
                padding: 12px;

                .panel-label {
                    font-size: 0.85em;
                }

                .preview-canvas {
                    width: 100px;
                    height: 100px;
                }
            }

            .hold-panel,
            .next-panel {
                display: flex;
                flex-direction: row;
                align-items: center;
                gap: 12px;
                width: 100%;
                max-width: 300px;
            }
        }

        .game-main .game-canvas {
            max-width: 100%;
            height: auto;
        }

        .touch-controls .control-row .control-btn {
            padding: 14px 8px;
            font-size: 0.85em;
        }

        .game-instructions {
            font-size: 0.8em;
        }
    }
}

@media (min-width: 769px) {
    .game-area .game-layout {

        .hold-panel,
        .next-panel {
            .preview-canvas {
                width: 120px;
                height: 120px;
            }
        }
    }
}
</style>
