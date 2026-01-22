import { SecurityEvent, SecurityEventType } from '@/models/entities/security-event.js';
import { SecurityEvents } from '@/models/index.js';
import { genId } from '@/misc/gen-id.js';
import { User } from '@/models/entities/user.js';
import { CacheableLocalUser } from '@/models/entities/user.js';

export interface SecurityEventDetails {
	userId?: User['id'] | null;
	ipAddress?: string | null;
	userAgent?: string | null;
	details?: Record<string, any> | null;
	severity?: 'critical' | 'high' | 'medium' | 'low' | 'info';
}

/**
 * Log a security event for monitoring and auditing
 * @param type - The type of security event
 * @param options - Additional event details
 */
export async function logSecurityEvent(
	type: SecurityEventType,
	options: SecurityEventDetails = {}
): Promise<void> {
	const { userId, ipAddress, userAgent, details, severity = 'info' } = options;

	try {
		await SecurityEvents.insert({
			id: genId(),
			createdAt: new Date(),
			type,
			userId: userId ?? null,
			user: userId ? null : undefined, // Let TypeORM handle the relation
			ipAddress: ipAddress ?? null,
			userAgent: userAgent ?? null,
			details: details ?? null,
			severity,
			reviewed: false,
		});
	} catch (error) {
		// Don't throw errors when logging security events to prevent cascading failures
		console.error('Failed to log security event:', error);
	}
}

/**
 * Log authentication failure
 */
export async function logAuthFailure(
	userId: User['id'] | null,
	ipAddress: string,
	userAgent: string,
	reason: string
): Promise<void> {
	await logSecurityEvent(SecurityEventType.SIGNIN_FAILURE, {
		userId,
		ipAddress,
		userAgent,
		details: { reason },
		severity: 'medium',
	});
}

/**
 * Log rate limit exceeded
 */
export async function logRateLimitExceeded(
	userId: User['id'] | null,
	ipAddress: string,
	endpoint: string
): Promise<void> {
	await logSecurityEvent(SecurityEventType.RATE_LIMIT_EXCEEDED, {
		userId,
		ipAddress,
		details: { endpoint },
		severity: 'low',
	});
}

/**
 * Log suspicious activity
 */
export async function logSuspiciousActivity(
	userId: User['id'] | null,
	ipAddress: string,
	activity: string,
	severity: 'high' | 'medium' | 'low' = 'medium'
): Promise<void> {
	await logSecurityEvent(SecurityEventType.SUSPICIOUS_ACTIVITY, {
		userId,
		ipAddress,
		details: { activity },
		severity,
	});
}

/**
 * Log access denied event
 */
export async function logAccessDenied(
	userId: CacheableLocalUser['id'] | null,
	ipAddress: string,
	resource: string,
	reason?: string
): Promise<void> {
	await logSecurityEvent(SecurityEventType.ACCESS_DENIED, {
		userId,
		ipAddress,
		details: {
			resource,
			reason: reason ?? 'Unauthorized access attempt',
		},
		severity: 'medium',
	});
}

/**
 * Log security violation (e.g., injection attempts)
 */
export async function logSecurityViolation(
	userId: User['id'] | null,
	ipAddress: string,
	violationType: string,
	details: Record<string, any>
): Promise<void> {
	await logSecurityEvent(SecurityEventType.SECURITY_VIOLATION, {
		userId,
		ipAddress,
		details: {
			violationType,
			...details,
		},
		severity: 'high',
	});
}
