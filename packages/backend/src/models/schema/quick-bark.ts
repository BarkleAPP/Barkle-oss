export const packedQuickBarkSchema = {
    type: 'object',
    properties: {
        id: {
            type: 'string',
            optional: false, nullable: false,
            format: 'id',
            example: 'xxxxxxxxxx',
        },
        createdAt: {
            type: 'string',
            optional: false, nullable: false,
            format: 'date-time',
        },
        userId: {
            type: 'string',
            optional: false, nullable: false,
            format: 'id',
        },
        user: {
            type: 'object',
            ref: 'UserLite',
            optional: false, nullable: false,
        },
        content: {
            type: 'string',
            optional: false, nullable: true,
        },
        type: {
            type: 'string',
            optional: false, nullable: false,
            enum: ['text', 'image', 'video', 'gif'],
        },
        expiresAt: {
            type: 'string',
            optional: false, nullable: false,
            format: 'date-time',
        },
        sharedNoteId: {
            type: 'string',
            optional: true, nullable: true,
            format: 'id',
        },
        sharedNote: {
            type: 'object',
            optional: true, nullable: true,
            ref: 'Note',
        },
        fileId: {
            type: 'string',
            optional: true, nullable: true,
            format: 'id',
        },
        file: {
            type: 'object',
            optional: true, nullable: true,
            ref: 'DriveFile',
        },
    },
} as const;