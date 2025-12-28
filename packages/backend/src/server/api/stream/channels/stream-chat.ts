import Channel from '../channel.js';
import { Users, Streams } from '@/models/index.js';
import { StreamMessages } from '../types.js';

export default class extends Channel {
	public readonly chName = 'streamChat';
	public static shouldShare = false;
	public static requireCredential = false;
	private streamId: string;

	constructor(id: string, connection: Channel['connection']) {
		super(id, connection);
		this.onEvent = this.onEvent.bind(this);
	}

	public async init(params: any) {
		this.streamId = params.streamId as string;

		// Verify stream exists
		const stream = await Streams.findOneBy({ id: this.streamId });
		if (!stream) {
			return;
		}

		// Subscribe to live chat stream
		this.subscriber.on(`liveChatStream:${this.streamId}`, this.onEvent);
	}

	private onEvent(data: StreamMessages['liveChat']['payload']) {
		// Forward all live chat events to the client
		this.send(data.type, data.body);
	}

	public dispose() {
		this.subscriber.off(`liveChatStream:${this.streamId}`, this.onEvent);
	}
}
