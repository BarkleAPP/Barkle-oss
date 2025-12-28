<template>
<div>
	{{ i18n.ts.processing }}
</div>
</template>

<script lang="ts" setup>
import { onMounted } from 'vue';
import * as os from '@/os';
import { login } from '@/account';
import { i18n } from '@/i18n';
import { definePageMetadata } from '@/scripts/page-metadata';

const props = defineProps<{
	code: string;
}>();

onMounted(async () => {
	await os.alert({
		type: 'info',
		text: i18n.t('clickToFinishEmailVerification', { ok: i18n.ts.gotIt }),
	});
	const res = await os.apiWithDialog('signup-pending', {
		code: props.code,
	});
	
	// Check for pending invitation after successful signup
	const pendingInviteCode = sessionStorage.getItem('pendingInviteCode');
	if (pendingInviteCode) {
		try {
			// Accept the invitation with new signup flag
			await os.api('invitations/accept', { 
				inviteCode: pendingInviteCode,
				isNewSignup: true
			});
			
			// Clear the pending invitation
			sessionStorage.removeItem('pendingInviteCode');
			
			// Show success message with reward info
			os.success('🎉 Invitation accepted! You and your friend both received 1 week of Barkle+ as a welcome gift!');
		} catch (error) {
			console.error('Failed to accept invitation after signup:', error);
			// Don't block the signup process if invitation acceptance fails
		}
	}
	
	login(res.i, '/');
});

const headerActions = $computed(() => []);

const headerTabs = $computed(() => []);

definePageMetadata({
	title: i18n.ts.signup,
	icon: 'ph-user-bold ph-lg',
});
</script>

<style lang="scss" scoped>

</style>
