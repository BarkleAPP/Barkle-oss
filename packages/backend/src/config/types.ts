/**
 * ユーザーが設定する必要のある情報
 */
export type Source = {
	repository_url?: string;
	feedback_url?: string;
	url: string;
	port: number;
	disableHsts?: boolean;
	db: {
		host: string;
		port: number;
		db: string;
		user: string;
		pass: string;
		disableCache?: boolean;
		extra?: { [x: string]: string };
	};
	redis: {
		host: string;
		port: number;
		family?: number;
		pass: string;
		db?: number;
		prefix?: string;
	};
	elasticsearch: {
		host: string;
		port: number;
		ssl?: boolean;
		user?: string;
		pass?: string;
		index?: string;
	};

	proxy?: string;
	proxySmtp?: string;
	proxyBypassHosts?: string[];

	allowedPrivateNetworks?: string[];

	maxFileSize?: number;

	accesslog?: string;

	clusterLimit?: number;

	id: string;

	outgoingAddressFamily?: 'ipv4' | 'ipv6' | 'dual';

	deliverJobConcurrency?: number;
	inboxJobConcurrency?: number;
	deliverJobPerSec?: number;
	inboxJobPerSec?: number;
	deliverJobMaxAttempts?: number;
	inboxJobMaxAttempts?: number;

	syslog: {
		host: string;
		port: number;
	};

	mediaProxy?: string;
	proxyRemoteFiles?: boolean;

	// Managed hosting stuff
	maxUserSignups?: number;
	isManagedHosting?: boolean;
	maxNoteLength?: number;
	deepl: {
		managed?: boolean;
		authKey?: string;
		isPro?: boolean;
	};
	email: {
		managed?: boolean;
		address?: string;
		host?: string;
		port?: number;
		user?: string;
		pass?: string;
		useImplicitSslTls?: boolean;

	};
	objectStorage: {
		managed?: boolean;
		baseUrl?: string;
		bucket?: string;
		prefix?: string;
		endpoint?: string;
		region?: string;
		accessKey?: string;
		secretKey?: string;
		useSsl?: boolean;
		connnectOverProxy?: boolean;
		setPublicReadOnUpload?: boolean;
		s3ForcePathStyle?: boolean;
	};
	gifbox: {
		managed?: boolean;
		authKey?: string;
	};
	/*stripe: {
		product_id_month?: string;
		product_id_year?: string;
		price_id_month?: string;
		price_id_year?: string;
		stripe_key?: string
		stripe_webhook_secret?: string
	}*/
	summalyProxyUrl?: string;
	firebase?: {
		projectId?: string;
		serviceAccountKey?: any;
	};
	reactionBasedRecommendations?: {
		enabled?: boolean;
		minCommonReactions?: number;
		maxSimilarUsers?: number;
		followBoostMultiplier?: number;
		positiveSentimentWeight?: number;
		negativeSentimentWeight?: number;
		recencyDecayDays?: number;
		reactionHistoryDays?: number;
		maxReactionsPerUser?: number;
		cacheTtlProfile?: number;
		cacheTtlSimilar?: number;
		cacheTtlCandidates?: number;
		cacheTtlFollowing?: number;
		positiveReactions?: string[];
		negativeReactions?: string[];
	};

	// Security: CORS configuration
	cors?: {
		// Array of allowed origins. If not specified, defaults to the instance URL.
		// Set to '*' to allow all origins (NOT RECOMMENDED for production).
		// Supports wildcard subdomains: ['https://*.example.com']
		// IMPORTANT: Requests with NO origin header (native mobile apps, curl) are ALWAYS allowed
		// Example: ['https://example.com', 'https://app.example.com', 'https://*.example.com']
		allowedOrigins?: string[];

		// Whether to allow credentials (cookies, authorization headers)
		// Default: true
		// Set to false for public endpoints that don't need authentication
		allowCredentials?: boolean;

		// Allowed HTTP methods
		// Default: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD']
		allowedMethods?: string[];

		// Allowed headers in requests
		// Default: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
		allowedHeaders?: string[];

		// Exposed headers that browsers can read
		// Default: ['Content-Length', 'Content-Type', 'Content-Range']
		exposeHeaders?: string[];

		// Max age for preflight requests (in seconds)
		// Default: 86400 (24 hours)
		maxAge?: number;
	};

	// Security: Proxy trust configuration (CVE-2025-66482 mitigation)
	// Controls whether to trust X-Forwarded-For headers for IP address detection
	// IMPORTANT: Set to true ONLY if you are running behind a trusted reverse proxy
	// Default: false (secure by default - does not trust X-Forwarded-For headers)
	// If true, the first IP in the X-Forwarded-For header is used for rate limiting
	// If false, the direct connection IP is used (prevents header spoofing attacks)
	trustProxy?: boolean;
};

/**
 * Barkleが自動的に(ユーザーが設定した情報から推論して)設定する情報
 */
export type Mixin = {
	version: string;
	host: string;
	hostname: string;
	scheme: string;
	wsScheme: string;
	apiUrl: string;
	wsUrl: string;
	authUrl: string;
	driveUrl: string;
	userAgent: string;
	clientEntry: string;
};

export type Config = Source & Mixin;
