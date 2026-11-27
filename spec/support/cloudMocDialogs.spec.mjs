/*!
 * Copyright (c) 2026 BrickLayouts. All rights reserved.
 */

import {
  confirmUploadMocs,
  showMocBlockedDialog,
  showMocLimitDialog,
} from "../../src/controller/cloudMocDialogs.js";
import { LayoutController } from "../../src/controller/layoutController.js";

/**
 * Stands in for BeerCSS's `ui()`. The first call on a dialog opens it, the
 * second closes it and fires the `close` event the dialog builders resolve on.
 */
function uiToggle(selector) {
  const element = typeof selector === 'string' ? document.querySelector(selector) : selector;
  if (!element || element.tagName !== 'DIALOG') {
    return;
  }
  if (element.dataset.open === 'true') {
    delete element.dataset.open;
    element.dispatchEvent(new Event('close'));
  } else {
    element.dataset.open = 'true';
  }
}

/**
 * The real dismiss-only dialog builder, which stays on LayoutController because
 * the local MOC dialogs use it too. It reads nothing off `this`.
 */
const showNotice = (id, title, buildBody) => LayoutController.prototype
  ._showMocNoticeDialog(id, title, buildBody);

/**
 * These two dialogs belong to the cloud MOC flow but make no API call, so they
 * live in the public repo and are tested here against real DOM. Everything they
 * render is attacker-controlled -- MOC names come out of a local layout file,
 * the refusal details come from the server -- so the escaping matters.
 */
describe("cloud MOC dialogs", function () {
  beforeEach(function () {
    if (!window.ui) {
      window.ui = () => {};
    }
    spyOn(window, 'ui').and.callFake(uiToggle);
  });

  afterEach(function () {
    ['uploadMocsDialog', 'mocBlockedDialog', 'mocLimitDialog'].forEach((id) => {
      document.getElementById(id)?.remove();
    });
  });

  describe("confirmUploadMocs", function () {
    it("counts and names the MOCs that are not in the cloud", function () {
      confirmUploadMocs(['Town Hall', 'Water Tower']);

      const dialog = document.getElementById('uploadMocsDialog');
      expect(dialog.textContent).toContain('2 MOC(s)');
      expect(dialog.textContent).toContain('Town Hall, Water Tower');
      expect(window.ui).toHaveBeenCalledWith('#uploadMocsDialog');
    });

    it("resolves true only when the user agrees", async function () {
      const agreed = confirmUploadMocs(['A']);
      document.getElementById('uploadMocsConfirm').click();
      await expectAsync(agreed).toBeResolvedTo(true);

      const declined = confirmUploadMocs(['A']);
      document.getElementById('uploadMocsCancel').click();
      await expectAsync(declined).toBeResolvedTo(false);
    });

    it("treats dismissing the dialog as a decline", async function () {
      const dismissed = confirmUploadMocs(['A']);
      // Esc and the backdrop both surface as a `close` event.
      document.getElementById('uploadMocsDialog').dispatchEvent(new Event('close'));
      await expectAsync(dismissed).toBeResolvedTo(false);
    });

    it("renders MOC names as text rather than markup", function () {
      confirmUploadMocs(['<img src=x onerror="window.x=1">']);

      const message = document.getElementById('uploadMocsMessage');
      expect(message.querySelector('img')).toBeNull();
      expect(message.textContent).toContain('<img src=x onerror="window.x=1">');
    });

    it("declines an earlier prompt before showing its replacement", async function () {
      const first = confirmUploadMocs(['A']);
      const second = confirmUploadMocs(['B']);

      // Told "No" rather than left waiting, so only the newer caller uploads.
      await expectAsync(first).toBeResolvedTo(false);
      await new Promise((resolve) => { setTimeout(resolve); });
      expect(document.querySelectorAll('#uploadMocsDialog').length).toBe(1);
      expect(document.getElementById('uploadMocsMessage').textContent).toContain(': B.');

      document.getElementById('uploadMocsConfirm').click();
      await expectAsync(second).toBeResolvedTo(true);
    });

    it("closes an open prompt it replaces through BeerCSS, releasing its overlay",
      async function () {
        // Closer to BeerCSS: the dialog really opens, and closing it fires
        // `close` asynchronously, as the native dialog does.
        window.ui.and.callFake((selector) => {
          const element = typeof selector === 'string'
            ? document.querySelector(selector) : selector;
          if (element.open) {
            element.close();
          } else {
            element.show();
          }
        });
        const first = confirmUploadMocs(['A']);
        const firstDialog = document.getElementById('uploadMocsDialog');
        const second = confirmUploadMocs(['B']);

        await expectAsync(first).toBeResolvedTo(false);
        expect(window.ui).toHaveBeenCalledWith(firstDialog);
        expect(firstDialog.isConnected).toBeFalse();

        await new Promise((resolve) => { setTimeout(resolve); });
        document.getElementById('uploadMocsCancel').click();
        await expectAsync(second).toBeResolvedTo(false);
      });
  });

  describe("showMocLimitDialog", function () {
    it("explains how long the MOC lasts and how to store more", function () {
      showMocLimitDialog();

      const dialog = document.getElementById('mocLimitDialog');
      expect(dialog.querySelector('h6').textContent).toBe('Cloud Storage Full');
      const paragraphs = Array.from(dialog.querySelectorAll('p'))
        .map((p) => p.textContent.replace(/\s+/g, ' ').trim());
      expect(paragraphs).toEqual([
        'Your MOC is available until you close BrickLayouts. It will be lost if you refresh or '
          + 'close the page, unless you place it in a layout and download that layout. Upgrade '
          + 'to store it in the cloud.',
        'Free accounts may only store 10 MOCs in the cloud. To store more MOCs in the cloud, '
          + 'please upgrade your subscription.',
      ]);
      expect(window.ui).toHaveBeenCalledWith('#mocLimitDialog');
    });

    it("resolves true only when the user chooses to subscribe", async function () {
      const subscribed = showMocLimitDialog();
      document.getElementById('mocLimitSubscribe').click();
      await expectAsync(subscribed).toBeResolvedTo(true);

      const acknowledged = showMocLimitDialog();
      document.getElementById('mocLimitOk').click();
      await expectAsync(acknowledged).toBeResolvedTo(false);
    });

    it("treats dismissing the dialog as not subscribing", async function () {
      const dismissed = showMocLimitDialog();
      document.getElementById('mocLimitDialog').dispatchEvent(new Event('close'));
      await expectAsync(dismissed).toBeResolvedTo(false);
    });

    it("removes itself once closed", async function () {
      const shown = showMocLimitDialog();
      document.getElementById('mocLimitOk').click();
      await shown;

      expect(document.getElementById('mocLimitDialog')).toBeNull();
    });

    it("settles an earlier dialog before showing its replacement", async function () {
      const first = showMocLimitDialog();
      const second = showMocLimitDialog();

      await expectAsync(first).toBeResolvedTo(false);
      await new Promise((resolve) => { setTimeout(resolve); });
      expect(document.querySelectorAll('#mocLimitDialog').length).toBe(1);

      document.getElementById('mocLimitSubscribe').click();
      await expectAsync(second).toBeResolvedTo(true);
    });
  });

  describe("showMocBlockedDialog", function () {
    it("lists the blocking layouts, the shared count and the truncation note", function () {
      const error = new Error('MOC is used by 3 layout(s) and cannot be deleted.');
      error.details = {
        blockingLayoutCount: 3,
        layouts: [
          { layoutId: 'l-1', layoutName: 'Town Center' },
          { layoutId: 'l-2', layoutName: 'Train Yard' },
        ],
        ownLayoutCount: 2,
        otherOwnerCount: 1,
        truncated: true,
      };

      showMocBlockedDialog(showNotice, 'My MOC', error);

      const dialog = document.getElementById('mocBlockedDialog');
      expect(dialog.textContent).toContain('MOC is used by 3 layout(s)');
      expect(dialog.textContent).toContain('Town Center');
      expect(dialog.textContent).toContain('Train Yard');
      expect(dialog.textContent).toContain('Also used by 1 layout(s)');
      expect(dialog.textContent).toContain('more layouts than could be listed');
      expect(dialog.querySelectorAll('li').length).toBe(2);
    });

    it("uses the layout id when a blocking layout has no name", function () {
      const error = new Error('Blocked.');
      error.details = { layouts: [{ layoutId: 'l-1' }] };

      showMocBlockedDialog(showNotice, 'My MOC', error);

      expect(document.getElementById('mocBlockedDialog').querySelector('li').textContent)
        .toBe('l-1');
    });

    it("renders layout names as text rather than markup", function () {
      const error = new Error('Blocked.');
      error.details = { layouts: [{ layoutName: '<img src=x onerror="window.x=1">' }] };

      showMocBlockedDialog(showNotice, 'My MOC', error);

      const item = document.getElementById('mocBlockedDialog').querySelector('li');
      expect(item.querySelector('img')).toBeNull();
      expect(item.textContent).toBe('<img src=x onerror="window.x=1">');
    });

    it("names the MOC when the server sent no message", function () {
      showMocBlockedDialog(showNotice, 'My MOC', {});

      expect(document.getElementById('mocBlockedDialog').textContent)
        .toContain('"My MOC" is still used by one or more layouts.');
    });

    it("degrades to the message alone when details are missing or malformed", function () {
      const error = new Error('Blocked.');

      expect(() => showMocBlockedDialog(showNotice, 'My MOC', error)).not.toThrow();
      expect(document.getElementById('mocBlockedDialog').textContent).toContain('Blocked.');
      expect(document.getElementById('mocBlockedDialog').querySelectorAll('li').length).toBe(0);

      document.getElementById('mocBlockedDialog').remove();
      error.details = 'not an object';
      expect(() => showMocBlockedDialog(showNotice, 'My MOC', error)).not.toThrow();
      expect(document.getElementById('mocBlockedDialog').textContent).toContain('Blocked.');
    });
  });
});
