import {
  VEST_GROUPS,
  VEST_THERMAL_DURATIONS,
} from './vestHardware.js';

const V = VEST_GROUPS.vibration;
const T = VEST_GROUPS.thermal;

const vibration = (channels, duration, pause = 90) => Object.freeze({
  type: 'vibration',
  channels: Object.freeze([...channels]),
  duration,
  pause,
});

const thermal = (channels, duty, duration, pause = 80) => Object.freeze({
  type: 'thermal',
  channels: Object.freeze([...channels]),
  duty,
  duration,
  pause,
});

const effect = (label, steps) => Object.freeze({ label, steps: Object.freeze(steps) });
const repeat = (steps, times) => Array.from({ length: times }, () => steps).flat();

export const GENERIC_HAPTIC_EFFECTS = Object.freeze({
  'destination-select': effect('Selección de destino', [
    vibration(V.front, 80, 70),
  ]),
  'return-home': effect('Regreso al inicio', [
    vibration(V.front, 80, 70),
    vibration(V.back, 110, 60),
  ]),
  'info-close': effect('Cierre de información', [
    vibration(V.back, 80, 50),
  ]),
});

export const SCENE_HAPTIC_EFFECTS = Object.freeze({
  'barrancas-entry': effect('Barrancas del Cobre · Ambiente', [
    thermal(T.coolBack, 35, VEST_THERMAL_DURATIONS.cool, 80),
    vibration([1], 100, 100),
    vibration([2], 100, 70),
  ]),
  'barrancas-canones': effect('Barrancas del Cobre · Sistema de cañones', [
    vibration(V.front, 100, 120),
    vibration(V.back, 160, 80),
  ]),
  'barrancas-raramuri': effect('Barrancas del Cobre · Presencia rarámuri', [
    vibration(V.all, 90, 250),
    vibration(V.all, 90, 70),
  ]),
  'barrancas-divisadero': effect('Barrancas del Cobre · Divisadero', [
    thermal(T.coolFront, 35, VEST_THERMAL_DURATIONS.cool, 80),
    vibration(V.left, 100, 130),
    vibration(V.right, 100, 70),
  ]),

  'chepe-entry': effect('Tren Chepe · Ambiente', [
    thermal(T.coolBack, 30, VEST_THERMAL_DURATIONS.cool, 70),
    ...repeat([
      vibration(V.left, 90, 110),
      vibration(V.right, 90, 110),
    ], 3),
  ]),
  'chepe-ruta': effect('Tren Chepe · Ruta serrana', [
    ...repeat(V.clockwise.map((channel) => vibration([channel], 90, 85)), 2),
  ]),
  'chepe-estaciones': effect('Tren Chepe · Estaciones clave', [
    vibration(V.all, 140, 220),
    vibration(V.all, 140, 70),
  ]),
  'chepe-panoramico': effect('Tren Chepe · Viaje panorámico', [
    thermal(T.coolFront, 30, VEST_THERMAL_DURATIONS.cool, 70),
    vibration(V.left, 100, 180),
    vibration(V.right, 100, 70),
  ]),

  'centro-entry': effect('Centro Histórico · Ambiente', [
    vibration(V.front, 80, 60),
  ]),
  'centro-catedral': effect('Centro Histórico · Catedral Metropolitana', [
    vibration(V.front, 120, 300),
    vibration(V.front, 120, 70),
  ]),
  'centro-eje': effect('Centro Histórico · Eje cívico', [
    vibration(V.all, 150, 70),
  ]),
  'centro-museos': effect('Centro Histórico · Museos cercanos', [
    vibration([4], 80, 140),
    vibration([3], 80, 70),
  ]),

  'paquime-entry': effect('Paquimé · Ambiente', [
    thermal(T.heatFront, 35, VEST_THERMAL_DURATIONS.heat, 80),
    vibration(V.all, 120, 70),
  ]),
  'paquime-arquitectura': effect('Paquimé · Arquitectura de tierra', [
    vibration(V.all, 170, 70),
  ]),
  'paquime-intercambio': effect('Paquimé · Intercambio cultural', [
    vibration(V.left, 100, 150),
    vibration(V.right, 100, 70),
  ]),
  'paquime-casas': effect('Paquimé · Casas Grandes', [
    vibration(V.back, 110, 150),
    vibration(V.front, 110, 70),
  ]),

  'samalayuca-entry': effect('Dunas de Samalayuca · Ambiente', [
    thermal(T.heatFront, 50, VEST_THERMAL_DURATIONS.heat, 80),
  ]),
  'samalayuca-arena': effect('Dunas de Samalayuca · Mar de arena', [
    ...repeat(V.clockwise.map((channel) => vibration([channel], 80, 75)), 2),
  ]),
  'samalayuca-aventura': effect('Dunas de Samalayuca · Aventura en dunas', [
    ...repeat([
      vibration(V.left, 90, 100),
      vibration(V.right, 90, 100),
    ], 3),
  ]),
  'samalayuca-protegida': effect('Dunas de Samalayuca · Área protegida', [
    vibration(V.front, 75, 190),
    vibration(V.front, 75, 190),
    vibration(V.front, 75, 70),
  ]),

  'creel-entry': effect('Creel y Lago de Arareko · Ambiente', [
    thermal(T.coolBack, 40, VEST_THERMAL_DURATIONS.cool, 80),
    vibration([1], 100, 150),
    vibration([2], 100, 70),
  ]),
  'creel-pueblo': effect('Creel · Estación serrana', [
    ...repeat([
      vibration(V.left, 90, 130),
      vibration(V.right, 90, 130),
    ], 2),
  ]),
  'creel-lago': effect('Lago de Arareko · Brisa', [
    thermal(T.coolFront, 35, VEST_THERMAL_DURATIONS.cool, 80),
    vibration([4], 110, 180),
    vibration([3], 110, 70),
  ]),
  'creel-valles': effect('Creel · Valles de piedra', [
    vibration([1], 120, 230),
    vibration([2], 120, 230),
    vibration([1], 120, 70),
  ]),

  'basaseachi-entry': effect('Cascada de Basaseachi · Ambiente', [
    thermal(T.coolFront, 40, VEST_THERMAL_DURATIONS.cool, 80),
    vibration(V.front, 90, 110),
    vibration(V.back, 160, 70),
  ]),
  'basaseachi-caida': effect('Cascada de Basaseachi · Caída principal', [
    ...repeat([
      vibration(V.front, 90, 100),
      vibration(V.back, 170, 150),
    ], 2),
  ]),
  'basaseachi-barranca': effect('Cascada de Basaseachi · Barranca de Candameña', [
    vibration(V.all, 180, 70),
  ]),
  'basaseachi-senderos': effect('Cascada de Basaseachi · Senderos y miradores', [
    vibration(V.left, 90, 140),
    vibration(V.right, 90, 140),
    vibration(V.left, 90, 140),
    vibration(V.right, 90, 70),
  ]),

  'parral-entry': effect('Hidalgo del Parral · Ambiente', [
    vibration(V.back, 100, 60),
  ]),
  'parral-plata': effect('Hidalgo del Parral · Ciudad de la plata', [
    vibration(V.back, 140, 220),
    vibration(V.back, 140, 70),
  ]),
  'parral-palacio': effect('Hidalgo del Parral · Palacio Alvarado', [
    vibration([4], 80, 150),
    vibration([3], 80, 70),
  ]),
  'parral-villa': effect('Hidalgo del Parral · Memoria de Villa', [
    vibration(V.all, 180, 70),
  ]),

  'batopilas-entry': effect('Batopilas · Ambiente', [
    thermal(T.heatBack, 45, VEST_THERMAL_DURATIONS.heat, 80),
    vibration(V.back, 110, 160),
    vibration(V.front, 110, 70),
  ]),
  'batopilas-pueblo': effect('Batopilas · Pueblo entre barrancas', [
    vibration(V.back, 120, 190),
    vibration(V.front, 120, 70),
  ]),
  'batopilas-rio': effect('Batopilas · Río', [
    thermal(T.coolFront, 35, VEST_THERMAL_DURATIONS.cool, 80),
    vibration([4], 110, 190),
    vibration([3], 110, 70),
  ]),
  'batopilas-mineria': effect('Batopilas · Legado minero', [
    vibration(V.back, 150, 240),
    vibration(V.back, 150, 240),
    vibration(V.back, 150, 70),
  ]),

  'sinforosa-entry': effect('Barranca de la Sinforosa · Ambiente', [
    thermal(T.coolBack, 35, VEST_THERMAL_DURATIONS.cool, 80),
    vibration([1], 100, 170),
    vibration([2], 100, 70),
  ]),
  'sinforosa-cumbres': effect('Barranca de la Sinforosa · Cumbres', [
    vibration(V.front, 120, 160),
    vibration(V.back, 170, 70),
  ]),
  'sinforosa-rio': effect('Barranca de la Sinforosa · Río Verde', [
    thermal(T.coolFront, 30, VEST_THERMAL_DURATIONS.cool, 80),
    vibration([4], 90, 180),
    vibration([3], 90, 70),
  ]),
  'sinforosa-paisaje': effect('Barranca de la Sinforosa · Paisaje serrano', [
    vibration(V.left, 80, 500),
    vibration(V.right, 80, 500),
    vibration(V.left, 80, 70),
  ]),
});

export const HAPTIC_EFFECTS = Object.freeze({
  ...GENERIC_HAPTIC_EFFECTS,
  ...SCENE_HAPTIC_EFFECTS,
});

export function getHapticEffect(effectId) {
  return HAPTIC_EFFECTS[effectId] || null;
}

export function getSpatialVibrationChannels(yaw = 0) {
  const normalizedYaw = ((Number(yaw) + 180) % 360 + 360) % 360 - 180;
  if (Math.abs(normalizedYaw) <= 45) return V.front;
  if (Math.abs(normalizedYaw) >= 135) return V.back;
  return normalizedYaw > 0 ? V.right : V.left;
}

export function createSpatialConfirmation(yaw) {
  return vibration(getSpatialVibrationChannels(yaw), 80, 100);
}

