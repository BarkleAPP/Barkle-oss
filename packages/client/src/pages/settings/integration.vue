<template>
<div class="_formRoot">
	<FormSection v-if="instance.enableTwitterIntegration">
		<template #label><i class="ph-twitter-logo-bold ph-lg"></i> Twitter</template>
		<p v-if="integrations.twitter">{{ i18n.ts.connectedTo }}: <a :href="`https://twitter.com/${integrations.twitter.screenName}`" rel="nofollow noopener" target="_blank">@{{ integrations.twitter.screenName }}</a></p>
		<MkButton v-if="integrations.twitter" danger @click="disconnectTwitter">{{ i18n.ts.disconnectService }}</MkButton>
		<MkButton v-else primary @click="connectTwitter">{{ i18n.ts.connectService }}</MkButton>
	</FormSection>

	<FormSection v-if="instance.enableDiscordIntegration">
		<template #label><i class="ph-discord-logo-bold ph-lg"></i> Discord</template>
		<p v-if="integrations.discord">{{ i18n.ts.connectedTo }}: <a :href="`https://discord.com/users/${integrations.discord.id}`" rel="nofollow noopener" target="_blank">@{{ integrations.discord.username }}#{{ integrations.discord.discriminator }}</a></p>
		<MkButton v-if="integrations.discord" danger @click="disconnectDiscord">{{ i18n.ts.disconnectService }}</MkButton>
		<MkButton v-else primary @click="connectDiscord">{{ i18n.ts.connectService }}</MkButton>
	</FormSection>

	<FormSection v-if="instance.enableGithubIntegration">
		<template #label><i class="ph-github-logo-bold ph-lg"></i> GitHub</template>
		<p v-if="integrations.github">{{ i18n.ts.connectedTo }}: <a :href="`https://github.com/${integrations.github.login}`" rel="nofollow noopener" target="_blank">@{{ integrations.github.login }}</a></p>
		<MkButton v-if="integrations.github" danger @click="disconnectGithub">{{ i18n.ts.disconnectService }}</MkButton>
		<MkButton v-else primary @click="connectGithub">{{ i18n.ts.connectService }}</MkButton>
	</FormSection>

	<FormSection v-if="instance.enableSpotifyIntegration">
		<template #label><i class="ph-spotify-logo-bold ph-lg"></i> Spotify</template>
		<p v-if="integrations.spotify">{{ i18n.ts.connectedTo }}: <a :href="`https://open.spotify.com/user/${integrations.spotify.externalUserId}`" rel="nofollow noopener" target="_blank">@{{ integrations.spotify.username }}</a></p>
		<MkButton v-if="integrations.spotify" danger @click="disconnectSpotify">{{ i18n.ts.disconnectService }}</MkButton>
		<MkButton v-else primary @click="connectSpotify">{{ i18n.ts.connectService }}</MkButton>
	</FormSection>

	<FormSection>
		<template #label><i class="ph-music-note-bold ph-lg"></i> Last.fm</template>
		<FormInput v-model="lastfmUsername" class="_formBlock">
			<template #label>Last.fm Username</template>
			<template #prefix><i class="ph-music-note-bold ph-lg"></i></template>
			<template #caption>Enter your Last.fm username to display your currently playing music on your profile</template>
		</FormInput>
		<div class="_formBlock">
			<MkButton v-if="hasLastfmIntegration" danger @click="disconnectLastfm">{{ i18n.ts.disconnectService }}</MkButton>
			<MkButton v-else primary @click="connectLastfm" :disabled="!lastfmUsername || lastfmUsername.trim() === ''">Save Last.fm Username</MkButton>
		</div>
	</FormSection>
</div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch, nextTick } from 'vue';
import { apiUrl } from '@/config';
import FormSection from '@/components/form/section.vue';
import FormInput from '@/components/form/input.vue';
import MkButton from '@/components/MkButton.vue';
import { $i } from '@/account';
import * as os from '@/os';
import { instance } from '@/instance';
import { i18n } from '@/i18n';
import { definePageMetadata } from '@/scripts/page-metadata';

const twitterForm = ref<Window | null>(null);
const discordForm = ref<Window | null>(null);
const githubForm = ref<Window | null>(null);
const spotifyForm = ref<Window | null>(null);

const integrations = computed(() => $i!.integrations);

const lastfmUsername = ref($i?.lastfmUsername || '');
const hasLastfmIntegration = computed(() => {
	// Check if user has a Last.fm username set
	return !!$i?.lastfmUsername;
});

function openWindow(service: string, type: string) {
	return window.open(`${apiUrl}/${type}/${service}`,
		`${service}_${type}_window`,
		'height=570, width=520',
	);
}

function connectTwitter() {
	twitterForm.value = openWindow('twitter', 'connect');
}

function disconnectTwitter() {
	openWindow('twitter', 'disconnect');
}

function connectDiscord() {
	discordForm.value = openWindow('discord', 'connect');
}

function disconnectDiscord() {
	openWindow('discord', 'disconnect');
}

function connectGithub() {
	githubForm.value = openWindow('github', 'connect');
}

function disconnectGithub() {
	openWindow('github', 'disconnect');
}

function connectSpotify() {
	spotifyForm.value = openWindow('spotify', 'connect');
}

function disconnectSpotify() {
	openWindow('spotify', 'disconnect');
}

async function connectLastfm() {
	if (!lastfmUsername.value || lastfmUsername.value.trim() === '') {
		return;
	}
	
	try {
		await os.api('i/update', {
			lastfmUsername: lastfmUsername.value.trim()
		} as any);
		// Use nextTick to ensure DOM is updated before showing success
		await nextTick();
		os.success();
	} catch (error) {
		os.alert({
			type: 'error',
			text: 'Failed to connect Last.fm integration'
		});
	}
}

async function disconnectLastfm() {
	try {
		await os.api('i/update', {
			lastfmUsername: ''
		} as any);
		lastfmUsername.value = '';
		// Use nextTick to ensure DOM is updated before showing success
		await nextTick();
		os.success();
	} catch (error) {
		os.alert({
			type: 'error',
			text: 'Failed to disconnect Last.fm integration'
		});
	}
}

onMounted(async () => {
	document.cookie = `igi=${$i!.token}; path=/;` +
		' max-age=31536000;' +
		(document.location.protocol.startsWith('https') ? ' secure' : '');

	// Get current user data to populate existing integrations
	const userData = await os.api('i');
	lastfmUsername.value = (userData as any).lastfmUsername || '';

	watch(integrations, () => {
		if (integrations.value.twitter) {
			if (twitterForm.value) twitterForm.value.close();
		}
		if (integrations.value.discord) {
			if (discordForm.value) discordForm.value.close();
		}
		if (integrations.value.github) {
			if (githubForm.value) githubForm.value.close();
		}
		if (integrations.value.spotify) {
			if (spotifyForm.value) spotifyForm.value.close();
		}
	});
});

definePageMetadata({
	title: i18n.ts.integration,
	icon: 'ph-share-network-bold ph-lg',
});
</script>
