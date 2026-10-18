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
