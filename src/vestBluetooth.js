import { VEST_BLE, buildVestCommand } from './vestProtocol.js';

const RECONNECT_DELAYS_MS = Object.freeze([500, 1000, 2000, 4000, 5000, 5000]);

class VestBluetoothClient extends EventTarget {
  constructor() {
    super();
    this.device = null;
    this.server = null;
    this.commandCharacteristic = null;
    this.statusCharacteristic = null;
    this.writeQueue = Promise.resolve();
    this.heartbeatPending = null;
    this.pendingWrites = 0;
    this.encoder = new TextEncoder();
    this.decoder = new TextDecoder();
    this.manualDisconnect = false;
    this.reconnecting = false;
    this.reconnectLoopPromise = null;
    this.lastTxAt = 0;
    this.lastRxAt = 0;
    this.lastWriteError = '';
    this.consecutiveWriteErrors = 0;
  }

  get supported() {
    return Boolean(window.isSecureContext && navigator.bluetooth);
  }

  get connected() {
    return Boolean(this.device?.gatt?.connected && this.commandCharacteristic);
  }

  get deviceName() {
    return this.device?.name || 'Chaleco VR';
  }

  async getDiagnostics() {
    const diagnostics = {
      isSecureContext: Boolean(window.isSecureContext),
      hasBluetoothApi: Boolean(navigator.bluetooth),
      bluetoothAvailable: null,
      connected: this.connected,
      reconnecting: this.reconnecting,
      pendingWrites: this.pendingWrites,
      lastTxAt: this.lastTxAt || null,
      lastRxAt: this.lastRxAt || null,
      lastWriteError: this.lastWriteError || null,
      consecutiveWriteErrors: this.consecutiveWriteErrors,
    };

    if (diagnostics.hasBluetoothApi && typeof navigator.bluetooth.getAvailability === 'function') {
      try {
        diagnostics.bluetoothAvailable = await navigator.bluetooth.getAvailability();
      } catch {
        diagnostics.bluetoothAvailable = null;
      }
    }

    return diagnostics;
  }

  async connect() {
    if (!window.isSecureContext) {
      throw new Error('La conexión Bluetooth requiere HTTPS.');
    }
    if (!navigator.bluetooth) {
      throw new Error('Este navegador no admite Web Bluetooth.');
    }
    if (this.connected) return this.device;

    this.manualDisconnect = false;
    this.reconnecting = false;

    if (!this.device) {
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { namePrefix: VEST_BLE.deviceNamePrefix },
          { services: [VEST_BLE.serviceUuid] },
        ],
        optionalServices: [VEST_BLE.serviceUuid],
      });
      this.setDevice(device);
    }

    try {
      await this.establishGattConnection();
      return this.device;
    } catch (error) {
      this.resetGattConnection(false);
      throw error;
    }
  }

  async establishGattConnection() {
    if (!this.device) throw new Error('No hay un dispositivo Bluetooth seleccionado.');

    this.server = this.device.gatt.connected
      ? this.device.gatt
      : await this.device.gatt.connect();

    const service = await this.server.getPrimaryService(VEST_BLE.serviceUuid);
    this.commandCharacteristic = await service.getCharacteristic(VEST_BLE.commandCharacteristicUuid);

    try {
      this.statusCharacteristic = await service.getCharacteristic(VEST_BLE.statusCharacteristicUuid);
      if (this.statusCharacteristic.properties.notify) {
        await this.statusCharacteristic.startNotifications();
        this.statusCharacteristic.addEventListener('characteristicvaluechanged', this.handleStatusNotification);
      }
    } catch {
      this.statusCharacteristic = null;
    }

    this.consecutiveWriteErrors = 0;
    this.lastWriteError = '';
    this.emitConnectionChange(true, { recovered: this.reconnecting });
    this.dispatchHealth('ready');
  }

  async disconnect() {
    const hadConnection = Boolean(this.device);
    this.manualDisconnect = true;
    this.reconnecting = false;

    if (this.connected) {
      try {
        await this.send({ type: 'allOff' });
      } catch {
        void 0;
      }
    }

    await this.stopStatusNotifications();

    if (this.device?.gatt?.connected) {
      try {
        this.device.gatt.disconnect();
      } catch {
        void 0;
      }
    }

    this.cleanupConnection({ preserveDevice: false });
    if (hadConnection) this.emitConnectionChange(false, { reason: 'manual' });
    this.dispatchReconnectState('idle');
  }

  async send(command, { silent = false } = {}) {
    if (!this.connected) throw new Error('El chaleco no está conectado por Bluetooth.');

    const normalized = buildVestCommand(command);
    if (normalized.type === 'heartbeat' && this.heartbeatPending) return this.heartbeatPending;

    const payload = JSON.stringify(normalized);
    const bytes = this.encoder.encode(payload);
    this.pendingWrites += 1;
    this.dispatchHealth('queued');

    const operation = this.writeQueue.then(async () => {
      if (!this.connected) throw new Error('La conexión Bluetooth se perdió antes de enviar el comando.');

      try {
        if (typeof this.commandCharacteristic.writeValueWithResponse === 'function') {
          await this.commandCharacteristic.writeValueWithResponse(bytes);
        } else {
          await this.commandCharacteristic.writeValue(bytes);
        }
        this.lastTxAt = Date.now();
        this.lastWriteError = '';
        this.consecutiveWriteErrors = 0;
        this.dispatchHealth('tx-ok');
      } catch (error) {
        this.lastWriteError = error?.message || String(error);
        this.consecutiveWriteErrors += 1;
        this.dispatchEvent(new CustomEvent('writeerror', {
          detail: {
            error: this.lastWriteError,
            command: normalized,
            connected: Boolean(this.device?.gatt?.connected),
            pendingWrites: this.pendingWrites,
            consecutiveWriteErrors: this.consecutiveWriteErrors,
            lastTxAt: this.lastTxAt || null,
            lastRxAt: this.lastRxAt || null,
            visibilityState: document.visibilityState,
          },
        }));
        this.dispatchHealth('tx-error');
        throw error;
      }

      if (!silent) {
        this.dispatchEvent(new CustomEvent('command-sent', { detail: { command: normalized } }));
      }
      return normalized;
    });

    // La cola continúa aunque una escritura individual falle.
    this.writeQueue = operation.then(() => undefined, () => undefined);

    const trackedOperation = operation.finally(() => {
      this.pendingWrites = Math.max(0, this.pendingWrites - 1);
      this.dispatchHealth('queue-updated');
    });

    if (normalized.type === 'heartbeat') {
      this.heartbeatPending = trackedOperation.finally(() => {
        this.heartbeatPending = null;
      });
      return this.heartbeatPending;
    }

    return trackedOperation;
  }

  handleDisconnect = () => {
    if (this.manualDisconnect) return;

    const deviceName = this.deviceName;
    this.cleanupConnection({ preserveDevice: true });
    this.emitConnectionChange(false, { reason: 'unexpected', deviceName });
    this.startReconnectLoop();
  };

  async startReconnectLoop() {
    if (this.reconnecting || this.manualDisconnect || !this.device) return this.reconnectLoopPromise;

    this.reconnecting = true;
    this.dispatchReconnectState('reconnecting', { attempt: 0, maxAttempts: RECONNECT_DELAYS_MS.length });

    this.reconnectLoopPromise = (async () => {
      for (let index = 0; index < RECONNECT_DELAYS_MS.length; index += 1) {
        if (this.manualDisconnect || !this.device) return false;

        const delay = RECONNECT_DELAYS_MS[index];
        const attempt = index + 1;
        this.dispatchReconnectState('scheduled', {
          attempt,
          maxAttempts: RECONNECT_DELAYS_MS.length,
          delay,
        });
        await this.wait(delay);

        if (this.manualDisconnect || !this.device) return false;
        this.dispatchReconnectState('attempting', { attempt, maxAttempts: RECONNECT_DELAYS_MS.length });

        try {
          await this.establishGattConnection();
          this.reconnecting = false;
          this.dispatchReconnectState('connected', { attempt, maxAttempts: RECONNECT_DELAYS_MS.length });
          return true;
        } catch (error) {
          this.resetGattConnection(true);
          this.dispatchReconnectState('attempt-failed', {
            attempt,
            maxAttempts: RECONNECT_DELAYS_MS.length,
            error: error?.message || String(error),
          });
        }
      }

      this.reconnecting = false;
      this.resetGattConnection(false);
      this.dispatchReconnectState('failed', { maxAttempts: RECONNECT_DELAYS_MS.length });
      return false;
    })().finally(() => {
      this.reconnectLoopPromise = null;
    });

    return this.reconnectLoopPromise;
  }

  setDevice(device) {
    if (this.device && this.device !== device) {
      this.device.removeEventListener('gattserverdisconnected', this.handleDisconnect);
    }
    this.device = device;
    this.device.addEventListener('gattserverdisconnected', this.handleDisconnect);
  }

  async stopStatusNotifications() {
    if (!this.statusCharacteristic) return;
    try {
      this.statusCharacteristic.removeEventListener('characteristicvaluechanged', this.handleStatusNotification);
      if (this.statusCharacteristic.properties.notify) await this.statusCharacteristic.stopNotifications();
    } catch {
      void 0;
    }
  }

  resetGattConnection(preserveDevice) {
    if (this.device) {
      this.device.removeEventListener('gattserverdisconnected', this.handleDisconnect);
      if (this.device.gatt?.connected) {
        try {
          this.device.gatt.disconnect();
        } catch {
          void 0;
        }
      }
      if (preserveDevice) {
        this.device.addEventListener('gattserverdisconnected', this.handleDisconnect);
      }
    }
    this.cleanupConnection({ preserveDevice });
  }

  cleanupConnection({ preserveDevice }) {
    if (this.statusCharacteristic) {
      this.statusCharacteristic.removeEventListener('characteristicvaluechanged', this.handleStatusNotification);
    }

    if (!preserveDevice && this.device) {
      this.device.removeEventListener('gattserverdisconnected', this.handleDisconnect);
    }

    this.server = null;
    this.commandCharacteristic = null;
    this.statusCharacteristic = null;
    this.writeQueue = Promise.resolve();
    this.heartbeatPending = null;
    this.pendingWrites = 0;

    if (!preserveDevice) this.device = null;
  }

  handleStatusNotification = (event) => {
    const value = event.target.value;
    const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    const message = this.decoder.decode(bytes);
    this.lastRxAt = Date.now();
    this.dispatchHealth('rx');
    this.dispatchEvent(new CustomEvent('status', { detail: { message } }));
  };

  emitConnectionChange(connected, extra = {}) {
    this.dispatchEvent(new CustomEvent('connectionchange', {
      detail: {
        connected,
        deviceName: extra.deviceName || this.deviceName,
        ...extra,
      },
    }));
  }

  dispatchReconnectState(state, detail = {}) {
    this.dispatchEvent(new CustomEvent('reconnectstate', {
      detail: { state, deviceName: this.deviceName, ...detail },
    }));
  }

  dispatchHealth(reason) {
    this.dispatchEvent(new CustomEvent('health', {
      detail: {
        reason,
        connected: this.connected,
        reconnecting: this.reconnecting,
        pendingWrites: this.pendingWrites,
        lastTxAt: this.lastTxAt || null,
        lastRxAt: this.lastRxAt || null,
        lastWriteError: this.lastWriteError || null,
        consecutiveWriteErrors: this.consecutiveWriteErrors,
      },
    }));
  }

  wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }
}

export { VEST_BLE };
export const vestBluetooth = new VestBluetoothClient();
