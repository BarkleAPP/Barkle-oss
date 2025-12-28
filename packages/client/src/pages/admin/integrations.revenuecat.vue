<template>
    <div>
        <FormSplit :on="enableRevenueCat">
            <template #label>{{ i18n.ts.enableRevenueCat || 'Enable RevenueCat Mobile Billing' }}</template>
            <template #on>{{ i18n.ts.on }}</template>
            <template #off>{{ i18n.ts.off }}</template>
            <MkSwitch v-model="enableRevenueCat" @update:modelValue="save">
                <template #label>{{ i18n.ts.enableRevenueCatDescription || 'Enable mobile subscriptions (iOS & Android) via RevenueCat' }}</template>
            </MkSwitch>
        </FormSplit>

        <template v-if="enableRevenueCat">
            <FormInput v-model="revenueCatPublicKey" class="_formBlock">
                <template #label>{{ i18n.ts.revenueCatPublicKey || 'RevenueCat Public API Key' }}</template>
                <template #caption>{{ i18n.ts.revenueCatPublicKeyDescription || 'Public key for mobile SDK (safe to expose in mobile app)' }}</template>
            </FormInput>

            <FormInput v-model="revenueCatSecretKey" type="password" class="_formBlock">
                <template #label>{{ i18n.ts.revenueCatSecretKey || 'RevenueCat Secret API Key' }}</template>
                <template #caption>{{ i18n.ts.revenueCatSecretKeyDescription || 'Secret key for backend API calls (keep confidential)' }}</template>
            </FormInput>

            <FormInput v-model="revenueCatWebhookSecret" type="password" class="_formBlock">
                <template #label>{{ i18n.ts.revenueCatWebhookSecret || 'Webhook Authorization Secret' }}</template>
                <template #caption>{{ i18n.ts.revenueCatWebhookSecretDescription || 'Used to verify webhook signatures from RevenueCat' }}</template>
            </FormInput>

            <FormButton primary class="_formBlock" @click="save">{{ i18n.ts.save }}</FormButton>

            <FormSection>
                <template #label>{{ i18n.ts.setup || 'Setup Instructions' }}</template>
                <div class="_formBlock">
                    <h3 style="margin-top: 0;">Quick Start</h3>
                    <ol style="padding-left: 20px; line-height: 1.8;">
                        <li>Create a free account at <a href="https://www.revenuecat.com" target="_blank"
                                rel="noopener">revenuecat.com</a></li>
                        <li>Create a new app in RevenueCat dashboard</li>
                        <li>Connect your Google Play and App Store accounts</li>
                        <li>Create entitlements:
                            <ul style="margin: 8px 0; padding-left: 20px;">
                                <li><code>barkle_plus</code> or <code>plus</code> - Barkle+ subscribers</li>
                                <li><code>mini_plus</code> or <code>mplus</code> - Mini+ subscribers</li>
                            </ul>
                        </li>
                        <li>Create products and link to entitlements</li>
                        <li>Get your API keys from RevenueCat dashboard</li>
                        <li>Enter keys above and save</li>
                        <li>Configure webhook URL in RevenueCat:
                            <code
                                style="display: block; margin: 8px 0; padding: 8px; background: var(--panel); border-radius: 4px;">
                    {{ webhookUrl }}
                </code>
                        </li>
                    </ol>

                    <h3>Mobile App Integration</h3>
                    <p>Install the Capacitor plugin in your mobile app:</p>
                    <pre style="background: var(--panel); padding: 12px; border-radius: 4px; overflow-x: auto;"><code>npm install
                @revenuecat/purchases-capacitor
                npx cap sync</code></pre>

                    <p>Configure in your app:</p>
                    <pre style="background: var(--panel); padding: 12px; border-radius: 4px; overflow-x: auto;"><code>import {
                Purchases } from '@revenuecat/purchases-capacitor';

                // Configure with your public key
                await Purchases.configure({
                apiKey: '{{ revenueCatPublicKey || 'YOUR_PUBLIC_KEY' }}',
                });

                // Set user ID (important!)
                await Purchases.logIn({ appUserID: userId });

                // Show offerings
                const offerings = await Purchases.getOfferings();

                // Purchase
                await Purchases.purchasePackage({
                packageToPurchase: offerings.current.monthly
                });</code></pre>

                    <h3>Key Benefits</h3>
                    <ul style="padding-left: 20px; line-height: 1.8;">
                        <li>✅ Single SDK for iOS and Android</li>
                        <li>✅ Automatic receipt validation</li>
                        <li>✅ Real-time webhook notifications</li>
                        <li>✅ Built-in analytics dashboard</li>
                        <li>✅ Cross-platform purchase restoration</li>
                        <li>✅ Simplified subscription management</li>
                    </ul>

                    <h3>Documentation</h3>
                    <ul style="padding-left: 20px;">
                        <li><a href="https://docs.revenuecat.com" target="_blank" rel="noopener">RevenueCat
                                Documentation</a></li>
                        <li><a href="https://docs.revenuecat.com/docs/capacitor" target="_blank"
                                rel="noopener">Capacitor SDK
                                Guide</a></li>
                        <li><a href="https://docs.revenuecat.com/docs/webhooks" target="_blank" rel="noopener">Webhook
                                Integration</a></li>
                    </ul>
                </div>
            </FormSection>
        </template>
    </div>
</template>

<script lang="ts" setup>
import { } from 'vue';
import FormInput from '@/components/form/input.vue';
import FormButton from '@/components/MkButton.vue';
import FormSplit from '@/components/form/split.vue';
import MkSwitch from '@/components/form/switch.vue';
import FormSection from '@/components/form/section.vue';
import * as os from '@/os';
import { i18n } from '@/i18n';

let enableRevenueCat: boolean = $ref(false);
let revenueCatPublicKey: string = $ref('');
let revenueCatSecretKey: string = $ref('');
let revenueCatWebhookSecret: string = $ref('');

const webhookUrl = `${location.protocol}//${location.host}/api/revenuecat/webhook`;

async function init() {
    const meta = await os.api('admin/meta');
    enableRevenueCat = meta.enableRevenueCat;
    revenueCatPublicKey = meta.revenueCatPublicKey || '';
    revenueCatSecretKey = meta.revenueCatSecretKey || '';
    revenueCatWebhookSecret = meta.revenueCatWebhookSecret || '';
}

function save() {
    os.apiWithDialog('admin/update-meta', {
        enableRevenueCat,
        revenueCatPublicKey: revenueCatPublicKey || null,
        revenueCatSecretKey: revenueCatSecretKey || null,
        revenueCatWebhookSecret: revenueCatWebhookSecret || null,
    }).then(() => {
        init();
    });
}

init();
</script>
