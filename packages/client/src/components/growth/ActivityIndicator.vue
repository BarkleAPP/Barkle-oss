<template>
	<div v-if="shouldShow" class="activity-indicator" :class="indicatorClass">
		<div v-if="isOnline" class="online-indicator">
			<div class="pulse"></div>
		</div>
		<div v-else-if="recentActivity" class="recent-activity">
			<i class="fas fa-circle"></i>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';

interface Props {
	isOnline?: boolean;
	lastActiveAt?: string | Date;
	variant?: 'dot' | 'subtle' | 'minimal';
	showRecent?: boolean;
	recentThreshold?: number; // minutes
}

const props = withDefaults(defineProps<Props>(), {
	isOnline: false,
	variant: 'subtle',
	showRecent: true,
	recentThreshold: 30, // 30 minutes
});

const recentActivity = computed(() => {
	if (!props.showRecent || !props.lastActiveAt) return false;
	
	const lastActive = new Date(props.lastActiveAt);
	const now = new Date();
	const diffMinutes = (now.getTime() - lastActive.getTime()) / (1000 * 60);
	
	return diffMinutes <= props.recentThreshold;
});

const shouldShow = computed(() => {
	return props.isOnline || recentActivity.value;
});

const indicatorClass = computed(() => ({
	[props.variant]: true,
	'online': props.isOnline,
	'recent': recentActivity.value && !props.isOnline,
}));
</script>

<style lang="scss" scoped>
.activity-indicator {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	
	&.dot {
		width: 8px;
		height: 8px;
		
		.online-indicator, .recent-activity {
			width: 100%;
			height: 100%;
			border-radius: 50%;
		}
	}
	
	&.subtle {
		width: 6px;
		height: 6px;
		
		.online-indicator, .recent-activity {
			width: 100%;
			height: 100%;
			border-radius: 50%;
		}
	}
	
	&.minimal {
		width: 4px;
		height: 4px;
		
		.online-indicator, .recent-activity {
			width: 100%;
			height: 100%;
			border-radius: 50%;
		}
	}
	
	&.online {
		.online-indicator {
			background: #2ecc71;
			position: relative;
			
			.pulse {
				position: absolute;
				top: 0;
				left: 0;
				width: 100%;
				height: 100%;
				border-radius: 50%;
				background: #2ecc71;
				animation: pulse 2s infinite;
			}
		}
	}
	
	&.recent {
		.recent-activity {
			background: #f39c12;
			
			i {
				display: none;
			}
		}
	}
}

@keyframes pulse {
	0% {
		transform: scale(1);
		opacity: 1;
	}
	50% {
		transform: scale(1.2);
		opacity: 0.7;
	}
	100% {
		transform: scale(1);
		opacity: 1;
	}
}
</style>