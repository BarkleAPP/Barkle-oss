/**
 * Config Cache Utility
 *
 * Provides a reusable pattern for caching async configuration with TTL.
 * Eliminates code duplication across services that need config caching.
 */

/**
 * Creates an async config cache with automatic TTL-based invalidation
 *
 * @param loader - Async function that loads the configuration
 * @param ttlMs - Time to live in milliseconds before cache is invalidated
 * @returns Function that returns cached config or loads fresh if expired
 *
 * @example
 * const getConfig = createAsyncConfigCache(
 *   () => getReactionRecommendationsConfig(),
 *   5 * 60 * 1000 // 5 minutes
 * );
 *
 * // Later, use it
 * const config = await getConfig();
 */
export function createAsyncConfigCache<T>(
	loader: () => Promise<T>,
	ttlMs: number
): () => Promise<T> {
	let cachedValue: T | null = null;
	let cacheTime = 0;

	return async () => {
		const now = Date.now();
		if (!cachedValue || now - cacheTime > ttlMs) {
			cachedValue = await loader();
			cacheTime = now;
		}
		return cachedValue;
	};
}
