import {
  VEST_COMPONENTS,
  VIBRATION_COMPONENTS,
  THERMAL_COMPONENTS,
  VEST_CAPABILITIES,
  VEST_THERMAL_DURATIONS,
  findVestComponents,
} from './vestHardware.js';
import {
  VEST_BLE,
  VEST_SAFETY,
  normalizeVestCommand,
} from './vestProtocol.js';
import { vestBluetooth } from './vestBluetooth.js';
import { VEST_SERIAL, vestSerial } from './vestSerial.js';

const TRANSPORTS = Object.freeze({
  serial: vestSerial,
  bluetooth: vestBluetooth,
});

const TRANSPORT_LABELS = Object.freeze({
  serial: 'USB',
  bluetooth: 'Bluetooth',
});

class VestController extends EventTarget {
  constructor() {
    super();
    this.activeTransport = 'serial';
    this.heartbeatTimer = null;
    this.heartbeatGeneration = 0;
    this.forwardTransportEvents('serial', vestSerial);
    this.forwardTransportEvents('bluetooth', vestBluetooth);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  forwardTransportEvents(type, client) {
    ['connectionchange', 'status', 'command-sent', 'writeerror', 'reconnectstate', 'health'].forEach((eventName) => {
      client.addEventListener(eventName, (event) => {
        const detail = {
          ...event.detail,
          transport: type,
          transportLabel: TRANSPORT_LABELS[type],
        };

        if (eventName === 'connectionchange') {
          if (detail.connected) {
            this.activeTransport = type;
            this.startHeartbeat({ immediate: true });
          } else if (type === this.activeTransport) {
            this.stopHeartbeat();
          }
        }

        if (type === this.activeTransport || eventName === 'connectionchange') {
          this.dispatchEvent(new CustomEvent(eventName, { detail }));
        }
      });
    });
  }

  get client() {
    return TRANSPORTS[this.activeTransport];
  }

  get connected() {
    return Boolean(this.client?.connected);
  }

  get reconnecting() {
    return Boolean(this.activeTransport === 'bluetooth' && vestBluetooth.reconnecting);
  }

  get deviceName() {
    return this.client?.deviceName || 'Chaleco VR';
  }

  get connectionType() {
    return this.activeTransport;
  }

  get connectionLabel() {
    return TRANSPORT_LABELS[this.activeTransport];
  }

  setTransport(type) {
    if (!TRANSPORTS[type]) throw new Error(`Transporte no reconocido: ${type}`);
    if ((this.connected || this.reconnecting) && type !== this.activeTransport) {
      throw new Error('Desconecta el chaleco antes de cambiar el método de conexión.');
    }
    this.activeTransport = type;
    return this.client;
  }

  isSupported(type) {
    return Boolean(TRANSPORTS[type]?.supported);
  }

  async connect(type = this.activeTransport) {
    this.setTransport(type);
    return this.client.connect();
  }

  async disconnect() {
    this.stopHeartbeat();
    return this.client?.disconnect();
  }

  async send(command) {
    return this.client.send(command);
  }

  async emergencyStop() {
    if (!this.connected) return false;
    try {
      await this.send({ type: 'allOff' });
      return true;
    } catch {
      return false;
    }
  }

  startHeartbeat({ immediate = false } = {}) {
    this.stopHeartbeat();
    const generation = this.heartbeatGeneration;

    const runHeartbeat = async () => {
      if (generation !== this.heartbeatGeneration || !this.connected) return;

      try {
        await this.client.send({ type: 'heartbeat' }, { silent: true });
      } catch (error) {
        this.dispatchEvent(new CustomEvent('heartbeaterror', {
          detail: {
            error: error?.message || String(error),
            transport: this.activeTransport,
            transportLabel: this.connectionLabel,
            visibilityState: document.visibilityState,
          },
        }));
      }

      if (generation !== this.heartbeatGeneration || !this.connected) return;
      this.heartbeatTimer = window.setTimeout(runHeartbeat, VEST_SAFETY.heartbeatInterval);
    };

    this.heartbeatTimer = window.setTimeout(
      runHeartbeat,
      immediate ? 0 : VEST_SAFETY.heartbeatInterval,
    );
  }

  stopHeartbeat() {
    this.heartbeatGeneration += 1;
    if (!this.heartbeatTimer) return;
    window.clearTimeout(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  handleVisibilityChange = () => {
    const visibilityState = document.visibilityState;
    this.dispatchEvent(new CustomEvent('visibilitystate', {
      detail: {
        visibilityState,
        connected: this.connected,
        transport: this.activeTransport,
        transportLabel: this.connectionLabel,
      },
    }));

    // Al recuperar la página se renueva inmediatamente la actividad del watchdog.
    if (visibilityState === 'visible' && this.connected) {
      this.startHeartbeat({ immediate: true });
    }
  };

  async getDiagnostics(type = this.activeTransport) {
    const client = TRANSPORTS[type];
    if (!client?.getDiagnostics) return null;
    return client.getDiagnostics();
  }
}

export {
  VEST_COMPONENTS,
  VIBRATION_COMPONENTS,
  THERMAL_COMPONENTS,
  VEST_CAPABILITIES,
  VEST_THERMAL_DURATIONS,
  VEST_BLE,
  VEST_SERIAL,
  VEST_SAFETY,
  findVestComponents,
  normalizeVestCommand,
};
export const vestController = new VestController();
