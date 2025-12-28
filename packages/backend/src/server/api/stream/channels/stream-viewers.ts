import Channel from '../channel.js';
import { Streams } from '@/models/index.js';
import { StreamMessages } from '../types.js';

export default class extends Channel {
	public readonly chName = 'streamViewers';
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

		// Subscribe to stream viewer updates
		this.subscriber.on(`streamViewers:${this.streamId}`, this.onEvent);
	}

	private onEvent(data: StreamMessages['streamViewers']['payload']) {
		// Forward viewer count updates to the client
		console.log(`Stream viewers channel received event for stream ${this.streamId}:`, data);
		this.send(data.type, data.body);
	}

	public dispose() {
		this.subscriber.off(`streamViewers:${this.streamId}`, this.onEvent);
	}
}
