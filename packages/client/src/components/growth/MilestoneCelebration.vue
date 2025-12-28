<template>
	<div v-if="visible" class="milestone-celebration">
		<PositiveFeedback 
			:milestone="milestone"
			:auto-show="true"
			@closed="handleClose"
		/>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import PositiveFeedback from './PositiveFeedback.vue';

interface MilestoneData {
	type: string;
	icon: string;
	title: string;
	body: string;
	actionText?: string;
	actionUrl?: string;
}

const props = defineProps<{
	notificationData?: any;
}>();

const emit = defineEmits<{
	closed: [];
}>();

const visible = ref(false);
const milestone = ref<MilestoneData | null>(null);

onMounted(() => {
	if (props.notificationData) {
		milestone.value = parseMilestoneFromNotification(props.notificationData);
		visible.value = true;
	}
});

function parseMilestoneFromNotification(data: any): MilestoneData {
	// Parse milestone data from notification
	return {
		type: 'celebration',
		icon: data.customIcon || '🎉',
		title: data.customHeader || 'Congratulations!',
		body: data.customBody || 'You achieved something great!',
		actionText: data.actionText,
		actionUrl: data.actionUrl
	};
}

function handleClose() {
	visible.value = false;
	emit('closed');
}
</script>

<style lang="scss" scoped>
.milestone-celebration {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	z-index: 10000;
}
</style>