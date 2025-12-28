<template>
    <div class="invitation-analytics-page">
        <MkSpacer :content-max="800">
            <div class="page-header">
                <div class="icon">
                    <i class="ph-chart-line-up-bold ph-2x"></i>
                </div>
                <h1>{{ i18n.ts.invitationAnalytics }}</h1>
                <p>{{ i18n.ts.invitationAnalyticsDescription }}</p>
            </div>

            <InvitationAnalytics />
        </MkSpacer>
    </div>
</template>

<script setup lang="ts">
import { definePageMetadata } from '@/scripts/page-metadata';
import { i18n } from '@/i18n';
import InvitationAnalytics from '@/components/growth/InvitationAnalytics.vue';

definePageMetadata({
    title: i18n.ts.invitationAnalytics,
    icon: 'ph-chart-line-up-bold',
});
</script>

<style lang="scss" scoped>
.invitation-analytics-page {
    .page-header {
        text-align: center;
        margin-bottom: 3rem;
        padding: 2rem 0;

        .icon {
            color: var(--accent);
            margin-bottom: 1rem;
        }

        h1 {
            margin: 0 0 1rem 0;
            color: var(--fg);
            font-size: 2.5rem;
            font-weight: 700;
        }

        p {
            margin: 0;
            color: var(--fg);
            opacity: 0.8;
            font-size: 1.2rem;
            line-height: 1.5;
            max-width: 600px;
            margin: 0 auto;
        }
    }
}

@media (max-width: 600px) {
    .invitation-analytics-page {
        .page-header {
            padding: 1rem 0;
            margin-bottom: 2rem;

            h1 {
                font-size: 2rem;
            }

            p {
                font-size: 1.1rem;
            }
        }
    }
}
</style>