<template>
  <MkStickyContainer>
    <template #header>
      <MkPageHeader :actions="headerActions" :tabs="[]">
        <template #title>
          <i class="ph-users-three-bold"></i>
          {{ i18n.ts.inviteFriends }}
        </template>
      </MkPageHeader>
    </template>
    <MkSpacer :content-max="800" :margin-min="16" :margin-max="32">
      <InviteFriends />
    </MkSpacer>
  </MkStickyContainer>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { definePageMetadata } from '@/scripts/page-metadata';
import { i18n } from '@/i18n';
import InviteFriends from '@/components/growth/InviteFriends.vue';

const headerActions = computed(() => [
  {
    icon: 'ph-question-bold',
    text: i18n.ts.help,
    handler: () => {
      // Could open help dialog
    },
  },
]);

definePageMetadata({
  title: i18n.ts.inviteFriends,
  icon: 'ph-users-three-bold',
});
</script>