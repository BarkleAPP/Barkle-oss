<template>
  <span class="mk-user-name" :class="{ nowrap }">
    <Mfm :text="user.name || user.username" :plain="true" :nowrap="false" :custom-emojis="user.emojis" />
    <i v-if="user.isVerified" class="ph-circle-wavy-check verified" title="Verified"></i>
    <i v-if="user.isOG && !user.isVerified" class="ph-bold ph-flower-lotus og" title="OG"></i>
    <span v-if="user.isTranslator"><i class="ph-translate-bold"></i></span>
    <span v-if="user.isPlus || user.isMPlus"><i class="ph-dog-bold"></i></span>
  </span>
</template>

<script lang="ts" setup>
import { } from 'vue';
import * as misskey from 'calckey-js';
import * as os from '@/os';
const props = withDefaults(defineProps<{
  user: misskey.entities.User;
  nowrap?: boolean;
}>(), {
  nowrap: false,
});
</script>

<style scoped>
.mk-user-name {
  display: inline-flex;
  align-items: center;
  flex-wrap: nowrap;
  max-width: 100%;
  justify-content: flex-start;
  overflow: hidden;
}

.mk-user-name.nowrap {
  white-space: nowrap;
}

/* Ensure the name text can truncate properly */
.mk-user-name :deep(.mfm) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1 1 auto;
  min-width: 0;
}

.verified, .og, .staff-icon, .ph-translate-bold, .ph-dog-bold {
  margin-left: 4px;
  font-size: 17px; /* Reduced font size */
  vertical-align: middle; /* Vertically center the badges */
  display: inline-flex;
  flex: 0 0 auto;
  flex-shrink: 0;
}

.staff-icon {
  display: inline-block;
  width: 16px; /* Reduced size */
  height: 16px;
  vertical-align: middle; /* Vertically center the staff icon */
}

.ph-dog-bold {
  color: var(--accent); /* Change the color of the dog badge */
}
</style>