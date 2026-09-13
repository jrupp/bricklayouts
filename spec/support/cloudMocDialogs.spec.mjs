import { confirmUploadMocs, showMocBlockedDialog } from "../../src/controller/cloudMocDialogs.js";
import { LayoutController } from "../../src/controller/layoutController.js";

/**
 * Stands in for BeerCSS's `ui()`. The first call on a dialog opens it, the
 * second closes it and fires the `close` event the dialog builders resolve on.
 */
function uiToggle(selector) {
  const element = document.querySelector(selector);
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
    ['uploadMocsDialog', 'mocBlockedDialog'].forEach((id) => {
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

    it("replaces a previously opened dialog instead of stacking them", function () {
      confirmUploadMocs(['A']);
      confirmUploadMocs(['A']);

      expect(document.querySelectorAll('#uploadMocsDialog').length).toBe(1);
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
