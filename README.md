# Chihuahua360Web

Experiencia web inmersiva para explorar lugares emblemáticos del estado de Chihuahua mediante panoramas 360°, audio ambiental, puntos de interés interactivos y realidad virtual.

El proyecto utiliza **Three.js** y **WebXR**, e incluye soporte opcional para un chaleco háptico conectado mediante **USB** o **Bluetooth Low Energy**.

## Características

* Recorridos panorámicos en 360°.
* 10 destinos turísticos de Chihuahua.
* Puntos de interés con información contextual.
* Audio ambiental por escena.
* Compatibilidad con WebXR y controles VR.
* Interfaz adaptable a diferentes dispositivos.
* Integración opcional con chaleco háptico.
* Comunicación mediante Web Serial y Web Bluetooth.
* Efectos de vibración y respuesta térmica.

## Tecnologías

* Three.js
* Vite
* JavaScript
* WebGL
* WebXR
* Web Audio API
* Web Serial API
* Web Bluetooth API
* Arduino / ESP32

## Instalación

```bash
git clone https://github.com/USUARIO/Chihuahua360Web.git
cd Chihuahua360Web
npm install
npm run dev
```

Para generar la versión de producción:

```bash
npm run build
```

Para ejecutar las pruebas:

```bash
npm test
```

## Chaleco háptico

La experiencia puede conectarse opcionalmente a un chaleco físico capaz de generar:

* Vibración direccional.
* Sensaciones de calor.
* Sensaciones de frío.

La comunicación con el dispositivo puede realizarse mediante **USB** o **Bluetooth BLE**.

## GitHub Pages

Si el repositorio se publica como `Chihuahua360Web`, configura en `vite.config.js`:

```js
base: '/Chihuahua360Web/'
```

Después genera el proyecto con:

```bash
npm run build
```

## Objetivo

Mostrar el patrimonio natural, histórico y cultural de Chihuahua mediante una experiencia web inmersiva que combina recorridos 360°, realidad virtual y retroalimentación háptica.
