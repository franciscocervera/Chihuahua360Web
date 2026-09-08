import assert from 'node:assert/strict';
import test from 'node:test';

const nativeSetTimeout = globalThis.setTimeout;
globalThis.window = {
  isSecureContext: true,
  setTimeout: (callback, delay) => nativeSetTimeout(callback, Math.min(delay, 2)),
  clearTimeout: globalThis.clearTimeout,
};
globalThis.document = { visibilityState: 'visible' };

let writeCount = 0;
let lastWriteLength = 0;
const deviceListeners = new Map();

const commandCharacteristic = {
  properties: { notify: false },
  async writeValueWithResponse(value) {
    writeCount += 1;
    lastWriteLength = value.byteLength;
    await new Promise((resolve) => nativeSetTimeout(resolve, 2));
  },
};

const service = {
  async getCharacteristic(uuid) {
    if (uuid.endsWith('a02')) return commandCharacteristic;
    throw new Error('Característica de estado no disponible en la simulación.');
  },
};

const gatt = {
  connected: false,
  async connect() {
    this.connected = true;
    return this;
  },
  disconnect() {
    if (!this.connected) return;
    this.connected = false;
    deviceListeners.get('gattserverdisconnected')?.();
  },
  async getPrimaryService() {
    return service;
  },
};

const device = {
  name: 'ChalecoVR Test',
  gatt,
  addEventListener(name, handler) {
    deviceListeners.set(name, handler);
  },
  removeEventListener(name, handler) {
    if (deviceListeners.get(name) === handler) deviceListeners.delete(name);
  },
};

Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: {
    bluetooth: {
      async requestDevice() {
        return device;
      },
      async getAvailability() {
        return true;
      },
    },
  },
});

const { vestBluetooth } = await import('../src/vestBluetooth.js');

test('Bluetooth serializa escrituras y evita heartbeats duplicados', async () => {
  await vestBluetooth.connect();

  const [first, second] = await Promise.all([
    vestBluetooth.send({ type: 'heartbeat' }, { silent: true }),
    vestBluetooth.send({ type: 'heartbeat' }, { silent: true }),
  ]);

  assert.equal(first.type, 'heartbeat');
  assert.equal(second.type, 'heartbeat');
  assert.equal(writeCount, 1);
  assert.equal(lastWriteLength, 20);

  await vestBluetooth.send({ type: 'ping' }, { silent: true });
  assert.equal(writeCount, 2);
});

test('Bluetooth recupera una desconexión GATT inesperada', async () => {
  const reconnected = new Promise((resolve, reject) => {
    const timeout = nativeSetTimeout(() => reject(new Error('No se completó la reconexión.')), 1000);
    const handler = (event) => {
      if (event.detail.state !== 'connected') return;
      clearTimeout(timeout);
      vestBluetooth.removeEventListener('reconnectstate', handler);
      resolve(event.detail);
    };
    vestBluetooth.addEventListener('reconnectstate', handler);
  });

  gatt.disconnect();
  const detail = await reconnected;

  assert.equal(detail.attempt, 1);
  assert.equal(vestBluetooth.connected, true);

  await vestBluetooth.disconnect();
  assert.equal(vestBluetooth.connected, false);
});
