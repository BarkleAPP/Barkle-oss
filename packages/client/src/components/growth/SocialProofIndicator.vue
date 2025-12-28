<template>
	<div v-if="shouldShow" class="social-proof-indicator" :class="indicatorClass">
		<div v-if="type === 'activity'" class="activity-indicator">
			<div class="pulse-dot"></div>
			<span class="activity-text">{{ activityText }}</span>
		</div>
		
		<div v-else-if="type === 'engagement'" class="engagement-indicator">
			<i class="fas fa-fire" :class="{ 'trending': isTrending }"></i>
			<span class="engagement-text">{{ engagementText }}</span>
		</div>
		
		<div v-else-if="type === 'social'" class="social-indicator">
			<div class="avatar-stack">
				<MkAvatar 
					v-for="user in socialUsers.slice(0, 3)" 
					:key="user.id"
					:user="user" 
					class="stacked-avatar"
					:size="20"
				/>
			</div>
			<span class="social-text">{{ socialText }}</span>
		</div>
		
		<div v-else-if="type === 'trending'" class="trending-indicator">
			<div class="trending-icon">
				<i class="fas fa-chart-line"></i>
			</div>
			<span class="trending-text">{{ i18n.ts.trending }}</span>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { i18n } from '@/i18n';

interface Props {
	type: 'activity' | 'engagement' | 'social' | 'trending';
	data?: any;
	userId?: string;
	noteId?: string;
	threshold?: number;
	autoHide?: boolean;
	hideDelay?: number;
}

const props = withDefaults(defineProps<Props>(), {
	threshold: 1,
	autoHide: true,
	hideDelay: 5000,
});

const isVisible = ref(true);
let hideTimer: number | null = null;

const shouldShow = computed(() => {
	if (!isVisible.value) return false;
	
	switch (props.type) {
		case 'activity':
			return props.data?.activeCount > 0;
		case 'engagement':
			return props.data?.engagementCount >= props.threshold;
		case 'social':
			return props.data?.socialUsers?.length > 0;
		case 'trending':
			return props.data?.isTrending === true;
		default:
			return false;
	}
});

const indicatorClass = computed(() => ({
	[`indicator-${props.type}`]: true,
	'trending': props.type === 'engagement' && isTrending.value,
	'high-activity': props.type === 'activity' && (props.data?.activeCount || 0) > 5,
}));

const activityText = computed(() => {
	const count = props.data?.activeCount || 0;
	if (count === 1) return i18n.ts.onePersonActive;
	return i18n.t('peopleActive', { count });
});

const engagementText = computed(() => {
	const count = props.data?.engagementCount || 0;
	if (isTrending.value) {
		return i18n.t('trendingWithCount', { count });
	}
	return i18n.t('engagementCount', { count });
});

const socialText = computed(() => {
	const users = props.data?.socialUsers || [];
	const count = users.length;
	
	if (count === 1) {
		return i18n.t('friendLikesThis', { name: users[0].name || users[0].username });
	} else if (count === 2) {
		return i18n.t('twoFriendsLikeThis', { 
			name1: users[0].name || users[0].username,
			name2: users[1].name || users[1].username 
		});
	} else {
		return i18n.t('friendsLikeThis', { 
			name: users[0].name || users[0].username,
			count: count - 1 
		});
	}
});

const socialUsers = computed(() => props.data?.socialUsers || []);

const isTrending = computed(() => {
	const engagement = props.data?.engagementCount || 0;
	const timeWindow = props.data?.timeWindow || 3600; // 1 hour default
	const rate = engagement / (timeWindow / 3600); // engagements per hour
	return rate > 10; // Trending if more than 10 engagements per hour
});

onMounted(() => {
	if (props.autoHide && props.hideDelay > 0) {
		hideTimer = setTimeout(() => {
			isVisible.value = false;
		}, props.hideDelay);
	}
});

onUnmounted(() => {
	if (hideTimer) {
		clearTimeout(hideTimer);
	}
});

function hide() {
	isVisible.value = false;
}

defineExpose({
	hide,
});
</script>

<style lang="scss" scoped>
.social-proof-indicator {
	display: inline-flex;
	align-items: center;
	gap: 8px;
	padding: 4px 8px;
	border-radius: 12px;
	font-size: 0.85em;
	font-weight: 500;
	transition: all 0.3s ease;
	
	&.indicator-activity {
		background: rgba(var(--accent), 0.1);
		color: rgb(var(--accent));
		border: 1px solid rgba(var(--accent), 0.2);
		
		&.high-activity {
			background: rgba(var(--accent), 0.15);
			animation: pulse-glow 2s infinite;
		}
	}
	
	&.indicator-engagement {
		background: rgba(255, 107, 107, 0.1);
		color: #ff6b6b;
		border: 1px solid rgba(255, 107, 107, 0.2);
		
		&.trending {
			background: rgba(255, 107, 107, 0.15);
			animation: trending-pulse 1.5s infinite;
		}
	}
	
	&.indicator-social {
		background: rgba(74, 144, 226, 0.1);
		color: #4a90e2;
		border: 1px solid rgba(74, 144, 226, 0.2);
	}
	
	&.indicator-trending {
		background: rgba(255, 193, 7, 0.1);
		color: #ffc107;
		border: 1px solid rgba(255, 193, 7, 0.2);
		animation: trending-shine 3s infinite;
	}
}

.activity-indicator {
	display: flex;
	align-items: center;
	gap: 6px;
}

.pulse-dot {
	width: 8px;
	height: 8px;
	border-radius: 50%;
	background: currentColor;
	animation: pulse 2s infinite;
}

.engagement-indicator {
	display: flex;
	align-items: center;
	gap: 6px;
	
	.fas.fa-fire {
		transition: all 0.3s ease;
		
		&.trending {
			animation: fire-flicker 1s infinite alternate;
		}
	}
}

.social-indicator {
	display: flex;
	align-items: center;
	gap: 8px;
}

.avatar-stack {
	display: flex;
	margin-right: 4px;
	
	.stacked-avatar {
		margin-left: -6px;
		border: 2px solid var(--panel);
		border-radius: 50%;
		
		&:first-child {
			margin-left: 0;
		}
	}
}

.trending-indicator {
	display: flex;
	align-items: center;
	gap: 6px;
}

.trending-icon {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 16px;
	height: 16px;
}

@keyframes pulse {
	0%, 100% { opacity: 1; transform: scale(1); }
	50% { opacity: 0.7; transform: scale(1.1); }
}

@keyframes pulse-glow {
	0%, 100% { box-shadow: 0 0 0 rgba(var(--accent), 0.4); }
	50% { box-shadow: 0 0 8px rgba(var(--accent), 0.6); }
}

@keyframes trending-pulse {
	0%, 100% { transform: scale(1); }
	50% { transform: scale(1.05); }
}

@keyframes trending-shine {
	0%, 100% { opacity: 1; }
	50% { opacity: 0.8; }
}

@keyframes fire-flicker {
	0% { transform: rotate(-2deg) scale(1); }
	100% { transform: rotate(2deg) scale(1.1); }
}
</style>