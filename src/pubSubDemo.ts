import { HamokGrid, createCodec } from '@hamok-dev/hamok-js-core';

const client_1 = HamokGrid.builder().withConfig({ id: 'client_1' }).build();
const client_2 = HamokGrid.builder().withConfig({ id: 'client_2' }).build();

client_1.transport.sender = msg => client_2.transport.receiver(msg);
client_2.transport.sender = msg => client_1.transport.receiver(msg);

client_1.addRemoteEndpointId(client_2.localEndpointId);
client_2.addRemoteEndpointId(client_1.localEndpointId);


type Room = {
	roomId: string,
	data?: string,
};

const roomCodec = createCodec<Room, Uint8Array>(
	input => Buffer.from(JSON.stringify(input), "utf-8"),
	input => JSON.parse(Buffer.from(input).toString("utf-8"))
);
const strCodec = createCodec<string, Uint8Array>(
	input => Buffer.from(input, "utf-8"),
	input => Buffer.from(input).toString("utf-8")
);


const emitter_1 = client_1.createPubSub()
	.withConfig({
		topic: 'general-channel',
	})
	.build();

	const emitter_2 = client_2.createPubSub()
	.withConfig({
		topic: 'general-channel',
	})
	.build();


async function start() {
	console.log('starting clients');
	client_2.start();
	client_1.start();

	await Promise.all([
		new Promise<void>(resolve => client_1.onLeaderChanged((event) => {
			console.log(`client_1 elected leaer is`, event.actualLeaderId);
			resolve();
		})),
		new Promise<void>(resolve => client_2.onLeaderChanged((event) => {
			console.log(`client_2 elected leaer is`, event.actualLeaderId);
			resolve();
		}))
	])
}

async function stop() {
	console.log('stopping clients');
	client_1.stop();
	client_2.stop();
}

async function emitExample() {
	console.log('emitting events');

	await emitter_1.subscribe('event_1', (data, sourceEndpointId) => {
		const msg = Buffer.from(data).toString('utf-8');

		console.log(`client_1 received event_1 from ${sourceEndpointId}: ${msg}`);
	});

	await emitter_2.subscribe('event_2', (data, sourceEndpointId) => {
		const msg = Buffer.from(data).toString('utf-8');

		console.log(`client_2 received event_1 from ${sourceEndpointId}: ${msg}`);
	});
	

	await emitter_1.publish('event_1', Buffer.from('hello from client_1'));
	await emitter_2.publish('event_2', Buffer.from('hello from client_2'));
}

start()
	.then(emitExample)
	.then(stop)
	;