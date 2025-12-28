<template>
<FormSuspense :p="init">
	<div class="_formRoot">
		<FormSwitch v-model="enableFirebaseMessaging" class="_formBlock">
			<template #label>Enable Firebase Cloud Messaging</template>
			<template #caption>Enable push notifications for iOS and Android apps</template>
		</FormSwitch>

		<template v-if="enableFirebaseMessaging">
			<FormInfo class="_formBlock">
				Firebase configuration is required for push notifications to work in mobile apps.
				Get these values from your Firebase Console → Project Settings → General → Your apps.
			</FormInfo>

			<FormSection>
				<template #label>Firebase Project Configuration</template>

				<FormInput v-model="firebaseProjectId" class="_formBlock">
					<template #prefix><i class="ph-projector-screen-bold ph-lg"></i></template>
					<template #label>Firebase Project ID</template>
					<template #caption>Optional - will be extracted from service account JSON if not provided</template>
				</FormInput>				<FormInput v-model="firebaseApiKey" class="_formBlock">
					<template #prefix><i class="ph-key-bold ph-lg"></i></template>
					<template #label>API Key</template>
					<template #caption>Web API key from Firebase config</template>
				</FormInput>

				<FormInput v-model="firebaseAuthDomain" class="_formBlock">
					<template #prefix><i class="ph-globe-bold ph-lg"></i></template>
					<template #label>Auth Domain</template>
					<template #caption>Firebase auth domain (project.firebaseapp.com)</template>
				</FormInput>

				<FormInput v-model="firebaseStorageBucket" class="_formBlock">
					<template #prefix><i class="ph-cloud-bold ph-lg"></i></template>
					<template #label>Storage Bucket</template>
					<template #caption>Firebase storage bucket URL</template>
				</FormInput>

				<FormInput v-model="firebaseMessagingSenderId" class="_formBlock">
					<template #prefix><i class="ph-bell-ringing-bold ph-lg"></i></template>
					<template #label>Messaging Sender ID</template>
					<template #caption>Sender ID for FCM messages</template>
				</FormInput>

				<FormInput v-model="firebaseAppId" class="_formBlock">
					<template #prefix><i class="ph-app-window-bold ph-lg"></i></template>
					<template #label>App ID</template>
					<template #caption>Firebase app identifier</template>
				</FormInput>

				<FormInput v-model="firebaseVapidPublicKey" class="_formBlock">
					<template #prefix><i class="ph-key-bold ph-lg"></i></template>
					<template #label>VAPID Public Key</template>
					<template #caption>Public key for web push notifications</template>
				</FormInput>
			</FormSection>

			<FormSection>
				<template #label>Service Account (Server-side)</template>
				<FormInfo class="_formBlock">
					Paste the entire JSON content from your Firebase service account key file.
					This is used by the server to send push notifications.
				</FormInfo>

				<FormTextarea v-model="firebaseServiceAccountJson" class="_formBlock" rows="10">
					<template #label>Service Account JSON</template>
					<template #caption>Complete Firebase service account JSON</template>
				</FormTextarea>
			</FormSection>

			<FormSection>
				<template #label>Test Configuration</template>
				<FormButton @click="testConfiguration" :disabled="!isValidConfig" class="_formBlock">
					<i class="ph-bell-ringing-bold ph-lg"></i>
					Test Firebase Configuration
				</FormButton>
				<FormInfo v-if="testResult" class="_formBlock" :class="testResult.success ? '_success' : '_error'">
					{{ testResult.message }}
				</FormInfo>
			</FormSection>
		</template>

		<FormButton primary class="_formBlock" @click="save">
			<i class="ph-floppy-disk-back-bold ph-lg"></i>
			{{ i18n.ts.save }}
		</FormButton>
	</div>
</FormSuspense>
</template>

<script lang="ts" setup>
import { } from 'vue';
import FormSwitch from '@/components/form/switch.vue';
import FormInput from '@/components/form/input.vue';
import FormTextarea from '@/components/form/textarea.vue';
import FormButton from '@/components/MkButton.vue';
import FormInfo from '@/components/MkInfo.vue';
import FormSection from '@/components/form/section.vue';
import FormSuspense from '@/components/form/suspense.vue';
import * as os from '@/os';
import { fetchInstance } from '@/instance';
import { i18n } from '@/i18n';

let enableFirebaseMessaging: boolean = $ref(false);
let firebaseProjectId: string | null = $ref(null);
let firebaseApiKey: string | null = $ref(null);
let firebaseAuthDomain: string | null = $ref(null);
let firebaseStorageBucket: string | null = $ref(null);
let firebaseMessagingSenderId: string | null = $ref(null);
let firebaseAppId: string | null = $ref(null);
let firebaseVapidPublicKey: string | null = $ref(null);
let firebaseServiceAccountJson: string | null = $ref(null);
let testResult: { success: boolean; message: string } | null = $ref(null);

async function init() {
	const meta = await os.api('admin/meta');
	enableFirebaseMessaging = meta.enableFirebaseMessaging;
	firebaseProjectId = meta.firebaseProjectId;
	firebaseApiKey = meta.firebaseApiKey;
	firebaseAuthDomain = meta.firebaseAuthDomain;
	firebaseStorageBucket = meta.firebaseStorageBucket;
	firebaseMessagingSenderId = meta.firebaseMessagingSenderId;
	firebaseAppId = meta.firebaseAppId;
	firebaseVapidPublicKey = meta.firebaseVapidPublicKey;
	firebaseServiceAccountJson = meta.firebaseServiceAccountJson;
}

const isValidConfig = $computed(() => {
	return enableFirebaseMessaging &&
		firebaseServiceAccountJson;
});

async function testConfiguration() {
	if (!isValidConfig) return;

	try {
		testResult = null;
		const result = await os.api('firebase/test-notification');

		if (result.success) {
			testResult = {
				success: true,
				message: '✅ Firebase configuration is working! Test notification sent successfully.'
			};
		} else {
			testResult = {
				success: false,
				message: '❌ Test failed: ' + (result.error || 'Unknown error')
			};
		}
	} catch (error: any) {
		testResult = {
			success: false,
			message: '❌ Configuration error: ' + (error.message || 'Failed to test Firebase configuration')
		};
	}
}

function save() {
	os.apiWithDialog('admin/update-meta', {
		enableFirebaseMessaging,
		firebaseProjectId,
		firebaseApiKey,
		firebaseAuthDomain,
		firebaseStorageBucket,
		firebaseMessagingSenderId,
		firebaseAppId,
		firebaseVapidPublicKey,
		firebaseServiceAccountJson,
	}).then(() => {
		fetchInstance();
	});
}
</script>