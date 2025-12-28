<template>
	<MkSpacer :content-max="700">
		<div v-if="$i">
			<div v-if="state === 'waiting'" class="waiting _section">
				<div class="_content">
					<MkLoading />
					<p>{{ i18n.ts._auth.processing || 'Processing authorization...' }}</p>
				</div>
			</div>
			<div v-else-if="state === 'denied'" class="denied _section">
				<div class="_content">
					<i class="ph-x-circle-bold ph-2x"></i>
					<p>{{ i18n.ts._auth.denied || 'Authorization denied' }}</p>
				</div>
			</div>
			<div v-else-if="state === 'accepted'" class="accepted _section">
				<div class="_content">
					<i class="ph-check-circle-bold ph-2x"></i>
					<p>{{ i18n.ts._auth.callback || 'Redirecting...' }}</p>
				</div>
			</div>
			<div v-else class="_section">
				<div v-if="app" class="_title">{{ i18n.t('_auth.shareAccess', { name: app.name }) }}</div>
				<div v-else class="_title">{{ i18n.ts._auth.shareAccessAsk || 'Authorize Application' }}</div>

				<div class="_content" v-if="app">
					<div class="app-info">
						<h3>{{ app.name }}</h3>
						<p class="app-id">{{ props.client_id }}</p>
						<p v-if="app.description">{{ app.description }}</p>
					</div>
				</div>

				<div class="_content">
					<h4>{{ i18n.ts._auth.permissionAsk || 'This application is requesting the following permissions:' }}
					</h4>
					<ul v-if="permissions.length > 0">
						<li v-for="p in permissions" :key="p">{{ getPermissionName(p) }}</li>
					</ul>
					<p v-else>{{ i18n.ts._auth.noPermissionsRequested || 'No specific permissions requested' }}</p>
				</div>

				<div class="_footer">
					<MkButton inline @click="deny">{{ i18n.ts.cancel || 'Cancel' }}</MkButton>
					<MkButton inline primary @click="accept">{{ i18n.ts.accept || 'Accept' }}</MkButton>
				</div>
			</div>
		</div>
		<div v-else class="signin">
			<MkSignin @login="onLogin" />
		</div>
	</MkSpacer>
</template>

<script lang="ts" setup>
import { onMounted } from 'vue';
import MkSignin from '@/components/MkSignin.vue';
import MkButton from '@/components/MkButton.vue';
import * as os from '@/os';
import { $i, login } from '@/account';
import { i18n } from '@/i18n';

const props = defineProps<{
	client_id: string;
	redirect_uri: string;
	response_type: string;
	scope?: string;
	state?: string;
	code_challenge?: string;
	code_challenge_method?: string;
}>();

import { ref } from 'vue';

const state = ref<string | null>(null);
const app = ref<any | null>(null);
const sessionToken = ref<string | null>(null);
const permissions = ref<string[]>([]);

onMounted(async () => {
	if (!props.client_id || !props.redirect_uri || !props.response_type) {
		os.alert({
			type: 'error',
			text: 'Invalid OAuth request parameters',
		});
		return;
	}

	if (props.response_type !== 'code') {
		os.alert({
			type: 'error',
			text: 'Unsupported response type',
		});
		return;
	}

	try {
		// Parse permissions from scope
		permissions.value = props.scope ? props.scope.split(' ').filter(Boolean) : [];

		// Create authorization session
		const authSession = await os.api('oauth/authorize', {
			client_id: props.client_id,
			redirect_uri: props.redirect_uri,
			response_type: props.response_type,
			scope: props.scope,
			state: props.state,
			code_challenge: props.code_challenge,
			code_challenge_method: props.code_challenge_method,
		});

		sessionToken.value = authSession.token;
		app.value = authSession.app;

		// If no app info, try to fetch it
		if (!app.value) {
			try {
				app.value = await os.api('app/show', { appId: props.client_id });
			} catch (e) {
				console.warn('Could not fetch app info:', e);
			}
		}
	} catch (error: any) {
		console.error('OAuth initialization error:', error);
		os.alert({
			type: 'error',
			text: error.message || 'Failed to initialize OAuth authorization',
		});
	}
});

async function accept(): Promise<void> {
	if (!sessionToken.value) return;

	state.value = 'waiting';

	try {
		const response = await os.api('auth/accept', {
			token: sessionToken.value,
		});

		state.value = 'accepted';

		// Handle redirect
		if (response.redirectUri) {
			window.location.href = response.redirectUri;
		} else if (response.authorizationCode) {
			const url = new URL(props.redirect_uri);
			url.searchParams.append('code', response.authorizationCode);
			if (props.state) url.searchParams.append('state', props.state);
			window.location.href = url.toString();
		} else {
			// Fallback redirect
			const url = new URL(props.redirect_uri);
			if (props.state) url.searchParams.append('state', props.state);
			window.location.href = url.toString();
		}
	} catch (error: any) {
		state.value = null;
		os.alert({
			type: 'error',
			text: error.message || 'Authorization failed',
		});
	}
}

function deny(): void {
	state.value = 'denied';

	try {
		const url = new URL(props.redirect_uri);
		url.searchParams.append('error', 'access_denied');
		url.searchParams.append('error_description', 'The user denied the request');
		if (props.state) url.searchParams.append('state', props.state);
		window.location.href = url.toString();
	} catch (error) {
		os.alert({
			type: 'error',
			text: 'Invalid redirect URI',
		});
	}
}

function getPermissionName(permission: string): string {
	try {
		const translated = i18n.t(`_permissions.${permission}`);
		return translated !== `_permissions.${permission}` ? translated : permission;
	} catch {
		return permission;
	}
}

function onLogin(res: any): void {
	login(res.i);
}
</script>

<style lang="scss" scoped>
._section {
	padding: 32px;
	border-radius: 12px;
	background: var(--panel);
	margin-bottom: 16px;
}

.waiting,
.denied,
.accepted {
	text-align: center;

	i {
		font-size: 3rem;
		margin-bottom: 16px;
		display: block;
	}

	&.waiting i {
		color: var(--accent);
	}

	&.accepted i {
		color: var(--success);
	}

	&.denied i {
		color: var(--error);
	}
}

.app-info {
	margin-bottom: 24px;
	padding: 16px;
	background: var(--bg);
	border-radius: 8px;

	h3 {
		margin: 0 0 8px 0;
		font-size: 1.2em;
	}

	.app-id {
		font-family: monospace;
		font-size: 0.9em;
		opacity: 0.7;
		margin: 0 0 12px 0;
	}

	p {
		margin: 0;
		line-height: 1.5;
	}
}

h4 {
	margin: 0 0 16px 0;
	font-weight: 600;
}

ul {
	margin: 0 0 24px 0;
	padding-left: 20px;

	li {
		margin-bottom: 8px;
		line-height: 1.4;
	}
}

._footer {
	display: flex;
	justify-content: flex-end;
	gap: 12px;
	margin-top: 24px;
	padding-top: 24px;
	border-top: 1px solid var(--divider);
}

.signin {
	max-width: 400px;
	margin: 0 auto;
}
</style>