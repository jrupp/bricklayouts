import { ConfigurationController } from './controller/configurationController.js';
import { LayoutController } from './controller/layoutController.js';
import { Application, Assets, Color, path } from './pixi.mjs';

const canvasContainer = document.getElementById('canvasContainer');
document.body.style.setProperty('--canvas-bg', '#93bee2');
const app = new Application();
await app.init({ background: '#93bee2', resizeTo: canvasContainer, resolution: window.devicePixelRatio ?? 1 });
canvasContainer.appendChild(app.canvas);
await Assets.init({ basePath: '/img/', manifest: path.toAbsolute('../data/manifest.json') });
await Assets.loadBundle('track');
window.app = app;
window.assets = Assets;
Color.prototype.toYiq = function () {
  return ((this._components[0] * 299 + this._components[1] * 587 + this._components[2] * 114) /  1000) * 255;
};
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
layoutController.initWindowEvents();
new ConfigurationController();
document.getElementById('apploading').remove();
