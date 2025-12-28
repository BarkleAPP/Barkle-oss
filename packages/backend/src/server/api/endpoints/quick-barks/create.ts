import { QuickBarks, DriveFiles } from '@/models/index.js';
import define from '../../define.js';
import { ulid } from 'ulid';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['quick-barks'],
	requireCredential: true,
	res: {
		type: 'object',
		optional: false,
		nullable: false,
		ref: 'QuickBark',
	},
	errors: {
		fileNotFound: {
			message: 'File not found.',
			code: 'FILE_NOT_FOUND',
			id: '8f2c8d1e-9b4a-4c7e-8f5e-9d1b0e3f7a8c',
		},
		invalidFileType: {
			message: 'Invalid file type.',
			code: 'INVALID_FILE_TYPE',
			id: '9e3b2c4d-5f6g-7h8i-9j0k-1l2m3n4o5p6q',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		content: { type: 'string', nullable: true },
		fileId: { type: 'string', format: 'barkle:id', nullable: true },
		sharedNoteId: { type: 'string', format: 'barkle:id', nullable: true },
	},
	required: [],
} as const;

export default define(meta, paramDef, async (ps, user) => {
	let type: 'text' | 'image' | 'video' | 'gif' = 'text';
	let file = null;

	if (ps.fileId) {
		file = await DriveFiles.findOneBy({
			id: ps.fileId,
			userId: user!.id,
		});

		if (file == null) {
			throw new ApiError(meta.errors.fileNotFound);
		}

		if (file.type.startsWith('image/gif')) {
			type = 'gif';
		} else if (file.type.startsWith('image/')) {
			type = 'image';
		} else if (file.type.startsWith('video/')) {
			type = 'video';
		} else {
			throw new ApiError(meta.errors.invalidFileType);
		}
	}

	const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
	const quickBarkId = ulid();

	await QuickBarks.insert({
		id: quickBarkId,
		createdAt: new Date(),
		userId: user!.id,
		content: ps.content as string | undefined,
		type,
		expiresAt,
		sharedNoteId: ps.sharedNoteId as string | undefined,
		fileId: ps.fileId as string | undefined,
	});

	const quickBark = await QuickBarks.findOneByOrFail({ id: quickBarkId });
	return await QuickBarks.pack(quickBark, user);
});
