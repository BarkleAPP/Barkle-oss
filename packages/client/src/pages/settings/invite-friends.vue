<template>
	<div class="_formRoot">
		<InviteFriends />
	</div>
</template>

<script lang="ts" setup>
import { definePageMetadata } from '@/scripts/page-metadata';
import { i18n } from '@/i18n';
import InviteFriends from '@/components/growth/InviteFriends.vue';

const headerActions = $computed(() => []);

const headerTabs = $computed(() => []);

definePageMetadata({
	title: i18n.ts.inviteFriends,
	icon: 'ph-users-three-bold ph-lg',
});
</script>
