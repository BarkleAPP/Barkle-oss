<template>
	<i v-if="show" class="ph-fire-simple-bold ph-lg trending-icon" :title="i18n.ts.trending"></i>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { i18n } from '@/i18n';

const props = defineProps<{
	show: boolean;
}>();
</script>

<style lang="scss" scoped>
.trending-icon {
	color: var(--accent);
	animation: pulse 2s ease-in-out infinite;
	margin-left: 4px;
}

@keyframes pulse {
	0%, 100% {
		opacity: 1;
	}
	50% {
		opacity: 0.7;
	}
}
</style>
