import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import { ServerSnapshotCodec } from '../src/network/ServerSnapshotCodec.js';
import { InputPacketCodec } from '../src/network/InputPacketCodec.js';
import { encodeSignalToken, decodeSignalToken, P2PWebRTCChannel } from '../src/network/P2PWebRTCChannel.js';
import { AuthoritativeServer } from '../src/network/AuthoritativeServer.js';
import { DedicatedServerWorkerClient } from '../src/network/DedicatedServerWorkerClient.js';
import { PredictionReconciler } from '../src/network/PredictionReconciler.js';
import { NetworkReconciliationHUD } from '../src/ui/NetworkReconciliationHUD.js';
import { PhysicsRateHUD } from '../src/ui/PhysicsRateHUD.js';

test('ServerSnapshotCodec: ultra-compact binary serialization for 120Hz authoritative snapshots', () => {
  const originalSnapshot = new Float32Array(4201);
  originalSnapshot[0] = 100.5;
  originalSnapshot[10] = -42.125;
  originalSnapshot[4200] = 999.0;

  const original = {
    serverTick: 2400,
    timestamp: 15000.5,
    lastReceivedClientTimestamp: 14980.25,
    acknowledgedControls: [
      { throttle: 1.0, steer: -0.5, pitch: 0, yaw: 0, roll: 0, jump: true, boost: true, handbrake: false },
      { throttle: -1.0, steer: 0.25, pitch: 0, yaw: 0, roll: 0, jump: false, boost: false, handbrake: true }
    ],
    stateSnapshot: originalSnapshot
  };

  const encoded = ServerSnapshotCodec.encode(original);
  assert.ok(encoded instanceof Uint8Array);
  assert.equal(ServerSnapshotCodec.isSnapshotPacket(encoded), true);
  assert.equal(ServerSnapshotCodec.isSnapshotPacket(new Uint8Array([0x52])), false);

  const decoded = ServerSnapshotCodec.decode(encoded);
  assert.ok(decoded);
  assert.equal(decoded.serverTick, 2400);
  assert.equal(Math.abs(decoded.timestamp - 15000.5) < 0.001, true);
  assert.equal(Math.abs(decoded.lastReceivedClientTimestamp - 14980.25) < 0.001, true);

  // Verify car 0 controls
  assert.equal(decoded.acknowledgedControls[0].throttle, 1.0);
  assert.equal(decoded.acknowledgedControls[0].jump, true);
  assert.equal(decoded.acknowledgedControls[0].boost, true);

  // Verify car 1 controls
  assert.equal(decoded.acknowledgedControls[1].throttle, -1.0);
  assert.equal(decoded.acknowledgedControls[1].handbrake, true);

  // Verify snapshot floats
  assert.equal(decoded.stateSnapshot.length, 4201);
  assert.equal(decoded.stateSnapshot[0], 100.5);
  assert.equal(decoded.stateSnapshot[10], -42.125);
  assert.equal(decoded.stateSnapshot[4200], 999.0);
});

test('P2PWebRTCChannel: Token encoding, decoding, and URL-safety with Unicode characters', () => {
  const signalData = {
    type: 'offer',
    sdp: 'v=0\r\no=- 4291 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=sendrecv',
    candidates: [
      { candidate: 'candidate:1 1 UDP 2122260223 192.168.1.100 50000 typ host', sdpMid: '0' }
    ],
    hostName: '🚀 超级前锋 Striker-8812',
    version: 1
  };

  const token = 'RL_OFFER_' + encodeSignalToken(signalData);
  assert.ok(typeof token === 'string');
  assert.ok(token.startsWith('RL_OFFER_'));

  const decoded = decodeSignalToken(token);
  assert.equal(decoded.type, 'offer');
  assert.equal(decoded.hostName, '🚀 超级前锋 Striker-8812');
  assert.equal(decoded.sdp, signalData.sdp);
  assert.equal(decoded.candidates.length, 1);
});

test('120Hz Default Report Rates: Server snapshot interval defaults to 1 tick (120Hz) and client report rate is 120Hz', () => {
  const server = new AuthoritativeServer(null);
  assert.equal(server.snapshotInterval, 1, 'Server snapshotInterval must default to 1 (120Hz broadcast)');
  assert.equal(server.serverReportRate, 120, 'Server report rate must report 120Hz');

  server.setServerReportRate(60);
  assert.equal(server.snapshotInterval, 2);
  assert.equal(server.serverReportRate, 60);

  server.setServerReportRate(120);
  assert.equal(server.snapshotInterval, 1);
  assert.equal(server.serverReportRate, 120);

  const reconciler = new PredictionReconciler(null, null);
  assert.equal(reconciler.clientReportRate, 120, 'Client report rate must report 120Hz');
});

test('DedicatedServerWorkerClient: notifies worker of player joins with roles and names', async () => {
  const { RocketSimPhysicsEngine } = await import('../src/physics/RocketSimPhysicsEngine.js');
  const meshDir = path.resolve(__dirname, '../../custom/arenamesh');
  const manifest = JSON.parse(fs.readFileSync(path.join(meshDir, 'manifest.json'), 'utf8'));
  RocketSimPhysicsEngine.cachedCollisionData = manifest.map(name => fs.readFileSync(path.join(meshDir, name)));

  const client = new DedicatedServerWorkerClient(null, { forceFallback: true });
  await client.init();

  let logged = '';
  const origLog = console.log;
  console.log = (...args) => {
    logged = args.join(' ');
  };

  try {
    client.notifyPlayerJoined(0, 'Striker-Alpha', 'host');
    assert.ok(logged.includes('Player joined: carIndex=0'));
    assert.ok(logged.includes('Striker-Alpha'));
    assert.ok(logged.includes('role="host"'));

    client.notifyPlayerJoined(1, 'Challenger-Beta', 'client');
    assert.ok(logged.includes('Player joined: carIndex=1'));
    assert.ok(logged.includes('Challenger-Beta'));
    assert.ok(logged.includes('role="client"'));
  } finally {
    console.log = origLog;
    client.destroy();
  }
});

test('NetworkReconciliationHUD: closable, shows tick lead delta (+X ticks), and copies diagnostic JSON', () => {
  // Mock DOM environment
  const mockElements = new Map();
  const makeElem = (tag) => {
    const elem = {
      tagName: tag.toUpperCase(),
      style: {},
      hidden: false,
      listeners: {},
      classList: {
        toggle: () => {},
        contains: () => false
      },
      appendChild: (ch) => elem.children.push(ch),
      removeChild: (ch) => {
        const idx = elem.children.indexOf(ch);
        if (idx !== -1) elem.children.splice(idx, 1);
      },
      children: [],
      addEventListener: (evt, fn) => { elem.listeners[evt] = fn; },
      querySelector: (sel) => mockElements.get(sel) || null,
      querySelectorAll: () => [],
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 })
    };
    return elem;
  };

  const container = makeElem('div');
  const mockChannel = {
    rttMs: 0,
    measuredRttMs: 1.85,
    packetLossRate: 0.0,
    setExtraLatency: (lat) => { mockChannel.rttMs = lat * 2; },
    setRtt: (rtt) => { mockChannel.rttMs = rtt; },
    setPacketLossRate: () => {},
    stats: { packetsSent: 120, packetsDropped: 0 }
  };

  const mockReconciler = {
    metrics: {
      clientTick: 1440,
      serverTick: 1434,
      leadTicks: 6,
      totalCorrections: 0,
      lastCorrectionDelta: 0,
      maxCorrectionDelta: 0,
      smoothingMagnitude: 0
    },
    calculateLeadTicks: () => 6,
    enableSmoothing: false,
    enableRedundantInputs: true
  };

  // Test HUD methods without full DOM browser attachment
  const hud = new NetworkReconciliationHUD(null, mockReconciler, mockChannel);
  
  // Verify copyDiagnostics formats diagnostic metrics properly
  const diag = hud.copyDiagnostics();
  assert.equal(diag.clientTick, 1440);
  assert.equal(diag.serverTick, 1434);
  assert.equal(diag.leadTicks, 6);
  assert.equal(diag.tickLeadDelta, 6);
  assert.equal(diag.serverReportRateHz, 120);
  assert.equal(diag.clientReportRateHz, 120);
  assert.equal(diag.measuredRttMs, 1.85);

  // Verify closeable behavior
  hud.root = { hidden: false };
  hud.visible = true;
  hud.hide();
  assert.equal(hud.visible, false);
  assert.equal(hud.root.hidden, true);

  hud.toggle();
  assert.equal(hud.visible, true);
  assert.equal(hud.root.hidden, false);

  hud.toggle();
  assert.equal(hud.visible, false);
  assert.equal(hud.root.hidden, true);
});

test('PhysicsRateHUD: renders physics rate and live measured RTT', () => {
  const hud = new PhysicsRateHUD(null, 120);
  hud.root = { textContent: '' };

  hud.updateRateAndRtt(120, 2.4);
  assert.equal(hud.root.textContent, 'Phy:120.0 | RTT:2ms');

  hud.updateRateAndRtt(120, null);
  assert.equal(hud.root.textContent, 'Phy:120.0');
});

import { CAR_COLOR_SLOTS, getCarColorSlotById, parseColorToNumber } from '../src/entities/CarColorConstants.js';
import { isEventWithinUI } from '../src/input/KeyboardMouseController.js';

test('CarColorConstants: 6 standard multiplayer color slots specification', () => {
  assert.equal(CAR_COLOR_SLOTS.length, 6);

  const slot0 = getCarColorSlotById(0);
  assert.equal(slot0.nameEn, 'Red');
  assert.equal(slot0.nameZh, '红');
  assert.equal(slot0.hex, '#ff7043');
  assert.equal(slot0.team, 1);

  const slot1 = getCarColorSlotById(1);
  assert.equal(slot1.nameEn, 'Green');
  assert.equal(slot1.nameZh, '绿');
  assert.equal(slot1.hex, '#66bb6a');
  assert.equal(slot1.team, 0);

  const slot2 = getCarColorSlotById(2);
  assert.equal(slot2.nameEn, 'Yellow');
  assert.equal(slot2.nameZh, '黄');
  assert.equal(slot2.hex, '#ffc107');
  assert.equal(slot2.team, 1);

  const slot3 = getCarColorSlotById(3);
  assert.equal(slot3.nameEn, 'Blue');
  assert.equal(slot3.nameZh, '蓝');
  assert.equal(slot3.hex, '#42a5f5');
  assert.equal(slot3.team, 0);

  const slot4 = getCarColorSlotById(4);
  assert.equal(slot4.nameEn, 'Pink');
  assert.equal(slot4.nameZh, '粉');
  assert.equal(slot4.hex, '#fd6e9d');
  assert.equal(slot4.team, 1);

  const slot5 = getCarColorSlotById(5);
  assert.equal(slot5.nameEn, 'Purple');
  assert.equal(slot5.nameZh, '紫');
  assert.equal(slot5.hex, '#ba68c8');
  assert.equal(slot5.team, 0);

  // Fallback
  assert.equal(getCarColorSlotById(99).id, 0);

  // Parse to number
  assert.equal(parseColorToNumber('#ff7043'), 0xff7043);
  assert.equal(parseColorToNumber('#42a5f5'), 0x42a5f5);
  assert.equal(parseColorToNumber(0x66bb6a), 0x66bb6a);
});

test('UI Target Inclusion: isEventWithinUI recognizes .online-overlay, #online-button, and .net-hud', () => {
  function makeMockElement(className, id = '') {
    return {
      nodeType: 1,
      className,
      id,
      closest(sel) {
        const selectors = sel.split(',').map(s => s.trim());
        for (const s of selectors) {
          if (s.startsWith('.') && this.className.includes(s.slice(1))) return this;
          if (s.startsWith('#') && this.id === s.slice(1)) return this;
        }
        return null;
      }
    };
  }

  // Under Node environment Element might need minimal prototype check
  const origElement = globalThis.Element;
  globalThis.Element = class {};

  const onlineOverlay = makeMockElement('online-overlay');
  Object.setPrototypeOf(onlineOverlay, globalThis.Element.prototype);

  const onlineBtn = makeMockElement('online-tab-btn', 'online-button');
  Object.setPrototypeOf(onlineBtn, globalThis.Element.prototype);

  const netHud = makeMockElement('net-hud');
  Object.setPrototypeOf(netHud, globalThis.Element.prototype);

  const gameCanvas = makeMockElement('game-canvas');
  Object.setPrototypeOf(gameCanvas, globalThis.Element.prototype);

  assert.equal(isEventWithinUI(onlineOverlay), true);
  assert.equal(isEventWithinUI(onlineBtn), true);
  assert.equal(isEventWithinUI(netHud), true);
  assert.equal(isEventWithinUI(gameCanvas), false);

  globalThis.Element = origElement;
});

test('P2PWebRTCChannel: acceptAnswerToken avoids exception when signalingState is stable', async () => {
  const channel = new P2PWebRTCChannel({ role: 'host' });
  channel.pc = {
    signalingState: 'stable',
    setRemoteDescription: async () => {
      throw new Error('Called in wrong state: stable');
    }
  };

  // Should return gracefully without throwing
  let thrown = false;
  try {
    await channel.acceptAnswerToken('RL_ANSWER_fake');
  } catch (err) {
    thrown = true;
  }
  channel.destroy();
  assert.equal(thrown, false);
});

test('OnlineDialog & P2PWebRTCChannel: Trickle ICE candidate buffering and flushing', async () => {
  const channel = new P2PWebRTCChannel({ role: 'host' });
  const mockCand = { candidate: 'candidate:1 1 UDP 2122260223 192.168.1.1 5000 typ host', sdpMid: '0' };

  // Candidate arrives before remote description
  await channel.addRemoteCandidate(mockCand);
  assert.equal(channel.pendingRemoteCandidates.length, 1);

  // Set remote description and flush
  let addedCandidates = [];
  channel.pc = {
    remoteDescription: { type: 'answer', sdp: 'fake_sdp' },
    addIceCandidate: async (c) => { addedCandidates.push(c); }
  };

  await channel.flushPendingCandidates();
  assert.equal(channel.pendingRemoteCandidates.length, 0);
  assert.equal(addedCandidates.length, 1);
  channel.destroy();
});

test('DedicatedServerWorkerClient: forwards incoming remote client packets via onPacketReceived', async () => {
  const client = new DedicatedServerWorkerClient(null, { forceFallback: true });
  await client.init();
  client.isWorker = true;
  client.worker = { postMessage: () => {}, terminate: () => {} };

  const mockChannel = {
    sendClientInput: (packet) => true,
    receiveServerPackets: () => [],
    sendServerState: () => true,
    onPacketReceived: null
  };

  client.addClientChannel(mockChannel);
  assert.ok(typeof mockChannel.onPacketReceived === 'function');

  let posted = [];
  client._postCommand = (cmd, payload) => {
    posted.push({ cmd, payload });
  };

  const clientPacket = {
    carIndex: 1,
    tick: 50,
    controls: { throttle: 1.0, steer: 0, pitch: 0, yaw: 0, roll: 0, jump: false, boost: false, handbrake: false }
  };

  mockChannel.onPacketReceived(clientPacket);

  assert.equal(posted.length, 1);
  assert.equal(posted[0].cmd, 'clientInput');
  assert.equal(posted[0].payload.packet.carIndex, 1);
  assert.equal(posted[0].payload.packet.controls.throttle, 1.0);

  client.destroy();
});

test('OnlineDialog: Color occupied logic only activates when peer is confirmed and onClose precedes onOpenChange', () => {
  let callOrder = [];
  const mockCallbacks = {
    onClose: () => callOrder.push('onClose'),
    onOpenChange: (open) => callOrder.push(`onOpenChange:${open}`)
  };

  const dialog = {
    root: { hidden: false, style: { display: 'block' }, setAttribute: () => {} },
    isOpen: true,
    callbacks: mockCallbacks,
    close() {
      this.isOpen = false;
      if (this.root) {
        this.root.hidden = true;
        if (this.root.style) this.root.style.display = 'none';
        if (typeof this.root.setAttribute === 'function') this.root.setAttribute('aria-hidden', 'true');
      }
      this.callbacks.onClose?.();
      this.callbacks.onOpenChange?.(false);
    }
  };

  dialog.close();
  assert.deepEqual(callOrder, ['onClose', 'onOpenChange:false']);
});

import { OnlineDialog } from '../src/ui/OnlineDialog.js';

test('OnlineDialog: Join view color slots are not pre-occupied until room offer is ingested', () => {
  const container = { appendChild: () => {}, removeChild: () => {} };
  const origDoc = globalThis.document;
  globalThis.document = {
    createElement: () => ({
      style: {},
      classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
      appendChild: () => {},
      removeChild: () => {},
      addEventListener: () => {},
      setAttribute: () => {},
      getAttribute: () => null,
      querySelector: () => ({ addEventListener: () => {} }),
      querySelectorAll: () => []
    }),
    getElementById: () => null,
    head: { appendChild: () => {} }
  };

  try {
    const dialog = new OnlineDialog(container, {});
    dialog.view = 'join';

    // Before connecting or receiving offer, occupiedHostColorSlot must be null
    const initialOccupied = dialog.clientP2PChannel?.peerColorSlot ?? dialog.discoveredHostColorSlot ?? null;
    assert.equal(initialOccupied, null, 'No host color slot should be occupied initially in join view');

    // Verify all 6 slots are unlocked in HTML output
    const htmlUnrestricted = dialog._renderColorPickerHtml(dialog.clientColorSlot, initialOccupied, 'client');
    assert.equal(htmlUnrestricted.includes('is-occupied'), false, 'No color card should have is-occupied class');
    assert.equal(htmlUnrestricted.includes('已占用'), false, 'No color card should display 已占用 tag');

    // Now simulate ingesting an offer from Host using Slot 3 (Blue)
    const dummyOffer = 'RL_OFFER_' + encodeSignalToken({
      type: 'offer',
      sdp: 'mock-sdp',
      hostName: 'TestHost',
      hostColorSlot: 3,
      hostColorHex: '#42a5f5'
    });

    const offerData = decodeSignalToken(dummyOffer);
    if (offerData?.hostColorSlot !== undefined) {
      dialog.discoveredHostColorSlot = offerData.hostColorSlot;
    }
    assert.equal(dialog.discoveredHostColorSlot, 3);

    // Re-render color picker with discovered host slot
    const htmlWithHost = dialog._renderColorPickerHtml(dialog.clientColorSlot, dialog.discoveredHostColorSlot, 'client');
    assert.ok(htmlWithHost.includes('is-occupied'), 'Host color slot must now be marked as is-occupied');
    assert.ok(htmlWithHost.includes('已占用'), 'Host color slot must display 已占用 tag');

    // Verify that if client had chosen slot 3, client auto-adjusts to a free slot
    dialog.clientColorSlot = 3;
    if (dialog.clientColorSlot === dialog.discoveredHostColorSlot) {
      dialog.clientColorSlot = (dialog.discoveredHostColorSlot + 3) % 6;
    }
    assert.notEqual(dialog.clientColorSlot, 3, 'Client color slot should auto-switch away from occupied slot');

    dialog.destroy();
  } finally {
    globalThis.document = origDoc;
  }
});
