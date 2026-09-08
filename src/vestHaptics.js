import {
  VEST_CAPABILITIES,
  VEST_GROUPS,
  getThermalComponent,
} from './vestHardware.js';
import { getHapticEffect, createSpatialConfirmation } from './hapticProfiles.js';
import { vestController } from './vestController.js';

const SURFACES = ['front', 'back'];
const ALL_VIBRATION_CHANNELS = [...VEST_GROUPS.vibration.all];

export class VestHaptics extends EventTarget {
  constructor(controller) {
    super();
    this.controller = controller;
    this.sequenceToken = 0;
    this.currentEffectId = null;
    this.effectOutputUntil = 0;
    this.vibrationState = new Map();
    this.thermalState = new Map();
    this.surfaceState = new Map();
    this.resetState();

    controller.addEventListener('command-sent', (event) => this.recordCommand(event.detail.command));
    controller.addEventListener('status', (event) => this.recordStatus(event.detail.message));
    controller.addEventListener('connectionchange', (event) => {
      this.sequenceToken += 1;
      this.currentEffectId = null;
      this.effectOutputUntil = 0;
      this.resetState();
      if (event.detail.connected) controller.emergencyStop();
    });
  }

  resetState() {
    this.vibrationState.clear();
    ALL_VIBRATION_CHANNELS.forEach((channel) => {
      this.vibrationState.set(channel, { activeUntil: 0 });
    });

    this.thermalState.clear();
    for (let channel = 1; channel <= VEST_CAPABILITIES.thermal.channelCount; channel += 1) {
      this.thermalState.set(channel, {
        active: false,
        activeUntil: 0,
        cooldownUntil: 0,
      });
    }

    this.surfaceState.clear();
    SURFACES.forEach((surface) => {
      this.surfaceState.set(surface, {
        lastMode: null,
        oppositeAllowedAt: 0,
      });
    });
  }

  async play(effectId, { spatialYaw = null, stopBefore = true } = {}) {
    if (!this.controller.connected) return false;

    const effect = getHapticEffect(effectId);
    if (!effect) {
      this.emitLog(`Efecto no encontrado: ${effectId}.`, 'error');
      return false;
    }

    const token = ++this.sequenceToken;
    if (stopBefore) await this.forceAllOff(token);
    if (!this.isCurrent(token)) return false;

    this.currentEffectId = effectId;
    this.effectOutputUntil = 0;
    this.emitLog(`Efecto háptico iniciado: ${effect.label}.`);

    const steps = spatialYaw === null
      ? effect.steps
      : [createSpatialConfirmation(spatialYaw), ...effect.steps];

    try {
      for (const step of steps) {
        if (!this.isCurrent(token)) return false;
        await this.executeStep(step, token, effect.label);
      }

      const remainingOutputTime = this.effectOutputUntil - Date.now();
      if (remainingOutputTime > 0) await this.wait(remainingOutputTime, token);
    } catch (error) {
      if (this.isCurrent(token)) {
        this.emitLog(`Efecto interrumpido: ${error.message}`, 'error');
        await this.forceAllOff(token);
      }
      return false;
    } finally {
      if (this.isCurrent(token)) {
        this.currentEffectId = null;
        this.effectOutputUntil = 0;
      }
    }

    return this.isCurrent(token);
  }

  async cancel({ forceStop = false } = {}) {
    const token = ++this.sequenceToken;
    const hadCurrentEffect = Boolean(this.currentEffectId);
    this.currentEffectId = null;
    this.effectOutputUntil = 0;
    if (forceStop || hadCurrentEffect) await this.forceAllOff(token);
    return true;
  }

  async executeStep(step, token, effectLabel) {
    if (step.type === 'vibration') {
      await this.sendVibration(step, token);
      return;
    }

    if (step.type === 'thermal') {
      await this.sendThermal(step, token, effectLabel);
      return;
    }

    throw new Error(`Paso háptico no reconocido: ${step.type}`);
  }

  async sendVibration(step, token) {
    const channels = [...new Set(step.channels)].sort((a, b) => a - b);
    const useAll = channels.length === ALL_VIBRATION_CHANNELS.length
      && channels.every((channel, index) => channel === ALL_VIBRATION_CHANNELS[index]);

    if (useAll) {
      await this.controller.send({
        type: 'vibration',
        channel: 'all',
        action: 'on',
        duration: step.duration,
      });
    } else {
      await Promise.all(channels.map((channel) => this.controller.send({
        type: 'vibration',
        channel,
        action: 'on',
        duration: step.duration,
      })));
    }

    this.effectOutputUntil = Math.max(this.effectOutputUntil, Date.now() + step.duration);
    await this.wait(step.duration + (step.pause || 0), token);
  }

  async sendThermal(step, token, effectLabel) {
    const blockReason = this.getThermalBlockReason(step);
    if (blockReason) {
      this.emitLog(`Salida térmica omitida en ${effectLabel}: ${blockReason}.`, 'warning');
      await this.wait(step.pause || 0, token);
      return;
    }

    await Promise.all(step.channels.map((channel) => {
      const component = getThermalComponent(channel);
      return this.controller.send({
        type: 'thermal',
        channel,
        mode: component.mode,
        duty: step.duty,
        duration: step.duration,
      });
    }));

    this.effectOutputUntil = Math.max(this.effectOutputUntil, Date.now() + step.duration);
    await this.wait(step.pause || 0, token);
  }

  getThermalBlockReason(step) {
    this.refreshOutputState();
    const now = Date.now();
    const channels = [...new Set(step.channels)];
    const components = channels.map((channel) => getThermalComponent(channel));

    if (components.some((component) => !component)) return 'incluye un canal no configurado';
    if (channels.length > VEST_CAPABILITIES.thermal.maxActiveChannels) {
      return 'excede el máximo de dos celdas simultáneas';
    }

    const modes = new Set(components.map((component) => component.mode));
    if (modes.size !== 1) return 'combina calor y frío en el mismo efecto';
    const requestedMode = components[0].mode;

    for (const channel of channels) {
      const state = this.thermalState.get(channel);
      if (state.active) return `P${channel} ya está activa`;
      if (state.cooldownUntil > now) {
        const seconds = Math.ceil((state.cooldownUntil - now) / 1000);
        return `P${channel} mantiene una pausa de ${seconds} s`;
      }
    }

    const activeComponents = this.getActiveThermalComponents();
    if (activeComponents.length + channels.length > VEST_CAPABILITIES.thermal.maxActiveChannels) {
      return 'ya se alcanzó el máximo de celdas activas';
    }

    if (activeComponents.some((component) => component.mode !== requestedMode)) {
      return 'existe una salida térmica de modo opuesto';
    }

    for (const surface of new Set(components.map((component) => component.placement.surface))) {
      const activeInSurface = activeComponents.filter((component) => component.placement.surface === surface);
      if (activeInSurface.some((component) => component.mode !== requestedMode)) {
        return `la zona ${this.surfaceLabel(surface)} tiene activo el modo opuesto`;
      }

      const surfaceState = this.surfaceState.get(surface);
      if (
        activeInSurface.length === 0
        && surfaceState.lastMode
        && surfaceState.lastMode !== requestedMode
        && surfaceState.oppositeAllowedAt > now
      ) {
        const seconds = Math.ceil((surfaceState.oppositeAllowedAt - now) / 1000);
        return `la zona ${this.surfaceLabel(surface)} requiere ${seconds} s antes de cambiar de modo`;
      }
    }

    return '';
  }


  async forceAllOff(token) {
    if (!this.controller.connected) return;
    try {
      await this.controller.emergencyStop();
    } catch {
      return;
    }
    if (!this.isCurrent(token)) return;
    this.refreshOutputState();
  }

  recordCommand(command = {}) {
    const now = Date.now();

    if (command.type === 'allOff') {
      this.stopAllOutputs(now);
      return;
    }

    if (command.type === 'vibration') {
      const channels = command.channel === 'all' ? ALL_VIBRATION_CHANNELS : [Number(command.channel)];
      channels.forEach((channel) => {
        const state = this.vibrationState.get(channel);
        if (!state) return;
        state.activeUntil = command.action === 'on' ? now + Number(command.duration || 0) : 0;
      });
      return;
    }

    if (command.type === 'thermal') {
      if (command.channel === 'all') {
        this.stopAllThermal(now);
        return;
      }

      const channel = Number(command.channel);
      if (command.mode === 'off') {
        this.stopThermalChannel(channel, now);
        return;
      }

      const state = this.thermalState.get(channel);
      if (!state) return;
      state.active = true;
      state.activeUntil = now + Number(command.duration || 0);
    }
  }

  recordStatus(message = '') {
    const status = String(message).replace(/^\[STATUS\]\s*/, '').trim();
    const thermalAutoOff = status.match(/^thermal:auto-off,ch=(\d+)$/);
    if (thermalAutoOff) {
      this.stopThermalChannel(Number(thermalAutoOff[1]), Date.now());
      return;
    }

    if (status === 'allOff:ok' || status === 'safety:watchdog-all-off') {
      this.stopAllOutputs(Date.now());
      return;
    }

    const vibrationAutoOff = status.match(/^vibration:auto-off,ch=(\d+)$/);
    if (vibrationAutoOff) {
      const state = this.vibrationState.get(Number(vibrationAutoOff[1]));
      if (state) state.activeUntil = 0;
    }
  }

  refreshOutputState() {
    const now = Date.now();
    this.vibrationState.forEach((state) => {
      if (state.activeUntil && state.activeUntil <= now) state.activeUntil = 0;
    });

    this.thermalState.forEach((state, channel) => {
      if (state.active && state.activeUntil && state.activeUntil <= now) {
        this.stopThermalChannel(channel, now);
      }
    });
  }

  stopAllOutputs(now) {
    this.vibrationState.forEach((state) => {
      state.activeUntil = 0;
    });
    this.stopAllThermal(now);
  }

  stopAllThermal(now) {
    [...this.thermalState.keys()].forEach((channel) => this.stopThermalChannel(channel, now));
  }

  stopThermalChannel(channel, now) {
    const state = this.thermalState.get(channel);
    const component = getThermalComponent(channel);
    if (!state || !component || !state.active) return;

    state.active = false;
    state.activeUntil = 0;
    state.cooldownUntil = now + VEST_CAPABILITIES.thermal.channelCooldown;

    const activeInSurface = this.getActiveThermalComponents()
      .filter((item) => item.placement.surface === component.placement.surface);
    if (activeInSurface.length > 0) return;

    const surfaceState = this.surfaceState.get(component.placement.surface);
    surfaceState.lastMode = component.mode;
    surfaceState.oppositeAllowedAt = now + VEST_CAPABILITIES.thermal.oppositeModePause;
  }

  getActiveThermalComponents() {
    return [...this.thermalState.entries()]
      .filter(([, state]) => state.active)
      .map(([channel]) => getThermalComponent(channel))
      .filter(Boolean);
  }


  wait(duration, token) {
    if (!duration) return Promise.resolve();
    return new Promise((resolve) => {
      globalThis.setTimeout(() => resolve(this.isCurrent(token)), duration);
    });
  }

  isCurrent(token) {
    return token === this.sequenceToken;
  }

  surfaceLabel(surface) {
    return surface === 'front' ? 'frontal' : 'dorsal';
  }

  emitLog(message, level = 'info') {
    this.dispatchEvent(new CustomEvent('log', { detail: { message, level } }));
  }
}

export const vestHaptics = new VestHaptics(vestController);
