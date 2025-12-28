<template>
	<div class="quick-bark-viewers">
		<div v-for="user in viewers" :key="user.id" class="viewer-item">
			<MkStaticAvatar :user="user" />
			<span class="username">{{ user.name }}</span>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { User } from '@/models';
import MkStaticAvatar from '@/components/MkStaticAvatar.vue';

const props = defineProps<{
	viewers: User[];
}>();
</script>

<style lang="scss" scoped>
.quick-bark-viewers {
	padding: 16px;
	background: var(--bg);
	border-radius: var(--radius);

	.viewer-item {
		display: flex;
		align-items: center;
		margin-bottom: 8px;

		.username {
			margin-left: 8px;
		}
	}
}
</style>
