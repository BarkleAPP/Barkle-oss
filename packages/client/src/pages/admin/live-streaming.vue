<template>
<MkStickyContainer>
	<template #header>
		<XHeader :actions="headerActions" :tabs="headerTabs"/>
	</template>
	<MkSpacer :content-max="700" :margin-min="16" :margin-max="32">
		<FormSuspense :p="init">
			<div class="_formRoot">
				<FormSection>
					<template #label>{{ i18n.ts.liveStreamingSettings }}</template>
					<FormInfo>{{ i18n.ts.liveStreamingSettingsDescription }}</FormInfo>
					
					<FormInput v-model="muxAccessToken" type="password" class="_formBlock">
						<template #label>{{ i18n.ts.muxAccessToken }}</template>
						<template #caption>{{ i18n.ts.muxAccessTokenDescription }}</template>
					</FormInput>
					
					<FormInput v-model="muxSecretKey" type="password" class="_formBlock">
						<template #label>{{ i18n.ts.muxSecretKey }}</template>
						<template #caption>{{ i18n.ts.muxSecretKeyDescription }}</template>
					</FormInput>
					
					<FormInput v-model="muxTokenId" type="password" class="_formBlock">
						<template #label>{{ i18n.ts.muxTokenId }}</template>
						<template #caption>{{ i18n.ts.muxTokenIdDescription }}</template>
					</FormInput>
					
					<FormInput v-model="muxWebhookSecret" type="password" class="_formBlock">
						<template #label>{{ i18n.ts.muxWebhookSecret }}</template>
						<template #caption>{{ i18n.ts.muxWebhookSecretDescription }}</template>
					</FormInput>
					
					<FormInput v-model="muxSigningKeyId" type="password" class="_formBlock">
						<template #label>Mux Signing Key ID</template>
						<template #caption>Your Mux signing key ID for live stream health stats</template>
					</FormInput>
					
					<FormInput v-model="muxSigningKeyPrivate" type="password" class="_formBlock">
						<template #label>Mux Signing Key (Private)</template>
						<template #caption>Your base64-encoded Mux private signing key</template>
					</FormInput>
				</FormSection>
			</div>
		</FormSuspense>
	</MkSpacer>
</MkStickyContainer>
</template>

<script lang="ts" setup>
import XHeader from './_header_.vue';
import FormSection from '@/components/form/section.vue';
import FormInput from '@/components/form/input.vue';
import FormInfo from '@/components/form/info.vue';
import FormSuspense from '@/components/form/suspense.vue';
import * as os from '@/os';
import { fetchInstance } from '@/instance';
import { i18n } from '@/i18n';
import { definePageMetadata } from '@/scripts/page-metadata';

let muxAccessToken: string | null = $ref(null);
let muxSecretKey: string | null = $ref(null);
let muxTokenId: string | null = $ref(null);
let muxWebhookSecret: string | null = $ref(null);
let muxSigningKeyId: string | null = $ref(null);
let muxSigningKeyPrivate: string | null = $ref(null);

async function init() {
	const meta = await os.api('admin/meta');
	muxAccessToken = meta.mux_access;
	muxSecretKey = meta.mux_secret_key;
	muxTokenId = meta.mux_token_id;
	muxWebhookSecret = meta.mux_webhook_secret;
	muxSigningKeyId = meta.mux_signing_key_id;
	muxSigningKeyPrivate = meta.mux_signing_key_private;
}

function save() {
	os.apiWithDialog('admin/update-meta', {
		muxAccessToken,
		muxSecretKey,
		muxTokenId,
		muxWebhookSecret,
		muxSigningKeyId,
		muxSigningKeyPrivate,
	}).then(() => {
		fetchInstance();
	});
}

const headerActions = $computed(() => [{
	handler: save,
	icon: 'ph-check-bold ph-lg',
	text: i18n.ts.save,
	primary: true,
}]);

const headerTabs = $computed(() => []);

definePageMetadata({
	title: i18n.ts.liveStreamingSettings,
	icon: 'ph-broadcast-bold',
});
</script>
