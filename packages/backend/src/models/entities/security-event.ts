import { PrimaryColumn, Entity, Index, JoinColumn, Column, ManyToOne } from 'typeorm';
import { User } from './user.js';
import { id } from '../id.js';

/**
 * Security Event Types
 * Tracks various security-related events for monitoring and auditing
 */
export enum SecurityEventType {
	// Authentication Events
	SIGNIN_SUCCESS = 'signin_success',
	SIGNIN_FAILURE = 'signin_failure',
	SIGNIN_RATE_LIMITED = 'signin_rate_limited',
	PASSWORD_RESET_REQUEST = 'password_reset_request',
	PASSWORD_RESET_COMPLETE = 'password_reset_complete',

	// Authorization Events
	ACCESS_DENIED = 'access_denied',
	PRIVILEGE_ESCALATION_ATTEMPT = 'privilege_escalation_attempt',
	ADMIN_ACCESS = 'admin_access',

	// Account Security
	PASSWORD_CHANGED = 'password_changed',
	EMAIL_CHANGED = 'email_changed',
	ACCOUNT_SUSPENDED = 'account_suspended',
	ACCOUNT_UNSUSPENDED = 'account_unsuspended',

	// Input Validation & Injection Attempts
	INVALID_INPUT = 'invalid_input',
	PATH_TRAVERSAL_ATTEMPT = 'path_traversal_attempt',
	SQL_INJECTION_ATTEMPT = 'sql_injection_attempt',
	XSS_ATTEMPT = 'xss_attempt',
	PROTOTYPE_POLLUTION_ATTEMPT = 'prototype_pollution_attempt',

	// Rate Limiting
	RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',

	// File Security
	MALICIOUS_FILE_UPLOAD = 'malicious_file_upload',
	INVALID_FILE_TYPE = 'invalid_file_type',

	// API Security
	INVALID_API_KEY = 'invalid_api_key',
	INVALID_TOKEN = 'invalid_token',

	// CSRF Protection
	CSRF_TOKEN_MISSING = 'csrf_token_missing',
	CSRF_TOKEN_INVALID = 'csrf_token_invalid',

	// Other
	SUSPICIOUS_ACTIVITY = 'suspicious_activity',
	SECURITY_VIOLATION = 'security_violation',
}

@Entity()
export class SecurityEvent {
	@PrimaryColumn(id())
	public id: string;

	@Column('timestamp with time zone', {
		comment: 'The created date of the SecurityEvent.',
	})
	public createdAt: Date;

	@Index()
	@Column({
		type: 'enum',
		enum: SecurityEventType,
		comment: 'The type of security event',
	})
	public type: SecurityEventType;

	@Index()
	@Column(id(), {
		nullable: true,
		comment: 'The user ID associated with this event (if applicable)',
	})
	public userId: User['id'] | null;

	@ManyToOne(type => User, {
		onDelete: 'CASCADE',
		nullable: true,
	})
	@JoinColumn()
	public user: User | null;

	@Column('varchar', {
		length: 128,
		nullable: true,
		comment: 'IP address associated with the event',
	})
	public ipAddress: string | null;

	@Column('varchar', {
		length: 512,
		nullable: true,
		comment: 'User agent string',
	})
	public userAgent: string | null;

	@Column('jsonb', {
		nullable: true,
		comment: 'Additional event details',
	})
	public details: Record<string, any> | null;

	@Column('varchar', {
		length: 32,
		nullable: true,
		comment: 'Severity level: critical, high, medium, low, info',
	})
	public severity: 'critical' | 'high' | 'medium' | 'low' | 'info' | null;

	@Column('boolean', {
		default: false,
		comment: 'Whether this event has been reviewed by an admin',
	})
	public reviewed: boolean;
}
