import { ConfigurationController } from './controller/configurationController.js';
import { LayoutController } from './controller/layoutController.js';
import { Application, Assets } from './pixi.mjs';

const canvasContainer = document.getElementById('canvasContainer');
document.body.style.setProperty('--canvas-bg', '#93bee2');
const app = new Application();
await app.init({ background: '#93bee2', resizeTo: canvasContainer, resolution: window.devicePixelRatio ?? 1 });
canvasContainer.appendChild(app.canvas);
await Assets.init({ basePath: '../img/', manifest: "../data/manifest.json" });
await Assets.loadBundle('track');
window.app = app;
window.assets = Assets;
function listenOnDevicePixelRatio() {
  function onChange() {
    window.app.renderer.resolution = window.devicePixelRatio;
    listenOnDevicePixelRatio();
  }
  matchMedia(
    `(resolution: ${window.devicePixelRatio}dppx)`
  ).addEventListener("change", onChange, { once: true });
}
listenOnDevicePixelRatio();
const layoutController = LayoutController.getInstance(app);
await layoutController.init();
new ConfigurationController();
