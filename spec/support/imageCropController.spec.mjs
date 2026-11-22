/*!
 * Copyright (c) 2026 BrickLayouts. All rights reserved.
 */

import { ImageCropController } from "../../src/controller/imageCropController.js";
import { Application, Texture } from "../../src/pixi.mjs";

/**
 * The crop dialog's result is what decides whether the editor carries on or is
 * left, and leaving the editor removes the dialog. These specs pin down when
 * that result arrives relative to the dialog closing.
 */
describe("ImageCropController", function () {
  /** Whether each dialog was still in the page at the moment it closed. */
  let closedWhileAttached;
  let texture;

  /**
   * Stands in for BeerCSS's `ui()` on a dialog. Like BeerCSS, it toggles the
   * dialog on the next animation frame rather than straight away, and at that
   * point needs the dialog still in the page to find its overlay, which is the
   * dialog's previous sibling.
   */
  function beerUi(selector) {
    const dialog = document.querySelector(selector);
    if (!dialog) {
      return;
    }
    requestAnimationFrame(() => {
      if (dialog.dataset.open === 'true') {
        delete dialog.dataset.open;
        closedWhileAttached.push(dialog.isConnected);
        dialog.dispatchEvent(new Event('close'));
      } else {
        dialog.dataset.open = 'true';
      }
    });
  }

  const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

  /** Waits until the crop dialog has finished opening. */
  async function waitForOpenDialog() {
    for (let i = 0; i < 200; i += 1) {
      if (document.getElementById('editorCropDialog')?.dataset.open === 'true') {
        return document.getElementById('editorCropDialog');
      }
      // eslint-disable-next-line no-await-in-loop
      await nextFrame();
    }
    throw new Error('The crop dialog never opened');
  }

  beforeEach(function () {
    if (!window.ui) {
      window.ui = () => {};
    }
    closedWhileAttached = [];
    spyOn(window, 'ui').and.callFake(beerUi);
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 32;
    texture = Texture.from(canvas);
  });

  afterEach(function () {
    document.getElementById('editorCropDialog')?.remove();
  });

  it("resolves a cancel only once the dialog has closed", async function () {
    let result;
    const pending = new ImageCropController().show(texture, 32, 32)
      .then((value) => { result = value; });
    const dialog = await waitForOpenDialog();

    dialog.querySelector('#editorCropDialogCancel').click();
    // A caller leaving the editor here would remove the dialog out from under
    // BeerCSS, which has not closed it yet.
    await Promise.resolve();
    expect(result).toBeUndefined();

    await pending;
    expect(result).toBeNull();
    expect(closedWhileAttached).toEqual([true]);
    expect(document.getElementById('editorCropDialog')).toBeNull();
  });

  it("resolves a confirmed crop only once the dialog has closed", async function () {
    let result;
    const pending = new ImageCropController().show(texture, 32, 32)
      .then((value) => { result = value; });
    const dialog = await waitForOpenDialog();

    dialog.querySelector('#editorCropDialogConfirm').click();
    await Promise.resolve();
    expect(result).toBeUndefined();

    await pending;
    expect(result).toEqual(jasmine.any(Texture));
    expect(closedWhileAttached).toEqual([true]);
  });

  it("treats the dialog being closed from outside as a cancel", async function () {
    const destroy = spyOn(Application.prototype, 'destroy').and.callThrough();
    const pending = new ImageCropController().show(texture, 32, 32);
    const dialog = await waitForOpenDialog();

    // What BeerCSS does on Escape or a click on the overlay: neither button is
    // involved, the dialog just closes.
    window.ui.calls.reset();
    dialog.dispatchEvent(new Event('close'));

    expect(await pending).toBeNull();
    expect(destroy).toHaveBeenCalled();
    expect(document.getElementById('editorCropDialog')).toBeNull();
    // Already closed, so toggling it again would reopen it.
    expect(window.ui).not.toHaveBeenCalled();
  });

  describe("keyboard", function () {
    /** Opens the dialog, sends the keys to its canvas, and confirms the crop. */
    async function cropWithKeys(...keys) {
      const pending = new ImageCropController().show(texture, 32, 32);
      const dialog = await waitForOpenDialog();
      const canvas = dialog.querySelector('canvas');
      const events = keys.map((key) => {
        const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
        canvas.dispatchEvent(event);
        return event;
      });
      dialog.querySelector('#editorCropDialogConfirm').click();
      return { frame: (await pending).frame, canvas, events };
    }

    it("makes the image focusable and describes the keys", async function () {
      const { canvas } = await cropWithKeys();

      expect(canvas.tabIndex).toBe(0);
      expect(canvas.getAttribute('aria-label')).toContain('arrow keys');
    });

    it("zooms in with + and back out with -", async function () {
      const { frame: start } = await cropWithKeys();
      const { frame: zoomed } = await cropWithKeys('+');
      const { frame: back } = await cropWithKeys('+', '-');

      // Zooming in selects a smaller region of the image, about its centre.
      expect(zoomed.width).toBeLessThan(start.width);
      expect(zoomed.x + zoomed.width / 2).toBeCloseTo(start.x + start.width / 2, 5);
      expect(back.width).toBeCloseTo(start.width, 5);
    });

    it("moves the image with the arrow keys", async function () {
      // The 64x32 image is twice as wide as the square selection, so it has room
      // to move sideways but not up and down.
      const { frame: start } = await cropWithKeys();
      const { frame: moved } = await cropWithKeys('ArrowLeft');
      const { frame: pinned } = await cropWithKeys('ArrowUp');

      // Moving the image left brings more of its right-hand side under the selection.
      expect(moved.x).toBeGreaterThan(start.x);
      expect(pinned.y).toBe(start.y);
    });

    it("keeps the keys it uses away from the layout's own shortcuts", async function () {
      const reachedWindow = [];
      const onWindowKey = (event) => reachedWindow.push(event.key);
      window.addEventListener('keydown', onWindowKey);
      try {
        const { events } = await cropWithKeys('ArrowRight', '-', 'Escape');

        expect(reachedWindow).toEqual(['Escape']);
        expect(events.map((event) => event.defaultPrevented)).toEqual([true, true, false]);
      } finally {
        window.removeEventListener('keydown', onWindowKey);
      }
    });
  });

  it("gives up without opening the dialog when the crop view cannot start", async function () {
    spyOn(Application.prototype, 'init').and.rejectWith(new Error('no WebGL'));
    spyOn(console, 'error');

    const result = await new ImageCropController().show(texture, 32, 32);

    expect(result).toBeNull();
    // ui() toggles, so calling it here would have opened the dialog.
    expect(window.ui).not.toHaveBeenCalled();
    expect(document.getElementById('editorCropDialog')).toBeNull();
  });
});
