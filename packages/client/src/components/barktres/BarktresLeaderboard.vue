<template>
    <MkModal v-if="show" @click="$emit('close')" @close="$emit('close')">
        <div class="leaderboard-modal _panel">
            <div class="modal-header">
                <h2><i class="ph-trophy-bold ph-lg"></i> Leaderboard</h2>
                <button class="close-btn" @click="$emit('close')">
                    <i class="ph-x-bold ph-lg"></i>
                </button>
            </div>
            <div v-if="entries.length === 0" class="empty-state">
                <i class="ph-game-controller-bold ph-lg"></i>
                <p>No scores yet. Be the first!</p>
            </div>
            <div v-else class="leaderboard-list">
                <div v-for="(entry, index) in entries" :key="entry.id" class="leaderboard-item"
                    :class="{ 'is-me': entry.userId === $i?.id }">
                    <div class="rank" :class="{ gold: index === 0, silver: index === 1, bronze: index === 2 }">
                        {{ index + 1 }}
                    </div>
                    <MkA :to="`/@${entry.user.username}`" class="user-link" @click.stop>
                        <MkAvatar :user="entry.user" class="user-avatar" :disable-link="true" />
                    </MkA>
                    <div class="user-details">
                        <MkA :to="`/@${entry.user.username}`" class="username-link" @click.stop>
                            <MkUserName :user="entry.user" :nowrap="true" />
                        </MkA>
                        <div class="game-details">{{ entry.lines }} lines · Lvl {{ entry.level }}</div>
                    </div>
                    <div class="entry-score">{{ entry.score.toLocaleString() }}</div>
                    <MkFollowButton v-if="$i && entry.userId !== $i?.id" :user="entry.user" :full="false"
                        class="follow-btn" />
                </div>
            </div>
        </div>
    </MkModal>
</template>

<script lang="ts" setup>
import MkModal from '@/components/MkModal.vue';
import MkFollowButton from '@/components/MkFollowButton.vue';
import { $i } from '@/account';

defineProps<{
    show: boolean;
    entries: any[];
}>();

defineEmits<{
    (e: 'close'): void;
}>();
</script>

<style lang="scss" scoped>
.leaderboard-modal {
    padding: 0;
    max-width: 800px;
    min-width: 400px;
    border-radius: 16px;

    .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 24px 32px;
        border-bottom: 1px solid var(--divider);

        h2 {
            margin: 0;
            font-size: 1.5em;
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .close-btn {
            background: transparent;
            border: none;
            color: var(--fg);
            cursor: pointer;
            padding: 8px;
            border-radius: 8px;
            transition: all 0.2s;

            &:hover {
                background: var(--accentedBg);
            }
        }
    }

    .empty-state {
        text-align: center;
        padding: 64px 32px;
        opacity: 0.6;

        i {
            font-size: 3em;
            margin-bottom: 16px;
            display: block;
        }

        p {
            margin: 0;
        }
    }

    .leaderboard-list {
        padding: 16px;
        max-height: 500px;
        overflow-y: auto;

        .leaderboard-item {
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 16px;
            margin-bottom: 8px;
            background: var(--accentedBg);
            border-radius: 12px;
            transition: all 0.2s;

            &:hover {
                background: var(--accentedBg);
                transform: translateX(4px);
            }

            &.is-me {
                background: var(--accent);
                color: var(--fgOnAccent);

                .rank,
                .entry-score {
                    color: var(--fgOnAccent);
                }

                .username-link {
                    color: var(--fgOnAccent);
                }
            }

            .rank {
                font-size: 1.8em;
                font-weight: bold;
                min-width: 48px;
                text-align: center;
                color: var(--accent);

                &.gold {
                    color: #ffd700;
                }

                &.silver {
                    color: #c0c0c0;
                }

                &.bronze {
                    color: #cd7f32;
                }
            }

            .user-link {
                flex-shrink: 0;
                transition: transform 0.2s;

                &:hover {
                    transform: scale(1.1);
                }
            }

            .user-avatar {
                width: 48px;
                height: 48px;
                flex-shrink: 0;
            }

            .user-details {
                flex: 1;
                min-width: 0;

                .username-link {
                    color: var(--fg);
                    text-decoration: none;
                    transition: color 0.2s;

                    &:hover {
                        color: var(--accent);
                        text-decoration: underline;
                    }
                }

                .game-details {
                    font-size: 0.85em;
                    opacity: 0.7;
                    margin-top: 2px;
                }
            }

            .entry-score {
                font-size: 1.4em;
                font-weight: bold;
                color: var(--accent);
                white-space: nowrap;
            }

            .follow-btn {
                flex-shrink: 0;
            }
        }
    }
}

@media (max-width: 600px) {
    .leaderboard-modal {
        min-width: 280px;

        .leaderboard-list .leaderboard-item {
            padding: 12px;
            gap: 12px;

            .rank {
                font-size: 1.4em;
                min-width: 36px;
            }

            .user-avatar {
                width: 36px;
                height: 36px;
            }

            .entry-score {
                font-size: 1.2em;
            }
        }
    }
}
</style>
