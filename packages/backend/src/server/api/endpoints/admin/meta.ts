import config from '@/config/index.js';
import { fetchMeta } from '@/misc/fetch-meta.js';
import { MAX_NOTE_TEXT_LENGTH } from '@/const.js';
import define from '../../define.js';

export const meta = {
	tags: ['meta'],

	requireCredential: true,
	requireAdmin: true,

	res: {
		type: 'object',
		optional: false, nullable: false,
		properties: {
			driveCapacityPerLocalUserMb: {
				type: 'number',
				optional: false, nullable: false,
			},
			driveCapacityPerRemoteUserMb: {
				type: 'number',
				optional: false, nullable: false,
			},
			cacheRemoteFiles: {
				type: 'boolean',
				optional: false, nullable: false,
			},
			emailRequiredForSignup: {
				type: 'boolean',
				optional: false, nullable: false,
			},
			enableHcaptcha: {
				type: 'boolean',
				optional: false, nullable: false,
			},
			hcaptchaSiteKey: {
				type: 'string',
				optional: false, nullable: true,
			},
			enableRecaptcha: {
				type: 'boolean',
				optional: false, nullable: false,
			},
			recaptchaSiteKey: {
				type: 'string',
				optional: false, nullable: true,
			},
			swPublickey: {
				type: 'string',
				optional: false, nullable: true,
			},
			mascotImageUrl: {
				type: 'string',
				optional: false, nullable: false,
				default: '/assets/ai.png',
			},
			bannerUrl: {
				type: 'string',
				optional: false, nullable: false,
			},
			errorImageUrl: {
				type: 'string',
				optional: false, nullable: false,
				default: 'https://xn--931a.moe/aiart/yubitun.png',
			},
			iconUrl: {
				type: 'string',
				optional: false, nullable: true,
			},
			maxNoteTextLength: {
				type: 'number',
				optional: false, nullable: false,
			},
			emojis: {
				type: 'array',
				optional: false, nullable: false,
				items: {
					type: 'object',
					optional: false, nullable: false,
					properties: {
						id: {
							type: 'string',
							optional: false, nullable: false,
							format: 'id',
						},
						aliases: {
							type: 'array',
							optional: false, nullable: false,
							items: {
								type: 'string',
								optional: false, nullable: false,
							},
						},
						category: {
							type: 'string',
							optional: false, nullable: true,
						},
						host: {
							type: 'string',
							optional: false, nullable: true,
						},
						url: {
							type: 'string',
							optional: false, nullable: false,
							format: 'url',
						},
					},
				},
			},
			ads: {
				type: 'array',
				optional: false, nullable: false,
				items: {
					type: 'object',
					optional: false, nullable: false,
					properties: {
						place: {
							type: 'string',
							optional: false, nullable: false,
						},
						url: {
							type: 'string',
							optional: false, nullable: false,
							format: 'url',
						},
						imageUrl: {
							type: 'string',
							optional: false, nullable: false,
							format: 'url',
						},
					},
				},
			},
			enableEmail: {
				type: 'boolean',
				optional: false, nullable: false,
			},
			enableTwitterIntegration: {
				type: 'boolean',
				optional: false, nullable: false,
			},
			enableGithubIntegration: {
				type: 'boolean',
				optional: false, nullable: false,
			},
			enableDiscordIntegration: {
				type: 'boolean',
				optional: false, nullable: false,
			},
			enableServiceWorker: {
				type: 'boolean',
				optional: false, nullable: false,
			},
			translatorAvailable: {
				type: 'boolean',
				optional: false, nullable: false,
			},
			userStarForReactionFallback: {
				type: 'boolean',
				optional: true, nullable: false,
			},
			recommendedInstances: {
				type: 'array',
				optional: true, nullable: false,
				items: {
					type: 'string',
					optional: false, nullable: false,
				},
			},
			pinnedUsers: {
				type: 'array',
				optional: true, nullable: false,
				items: {
					type: 'string',
					optional: false, nullable: false,
				},
			},
			customMOTD: {
				type: 'array',
				optional: true, nullable: false,
				items: {
					type: 'string',
					optional: false, nullable: false,
				},
			},
			customSplashIcons: {
				type: 'array',
				optional: true, nullable: false,
				items: {
					type: 'string',
					optional: false, nullable: false,
				},
			},
			hiddenTags: {
				type: 'array',
				optional: true, nullable: false,
				items: {
					type: 'string',
					optional: false, nullable: false,
				},
			},
			blockedHosts: {
				type: 'array',
				optional: true, nullable: false,
				items: {
					type: 'string',
					optional: false, nullable: false,
				},
			},
			allowedHosts: {
				type: 'array',
				optional: true, nullable: false,
				items: {
					type: 'string',
					optional: false, nullable: false,
				},
			},
			privateMode: {
				type: 'boolean',
				optional: false, nullable: false,
			},
			secureMode: {
				type: 'boolean',
				optional: false, nullable: false,
			},
			preReleaseMode: {
				type: 'boolean',
				optional: false, nullable: false,
			},
			preReleaseAllowedRoles: {
				type: 'array',
				optional: false, nullable: false,
				items: {
					type: 'string',
					optional: false, nullable: false,
				},
			},
			preReleaseAllowedUserIds: {
				type: 'array',
				optional: false, nullable: false,
				items: {
					type: 'string',
					optional: false, nullable: false,
				},
			},
			hcaptchaSecretKey: {
				type: 'string',
				optional: true, nullable: true,
			},
			recaptchaSecretKey: {
				type: 'string',
				optional: true, nullable: true,
			},
			sensitiveMediaDetection: {
				type: 'string',
				optional: true, nullable: false,
			},
			sensitiveMediaDetectionSensitivity: {
				type: 'string',
				optional: true, nullable: false,
			},
			setSensitiveFlagAutomatically: {
				type: 'boolean',
				optional: true, nullable: false,
			},
			enableSensitiveMediaDetectionForVideos: {
				type: 'boolean',
				optional: true, nullable: false,
			},
			proxyAccountId: {
				type: 'string',
				optional: true, nullable: true,
				format: 'id',
			},
			twitterConsumerKey: {
				type: 'string',
				optional: true, nullable: true,
			},
			twitterConsumerSecret: {
				type: 'string',
				optional: true, nullable: true,
			},
			githubClientId: {
				type: 'string',
				optional: true, nullable: true,
			},
			githubClientSecret: {
				type: 'string',
				optional: true, nullable: true,
			},
			discordClientId: {
				type: 'string',
				optional: true, nullable: true,
			},
			discordClientSecret: {
				type: 'string',
				optional: true, nullable: true,
			},
			enableSpotifyIntegration: {
				type: 'boolean',
				optional: false, nullable: false,
			},
			spotifyClientId: {
				type: 'string',
				optional: true, nullable: true,
			},
			spotifyClientSecret: {
				type: 'string',
				optional: true, nullable: true,
			},
			enableLastfmIntegration: {
				type: 'boolean',
				optional: false, nullable: false,
			},
			lastfmApiKey: {
				type: 'string',
				optional: true, nullable: true,
			},
			lastfmApiSecret: {
				type: 'string',
				optional: true, nullable: true,
			},
			summaryProxy: {
				type: 'string',
				optional: true, nullable: true,
			},
			email: {
				type: 'string',
				optional: true, nullable: true,
			},
			smtpSecure: {
				type: 'boolean',
				optional: true, nullable: false,
			},
			smtpHost: {
				type: 'string',
				optional: true, nullable: true,
			},
			smtpPort: {
				type: 'string',
				optional: true, nullable: true,
			},
			smtpUser: {
				type: 'string',
				optional: true, nullable: true,
			},
			smtpPass: {
				type: 'string',
				optional: true, nullable: true,
			},
			swPrivateKey: {
				type: 'string',
				optional: true, nullable: true,
			},
			useObjectStorage: {
				type: 'boolean',
				optional: true, nullable: false,
			},
			objectStorageBaseUrl: {
				type: 'string',
				optional: true, nullable: true,
			},
			objectStorageBucket: {
				type: 'string',
				optional: true, nullable: true,
			},
			objectStoragePrefix: {
				type: 'string',
				optional: true, nullable: true,
			},
			objectStorageEndpoint: {
				type: 'string',
				optional: true, nullable: true,
			},
			objectStorageRegion: {
				type: 'string',
				optional: true, nullable: true,
			},
			objectStoragePort: {
				type: 'number',
				optional: true, nullable: true,
			},
			objectStorageAccessKey: {
				type: 'string',
				optional: true, nullable: true,
			},
			objectStorageSecretKey: {
				type: 'string',
				optional: true, nullable: true,
			},
			objectStorageUseSSL: {
				type: 'boolean',
				optional: true, nullable: false,
			},
			objectStorageUseProxy: {
				type: 'boolean',
				optional: true, nullable: false,
			},
			objectStorageSetPublicRead: {
				type: 'boolean',
				optional: true, nullable: false,
			},
			enableIpLogging: {
				type: 'boolean',
				optional: true, nullable: false,
			},
			enableActiveEmailValidation: {
				type: 'boolean',
				optional: true, nullable: false,
			},
			enableFirebaseMessaging: {
				type: 'boolean',
				optional: false, nullable: false,
			},
			firebaseApiKey: {
				type: 'string',
				optional: false, nullable: true,
			},
			firebaseAuthDomain: {
				type: 'string',
				optional: false, nullable: true,
			},
			firebaseProjectId: {
				type: 'string',
				optional: false, nullable: true,
			},
			firebaseStorageBucket: {
				type: 'string',
				optional: false, nullable: true,
			},
			firebaseMessagingSenderId: {
				type: 'string',
				optional: false, nullable: true,
			},
			firebaseAppId: {
				type: 'string',
				optional: false, nullable: true,
			},
			firebaseVapidPublicKey: {
				type: 'string',
				optional: false, nullable: true,
			},
			firebaseServiceAccountJson: {
				type: 'string',
				optional: false, nullable: true,
			},
			enableRevenueCat: {
				type: 'boolean',
				optional: false, nullable: false,
			},
			revenueCatPublicKey: {
				type: 'string',
				optional: false, nullable: true,
			},
			revenueCatSecretKey: {
				type: 'string',
				optional: false, nullable: true,
			},
			revenueCatWebhookSecret: {
				type: 'string',
				optional: false, nullable: true,
			},
			muxAccessToken: {
				type: 'string',
				optional: false, nullable: true,
			},
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const instance = await fetchMeta(true);

	return {
		maintainerName: instance.maintainerName,
		maintainerEmail: instance.maintainerEmail,
		version: config.version,
		name: instance.name,
		uri: config.url,
		description: instance.description,
		langs: instance.langs,
		tosUrl: instance.ToSUrl,
		repositoryUrl: instance.repositoryUrl,
		feedbackUrl: instance.feedbackUrl,
		disableRegistration: instance.disableRegistration,
		disableLocalTimeline: instance.disableLocalTimeline,
		disableRecommendedTimeline: instance.disableRecommendedTimeline,
		disableGlobalTimeline: instance.disableGlobalTimeline,
		driveCapacityPerLocalUserMb: instance.localDriveCapacityMb,
		driveCapacityPerRemoteUserMb: instance.remoteDriveCapacityMb,
		emailRequiredForSignup: instance.emailRequiredForSignup,
		enableHcaptcha: instance.enableHcaptcha,
		hcaptchaSiteKey: instance.hcaptchaSiteKey,
		enableRecaptcha: instance.enableRecaptcha,
		recaptchaSiteKey: instance.recaptchaSiteKey,
		swPublickey: instance.swPublicKey,
		themeColor: instance.themeColor,
		mascotImageUrl: instance.mascotImageUrl,
		bannerUrl: instance.bannerUrl,
		errorImageUrl: instance.errorImageUrl,
		iconUrl: instance.iconUrl,
		backgroundImageUrl: instance.backgroundImageUrl,
		logoImageUrl: instance.logoImageUrl,
		maxNoteTextLength: MAX_NOTE_TEXT_LENGTH, // 後方互換性のため
		defaultLightTheme: instance.defaultLightTheme,
		defaultDarkTheme: instance.defaultDarkTheme,
		enableEmail: instance.enableEmail,
		enableTwitterIntegration: instance.enableTwitterIntegration,
		enableGithubIntegration: instance.enableGithubIntegration,
		enableDiscordIntegration: instance.enableDiscordIntegration,
		enableServiceWorker: instance.enableServiceWorker,
		translatorAvailable: instance.deeplAuthKey != null,
		gifboxAvailable: instance.gifboxAuthKey != null,
		pinnedPages: instance.pinnedPages,
		pinnedClipId: instance.pinnedClipId,
		cacheRemoteFiles: instance.cacheRemoteFiles,
		useStarForReactionFallback: instance.useStarForReactionFallback,
		recommendedInstances: instance.recommendedInstances,
		pinnedUsers: instance.pinnedUsers,
		customMOTD: instance.customMOTD,
		customSplashIcons: instance.customSplashIcons,
		hiddenTags: instance.hiddenTags,
		blockedHosts: instance.blockedHosts,
		allowedHosts: instance.allowedHosts,
		privateMode: instance.privateMode,
		secureMode: instance.secureMode,
		preReleaseMode: instance.preReleaseMode,
		preReleaseAllowedRoles: instance.preReleaseAllowedRoles,
		preReleaseAllowedUserIds: instance.preReleaseAllowedUserIds,
		hcaptchaSecretKey: instance.hcaptchaSecretKey,
		recaptchaSecretKey: instance.recaptchaSecretKey,
		sensitiveMediaDetection: instance.sensitiveMediaDetection,
		sensitiveMediaDetectionSensitivity: instance.sensitiveMediaDetectionSensitivity,
		setSensitiveFlagAutomatically: instance.setSensitiveFlagAutomatically,
		enableSensitiveMediaDetectionForVideos: instance.enableSensitiveMediaDetectionForVideos,
		proxyAccountId: instance.proxyAccountId,
		twitterConsumerKey: instance.twitterConsumerKey,
		twitterConsumerSecret: instance.twitterConsumerSecret,
		githubClientId: instance.githubClientId,
		githubClientSecret: instance.githubClientSecret,
		discordClientId: instance.discordClientId,
		discordClientSecret: instance.discordClientSecret,
		enableSpotifyIntegration: instance.enableSpotifyIntegration,
		spotifyClientId: instance.spotifyClientId,
		spotifyClientSecret: instance.spotifyClientSecret,
		enableLastfmIntegration: instance.enableLastfmIntegration,
		lastfmApiKey: instance.lastfmApiKey,
		lastfmApiSecret: instance.lastfmApiSecret,
		summalyProxy: instance.summalyProxy,
		email: instance.email,
		smtpSecure: instance.smtpSecure,
		smtpHost: instance.smtpHost,
		smtpPort: instance.smtpPort,
		smtpUser: instance.smtpUser,
		smtpPass: instance.smtpPass,
		swPrivateKey: instance.swPrivateKey,
		useObjectStorage: instance.useObjectStorage,
		objectStorageBaseUrl: instance.objectStorageBaseUrl,
		objectStorageBucket: instance.objectStorageBucket,
		objectStoragePrefix: instance.objectStoragePrefix,
		objectStorageEndpoint: instance.objectStorageEndpoint,
		objectStorageRegion: instance.objectStorageRegion,
		objectStoragePort: instance.objectStoragePort,
		objectStorageAccessKey: instance.objectStorageAccessKey,
		objectStorageSecretKey: instance.objectStorageSecretKey,
		objectStorageUseSSL: instance.objectStorageUseSSL,
		objectStorageUseProxy: instance.objectStorageUseProxy,
		objectStorageSetPublicRead: instance.objectStorageSetPublicRead,
		objectStorageS3ForcePathStyle: instance.objectStorageS3ForcePathStyle,
		deeplAuthKey: instance.deeplAuthKey,
		deeplIsPro: instance.deeplIsPro,
		gifboxAuthKey: instance.gifboxAuthKey,
		product_id_month: instance.product_id_month,
		product_id_mp: instance.product_id_mp,
		price_id_month: instance.price_id_month,
		price_id_year: instance.price_id_year,
		price_id_month_mp: instance.price_id_month_mp,
		price_id_year_mp: instance.price_id_year_mp,
		price_id_gift_month_plus: instance.price_id_gift_month_plus,
		price_id_gift_year_plus: instance.price_id_gift_year_plus,
		price_id_gift_month_mplus: instance.price_id_gift_month_mplus,
		price_id_gift_year_mplus: instance.price_id_gift_year_mplus,
		stripe_key: instance.stripe_key,
		stripe_webhook_secret: instance.stripe_webhook_secret,
		mux_access: instance.mux_access,
		mux_secret_key: instance.mux_secret_key,
		mux_webhook_secret: instance.mux_webhook_secret,
		mux_token_id: instance.mux_token_id,
		mux_signing_key_id: instance.mux_signing_key_id,
		mux_signing_key_private: instance.mux_signing_key_private,
		enableIpLogging: instance.enableIpLogging,
		enableActiveEmailValidation: instance.enableActiveEmailValidation,
		enableFirebaseMessaging: instance.enableFirebaseMessaging,
		firebaseApiKey: instance.firebaseApiKey,
		firebaseAuthDomain: instance.firebaseAuthDomain,
		firebaseProjectId: instance.firebaseProjectId,
		firebaseStorageBucket: instance.firebaseStorageBucket,
		firebaseMessagingSenderId: instance.firebaseMessagingSenderId,
		firebaseAppId: instance.firebaseAppId,
		firebaseVapidPublicKey: instance.firebaseVapidPublicKey,
		firebaseServiceAccountJson: instance.firebaseServiceAccountJson,
		enableRevenueCat: instance.enableRevenueCat,
		revenueCatPublicKey: instance.revenueCatPublicKey,
		revenueCatSecretKey: instance.revenueCatSecretKey,
		revenueCatWebhookSecret: instance.revenueCatWebhookSecret,
	};
});
