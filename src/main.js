import './styles.css';
window.__CHIHUAHUA_XR_READY__ = true;
import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { destinations } from './scenes.js';
import {
  VIBRATION_COMPONENTS,
  THERMAL_COMPONENTS,
  VEST_CAPABILITIES,
  VEST_THERMAL_DURATIONS,
  VEST_BLE,
  vestController,
} from './vestController.js';
import { vestHaptics } from './vestHaptics.js';

const appState = {
  mode: 'lobby',
  activeDestination: null,
  audioEnabled: false,
  hovered: null,
  hoverRestore: null,
  interactables: [],
  sceneToken: 0,
  sceneHasInteraction: false,
};

let xrExitButton = null;
let xrInfoPanel = null;
const xrExitButtonLobbyPosition = new THREE.Vector3(2.55, 3.58, -3.15);
const xrExitButtonLobbyRotation = new THREE.Euler(0, 0, 0);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x080b12);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 250);
camera.position.set(0, 1.65, 0);
camera.rotation.order = 'YXZ';

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer));

renderer.xr.addEventListener('sessionstart', () => {
  document.body.classList.add('xr-active');
});

renderer.xr.addEventListener('sessionend', () => {
  document.body.classList.remove('xr-active');
  if (xrExitButton) xrExitButton.visible = false;
  hideXRInfoPanel();
  resetHoveredScale();
  vestHaptics.cancel({ forceStop: true });
});

const listener = new THREE.AudioListener();
camera.add(listener);

const textureLoader = new THREE.TextureLoader();
const raycaster = new THREE.Raycaster();
const tempMatrix = new THREE.Matrix4();
const pointer = new THREE.Vector2();
const clock = new THREE.Clock();

let currentRoot = new THREE.Group();
scene.add(currentRoot);

let panoramaMesh = null;
let ambientSound = null;
let controller1, controller2;
let desktopReticle;
let isMouseLooking = false;
let lastMouseX = 0;
let lastMouseY = 0;
let yaw = 0;
let pitch = 0;
let suppressNextClick = false;
let lastVestDiagnosticsSignature = '';
let navigationToken = 0;

const hudTitle = document.querySelector('#hud-title');
const hudSubtitle = document.querySelector('#hud-subtitle');
const infoPanel = document.querySelector('#info-panel');
const infoTitle = document.querySelector('#info-title');
const infoBody = document.querySelector('#info-body');
const closeInfo = document.querySelector('#close-info');
const homeButton = document.querySelector('#home-button');
const audioButton = document.querySelector('#enter-audio');
const loading = document.querySelector('#loading');
const sceneCategory = document.querySelector('#scene-category');
const sceneCount = document.querySelector('#scene-count');
const sceneList = document.querySelector('#scene-list');
const vestControlButton = document.querySelector('#vest-control');
const vestPanel = document.querySelector('#vest-panel');
const vestClose = document.querySelector('#close-vest');
const vestStatus = document.querySelector('#vest-status');
const vestDeviceName = document.querySelector('#vest-device-name');
const vestMessage = document.querySelector('#vest-message');
const vestVibrationComponentSelect = document.querySelector('#vest-vibration-component');
const vestThermalComponentSelect = document.querySelector('#vest-thermal-component');
const vestDuration = document.querySelector('#vest-duration');
const vestThermalMode = document.querySelector('#vest-thermal-mode');
const vestThermalDuty = document.querySelector('#vest-thermal-duty');
const vestThermalDutyValue = document.querySelector('#vest-thermal-duty-value');
const vestThermalDuration = document.querySelector('#vest-thermal-duration');
const vestLog = document.querySelector('#vest-log');
const vestClearLog = document.querySelector('#vest-clear-log');
const vestConnectSelectedButton = document.querySelector('#vest-connect-selected');
const vestTransportSelect = document.querySelector('#vest-transport');
const vestTransportHint = document.querySelector('#vest-transport-hint');

initLighting();
initControllers();
initDesktopPointer();
initXRExitButton();
initSceneRail();
initVestUi();
showLobby();

window.setTimeout(() => loading.classList.remove('visible'), 900);
window.addEventListener('resize', onWindowResize);
window.addEventListener('pointermove', onPointerMove);
renderer.domElement.addEventListener('pointerdown', onMouseLookStart);
window.addEventListener('pointerup', onMouseLookEnd);
window.addEventListener('click', onDesktopClick);
window.addEventListener('pagehide', () => { vestHaptics.cancel({ forceStop: true }); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') vestHaptics.cancel({ forceStop: true });
});
closeInfo.addEventListener('click', () => { closeInfoPanel(); });
homeButton.addEventListener('click', () => { returnToLobby(); });
audioButton.addEventListener('click', enableAudio);
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && renderer.xr.isPresenting) exitVR();
});

renderer.setAnimationLoop(render);

function initSceneRail() {
  if (!sceneList) return;
  sceneCount.textContent = destinations.length;
  sceneList.innerHTML = '';
  destinations.forEach((destination, index) => {
    const item = document.createElement('button');
    item.className = 'rail-item';
    item.dataset.destination = destination.id;
    item.style.setProperty('--item-accent', destination.accent);
    item.innerHTML = `
      <span class="rail-icon">${String(index + 1).padStart(2, '0')}</span>
      <span class="rail-text">
        <strong>${destination.title}</strong>
        <span>${destination.category}</span>
      </span>
    `;
    item.addEventListener('click', () => { selectDestination(destination); });
    sceneList.appendChild(item);
  });
}

function updateSceneRail(activeId) {
  if (!sceneList) return;
  sceneList.querySelectorAll('.rail-item').forEach((item) => {
    item.classList.toggle('active', item.dataset.destination === activeId);
  });
}

function initLighting() {
  const hemi = new THREE.HemisphereLight(0xffffff, 0x223344, 2.2);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xffffff, 1.2);
  dir.position.set(3, 5, 2);
  scene.add(dir);
}

function initControllers() {
  const controllerModelFactory = new XRControllerModelFactory();

  controller1 = renderer.xr.getController(0);
  controller2 = renderer.xr.getController(1);
  controller1.addEventListener('selectstart', () => onControllerSelect(controller1));
  controller2.addEventListener('selectstart', () => onControllerSelect(controller2));
  scene.add(controller1, controller2);

  const grip1 = renderer.xr.getControllerGrip(0);
  grip1.add(controllerModelFactory.createControllerModel(grip1));
  scene.add(grip1);

  const grip2 = renderer.xr.getControllerGrip(1);
  grip2.add(controllerModelFactory.createControllerModel(grip2));
  scene.add(grip2);

  [controller1, controller2].forEach((controller) => {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -5),
    ]);
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.65 }));
    line.name = 'laser';
    controller.add(line);
  });
}

function initDesktopPointer() {
  desktopReticle = makeRing(0.018, 0.024, 0xffffff);
  desktopReticle.position.set(0, 0, -1.5);
  camera.add(desktopReticle);
}

function initXRExitButton() {
  xrExitButton = makeButton('Salir VR', '#b91c1c', '#ffffff');
  xrExitButton.name = 'xr-exit-button';
  xrExitButton.userData = { type: 'exit-vr-button' };
  xrExitButton.scale.setScalar(0.68);
  xrExitButton.visible = false;
  xrExitButton.position.copy(xrExitButtonLobbyPosition);
  xrExitButton.rotation.copy(xrExitButtonLobbyRotation);

  xrExitButton.traverse((child) => {
    if (!child.material) return;
    child.renderOrder = Math.max(child.renderOrder || 0, 100);
    child.material.depthTest = false;
    child.material.depthWrite = false;
    child.material.side = THREE.DoubleSide;
  });

  scene.add(xrExitButton);
}

function updateXRExitButton() {
  if (!xrExitButton) return;

  const shouldShowInLobby = renderer.xr.isPresenting && appState.mode === 'lobby';
  xrExitButton.visible = shouldShowInLobby;

  if (!shouldShowInLobby) {
    if (appState.hovered === xrExitButton) resetHoveredScale();
    return;
  }
  xrExitButton.position.copy(xrExitButtonLobbyPosition);
  xrExitButton.rotation.copy(xrExitButtonLobbyRotation);
}

async function clearRoot() {
  appState.sceneToken += 1;
  appState.sceneHasInteraction = true;
  hideInfoPanel();
  hideVestPanel();
  stopAmbient();
  appState.interactables = [];
  appState.hovered = null;
  appState.hoverRestore = null;

  const rootToDispose = currentRoot;
  currentRoot = new THREE.Group();
  scene.remove(rootToDispose);
  disposeObject(rootToDispose);
  scene.add(currentRoot);
  await vestHaptics.cancel({ forceStop: true });
}

async function showLobby(expectedNavigationToken = null) {
  await clearRoot();
  if (expectedNavigationToken !== null && expectedNavigationToken !== navigationToken) return;
  appState.mode = 'lobby';
  document.body.classList.add('lobby-mode');
  appState.activeDestination = null;
  scene.background = new THREE.Color(0x080b12);

  document.documentElement.style.setProperty('--accent', '#e9c46a');
  hudTitle.textContent = 'Chihuahua 360';
  hudSubtitle.textContent = 'Selecciona un destino para recorrer Chihuahua en 360°';
  sceneCategory.textContent = 'Inicio';
  updateSceneRail(null);

  createLobbyEnvironment();
  createDestinationCards();
}

function createLobbyEnvironment() {
  const floorGeometry = new THREE.CircleGeometry(8.5, 128);
  const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.92, metalness: 0.12 });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  currentRoot.add(floor);

  const grid = new THREE.GridHelper(15, 30, 0xe9c46a, 0x314158);
  grid.position.y = 0.018;
  grid.material.transparent = true;
  grid.material.opacity = 0.18;
  currentRoot.add(grid);

  const platform = new THREE.Mesh(
    new THREE.RingGeometry(2.35, 2.62, 128),
    new THREE.MeshBasicMaterial({ color: 0xe9c46a, side: THREE.DoubleSide, transparent: true, opacity: 0.78 })
  );
  platform.rotation.x = -Math.PI / 2;
  platform.position.y = 0.035;
  currentRoot.add(platform);

  const inner = new THREE.Mesh(
    new THREE.CircleGeometry(1.12, 80),
    new THREE.MeshBasicMaterial({ color: 0x0f172a, transparent: true, opacity: 0.65 })
  );
  inner.rotation.x = -Math.PI / 2;
  inner.position.y = 0.04;
  currentRoot.add(inner);

  const particles = new THREE.Group();
  for (let i = 0; i < 90; i++) {
    const star = new THREE.Mesh(
      new THREE.SphereGeometry(0.012 + Math.random() * 0.018, 10, 10),
      new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? 0xe9c46a : 0xffffff, transparent: true, opacity: 0.45 + Math.random() * 0.35 })
    );
    const a = Math.random() * Math.PI * 2;
    const r = 5 + Math.random() * 24;
    star.position.set(Math.cos(a) * r, 1.2 + Math.random() * 4.8, Math.sin(a) * r);
    particles.add(star);
  }
  particles.userData.type = 'ambient-particles';
  currentRoot.add(particles);

  const title = makeTextSprite('Chihuahua 360', { fontSize: 82, color: '#ffffff', background: 'rgba(7,12,27,0.58)' });
  title.position.set(0, 3.43, -3.05);
  fitSprite(title, 0.62, 3.05);
  currentRoot.add(title);

  const subtitle = makeTextSprite('Recorrido inmersivo por naturaleza, historia y cultura', { fontSize: 34, color: '#d7dde9', background: 'rgba(7,12,27,0.38)' });
  subtitle.position.set(0, 2.94, -3.05);
  fitSprite(subtitle, 0.36, 3.1);
  currentRoot.add(subtitle);
}

function createDestinationCards() {
  const radius = 6.75;
  const y = 1.32;
  const cardWidth = 2.85;
  const cardHeight = 3.35;

  destinations.forEach((destination, index) => {
    const angle = (index / destinations.length) * Math.PI * 2 - Math.PI / 2;
    const card = new THREE.Group();
    card.userData = { type: 'destination-card', destination };

    const frame = new THREE.Mesh(
      new THREE.PlaneGeometry(cardWidth, cardHeight),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(destination.accent), roughness: 0.55, metalness: 0.18 })
    );
    frame.renderOrder = 1;
    card.add(frame);

    const surface = new THREE.Mesh(
      new THREE.PlaneGeometry(cardWidth - 0.16, cardHeight - 0.16),
      new THREE.MeshBasicMaterial({ color: 0x07101f, transparent: true, opacity: 0.92, depthWrite: false })
    );
    surface.position.z = 0.012;
    surface.renderOrder = 2;
    card.add(surface);

    const thumbnail = new THREE.Mesh(
      new THREE.PlaneGeometry(2.36, 1.16),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.88, depthWrite: false })
    );
    thumbnail.position.set(0, 0.86, 0.026);
    thumbnail.renderOrder = 3;
    card.add(thumbnail);
    const thumbnailUrl = destination.thumbnail || destination.panorama;
    const applyThumbnailTexture = (texture) => {
      if (appState.mode !== 'lobby' || !thumbnail.parent) {
        texture.dispose();
        return;
      }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      thumbnail.material.map = texture;
      thumbnail.material.needsUpdate = true;
    };

    textureLoader.load(thumbnailUrl, applyThumbnailTexture, undefined, () => {
      if (thumbnailUrl !== destination.panorama) {
        textureLoader.load(destination.panorama, applyThumbnailTexture);
      }
    });

    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(2.36, 1.16),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18, depthWrite: false })
    );
    glass.position.set(0, 0.86, 0.034);
    glass.renderOrder = 4;
    card.add(glass);

    const number = makeTextPlane(String(index + 1).padStart(2, '0'), {
      width: 0.68,
      height: 0.38,
      fontSize: 64,
      color: '#111827',
      background: destination.accent,
      radius: 18,
    });
    number.position.set(-0.94, 1.32, 0.06);
    card.add(number);

    const label = makeTextPlane(destination.title, {
      width: 2.38,
      height: 0.82,
      fontSize: 76,
      color: '#ffffff',
      background: 'rgba(0,0,0,0)',
      maxLines: 2,
    });
    label.position.set(0, -0.12, 0.06);
    card.add(label);

    const category = makeTextPlane(destination.category, {
      width: 2.02,
      height: 0.48,
      fontSize: 58,
      color: '#d7dde9',
      background: 'rgba(255,255,255,0.08)',
      radius: 24,
      maxLines: 1,
    });
    category.position.set(0, -0.86, 0.06);
    card.add(category);

    const hint = makeTextPlane('Iniciar recorrido', {
      width: 2.18,
      height: 0.50,
      fontSize: 56,
      color: '#111827',
      background: destination.accent,
      radius: 24,
      maxLines: 1,
    });
    hint.position.set(0, -1.38, 0.06);
    card.add(hint);

    card.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
    card.lookAt(new THREE.Vector3(0, y, 0));
    currentRoot.add(card);
    appState.interactables.push(card);
  });
}

async function selectDestination(destination) {
  const token = ++navigationToken;
  await vestHaptics.play('destination-select');
  if (token !== navigationToken) return;
  await loadDestination(destination, token);
}

async function returnToLobby() {
  const token = ++navigationToken;
  await vestHaptics.play('return-home');
  if (token !== navigationToken) return;
  await showLobby(token);
}

async function loadDestination(destination, expectedNavigationToken) {
  await clearRoot();
  if (expectedNavigationToken !== navigationToken) return;
  appState.mode = 'scene';
  document.body.classList.remove('lobby-mode');
  appState.activeDestination = destination;
  appState.sceneToken += 1;
  appState.sceneHasInteraction = false;
  const sceneToken = appState.sceneToken;

  document.documentElement.style.setProperty('--accent', destination.accent);
  hudTitle.textContent = destination.title;
  hudSubtitle.textContent = destination.short;
  sceneCategory.textContent = destination.category;
  updateSceneRail(destination.id);

  createPanorama(destination, sceneToken);
  createSceneNavigation(destination);
  createHotspots(destination);
  createAmbient(destination);
}

function createPanorama(destination, sceneToken) {
  const geometry = new THREE.SphereGeometry(80, 64, 48);
  geometry.scale(-1, 1, 1);
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const targetMesh = new THREE.Mesh(geometry, material);
  panoramaMesh = targetMesh;
  currentRoot.add(targetMesh);

  textureLoader.load(destination.panorama, (texture) => {
    const destinationIsActive = appState.activeDestination?.id === destination.id;
    const sceneIsCurrent = appState.sceneToken === sceneToken;
    if (!destinationIsActive || !sceneIsCurrent || !targetMesh.parent) {
      texture.dispose();
      return;
    }

    texture.colorSpace = THREE.SRGBColorSpace;
    texture.mapping = THREE.EquirectangularReflectionMapping;
    targetMesh.material.map = texture;
    targetMesh.material.needsUpdate = true;
    if (!appState.sceneHasInteraction) vestHaptics.play(destination.haptic);
  });
}

function createSceneNavigation(destination) {
  const back = makeButton('← Regresar al inicio', '#0f172a', '#ffffff');
  back.position.set(-2.90, 2.12, -2.85);
  back.scale.setScalar(0.74);
  back.userData = { type: 'home-button' };
  currentRoot.add(back);
  appState.interactables.push(back);

  const title = makeTextSprite(destination.title, { fontSize: 78, color: '#ffffff', background: 'rgba(7,12,27,0.66)' });
  title.position.set(0, 2.92, -3.05);
  fitSprite(title, 0.50, 3.35);
  currentRoot.add(title);

  const subtitle = makeTextSprite(`${destination.category} · ${destination.short}`, { fontSize: 36, color: '#d7dde9', background: 'rgba(7,12,27,0.48)' });
  subtitle.position.set(0, 2.38, -3.05);
  fitSprite(subtitle, 0.30, 3.45);
  currentRoot.add(subtitle);
}

function createHotspots(destination) {
  destination.hotspots.forEach((spot, index) => {
    const hotspot = new THREE.Group();
    hotspot.userData = { type: 'hotspot', spot };

    const halo = makeRing(0.12, 0.18, destination.accent);
    halo.material.opacity = 0.32;
    halo.userData.type = 'hotspot-ring';
    hotspot.add(halo);

    const ring = makeRing(0.075, 0.115, destination.accent);
    ring.userData.type = 'hotspot-ring';
    hotspot.add(ring);

    const dot = new THREE.Mesh(
      new THREE.CircleGeometry(0.045, 32),
      new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })
    );
    dot.position.z = 0.005;
    dot.userData.type = 'hotspot-dot';
    hotspot.add(dot);

    const label = makeTextSprite(`${index + 1}. ${spot.title}`, { fontSize: 34, color: '#ffffff', background: 'rgba(7,12,27,0.72)' });
    const labelOffset = getHotspotLabelOffset(spot, index);
    label.position.set(labelOffset.x, labelOffset.y, 0.02);
    label.userData.type = 'hotspot-label';
    fitSprite(label, 0.17, 0.96);
    hotspot.add(label);

    const pos = sphericalToPosition(3.45, spot.yaw, spot.pitch);
    hotspot.position.copy(pos);
    hotspot.lookAt(camera.position);
    currentRoot.add(hotspot);
    appState.interactables.push(hotspot);
  });
}


function getHotspotLabelOffset(spot, index) {
  if (spot.labelOffset) {
    const [x = 0, y = -0.32] = spot.labelOffset;
    return { x, y };
  }

  const yaw = THREE.MathUtils.euclideanModulo(spot.yaw + 180, 360) - 180;
  if (Math.abs(yaw) <= 18) return { x: 0, y: spot.pitch < -4 ? 0.30 : -0.32 };
  if (yaw < 0) return { x: 0.58, y: -0.02 };
  return { x: -0.58, y: -0.02 };
}

function createAmbient(destination) {
  if (!appState.audioEnabled) return;
  const audioLoader = new THREE.AudioLoader();
  ambientSound = new THREE.Audio(listener);
  audioLoader.load(destination.ambientAudio, (buffer) => {
    ambientSound.setBuffer(buffer);
    ambientSound.setLoop(true);
    ambientSound.setVolume(0.45);
    ambientSound.play();
  });
}

function stopAmbient() {
  if (ambientSound) {
    if (ambientSound.isPlaying) ambientSound.stop();
    ambientSound.disconnect();
    ambientSound = null;
  }
}

async function enableAudio() {
  if (listener.context.state !== 'running') await listener.context.resume();
  appState.audioEnabled = true;
  audioButton.textContent = 'Audio activo';
  audioButton.disabled = true;
  if (appState.activeDestination) createAmbient(appState.activeDestination);
}

async function exitVR() {
  const session = renderer.xr.getSession?.();
  if (!session) return;

  try {
    await session.end();
  } catch (error) {
    console.warn('[Main] No se pudo salir de VR:', error);
  }
}


function initVestUi() {
  if (!vestControlButton || !vestPanel) return;

  vestController.setTransport(vestTransportSelect?.value || 'serial');
  vestControlButton.addEventListener('click', showVestPanel);
  vestConnectSelectedButton?.addEventListener('click', connectVest);
  vestTransportSelect?.addEventListener('change', handleVestTransportChange);
  vestClose?.addEventListener('click', hideVestPanel);
  vestClearLog?.addEventListener('click', clearVestLog);

  document.querySelector('#vest-send-vibration')?.addEventListener('click', sendSelectedVibration);
  document.querySelector('#vest-stop-vibration')?.addEventListener('click', () => sendVestCommand({
    type: 'vibration',
    channel: selectedVestChannel('vibration'),
    action: 'off',
    duration: 0,
  }, 'Motor detenido'));
  document.querySelector('#vest-send-thermal')?.addEventListener('click', sendSelectedThermal);
  document.querySelector('#vest-send-all-vibration')?.addEventListener('click', sendAllVibration);
  document.querySelector('#vest-send-all-off')?.addEventListener('click', () => sendVestCommand(
    { type: 'allOff' },
    'Todas las salidas están apagadas',
  ));

  vestThermalDuty?.addEventListener('input', updateVestInputLabels);
  vestThermalComponentSelect?.addEventListener('change', updateThermalSelection);
  vestThermalMode?.addEventListener('change', updateThermalSelection);

  vestController.addEventListener('connectionchange', (event) => {
    const {
      connected,
      deviceName,
      transport,
      reason,
      recovered,
      transportLabel = getVestTransportLabel(transport),
    } = event.detail;
    updateVestConnectionUi(connected, deviceName, transport);

    if (connected) {
      appendVestLog(recovered
        ? `Conexión ${transportLabel} recuperada con ${deviceName || 'Chaleco VR'}.`
        : `Conexión ${transportLabel} establecida con ${deviceName || 'Chaleco VR'}.`);
    } else if (reason === 'unexpected' && transport === 'bluetooth') {
      updateVestStatus('Reconectando Bluetooth', false, 'searching');
      updateVestMessage('Se perdió el enlace Bluetooth. Intentando recuperar la conexión automáticamente.');
      appendVestLog('Conexión Bluetooth perdida inesperadamente; se iniciará recuperación automática.');
    } else {
      appendVestLog(`Conexión ${transportLabel} finalizada.`);
    }
  });

  vestController.addEventListener('reconnectstate', (event) => {
    const { state, attempt, maxAttempts, delay, error } = event.detail;
    if (state === 'scheduled') {
      setVestConnectButtonsBusy(true, 'Reconectando...');
      updateVestStatus('Reconectando Bluetooth', false, 'searching');
      appendVestLog(`Reconexión Bluetooth ${attempt}/${maxAttempts} programada en ${delay} ms.`);
      return;
    }
    if (state === 'attempting') {
      appendVestLog(`Intentando reconexión Bluetooth ${attempt}/${maxAttempts}.`);
      return;
    }
    if (state === 'attempt-failed') {
      appendVestLog(`Reconexión Bluetooth ${attempt}/${maxAttempts} falló: ${error}.`);
      return;
    }
    if (state === 'connected') {
      setVestConnectButtonsBusy(false);
      updateVestMessage('La conexión Bluetooth se recuperó automáticamente.');
      return;
    }
    if (state === 'failed') {
      setVestConnectButtonsBusy(false);
      updateVestStatus('Sin conexión', false, 'error');
      updateVestMessage('No fue posible recuperar la conexión Bluetooth automáticamente.', true);
      appendVestLog(`Reconexión Bluetooth agotada después de ${maxAttempts} intentos.`);
    }
  });

  vestController.addEventListener('writeerror', (event) => {
    const detail = event.detail;
    const lastTx = detail.lastTxAt ? `${Math.round((Date.now() - detail.lastTxAt) / 100) / 10} s` : 'sin dato';
    const lastRx = detail.lastRxAt ? `${Math.round((Date.now() - detail.lastRxAt) / 100) / 10} s` : 'sin dato';
    appendVestLog(`Error de escritura Bluetooth: ${detail.error}. GATT=${detail.connected ? 'conectado' : 'desconectado'}, cola=${detail.pendingWrites}, último TX=${lastTx}, último RX=${lastRx}, página=${detail.visibilityState}.`);
  });

  vestController.addEventListener('heartbeaterror', (event) => {
    updateVestMessage('La comunicación Bluetooth está inestable.', true);
    appendVestLog(`Heartbeat fallido: ${event.detail.error}. Página=${event.detail.visibilityState}.`);
  });

  vestController.addEventListener('visibilitystate', (event) => {
    if (event.detail.transport !== 'bluetooth') return;
    appendVestLog(event.detail.visibilityState === 'visible'
      ? 'Página visible; heartbeat Bluetooth renovado.'
      : 'Página en segundo plano; el navegador puede retrasar temporizadores Bluetooth.');
  });

  vestController.addEventListener('status', (event) => {
    const status = normalizeVestStatusLine(event.detail.message);
    const isError = status.startsWith('error:');
    const watchdogTriggered = status.includes('watchdog-all-off');
    updateVestMessage(formatVestStatus(status), isError || watchdogTriggered);
    if (watchdogTriggered && vestController.connected) {
      updateVestStatus(`Conectado por ${vestController.connectionLabel} · protección activada`, true, 'warning');
      appendVestLog('El watchdog apagó las salidas, pero el enlace de transporte permanece conectado.');
    }
    appendVestLog(`← [${event.detail.transportLabel}] ${formatVestStatusForLog(status)}`);
  });

  vestController.addEventListener('command-sent', (event) => {
    if (vestController.connected) {
      updateVestStatus(`Conectado por ${vestController.connectionLabel}`, true);
    }
    updateVestMessage('Comando enviado al chaleco.');
    appendVestLog(`→ [${event.detail.transportLabel}] ${formatVestCommand(event.detail.command)}`);
  });

  vestHaptics.addEventListener('log', (event) => {
    const prefix = event.detail.level === 'error' ? 'Error háptico'
      : event.detail.level === 'warning' ? 'Protección háptica'
        : 'Escena háptica';
    appendVestLog(`${prefix}: ${event.detail.message}`);
  });

  renderVestControls();
  updateVestInputLabels();
  updateVestTransportUi();
  updateVestConnectionUi(false, '', vestController.connectionType);
  clearVestLog();
  appendVestLog('Consola de diagnóstico iniciada.');
  refreshVestAvailability();
}

function renderVestControls() {
  if (vestDuration) {
    vestDuration.min = String(VEST_CAPABILITIES.vibration.minDuration);
    vestDuration.max = String(VEST_CAPABILITIES.vibration.maxDuration);
  }
  if (vestThermalDuty) {
    vestThermalDuty.max = String(VEST_CAPABILITIES.thermal.maxDuty);
  }
  if (vestThermalDuration) {
    vestThermalDuration.min = String(VEST_CAPABILITIES.thermal.minDuration);
    vestThermalDuration.max = String(VEST_CAPABILITIES.thermal.maxDuration);
  }

  if (vestVibrationComponentSelect) {
    vestVibrationComponentSelect.innerHTML = VIBRATION_COMPONENTS.map((component) => (
      `<option value="${component.channel}">${component.label}</option>`
    )).join('');
  }

  if (vestThermalComponentSelect) {
    vestThermalComponentSelect.innerHTML = '';
    const groups = [
      { label: 'Calor · Espalda superior', kind: 'hot', surface: 'back' },
      { label: 'Calor · Frente superior', kind: 'hot', surface: 'front' },
      { label: 'Frío · Espalda inferior', kind: 'cold', surface: 'back' },
      { label: 'Frío · Frente inferior', kind: 'cold', surface: 'front' },
    ];

    groups.forEach(({ label, kind, surface }) => {
      const optgroup = document.createElement('optgroup');
      optgroup.label = label;
      THERMAL_COMPONENTS
        .filter((component) => (
          component.thermalKind === kind
          && component.placement.surface === surface
        ))
        .forEach((component) => {
          const option = document.createElement('option');
          option.value = String(component.channel);
          option.textContent = component.label;
          optgroup.appendChild(option);
        });
      vestThermalComponentSelect.appendChild(optgroup);
    });
  }

  updateThermalSelection();
}

async function connectVest() {
  if (vestController.reconnecting) return;

  if (vestController.connected) {
    setVestConnectButtonsBusy(true, 'Desconectando...');
    appendVestLog(`Cerrando conexión ${vestController.connectionLabel}.`);
    try {
      await vestController.disconnect();
      updateVestMessage('Chaleco desconectado.');
    } catch (error) {
      updateVestMessage(error.message, true);
      appendVestLog(`Error al desconectar: ${error.message}`);
    } finally {
      setVestConnectButtonsBusy(false);
    }
    return;
  }

  const transport = getSelectedVestTransport();
  const transportLabel = getVestTransportLabel(transport);
  vestController.setTransport(transport);
  updateVestStatus(`Conectando por ${transportLabel}`, false, 'searching');
  setVestConnectButtonsBusy(true, `Conectando por ${transportLabel}...`);
  updateVestMessage('Selecciona el dispositivo en la ventana del navegador.');
  appendVestLog(`Iniciando conexión ${transportLabel}.`);

  try {
    await vestController.connect(transport);
    updateVestMessage(`Conexión establecida por ${transportLabel}.`);
  } catch (error) {
    updateVestStatus('Sin conexión', false, 'error');
    updateVestMessage(error.message, true);
    appendVestLog(`Error de conexión ${transportLabel}: ${error.message}`);
    await refreshVestAvailability();
  } finally {
    setVestConnectButtonsBusy(false);
  }
}

async function handleVestTransportChange() {
  const transport = getSelectedVestTransport();
  try {
    vestController.setTransport(transport);
    updateVestTransportUi();
    updateVestConnectionUi(false, '', transport);
    appendVestLog(`Método de conexión seleccionado: ${getVestTransportLabel(transport)}.`);
    await refreshVestAvailability();
  } catch (error) {
    updateVestMessage(error.message, true);
    appendVestLog(`No se pudo cambiar el método de conexión: ${error.message}`);
    if (vestTransportSelect) vestTransportSelect.value = vestController.connectionType;
  }
}

function getSelectedVestTransport() {
  return vestTransportSelect?.value === 'bluetooth' ? 'bluetooth' : 'serial';
}

function getVestTransportLabel(transport = vestController.connectionType) {
  return transport === 'serial' ? 'USB' : 'Bluetooth';
}

function updateVestTransportUi() {
  const transport = getSelectedVestTransport();
  if (vestTransportHint) {
    vestTransportHint.textContent = transport === 'serial'
      ? 'Conexión directa mediante Web Serial.'
      : `Conexión BLE con dispositivos ${VEST_BLE.deviceNamePrefix}.`;
  }
  if (vestConnectSelectedButton) vestConnectSelectedButton.textContent = getVestConnectButtonText();
}

async function refreshVestAvailability() {
  const transport = getSelectedVestTransport();
  const diagnostics = await vestController.getDiagnostics(transport);
  logVestDiagnostics(transport, diagnostics);

  if (vestController.connected) return;

  const secure = diagnostics?.isSecureContext !== false;
  const apiAvailable = transport === 'serial'
    ? diagnostics?.hasSerialApi
    : diagnostics?.hasBluetoothApi;
  const adapterAvailable = transport !== 'bluetooth' || diagnostics?.bluetoothAvailable !== false;

  if (!secure) {
    updateVestStatus('Requiere HTTPS', false, 'error');
    updateVestMessage('La conexión del chaleco requiere un contexto HTTPS.', true);
    return;
  }

  if (!apiAvailable) {
    updateVestStatus('Navegador no compatible', false, 'error');
    updateVestMessage(`${getVestTransportLabel(transport)} no está disponible en este navegador.`, true);
    return;
  }

  if (!adapterAvailable) {
    updateVestStatus('Bluetooth no disponible', false, 'error');
    updateVestMessage('No se detectó un adaptador Bluetooth disponible.', true);
    return;
  }

  updateVestStatus(`Listo para ${getVestTransportLabel(transport)}`, false, 'ready');
  updateVestMessage('Sistema disponible para conexión.');
}

function setVestConnectButtonsBusy(disabled, label = '') {
  if (vestConnectSelectedButton) {
    vestConnectSelectedButton.disabled = disabled;
    vestConnectSelectedButton.textContent = disabled ? label : getVestConnectButtonText();
  }
  if (vestTransportSelect) vestTransportSelect.disabled = disabled || vestController.connected || vestController.reconnecting;
}

function getVestConnectButtonText() {
  if (vestController.reconnecting) return 'Reconectando...';
  if (vestController.connected) return 'Desconectar chaleco';
  return `Conectar por ${getVestTransportLabel(getSelectedVestTransport())}`;
}

function showVestPanel() {
  vestPanel?.classList.remove('hidden');
}

function hideVestPanel() {
  vestPanel?.classList.add('hidden');
}

function updateVestConnectionUi(connected, deviceName = '', transport = vestController.connectionType) {
  const transportLabel = getVestTransportLabel(transport);
  updateVestStatus(connected ? `Conectado por ${transportLabel}` : 'Sin conexión', connected);
  if (vestTransportSelect) {
    vestTransportSelect.value = transport;
    vestTransportSelect.disabled = connected;
  }
  updateVestTransportUi();
  if (vestControlButton) {
    vestControlButton.textContent = connected ? 'Chaleco conectado' : 'Chaleco';
    vestControlButton.classList.toggle('connected', connected);
  }
  if (vestConnectSelectedButton) vestConnectSelectedButton.textContent = getVestConnectButtonText();
  if (vestDeviceName) {
    vestDeviceName.textContent = connected
      ? `${deviceName || 'Chaleco VR'} · ${transportLabel}`
      : 'Chaleco no conectado';
  }
  document.querySelectorAll('[data-vest-command]').forEach((element) => {
    element.disabled = !connected;
  });
}

function updateVestStatus(label, connected, state = '') {
  if (!vestStatus) return;
  vestStatus.textContent = label;
  vestStatus.classList.toggle('connected', Boolean(connected));
  vestStatus.classList.toggle('warning', state === 'searching' || state === 'ready' || state === 'warning');
  vestStatus.classList.toggle('error', state === 'error');
}

function updateVestMessage(message, isError = false) {
  if (!vestMessage) return;
  vestMessage.textContent = message;
  vestMessage.classList.toggle('error', isError);
}

function updateVestInputLabels() {
  if (vestThermalDutyValue && vestThermalDuty) {
    vestThermalDutyValue.textContent = `${vestThermalDuty.value}%`;
  }
}

function selectedVestChannel(preferredType) {
  if (preferredType === 'thermal') return Number(vestThermalComponentSelect?.value) || 1;
  return Number(vestVibrationComponentSelect?.value) || 1;
}

function selectedThermalComponent() {
  const channel = selectedVestChannel('thermal');
  return THERMAL_COMPONENTS.find((component) => component.channel === channel) || THERMAL_COMPONENTS[0];
}

function updateThermalSelection() {
  const isOff = vestThermalMode?.value === 'off';
  const component = selectedThermalComponent();
  if (vestThermalDuty) vestThermalDuty.disabled = isOff;
  if (vestThermalDuration) {
    vestThermalDuration.disabled = isOff;
    if (!isOff && component) {
      vestThermalDuration.value = String(VEST_THERMAL_DURATIONS[component.mode]);
    }
  }
}

function sendSelectedVibration() {
  return sendVestCommand({
    type: 'vibration',
    channel: selectedVestChannel('vibration'),
    action: 'on',
    duration: numberFromInput(vestDuration, 600),
  }, 'Vibración activada');
}

function sendSelectedThermal() {
  const component = selectedThermalComponent();
  const isOff = vestThermalMode?.value === 'off';

  return sendVestCommand({
    type: 'thermal',
    channel: component.channel,
    mode: isOff ? 'off' : component.mode,
    duty: isOff ? 0 : numberFromInput(vestThermalDuty, 50),
    duration: isOff ? 0 : numberFromInput(
      vestThermalDuration,
      VEST_THERMAL_DURATIONS[component.mode],
    ),
  }, isOff ? 'Celda apagada' : 'Salida térmica activada');
}

function sendAllVibration() {
  return sendVestCommand({
    type: 'vibration',
    channel: 'all',
    action: 'on',
    duration: numberFromInput(vestDuration, 600),
  }, 'Motores V1–V4 activados');
}

async function sendVestCommand(command, successMessage) {
  try {
    if (command.type === 'allOff') {
      await vestHaptics.cancel({ forceStop: true });
      updateVestMessage(successMessage);
      return;
    }

    await vestHaptics.cancel();
    await vestController.send(command);
    updateVestMessage(successMessage);
  } catch (error) {
    updateVestMessage(error.message, true);
    appendVestLog(`Comando rechazado: ${error.message}`);
    showVestPanel();
  }
}

function numberFromInput(input, fallback) {
  const value = Number(input?.value);
  return Number.isFinite(value) ? value : fallback;
}

function normalizeVestStatusLine(message = '') {
  return String(message)
    .trim()
    .replace(/^\[STATUS\]\s*/, '');
}

function formatVestStatus(message = '') {
  const status = normalizeVestStatusLine(message);
  if (!status) return 'Estado recibido del chaleco.';
  if (status === 'pong') return 'Comunicación verificada.';
  if (status === 'system:ready') return 'Firmware listo.';
  if (status.includes('auto-off')) return 'El componente se apagó al finalizar su duración.';
  if (status.includes('watchdog-all-off')) return 'Las salidas se apagaron por pérdida de comunicación.';
  if (status.includes('cooldown')) return 'La celda permanece en pausa térmica.';
  if (status.includes('opposite-mode-pause')) return 'La zona debe completar la pausa antes de cambiar entre calor y frío.';
  if (status.includes('zone-mode-conflict')) return 'No se permite calor y frío simultáneos en la misma zona.';
  if (status.includes('max-active')) return 'Se alcanzó el máximo de celdas térmicas simultáneas.';
  if (status.startsWith('error:')) return formatVestError(status);
  if (status.includes(':on')) return 'Componente activado.';
  if (status.includes(':off') || status.includes('allOff')) return 'Salidas apagadas.';
  return 'Estado del chaleco actualizado.';
}

function formatVestCommand(command = {}) {
  if (command.type === 'allOff') return 'Apagado general solicitado.';

  if (command.type === 'vibration') {
    const component = command.channel === 'all'
      ? null
      : VIBRATION_COMPONENTS.find((item) => item.channel === Number(command.channel));
    const label = command.channel === 'all' ? 'V1–V4' : component?.label || `V${command.channel}`;
    if (command.action === 'off') return `${label}: apagar.`;
    return `${label}: activar durante ${command.duration} ms.`;
  }

  if (command.type === 'thermal') {
    if (command.channel === 'all') return 'Sistema térmico: apagar todas las celdas.';
    const component = THERMAL_COMPONENTS.find((item) => item.channel === Number(command.channel));
    const label = component?.label || `P${command.channel}`;
    if (command.mode === 'off') return `${label}: apagar.`;
    return `${label}: activar con ciclo ${command.duty}% durante ${command.duration} ms.`;
  }

  return `Comando ${command.type || 'desconocido'}.`;
}

function formatVestStatusForLog(statusLine = '') {
  const status = normalizeVestStatusLine(statusLine);
  if (!status) return 'Estado vacío recibido.';

  if (status.startsWith('RX:')) {
    const payload = status.slice(3).trim();
    try {
      return `Firmware recibió: ${formatVestCommand(JSON.parse(payload))}`;
    } catch {
      return `Firmware recibió: ${payload}`;
    }
  }

  const vibrationAll = status.match(/^vibration:(on|off),ch=all,dur=(\d+)$/);
  if (vibrationAll) {
    const [, action, duration] = vibrationAll;
    return action === 'on'
      ? `V1–V4 activados durante ${duration} ms.`
      : 'V1–V4 apagados.';
  }

  const vibration = status.match(/^vibration:(on|off),ch=(\d+),zone=(front|back),side=(left|right),level=(middle),dur=(\d+)$/);
  if (vibration) {
    const [, action, channel, , , , duration] = vibration;
    const component = VIBRATION_COMPONENTS.find((item) => item.channel === Number(channel));
    const label = component?.label || `V${channel}`;
    return action === 'on'
      ? `${label} activado durante ${duration} ms.`
      : `${label} apagado.`;
  }

  const legacyVibration = status.match(/^vibration:(on|off),ch=(\d+),dur=(\d+)$/);
  if (legacyVibration) {
    const [, action, channel, duration] = legacyVibration;
    const component = VIBRATION_COMPONENTS.find((item) => item.channel === Number(channel));
    const label = component?.label || `V${channel}`;
    return action === 'on'
      ? `${label} activado durante ${duration} ms.`
      : `${label} apagado.`;
  }

  const vibrationAutoOff = status.match(/^vibration:auto-off,ch=(\d+)$/);
  if (vibrationAutoOff) {
    const component = VIBRATION_COMPONENTS.find((item) => item.channel === Number(vibrationAutoOff[1]));
    return `${component?.label || `V${vibrationAutoOff[1]}`} apagado al finalizar su duración.`;
  }

  const thermalOn = status.match(/^thermal:on,ch=(\d+),kind=(hot|cold),zone=(front|back),side=(left|right),level=(upper|lower),duty=(\d+),dur=(\d+)$/);
  if (thermalOn) {
    const [, channel, , , , , duty, duration] = thermalOn;
    const component = THERMAL_COMPONENTS.find((item) => item.channel === Number(channel));
    const label = component?.label || `P${channel}`;
    return `${label} activada con ciclo ${duty}% durante ${duration} ms.`;
  }

  const legacyThermalOn = status.match(/^thermal:on,ch=(\d+),kind=(hot|cold),zone=(front|back),duty=(\d+),dur=(\d+)$/);
  if (legacyThermalOn) {
    const [, channel, , , duty, duration] = legacyThermalOn;
    const component = THERMAL_COMPONENTS.find((item) => item.channel === Number(channel));
    const label = component?.label || `P${channel}`;
    return `${label} activada con ciclo ${duty}% durante ${duration} ms.`;
  }

  const thermalOff = status.match(/^thermal:off,ch=(all|\d+)$/);
  if (thermalOff) {
    if (thermalOff[1] === 'all') return 'Todas las celdas térmicas apagadas.';
    const component = THERMAL_COMPONENTS.find((item) => item.channel === Number(thermalOff[1]));
    return `${component?.label || `P${thermalOff[1]}`} apagada.`;
  }

  const thermalAutoOff = status.match(/^thermal:auto-off,ch=(\d+)$/);
  if (thermalAutoOff) {
    const component = THERMAL_COMPONENTS.find((item) => item.channel === Number(thermalAutoOff[1]));
    return `${component?.label || `P${thermalAutoOff[1]}`} apagada al finalizar su duración.`;
  }

  if (status === 'allOff:ok') return 'Todas las salidas apagadas.';
  if (status === 'safety:watchdog-all-off') return 'Watchdog activado: todas las salidas apagadas.';
  if (status === 'system:ready') return 'Firmware listo.';
  if (status === 'ble:connected') return 'Firmware enlazado por Bluetooth.';
  if (status === 'pong') return 'Respuesta de comunicación recibida.';
  if (status.startsWith('error:')) return `${formatVestError(status)} (${status})`;

  return status;
}

function formatVestError(status) {
  const errors = {
    'error:thermal:invalid-channel': 'Canal térmico inválido.',
    'error:thermal:mode-mismatch': 'El modo térmico no corresponde a la celda.',
    'error:thermal:cooldown': 'La celda permanece en pausa térmica.',
    'error:thermal:already-active': 'La celda ya está activa.',
    'error:thermal:max-active': 'Se alcanzó el máximo de dos celdas térmicas activas.',
    'error:thermal:zone-mode-conflict': 'No se permite calor y frío simultáneos en la misma zona.',
    'error:thermal:opposite-mode-pause': 'La zona debe completar la pausa antes de cambiar entre calor y frío.',
    'error:thermal:all-on-disabled': 'La activación simultánea de todas las celdas está deshabilitada.',
    'error:thermal:duration-required': 'La activación térmica requiere una duración.',
    'error:vibration:invalid-channel': 'Canal de vibración inválido.',
    'error:vibration:invalid-action': 'Acción de vibración inválida.',
    'error:vibration:duration-required': 'La vibración requiere una duración.',
    'error:json-required': 'El firmware requiere comandos JSON.',
    'error:unknown-command': 'Tipo de comando no reconocido por el firmware.',
  };
  return errors[status] || 'El chaleco rechazó el comando solicitado.';
}

function logVestDiagnostics(transport, diagnostics = {}) {
  const yesNo = (value) => value ? 'sí' : 'no';
  const message = transport === 'serial'
    ? `Diagnóstico USB: HTTPS=${yesNo(diagnostics?.isSecureContext)}, Web Serial=${yesNo(diagnostics?.hasSerialApi)}.`
    : `Diagnóstico Bluetooth: HTTPS=${yesNo(diagnostics?.isSecureContext)}, Web Bluetooth=${yesNo(diagnostics?.hasBluetoothApi)}, adaptador=${diagnostics?.bluetoothAvailable === null ? 'no reportado' : yesNo(diagnostics?.bluetoothAvailable)}.`;

  const signature = `${transport}:${message}`;
  if (signature === lastVestDiagnosticsSignature) return;
  lastVestDiagnosticsSignature = signature;
  appendVestLog(message);
}

function clearVestLog() {
  if (!vestLog) return;
  vestLog.textContent = '';
}

function appendVestLog(message) {
  if (!vestLog) return;
  const time = new Date().toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  vestLog.textContent = `[${time}] ${message}\n${vestLog.textContent}`.slice(0, 12000);
  vestLog.scrollTop = 0;
}

function makeButton(text, background = '#111827', color = '#ffffff') {
  const group = new THREE.Group();

  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(2.02, 0.52),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(background),
      transparent: true,
      opacity: 0.95,
      depthTest: false,
      depthWrite: false,
    })
  );
  bg.renderOrder = 30;
  group.add(bg);

  const label = makeTextPlane(text, {
    width: 1.86,
    height: 0.38,
    fontSize: 46,
    color,
    background: 'rgba(0,0,0,0)',
    maxLines: 1,
  });
  label.position.z = 0.035;
  label.renderOrder = 31;
  group.add(label);

  return group;
}

function makeRing(inner, outer, color) {
  return new THREE.Mesh(
    new THREE.RingGeometry(inner, outer, 40),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(color), side: THREE.DoubleSide, transparent: true, opacity: 0.92 })
  );
}


function makeTextPlane(message, options = {}) {
  const planeWidth = options.width || 1;
  const planeHeight = options.height || 0.3;
  const fontSize = options.fontSize || 34;
  const color = options.color || '#ffffff';
  const background = options.background || 'rgba(0,0,0,0.55)';
  const maxLines = options.maxLines || 2;
  const radius = options.radius ?? 20;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = Math.max(128, Math.round(1024 * (planeHeight / planeWidth)));
  const ctx = canvas.getContext('2d');
  const padding = 44;
  const maxTextWidth = canvas.width - padding * 2;

  ctx.font = `800 ${fontSize}px system-ui, -apple-system, Segoe UI, sans-serif`;
  const lines = wrapText(ctx, String(message), maxTextWidth, maxLines);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = background;
  roundRect(ctx, 0, 0, canvas.width, canvas.height, radius * 2);
  ctx.fill();

  ctx.font = `800 ${fontSize}px system-ui, -apple-system, Segoe UI, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  const lineHeight = fontSize * 1.12;
  lines.forEach((line, idx) => {
    const y = canvas.height / 2 + (idx - (lines.length - 1) / 2) * lineHeight;
    ctx.fillText(line, canvas.width / 2, y);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(planeWidth, planeHeight), material);
  mesh.renderOrder = 10;
  return mesh;
}

function wrapText(ctx, text, maxWidth, maxLines) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';

  words.forEach((word) => {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  });
  if (current) lines.push(current);

  const clipped = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    let last = clipped[clipped.length - 1];
    while (last.length > 0 && ctx.measureText(`${last}…`).width > maxWidth) {
      last = last.slice(0, -1).trim();
    }
    clipped[clipped.length - 1] = `${last}…`;
  }
  return clipped.length ? clipped : [''];
}

function makeTextSprite(message, options = {}) {
  const fontSize = options.fontSize || 42;
  const color = options.color || '#ffffff';
  const background = options.background || 'rgba(0,0,0,0.55)';
  const lines = String(message).split('\n');
  const padding = 28;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = `700 ${fontSize}px system-ui, -apple-system, Segoe UI, sans-serif`;

  const width = Math.ceil(Math.max(...lines.map((line) => ctx.measureText(line).width)) + padding * 2);
  const height = Math.ceil(lines.length * fontSize * 1.28 + padding * 2);
  canvas.width = nextPowerOfTwo(width);
  canvas.height = nextPowerOfTwo(height);

  ctx.font = `700 ${fontSize}px system-ui, -apple-system, Segoe UI, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = background;
  roundRect(ctx, 0, 0, canvas.width, canvas.height, 26);
  ctx.fill();
  ctx.fillStyle = color;
  lines.forEach((line, idx) => {
    ctx.fillText(line, canvas.width / 2, canvas.height / 2 + (idx - (lines.length - 1) / 2) * fontSize * 1.25);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(canvas.width / canvas.height, 1, 1);
  return sprite;
}


function fitSprite(sprite, targetHeight = 0.5, maxWidth = 3) {
  const aspect = sprite.scale.x / sprite.scale.y || 1;
  let width = aspect * targetHeight;
  let height = targetHeight;
  if (width > maxWidth) {
    width = maxWidth;
    height = maxWidth / aspect;
  }
  sprite.scale.set(width, height, 1);
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function nextPowerOfTwo(value) {
  return 2 ** Math.ceil(Math.log2(value));
}

function sphericalToPosition(radius, yawDeg, pitchDeg) {
  const yaw = THREE.MathUtils.degToRad(yawDeg);
  const pitch = THREE.MathUtils.degToRad(pitchDeg);
  return new THREE.Vector3(
    radius * Math.sin(yaw) * Math.cos(pitch),
    1.6 + radius * Math.sin(pitch),
    -radius * Math.cos(yaw) * Math.cos(pitch)
  );
}

function onControllerSelect(controller) {
  const hit = getControllerIntersection(controller);
  if (hit) activateInteractable(hit.object);
}

function getControllerIntersection(controller) {
  tempMatrix.identity().extractRotation(controller.matrixWorld);
  raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
  const intersections = raycaster.intersectObjects(getInteractablesForRaycast(), true);
  return findValidIntersection(intersections);
}

function onPointerMove(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

  if (!isMouseLooking || renderer.xr.isPresenting) return;

  const movementX = event.clientX - lastMouseX;
  const movementY = event.clientY - lastMouseY;
  lastMouseX = event.clientX;
  lastMouseY = event.clientY;

  if (Math.abs(movementX) + Math.abs(movementY) > 2) suppressNextClick = true;

  yaw -= movementX * 0.004;
  pitch -= movementY * 0.004;
  pitch = THREE.MathUtils.clamp(pitch, -Math.PI / 2 + 0.08, Math.PI / 2 - 0.08);

  camera.rotation.set(pitch, yaw, 0);
}

function onMouseLookStart(event) {
  if (renderer.xr.isPresenting) return;
  if (event.button !== 0) return;
  isMouseLooking = true;
  lastMouseX = event.clientX;
  lastMouseY = event.clientY;
  suppressNextClick = false;
}

function onMouseLookEnd() {
  isMouseLooking = false;
}

function onDesktopClick(event) {
  if (renderer.xr.isPresenting) return;
  if (event && event.target !== renderer.domElement) return;
  if (suppressNextClick) {
    suppressNextClick = false;
    return;
  }
  raycaster.setFromCamera(pointer, camera);
  const intersections = raycaster.intersectObjects(getInteractablesForRaycast(), true);
  const hit = findValidIntersection(intersections);
  if (hit) activateInteractable(hit.object);
}

function getInteractablesForRaycast() {
  if (xrExitButton?.visible) return [...appState.interactables, xrExitButton];
  return appState.interactables;
}

function findValidIntersection(intersections) {
  for (const hit of intersections) {
    const target = findInteractableParent(hit.object);
    if (target) return { ...hit, object: target };
  }
  return null;
}

function findInteractableParent(object) {
  const clickableTypes = new Set(['destination-card', 'home-button', 'hotspot', 'exit-vr-button', 'info-close-button']);
  let current = object;
  while (current) {
    if (clickableTypes.has(current.userData?.type)) return current;
    current = current.parent;
  }
  return null;
}

function activateInteractable(object) {
  const { type, destination, spot } = object.userData;
  if (type === 'destination-card') selectDestination(destination);
  if (type === 'home-button') returnToLobby();
  if (type === 'hotspot') openHotspot(spot, object);
  if (type === 'exit-vr-button') exitVR();
  if (type === 'info-close-button') closeInfoPanel();
}

function openHotspot(spot, anchorObject) {
  appState.sceneHasInteraction = true;
  showInfoPanel(spot.title, spot.body, anchorObject);
  vestHaptics.play(spot.haptic, { spatialYaw: spot.yaw });
}

function closeInfoPanel() {
  hideInfoPanel();
  vestHaptics.play('info-close');
}

function showInfoPanel(title, body, anchorObject = null) {
  if (renderer.xr.isPresenting) {
    showXRInfoPanel(title, body, anchorObject);
    return;
  }

  hideXRInfoPanel();
  infoTitle.textContent = title;
  infoBody.textContent = body;
  infoPanel.classList.remove('hidden');
}

function hideInfoPanel() {
  infoPanel.classList.add('hidden');
  hideXRInfoPanel();
}

function showXRInfoPanel(title, body, anchorObject = null) {
  hideXRInfoPanel();

  const accent = appState.activeDestination?.accent || '#e9c46a';
  const panel = new THREE.Group();
  panel.name = 'xr-info-panel';
  panel.userData = { type: 'xr-info-panel' };

  const background = new THREE.Mesh(
    new THREE.PlaneGeometry(3.25, 1.82),
    new THREE.MeshBasicMaterial({
      color: 0x07101f,
      transparent: true,
      opacity: 0.94,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  background.renderOrder = 80;
  panel.add(background);

  const border = new THREE.Mesh(
    new THREE.RingGeometry(0.93, 0.965, 4),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(accent),
      transparent: true,
      opacity: 0.95,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  border.scale.set(1.7, 0.95, 1);
  border.rotation.z = Math.PI / 4;
  border.position.z = 0.012;
  border.renderOrder = 81;
  panel.add(border);

  const titlePlane = makeTextPlane(title, {
    width: 2.78,
    height: 0.38,
    fontSize: 56,
    color: '#ffffff',
    background: 'rgba(0,0,0,0)',
    maxLines: 1,
  });
  titlePlane.position.set(0, 0.54, 0.045);
  titlePlane.renderOrder = 84;
  panel.add(titlePlane);

  const bodyPlane = makeTextPlane(body, {
    width: 2.78,
    height: 0.86,
    fontSize: 35,
    color: '#d7dde9',
    background: 'rgba(255,255,255,0.04)',
    radius: 16,
    maxLines: 5,
  });
  bodyPlane.position.set(0, -0.08, 0.05);
  bodyPlane.renderOrder = 84;
  panel.add(bodyPlane);

  const close = makeButton('Cerrar', '#7f1d1d', '#ffffff');
  close.name = 'xr-info-close-button';
  close.userData = { type: 'info-close-button', xrInfoControl: true };
  close.scale.setScalar(0.44);
  close.position.set(1.05, -0.66, 0.075);
  panel.add(close);

  panel.traverse((child) => {
    if (!child.material) return;
    child.renderOrder = Math.max(child.renderOrder || 0, 80);
    child.material.depthTest = false;
    child.material.depthWrite = false;
    child.material.side = THREE.DoubleSide;
  });

  positionXRInfoPanel(panel, anchorObject);
  currentRoot.add(panel);
  appState.interactables.push(close);
  xrInfoPanel = panel;
}

function hideXRInfoPanel() {
  if (!xrInfoPanel) return;

  appState.interactables = appState.interactables.filter((item) => !item.userData?.xrInfoControl);
  if (appState.hovered && isDescendantOf(appState.hovered, xrInfoPanel)) resetHoveredScale();
  currentRoot.remove(xrInfoPanel);
  disposeObject(xrInfoPanel);
  xrInfoPanel = null;
}

function positionXRInfoPanel(panel, anchorObject) {
  const viewerPosition = getViewerWorldPosition();
  const anchorPosition = new THREE.Vector3();

  if (anchorObject) {
    anchorObject.getWorldPosition(anchorPosition);
  } else {
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    anchorPosition.copy(viewerPosition).add(forward.multiplyScalar(3));
  }

  const direction = anchorPosition.clone().sub(viewerPosition);
  direction.y = 0;
  if (direction.lengthSq() < 0.001) direction.set(0, 0, -1);
  direction.normalize();

  panel.position.copy(viewerPosition).add(direction.multiplyScalar(2.35));
  panel.position.y = THREE.MathUtils.clamp(anchorPosition.y + 0.22, viewerPosition.y + 0.05, viewerPosition.y + 0.72);
  panel.lookAt(viewerPosition);
}

function getViewerWorldPosition() {
  const viewerPosition = new THREE.Vector3();
  if (renderer.xr.isPresenting) {
    renderer.xr.getCamera(camera).getWorldPosition(viewerPosition);
  } else {
    camera.getWorldPosition(viewerPosition);
  }
  return viewerPosition;
}

function isDescendantOf(object, parent) {
  let current = object;
  while (current) {
    if (current === parent) return true;
    current = current.parent;
  }
  return false;
}

function updateHover() {
  let hit = null;
  if (renderer.xr.isPresenting) {
    hit = getControllerIntersection(controller1) || getControllerIntersection(controller2);
  } else {
    raycaster.setFromCamera(pointer, camera);
    hit = findValidIntersection(raycaster.intersectObjects(getInteractablesForRaycast(), true));
  }

  const nextHovered = hit?.object || null;
  if (appState.hovered === nextHovered) return;

  resetHoveredScale();
  appState.hovered = nextHovered;
  applyHoverScale(appState.hovered);
}

function applyHoverScale(object) {
  if (!object) return;

  if (object.userData?.type === 'hotspot') {
    const restoreItems = [];
    object.traverse((child) => {
      if (child.userData?.type === 'hotspot-ring' || child.userData?.type === 'hotspot-dot') {
        restoreItems.push({ object: child, scale: child.scale.clone() });
        child.scale.multiplyScalar(1.12);
      }
    });
    appState.hoverRestore = () => {
      restoreItems.forEach(({ object, scale }) => object.scale.copy(scale));
    };
    return;
  }

  const baseScale = object.scale.clone();
  object.scale.copy(baseScale).multiplyScalar(1.06);
  appState.hoverRestore = () => object.scale.copy(baseScale);
}

function resetHoveredScale() {
  if (appState.hoverRestore) appState.hoverRestore();
  appState.hoverRestore = null;
}

function render() {
  const delta = clock.getDelta();
  updateXRExitButton();
  updateHover();

  currentRoot.traverse((child) => {
    if (child.type === 'Sprite') child.lookAt(camera.position);
    if (child.userData?.type === 'ambient-particles') child.rotation.y += delta * 0.018;
    if (child.userData?.type === 'hotspot-ring') {
      child.rotation.z += delta * 0.45;
    }
  });

  renderer.render(scene, camera);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function disposeObject(object) {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        if (material.map) material.map.dispose();
        material.dispose();
      });
    }
  });
}
