import { buildVestCommand } from './vestProtocol.js';

export const VEST_SERIAL = Object.freeze({
  baudRate: 115200,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
  flowControl: 'none',
});

const USB_VENDOR_NAMES = new Map([
  [0x0403, 'FTDI USB Serial'],
  [0x10c4, 'CP210x USB Serial'],
  [0x1a86, 'CH340 USB Serial'],
  [0x303a, 'Espressif USB Serial'],
]);

class VestSerialClient extends EventTarget {
  constructor() {
    super();
    this.port = null;
    this.reader = null;
    this.writer = null;
    this.readLoopPromise = null;
    this.readBuffer = '';
    this.disconnecting = false;
    this.writeQueue = Promise.resolve();
    this.encoder = new TextEncoder();
    this.decoder = new TextDecoder();
    navigator.serial?.addEventListener('disconnect', this.handleNavigatorDisconnect);
  }

  get supported() {
    return Boolean(window.isSecureContext && navigator.serial);
  }

  get connected() {
    return Boolean(this.port && this.writer);
  }

  get deviceName() {
    if (!this.port) return 'Puerto serial USB';
    const info = this.port.getInfo?.() || {};
    const vendorName = USB_VENDOR_NAMES.get(info.usbVendorId);
    const vendorId = this.formatUsbId(info.usbVendorId);
    const productId = this.formatUsbId(info.usbProductId);
    if (vendorName && vendorId && productId) return `${vendorName} (${vendorId}:${productId})`;
    if (vendorName) return vendorName;
    if (vendorId && productId) return `Puerto serial USB (${vendorId}:${productId})`;
    return 'Puerto serial USB';
  }

  async getDiagnostics() {
    return {
      isSecureContext: Boolean(window.isSecureContext),
      hasSerialApi: Boolean(navigator.serial),
    };
  }

  async connect() {
    if (!window.isSecureContext) throw new Error('La conexión USB requiere HTTPS.');
    if (!navigator.serial) throw new Error('Este navegador no admite Web Serial.');
    if (this.connected) return this.port;

    const port = await navigator.serial.requestPort();
    await port.open(VEST_SERIAL);

    try {
      this.port = port;
      this.writer = port.writable.getWriter();
      this.disconnecting = false;
      this.readBuffer = '';
      this.startReadLoop();
      this.emitConnectionChange(true);
      await this.wait(1200);
      if (!this.connected) throw new Error('El puerto USB se desconectó durante la conexión.');
      this.send({ type: 'ping' }, { silent: true }).catch(() => undefined);
      return port;
    } catch (error) {
      this.releaseWriter();
      try {
        await port.close();
      } catch {
        void 0;
      }
      this.resetConnection();
      throw error;
    }
  }

  async disconnect() {
    if (!this.port) return;

    if (this.connected) {
      try {
        await this.send({ type: 'allOff' });
      } catch {
        void 0;
      }
    }

    this.disconnecting = true;

    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch {
        void 0;
      }
    }

    if (this.readLoopPromise) {
      try {
        await this.readLoopPromise;
      } catch {
        void 0;
      }
    }

    this.releaseWriter();

    try {
      await this.port.close();
    } catch {
      void 0;
    }

    this.resetConnection();
    this.emitConnectionChange(false);
  }

  async send(command, { silent = false } = {}) {
    if (!this.connected) throw new Error('El chaleco no está conectado por USB.');

    const normalized = buildVestCommand(command);
    const payload = `${JSON.stringify(normalized)}\n`;
    const bytes = this.encoder.encode(payload);

    this.writeQueue = this.writeQueue.catch(() => undefined).then(async () => {
      if (!this.writer) throw new Error('El puerto serial USB ya no está disponible.');
      await this.writer.write(bytes);
    });

    await this.writeQueue;
    if (!silent) {
      this.dispatchEvent(new CustomEvent('command-sent', {
        detail: { command: normalized, transport: 'serial', transportLabel: 'USB' },
      }));
    }
    return normalized;
  }

  startReadLoop() {
    this.readLoopPromise = this.readFromPort().finally(() => {
      if (!this.disconnecting && this.port) {
        this.releaseWriter();
        this.resetConnection();
        this.emitConnectionChange(false);
      }
    });
  }

  async readFromPort() {
    while (this.port?.readable && !this.disconnecting) {
      this.reader = this.port.readable.getReader();
      try {
        while (!this.disconnecting) {
          const { value, done } = await this.reader.read();
          if (done) break;
          if (value) this.consumeSerialData(value);
        }
      } catch (error) {
        if (!this.disconnecting) this.dispatchStatus(`serial:error:${error?.message || error}`);
      } finally {
        try {
          this.reader.releaseLock();
        } catch {
          void 0;
        }
        this.reader = null;
      }
      break;
    }
  }

  consumeSerialData(value) {
    this.readBuffer += this.decoder.decode(value, { stream: true });
    const lines = this.readBuffer.split(/\r?\n/);
    this.readBuffer = lines.pop() || '';
    lines.map((line) => line.trim()).filter(Boolean).forEach((line) => this.dispatchStatus(line));
  }

  dispatchStatus(message) {
    this.dispatchEvent(new CustomEvent('status', {
      detail: { message, transport: 'serial', transportLabel: 'USB' },
    }));
  }

  releaseWriter() {
    if (!this.writer) return;
    try {
      this.writer.releaseLock();
    } catch {
      void 0;
    }
    this.writer = null;
  }

  resetConnection() {
    this.reader = null;
    this.writer = null;
    this.port = null;
    this.readLoopPromise = null;
    this.readBuffer = '';
    this.disconnecting = false;
    this.writeQueue = Promise.resolve();
  }

  handleNavigatorDisconnect = (event) => {
    if (!this.port || event.target !== this.port) return;
    this.dispatchStatus('serial:disconnected');
    this.reader?.cancel().catch(() => undefined);
  };

  emitConnectionChange(connected) {
    this.dispatchEvent(new CustomEvent('connectionchange', {
      detail: {
        connected,
        deviceName: this.deviceName,
        transport: 'serial',
        transportLabel: 'USB',
      },
    }));
  }

  formatUsbId(value) {
    if (!Number.isInteger(value)) return '';
    return value.toString(16).padStart(4, '0').toUpperCase();
  }

  wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }
}

export const vestSerial = new VestSerialClient();
