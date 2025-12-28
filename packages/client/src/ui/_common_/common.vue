<template>
<!-- Debug: Force visibility of any popup components -->
<div v-if="dev" class="popup-debug-container">
	<div v-for="(popup, index) in popups" :key="popup.id" class="popup-debug-item">
		<h3>Popup {{ index + 1 }} (ID: {{ popup.id }})</h3>
		<p>Component: {{ popup.component?.name || 'Unnamed' }}</p>
		<p>Props: {{ JSON.stringify(popup.props) }}</p>
		<component
			:is="popup.component"
			v-bind="popup.props"
			v-on="popup.events"
			class="popup-debug-forced"
		/>
	</div>
</div>

<!-- Original popup rendering -->
<component
	:is="popup.component"
	v-for="popup in popups"
	:key="popup.id"
	v-bind="popup.props"
	v-on="popup.events"
/>

<XUpload v-if="uploads.length > 0"/>

<XStreamIndicator/>

<!-- <div v-if="pendingApiRequestsCount > 0" id="wait"></div> -->

<div v-if="dev" id="devTicker"><span>DEV BUILD</span></div>

<!-- Debug popup count -->
<div v-if="dev" style="position: fixed; top: 10px; right: 10px; background: red; color: white; padding: 5px; z-index: 9999;">
	Popups: {{ popups.length }}
</div>
</template>

<script lang="ts" setup>
import { defineAsyncComponent, watch, onMounted } from 'vue';
import { swInject } from './sw-inject';
import { popup, popups, pendingApiRequestsCount } from '@/os';
import { uploads } from '@/scripts/upload';
import * as sound from '@/scripts/sound';
import { $i } from '@/account';
import { stream } from '@/stream';

const XStreamIndicator = defineAsyncComponent(() => import('./stream-indicator.vue'));
const XUpload = defineAsyncComponent(() => import('./upload.vue'));

const dev = _DEV_;

// Debug popup reactivity
console.log('🏗️ XCommon mounted, initial popups:', popups.value.length);

watch(popups, (newPopups) => {
	console.log('🔄 XCommon detected popup change:', newPopups.length);
	console.log('🔄 Popup components:', newPopups.map(p => p.component?.name || 'unnamed'));
}, { deep: true });

onMounted(() => {
	console.log('🏗️ XCommon onMounted, popups:', popups.value.length);
});

const onNotification = notification => {
	if ($i.mutingNotificationTypes.includes(notification.type)) return;

	if (document.visibilityState === 'visible') {
		stream.send('readNotification', {
			id: notification.id,
		});

		popup(defineAsyncComponent(() => import('@/components/MkNotificationToast.vue')), {
			notification,
		}, {}, 'closed');
	}

	sound.play('notification');
};

if ($i) {
	const connection = stream.useChannel('main', null, 'UI');
	connection.on('notification', onNotification);

	//#region Listen message from SW
	if ('serviceWorker' in navigator) {
		swInject();
	}
}
</script>

<style lang="scss">
@keyframes dev-ticker-blink {
	0% { opacity: 1; }
	50% { opacity: 0; }
	100% { opacity: 1; }
}

@keyframes progress-spinner {
	0% {
		transform: rotate(0deg);
	}
	100% {
		transform: rotate(360deg);
	}
}

.popup-debug-container {
	position: fixed;
	top: 50px;
	left: 10px;
	background: rgba(0, 0, 0, 0.9);
	color: white;
	padding: 10px;
	border-radius: 5px;
	z-index: 10000;
	max-width: 500px;
	max-height: 80vh;
	overflow: auto;

	.popup-debug-item {
		border: 1px solid #444;
		margin: 10px 0;
		padding: 10px;
		border-radius: 3px;

		h3 {
			margin: 0 0 5px 0;
			color: #ffa500;
		}

		p {
			margin: 2px 0;
			font-size: 12px;
		}

		.popup-debug-forced {
			border: 2px solid red !important;
			background: rgba(255, 0, 0, 0.1) !important;
		}
	}
}

#wait {
	display: block;
	position: fixed;
	z-index: 4000000;
	top: 15px;
	right: 15px;

	&:before {
		content: "";
		display: block;
		width: 18px;
		height: 18px;
		box-sizing: border-box;
		border: solid 2px transparent;
		border-top-color: var(--accent);
		border-left-color: var(--accent);
		border-radius: 50%;
		animation: progress-spinner 400ms linear infinite;
	}
}

#devTicker {
	position: fixed;
	top: 0;
	left: 0;
	z-index: 2147483647;
	color: #f6c177;
	background: #6e6a86;
	padding: 4px 5px;
	font-size: 14px;
	pointer-events: none;
	user-select: none;

	> span {
		animation: dev-ticker-blink 2s infinite;
	}
}
</style>
