<template>
<div>
	<MkStickyContainer>
		<template #header><MkPageHeader :actions="headerActions" :tabs="headerTabs"/></template>
		<MkSpacer :content-max="700" :margin-min="16" :margin-max="32">
			<FormSuspense :p="init">
				<div class="_formRoot">
					<FormInput v-model="name" class="_formBlock">
						<template #label>{{ i18n.ts.instanceName }}</template>
					</FormInput>

					<FormTextarea v-model="description" class="_formBlock">
						<template #label>{{ i18n.ts.instanceDescription }}</template>
					</FormTextarea>

					<FormInput v-model="tosUrl" class="_formBlock">
						<template #prefix><i class="ph-link-simple-bold ph-lg"></i></template>
						<template #label>{{ i18n.ts.tosUrl }}</template>
					</FormInput>

					<FormSplit :min-width="300">
						<FormInput v-model="maintainerName" class="_formBlock">
							<template #label>{{ i18n.ts.maintainerName }}</template>
						</FormInput>

						<FormInput v-model="maintainerEmail" type="email" class="_formBlock">
							<template #prefix><i class="ph-envelope-simple-open-bold ph-lg"></i></template>
							<template #label>{{ i18n.ts.maintainerEmail }}</template>
						</FormInput>
					</FormSplit>

					<FormTextarea v-model="pinnedUsers" class="_formBlock">
						<template #label>{{ i18n.ts.pinnedUsers }}</template>
						<template #caption>{{ i18n.ts.pinnedUsersDescription }}</template>
					</FormTextarea>

					<FormSection>
						<FormSwitch v-model="enableRegistration" class="_formBlock">
							<template #label>{{ i18n.ts.enableRegistration }}</template>
						</FormSwitch>

						<FormSwitch v-model="emailRequiredForSignup" class="_formBlock">
							<template #label>{{ i18n.ts.emailRequiredForSignup }}</template>
						</FormSwitch>
					</FormSection>

					<FormSection>
						<template #label>Pre-Release Mode</template>
						<FormInfo class="_formBlock">Pre-release mode restricts access to staff and selected users during launch preparation.</FormInfo>
						
						<FormSwitch v-model="preReleaseMode" class="_formBlock">
							<template #label>Enable Pre-Release Mode</template>
							<template #caption>When enabled, only staff and selected users can sign in. Registration is disabled.</template>
						</FormSwitch>

						<FormInput v-model="preReleaseAllowedRoles" v-if="preReleaseMode" class="_formBlock">
							<template #label>Allowed Roles</template>
							<template #caption>Comma-separated list of roles allowed during pre-release (e.g. staff,admin,moderator,verified,plus,mplus)</template>
						</FormInput>

						<FormTextarea v-model="preReleaseAllowedUserIds" v-if="preReleaseMode" class="_formBlock">
							<template #label>Allowed User IDs</template>
							<template #caption>Comma-separated list of specific user IDs allowed during pre-release</template>
						</FormTextarea>
					</FormSection>

					<FormSection>
						<FormSwitch v-model="enableRecommendedTimeline" class="_formBlock">{{ i18n.ts.enableRecommendedTimeline }}</FormSwitch>
						<FormTextarea v-model="recommendedInstances" class="_formBlock">
							<template #label>{{ i18n.ts.recommendedInstances }}</template>
							<template #caption>{{ i18n.ts.recommendedInstancesDescription }}</template>
						</FormTextarea>
					</FormSection>

					<FormSection>
						<FormSwitch v-model="enableLocalTimeline" class="_formBlock">{{ i18n.ts.enableLocalTimeline }}</FormSwitch>
						<FormSwitch v-model="enableGlobalTimeline" class="_formBlock">{{ i18n.ts.enableGlobalTimeline }}</FormSwitch>
						<FormInfo class="_formBlock">{{ i18n.ts.disablingTimelinesInfo }}</FormInfo>
					</FormSection>

					<FormSection>
						<template #label>{{ i18n.ts.theme }}</template>

						<FormInput v-model="iconUrl" class="_formBlock">
							<template #prefix><i class="ph-link-simple-bold ph-lg"></i></template>
							<template #label>{{ i18n.ts.iconUrl }}</template>
						</FormInput>

						<FormInput v-model="bannerUrl" class="_formBlock">
							<template #prefix><i class="ph-link-simple-bold ph-lg"></i></template>
							<template #label>{{ i18n.ts.bannerUrl }}</template>
						</FormInput>

						<FormInput v-model="logoImageUrl" class="_formBlock">
							<template #prefix><i class="ph-link-simple-bold ph-lg"></i></template>
							<template #label>{{ i18n.ts.logoImageUrl }}</template>
						</FormInput>

						<FormInput v-model="backgroundImageUrl" class="_formBlock">
							<template #prefix><i class="ph-link-simple-bold ph-lg"></i></template>
							<template #label>{{ i18n.ts.backgroundImageUrl }}</template>
						</FormInput>

						<FormInput v-model="themeColor" class="_formBlock">
							<template #prefix><i class="ph-palette-bold ph-lg"></i></template>
							<template #label>{{ i18n.ts.themeColor }}</template>
							<template #caption>#RRGGBB</template>
						</FormInput>

						<FormTextarea v-model="defaultLightTheme" class="_formBlock">
							<template #label>{{ i18n.ts.instanceDefaultLightTheme }}</template>
							<template #caption>{{ i18n.ts.instanceDefaultThemeDescription }}</template>
						</FormTextarea>

						<FormTextarea v-model="defaultDarkTheme" class="_formBlock">
							<template #label>{{ i18n.ts.instanceDefaultDarkTheme }}</template>
							<template #caption>{{ i18n.ts.instanceDefaultThemeDescription }}</template>
						</FormTextarea>
					</FormSection>

					<FormSection>
						<template #label>{{ i18n.ts.splash }}</template>

						<FormTextarea v-model="customMOTD" class="_formBlock">
							<template #label>{{ i18n.ts.customMOTD }}</template>
							<template #caption>{{ i18n.ts.customMOTDDescription }}</template>
						</FormTextarea>

						<FormTextarea v-model="customSplashIcons" class="_formBlock">
							<template #label>{{ i18n.ts.customSplashIcons }}</template>
							<template #caption>{{ i18n.ts.customSplashIconsDescription }}</template>
						</FormTextarea>
					</FormSection>

					<FormSection>
						<template #label>{{ i18n.ts.files }}</template>

						<FormSwitch v-model="cacheRemoteFiles" class="_formBlock">
							<template #label>{{ i18n.ts.cacheRemoteFiles }}</template>
							<template #caption>{{ i18n.ts.cacheRemoteFilesDescription }}</template>
						</FormSwitch>

						<FormSplit :min-width="280">
							<FormInput v-model="localDriveCapacityMb" type="number" class="_formBlock">
								<template #label>{{ i18n.ts.driveCapacityPerLocalAccount }}</template>
								<template #suffix>MB</template>
								<template #caption>{{ i18n.ts.inMb }}</template>
							</FormInput>

							<FormInput v-model="remoteDriveCapacityMb" type="number" :disabled="!cacheRemoteFiles" class="_formBlock">
								<template #label>{{ i18n.ts.driveCapacityPerRemoteAccount }}</template>
								<template #suffix>MB</template>
								<template #caption>{{ i18n.ts.inMb }}</template>
							</FormInput>
						</FormSplit>
					</FormSection>

					<FormSection>
						<template #label>ServiceWorker</template>

						<FormSwitch v-model="enableServiceWorker" class="_formBlock">
							<template #label>{{ i18n.ts.enableServiceworker }}</template>
							<template #caption>{{ i18n.ts.serviceworkerInfo }}</template>
						</FormSwitch>

						<template v-if="enableServiceWorker">
							<FormInput v-model="swPublicKey" class="_formBlock">
								<template #prefix><i class="ph-key-bold ph-lg"></i></template>
								<template #label>Public key</template>
							</FormInput>

							<FormInput v-model="swPrivateKey" class="_formBlock">
								<template #prefix><i class="ph-key-bold ph-lg"></i></template>
								<template #label>Private key</template>
							</FormInput>
						</template>
					</FormSection>

					<FormSection>
						<template #label>DeepL Translation</template>

						<FormInput v-model="deeplAuthKey" class="_formBlock">
							<template #prefix><i class="ph-key-bold ph-lg"></i></template>
							<template #label>DeepL Auth Key</template>
						</FormInput>
						<FormSwitch v-model="deeplIsPro" class="_formBlock">
							<template #label>Pro account</template>
						</FormSwitch>
					</FormSection>

					<FormSection>
						<template #label>GifBox integration</template>

						<FormInput v-model="gifboxAuthKey" class="_formBlock">
							<template #prefix><i class="ph-key-bold ph-lg"></i></template>
							<template #label>GifBox Auth Key</template>
						</FormInput>
					</FormSection>

					<FormSection>
						<template #label>Stripe</template>
						
						<FormInput v-model="stripe_key" class="_formBlock">
							<template #prefix><i class="ph-key-bold ph-lg"></i></template>
							<template #label>Stripe Key</template>
						</FormInput>
						<FormInput v-model="stripe_webhook_secret" class="_formBlock">
							<template #prefix><i class="ph-key-bold ph-lg"></i></template>
							<template #label>Stripe Webhook secret</template>
						</FormInput>
						<FormInput v-model="product_id_month" class="_formBlock">
							<template #prefix><i class="ph-key-bold ph-lg"></i></template>
							<template #label>Product Id Month Key</template>
						</FormInput>
						<FormInput v-model="product_id_mp" class="_formBlock">
							<template #prefix><i class="ph-key-bold ph-lg"></i></template>
							<template #label>Product Id Mini Pluss</template>
						</FormInput>
						<FormInput v-model="price_id_month" class="_formBlock">
							<template #prefix><i class="ph-key-bold ph-lg"></i></template>
							<template #label>Price Id Month Key</template>
						</FormInput>
						<FormInput v-model="price_id_year" class="_formBlock">
							<template #prefix><i class="ph-key-bold ph-lg"></i></template>
							<template #label>Price Id Year Key</template>
						</FormInput>
						<FormInput v-model="price_id_month_mp" class="_formBlock">
							<template #prefix><i class="ph-key-bold ph-lg"></i></template>
							<template #label>Price Id Month Key Mini Plus</template>
						</FormInput>
						<FormInput v-model="price_id_year_mp" class="_formBlock">
							<template #prefix><i class="ph-key-bold ph-lg"></i></template>
							<template #label>Price Id Year Key Mini Plus</template>
						</FormInput>

						<!-- New FormInputs for Gift Price IDs -->
						<FormInput v-model="price_id_gift_month_plus" class="_formBlock">
							<template #prefix><i class="ph-gift-bold ph-lg"></i></template>
							<template #label>Gift Monthly Barkle+ Price ID</template>
						</FormInput>
						<FormInput v-model="price_id_gift_year_plus" class="_formBlock">
							<template #prefix><i class="ph-gift-bold ph-lg"></i></template>
							<template #label>Gift Yearly Barkle+ Price ID</template>
						</FormInput>
						<FormInput v-model="price_id_gift_month_mplus" class="_formBlock">
							<template #prefix><i class="ph-gift-bold ph-lg"></i></template>
							<template #label>Gift Monthly Mini+ Price ID</template>
						</FormInput>
						<FormInput v-model="price_id_gift_year_mplus" class="_formBlock">
							<template #prefix><i class="ph-gift-bold ph-lg"></i></template>
							<template #label>Gift Yearly Mini+ Price ID</template>
						</FormInput>
					</FormSection>

				</div>
			</FormSuspense>
		</MkSpacer>
	</MkStickyContainer>
</div>
</template>

<script lang="ts" setup>
import { } from 'vue';
import FormSwitch from '@/components/form/switch.vue';
import FormInput from '@/components/form/input.vue';
import FormTextarea from '@/components/form/textarea.vue';
import FormInfo from '@/components/MkInfo.vue';
import FormSection from '@/components/form/section.vue';
import FormSplit from '@/components/form/split.vue';
import FormSuspense from '@/components/form/suspense.vue';
import * as os from '@/os';
import { fetchInstance } from '@/instance';
import { i18n } from '@/i18n';
import { definePageMetadata } from '@/scripts/page-metadata';

let name: string | null = $ref(null);
let description: string | null = $ref(null);
let tosUrl: string | null = $ref(null);
let maintainerName: string | null = $ref(null);
let maintainerEmail: string | null = $ref(null);
let iconUrl: string | null = $ref(null);
let bannerUrl: string | null = $ref(null);
let logoImageUrl: string | null = $ref(null);
let backgroundImageUrl: string | null = $ref(null);
let themeColor: any = $ref(null);
let defaultLightTheme: any = $ref(null);
let defaultDarkTheme: any = $ref(null);
let enableLocalTimeline: boolean = $ref(false);
let enableGlobalTimeline: boolean = $ref(false);
let enableRecommendedTimeline: boolean = $ref(false);
let pinnedUsers: string = $ref('');
let customMOTD: string = $ref('');
let recommendedInstances: string = $ref('');
let customSplashIcons: string = $ref('');
let cacheRemoteFiles: boolean = $ref(false);
let localDriveCapacityMb: any = $ref(0);
let remoteDriveCapacityMb: any = $ref(0);
let enableRegistration: boolean = $ref(false);
let emailRequiredForSignup: boolean = $ref(false);
let preReleaseMode: boolean = $ref(false);
let preReleaseAllowedRoles: string = $ref('');
let preReleaseAllowedUserIds: string = $ref('');
let enableServiceWorker: boolean = $ref(false);
let swPublicKey: any = $ref(null);
let swPrivateKey: any = $ref(null);
let deeplAuthKey: string = $ref('');
let deeplIsPro: boolean = $ref(false);
let gifboxAuthKey: string = $ref('');
let product_id_month: string = $ref('');
let product_id_mp: string = $ref('');
let price_id_month: string = $ref('');
let price_id_year: string = $ref('');
let price_id_month_mp: string = $ref('');
let price_id_year_mp: string = $ref('');
let stripe_key: string = $ref('');
let stripe_webhook_secret: string = $ref('');

// New refs for gift Price IDs
let price_id_gift_month_plus: string = $ref('');
let price_id_gift_year_plus: string = $ref('');
let price_id_gift_month_mplus: string = $ref('');
let price_id_gift_year_mplus: string = $ref('');

async function init() {
	const meta = await os.api('admin/meta');
	name = meta.name;
	description = meta.description;
	tosUrl = meta.tosUrl;
	iconUrl = meta.iconUrl;
	bannerUrl = meta.bannerUrl;
	logoImageUrl = meta.logoImageUrl;
	backgroundImageUrl = meta.backgroundImageUrl;
	themeColor = meta.themeColor;
	defaultLightTheme = meta.defaultLightTheme;
	defaultDarkTheme = meta.defaultDarkTheme;
	maintainerName = meta.maintainerName;
	maintainerEmail = meta.maintainerEmail;
	enableLocalTimeline = !meta.disableLocalTimeline;
	enableGlobalTimeline = !meta.disableGlobalTimeline;
	enableRecommendedTimeline = !meta.disableRecommendedTimeline;
	pinnedUsers = meta.pinnedUsers.join('\n');
	customMOTD = meta.customMOTD.join('\n');
	customSplashIcons = meta.customSplashIcons.join('\n');
	recommendedInstances = meta.recommendedInstances.join('\n');
	cacheRemoteFiles = meta.cacheRemoteFiles;
	localDriveCapacityMb = meta.driveCapacityPerLocalUserMb;
	remoteDriveCapacityMb = meta.driveCapacityPerRemoteUserMb;
	enableRegistration = !meta.disableRegistration;
	emailRequiredForSignup = meta.emailRequiredForSignup;
	preReleaseMode = meta.preReleaseMode || false;
	preReleaseAllowedRoles = meta.preReleaseAllowedRoles ? meta.preReleaseAllowedRoles.join(',') : 'staff,admin,moderator,verified';
	preReleaseAllowedUserIds = meta.preReleaseAllowedUserIds ? meta.preReleaseAllowedUserIds.join(',') : '';
	enableServiceWorker = meta.enableServiceWorker;
	swPublicKey = meta.swPublickey;
	swPrivateKey = meta.swPrivateKey;
	deeplAuthKey = meta.deeplAuthKey;
	deeplIsPro = meta.deeplIsPro;
	gifboxAuthKey = meta.gifboxAuthKey;
	product_id_month = meta.product_id_month;
	product_id_mp = meta.product_id_mp;
	price_id_month = meta.price_id_month;
	price_id_year = meta.price_id_year;
	price_id_month_mp = meta.price_id_month_mp;
	price_id_year_mp = meta.price_id_year_mp;
	stripe_key = meta.stripe_key;
	stripe_webhook_secret = meta.stripe_webhook_secret;

	// Initialize new gift Price IDs
	price_id_gift_month_plus = meta.price_id_gift_month_plus || '';
	price_id_gift_year_plus = meta.price_id_gift_year_plus || '';
	price_id_gift_month_mplus = meta.price_id_gift_month_mplus || '';
	price_id_gift_year_mplus = meta.price_id_gift_year_mplus || '';
}

function save() {
	os.apiWithDialog('admin/update-meta', {
		name,
		description,
		tosUrl,
		iconUrl,
		bannerUrl,
		logoImageUrl,
		backgroundImageUrl,
		themeColor: themeColor === '' ? null : themeColor,
		defaultLightTheme: defaultLightTheme === '' ? null : defaultLightTheme,
		defaultDarkTheme: defaultDarkTheme === '' ? null : defaultDarkTheme,
		maintainerName,
		maintainerEmail,
		disableLocalTimeline: !enableLocalTimeline,
		disableGlobalTimeline: !enableGlobalTimeline,
		disableRecommendedTimeline: !enableRecommendedTimeline,
		pinnedUsers: pinnedUsers.split('\n'),
		customMOTD: customMOTD.split('\n'),
		customSplashIcons: customSplashIcons.split('\n'),
		recommendedInstances: recommendedInstances.split('\n'),
		cacheRemoteFiles,
		localDriveCapacityMb: parseInt(localDriveCapacityMb, 10),
		remoteDriveCapacityMb: parseInt(remoteDriveCapacityMb, 10),
		disableRegistration: !enableRegistration,
		emailRequiredForSignup,
		preReleaseMode,
		preReleaseAllowedRoles: preReleaseAllowedRoles.split(',').map(role => role.trim()).filter(Boolean),
		preReleaseAllowedUserIds: preReleaseAllowedUserIds.split(',').map(id => id.trim()).filter(Boolean),
		enableServiceWorker,
		swPublicKey,
		swPrivateKey,
		deeplAuthKey,
		deeplIsPro,
		gifboxAuthKey,
		product_id_month,
		product_id_mp,
		price_id_month,
		price_id_year,
		price_id_month_mp,
		price_id_year_mp,
		stripe_key,
		stripe_webhook_secret,

		// Add new gift Price IDs to the payload
		price_id_gift_month_plus: price_id_gift_month_plus === '' ? null : price_id_gift_month_plus,
		price_id_gift_year_plus: price_id_gift_year_plus === '' ? null : price_id_gift_year_plus,
		price_id_gift_month_mplus: price_id_gift_month_mplus === '' ? null : price_id_gift_month_mplus,
		price_id_gift_year_mplus: price_id_gift_year_mplus === '' ? null : price_id_gift_year_mplus,
	}).then(() => {
		fetchInstance();
	});
}

const headerActions = $computed(() => [{
	asFullButton: true,
	icon: 'ph-check-bold ph-lg',
	text: i18n.ts.save,
	handler: save,
}]);

const headerTabs = $computed(() => []);

definePageMetadata({
	title: i18n.ts.general,
	icon: 'ph-gear-six-bold ph-lg',
});
</script>
