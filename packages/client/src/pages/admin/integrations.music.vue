<template>
<FormSuspense :p="init">
	<div class="_formRoot">
		<FormSection>
			<template #label>Spotify</template>
			<FormSwitch v-model="enableSpotifyIntegration" class="_formBlock">
				<template #label>{{ i18n.ts.enable }}</template>
			</FormSwitch>

			<template v-if="enableSpotifyIntegration">
				<FormInfo class="_formBlock">Callback URL: {{ `${uri}/api/spotify/cb` }}</FormInfo>

				<FormInput v-model="spotifyClientId" class="_formBlock">
					<template #prefix><i class="ph-key-bold ph-lg"></i></template>
					<template #label>Client ID</template>
				</FormInput>

				<FormInput v-model="spotifyClientSecret" class="_formBlock">
					<template #prefix><i class="ph-key-bold ph-lg"></i></template>
					<template #label>Client Secret</template>
				</FormInput>
			</template>
		</FormSection>

		<FormSection>
			<template #label>Last.fm</template>
			<FormSwitch v-model="enableLastfmIntegration" class="_formBlock">
				<template #label>{{ i18n.ts.enable }}</template>
			</FormSwitch>

			<template v-if="enableLastfmIntegration">
				<FormInfo class="_formBlock">Callback URL: {{ `${uri}/api/lastfm/cb` }}</FormInfo>

				<FormInput v-model="lastfmApiKey" class="_formBlock">
					<template #prefix><i class="ph-key-bold ph-lg"></i></template>
					<template #label>API Key</template>
				</FormInput>

				<FormInput v-model="lastfmApiSecret" class="_formBlock">
					<template #prefix><i class="ph-key-bold ph-lg"></i></template>
					<template #label>API Secret</template>
				</FormInput>
			</template>
		</FormSection>

		<FormButton primary class="_formBlock" @click="save"><i class="ph-floppy-disk-back-bold ph-lg"></i> {{ i18n.ts.save }}</FormButton>
	</div>
</FormSuspense>
</template>

<script lang="ts" setup>
import { } from 'vue';
import FormSwitch from '@/components/form/switch.vue';
import FormInput from '@/components/form/input.vue';
import FormButton from '@/components/MkButton.vue';
import FormInfo from '@/components/MkInfo.vue';
import FormSection from '@/components/form/section.vue';
import FormSuspense from '@/components/form/suspense.vue';
import * as os from '@/os';
import { fetchInstance } from '@/instance';
import { i18n } from '@/i18n';

let uri: string = $ref('');
let enableSpotifyIntegration: boolean = $ref(false);
let spotifyClientId: string | null = $ref(null);
let spotifyClientSecret: string | null = $ref(null);
let enableLastfmIntegration: boolean = $ref(false);
let lastfmApiKey: string | null = $ref(null);
let lastfmApiSecret: string | null = $ref(null);

async function init() {
	const meta = await os.api('admin/meta');
	uri = meta.uri;
	enableSpotifyIntegration = meta.enableSpotifyIntegration;
	spotifyClientId = meta.spotifyClientId;
	spotifyClientSecret = meta.spotifyClientSecret;
	enableLastfmIntegration = meta.enableLastfmIntegration;
	lastfmApiKey = meta.lastfmApiKey;
	lastfmApiSecret = meta.lastfmApiSecret;
}

function save() {
	os.apiWithDialog('admin/update-meta', {
		enableSpotifyIntegration,
		spotifyClientId,
		spotifyClientSecret,
		enableLastfmIntegration,
		lastfmApiKey,
		lastfmApiSecret,
	}).then(() => {
		fetchInstance();
	});
}
</script>
