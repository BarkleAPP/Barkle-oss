/**
 * Comprehensive audit logging for privileged operations
 * Tracks security-sensitive actions for compliance and forensics
 */

import Logger from '@/services/logger.js';

type AuditEventType =
	| 'PRIVILEGE_ESCALATION'
	| 'PRIVILEGE_REVOCATION'
	| 'USER_MODIFICATION'
	| 'USER_DELETION'
	| 'ADMIN_ACTION'
	| 'MODERATOR_ACTION'
	| 'FILE_ACCESS'
	| 'SYSTEM_CONFIG_CHANGE'
	| 'AUTHENTICATION_FAILURE'
	| 'AUTHORIZATION_FAILURE'
	| 'SECURITY_VIOLATION';

interface AuditLogEntry {
	timestamp: Date;
	eventType: AuditEventType;
	userId: string | null;
	username: string | null;
	ipAddress: string;
	userAgent: string;
	action: string;
	details: Record<string, any>;
	severity: 'info' | 'warning' | 'error' | 'critical';
	success: boolean;
	errorMessage?: string;
}

class AuditLogger {
	private logger: Logger;

	constructor() {
		this.logger = new Logger('audit');
	}

	/**
	 * Log a privileged operation
	 */
	log(
		eventType: AuditEventType,
		action: string,
		details: Record<string, any>,
		user?: { id: string; username: string; host?: string | null } | null,
		context?: { ip?: string; userAgent?: string },
		success: boolean = true,
		errorMessage?: string
	): void {
		const entry: AuditLogEntry = {
			timestamp: new Date(),
			eventType,
			userId: user?.id || null,
			username: user?.username || null,
			ipAddress: context?.ip || 'unknown',
			userAgent: context?.userAgent || 'unknown',
			action,
			details,
			severity: this.getSeverity(eventType),
			success,
			errorMessage,
		};

		// Log to audit trail
		this.logEntry(entry);
	}

	/**
	 * Log security violations (critical severity)
	 */
	logSecurityViolation(
		violationType: string,
		details: Record<string, any>,
		user?: { id: string; username: string } | null,
		context?: { ip?: string }
	): void {
		this.log(
			'SECURITY_VIOLATION',
			violationType,
			details,
			user,
			context,
			false,
			`Security violation detected: ${violationType}`
		);
	}

	/**
	 * Log privilege escalation (e.g., adding moderator/admin)
	 */
	logPrivilegeEscalation(
		targetUserId: string,
		targetUsername: string,
		privilegeLevel: string,
		actor?: { id: string; username: string },
		context?: { ip?: string }
	): void {
		this.log(
			'PRIVILEGE_ESCALATION',
			`Privilege escalation: ${targetUsername} -> ${privilegeLevel}`,
			{
				targetUserId,
				targetUsername,
				privilegeLevel,
			},
			actor,
			context,
			true
		);
	}

	/**
	 * Log privilege revocation
	 */
	logPrivilegeRevocation(
		targetUserId: string,
		targetUsername: string,
		privilegeLevel: string,
		actor?: { id: string; username: string },
		context?: { ip?: string }
	): void {
		this.log(
			'PRIVILEGE_REVOCATION',
			`Privilege revocation: ${targetUsername} - ${privilegeLevel}`,
			{
				targetUserId,
				targetUsername,
				privilegeLevel,
			},
			actor,
			context,
			true
		);
	}

	/**
	 * Log user modification
	 */
	logUserModification(
		targetUserId: string,
		modifications: Record<string, any>,
		actor?: { id: string; username: string },
		context?: { ip?: string }
	): void {
		this.log(
			'USER_MODIFICATION',
			`User modified: ${targetUserId}`,
			{
				targetUserId,
				modifications,
			},
			actor,
			context,
			true
		);
	}

	/**
	 * Log admin action
	 */
	logAdminAction(
		action: string,
		details: Record<string, any>,
		actor?: { id: string; username: string },
		context?: { ip?: string }
	): void {
		this.log('ADMIN_ACTION', action, details, actor, context, true);
	}

	/**
	 * Log moderator action
	 */
	logModeratorAction(
		action: string,
		details: Record<string, any>,
		actor?: { id: string; username: string },
		context?: { ip?: string }
	): void {
		this.log('MODERATOR_ACTION', action, details, actor, context, true);
	}

	/**
	 * Log authentication failure
	 */
	logAuthenticationFailure(
		username: string,
		reason: string,
		context?: { ip?: string; userAgent?: string }
	): void {
		this.log(
			'AUTHENTICATION_FAILURE',
			`Authentication failed for ${username}`,
			{
				attemptedUsername: username,
				reason,
			},
			null,
			context,
			false,
			`Authentication failed: ${reason}`
		);
	}

	/**
	 * Log authorization failure
	 */
	logAuthorizationFailure(
		userId: string,
		attemptedAction: string,
		reason: string,
		context?: { ip?: string }
	): void {
		this.log(
			'AUTHORIZATION_FAILURE',
			`Authorization failed for ${userId}`,
			{
				userId,
				attemptedAction,
				reason,
			},
			null,
			context,
			false,
			`Authorization failed: ${reason}`
		);
	}

	private getSeverity(eventType: AuditEventType): 'info' | 'warning' | 'error' | 'critical' {
		switch (eventType) {
			case 'SECURITY_VIOLATION':
			case 'AUTHENTICATION_FAILURE':
			case 'AUTHORIZATION_FAILURE':
				return 'critical';
			case 'PRIVILEGE_ESCALATION':
			case 'PRIVILEGE_REVOCATION':
			case 'USER_DELETION':
			case 'ADMIN_ACTION':
				return 'error';
			case 'MODERATOR_ACTION':
			case 'USER_MODIFICATION':
			case 'SYSTEM_CONFIG_CHANGE':
				return 'warning';
			case 'FILE_ACCESS':
			default:
				return 'info';
		}
	}

	private logEntry(entry: AuditLogEntry): void {
		const logMessage = `[${entry.severity.toUpperCase()}] ${entry.eventType}: ${entry.action}`;

		const logData = {
			...entry,
			// Don't log full user agent to avoid clutter
			userAgentSummary: entry.userAgent ? entry.userAgent.split(' ')[0] : 'unknown',
		};

		switch (entry.severity) {
			case 'critical':
				this.logger.error(logMessage, logData);
				break;
			case 'error':
				this.logger.error(logMessage, logData);
				break;
			case 'warning':
				this.logger.warn(logMessage, logData);
				break;
			case 'info':
			default:
				this.logger.info(logMessage, logData);
				break;
		}
	}
}

// Export singleton instance
export const auditLogger = new AuditLogger();

// Export convenience functions for backward compatibility
export function logSecurityViolation(
	violationType: string,
	details: Record<string, any>,
	user?: { id: string; username: string } | null,
	context?: { ip?: string }
): void {
	auditLogger.logSecurityViolation(violationType, details, user, context);
}

export function logPrivilegeEscalation(
	targetUserId: string,
	targetUsername: string,
	privilegeLevel: string,
	actor?: { id: string; username: string },
	context?: { ip?: string }
): void {
	auditLogger.logPrivilegeEscalation(targetUserId, targetUsername, privilegeLevel, actor, context);
}

export function logPrivilegeRevocation(
	targetUserId: string,
	targetUsername: string,
	privilegeLevel: string,
	actor?: { id: string; username: string },
	context?: { ip?: string }
): void {
	auditLogger.logPrivilegeRevocation(targetUserId, targetUsername, privilegeLevel, actor, context);
}

export function logAdminAction(
	action: string,
	details: Record<string, any>,
	actor?: { id: string; username: string },
	context?: { ip?: string }
): void {
	auditLogger.logAdminAction(action, details, actor, context);
}

export function logModeratorAction(
	action: string,
	details: Record<string, any>,
	actor?: { id: string; username: string },
	context?: { ip?: string }
): void {
	auditLogger.logModeratorAction(action, details, actor, context);
}

export function logAuthenticationFailure(
	username: string,
	reason: string,
	context?: { ip?: string; userAgent?: string }
): void {
	auditLogger.logAuthenticationFailure(username, reason, context);
}

export function logAuthorizationFailure(
	userId: string,
	attemptedAction: string,
	reason: string,
	context?: { ip?: string }
): void {
	auditLogger.logAuthorizationFailure(userId, attemptedAction, reason, context);
}
