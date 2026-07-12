import { Application, Container, Graphics, Rectangle, Sprite, Texture } from '../pixi.mjs';

/**
 * @module imageCropController
 */

/**
 * Modal, single-use crop selector. Shown when the user's requested component
 * dimensions don't match the source image aspect ratio. The selection
 * rectangle is fixed in size (aspect ratio matches the target); the user pans
 * and zooms the image behind it to choose the region.
 *
 * Load lazily via dynamic import — the module is only fetched when a crop is
 * actually needed.
 *
 * @class ImageCropController
 */
export class ImageCropController {
  /**
   * @param {Texture} sourceTexture
   * @param {number} targetW  Target pixel width for the resulting texture.
   * @param {number} targetH  Target pixel height for the resulting texture.
   * @returns {Promise<?Texture>}  Cropped sub-texture, or null on cancel.
   */
  show(sourceTexture, targetW, targetH) {
    return new Promise((resolve) => {
      const dialog = document.createElement('dialog');
      dialog.id = 'editorCropDialog';
      dialog.className = 'no-padding border surface-container-high small-round';

      // Size the crop viewport to a reasonable fraction of the viewport.
      const viewportW = Math.min(720, Math.max(320, Math.floor(window.innerWidth * 0.7)));
      const viewportH = Math.min(540, Math.max(240, Math.floor(window.innerHeight * 0.6)));

      dialog.innerHTML = `
        <div>
          <header class="fill top-round small-round small-padding right-padding" style="min-block-size: 3.2rem;">
            <nav>
              <h6 class="max">Select Region</h6>
            </nav>
          </header>
          <div style="padding: 0.5rem;">
            <p class="small-text no-margin">Drag to pan the image. Scroll or pinch to zoom. The highlighted region will be used.</p>
            <div id="editorCropCanvasHost" style="margin-top: 0.5rem; width: ${viewportW}px; height: ${viewportH}px; touch-action: none; overflow: hidden;"></div>
          </div>
          <hr>
          <nav class="no-padding no-space no-margin">
            <button class="no-round max extra-text left-button primary-text" id="editorCropDialogConfirm"><span>Confirm</span></button>
            <button class="no-round max extra-text right-button error" id="editorCropDialogCancel"><span>Cancel</span></button>
          </nav>
        </div>
      `;
      document.body.appendChild(dialog);

      // eslint-disable-next-line no-undef
      const closeDialog = () => ui('#editorCropDialog');
      const host = dialog.querySelector('#editorCropCanvasHost');

      const app = new Application();
      let disposed = false;
      let cleanup = () => {};

      const finish = (result) => {
        if (disposed) return;
        disposed = true;
        cleanup();
        try { app.destroy({ removeView: true }, { children: true }); } catch (_e) { /* ignore */ }
        closeDialog();
        dialog.addEventListener('close', () => dialog.remove(), { once: true });
        resolve(result);
      };

      app.init({ width: viewportW, height: viewportH, backgroundAlpha: 0, antialias: true })
        .then(() => {
          if (disposed) {
            try { app.destroy({ removeView: true }, { children: true }); } catch (_e) { /* ignore */ }
            return;
          }
          host.appendChild(app.canvas);

          const stage = app.stage;
          const imageLayer = new Container();
          stage.addChild(imageLayer);

          const sprite = new Sprite(sourceTexture);
          imageLayer.addChild(sprite);

          // Fixed selection rectangle centered in the viewport, sized so
          // aspect matches target and it fits comfortably inside the viewport.
          const targetAspect = targetW / targetH;
          const viewportAspect = viewportW / viewportH;
          const selMargin = 24;
          let selW;
          let selH;
          if (targetAspect >= viewportAspect) {
            selW = viewportW - selMargin * 2;
            selH = selW / targetAspect;
          } else {
            selH = viewportH - selMargin * 2;
            selW = selH * targetAspect;
          }
          const selX = (viewportW - selW) / 2;
          const selY = (viewportH - selH) / 2;

          // Minimum sprite scale keeps the selection covered by the image.
          const minScale = Math.max(selW / sourceTexture.width, selH / sourceTexture.height);
          const maxScale = Math.max(minScale * 20, 1);
          let scale = minScale;
          sprite.scale.set(scale);
          // Center the image over the selection initially.
          sprite.x = selX + selW / 2 - (sourceTexture.width * scale) / 2;
          sprite.y = selY + selH / 2 - (sourceTexture.height * scale) / 2;

          const clampSprite = () => {
            const w = sourceTexture.width * sprite.scale.x;
            const h = sourceTexture.height * sprite.scale.y;
            const minX = selX + selW - w;
            const minY = selY + selH - h;
            const maxX = selX;
            const maxY = selY;
            sprite.x = Math.min(maxX, Math.max(minX, sprite.x));
            sprite.y = Math.min(maxY, Math.max(minY, sprite.y));
          };
          clampSprite();

          const overlay = new Graphics();
          const drawOverlay = () => {
            overlay.clear();
            overlay.rect(0, 0, viewportW, viewportH).fill({ color: 0x000000, alpha: 0.55 });
            overlay.rect(selX, selY, selW, selH).cut();
            overlay.rect(selX, selY, selW, selH).stroke({ color: 0xffffff, width: 2 });
          };
          drawOverlay();
          stage.addChild(overlay);

          // Interaction: pan
          let dragging = false;
          let lastX = 0;
          let lastY = 0;
          const onDown = (e) => {
            dragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
            app.canvas.setPointerCapture?.(e.pointerId);
          };
          const onMove = (e) => {
            if (!dragging) return;
            sprite.x += e.clientX - lastX;
            sprite.y += e.clientY - lastY;
            lastX = e.clientX;
            lastY = e.clientY;
            clampSprite();
          };
          const onUp = (e) => {
            dragging = false;
            app.canvas.releasePointerCapture?.(e.pointerId);
          };
          app.canvas.addEventListener('pointerdown', onDown);
          app.canvas.addEventListener('pointermove', onMove);
          app.canvas.addEventListener('pointerup', onUp);
          app.canvas.addEventListener('pointercancel', onUp);
          app.canvas.addEventListener('pointerleave', onUp);

          // Interaction: zoom (wheel)
          const onWheel = (e) => {
            e.preventDefault();
            const rect = app.canvas.getBoundingClientRect();
            const cx = e.clientX - rect.left;
            const cy = e.clientY - rect.top;
            const imgX = (cx - sprite.x) / sprite.scale.x;
            const imgY = (cy - sprite.y) / sprite.scale.y;
            const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
            scale = Math.min(maxScale, Math.max(minScale, sprite.scale.x * factor));
            sprite.scale.set(scale);
            sprite.x = cx - imgX * scale;
            sprite.y = cy - imgY * scale;
            clampSprite();
          };
          app.canvas.addEventListener('wheel', onWheel, { passive: false });

          // Pinch-to-zoom (two-pointer)
          const activePointers = new Map();
          let pinchStartDist = 0;
          let pinchStartScale = 1;
          const pinchDown = (e) => {
            activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (activePointers.size === 2) {
              const pts = [...activePointers.values()];
              pinchStartDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
              pinchStartScale = sprite.scale.x;
              dragging = false;
            }
          };
          const pinchMove = (e) => {
            if (!activePointers.has(e.pointerId)) return;
            activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (activePointers.size === 2 && pinchStartDist > 0) {
              const pts = [...activePointers.values()];
              const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
              scale = Math.min(maxScale, Math.max(minScale, pinchStartScale * (dist / pinchStartDist)));
              sprite.scale.set(scale);
              clampSprite();
            }
          };
          const pinchUp = (e) => {
            activePointers.delete(e.pointerId);
            if (activePointers.size < 2) pinchStartDist = 0;
          };
          app.canvas.addEventListener('pointerdown', pinchDown);
          app.canvas.addEventListener('pointermove', pinchMove);
          app.canvas.addEventListener('pointerup', pinchUp);
          app.canvas.addEventListener('pointercancel', pinchUp);

          cleanup = () => {
            app.canvas.removeEventListener('pointerdown', onDown);
            app.canvas.removeEventListener('pointermove', onMove);
            app.canvas.removeEventListener('pointerup', onUp);
            app.canvas.removeEventListener('pointercancel', onUp);
            app.canvas.removeEventListener('pointerleave', onUp);
            app.canvas.removeEventListener('wheel', onWheel);
            app.canvas.removeEventListener('pointerdown', pinchDown);
            app.canvas.removeEventListener('pointermove', pinchMove);
            app.canvas.removeEventListener('pointerup', pinchUp);
            app.canvas.removeEventListener('pointercancel', pinchUp);
          };

          dialog.querySelector('#editorCropDialogConfirm').addEventListener('click', () => {
            const cropX = (selX - sprite.x) / sprite.scale.x;
            const cropY = (selY - sprite.y) / sprite.scale.y;
            const cropW = selW / sprite.scale.x;
            const cropH = selH / sprite.scale.y;

            const x = Math.max(0, Math.min(sourceTexture.width, cropX));
            const y = Math.max(0, Math.min(sourceTexture.height, cropY));
            const w = Math.max(1, Math.min(sourceTexture.width - x, cropW));
            const h = Math.max(1, Math.min(sourceTexture.height - y, cropH));

            const cropped = new Texture({
              source: sourceTexture.source,
              frame: new Rectangle(x, y, w, h)
            });
            finish(cropped);
          });
          dialog.querySelector('#editorCropDialogCancel').addEventListener('click', () => finish(null));

          // eslint-disable-next-line no-undef
          ui('#editorCropDialog');
        })
        .catch((err) => {
          console.error('Failed to init crop viewport:', err);
          finish(null);
        });
    });
  }
}
