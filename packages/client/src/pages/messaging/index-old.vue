<template>
  <ModernMessaging />
</template>
	
	<script lang="ts" setup>
	import { markRaw, onMounted, onUnmounted, watch } from 'vue';
	import * as Acct from 'calckey-js/built/acct';
	import { Virtual } from 'swiper';
	import { Swiper, SwiperSlide } from 'swiper/vue';
	import MkButton from '@/components/MkButton.vue';
	import MkChatPreview from '@/components/MkChatPreview.vue';
	import MkPagination from '@/components/MkPagination.vue';
	import * as os from '@/os';
	import { stream } from '@/stream';
	import { useRouter } from '@/router';
	import { i18n } from '@/i18n';
	import { definePageMetadata } from '@/scripts/page-metadata';
	import { $i } from '@/account';
	import { deviceKind } from '@/scripts/device-kind';
	import { defaultStore } from '@/store';
	import 'swiper/scss';
	import 'swiper/scss/virtual';
	
	const router = useRouter();
	
	let messages = $ref([]);
	let connection = $ref(null);
	
	const tabs = ['dms', 'groups'];
	let tab = $ref(tabs[0]);
	watch($$(tab), () => (syncSlide(tabs.indexOf(tab))));
	
	const headerActions = $computed(() => [{
		asFullButton: true,
		icon: 'ph-plus-bold ph-lg',
		text: i18n.ts.addUser,
		handler: startMenu,
	}]);
	
	const headerTabs = $computed(() => [{
		key: 'dms',
		title: i18n.ts._messaging.dms,
		icon: 'ph-user-bold ph-lg',
	}, {
		key: 'groups',
		title: i18n.ts._messaging.groups,
		icon: 'ph-users-three-bold ph-lg',
	}]);
	
	definePageMetadata({
		title: i18n.ts.messaging,
		icon: 'ph-chats-teardrop-bold ph-lg',
	});
	
	const dmsPagination = {
		endpoint: 'messaging/history' as const,
		limit: 5,
		params: {
			group: false,
		},
	};
	const groupsPagination = {
		endpoint: 'messaging/history' as const,
		limit: 5,
		params: {
			group: true,
		},
	};
	
	function onMessage(message): void {
		if (message.recipientId) {
			messages = messages.filter(m => !(
				(m.recipientId === message.recipientId && m.userId === message.userId) ||
					(m.recipientId === message.userId && m.userId === message.recipientId)));
	
			messages.unshift(message);
		} else if (message.groupId) {
			messages = messages.filter(m => m.groupId !== message.groupId);
			messages.unshift(message);
		}
	}
	
	function onRead(ids): void {
		for (const id of ids) {
			const found = messages.find(m => m.id === id);
			if (found) {
				if (found.recipientId) {
					found.isRead = true;
				} else if (found.groupId) {
					found.reads.push($i.id);
				}
			}
		}
	}
	
	function markAsRead(id) {
	  os.api('messaging/messages/read', { messageId: id }).then(() => {
		const found = messages.find(m => m.id === id);
		if (found) {
		  found.isRead = true;
		}
	  }).catch(err => console.error(err));
	}
	
	function isUnread(message) {
	  if (message.recipientId) {
		return message.userId !== $i?.id && !message.isRead;
	  } else if (message.groupId) {
		return message.userId !== $i?.id && !message.reads.includes($i?.id);
		//return !message.reads.includes($i.id);
	  }
	  return false;
	}
	
	function startMenu(ev) {
		os.popupMenu([{
			text: i18n.ts.messagingWithUser,
			icon: 'ph-user-bold ph-lg',
			action: () => { startUser(); },
		}, {
			text: i18n.ts.messagingWithGroup,
			icon: 'ph-users-three-bold ph-lg',
			action: () => { startGroup(); },
		}], ev.currentTarget ?? ev.target);
	}
	
	async function startUser(): void {
		os.selectUser().then(user => {
			router.push(`/my/messaging/${Acct.toString(user)}`);
		});
	}
	
	async function startGroup(): void {
		const groups1 = await os.api('users/groups/owned');
		const groups2 = await os.api('users/groups/joined');
		if (groups1.length === 0 && groups2.length === 0) {
			os.alert({
				type: 'warning',
				title: i18n.ts.youHaveNoGroups,
				text: i18n.ts.joinOrCreateGroup,
			});
			return;
		}
		const { canceled, result: group } = await os.select({
			title: i18n.ts.group,
			items: groups1.concat(groups2).map(group => ({
				value: group, text: group.name,
			})),
		});
		if (canceled) return;
		router.push(`/my/messaging/group/${group.id}`);
	}
	
	let swiperRef = null;
	
	function setSwiperRef(swiper) {
		swiperRef = swiper;
		syncSlide(tabs.indexOf(tab));
	}
	
	function onSlideChange() {
		tab = tabs[swiperRef.activeIndex];
	}
	
	function syncSlide(index) {
		if (swiperRef && swiperRef.activeIndex !== index) {
			swiperRef.slideTo(index);
		}
	}
	
	stream.once('read', onRead);
	stream.once('message', onMessage);
	onUnmounted(() => {
		stream.off('read', onRead);
		stream.off('message', onMessage);
	});
	</script>
	
	<style lang="scss" scoped>
	.yweeujhr {
		> .start {
			margin: 0 auto var(--margin) auto;
		}
	
		> .groupsbuttons {
			max-width: 100%;
			display: flex;
			justify-content: center;
			margin-bottom: 1rem;
		}
	
		.message {
			position: relative;
		}
	
		.unread-indicator {
			position: absolute;
			top: 8px;
			right: 8px;
			width: 10px;
			height: 10px;
			border-radius: 50%;
			background-color: var(--accent);
			animation: blink 1s infinite;
		}
	}
	</style>