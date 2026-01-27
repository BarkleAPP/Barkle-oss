import { Meta } from '@/models/entities/meta.js';
import { insertModerationLog } from '@/services/insert-moderation-log.js';
import { DB_MAX_NOTE_TEXT_LENGTH } from '@/misc/hard-limits.js';
import { db } from '@/db/postgre.js';
import define from '../../define.js';
import { sanitizeUrl, sanitizeNoteContent, sanitizeString } from '@/misc/security/input-sanitization.js';

export const meta = {
	tags: ['admin'],

	kind: 'write:admin',

	requireCredential: true,
	requireAdmin: true,
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		disableRegistration: { type: 'boolean', nullable: true },
		preReleaseMode: { type: 'boolean', nullable: true },
		preReleaseAllowedRoles: {
			type: 'array', nullable: true, items: {
				type: 'string',
			}
		},
		preReleaseAllowedUserIds: {
			type: 'array', nullable: true, items: {
				type: 'string',
			}
		},
		disableLocalTimeline: { type: 'boolean', nullable: true },
		disableRecommendedTimeline: { type: 'boolean', nullable: true },
		disableGlobalTimeline: { type: 'boolean', nullable: true },
		useStarForReactionFallback: { type: 'boolean', nullable: true },
		recommendedInstances: {
			type: 'array', nullable: true, items: {
				type: 'string',
			}
		},
		pinnedUsers: {
			type: 'array', nullable: true, items: {
				type: 'string',
			}
		},
		customMOTD: {
			type: 'array', nullable: true, items: {
				type: 'string',
			}
		},
		customSplashIcons: {
			type: 'array', nullable: true, items: {
				type: 'string',
			}
		},
		hiddenTags: {
			type: 'array', nullable: true, items: {
				type: 'string',
			}
		},
		blockedHosts: {
			type: 'array', nullable: true, items: {
				type: 'string',
			}
		},
		allowedHosts: {
			type: 'array', nullable: true, items: {
				type: 'string',
			}
		},
		secureMode: { type: 'boolean', nullable: true },
		privateMode: { type: 'boolean', nullable: true },
		themeColor: { type: 'string', nullable: true, pattern: '^#[0-9a-fA-F]{6}$' },
		mascotImageUrl: { type: 'string', nullable: true },
		bannerUrl: { type: 'string', nullable: true },
		logoImageUrl: { type: 'string', nullable: true },
		errorImageUrl: { type: 'string', nullable: true },
		iconUrl: { type: 'string', nullable: true },
		backgroundImageUrl: { type: 'string', nullable: true },
		name: { type: 'string', nullable: true },
		description: { type: 'string', nullable: true },
		defaultLightTheme: { type: 'string', nullable: true },
		defaultDarkTheme: { type: 'string', nullable: true },
		localDriveCapacityMb: { type: 'integer' },
		remoteDriveCapacityMb: { type: 'integer' },
		cacheRemoteFiles: { type: 'boolean' },
		emailRequiredForSignup: { type: 'boolean' },
		enableHcaptcha: { type: 'boolean' },
		hcaptchaSiteKey: { type: 'string', nullable: true },
		hcaptchaSecretKey: { type: 'string', nullable: true },
		enableRecaptcha: { type: 'boolean' },
		recaptchaSiteKey: { type: 'string', nullable: true },
		recaptchaSecretKey: { type: 'string', nullable: true },
		sensitiveMediaDetection: { type: 'string', enum: ['none', 'all', 'local', 'remote'] },
		sensitiveMediaDetectionSensitivity: { type: 'string', enum: ['medium', 'low', 'high', 'veryLow', 'veryHigh'] },
		setSensitiveFlagAutomatically: { type: 'boolean' },
		enableSensitiveMediaDetectionForVideos: { type: 'boolean' },
		proxyAccountId: { type: 'string', format: 'barkle:id', nullable: true },
		maintainerName: { type: 'string', nullable: true },
		maintainerEmail: { type: 'string', nullable: true },
		pinnedPages: {
			type: 'array', items: {
				type: 'string',
			}
		},
		pinnedClipId: { type: 'string', format: 'barkle:id', nullable: true },
		langs: {
			type: 'array', items: {
				type: 'string',
			}
		},
		summalyProxy: { type: 'string', nullable: true },
		deeplAuthKey: { type: 'string', nullable: true },
		deeplIsPro: { type: 'boolean' },
		gifboxAuthKey: { type: 'string', nullable: true },
		product_id_month: { type: 'string', nullable: true },
		product_id_mp: { type: 'string', nullable: true },
		price_id_month: { type: 'string', nullable: true },
		price_id_year: { type: 'string', nullable: true },
		price_id_month_mp: { type: 'string', nullable: true },
		price_id_year_mp: { type: 'string', nullable: true },
		price_id_gift_month_plus: { type: 'string', nullable: true },
		price_id_gift_year_plus: { type: 'string', nullable: true },
		price_id_gift_month_mplus: { type: 'string', nullable: true },
		price_id_gift_year_mplus: { type: 'string', nullable: true },
		stripe_key: { type: 'string', nullable: true },
		stripe_webhook_secret: { type: 'string', nullable: true },
		enableTwitterIntegration: { type: 'boolean' },
		twitterConsumerKey: { type: 'string', nullable: true },
		twitterConsumerSecret: { type: 'string', nullable: true },
		enableGithubIntegration: { type: 'boolean' },
		githubClientId: { type: 'string', nullable: true },
		githubClientSecret: { type: 'string', nullable: true },
		enableDiscordIntegration: { type: 'boolean' },
		discordClientId: { type: 'string', nullable: true },
		discordClientSecret: { type: 'string', nullable: true },
		enableSpotifyIntegration: { type: 'boolean' },
		spotifyClientId: { type: 'string', nullable: true },
		spotifyClientSecret: { type: 'string', nullable: true },
		enableLastfmIntegration: { type: 'boolean' },
		lastfmApiKey: { type: 'string', nullable: true },
		lastfmApiSecret: { type: 'string', nullable: true },
		enableEmail: { type: 'boolean' },
		email: { type: 'string', nullable: true },
		smtpSecure: { type: 'boolean' },
		smtpHost: { type: 'string', nullable: true },
		smtpPort: { type: 'integer', nullable: true },
		smtpUser: { type: 'string', nullable: true },
		smtpPass: { type: 'string', nullable: true },
		enableServiceWorker: { type: 'boolean' },
		swPublicKey: { type: 'string', nullable: true },
		swPrivateKey: { type: 'string', nullable: true },
		tosUrl: { type: 'string', nullable: true },
		repositoryUrl: { type: 'string' },
		feedbackUrl: { type: 'string' },
		useObjectStorage: { type: 'boolean' },
		objectStorageBaseUrl: { type: 'string', nullable: true },
		objectStorageBucket: { type: 'string', nullable: true },
		objectStoragePrefix: { type: 'string', nullable: true },
		objectStorageEndpoint: { type: 'string', nullable: true },
		objectStorageRegion: { type: 'string', nullable: true },
		objectStoragePort: { type: 'integer', nullable: true },
		objectStorageAccessKey: { type: 'string', nullable: true },
		objectStorageSecretKey: { type: 'string', nullable: true },
		objectStorageUseSSL: { type: 'boolean' },
		objectStorageUseProxy: { type: 'boolean' },
		objectStorageSetPublicRead: { type: 'boolean' },
		objectStorageS3ForcePathStyle: { type: 'boolean' },
		enableIpLogging: { type: 'boolean' },
		enableActiveEmailValidation: { type: 'boolean' },
		enableFirebaseMessaging: { type: 'boolean' },
		firebaseApiKey: { type: 'string', nullable: true },
		firebaseAuthDomain: { type: 'string', nullable: true },
		firebaseProjectId: { type: 'string', nullable: true },
		firebaseStorageBucket: { type: 'string', nullable: true },
		firebaseMessagingSenderId: { type: 'string', nullable: true },
		firebaseAppId: { type: 'string', nullable: true },
		firebaseVapidPublicKey: { type: 'string', nullable: true },
		firebaseServiceAccountJson: { type: 'string', nullable: true },
		enableRevenueCat: { type: 'boolean' },
		revenueCatPublicKey: { type: 'string', nullable: true },
		revenueCatSecretKey: { type: 'string', nullable: true },
		revenueCatWebhookSecret: { type: 'string', nullable: true },
		muxAccessToken: { type: 'string', nullable: true },
		muxSecretKey: { type: 'string', nullable: true },
		muxTokenId: { type: 'string', nullable: true },
		muxWebhookSecret: { type: 'string', nullable: true },
		muxSigningKeyId: { type: 'string', nullable: true },
		muxSigningKeyPrivate: { type: 'string', nullable: true },
	},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, me) => {
	const set = {} as Partial<Meta>;

	if (typeof ps.disableRegistration === 'boolean') {
		set.disableRegistration = ps.disableRegistration;
	}

	if (typeof ps.preReleaseMode === 'boolean') {
		set.preReleaseMode = ps.preReleaseMode;
	}

	if (Array.isArray(ps.preReleaseAllowedRoles)) {
		set.preReleaseAllowedRoles = ps.preReleaseAllowedRoles.filter(Boolean);
	}

	if (Array.isArray(ps.preReleaseAllowedUserIds)) {
		set.preReleaseAllowedUserIds = ps.preReleaseAllowedUserIds.filter(Boolean);
	}

	if (typeof ps.disableLocalTimeline === 'boolean') {
		set.disableLocalTimeline = ps.disableLocalTimeline;
	}

	if (typeof ps.disableRecommendedTimeline === 'boolean') {
		set.disableRecommendedTimeline = ps.disableRecommendedTimeline;
	}

	if (typeof ps.disableGlobalTimeline === 'boolean') {
		set.disableGlobalTimeline = ps.disableGlobalTimeline;
	}

	if (typeof ps.useStarForReactionFallback === 'boolean') {
		set.useStarForReactionFallback = ps.useStarForReactionFallback;
	}

	if (Array.isArray(ps.pinnedUsers)) {
		set.pinnedUsers = ps.pinnedUsers.filter(Boolean);
	}

	if (Array.isArray(ps.customMOTD)) {
		set.customMOTD = ps.customMOTD.filter(Boolean).map(x => sanitizeNoteContent(x));
	}

	if (Array.isArray(ps.customSplashIcons)) {
		set.customSplashIcons = ps.customSplashIcons.filter(Boolean);
	}

	if (Array.isArray(ps.recommendedInstances)) {
		set.recommendedInstances = ps.recommendedInstances.filter(Boolean);
	}

	if (Array.isArray(ps.hiddenTags)) {
		set.hiddenTags = ps.hiddenTags.filter(Boolean);
	}

	if (Array.isArray(ps.blockedHosts)) {
		set.blockedHosts = ps.blockedHosts.filter(Boolean);
	}

	if (ps.themeColor !== undefined) {
		set.themeColor = ps.themeColor;
	}

	if (Array.isArray(ps.allowedHosts)) {
		set.allowedHosts = ps.allowedHosts.filter(Boolean);
	}

	if (typeof ps.privateMode === 'boolean') {
		set.privateMode = ps.privateMode;
	}

	if (typeof ps.secureMode === 'boolean') {
		set.secureMode = ps.secureMode;
	}

	if (ps.mascotImageUrl !== undefined) {
		set.mascotImageUrl = ps.mascotImageUrl === null ? null : sanitizeUrl(ps.mascotImageUrl);
	}

	if (ps.bannerUrl !== undefined) {
		set.bannerUrl = ps.bannerUrl === null ? null : sanitizeUrl(ps.bannerUrl);
	}

	if (ps.logoImageUrl !== undefined) {
		set.logoImageUrl = ps.logoImageUrl;
	}

	if (ps.iconUrl !== undefined) {
		set.iconUrl = ps.iconUrl === null ? null : sanitizeUrl(ps.iconUrl);
	}

	if (ps.backgroundImageUrl !== undefined) {
		set.backgroundImageUrl = ps.backgroundImageUrl === null ? null : sanitizeUrl(ps.backgroundImageUrl);
	}

	if (ps.logoImageUrl !== undefined) {
		set.logoImageUrl = ps.logoImageUrl;
	}

	if (ps.name !== undefined) {
		set.name = ps.name === null ? null : sanitizeNoteContent(ps.name);
	}

	if (ps.description !== undefined) {
		set.description = ps.description === null ? null : sanitizeNoteContent(ps.description);
	}

	if (ps.defaultLightTheme !== undefined) {
		set.defaultLightTheme = ps.defaultLightTheme;
	}

	if (ps.defaultDarkTheme !== undefined) {
		set.defaultDarkTheme = ps.defaultDarkTheme;
	}

	if (ps.localDriveCapacityMb !== undefined) {
		set.localDriveCapacityMb = ps.localDriveCapacityMb;
	}

	if (ps.remoteDriveCapacityMb !== undefined) {
		set.remoteDriveCapacityMb = ps.remoteDriveCapacityMb;
	}

	if (ps.cacheRemoteFiles !== undefined) {
		set.cacheRemoteFiles = ps.cacheRemoteFiles;
	}

	if (ps.emailRequiredForSignup !== undefined) {
		set.emailRequiredForSignup = ps.emailRequiredForSignup;
	}

	if (ps.enableHcaptcha !== undefined) {
		set.enableHcaptcha = ps.enableHcaptcha;
	}

	if (ps.hcaptchaSiteKey !== undefined) {
		set.hcaptchaSiteKey = ps.hcaptchaSiteKey;
	}

	if (ps.hcaptchaSecretKey !== undefined) {
		set.hcaptchaSecretKey = ps.hcaptchaSecretKey;
	}

	if (ps.enableRecaptcha !== undefined) {
		set.enableRecaptcha = ps.enableRecaptcha;
	}

	if (ps.recaptchaSiteKey !== undefined) {
		set.recaptchaSiteKey = ps.recaptchaSiteKey;
	}

	if (ps.recaptchaSecretKey !== undefined) {
		set.recaptchaSecretKey = ps.recaptchaSecretKey;
	}

	if (ps.sensitiveMediaDetection !== undefined) {
		set.sensitiveMediaDetection = ps.sensitiveMediaDetection;
	}

	if (ps.sensitiveMediaDetectionSensitivity !== undefined) {
		set.sensitiveMediaDetectionSensitivity = ps.sensitiveMediaDetectionSensitivity;
	}

	if (ps.setSensitiveFlagAutomatically !== undefined) {
		set.setSensitiveFlagAutomatically = ps.setSensitiveFlagAutomatically;
	}

	if (ps.enableSensitiveMediaDetectionForVideos !== undefined) {
		set.enableSensitiveMediaDetectionForVideos = ps.enableSensitiveMediaDetectionForVideos;
	}

	if (ps.proxyAccountId !== undefined) {
		set.proxyAccountId = ps.proxyAccountId;
	}

	if (ps.maintainerName !== undefined) {
		set.maintainerName = ps.maintainerName === null ? null : sanitizeNoteContent(ps.maintainerName);
	}

	if (ps.maintainerEmail !== undefined) {
		set.maintainerEmail = ps.maintainerEmail;
	}

	if (Array.isArray(ps.langs)) {
		set.langs = ps.langs.filter(Boolean);
	}

	if (Array.isArray(ps.pinnedPages)) {
		set.pinnedPages = ps.pinnedPages.filter(Boolean);
	}

	if (ps.pinnedClipId !== undefined) {
		set.pinnedClipId = ps.pinnedClipId;
	}

	if (ps.summalyProxy !== undefined) {
		set.summalyProxy = ps.summalyProxy;
	}

	if (ps.enableTwitterIntegration !== undefined) {
		set.enableTwitterIntegration = ps.enableTwitterIntegration;
	}

	if (ps.twitterConsumerKey !== undefined) {
		set.twitterConsumerKey = ps.twitterConsumerKey;
	}

	if (ps.twitterConsumerSecret !== undefined) {
		set.twitterConsumerSecret = ps.twitterConsumerSecret;
	}

	if (ps.enableGithubIntegration !== undefined) {
		set.enableGithubIntegration = ps.enableGithubIntegration;
	}

	if (ps.githubClientId !== undefined) {
		set.githubClientId = ps.githubClientId;
	}

	if (ps.githubClientSecret !== undefined) {
		set.githubClientSecret = ps.githubClientSecret;
	}

	if (ps.enableDiscordIntegration !== undefined) {
		set.enableDiscordIntegration = ps.enableDiscordIntegration;
	}

	if (ps.discordClientId !== undefined) {
		set.discordClientId = ps.discordClientId;
	}

	if (ps.discordClientSecret !== undefined) {
		set.discordClientSecret = ps.discordClientSecret;
	}

	if (ps.enableSpotifyIntegration !== undefined) {
		set.enableSpotifyIntegration = ps.enableSpotifyIntegration;
	}

	if (ps.spotifyClientId !== undefined) {
		set.spotifyClientId = ps.spotifyClientId;
	}

	if (ps.spotifyClientSecret !== undefined) {
		set.spotifyClientSecret = ps.spotifyClientSecret;
	}

	if (ps.enableLastfmIntegration !== undefined) {
		set.enableLastfmIntegration = ps.enableLastfmIntegration;
	}

	if (ps.lastfmApiKey !== undefined) {
		set.lastfmApiKey = ps.lastfmApiKey;
	}

	if (ps.lastfmApiSecret !== undefined) {
		set.lastfmApiSecret = ps.lastfmApiSecret;
	}

	if (ps.enableEmail !== undefined) {
		set.enableEmail = ps.enableEmail;
	}

	if (ps.email !== undefined) {
		set.email = ps.email;
	}

	if (ps.smtpSecure !== undefined) {
		set.smtpSecure = ps.smtpSecure;
	}

	if (ps.smtpHost !== undefined) {
		set.smtpHost = ps.smtpHost;
	}

	if (ps.smtpPort !== undefined) {
		set.smtpPort = ps.smtpPort;
	}

	if (ps.smtpUser !== undefined) {
		set.smtpUser = ps.smtpUser;
	}

	if (ps.smtpPass !== undefined) {
		set.smtpPass = ps.smtpPass;
	}

	if (ps.errorImageUrl !== undefined) {
		set.errorImageUrl = ps.errorImageUrl === null ? null : sanitizeUrl(ps.errorImageUrl);
	}

	if (ps.enableServiceWorker !== undefined) {
		set.enableServiceWorker = ps.enableServiceWorker;
	}

	if (ps.swPublicKey !== undefined) {
		set.swPublicKey = ps.swPublicKey;
	}

	if (ps.swPrivateKey !== undefined) {
		set.swPrivateKey = ps.swPrivateKey;
	}

	if (ps.tosUrl !== undefined) {
		set.ToSUrl = ps.tosUrl === null ? null : sanitizeUrl(ps.tosUrl);
	}

	if (ps.repositoryUrl !== undefined) {
		set.repositoryUrl = sanitizeUrl(ps.repositoryUrl);
	}

	if (ps.feedbackUrl !== undefined) {
		set.feedbackUrl = sanitizeUrl(ps.feedbackUrl);
	}

	if (ps.useObjectStorage !== undefined) {
		set.useObjectStorage = ps.useObjectStorage;
	}

	if (ps.objectStorageBaseUrl !== undefined) {
		set.objectStorageBaseUrl = ps.objectStorageBaseUrl;
	}

	if (ps.objectStorageBucket !== undefined) {
		set.objectStorageBucket = ps.objectStorageBucket;
	}

	if (ps.objectStoragePrefix !== undefined) {
		set.objectStoragePrefix = ps.objectStoragePrefix;
	}

	if (ps.objectStorageEndpoint !== undefined) {
		set.objectStorageEndpoint = ps.objectStorageEndpoint;
	}

	if (ps.objectStorageRegion !== undefined) {
		set.objectStorageRegion = ps.objectStorageRegion;
	}

	if (ps.objectStoragePort !== undefined) {
		set.objectStoragePort = ps.objectStoragePort;
	}

	if (ps.objectStorageAccessKey !== undefined) {
		set.objectStorageAccessKey = ps.objectStorageAccessKey;
	}

	if (ps.objectStorageSecretKey !== undefined) {
		set.objectStorageSecretKey = ps.objectStorageSecretKey;
	}

	if (ps.objectStorageUseSSL !== undefined) {
		set.objectStorageUseSSL = ps.objectStorageUseSSL;
	}

	if (ps.objectStorageUseProxy !== undefined) {
		set.objectStorageUseProxy = ps.objectStorageUseProxy;
	}

	if (ps.objectStorageSetPublicRead !== undefined) {
		set.objectStorageSetPublicRead = ps.objectStorageSetPublicRead;
	}

	if (ps.objectStorageS3ForcePathStyle !== undefined) {
		set.objectStorageS3ForcePathStyle = ps.objectStorageS3ForcePathStyle;
	}

	if (ps.muxAccessToken !== undefined) {
		if (ps.muxAccessToken === '') {
			set.mux_access = null;
		} else {
			set.mux_access = ps.muxAccessToken;
		}
	}

	if (ps.muxSecretKey !== undefined) {
		if (ps.muxSecretKey === '') {
			set.mux_secret_key = null;
		} else {
			set.mux_secret_key = ps.muxSecretKey;
		}
	}

	if (ps.muxTokenId !== undefined) {
		if (ps.muxTokenId === '') {
			set.mux_token_id = null;
		} else {
			set.mux_token_id = ps.muxTokenId;
		}
	}

	if (ps.muxWebhookSecret !== undefined) {
		if (ps.muxWebhookSecret === '') {
			set.mux_webhook_secret = null;
		} else {
			set.mux_webhook_secret = ps.muxWebhookSecret;
		}
	}

	if (ps.muxSigningKeyId !== undefined) {
		if (ps.muxSigningKeyId === '') {
			set.mux_signing_key_id = null;
		} else {
			set.mux_signing_key_id = ps.muxSigningKeyId;
		}
	}

	if (ps.muxSigningKeyPrivate !== undefined) {
		if (ps.muxSigningKeyPrivate === '') {
			set.mux_signing_key_private = null;
		} else {
			set.mux_signing_key_private = ps.muxSigningKeyPrivate;
		}
	}

	if (ps.deeplAuthKey !== undefined) {
		if (ps.deeplAuthKey === '') {
			set.deeplAuthKey = null;
		} else {
			set.deeplAuthKey = ps.deeplAuthKey;
		}
	}

	if (ps.deeplIsPro !== undefined) {
		set.deeplIsPro = ps.deeplIsPro;
	}

	if (ps.gifboxAuthKey !== undefined) {
		if (ps.gifboxAuthKey === '') {
			set.gifboxAuthKey = null;
		} else {
			set.gifboxAuthKey = ps.gifboxAuthKey;
		}
	}

	if (ps.product_id_month !== undefined) {
		if (ps.product_id_month === '') {
			set.product_id_month = null;
		} else {
			set.product_id_month = ps.product_id_month;
		}
	}

	if (ps.product_id_mp !== undefined) {
		if (ps.product_id_mp === '') {
			set.product_id_mp = null;
		} else {
			set.product_id_mp = ps.product_id_mp;
		}
	}

	if (ps.price_id_month !== undefined) {
		if (ps.price_id_month === '') {
			set.price_id_month = null;
		} else {
			set.price_id_month = ps.price_id_month;
		}
	}

	if (ps.price_id_year !== undefined) {
		if (ps.price_id_year === '') {
			set.price_id_year = null;
		} else {
			set.price_id_year = ps.price_id_year;
		}
	}

	if (ps.price_id_month_mp !== undefined) {
		if (ps.price_id_month_mp === '') {
			set.price_id_month_mp = null;
		} else {
			set.price_id_month_mp = ps.price_id_month_mp;
		}
	}

	if (ps.price_id_year_mp !== undefined) {
		if (ps.price_id_year_mp === '') {
			set.price_id_year_mp = null;
		} else {
			set.price_id_year_mp = ps.price_id_year_mp;
		}
	}

	if (ps.price_id_gift_month_plus !== undefined) {
		if (ps.price_id_gift_month_plus === '') {
			set.price_id_gift_month_plus = null;
		} else {
			set.price_id_gift_month_plus = ps.price_id_gift_month_plus;
		}
	}

	if (ps.price_id_gift_year_plus !== undefined) {
		if (ps.price_id_gift_year_plus === '') {
			set.price_id_gift_year_plus = null;
		} else {
			set.price_id_gift_year_plus = ps.price_id_gift_year_plus;
		}
	}

	if (ps.price_id_gift_month_mplus !== undefined) {
		if (ps.price_id_gift_month_mplus === '') {
			set.price_id_gift_month_mplus = null;
		} else {
			set.price_id_gift_month_mplus = ps.price_id_gift_month_mplus;
		}
	}

	if (ps.price_id_gift_year_mplus !== undefined) {
		if (ps.price_id_gift_year_mplus === '') {
			set.price_id_gift_year_mplus = null;
		} else {
			set.price_id_gift_year_mplus = ps.price_id_gift_year_mplus;
		}
	}

	if (ps.stripe_key !== undefined) {
		if (ps.stripe_key === '') {
			set.stripe_key = null;
		} else {
			set.stripe_key = ps.stripe_key;
		}
	}

	if (ps.stripe_webhook_secret !== undefined) {
		if (ps.stripe_webhook_secret === '') {
			set.stripe_webhook_secret = null;
		} else {
			set.stripe_webhook_secret = ps.stripe_webhook_secret;
		}
	}

	if (ps.enableIpLogging !== undefined) {
		set.enableIpLogging = ps.enableIpLogging;
	}

	if (ps.enableActiveEmailValidation !== undefined) {
		set.enableActiveEmailValidation = ps.enableActiveEmailValidation;
	}

	if (ps.enableFirebaseMessaging !== undefined) {
		set.enableFirebaseMessaging = ps.enableFirebaseMessaging;
	}

	if (ps.firebaseApiKey !== undefined) {
		if (ps.firebaseApiKey === '') {
			set.firebaseApiKey = null;
		} else {
			set.firebaseApiKey = ps.firebaseApiKey;
		}
	}

	if (ps.firebaseAuthDomain !== undefined) {
		if (ps.firebaseAuthDomain === '') {
			set.firebaseAuthDomain = null;
		} else {
			set.firebaseAuthDomain = ps.firebaseAuthDomain;
		}
	}

	if (ps.firebaseProjectId !== undefined) {
		if (ps.firebaseProjectId === '') {
			set.firebaseProjectId = null;
		} else {
			set.firebaseProjectId = ps.firebaseProjectId;
		}
	}

	if (ps.firebaseStorageBucket !== undefined) {
		if (ps.firebaseStorageBucket === '') {
			set.firebaseStorageBucket = null;
		} else {
			set.firebaseStorageBucket = ps.firebaseStorageBucket;
		}
	}

	if (ps.firebaseMessagingSenderId !== undefined) {
		if (ps.firebaseMessagingSenderId === '') {
			set.firebaseMessagingSenderId = null;
		} else {
			set.firebaseMessagingSenderId = ps.firebaseMessagingSenderId;
		}
	}

	if (ps.firebaseAppId !== undefined) {
		if (ps.firebaseAppId === '') {
			set.firebaseAppId = null;
		} else {
			set.firebaseAppId = ps.firebaseAppId;
		}
	}

	if (ps.firebaseVapidPublicKey !== undefined) {
		if (ps.firebaseVapidPublicKey === '') {
			set.firebaseVapidPublicKey = null;
		} else {
			set.firebaseVapidPublicKey = ps.firebaseVapidPublicKey;
		}
	}

	if (ps.firebaseServiceAccountJson !== undefined) {
		if (ps.firebaseServiceAccountJson === '') {
			set.firebaseServiceAccountJson = null;
		} else {
			set.firebaseServiceAccountJson = ps.firebaseServiceAccountJson;
		}
	}

	// RevenueCat Mobile Billing configuration
	if (typeof ps.enableRevenueCat === 'boolean') {
		set.enableRevenueCat = ps.enableRevenueCat;
	}

	if (ps.revenueCatPublicKey !== undefined) {
		if (ps.revenueCatPublicKey === '') {
			set.revenueCatPublicKey = null;
		} else {
			set.revenueCatPublicKey = ps.revenueCatPublicKey;
		}
	}

	if (ps.revenueCatSecretKey !== undefined) {
		if (ps.revenueCatSecretKey === '') {
			set.revenueCatSecretKey = null;
		} else {
			set.revenueCatSecretKey = ps.revenueCatSecretKey;
		}
	}

	if (ps.revenueCatWebhookSecret !== undefined) {
		if (ps.revenueCatWebhookSecret === '') {
			set.revenueCatWebhookSecret = null;
		} else {
			set.revenueCatWebhookSecret = ps.revenueCatWebhookSecret;
		}
	}

	await db.transaction(async transactionalEntityManager => {
		const metas = await transactionalEntityManager.find(Meta, {
			order: {
				id: 'DESC',
			},
		});

		const meta = metas[0];

		if (meta) {
			await transactionalEntityManager.update(Meta, meta.id, set);
		} else {
			await transactionalEntityManager.save(Meta, set);
		}
	});

	insertModerationLog(me, 'updateMeta');
});
