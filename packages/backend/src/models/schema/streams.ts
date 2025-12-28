export const packedStreamsSchema = {
	type: 'object',
	properties: {
		id: {
			type: 'string',
			optional: false, nullable: false,
			format: 'id',
			example: 'xxxxxxxxxx',
		},
		title: {
			type: 'string',
			optional: false, nullable: true,
		},
		key: {
			type: 'string',
			optional: false, nullable: true,
			description: 'stream key',
		},
		url: {
			type: 'string',
			optional: false, nullable: false,
		},
		playbackId: {
			type: 'string',
			optional: false, nullable: false,
		},
		noteId: {
			type: 'string',
			optional: false, nullable: false,
		},
		userId: {
			type: 'string',
			optional: false, nullable: false,
			format: 'id',
		},
		streamingMode: {
			type: 'string',
			optional: false, nullable: false,
			default: 'rtmp',
			description: 'streaming mode (rtmp or browser)',
		},
		isLive: {
			type: 'boolean',
			optional: false, nullable: false,
			default: false,
			description: 'whether the stream is currently live',
		},
	},
} as const;
