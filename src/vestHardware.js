export const VEST_THERMAL_DURATIONS = Object.freeze({
  heat: 6000,
  cool: 10000,
});

export const VEST_CAPABILITIES = Object.freeze({
  vibration: Object.freeze({
    channelCount: 4,
    minDuration: 20,
    maxDuration: 10000,
    supportsFrequency: false,
    supportsIntensity: false,
  }),
  thermal: Object.freeze({
    channelCount: 8,
    minDuration: 250,
    maxDuration: VEST_THERMAL_DURATIONS.cool,
    maxDuty: 70,
    maxActiveChannels: 2,
    channelCooldown: 3000,
    oppositeModePause: 10000,
    supportsTargetTemperature: false,
  }),
});

const placement = (surface, side, level) => Object.freeze({ surface, side, level });
const component = (definition) => Object.freeze({ ...definition, placement: Object.freeze(definition.placement) });

export const VIBRATION_COMPONENTS = Object.freeze([
  component({ id: 'v-1', type: 'vibration', channel: 1, label: 'V1 · Espalda · Izquierda', placement: placement('back', 'left', 'middle') }),
  component({ id: 'v-2', type: 'vibration', channel: 2, label: 'V2 · Espalda · Derecha', placement: placement('back', 'right', 'middle') }),
  component({ id: 'v-3', type: 'vibration', channel: 3, label: 'V3 · Frente · Derecha', placement: placement('front', 'right', 'middle') }),
  component({ id: 'v-4', type: 'vibration', channel: 4, label: 'V4 · Frente · Izquierda', placement: placement('front', 'left', 'middle') }),
]);

export const THERMAL_COMPONENTS = Object.freeze([
  component({ id: 'p-1', type: 'thermal', channel: 1, thermalKind: 'hot', mode: 'heat', label: 'P1 · Calor · Espalda superior · Izquierda', placement: placement('back', 'left', 'upper') }),
  component({ id: 'p-2', type: 'thermal', channel: 2, thermalKind: 'hot', mode: 'heat', label: 'P2 · Calor · Espalda superior · Derecha', placement: placement('back', 'right', 'upper') }),
  component({ id: 'p-3', type: 'thermal', channel: 3, thermalKind: 'hot', mode: 'heat', label: 'P3 · Calor · Frente superior · Derecha', placement: placement('front', 'right', 'upper') }),
  component({ id: 'p-4', type: 'thermal', channel: 4, thermalKind: 'hot', mode: 'heat', label: 'P4 · Calor · Frente superior · Izquierda', placement: placement('front', 'left', 'upper') }),
  component({ id: 'p-5', type: 'thermal', channel: 5, thermalKind: 'cold', mode: 'cool', label: 'P5 · Frío · Espalda inferior · Izquierda', placement: placement('back', 'left', 'lower') }),
  component({ id: 'p-6', type: 'thermal', channel: 6, thermalKind: 'cold', mode: 'cool', label: 'P6 · Frío · Espalda inferior · Derecha', placement: placement('back', 'right', 'lower') }),
  component({ id: 'p-7', type: 'thermal', channel: 7, thermalKind: 'cold', mode: 'cool', label: 'P7 · Frío · Frente inferior · Derecha', placement: placement('front', 'right', 'lower') }),
  component({ id: 'p-8', type: 'thermal', channel: 8, thermalKind: 'cold', mode: 'cool', label: 'P8 · Frío · Frente inferior · Izquierda', placement: placement('front', 'left', 'lower') }),
]);

export const VEST_GROUPS = Object.freeze({
  vibration: Object.freeze({
    all: Object.freeze([1, 2, 3, 4]),
    front: Object.freeze([4, 3]),
    back: Object.freeze([1, 2]),
    left: Object.freeze([1, 4]),
    right: Object.freeze([2, 3]),
    clockwise: Object.freeze([4, 3, 2, 1]),
  }),
  thermal: Object.freeze({
    heatBack: Object.freeze([1, 2]),
    heatFront: Object.freeze([4, 3]),
    coolBack: Object.freeze([5, 6]),
    coolFront: Object.freeze([8, 7]),
  }),
});

export const VEST_COMPONENTS = Object.freeze([
  ...VIBRATION_COMPONENTS,
  ...THERMAL_COMPONENTS,
]);

export function getVibrationComponent(channel) {
  return VIBRATION_COMPONENTS.find((item) => item.channel === Number(channel)) || null;
}

export function getThermalComponent(channel) {
  return THERMAL_COMPONENTS.find((item) => item.channel === Number(channel)) || null;
}

export function findVestComponents({ type, surface, side, level, thermalKind } = {}) {
  return VEST_COMPONENTS.filter((item) => {
    if (type && item.type !== type) return false;
    if (thermalKind && item.thermalKind !== thermalKind) return false;
    if (surface && item.placement.surface !== surface) return false;
    if (side && item.placement.side !== side) return false;
    if (level && item.placement.level !== level) return false;
    return true;
  });
}
