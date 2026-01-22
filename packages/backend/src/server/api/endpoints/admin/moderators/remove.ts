import define from '../../../define.js';
import { Users } from '@/models/index.js';
import { publishInternalEvent } from '@/services/stream.js';
import { insertModerationLog } from '@/services/insert-moderation-log.js';
import { detectProtectedFields } from '@/misc/security/filter-privileged-fields.js';
import { logPrivilegeRevocation } from '@/misc/security/audit-logger.js';

export const meta = {
	tags: ['admin'],

	requireCredential: true,
	requireAdmin: true,

	errors: {
		userNotFound: {
			message: 'User not found.',
			code: 'USER_NOT_FOUND',
			id: '770b3abc-6b4a-4d0d-9e5a-2b3c5d4e3f2a',
		},

		cannotModifyAdmin: {
			message: 'Cannot remove moderator status from admin user.',
			code: 'CANNOT_MODIFY_ADMIN',
			id: 'a8c724b3-6e9c-4b46-b1a8-bc3ed6258370',
		},

		notModerator: {
			message: 'User is not a moderator.',
			code: 'NOT_MODERATOR',
			id: 'c9e946d5-8g1e-6f8g-1g7c-4d5e7f6g5b4c',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		userId: { type: 'string', format: 'barkle:id' },
	},
	required: ['userId'],
} as const;

export default define(meta, paramDef, async (ps, me, token, file, ip) => {
	const user = await Users.findOneBy({ id: ps.userId });

	if (user == null) {
		throw new Error(meta.errors.userNotFound.message);
	}

	// Security check: Prevent modification of admin users
	if (user.isAdmin) {
		throw new Error(meta.errors.cannotModifyAdmin.message);
	}

	// Security check: Verify no protected fields are being modified
	const detectedFields = detectProtectedFields(ps);
	if (detectedFields.length > 0) {
		throw new Error(`Attempt to modify protected fields detected: ${detectedFields.join(', ')}`);
	}

	// Check if actually a moderator
	if (!user.isModerator) {
		throw new Error(meta.errors.notModerator.message);
	}

	// Update user
	await Users.update(user.id, {
		isModerator: false,
	});

	publishInternalEvent('userChangeModeratorState', { id: user.id, isModerator: false });

	// Audit log
	await insertModerationLog(me, 'removeModerator', {
		targetUserId: user.id,
		targetUsername: user.username,
	});

	// Comprehensive audit logging
	logPrivilegeRevocation(
		user.id,
		user.username,
		'moderator',
		me ? { id: me.id, username: me.username } : undefined,
		{ ip }
	);
});
