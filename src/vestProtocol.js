import {
  VEST_CAPABILITIES,
  VEST_THERMAL_DURATIONS,
  getThermalComponent,
} from './vestHardware.js';

export const VEST_BLE = Object.freeze({
  deviceNamePrefix: 'ChalecoVR',
  serviceUuid: '7c1f4d8a-9f70-4f5e-9d1a-2d5fbf2f2a01',
  commandCharacteristicUuid: '7c1f4d8a-9f70-4f5e-9d1a-2d5fbf2f2a02',
  statusCharacteristicUuid: '7c1f4d8a-9f70-4f5e-9d1a-2d5fbf2f2a03',
});

export const VEST_SAFETY = Object.freeze({
  thermalMinDuration: VEST_CAPABILITIES.thermal.minDuration,
  thermalMaxDuration: VEST_CAPABILITIES.thermal.maxDuration,
  thermalMaxDuty: VEST_CAPABILITIES.thermal.maxDuty,
  heartbeatInterval: 1500,
});

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function normalizeChannel(value, maximum, label, allowAll = true) {
  if (allowAll && value === 'all') return 'all';
  const channel = Number(value);
  if (!Number.isInteger(channel) || channel < 1 || channel > maximum) {
    throw new Error(`${label} debe estar entre 1 y ${maximum}.`);
  }
  return channel;
}

function rejectUnsupportedVibrationFields(command) {
  if ('frequency' in command || 'intensity' in command || 'pattern' in command || 'steps' in command) {
    throw new Error('El hardware actual de vibración solo admite canal, activación y duración.');
  }
}

export function normalizeVestCommand(command = {}) {
  if (!command || typeof command !== 'object') throw new Error('Comando de chaleco inválido.');

  if (['allOff', 'ping', 'heartbeat'].includes(command.type)) return { type: command.type };

  if (command.type === 'vibration') {
    rejectUnsupportedVibrationFields(command);
    const channel = normalizeChannel(
      command.channel,
      VEST_CAPABILITIES.vibration.channelCount,
      'El canal de vibración',
    );
    const action = String(command.action || '').toLowerCase();
    if (!['on', 'off', 'stop'].includes(action)) {
      throw new Error('La acción de vibración debe ser on u off.');
    }

    if (action === 'off' || action === 'stop') {
      return { type: 'vibration', channel, action: 'off', duration: 0 };
    }

    return {
      type: 'vibration',
      channel,
      action: 'on',
      duration: clampNumber(
        command.duration,
        VEST_CAPABILITIES.vibration.minDuration,
        VEST_CAPABILITIES.vibration.maxDuration,
        600,
      ),
    };
  }

  if (command.type === 'thermal') {
    if ('power' in command) {
      throw new Error('Utiliza duty para definir el ciclo de trabajo térmico.');
    }

    const isOff = command.mode === 'off' || command.mode === 'stop' || Number(command.duty) <= 0;
    if (isOff && command.channel === 'all') {
      return { type: 'thermal', channel: 'all', mode: 'off', duty: 0, duration: 0 };
    }

    const channel = normalizeChannel(
      command.channel,
      VEST_CAPABILITIES.thermal.channelCount,
      'El canal térmico',
      false,
    );
    const component = getThermalComponent(channel);

    if (isOff) {
      return { type: 'thermal', channel, mode: 'off', duty: 0, duration: 0 };
    }

    const mode = String(command.mode || '').toLowerCase();
    if (mode !== component.mode) {
      const kindLabel = component.thermalKind === 'hot' ? 'calor' : 'frío';
      throw new Error(`${component.label} solo admite el modo ${kindLabel}.`);
    }

    return {
      type: 'thermal',
      channel,
      mode: component.mode,
      duty: clampNumber(command.duty, 1, VEST_SAFETY.thermalMaxDuty, 50),
      duration: clampNumber(
        command.duration,
        VEST_SAFETY.thermalMinDuration,
        VEST_SAFETY.thermalMaxDuration,
        VEST_THERMAL_DURATIONS[component.mode],
      ),
    };
  }

  throw new Error(`Tipo de comando no reconocido: ${command.type || 'vacío'}.`);
}

export function buildVestCommand(command) {
  return normalizeVestCommand(command);
}
