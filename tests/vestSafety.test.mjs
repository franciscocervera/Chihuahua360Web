import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { destinations } from '../src/scenes.js';
import {
  VEST_CAPABILITIES,
  VEST_THERMAL_DURATIONS,
  VEST_GROUPS,
  VIBRATION_COMPONENTS,
  THERMAL_COMPONENTS,
  findVestComponents,
  getThermalComponent,
} from '../src/vestHardware.js';
import {
  HAPTIC_EFFECTS,
  getSpatialVibrationChannels,
} from '../src/hapticProfiles.js';
import { VestHaptics } from '../src/vestHaptics.js';
import {
  VEST_SAFETY,
  buildVestCommand,
  normalizeVestCommand,
} from '../src/vestProtocol.js';

const firmwarePath = new URL('../firmware/Chaleco.ino', import.meta.url);
const interfacePath = new URL('../index.html', import.meta.url);
const mainPath = new URL('../src/main.js', import.meta.url);


class MockVestController extends EventTarget {
  constructor() {
    super();
    this.connected = true;
    this.commands = [];
  }

  async send(command) {
    const normalized = normalizeVestCommand(command);
    this.commands.push(normalized);
    this.dispatchEvent(new CustomEvent('command-sent', { detail: { command: normalized } }));
    return normalized;
  }

  async emergencyStop() {
    await this.send({ type: 'allOff' });
    return true;
  }
}

const expectedVibrationPlacement = [
  [1, 'back', 'left', 'middle'],
  [2, 'back', 'right', 'middle'],
  [3, 'front', 'right', 'middle'],
  [4, 'front', 'left', 'middle'],
];

const expectedThermalPlacement = [
  [1, 'heat', 'back', 'left', 'upper'],
  [2, 'heat', 'back', 'right', 'upper'],
  [3, 'heat', 'front', 'right', 'upper'],
  [4, 'heat', 'front', 'left', 'upper'],
  [5, 'cool', 'back', 'left', 'lower'],
  [6, 'cool', 'back', 'right', 'lower'],
  [7, 'cool', 'front', 'right', 'lower'],
  [8, 'cool', 'front', 'left', 'lower'],
];

test('la distribución de vibración coincide con el chaleco', () => {
  assert.equal(VIBRATION_COMPONENTS.length, 4);
  assert.deepEqual(
    VIBRATION_COMPONENTS.map(({ channel, placement }) => [
      channel,
      placement.surface,
      placement.side,
      placement.level,
    ]),
    expectedVibrationPlacement,
  );
  assert.deepEqual(VEST_GROUPS.vibration.left, [1, 4]);
  assert.deepEqual(VEST_GROUPS.vibration.right, [2, 3]);
});

test('la distribución térmica coincide con tipo y posición', () => {
  assert.deepEqual(
    THERMAL_COMPONENTS.map(({ channel, mode, placement }) => [
      channel,
      mode,
      placement.surface,
      placement.side,
      placement.level,
    ]),
    expectedThermalPlacement,
  );
  assert.deepEqual(
    findVestComponents({ type: 'thermal', surface: 'front', side: 'left' }).map((item) => item.channel),
    [4, 8],
  );
  assert.deepEqual(VEST_GROUPS.thermal.heatFront, [4, 3]);
  assert.deepEqual(VEST_GROUPS.thermal.coolFront, [8, 7]);
});

test('la vibración solo conserva canal, acción y duración', () => {
  assert.deepEqual(normalizeVestCommand({
    type: 'vibration',
    channel: 2,
    action: 'on',
    duration: 700,
  }), {
    type: 'vibration',
    channel: 2,
    action: 'on',
    duration: 700,
  });

  assert.throws(() => normalizeVestCommand({
    type: 'vibration',
    channel: 2,
    action: 'on',
    frequency: 150,
    duration: 700,
  }), /solo admite canal/);

  assert.throws(() => normalizeVestCommand({
    type: 'vibration',
    channel: 2,
    action: 'on',
    intensity: 50,
    duration: 700,
  }), /solo admite canal/);
});

test('la salida térmica se limita por ciclo de trabajo y duración', () => {
  const command = normalizeVestCommand({
    type: 'thermal',
    channel: 1,
    mode: 'heat',
    duty: 100,
    duration: 30000,
  });

  assert.equal(command.duty, VEST_SAFETY.thermalMaxDuty);
  assert.equal(command.duration, VEST_SAFETY.thermalMaxDuration);
  assert.equal(VEST_CAPABILITIES.thermal.supportsTargetTemperature, false);
});

test('los tiempos térmicos predeterminados distinguen calor y frío', () => {
  assert.equal(normalizeVestCommand({
    type: 'thermal',
    channel: 1,
    mode: 'heat',
    duty: 50,
  }).duration, VEST_THERMAL_DURATIONS.heat);

  assert.equal(normalizeVestCommand({
    type: 'thermal',
    channel: 5,
    mode: 'cool',
    duty: 50,
  }).duration, VEST_THERMAL_DURATIONS.cool);
});

test('no se permite activar todas las Peltier a la vez', () => {
  assert.throws(() => normalizeVestCommand({
    type: 'thermal',
    channel: 'all',
    mode: 'heat',
    duty: 50,
    duration: 1000,
  }));

  assert.deepEqual(normalizeVestCommand({
    type: 'thermal',
    channel: 'all',
    mode: 'off',
    duty: 0,
    duration: 0,
  }), {
    type: 'thermal',
    channel: 'all',
    mode: 'off',
    duty: 0,
    duration: 0,
  });
});

test('se rechaza un modo térmico incompatible con el canal', () => {
  assert.throws(() => normalizeVestCommand({
    type: 'thermal',
    channel: 5,
    mode: 'heat',
    duty: 50,
    duration: 1000,
  }), /solo admite el modo frío/);
});

test('el protocolo no añade campos sin efecto', () => {
  assert.deepEqual(buildVestCommand({ type: 'ping' }), { type: 'ping' });
  assert.throws(() => normalizeVestCommand({ type: 'pattern', steps: [] }), /no reconocido/);
  assert.throws(() => normalizeVestCommand({
    type: 'thermal',
    channel: 1,
    mode: 'heat',
    power: 50,
    duration: 1000,
  }), /Utiliza duty/);
});

test('todas las escenas y puntos de interés tienen un efecto válido', () => {
  assert.equal(destinations.length, 10);
  assert.equal(destinations.flatMap((destination) => destination.hotspots).length, 30);

  destinations.forEach((destination) => {
    assert.ok(HAPTIC_EFFECTS[destination.haptic], `Falta el efecto ${destination.haptic}`);
    destination.hotspots.forEach((spot) => {
      assert.ok(HAPTIC_EFFECTS[spot.haptic], `Falta el efecto ${spot.haptic}`);
    });
  });
});

test('los efectos usan únicamente capacidades físicas disponibles', () => {
  Object.values(HAPTIC_EFFECTS).forEach((effect) => {
    effect.steps.forEach((step) => {
      assert.ok(['vibration', 'thermal'].includes(step.type));

      if (step.type === 'vibration') {
        assert.ok(step.channels.length >= 1 && step.channels.length <= 4);
        assert.ok(step.channels.every((channel) => Number.isInteger(channel) && channel >= 1 && channel <= 4));
        assert.ok(step.duration >= VEST_CAPABILITIES.vibration.minDuration);
        assert.ok(step.duration <= VEST_CAPABILITIES.vibration.maxDuration);
        assert.equal('frequency' in step, false);
        assert.equal('intensity' in step, false);
      }

      if (step.type === 'thermal') {
        assert.ok(step.channels.length >= 1 && step.channels.length <= VEST_CAPABILITIES.thermal.maxActiveChannels);
        assert.ok(step.duty >= 1 && step.duty <= 50);
        const modes = new Set(step.channels.map((channel) => getThermalComponent(channel)?.mode));
        assert.deepEqual([...modes].filter(Boolean).length, 1);
        const [mode] = modes;
        assert.equal(step.duration, VEST_THERMAL_DURATIONS[mode]);
      }
    });
  });
});

test('la confirmación espacial respeta la perspectiva del usuario', () => {
  assert.deepEqual(getSpatialVibrationChannels(0), [4, 3]);
  assert.deepEqual(getSpatialVibrationChannels(90), [2, 3]);
  assert.deepEqual(getSpatialVibrationChannels(-90), [1, 4]);
  assert.deepEqual(getSpatialVibrationChannels(180), [1, 2]);
});


test('el coordinador ejecuta canales reales y limpia antes de cada efecto', async () => {
  const controller = new MockVestController();
  const haptics = new VestHaptics(controller);
  haptics.wait = async () => true;

  assert.equal(await haptics.play('destination-select'), true);
  assert.deepEqual(controller.commands, [
    { type: 'allOff' },
    { type: 'vibration', channel: 3, action: 'on', duration: 80 },
    { type: 'vibration', channel: 4, action: 'on', duration: 80 },
  ]);

  controller.commands.length = 0;
  assert.equal(await haptics.play('samalayuca-entry'), true);
  assert.deepEqual(controller.commands, [
    { type: 'allOff' },
    { type: 'thermal', channel: 4, mode: 'heat', duty: 50, duration: 6000 },
    { type: 'thermal', channel: 3, mode: 'heat', duty: 50, duration: 6000 },
  ]);
});

test('el coordinador mantiene el enfriamiento durante diez segundos', async () => {
  const controller = new MockVestController();
  const haptics = new VestHaptics(controller);
  haptics.wait = async () => true;

  assert.equal(await haptics.play('barrancas-entry'), true);
  assert.deepEqual(controller.commands.slice(0, 3), [
    { type: 'allOff' },
    { type: 'thermal', channel: 5, mode: 'cool', duty: 35, duration: 10000 },
    { type: 'thermal', channel: 6, mode: 'cool', duty: 35, duration: 10000 },
  ]);
});

test('la confirmación espacial se antepone al efecto narrativo', async () => {
  const controller = new MockVestController();
  const haptics = new VestHaptics(controller);
  haptics.wait = async () => true;

  await haptics.play('parral-villa', { spatialYaw: -90 });
  assert.deepEqual(controller.commands, [
    { type: 'allOff' },
    { type: 'vibration', channel: 1, action: 'on', duration: 80 },
    { type: 'vibration', channel: 4, action: 'on', duration: 80 },
    { type: 'vibration', channel: 'all', action: 'on', duration: 180 },
  ]);
});

test('cancelar una secuencia no apaga salidas manuales sin solicitud explícita', async () => {
  const controller = new MockVestController();
  const haptics = new VestHaptics(controller);

  await controller.send({
    type: 'thermal',
    channel: 1,
    mode: 'heat',
    duty: 35,
    duration: 1000,
  });
  controller.commands.length = 0;

  await haptics.cancel();
  assert.deepEqual(controller.commands, []);

  await haptics.cancel({ forceStop: true });
  assert.deepEqual(controller.commands, [{ type: 'allOff' }]);
});

test('el firmware aplica el mapa físico y las protecciones', async () => {
  const firmware = await readFile(firmwarePath, 'utf8');
  assert.doesNotMatch(firmware, /frequency|intensity|processPatternJson|processLegacyText/);
  assert.match(firmware, /extractString\(json, "action", ""\)/);
  assert.match(firmware, /extractInt\(json, "duty", 0\)/);
  assert.match(firmware, /zone-mode-conflict/);
  assert.match(firmware, /opposite-mode-pause/);
  assert.match(firmware, /THERMAL_MAX_DURATION_MS = 10000/);
  assert.match(firmware, /COMMAND_WATCHDOG_MS = 4500/);
  assert.match(firmware, /\{19, "back", "left", "middle"\}/);
  assert.match(firmware, /\{22, "front", "right", "middle"\}/);
  assert.match(firmware, /\{5, "heat", "hot", ZONE_FRONT, "front", "right", "upper"\}/);
  assert.match(firmware, /\{18, "cool", "cold", ZONE_FRONT, "front", "left", "lower"\}/);
});

test('la experiencia activa los efectos en los eventos correctos', async () => {
  const main = await readFile(mainPath, 'utf8');
  assert.match(main, /vestHaptics\.play\('destination-select'\)/);
  assert.match(main, /vestHaptics\.play\(destination\.haptic\)/);
  assert.match(main, /vestHaptics\.play\(spot\.haptic, \{ spatialYaw: spot\.yaw \}\)/);
  assert.match(main, /vestHaptics\.cancel\(\{ forceStop: true \}\)/);
  assert.match(main, /appState\.sceneHasInteraction/);
});

test('la interfaz conserva únicamente controles operativos y diagnóstico', async () => {
  const html = await readFile(interfacePath, 'utf8');
  assert.doesNotMatch(html, /Frecuencia|Intensidad|Pruebas|pruebas|Ping|Control disponible/);
  assert.doesNotMatch(html, /vest-thermal-legend|vest-thermal-kind|vest-safety-note/);
  assert.match(html, /Control del chaleco/);
  assert.match(html, /Ciclo de trabajo/);
  assert.match(html, /Consola de diagnóstico/);
  assert.match(html, /id="vest-log"/);
});
