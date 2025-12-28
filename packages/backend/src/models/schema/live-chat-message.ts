export const packedLiveChatMessageSchema = {
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
			optional: true, nullable: false,
		},
		streamId: {
			type: 'string',
			optional: false, nullable: false,
			format: 'id',
		},
		text: {
			type: 'string',
			optional: false, nullable: false,
		},
		isDeleted: {
			type: 'boolean',
			optional: false, nullable: false,
		},
		deletedAt: {
			type: 'string',
			optional: false, nullable: true,
			format: 'date-time',
		},
		deletedBy: {
			type: 'string',
			optional: false, nullable: true,
			format: 'id',
		},
	},
} as const;
