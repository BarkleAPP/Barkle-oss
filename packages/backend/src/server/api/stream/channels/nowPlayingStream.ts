import Channel from '../channel.js';

export default class extends Channel {
	public readonly chName = 'nowPlayingStream';
	public static shouldShare = true;
	public static requireCredential = false;

	public async init(params: any) {
        console.log('NowPlayingStream channel initialized with params:', params);
        if (!params.userId) {
            console.warn('NowPlayingStream channel initialized without userId');
            return;
        }

        console.log(`Subscribing to nowPlayingStream:${params.userId}`);
		// Subscribe nowPlaying stream channel
		this.subscriber.on(`nowPlayingStream:${params.userId}`, data => {
            console.log(`Received data for nowPlayingStream:${params.userId}:`, data);
			this.send(data.type, data.body);
            console.log(`Sent to client: type=${data.type}, body=${data.body}`);
		});
	}
}
