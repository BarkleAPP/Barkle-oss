import Channel from '../channel.js';
import { Streams } from '@/models/index.js';
import { webSocketViewerTracker } from '@/services/websocket-viewer-tracker.js';

export default class extends Channel {
	public readonly chName = 'streamViewing';
	public static shouldShare = false;
	public static requireCredential = true; // Require authentication to track viewing
	private streamId: string | null = null;

	constructor(id: string, connection: Channel['connection']) {
		super(id, connection);
	}

	public async init(params: any) {
		this.streamId = params.streamId as string;

		if (!this.streamId) {
			console.warn('StreamViewing channel initialized without streamId');
			return;
		}

		// Verify stream exists
		const stream = await Streams.findOneBy({ id: this.streamId });
		if (!stream) {
			console.warn(`Stream ${this.streamId} not found`);
			return;
		}

		// Track this user as viewing the stream
		if (this.user) {
			console.log(`User ${this.user.id} started viewing stream ${this.streamId}`);
			webSocketViewerTracker.addViewer(this.streamId, this.user.id);
		}
	}

	public dispose() {
		// Remove user from viewer tracking when they disconnect or stop viewing
		if (this.streamId && this.user) {
			console.log(`User ${this.user.id} stopped viewing stream ${this.streamId}`);
			webSocketViewerTracker.removeViewer(this.streamId, this.user.id);
		}
	}
}
