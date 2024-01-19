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


const replicatedStorage_1 = client_1.createReplicatedStorage<string, Room>()
	.withConfig({
		storageId: 'room-storage',
	})
	.withKeyCodec(strCodec)
	.withValueCodec(roomCodec)
	.build();

const replicatedStorage_2 = client_2.createReplicatedStorage<string, Room>()
	.withConfig({
		storageId: 'room-storage',
	})
	.withKeyCodec(strCodec)
	.withValueCodec(roomCodec)
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

async function insertExample() {
	console.log('inserting room-1');
	const insertPromise1 = replicatedStorage_1.insert('room-1', { roomId: 'room-1' });
	const insertPromise2 = replicatedStorage_2.insert('room-1', { roomId: 'room-1' });
	
	const [insertedByClient_1, insertedByClient_2] = await Promise.all([insertPromise1, insertPromise2]);

	console.log(`insertedByClient1: ${insertedByClient_1 === undefined}, insertedByClient2: ${insertedByClient_2 === undefined}`);
	console.log(`room-1 by client 1:`, await replicatedStorage_1.get('room-1'));
	console.log(`room-1 by client 2:`, await replicatedStorage_2.get('room-1'));

}

async function updateExmple() {
	console.log('updating room-1');

	console.log('set data for room-1 by client 1');
	const prevData_1 = await replicatedStorage_1.set('room-1', { roomId: 'room-1', data: 'data-by-client-1' });
	console.log('actual data for room-1 by client 2', (await replicatedStorage_2.get('room-1'))?.data, 'prev data', prevData_1?.data);

	console.log('set data for room-1 by client 2');
	const prevData_2 = await replicatedStorage_2.set('room-1', { roomId: 'room-1', data: 'data-by-client-2' });
	console.log('actual data for room-1 by client 1', (await replicatedStorage_1.get('room-1'))?.data, 'prev data', prevData_2?.data);
}


async function deleteExample() {
	console.log('delete room-1');

	const deleteRoomPromise_1 = replicatedStorage_1.delete('room-1');
	const deleteRoomPromise_2 = replicatedStorage_2.delete('room-1');

	const [removedRoomByClient_1, removedRoomByClient_2] = await Promise.all([deleteRoomPromise_1, deleteRoomPromise_2]);

	console.log(`removedRoomByClient_1`, removedRoomByClient_1, `removedRoomByClient_2`, removedRoomByClient_2);

}

start()
	.then(insertExample)
	.then(updateExmple)
	.then(deleteExample)
	.then(stop)
	;