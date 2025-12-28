<template>
    <div class="_panel game-menu">
        <div class="title">
            <i class="ph-game-controller-bold ph-lg"></i>
            Barktres
        </div>
        <div class="subtitle">{{ i18n.ts.barktresSubtitle || 'Block stacking puzzle game' }}</div>

        <div v-if="$i" class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon">
                    <i class="ph-trophy-bold ph-lg"></i>
                </div>
                <div class="stat-label">{{ i18n.ts.barktresTopScore || 'Top Score' }}</div>
                <div class="stat-value">{{ stats?.topScore ?? '-' }}</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">
                    <i class="ph-target-bold ph-lg"></i>
                </div>
                <div class="stat-label">{{ i18n.ts.barktresGamesPlayed || 'Games Played' }}</div>
                <div class="stat-value">{{ stats?.totalGames ?? 0 }}</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">
                    <i class="ph-star-bold ph-lg"></i>
                </div>
                <div class="stat-label">{{ i18n.ts.barktreBestRank || 'Best Rank' }}</div>
                <div class="stat-value">{{ stats?.bestRank ? `#${stats.bestRank}` : '-' }}</div>
            </div>
        </div>

        <div class="menu-buttons">
            <MkButton large rounded @click="$emit('show-leaderboard')">
                <i class="ph-trophy-bold ph-lg"></i> {{ i18n.ts.barktresLeaderboard || 'Leaderboard' }}
            </MkButton>
            <MkButton primary large rounded @click="$emit('start-game')">
                <i class="ph-play-bold ph-lg"></i> {{ i18n.ts.barktresStart || 'Play' }}
            </MkButton>
        </div>

        <div v-if="!$i" class="login-notice">
            <i class="ph-info-bold ph-lg"></i>
            <span>{{ i18n.ts.barktresLoginRequired || 'Login required to save scores' }}</span>
        </div>
    </div>
</template>

<script lang="ts" setup>
import MkButton from '@/components/MkButton.vue';
import { i18n } from '@/i18n';
import { $i } from '@/account';

defineProps<{
    stats: any;
}>();

defineEmits<{
    (e: 'start-game'): void;
    (e: 'show-leaderboard'): void;
}>();
</script>

<style lang="scss" scoped>
.game-menu {
    text-align: center;
    padding: 48px 32px;
    border-radius: 16px;

    .title {
        font-size: 3em;
        font-weight: 800;
        margin-bottom: 12px;
        background: linear-gradient(135deg, var(--accent), var(--accentLighten));
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        letter-spacing: -1px;
    }

    .subtitle {
        font-size: 1.1em;
        opacity: 0.8;
        margin-bottom: 40px;
    }

    .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 16px;
        margin-bottom: 32px;

        .stat-card {
            padding: 20px;
            background: var(--accentedBg);
            border-radius: 12px;
            transition: transform 0.2s;

            &:hover {
                transform: translateY(-2px);
            }

            .stat-icon {
                font-size: 2em;
                margin-bottom: 8px;
            }

            .stat-label {
                font-size: 0.85em;
                opacity: 0.7;
                margin-bottom: 8px;
            }

            .stat-value {
                font-size: 1.8em;
                font-weight: bold;
                color: var(--accent);
            }
        }
    }

    .menu-buttons {
        display: flex;
        flex-direction: row;
        justify-content: center;
        align-items: center;
        gap: 16px;
        margin: 0 auto;
        flex-wrap: wrap;
    }

    .login-notice {
        margin-top: 24px;
        padding: 12px;
        background: var(--infoBg);
        color: var(--info);
        border-radius: 8px;
        font-size: 0.9em;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
    }
}

@media (max-width: 600px) {
    .game-menu {
        padding: 32px 20px;

        .title {
            font-size: 2.2em;
        }
    }
}
</style>
