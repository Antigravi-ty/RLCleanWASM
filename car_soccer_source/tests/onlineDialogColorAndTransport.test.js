import test from 'node:test';
import assert from 'node:assert';
import { CAR_COLOR_SLOTS, getCarColorSlotById } from '../src/entities/CarColorConstants.js';
import { P2PWebRTCChannel, encodeSignalToken, decodeSignalToken } from '../src/network/P2PWebRTCChannel.js';

test('Online color logic: Offer token encodes hostColorSlot and decoding correctly identifies occupied slot', () => {
  const offerPayload = {
    type: 'offer',
    sdp: 'v=0\r\no=- 12345 2 IN IP4 127.0.0.1\r\n',
    candidates: [],
    hostName: 'TestHost',
    hostColorSlot: 3,
    hostColorHex: '#42a5f5'
  };

  const token = 'RL_OFFER_' + encodeSignalToken(offerPayload);
  const decoded = decodeSignalToken(token);

  assert.strictEqual(decoded.type, 'offer');
  assert.strictEqual(decoded.hostColorSlot, 3);
  assert.strictEqual(decoded.hostColorHex, '#42a5f5');

  // Client starts with slot 3 (clash): auto-switch logic picks unoccupied slot
  let clientSlot = 3;
  if (clientSlot === decoded.hostColorSlot) {
    const available = CAR_COLOR_SLOTS.find(s => s.id !== decoded.hostColorSlot);
    clientSlot = available.id;
  }
  assert.notStrictEqual(clientSlot, decoded.hostColorSlot);
  assert.strictEqual(clientSlot, 0); // Slot 0 is Red
});

test('Online color logic: When no offer token is loaded, occupiedSlot is null (all slots selectable)', () => {
  let parsedOfferHost = null;
  let clientP2PChannel = null;

  const hostInfo = (clientP2PChannel?.isOpen && clientP2PChannel.peerColorSlot !== null)
    ? { colorSlot: clientP2PChannel.peerColorSlot }
    : parsedOfferHost;

  const occupiedSlot = hostInfo ? hostInfo.colorSlot : null;
  assert.strictEqual(occupiedSlot, null);

  // In HTML rendering, null occupiedSlot means isOccupied is false for all slots
  const allAvailable = CAR_COLOR_SLOTS.every(slot => slot.id !== occupiedSlot);
  assert.strictEqual(allAvailable, true);
});

test('P2PWebRTCChannel: BroadcastChannel message routing and frame decoding', async () => {
  const chName = 'test_p2p_channel_' + Date.now();
  const host = new P2PWebRTCChannel({ role: 'host', playerName: 'HostUser', signalingChannelName: chName });
  const client = new P2PWebRTCChannel({ role: 'client', playerName: 'ClientUser', signalingChannelName: chName });

  let receivedPacket = null;
  host.onPacketReceived = (payload) => {
    receivedPacket = payload;
  };

  const inputPacket = {
    carIndex: 1,
    clientTimestamp: 1000,
    sequence: 42,
    controls: { throttle: 1, steer: -0.5, pitch: 0, yaw: 0, roll: 0, jump: true, boost: false, handbrake: false },
    redundantInputs: []
  };

  // Test sendClientInput via fallback transport
  client.sendClientInput(inputPacket);

  // Allow next event loop macrotask for BroadcastChannel delivery
  await new Promise(r => setTimeout(r, 50));

  assert.ok(receivedPacket, 'Packet should be received by host');
  assert.strictEqual(receivedPacket.carIndex, 1);
  assert.strictEqual(receivedPacket.sequence, 42);

  host.destroy();
  client.destroy();
});
